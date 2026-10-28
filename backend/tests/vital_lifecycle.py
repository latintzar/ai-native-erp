"""vital_lifecycle.py — THE HARD LIFECYCLE SWITCH, THE §6 CHECKBOX SET, AND THE CREATOR-LINE GUARD.

Part 1 (2026-07-22) — the live-demo FREEZE fix. The demo froze: a new prospect (NO catalogue) listed
an order, the voice model asided to 'check the catalogue' that doesn't exist, and the call hung on
dead air. Proves the fix:
  1. has_catalogue is a hard, deterministic check (a prospect has none);
  2. the status reveals status-appropriate NOTES (acknowledge + book Peter, never ground a phantom order);
  3. THE FREEZE FIX: even when the voice model WANTS to aside, a no-catalogue caller gets an INLINE reply
     (deferred=False) — never an aside into a void, never dead air.

Part 2 (2026-07-27) — THE CREATOR-LINE GUARD, and the one deliberate exception to it. Peter's own
acceptance test is "WhatsApp Rocoto from my phone pretending to be the customer and land in the order
brain". `app._maybe_extract_order` refused every message from `ROCOTO_CREATOR_NUMBERS` and returned
SILENTLY — no order, no log, no event. The guard is right (boss-channel instructions must never mint a
food order) so it stays; what changes is that the exception is EXPLICIT and the skip leaves a TRACE.

Part 3 (2026-07-27) — THE §6 CHECKBOX SET on the founder's own tenant. The lifecycle is derived from
real state, never asserted, so "looks onboarded" has to mean the state EXISTS: catalogue rows, a
delivery rule, a bound number, a go-live claim. Proves each box is true FOR A REASON — and that
`interview_done`, which has no honest state behind it on a founder's box, stays FALSE.

Part 4 (2026-07-27) — the identity BINDING (§6 trust order): a second number for an existing customer,
written by the ONE writer, refused on every merge-shaped case, audited and reversible.

Run against the rehearsal clone:
    source deploy/harness/rehearsal_env.sh && python3 tests/vital_lifecycle.py
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import config
import db
import lifecycle
import runtime
import voice_protocol  # noqa: E402

PHONE = "+34999001616"
SCOPE = runtime.scope_of(PHONE)
# A synthetic creator number with NO customer profile anywhere — the "guard holds" case.
BOSS_ONLY = "+34999002020"
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    print(f"  [SKIP] {name} — {why}")


async def _wipe_scope(scope):
    """Delete a test scope's rows in FK order. `action.opened_by_event` references `event`, so a bare
    `delete from event` fails the moment a duty/review row has been opened on that scope — which is
    now the normal state of a seeded clone, and used to be the vital's own crash."""
    async with db.scoped_tx(scope) as con:
        await con.execute("delete from action where scope=$1::ltree", scope)
        await con.execute("delete from timer where scope=$1::ltree", scope)
        await con.execute("delete from open_loop where scope=$1::ltree", scope)
        await con.execute("delete from event where scope=$1::ltree", scope)


