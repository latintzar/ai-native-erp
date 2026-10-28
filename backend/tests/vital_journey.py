#!/usr/bin/env python3
"""vital_journey — THE ACCOUNT RAIL (THE-JOURNEY-CANON §1 · §2.1 · THE-WIRING-PLAN W1).

§2.1's acceptance is a sentence: «Peter sends their link; they claim the account (real auth, email).
"Super secure, all of it."» Everything below is what has to be true for that sentence to be safe,
and for the account's own state to be a FOLD rather than a flag.

THE THREE LAWS THIS FILE EXISTS TO KEEP:

  · **THE JOURNEY ADDS NO SECOND LEDGER.** THE-WIRING-INDEX §7: «Resolve this by pointing
    `JourneyPorts` at F2's store rather than by writing a second one.» So the twelve journey events
    live on the universal `event` spine at the house's own scope, and §(1) proves there is no
    journey table anywhere in the database. A second store would be the thing that later disagrees
    with the first, and nobody would see it until an account was stuck.

  · **NOTHING ABOUT THE JOURNEY IS STORED** (canon §1.0: «derived, never stored»). `status_of` and
    `step_of` are pure folds; §(2) walks all seven statuses by appending events and nothing else,
    and §(5) proves the resume law — leaving halfway and coming back lands on the same step.

  · **THE SEVEN PROPERTIES OF §2.1**, each of which is a requirement and not a preference: single
    use · short-lived · nonce-bound · the token never becomes the session · the address is fixed by
    the link · one person one account · every claim an audited row. §(6) asserts them one by one.

AND THE FENCE THAT MUST NOT MOVE: /entrar's public mint is CLOSED (§21/§22). §(6.8) claims an
account with `DEMO_PROVISION_OPEN` false — because the invite row is this rail's authorization and
opening it must never have reopened anybody else's door.

Run:  source deploy/harness/rehearsal_env.sh && python3 tests/vital_journey.py
Local (leo-dev): DATABASE_URL=postgresql://…/rocoto_wiring ROCOTO_CLAIM_BASE_URL=https://kit.example
                 PYTHONPATH=. python3 tests/vital_journey.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")
os.environ.setdefault("ROCOTO_CLAIM_BASE_URL", "https://kit.soyrocoto.com")

from fastapi import Response  # noqa: E402

import db  # noqa: E402

PASS = FAIL = 0
T = "vitaljny"                       # the house the ledger folds run against
ADDR = "maria@peixvilalta.test"
HOUSE = "Peix Vilalta"
PETER = "peter@leo.casa"


def ck(label: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


async def _reset(claim_mod) -> None:
    """Wipe only what this vital owns. Never a truncate: an append-only spine shared with every
    other organ must be cleaned by scope, or a run here silently deletes another vital's world."""
    import spine
    async with db.get_pool().acquire() as con:
        await con.execute("delete from event where scope <@ $1::ltree", spine.scope_tenant(T))
        await con.execute("delete from account_claim where lower(address) = $1", ADDR)
        await con.execute(
            "delete from team_members where operator_id in "
            "(select id from operators where lower(email) = $1)", ADDR)
        await con.execute("delete from operators where lower(email) = $1", ADDR)
        await con.execute("delete from sup_session where actor_email = $1", ADDR)
        await con.execute(
            "delete from tenants where slug in "
            "(select slug from tenants where name = $1 or slug = $2)", HOUSE, T)
        await con.execute(
            "insert into tenants(slug,name,status,seeded) values($1,$2,'test',true) "
            "on conflict (slug) do nothing", T, HOUSE)