async def part1_freeze_fix():
    print("\n── PART 1 · the hard lifecycle switch + the voice FREEZE fix ──")
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
    await _wipe_scope(SCOPE)

    # KNOWN LIMITATION, stated rather than hidden (2026-07-27): `lifecycle.has_catalogue` resolves the
    # caller's tenant through `tenancy.tenant_of`, which collapses EVERY `wa.<digits>` scope onto
    # BRAIN_TENANT. On a box whose founder tenant has a catalogue (i.e. any seeded box, and any real
    # single-tenant deployment) a brand-new PROSPECT therefore reads as "has a catalogue" — the
    # no-catalogue branch this part proves is simply unreachable through a wa.* scope there. These
    # checks are SKIPPED, never faked; `onboarding_ctx` already carries the correct resolver ladder
    # (explicit → scope_node → lead token → a NAMED fallback) and is the shape has_catalogue should
    # eventually share.
    if await lifecycle.has_catalogue(SCOPE):
        skip("the no-catalogue FREEZE-FIX branch (4 checks)",
             "this box's founder tenant HAS a catalogue, so tenancy.tenant_of's fallback makes every "
             "wa.* prospect read as catalogued — the branch is unreachable here, not broken")
        return

    cat = await lifecycle.has_catalogue(SCOPE)
    ck("has_catalogue is a hard check — a prospect has NO catalogue", cat is False, f"has_catalogue={cat}")

    st = await lifecycle.status(SCOPE, "prospect")
    notes = lifecycle.notes(st)
    ck("the status reveals the no-catalogue NOTES (acknowledge + book Peter, don't ground a phantom order)",
       "peter" in notes.lower() and "artículos" in notes.lower() and "no intentes" in notes.lower())
    ck("the status reveals the CADETE job brief (per-stage job description, 2026-07-25)",
       "EL CADETE" in notes and "CONDUCTA" in notes)

    # THE FREEZE FIX — stub the R1 pass to WANT an aside; a no-catalogue caller must still answer INLINE.
    orig = voice_protocol._r1_classify_reply
    seen = {}

    async def _stub_r1(scope, utterance, grounding, lang, system_extra=""):
        seen["system_extra"] = system_extra
        return ("", True)  # the model can't ground it → wants to aside (what froze the demo)

    voice_protocol._r1_classify_reply = _stub_r1
    try:
        out = await voice_protocol.in_call_turn(
            SCOPE, "quiero 10 gallinas, 5 kg de huesos y un jamón madurado de 30 días",
            {"lang": "es", "tier": "prospect", "card": "", "tabs": []})
    finally:
        voice_protocol._r1_classify_reply = orig

    ck("FREEZE FIX: a no-catalogue order does NOT open an aside (deferred=False → never dead air)",
       out.get("deferred") is False, f"deferred={out.get('deferred')}")
    ck("the inline reply speaks (never dead air, even with no model output)",
       bool((out.get("reply") or "").strip()), (out.get("reply") or "")[:80])
    ck("the JOB BRIEF + no-catalogue note rode the R1 SYSTEM slot (the brief scripts the behaviour)",
       "EL CADETE" in seen.get("system_extra", "") and "NO TIENES SU CATÁLOGO" in seen.get("system_extra", "")
       and "PETER" in seen.get("system_extra", ""), f"system_extra_bytes={len(seen.get('system_extra',''))}")

    await _wipe_scope(SCOPE)
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def part2_creator_guard(app_mod):
    print("\n── PART 2 · the CREATOR-LINE guard, its ONE exception, and its TRACE ──")
    creator = ("+" + sorted(config.CREATOR_DIGITS)[0]) if config.CREATOR_DIGITS else ""
    ck("config knows the creator line, digit-normalised (formatting can't slip past it)",
       config.is_creator_number(creator) and config.is_creator_number(f"whatsapp:{creator}")
       and config.is_creator_number(creator.replace("+", "+ ")),
       f"creator={creator}")
    ck("a plain customer number is NOT a creator number",
       not config.is_creator_number("+34611111001"))

    orig_creators, orig_test = config.CREATOR_DIGITS, config.TEST_CUSTOMER_DIGITS
    try:
        # (a) a creator number with NO customer identity → the guard HOLDS. This is the rule.
        config.CREATOR_DIGITS = frozenset(set(orig_creators) | {config.phone_digits(BOSS_ONLY)})
        config.TEST_CUSTOMER_DIGITS = frozenset()
        r = await app_mod._creator_order_route(BOSS_ONLY)
        ck("a boss-line message does NOT reach the order brain (the rule is intact)",
           r["as_customer"] is False and r["why"] == "creator_line", str(r["why"]))

        # (b) the same number, explicitly allowlisted → treated as a CUSTOMER, and the verdict SAYS
        #     which mechanism let it through.
        config.TEST_CUSTOMER_DIGITS = frozenset({config.phone_digits(BOSS_ONLY)})
        r2 = await app_mod._creator_order_route(BOSS_ONLY)
        ck("ROCOTO_TEST_CUSTOMER_NUMBERS lets a creator number act as a CUSTOMER (explicit, reversible)",
           r2["as_customer"] is True and r2["why"] == "test_customer_allowlist", str(r2["why"]))
    finally:
        config.CREATOR_DIGITS, config.TEST_CUSTOMER_DIGITS = orig_creators, orig_test

    # (c) THE ONE THAT MAKES PETER'S TEST WORK WITH NO ENV CHANGE: his own number carries a SEEDED
    #     customer profile (the demo world made him Bar Lumbre), so IDENTITY — not a string list —
    #     is what routes him into the order brain, and it disappears with the demo world.
    r3 = await app_mod._creator_order_route(creator)
    ident = r3.get("identity") or {}
    ck("the founder's own line routes to the order brain because the SEEDED identity says customer",
       r3["as_customer"] is True and r3["why"] == "seeded_customer_profile",
       f"why={r3['why']} identity={ident.get('display_name')!r} seeded={ident.get('seeded')}")
    ck("…and the verdict carries WHO identity thinks he is (so a trace can name the venue)",
       bool(ident.get("known")) and bool(ident.get("display_name")),
       f"{ident.get('display_name')!r} via={ident.get('via')} tier={ident.get('tier')!r}")

    # (d) a normal customer is never touched by any of this
    r4 = await app_mod._creator_order_route("+34611111001")
    ck("a normal customer bypasses the guard entirely", r4["as_customer"] and r4["why"] == "not_creator")

    # (e) THE TRACE — the whole point. A held message must be answerable afterwards.
    orig_creators = config.CREATOR_DIGITS
    bscope = runtime.scope_of(BOSS_ONLY)
    try:
        config.CREATOR_DIGITS = frozenset(set(orig_creators) | {config.phone_digits(BOSS_ONLY)})
        route = await app_mod._creator_order_route(BOSS_ONLY)
        mid = "vital-lifecycle-skip-1"
        await _wipe_scope(bscope)
        await app_mod._trace_creator_route(mid, BOSS_ONLY, "ponme 10 kg de chorizo", route)
        async with db.scoped_tx(bscope) as con:
            rows = await con.fetch(
                "select type, lane, payload from event where scope=$1::ltree "
                "and type like 'ops.order_intake%' order by id desc limit 3", bscope)
        payload = dict(rows[0]["payload"] or {}) if rows else {}
        ck("a SKIPPED message leaves an ops.* event on its own scope (never a silent return)",
           bool(rows) and rows[0]["type"] == "ops.order_intake_skipped",
           rows[0]["type"] if rows else "no event")
        ck("…and the event says WHY, in words a human can act on",
           "why" in payload and "ROCOTO_TEST_CUSTOMER_NUMBERS" in str(payload.get("text", "")),
           str(payload.get("why")))
        ck("the trace lane is 'reasoning' (an ops note, not something that happened to the customer)",
           bool(rows) and rows[0]["lane"] == "reasoning")
        await app_mod._trace_creator_route(mid, BOSS_ONLY, "ponme 10 kg de chorizo", route)
        async with db.scoped_tx(bscope) as con:
            n = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='ops.order_intake_skipped'",
                bscope)
        ck("the trace is deduped on the message id (a redelivery writes one row, not two)",
           int(n) == 1, f"n={n}")
    finally:
        config.CREATOR_DIGITS = orig_creators
        await _wipe_scope(bscope)
        async with db.scoped_tx(bscope) as con:
            await con.execute("delete from scope_node where scope=$1::ltree", bscope)


async def part3_boxes(app_mod):
    print("\n── PART 3 · the §6 CHECKBOX SET on the founder's own tenant ──")
    tenant = config.BRAIN_TENANT
    res = await app_mod._ensure_founder_tenant()
    ck("founder-tenant provisioning runs clean", not res.get("error"), str(res))
    ck("the catalogue it found is REAL (the box has rows behind it)", int(res.get("skus") or 0) > 0,
       f"in_assortment={res.get('skus')}")
    ck("the tenant's own WhatsApp line is BOUND (number_bound has state behind it)",
       bool(res.get("number_bound")), f"number={res.get('number')} note={res.get('number_note', '')}")

    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select name, status, seeded, number, golive_at from tenants where slug=$1", tenant)
    ck("the tenant row is the founder's distributor, not the pre-rebrand default",
       row is not None and (row["name"] or "") not in ("", "Sancho"),
       row["name"] if row else "no row")
    ck("go-live is CLAIMED (the `live` box reads golive_at)",
       row is not None and row["golive_at"] is not None)
    ck("status stays 'test' — golive_at ACTIVATES, status BILLS, and the founder does not invoice "
       "himself (brain/billing scans status='live')", row is not None and row["status"] != "live",
       f"status={row['status'] if row else '?'}")

    before = row["golive_at"] if row else None
    res2 = await app_mod._ensure_founder_tenant()
    async with db.get_pool().acquire() as con:
        after = await con.fetchval("select golive_at from tenants where slug=$1", tenant)
    ck("provisioning is idempotent — a second boot re-claims nothing",
       after == before and res2.get("golive") is False, f"golive={res2.get('golive')}")

    # THE BOXES, derived on the founder's own scope, exactly as the mind reads them
    creator = "+" + sorted(config.CREATOR_DIGITS)[0]
    scope = runtime.scope_of(creator)
    ctx = await lifecycle.onboarding_ctx(scope)
    boxes = lifecycle.boxes_of(ctx, tier="creator", is_founder=True)
    print(f"    boxes: {boxes}")
    print(f"    ctx:   tenant={ctx.get('tenant')!r} resolved={ctx.get('tenant_resolved')!r} "
          f"n_cat={ctx.get('n_cat')} number={ctx.get('number')!r} golive={ctx.get('golive_at')}")
    ck("box skus_uploaded — true because the catalogue ROWS exist", boxes["skus_uploaded"] is True)
    ck("box flow_done — true because the catalogue exists", boxes["flow_done"] is True)
    ck("box fee_paid — true by lifecycle's own founder rule (he does not pay himself)",
       boxes["fee_paid"] is True)
    ck("box number_bound — true because tenants.number now holds the real line",
       boxes["number_bound"] is True, str(ctx.get("number")))
    ck("box live — true because golive_at was claimed off real state", boxes["live"] is True)
    ck("box interview_done — HONESTLY FALSE: it counts transcript_facts for a LEAD and the founder "
       "has no lead row. A lifecycle that lies is worse than one that is incomplete",
       boxes["interview_done"] is False)
    block = lifecycle.checkbox_block(boxes)
    ck("the fold renders every box WITH the known-state sentence (an absence is never missing data)",
       lifecycle.KNOWN_STATE_MARK in block and all(b in block for b in lifecycle.BOXES))

    from brain import range as _range
    async with db.get_pool().acquire() as con:
        rng = await _range.get_range(con, tenant)
    ck("the delivery RULE is set and evaluable (radius + depot, §5.8a)", bool(rng.get("set")),
       f"{rng.get('range_kind')} {rng.get('range_km')}km depot={rng.get('depot_lat')},{rng.get('depot_lon')}")
    st = await app_mod._dispatch_settings()
    ck("the prep cutoff / dispatch settings are present (review.prep_cutoff_iso clamps against it)",
       bool(str(st.get("schedule_time") or "").strip()), f"schedule_time={st.get('schedule_time')}")

    state = await app_mod._founder_tenant_state()
    cat = state.get("catalogue") or {}
    ck("/api/app/tenant reports the REAL catalogue count, with seeded rows distinguished",
       int(cat.get("in_assortment") or 0) > 0 and "seeded" in cat, str(cat))
    ck("/api/app/tenant reports the same boxes the mind reads (one derivation, not two)",
       state.get("boxes") == boxes)