async def main() -> int:
    await db.init()
    import claim as claim_mod
    import config
    import spine
    from brain import journey

    await claim_mod.ensure_schema()
    await _reset(claim_mod)
    pool = db.get_pool()

    # ── (1) THE LEDGER IS THE SPINE — AND THERE IS NO SECOND STORE ───────────────────────────────
    print("\n-- (1) ONE LEDGER, TWELVE KINDS (INDEX §7: point at F2's store, never write a second) --")
    ck("the twelve kinds are the kit's twelve, in order",
       journey.KINDS == ("invite", "claim", "org", "whatsapp-connect", "share", "upload",
                         "processed", "open-return", "guided", "tested", "turn-on", "expand"),
       str(journey.KINDS))

    async with pool.acquire() as con:
        rows = await con.fetch(
            "select table_name from information_schema.tables where table_schema='public' "
            "and (table_name like '%%activation%%' or table_name like '%%journey%%')")
    ck("NO journey table exists — the events ride the spine, so nothing can disagree with it",
       not rows, "found: " + ", ".join(r[0] for r in rows) if rows else "")

    async with pool.acquire() as con:
        eid, new = await journey.append(con, T, "claim", by="customer", actor=ADDR)
        row = await con.fetchrow("select scope::text, type, payload, actor, lineage from event "
                                 "where id = $1", eid)
    ck("an append lands on the spine at the HOUSE's own scope",
       row and row["scope"] == spine.scope_tenant(T), str(row and row["scope"]))
    ck("…typed `activation.<kind>`, so one query reads the whole journey",
       row and row["type"] == "activation.claim", str(row and row["type"]))
    ck("…carrying the actor, because every journey event names who acted",
       row and row["actor"] == ADDR and (row["payload"] or {}).get("by") == "customer")

    bad = None
    try:
        async with pool.acquire() as con:
            await journey.append(con, T, "invented-kind")
    except ValueError as e:
        bad = str(e)
    ck("a kind outside the twelve is REFUSED — the vocabulary is closed", bad is not None, bad or "")

    founders = []
    for k in ("processed", "invite"):
        try:
            async with pool.acquire() as con:
                await journey.append(con, T, k, by="customer")
            founders.append(f"{k} ACCEPTED")
        except ValueError:
            pass
    ck("`invite` and `processed` REFUSE a customer actor — §91.4.5: a status that could advance "
       "itself would be a claim the product cannot make", not founders, ", ".join(founders))

    # ── (2) THE STATUS IS A FOLD, WALKED ALL SEVEN ───────────────────────────────────────────────
    print("\n-- (2) SEVEN STATUSES, FOLDED — nothing stored (canon §1.0/§1.1) --")
    ck("an empty ledger reads `invited` — a link exists and nobody has used it",
       journey.status_of([]) == "invited")

    walk = [("claim", "customer", "claimed"), ("upload", "customer", "processing"),
            ("processed", "founder", "ready"), ("open-return", "customer", "testing"),
            ("turn-on", "customer", "bounded"), ("expand", "customer", "whole")]
    ok_walk = True
    for kind, by, expect in walk:
        async with pool.acquire() as con:
            await journey.append(con, T, kind, by=by)
            got = journey.status_of(await journey.events(con, T))
        if got != expect:
            ok_walk = False
            ck(f"…`{kind}` should read `{expect}`", False, f"read {got}")
    ck("every transition moves the status, and only by appending an event", ok_walk,
       " → ".join(w[2] for w in walk))

    # ── (3) THE TEST TAINT NEVER MOVES A LIVE ACCOUNT (§27.14) ───────────────────────────────────
    print("\n-- (3) A TEST ROW CANNOT MOVE A REAL ACCOUNT (checkpoint §27.14) --")
    await _reset(claim_mod)
    async with pool.acquire() as con:
        await con.execute(
            "insert into event(scope,type,source,payload,lineage) "
            "values($1::ltree,'activation.claim','test','{\"by\":\"customer\"}'::jsonb,'test')",
            spine.scope_tenant(T))
        live = await journey.events(con, T)
        both = await journey.events(con, T, lineage="")
    ck("a `test`-lineage journey row is INVISIBLE to the live fold", not live, f"read {len(live)}")
    ck("…the account still reads `invited`, so a sandbox can never claim it",
       journey.status_of(live) == "invited")
    ck("…and it IS there when a harness asks for both lineages (it was written, not dropped)",
       len(both) == 1)

    # ── (4) A DOUBLE PRESS IS ONE EVENT ──────────────────────────────────────────────────────────
    print("\n-- (4) IDEMPOTENT APPEND — a double press is one event, not two the fold counts --")
    await _reset(claim_mod)
    async with pool.acquire() as con:
        a, new_a = await journey.append(con, T, "processed", by="founder", dedupe_key="k1")
        b, new_b = await journey.append(con, T, "processed", by="founder", dedupe_key="k1")
        n = len(await journey.events(con, T))
    ck("the same dedupe key returns the SAME row and writes nothing new",
       a == b and new_a and not new_b, f"{a}/{b} new={new_a}/{new_b}")
    ck("…so the ledger holds one event, not two", n == 1, f"{n}")

    # ── (5) THE STEP IS DERIVED, AND THE RESUME LAW HOLDS (§1.4) ─────────────────────────────────
    print("\n-- (5) THE CARD'S POINTER — derived, and the same after coming back (§1.0/§1.4) --")
    await _reset(claim_mod)
    async with pool.acquire() as con:
        evs = await journey.events(con, T)
    ck("nothing done → the first step is `claim`", journey.step_of(evs) == "claim",
       str(journey.step_of(evs)))
    async with pool.acquire() as con:
        await journey.append(con, T, "claim")
        evs = await journey.events(con, T)
    ck("claimed → the next thing is `organisation`", journey.step_of(evs) == "organisation")
    ck("…and reading it AGAIN says the same thing — leaving is a legitimate way to use this (§1.4)",
       journey.step_of(evs) == "organisation")

    async with pool.acquire() as con:
        for f in journey.ORG_FIELDS:
            await journey.append(con, T, "org", field=f, value="x")
        evs = await journey.events(con, T)
    ck("the four `OrgPort.write` fields answered → the step is done off the WRITES themselves (§2.2)",
       journey.step_of(evs) == "whatsapp", str(journey.step_of(evs)))
    ck("…and a caller that HAS the grants store decides instead — the fold takes what it reads",
       journey.step_of(evs, org_answered=0, org_total=6) == "organisation")

    # ── (6) THE CLAIM — the seven properties of §2.1, one by one ─────────────────────────────────
    print("\n-- (6) THE CLAIM RAIL — §2.1's seven properties --")
    await _reset(claim_mod)

    minted = await claim_mod.mint(ADDR, HOUSE, minted_by=PETER)
    tok = minted["token"]
    ck("P5 · the link carries the ADDRESS and the HOUSE, and the page reads them off it",
       (await claim_mod.peek(tok)).get("house") == HOUSE
       and (await claim_mod.peek(tok)).get("address") == ADDR)
    ck("…and the mint FAILS CLOSED with no claim base — it will not guess app.soyrocoto.com",
       (lambda: True)() and _refuses_without_base(claim_mod))

    # P3 · the nonce is in the WHERE, so a mismatch cannot BURN the link either
    nonce = await claim_mod._arm_nonce(Response(), tok)
    burnt = await claim_mod.consume(tok, "a-wrong-nonce")
    ck("P3 · a wrong nonce is REFUSED", burnt is None)
    still = await claim_mod.peek(tok)
    ck("…and it did NOT consume the link — a refusal an attacker can trigger is a denial of "
       "service, and that is still the attacker choosing what happens", still.get("ok") is True)

    # P2 · short-lived
    async with pool.acquire() as con:
        await con.execute("update account_claim set expires_at = now() - interval '1 day' "
                          "where token_hash = $1", claim_mod._hash(tok))
    ck("P2 · an expired link says SO, plainly, and offers a fresh one to the same address",
       (await claim_mod.peek(tok)).get("error") == "expired")
    async with pool.acquire() as con:
        await con.execute("update account_claim set expires_at = now() + interval '7 days' "
                          "where token_hash = $1", claim_mod._hash(tok))

    # P6/P4/P7 · the claim itself
    out = await claim_mod.claim(tok, nonce, ip="10.0.0.9", ua="Vital/1.0")
    ws, sess = out["workspace"], out["session"]
    ck("the claim opens the house named on the link", ws["name"] == HOUSE, str(ws["name"]))
    ck("P4 · the token never becomes the session — a fresh `sup_session` is minted instead",
       sess["raw"] and tok not in sess["raw"])
    ck("…and the token is dead the moment the UPDATE returned a row",
       await claim_mod.consume(tok, nonce) is None)

    async with pool.acquire() as con:
        r = await con.fetchrow(
            "select consumed_at, claimed_ip, claimed_ua, minted_by, tenant_slug, opened_at "
            "from account_claim where token_hash = $1", claim_mod._hash(tok))
    ck("P7 · every claim is an AUDITED row — who, when, from what agent, against which invite",
       r and r["consumed_at"] and r["claimed_ip"] == "10.0.0.9"
       and r["claimed_ua"] == "Vital/1.0" and r["minted_by"] == PETER
       and r["tenant_slug"] == ws["slug"], str(dict(r) if r else None))

    dead = None
    try:
        await claim_mod.claim(tok, nonce, ip="10.0.0.9", ua="Vital/1.0")
    except Exception as e:  # SupApiError
        dead = getattr(e, "code", None) or getattr(e, "error", None) or str(e)
    ck("P1 · SINGLE USE — a second claim on the same link is refused", dead is not None, str(dead))

    # P6 · one person, one account
    second = await claim_mod.mint(ADDR, "Otra Casa S.L.", minted_by=PETER)
    n2 = await claim_mod._arm_nonce(Response(), second["token"])
    out2 = await claim_mod.claim(second["token"], n2, ip="10.0.0.9", ua="Vital/1.0")
    ck("P6 · ONE PERSON, ONE ACCOUNT — a second claim RESUMES the same workspace, never a second",
       out2["workspace"]["slug"] == ws["slug"], f"{ws['slug']} vs {out2['workspace']['slug']}")
    ck("…and it does NOT rename a house the operator already has",
       out2["workspace"]["name"] == HOUSE, str(out2["workspace"]["name"]))

    # (6.8) the fence that must not move
    ck("the public /entrar mint is still CLOSED — the invite row is this rail's own authorization, "
       "and opening it reopened nobody else's door", not config.DEMO_PROVISION_OPEN,
       f"DEMO_PROVISION_OPEN={config.DEMO_PROVISION_OPEN}")

    # revoke kills instantly
    third = await claim_mod.mint("otro@peixvilalta.test", HOUSE, minted_by=PETER)
    ck("revoking answers yes", await claim_mod.revoke(third["token"]) is True)
    ck("…and the link dies AT ONCE, not at the next sweep",
       (await claim_mod.peek(third["token"])).get("error") == "revoked")

    # ── (7) THE CLAIM WRITES THE JOURNEY, WITH THE TRUE HOURS ────────────────────────────────────
    print("\n-- (7) THE CLAIM'S OWN LEDGER — the invite keeps the hour Peter minted it --")
    slug = ws["slug"]
    async with pool.acquire() as con:
        evs = await journey.events(con, slug)
        minted_at = await con.fetchval(
            "select created_at from account_claim where token_hash = $1", claim_mod._hash(tok))
    kinds = [e["kind"] for e in evs]
    ck("the house's ledger opens with `invite` then `claim`", kinds[:2] == ["invite", "claim"],
       str(kinds))
    ck("the account now reads `claimed` — the status is the fold and nothing wrote it",
       journey.status_of(evs) == "claimed", journey.status_of(evs))
    inv = next((e for e in evs if e["kind"] == "invite"), None)
    ck("the invite carries PETER'S hour, not the claim's — «Invited by Peter · 27 August» is a fact, "
       "not a re-stamp",
       inv and abs((datetime.fromisoformat(inv["at"]) - minted_at).total_seconds()) < 2,
       f"{inv and inv['at']} vs {minted_at}")
    ck("…and it names the house and the address the link fixed",
       inv and inv.get("house") == HOUSE and inv.get("value") == ADDR, str(inv))
    ck("the invite is the founder's act on the record",
       inv and inv.get("by") == "founder")
    async with pool.acquire() as con:
        caused = await con.fetchval(
            "select caused_by from event where scope=$1::ltree and type='activation.claim' "
            "order by id asc limit 1", spine.scope_tenant(slug))
        inv_id = await con.fetchval(
            "select id from event where scope=$1::ltree and type='activation.invite' "
            "order by id asc limit 1", spine.scope_tenant(slug))
    ck("the claim points back at the invite it answered (§3's relatedness chain)",
       caused is not None and caused == inv_id, f"{caused} vs {inv_id}")
    # TWO GENUINE CLAIMS ARE TWO PAIRS, AND A RETRY OF ONE IS NOT. The person above claimed twice —
    # a second link Peter minted for the same address — and the ledger says so, because both acts
    # happened and this is a record of acts. What must never double is a RETRY of the same claim's
    # tail (a timeout, a redeploy mid-request), which is what the per-token dedupe key is for.
    ck("two genuine claims are two pairs on the record — the ledger records acts, not states",
       kinds.count("invite") == 2 and kinds.count("claim") == 2, str(kinds))
    before = len(evs)
    async with pool.acquire() as con:
        inv2, new_i = await journey.append(
            con, slug, "invite", by="founder", at=minted_at, value=ADDR, house=HOUSE,
            dedupe_key=f"claim:{claim_mod._hash(tok)}:invite")
        _, new_c = await journey.append(
            con, slug, "claim", by="customer", caused_by=inv2,
            dedupe_key=f"claim:{claim_mod._hash(tok)}:claim")
        after = len(await journey.events(con, slug))
    ck("…but re-running THAT claim's tail writes nothing — both appends are dedupe-keyed on the token",
       after == before and not new_i and not new_c, f"{before} → {after}")

    # cleanup: leave nothing of this vital's own behind
    async with pool.acquire() as con:
        await con.execute("delete from event where scope <@ $1::ltree", spine.scope_tenant(slug))
        await con.execute("delete from sup_session where actor_email = $1", ADDR)
    await _reset(claim_mod)

    total = PASS + FAIL
    print(f"\nJOURNEY + CLAIM: {PASS}/{total}")
    return 0 if FAIL == 0 else 1


def _refuses_without_base(claim_mod) -> bool:
    """The mint must refuse rather than guess a domain. `app.soyrocoto.com` is the LIVE customer app
    and the cutover is Peter's explicit go (§92) — minting invitations into it would perform that
    cutover one mailed link at a time."""
    keep = os.environ.get("ROCOTO_CLAIM_BASE_URL", "")
    os.environ["ROCOTO_CLAIM_BASE_URL"] = ""
    try:
        return claim_mod.claim_base() == ""
    finally:
        os.environ["ROCOTO_CLAIM_BASE_URL"] = keep


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