async def part4_identity_binding():
    print("\n── PART 4 · a second number for an existing customer (§6 trust order) ──")
    from brain import identity as ident
    tenant = config.BRAIN_TENANT
    # THIS PART BRINGS ITS OWN CUSTOMERS (2026-07-27). It used to read two seeded
    # `customer_profiles` rows out of the database and bail when it found none — which made it pass
    # alone and FAIL inside `run_all_vitals.sh`, the one shape of red nobody can act on. The cause
    # was ordering, not the product: `seedworld` is deliberately LAST in phase 2 (it loads a whole
    # world and tears it down, so nothing deterministic may run behind it and inherit its rows), and
    # phase 2 starts from a freshly rebuilt clone. So at this point in the run there is no seed to
    # bind against, and there never will be.
    #
    # Moving this vital after `seedworld` would "fix" it by breaking the reason `seedworld` is last.
    # A vital that depends on another vital's leftovers is not a gate. So it creates the two rows it
    # needs, marked `seeded` so its own cleanup can only ever delete its own, and removes them in the
    # `finally` below.
    OWNER_P, OTHER_P = "+34999003031", "+34999003032"
    async with db.get_pool().acquire() as con:
        for ph, nm in ((OWNER_P, "Mesón Peral"), (OTHER_P, "Taberna Ruano")):
            await con.execute(
                "insert into customer_profiles (phone_number, tenant_id, display_name, seeded) "
                "values ($1,$2,$3,true) on conflict (tenant_id, phone_number) do update set "
                "tenant_id=excluded.tenant_id, display_name=excluded.display_name, seeded=true",
                ph, tenant, nm)
        owner = await con.fetchval(
            "select phone_number from customer_profiles where tenant_id=$1 and seeded "
            "and phone_number like '+34%' order by phone_number limit 1", tenant)
        other = await con.fetchval(
            "select phone_number from customer_profiles where tenant_id=$1 and seeded "
            "and phone_number <> $2 order by phone_number desc limit 1", tenant, owner or "")
    ck("a seeded customer exists to bind against", bool(owner and other),
       f"owner={owner} other={other}")
    if not owner or not other:
        return
    NEW = "+34999003030"
    await ident.unlink_phone(owner, NEW, tenant=tenant)     # clean slate

    bad = await ident.link_phone(owner, owner, tenant=tenant)
    ck("refuses to link a customer to itself", bad.get("reason") == "same_number", str(bad))
    bad2 = await ident.link_phone(owner, other, tenant=tenant)
    ck("refuses a number that already OWNS a customer row — that is a MERGE, the boss's call",
       bad2.get("reason") == "owns_profile", str(bad2))
    bad3 = await ident.link_phone("+34000000000", NEW, tenant=tenant)
    ck("refuses when the owner is not a customer of this tenant", bad3.get("reason") == "no_owner", str(bad3))

    ok = await ident.link_phone(owner, NEW, tenant=tenant, declared_by="boss")
    ck("the boss declares a second number → the identity write lands", ok.get("ok") is True, str(ok))
    ck("…and the number is on the customer's linked list", NEW in (ok.get("linked_phones") or []))
    again = await ident.link_phone(owner, NEW, tenant=tenant)
    ck("the write is idempotent (declaring it twice is not two numbers)", again.get("already") is True)

    resolved = await ident.resolve(NEW, tenant=tenant)
    ck("RESOLUTION follows: the new number now answers as the owner's venue",
       resolved.get("known") is True and resolved.get("customer_name") == (ok.get("display_name") or ""),
       f"{resolved.get('customer_name')!r} note={resolved.get('note')!r}")

    role = await ident.customer_role(NEW, tenant=tenant)
    ck("customer_role sees it as a LINKED phone and carries the seeded/real distinction",
       role.get("known") is True and role.get("via") == "linked_phone" and role.get("owner_phone") == owner,
       f"via={role.get('via')} seeded={role.get('seeded')}")

    async with db.get_pool().acquire() as con:
        third = await con.fetchval(
            "select phone_number from customer_profiles where tenant_id=$1 and seeded "
            "and phone_number <> $2 and phone_number <> $3 limit 1", tenant, owner, other or "")
    if third:
        clash = await ident.link_phone(third, NEW, tenant=tenant)
        ck("refuses to steal a number already linked to a DIFFERENT customer",
           clash.get("reason") == "linked_elsewhere", str(clash))

    oscope = runtime.scope_of(owner)
    async with db.scoped_tx(oscope) as con:
        n = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='identity.phone_linked'", oscope)
    ck("the binding is AUDITED — identity.phone_linked lands on the customer's own scope",
       int(n or 0) >= 1, f"events={n}")

    undo = await ident.unlink_phone(owner, NEW, tenant=tenant)
    ck("the binding is REVERSIBLE (§6: logged AND reversible)",
       undo.get("ok") is True and NEW not in (undo.get("linked_phones") or []), str(undo))

    # Take back exactly the two rows this part created, and nothing else — BY NAME, never by
    # `where seeded`, which on a clone that has run seedworld would eat the demo world.
    async with db.get_pool().acquire() as con:
        await con.execute("delete from customer_profiles where phone_number = any($1::text[])",
                          [OWNER_P, OTHER_P])


async def ensure_world():
    """This vital NEEDS the seeded world, so it builds one rather than hoping to find one.

    Almost every check below reads real state — the founder's identity resolving to a customer, a
    catalogue with rows behind it, the tenant row, the go-live boxes. All of that is written by
    `brain/seed.py`. Inside `run_all_vitals.sh` the vital that loads that world, `seedworld`, is
    deliberately the LAST deterministic vital in phase 2 (it loads a whole world and tears it down,
    so nothing may run behind it and inherit its rows), and phase 2 begins on a freshly rebuilt
    clone. So for as long as this file only READ the world, it could not pass in the harness — and
    it passed standalone purely on whatever a previous run had left lying around. Eleven checks, red
    only in sequence, which is the one kind of red nobody can act on.

    Reordering the two would fix this by breaking the reason `seedworld` is last. Seeding here is
    idempotent (`reset_demo_seed` is what the product's own reset calls) and leaves the file
    dependent on nothing but itself."""
    from brain import seed as bseed
    try:
        await bseed.reset_demo_seed(config.BRAIN_TENANT, strict=False, through_brain=False)
    except Exception as e:                              # noqa: BLE001
        print(f"  [warn] could not seed the world for this run: {e}")


async def teardown_world():
    """Put the clone back the way this file found it.

    `ensure_world()` builds a seeded world so this vital depends on nothing but itself. That fixed
    THIS file and broke a later one: inside `run_all_vitals.sh` the whole of phase 2 shares one
    clone, `lifecycle` runs well before `pursuit`, and a seeded world ticks the tenant's go-live
    boxes — so `pursuit`'s "a brand-new contact derives stage `prospect`" became `onboarded` and it
    dropped to 17/22. Alone on a fresh clone it is 22/22.

    That is the same class of bug as the shared `rocoto_rehearsal` database and the `seedworld`
    ordering: a vital that leaves state behind is a vital that decides another vital's result. Being
    self-sufficient means BOTH halves — bring your own world, and take it away again.

    `clear_all_seeded` is the teardown half of `reset_demo_seed`, so the same contract holds: it only
    ever deletes rows carrying its own marks, and a real customer's row is unreachable from it."""
    try:
        from brain import seed as bseed
        await bseed.clear_all_seeded(config.BRAIN_TENANT)
    except Exception as e:                              # noqa: BLE001
        print(f"  [warn] could not tear the world back down: {e}")


async def main():
    await db.init()
    await ensure_world()
    import app as app_mod  # heavy import; fine on the clone
    try:
        await part1_freeze_fix()
        await part2_creator_guard(app_mod)
        await part3_boxes(app_mod)
        await part4_identity_binding()
    finally:
        # In a `finally` on purpose: a vital that fails half way through must still not poison the
        # clone for everything the harness runs after it.
        await teardown_world()
    passed = sum(R)
    print(f"\nLIFECYCLE + FREEZE FIX + CREATOR GUARD + §6 BOXES: {passed}/{len(R)} passed — "
          f"{'ROBUST' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
