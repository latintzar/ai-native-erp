"""demo_flow.py — /demo: «Prueba Rocoto con tus productos» (SPEC §17.56).

The public front door that REPLACES the open playground: no org, no team, no phone number — one
file, five questions, then chat. A stranger uploads THEIR catalogue, and everything they then see
(SKU matching, prices, off-code handling) is grounded against their own rows. This module is the
whole backend of that flow; app.py's /api/demo/session* routes are only its HTTP shapes.

WHAT IT IS BUILT FROM, and deliberately not a second copy of:

  · THE ISOLATION is try_chat.py's, extended per-visitor. A session is pinned to a scope that
    always starts `test.` and always encodes its own world (tenancy.demo_scope is the ONE writer,
    tenancy.tenant_of the ONE reader), which buys three things through existing kernel behaviour:
    runtime.run_turn tags all writes lineage=test off the `test.` prefix; agent_reply's tool gates
    run with egress_stub=True (the HTTP response IS the delivery, there is no second channel); and
    the scope resolves to THIS session's tenant — NEVER config.BRAIN_TENANT, which would ground a
    stranger's chat against Peter's real catalogue. RLS (db.scoped_tx sets the scope GUC) enforces
    the fence at the database independent of anything above getting it right. The DIFFERENCE from
    try_chat: that widget grounds every visitor against ONE shared fictional world; here each
    session gets its own, seeded from the visitor's own file through the §17.20 intake family,
    because the demo's one job is «tus productos».

  · §17.56c + THE 2026-08-09 SECURITY REMEDIATION — **THERE IS ONE WORLD, AND IT IS AUTHENTICATED**.
        signed in             scope `test.demo.t.<slug>.<sid>`     tenant `<slug>` — their REAL
                              workspace, minted once by provisioning.py and resumed forever after.
    The ANONYMOUS rung (`test.demo.<sid>` → `demo_<sid>`, minted by a public `POST /api/demo/session`)
    IS GONE. Peter's instruction is literal — «should be authed the whole thing yes» — and it deletes
    a finding rather than patching one: that door took an attacker-named address, mailed a WORKING
    bearer token for a session the attacker kept, and let the victim upload their price list into it
    (session fixation, from Rocoto's own DKIM-signed domain, unauthenticated and unrate-limited).
    A `demo_sessions` row may now come into existence ONLY behind a verified identity —
    `session_for_operator`, called from `demo_auth.sign_in`, after Google or the magic link's mailbox
    proof. `tenant_of_row` / `scope_of_row` remain the only sanctioned reads; they still understand
    the anonymous shape because rows and event scopes written before this change are still in the
    database and must resolve honestly for the reaper to reach them — but nothing MINTS one.

  · THE SESSION IS A ROW, NOT A DICT. try_chat keeps a turn counter in-proc and documents that as
    debt; this flow carries five persona answers, an intake id and an email, and losing all of that
    to a process restart mid-demo is losing the prospect. So `demo_sessions` is Postgres, with
    portal.py's token law verbatim:
    `secrets.token_urlsafe(32)` (256 bits, unguessable, no sequential id on any wire), a
    NON-LEAKING resolve that answers None identically for unknown / expired, and a SLIDING expiry
    (last use + DEMO_SESSION_TTL_DAYS) — portal's «the bookmark must keep working» case, not
    intake_api's one-errand fixed clock.

  · THE CATALOGUE ROAD is `brain/onboarding`'s intake family end to end (create → run → get/patch/
    remap → commit → golive.seed_catalogue). No second parser, no second writer; the colmap
    confirmation (§17.56's one new organ) lives in skuparse/onboarding, not here.

  · THE 5 QUESTIONS WIRE REAL KNOBS (§17.55j): doubts/voice/offsku/confirm land on THIS tenant's
    `tenants.behaviour` through behaviour.set_keys — the same key the panel's «Cómo actúa» page
    writes — and tone lands on the `orders:<tenant>` agent_settings row runtime.house_style reads.
    Nothing here is prompt garnish; the demo is the product with blinders, and the wiring points
    (pipeline.classify_doubt / _settle_review, agent_reply's take_order mouth, runtime's VOZ line)
    fire for a paying tenant exactly as they fire here.

  · THE GUARDRAILS are try_chat's four, in try_chat's order and for try_chat's reasons: rate
    limits first (an infra guard against volume — a flood of junk must throttle, not nudge free
    forever), then the turn cap, then the junk gate, all BEFORE the mind is touched — plus one of
    this flow's own: a session whose catalogue is not committed yet gets a deterministic es-ES
    nudge to upload first, never a mind run against an empty world (doubt.py's grounding gate
    would route every line to a comercial who does not exist here).

es-ES is canonical on every visitor-facing string (LOCKED LAW). Code, comments, logs in English.
"""
from __future__ import annotations

import logging
import os
import random
import re
import secrets
import time
from collections import OrderedDict
from typing import Any, Optional

import config
import db
import tenancy

log = logging.getLogger("rocoto.demo_flow")

# ── the 5-question wire vocabulary (§17.56) ───────────────────────────────────────────────────────
# Q1–Q3 + Q5 are `tenants.behaviour` keys (behaviour._SPEC is the validator of record — this map
# only says which demo answers exist and where each one lands). Q4 (tone) is NOT a behaviour key:
# it is the ONE field that already reaches the prompt (agent_settings vibe/house_style →
# runtime.house_style → soul.style_line), so it takes that road instead.
# §17.57 ① — the operator's correction, as an event. Append-only beside `order.drafted`: the
# original reading is never overwritten, because «it was wrong once» is half of what the visitor
# came to see. `_corrections` folds the newest one over the draft wherever an order is drawn.
CORRECTED_EVENT = "order.corrected"

PERSONA_BEHAVIOUR_KEYS = ("doubts", "voice", "offsku", "confirm")
PERSONA_VOCAB: dict[str, tuple[str, ...]] = {
    "doubts": ("ask", "review", "amount"),
    "voice": ("never", "always", "mirror"),
    "offsku": ("open", "review", "reject"),
    "tone": ("formal", "warm", "mirror"),
    "confirm": ("always", "doubt", "never"),
}
# Q4's mapping onto the vibe/house_style pair. `mirror` has no vibe word (soul._VIBE_DESC knows
# formal/warm/brief/playful), so it rides as vibe='custom' + the instruction as free text — the
# exact mechanism a boss typing a house style uses, which is the point: same knob, same road.
_TONE_TO_STYLE: dict[str, dict[str, str]] = {
    "formal": {"vibe": "formal", "house_style": ""},
    "warm": {"vibe": "warm", "house_style": ""},
    "mirror": {"vibe": "custom",
               "house_style": "Espejo: adapta tu registro (tú/usted) al del cliente; "
                              "si escribe seco, sé breve"},
}


_schema_ready = False


async def ensure_demo_schema(con=None) -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    if con is not None:
        await assert_current(con)
        return
    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def _tenant_of_sid(sid: str) -> str:
    """One derivation, said once — must equal tenancy.tenant_of(f'test.demo.{sid}').

    THE ANONYMOUS RUNG IS NO LONGER MINTED (2026-08-09). This survives as a READER for rows written
    before that change: `reap()` has to name the throwaway tenants in order to drop them, and
    `tenant_of_row` has to answer honestly for a legacy row rather than silently returning the
    empty string (which would resolve to BRAIN_TENANT downstream — the exact accident §17.56c's
    two-world note exists to prevent). Nothing calls it on a live path any more."""
    return "demo_" + sid


# `_scope_of_sid` is GONE, deliberately: with two worlds it could only ever spell the anonymous one,
# and a helper that quietly returns the wrong world for half its callers is worse than no helper.
# `scope_of_row` is the only way to a scope from here.


# ── §17.56c · THE ROW DECIDES THE WORLD ──────────────────────────────────────────────────────────
# Before auth there was one shape and one derivation, so `_tenant_of_sid(row["sid"])` at every call
# site was honest. There are now TWO worlds a session can live in — the reapable anonymous
# `demo_<sid>` and the operator's REAL tenant — and the difference is a column on the row, not
# anything a caller can compute from a sid. So every read goes through these two, and no call site
# is allowed to derive a tenant from a sid again: the failure mode of the old habit after this
# change is a signed-in visitor's catalogue quietly landing in a throwaway world (or worse, a chat
# grounded against one) with nothing raised and nothing logged.

def tenant_of_row(row: dict[str, Any]) -> str:
    """The tenant this session's writes belong to. The operator's own when signed in."""
    return (row.get("tenant_slug") or "").strip() or _tenant_of_sid(row["sid"])


async def _is_demo_tenant(slug: str) -> bool:
    """Is this a tenant the demo MINTED, as opposed to a real business a visitor happens to own?

    `tenants.provisioned_via = 'demo'` is the discriminator, and it is the one this codebase already
    trusts for exactly this question — `reap()` calls it «the DOOR, recorded at creation. Never
    inferred», after a fortnight in which a slug PATTERN silently matched zero rows.

    FAIL-CLOSED. An unreadable answer means we do not write to somebody's live agent; the rehearsal
    still works, through the per-turn override. The reverse default would put a database hiccup
    between a supplier and their own settings."""
    slug = (slug or "").strip()
    if not slug:
        return False
    try:
        async with db.get_pool().acquire() as con:
            via = await con.fetchval("select provisioned_via from tenants where slug=$1", slug)
        return (via or "") == "demo"
    except Exception:
        log.debug("demo: provisioned_via read fail-soft for %s — treating as REAL", slug, exc_info=True)
        return False


def scope_of_row(row: dict[str, Any]) -> str:
    """The party scope for this session — `tenancy.demo_scope` is the ONE writer (see its docstring
    for why the owned shape is `test.demo.t.<slug>.<sid>` and not `t.<slug>.wa.<digits>` while
    ROCOTO_SCOPE_PATHED is off). Invariant, asserted in tests/vital_demo_auth.py:
    `tenancy.tenant_of(scope_of_row(r)) == tenant_of_row(r)` for both shapes."""
    return tenancy.demo_scope(row["sid"], (row.get("tenant_slug") or "").strip() or None)


def is_authed(row: dict[str, Any]) -> bool:
    return bool((row.get("operator_email") or "").strip())


# ── mint / resolve ────────────────────────────────────────────────────────────────────────────────

# `create_session` — THE ANONYMOUS PRE-AUTH MINT — WAS DELETED ON 2026-08-09, and its absence is the
# fix, not a regression. What it did: took an attacker-supplied `email` on an unauthenticated,
# unrate-limited public route, minted a `demo_<sid>` tenant plus a session row, and MAILED a working
# bearer token for that session to whatever address was named. The attacker kept the token; the
# recipient clicked, uploaded their price list into the attacker's session (`_demo_owner` returned
# immediately for an anonymous row — no cookie, no CSRF), and the attacker read every parsed line
# back out of `/catalog`, `/seeds` and `/board`. Session fixation, plus an unmetered mail cannon
# from a DKIM-signed production domain, plus a permanent `tenants` row per call.
#
# Deleting the function rather than gating it is deliberate: a door held shut by a flag is a door,
# and the flag that was supposed to hold this one shut (`ROCOTO_SELF_SERVE`) was explicitly not
# consulted here. `session_for_operator` below is now the ONLY mint, and it cannot be reached
# without a verified identity. `_send_magic_link` (the resume mail) and `set_email` (the route that
# re-sent it) went with it — a resume link IS a bearer token in a URL, and §17.56c had already
# retired it as an identity.


async def session_for_operator(email: str, tenant_slug: str) -> dict[str, Any]:
    """THE ONLY DOOR THAT MINTS A FLOW SESSION. Resume the operator's, or mint a fresh one.
    Returns {token, sid, authed, catalog_reset}.

    Reached only from `demo_auth.sign_in`, i.e. only after Google or the magic link's mailbox proof
    has produced a verified address and `provisioning.resume_or_provision` has produced the tenant
    it belongs to. There is no anonymous predecessor to adopt any more (see the note above), so the
    adoption branch — and the `catalog_reset` migration it needed — is gone; `catalog_reset` stays
    on the wire as a constant `False` so the SPA's existing read does not have to change shape.

    NEVER TWO SESSIONS FOR ONE OPERATOR: the row (live OR expired) wins and is revived, so returning
    to /demo picks up where they were instead of stacking abandoned worlds.

    ── 2026-08-11, PEDIDOS-PRICING-BUILD.md §6 · THE MESSAGE COUNT FOLLOWS THE EMAIL ─────────────
    Two things changed here so that is actually true, not merely asserted:

      ① THE RESUME LOOKUP NO LONGER FILTERS ON `expires_at`. It used to — `and (expires_at is null
         or expires_at > now())` — which meant a session left idle past DEMO_SESSION_TTL_DAYS (14,
         sliding) simply stopped being found: the next sign-in fell through to the mint branch below
         and came back with a brand-new row, `turns=0`, `closed=false`. The cap on this surface is
         30 messages FOR LIFE, not 30 messages per fortnight — a visitor only has to let the tab sit
         unused for two weeks to buy another 30. The fix is the obvious one: find the row whatever
         its clock says (`order by last_seen desc limit 1`, no expiry clause), and if it is past its
         expiry, REVIVE it rather than orphan it — same `token`/`sid`/`turns`/`closed` the operator
         already had, sliding `expires_at` forward exactly as `resolve()`'s own `touch` does on every
         ordinary use. A session that still holds a real prospect's catalogue never has to become a
         second one.

      ② THE LOOKUP-THEN-INSERT IS SERIALISED PER EMAIL, with a transaction-scoped Postgres advisory
         lock (`pg_advisory_xact_lock(hashtext(email))`), because a SELECT-then-INSERT with no lock
         is a race the loophole this section exists to close would happily walk through: two
         concurrent sign-ins for the same address (two tabs, a doubled webhook, a retried POST) can
         both miss the SELECT and both reach the INSERT, minting two `demo_sessions` rows for one
         operator — two tokens, two independent `turns` counters, 60 messages instead of 30. The
         lock makes the second racer wait for the first to COMMIT its insert, so its own SELECT (run
         again, inside the lock) finds the row the first one just made and resumes it instead of
         minting a second. `hashtext` is a plain int4 hash — collisions between two DIFFERENT emails
         only cost a moment of serialised waiting, never correctness, because the SELECT inside the
         lock still keys on the real address. No schema change, on purpose: a `create unique index`
         run through this file's own auto-DDL (`ensure_demo_schema`) would ABORT THE WHOLE STATEMENT
         BATCH the moment it met even one pre-existing duplicate pair on a live box — and every
         other `/demo` route calls `ensure_demo_schema` first, so a failed migration would take the
         entire surface down rather than one operator's second tab."""
    await ensure_demo_schema()
    e = (email or "").strip().lower()
    slug = (tenant_slug or "").strip()
    if not e or not slug:
        # fail closed: a session with no operator or no tenant is precisely the anonymous row this
        # change exists to make unmintable.
        raise ValueError("session_for_operator: an authed session needs both an email and a tenant")
    async with db.get_pool().acquire() as con, con.transaction():
        # ② the lock — held for this transaction only, released the moment it commits or rolls
        # back. Every caller for THIS email, concurrent or not, passes through here one at a
        # time; callers for a DIFFERENT email are unaffected (bar the vanishingly rare hash
        # collision, which only serialises them too — see the note above).
        await con.execute("select pg_advisory_xact_lock(hashtext($1))", e)
        mine = await con.fetchrow(
            "select * from demo_sessions where lower(operator_email) = $1 "
            "order by last_seen desc limit 1", e)
        if mine is not None:
            if (mine["tenant_slug"] or "") != slug:
                # the operator's tenant changed under the session (a rename of the workspace
                # they own) — repoint, loudly.
                log.warning("demo session %s repointed %r → %r", mine["sid"],
                            mine["tenant_slug"], slug)
                await con.execute("update demo_sessions set tenant_slug=$2 where token=$1",
                                  mine["token"], slug)
                # the QR/phone credentials were signed against the OLD world. §17.56's phone
                # token is narrow in VERBS but not in WHOSE WORLD it reaches, so a link minted
                # before the repoint must not survive it (2026-08-09 review, F6).
                await _revoke_phone_links(mine["sid"])
            # ① REVIVE, don't merely read — an operator back from beyond the old TTL must not
            # be handed a session one `resolve()` away from vanishing under them again.
            await con.execute(
                "update demo_sessions set last_seen=now(), "
                "expires_at = now() + ($2 || ' days')::interval where token=$1",
                mine["token"], str(config.DEMO_SESSION_TTL_DAYS))
            return {"token": mine["token"], "sid": mine["sid"], "authed": True,
                    "catalog_reset": False}

        sid = secrets.token_hex(12)
        token = secrets.token_urlsafe(32)
        await con.execute(
            "insert into demo_sessions(token,sid,email,operator_email,tenant_slug,expires_at) "
            "values($1,$2,$3,$3,$4, now() + ($5 || ' days')::interval)",
            token, sid, e, slug, str(config.DEMO_SESSION_TTL_DAYS))
    log.info("demo session minted for operator %s tenant=%s sid=%s", e, slug, sid)
    return {"token": token, "sid": sid, "authed": True, "catalog_reset": False}


async def resolve(token: str, *, touch: bool = True) -> Optional[dict[str, Any]]:
    """token → the session row, or ONE None for unknown / expired alike (portal.py's non-leaking
    law: a probe must not learn that a session ever existed). `touch` slides both `last_seen` and
    the expiry — a session in use keeps its link alive; one abandoned for DEMO_SESSION_TTL_DAYS
    dies where it stands."""
    tok = (token or "").strip()
    if not tok or len(tok) > 200:
        return None
    await ensure_demo_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select * from demo_sessions where token=$1 "
            "and (expires_at is null or expires_at > now())", tok)
        if row is None:
            return None
        if touch:
            await con.execute(
                "update demo_sessions set last_seen=now(), "
                "expires_at = now() + ($2 || ' days')::interval where token=$1",
                tok, str(config.DEMO_SESSION_TTL_DAYS))
    return dict(row)


# ── email ─────────────────────────────────────────────────────────────────────────────────────────
# `set_email` and `_send_magic_link` — the ANONYMOUS RESUME MAIL — were deleted on 2026-08-09 with
# the anonymous session they served. The link they mailed (`/demo/chat?s=<token>`) was a bearer
# credential in a URL: whoever held it held the session, so an attacker could name somebody else's
# address, keep the token, and read back whatever that person then uploaded. demo_auth.py's magic
# link is the only mail that signs anybody in now, and it is single-use, 15-minute, requester-bound
# and mints the panel's own cookie rather than handing out a token.

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def _clean_email(email: Optional[str]) -> str:
    e = (email or "").strip().lower()[:200]
    return e if _EMAIL_RE.match(e) else ""


async def _revoke_phone_links(sid: str) -> None:
    """Kill every outstanding QR/phone credential for a session. Lazy import + fail-soft because
    demo_phone imports this module; a revocation that fails must never cost the sign-in it hangs
    off, and the phone link expires on its own clock regardless."""
    try:
        import demo_phone as _dp
        await _dp.revoke(sid)
    except Exception:
        log.debug("demo_flow: phone-link revoke fail-soft for %s", sid, exc_info=True)


# ── persona (the 5 questions) ─────────────────────────────────────────────────────────────────────

async def persona_set(token: str, changes: dict[str, Any]) -> dict[str, Any]:
    """Apply persona answers to the REAL knobs, then record them on the session for the UI.

    Validated against PERSONA_VOCAB loudly (a silently ignored answer is a visitor who believes
    they changed something they did not — behaviour.set_keys' own law). Behaviour keys go through
    behaviour.set_keys on THIS session's tenant only; tone goes to the `orders:<tenant>`
    agent_settings row in exactly app._merge_and_save_dispatch's shape (vibe ≤24 chars,
    house_style ≤800) so runtime.house_style reads it with no translation. The runtime's
    per-tenant style cache is dropped so a tone change reaches the NEXT message, not the next
    minute — §17.56's four-quadrant law («a change applies to the next message, no reload»)."""
    row = await resolve(token)
    if row is None:
        return {"ok": False, "error": "unknown_session"}
    clean: dict[str, str] = {}
    for k, v in (changes or {}).items():
        if k not in PERSONA_VOCAB:
            return {"ok": False, "error": "unknown_key", "key": str(k)[:40]}
        v = str(v or "").strip().lower()
        if v not in PERSONA_VOCAB[k]:
            return {"ok": False, "error": "bad_value", "key": k, "value": v[:40]}
        clean[k] = v
    if not clean:
        return {"ok": False, "error": "no_changes"}

    tenant = tenant_of_row(row)
    # A REHEARSAL MAY NEVER RECONFIGURE A REAL BUSINESS (2026-08-16).
    # `tenant_of_row` is the OPERATOR'S OWN workspace once they are signed in, and these two writes
    # went straight at it: a paying supplier who opened /demo and clicked through the five questions
    # changed the behaviour and the tone of the agent answering their actual customers, silently. It
    # ran backwards too — «solo pedidos» set on /actua made the demo look broken, because `scope` is
    # honoured on the demo path.
    #
    # The write-through survives for a tenant that IS a demo world, because there it is the whole
    # point and the anonymous path depends on it. `provisioned_via='demo'` is the discriminator this
    # codebase already trusts — «the DOOR, recorded at creation. Never inferred» (reap's own words).
    # For anyone else the answers live on `demo_sessions.persona` (they always did) and are applied
    # per-turn through `behaviour.set_override`, so the rehearsal behaves correctly and the business
    # is untouched.
    writable = await _is_demo_tenant(tenant)
    bkeys = {k: v for k, v in clean.items() if k in PERSONA_BEHAVIOUR_KEYS}
    if bkeys and writable:
        import behaviour
        await behaviour.set_keys(tenant, **bkeys)
    if "tone" in clean and writable:
        style = dict(_TONE_TO_STYLE[clean["tone"]])
        style["vibe"] = style["vibe"][:24]
        style["house_style"] = style["house_style"][:800]
        await db.settings_set(f"orders:{tenant}", style)
        try:
            import runtime
            runtime._style_cache_by_tenant.pop(tenant, None)
        except Exception:
            log.debug("style cache drop fail-soft", exc_info=True)
    elif "tone" in clean:
        log.info("demo: tone kept on the session for %s — real tenant, no write-through", tenant)

    persona = {**dict(row.get("persona") or {}), **clean}
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set persona=$2 where token=$1", token, persona)
    return {"ok": True, "persona": persona}


# ── session view (for GET /session/{token}) ──────────────────────────────────────────────────────

async def workspace_ready(row: dict[str, Any]) -> bool:
    """«Does this company have a catalogue?» — THE one derivation, for every gate that asks.

    The 2026-08-17 finding (Carlos waiting): `demo_sessions.catalog_ready` is keyed by TOKEN, so a
    returning operator whose 308 SKUs sat in `catalogue_skus` the whole time was told to upload
    again. That was fixed IN session_view AND NOWHERE ELSE — so until 2026-08-19 the UI showed a
    ready catalogue while the chat gate, reading the raw column, refused every order with «primero
    sube tu lista». The user saw both at once: a green catalogue and a mouth that stonewalled.
    That is Raquel's «las órdenes no estaban apareciendo», reproduced end to end on prod.

    A split derivation of one fact is how this happens; this function is the merge. The session
    flag only ever ADDS to the truth: an authed operator whose workspace holds SKUs is ready,
    full stop."""
    if row.get("catalog_ready"):
        return True
    if is_authed(row) and (row.get("tenant_slug") or ""):
        try:
            async with db.get_pool().acquire() as con:
                return bool(await con.fetchval(
                    "select exists(select 1 from catalogue_skus where tenant_id=$1)",
                    row["tenant_slug"]))
        except Exception:
            log.debug("workspace_ready probe fail-soft", exc_info=True)
    return False


async def session_view(token: str) -> Optional[dict[str, Any]]:
    """Everything the SPA needs to resume: email, persona, the catalogue's state, turns left, and
    (§17.56c) whether this session is anonymous or belongs to a signed-in operator. `tenant_slug` is
    echoed for the AUTHED case only — an anonymous session's throwaway world is an implementation
    detail nobody outside this module should be able to name.

    `turns_used` / `max_turns` (2026-08-11, §6 — the demo meter) ride alongside `turns_left` so the
    RING can draw its arc on the very first paint, before a single message has been sent: `applyTurn`
    only updates from a chat reply's own `turns_used`, and this is where that number comes from
    before there has been a reply to read it off. `max_turns` is `config.DEMO_MAX_TURNS` rather than
    a client-side literal — the SPA has no other honest way to know the cap without hard-coding a
    number that can drift from the box's own `.env`."""
    row = await resolve(token)
    if row is None:
        return None
    catalog = None
    if row.get("intake_id"):
        try:
            from brain import onboarding as _ob
            it = await _ob.get_intake(row["intake_id"], tenant_of_row(row), with_diff=False)
            if it:
                catalog = {"id": it["id"], "state": it["state"], "count": it["count"]}
        except Exception:
            log.debug("demo session catalog read fail-soft", exc_info=True)
    # ⚠️ READINESS IS A FACT ABOUT THE WORKSPACE, NOT ABOUT THIS BROWSER SESSION.
    #
    # Found 2026-08-17 with Carlos waiting: `demo_sessions.catalog_ready` is keyed by TOKEN, so a
    # returning operator got `false` and was sent to upload his price list again — while the 308
    # SKUs he had already loaded sat in `catalogue_skus` under his tenant the whole time. The
    # column answers «did THIS session finish an upload», and the question the app actually asks
    # is «does this company have a catalogue». Those came apart the moment /demo stopped being an
    # anonymous scratch world and started resuming a real tenant (§17.56c).
    #
    # So the session flag now only ever ADDS to the truth: an authed operator whose workspace holds
    # SKUs is ready, full stop. A first-time visitor is unaffected — no tenant, no rows, no change
    # — and `note_intake` still re-arms mid-upload, because a fresh intake that has not committed
    # leaves the previous SKUs in place and the operator is genuinely still ready to work.
    ready = await workspace_ready(row)

    turns = int(row.get("turns") or 0)
    return {"ok": True, "email": row.get("email") or "",
            "authed": is_authed(row),
            "tenant_slug": (row.get("tenant_slug") or "") if is_authed(row) else "",
            "persona": dict(row.get("persona") or {}),
            "catalog": catalog, "catalog_ready": ready,
            "turns_left": max(0, config.DEMO_MAX_TURNS - turns),
            "turns_used": turns, "max_turns": int(config.DEMO_MAX_TURNS),
            "closed": bool(row.get("closed"))}


async def note_intake(token: str, intake_id: str) -> None:
    """The session's reach grows the moment an upload lands (intake_api's ordering law: reach
    FIRST, then the parse starts — the other order loses the intake to a restart mid-parse). A
    fresh upload also re-arms the flow: the catalogue is only `ready` again after ITS commit."""
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update demo_sessions set intake_id=$2, catalog_ready=false where token=$1",
            token, intake_id)


async def set_catalog_ready(token: str) -> None:
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set catalog_ready=true where token=$1", token)


# ── chat ──────────────────────────────────────────────────────────────────────────────────────────

_CLOSE = ("Hasta aquí llega la prueba — si quieres seguir con tus productos de verdad, "
          "escríbenos y lo montamos contigo.")
_NUDGE = ("Prueba a pedirme algo como lo haría uno de tus clientes — p. ej. "
          "«ponme 6 cajas de lo de siempre y 3 kg de lomo para el viernes».")
_NEEDS_CATALOG = ("Sube tu lista de artículos en «Catálogo» y te cuadro cada pedido con tus "
                  "productos y tus precios.")
# §6 · THE SOFT PROMPT, at turn 15 of the 30-message cap — Peter's own line, VERBATIM
# (PEDIDOS-PRICING-BUILD.md §6, §0's copy law). `turns` only ever counts up, so `== _SOFT_PROMPT_TURN`
# fires on exactly the message that crosses the line, once, never on every one after it.
_SOFT_PROMPT_TURN = 15
_SOFT_PROMPT = "¿Quieres seguir probando con tus pedidos de verdad?"


async def _stub_call(phone: str, lang: str = "es", name: str = "") -> dict:
    """Never dials a real number — try_chat's sandbox stub, same shape."""
    return {"token": "test", "sid": "TEST-STUB", "status": "would_call"}


def _fake_phone(sid: str) -> str:
    """try_chat's convention: a syntactically valid, permanently unroutable address for the party.
    A hex sid keeps only its digits — padded so two sessions can still never collide on it (they
    cannot anyway: the scope, not the phone, is the identity; run_turn gets scope_override)."""
    return "+000" + re.sub(r"[^0-9]", "", sid)[:11].ljust(11, "0")


# ── the ABSOLUTE spend ceiling (2026-08-09 review, F11) ──────────────────────────────────────────
# Every paid path on this surface was fenced by a per-IP and a per-SESSION bucket and by nothing
# else. Neither is a ceiling: sessions were free to mint (that door is now gone) and an IP is one
# header away from being somebody else's. The codebase already states the pattern for «many distinct
# clients can still drive unbounded spend» — `DEMO_DAILY_CAP` on the phone demo, `ROCOTO_REPLY_DAILY_CAP`
# on the WhatsApp rail — and this surface simply did not have it. This is that counter, shaped like
# `voice_reply._daily_cap_exceeded`: a rolling 24h window over SUCCESSFUL spends, checked before the
# money is spent, fail-soft (a bug in the meter must never silence the product).
#
# HONEST LIMIT: it is in-process, so a restart resets the day's budget, exactly as voice_reply's
# does. That is correct for one uvicorn worker and wrong the day a second one appears — the same
# caveat `sup_session._RL` carries, written down rather than discovered.
_SPENT_AT: dict[str, list[float]] = {}
_SPEND_DAY_S = 24 * 3600


def spend_ok(kind: str) -> bool:
    """True iff the 24h ceiling for `kind` (llm | media) has room. Checked BEFORE the paid call."""
    try:
        cap = int(getattr(config, "DEMO_SPEND_DAILY_CAP", 0) or 0)
        if cap <= 0:
            return True
        now = time.monotonic()
        hits = [t for t in _SPENT_AT.get(kind, ()) if now - t < _SPEND_DAY_S]
        _SPENT_AT[kind] = hits
        if len(hits) >= cap:
            log.warning("demo: 24h spend ceiling reached for %s (%d/%d) — refusing", kind,
                        len(hits), cap)
            return False
        return True
    except Exception:
        return True


def spend_record(kind: str) -> None:
    """Record one paid call against the ceiling. Called immediately AFTER the spend, so a refusal
    upstream never consumes budget (voice_reply's `_record_reply_sent` ordering)."""
    try:
        now = time.monotonic()
        hits = [t for t in _SPENT_AT.get(kind, ()) if now - t < _SPEND_DAY_S]
        hits.append(now)
        _SPENT_AT[kind] = hits
    except Exception:
        pass


_SPEND_FULL = ("La prueba ha llegado a su tope de hoy. Escríbenos y te la abrimos ahora mismo: "
               "hello@soyrocoto.com.")


async def chat(*, token: str, text: str, ip: str, lang: str = "es") -> dict[str, Any]:
    """One TYPED turn. Never raises — every failure mode is a JSON-safe dict with `ok` set, so the
    route can always answer (rate-limit maps to 429 there; an unknown token to the one 404 sentence).

    A thin door onto `_turn`, which is also what a voice note and a photo come through (demo_media):
    the whole point of item 5 of §17.56's build order is that a spoken order and a photographed one
    produce the SAME order, the SAME «Para revisar» tail and the SAME board as typing it would — and
    the only way that is true rather than asserted is that there is one turn function, not three."""
    row = await resolve(token)
    if row is None:
        return {"ok": False, "error": "unknown_session"}
    return await _turn(row=row, text=text, ip=ip, lang=lang, has_media=False, source="demo_flow")


async def turn_from_media(*, row: dict[str, Any], text: str, ip: str,
                          kind: str, lang: str = "es") -> dict[str, Any]:
    """A voice note's transcript or a photo's read text, run as the ordinary turn (§17.56 item 5).

    `row` rather than a token because the media routes have already resolved (and touched) the
    session through the same gate every other /demo route uses — re-resolving here would slide the
    expiry twice and, worse, would invite a second resolve path with a second set of rules.

    `has_media=True` reaches junkgate exactly as the WhatsApp rail's own combine does
    (brain/pipeline._combine → junkgate.is_junk(text, has_media)): a short utterance that would be a
    pleasantry when typed («vale, eso») is NOT junk when someone bothered to record it. The EMPTY
    case is caught upstream in demo_media, which never calls this with nothing — silence and an
    unreadable photo get their own honest sentence rather than a mind run on ''."""
    return await _turn(row=row, text=text, ip=ip, lang=lang, has_media=True,
                       source=f"demo_{'voz' if kind == 'voz' else 'foto'}")


async def _turn(*, row: dict[str, Any], text: str, ip: str, lang: str = "es",
                has_media: bool = False, source: str = "demo_flow") -> dict[str, Any]:
    """THE one turn, whatever carried it in.

    Guardrail order is try_chat.chat's, verbatim and for its reasons (see that module's docstring):
    ① rate limits (volume, before content) ② turn cap (before the mind) ③ junk gate (before the
    mind) — plus this flow's own ④ catalogue gate: no committed catalogue → a deterministic nudge,
    because a mind run against an empty world can only produce the ungrounded-tenant apology."""
    text = (text or "").strip()[:1000]
    token = row["token"]
    sid = row["sid"]
    turns = int(row.get("turns") or 0)
    turns_left = max(0, config.DEMO_MAX_TURNS - turns)

    # ① rate limits — try_chat's sliding-window helper SHARED (one _HITS store, one shape), with
    # demo-prefixed keys so the two surfaces throttle independently.
    #
    # THE EMAIL BUCKET (2026-08-11, §6) SITS BESIDE THE SESSION ONE, not in place of it. `demosess`
    # throttles ONE token; every session since 2026-08-09 belongs to exactly one signed-in operator
    # (`session_for_operator` never mints two live rows for the same address — see its own note), so
    # in the steady state the two buckets see the same traffic. What the email bucket catches that
    # the session one cannot: a legacy row from before that fix, or the narrow race the advisory lock
    # in `session_for_operator` closes for NEW rows but cannot retroactively close for old ones —
    # either way, two tokens hammering the same address share ONE ceiling here. No new config knob:
    # `DEMO_EMAIL_LIMIT`/`_WINDOW_S` fall back to the IP ones (`getattr`, `spend_ok`'s own pattern in
    # this file) so this ships without touching config.py, and a deployment that DOES define them
    # later picks them up with no code change here.
    import try_chat as _tc
    email = (row.get("operator_email") or "").strip().lower()
    if not _tc._rate_ok(f"demoip:{ip}", limit=config.DEMO_IP_LIMIT,
                        window_s=config.DEMO_IP_WINDOW_S) or \
       not _tc._rate_ok(f"demosess:{sid}", limit=config.DEMO_SESSION_LIMIT,
                        window_s=config.DEMO_SESSION_WINDOW_S) or \
       (email and not _tc._rate_ok(
           f"demoemail:{email}",
           limit=int(getattr(config, "DEMO_EMAIL_LIMIT", 0) or config.DEMO_IP_LIMIT),
           window_s=float(getattr(config, "DEMO_EMAIL_WINDOW_S", 0) or config.DEMO_IP_WINDOW_S))):
        return {"ok": False, "error": "rate_limited", "reply": "", "order": None,
                "unmatched": [], "turns_used": turns, "turns_left": turns_left,
                "closed": bool(row.get("closed"))}

    # ② turn cap — before the mind is ever touched.
    if row.get("closed") or turns_left <= 0:
        async with db.get_pool().acquire() as con:
            await con.execute("update demo_sessions set closed=true where token=$1", token)
        return {"ok": True, "reply": _CLOSE, "order": None, "unmatched": [],
                "turns_used": turns, "turns_left": 0, "closed": True}

    # ③ junk gate — free, deterministic, never burns a turn.
    from brain import junkgate
    junk, _reason = junkgate.is_junk(text, has_media=has_media)
    if junk:
        return {"ok": True, "reply": _NUDGE, "order": None, "unmatched": [],
                "turns_used": turns, "turns_left": turns_left, "closed": False}

    # ④ the catalogue gate — this flow's own. It asks THE question (workspace_ready), not the raw
    # per-token column: reading the column here while session_view answered the real question is
    # exactly how the UI showed a green catalogue while every order was refused.
    if not await workspace_ready(row):
        return {"ok": True, "reply": _NEEDS_CATALOG, "order": None, "unmatched": [],
                "turns_used": turns, "turns_left": turns_left, "closed": False,
                "needs_catalog": True}

    # ⑤ THE ABSOLUTE CEILING (F11). Last gate before the mind, because it is the only one that
    # cannot be argued around by minting a new session or changing an IP.
    if not spend_ok("llm"):
        return {"ok": False, "error": "rate_limited", "reply": _SPEND_FULL, "order": None,
                "unmatched": [], "turns_used": turns, "turns_left": turns_left,
                "closed": bool(row.get("closed"))}

    scope = scope_of_row(row)
    tenant = tenant_of_row(row)
    try:
        async with db.scoped_tx(scope) as con:
            await con.execute(
                "insert into scope_node(scope,tier,tenant_slug,lineage) values($1::ltree,'customer',$2,'test') "
                "on conflict (scope) do nothing", scope, tenant)
            await con.execute(
                "insert into card(scope,body,version,lineage) values($1::ltree,'',0,'test') "
                "on conflict (scope) do nothing", scope)
    except Exception:
        log.exception("demo_flow: scope bootstrap failed for %s", scope)

    # THE SESSION'S OWN ANSWERS, FOR THIS TURN ONLY (2026-08-16). `demo_sessions.persona` is the
    # durable record of the five questions and it always has been; what changed is that it no longer
    # needs to be written into somebody's live tenant to take effect. Set on every turn — including
    # the demo-provisioned case, where the write-through also happened — so the demo path has ONE
    # way of answering «what did this visitor choose», not two that can disagree.
    import behaviour as _behaviour
    import runtime
    _btok = _behaviour.set_override({k: v for k, v in (row.get("persona") or {}).items()
                                     if k in PERSONA_BEHAVIOUR_KEYS})
    spend_record("llm")            # the spend is committed the moment the mind is entered
    try:
        out = await runtime.run_turn(
            _fake_phone(sid), text, place_call_fn=_stub_call, scope_override=scope,
            egress_stub=True, source=source)
    except Exception:
        log.exception("demo_flow: run_turn failed for scope %s", scope)
        return {"ok": False, "error": "runtime_error", "reply": "", "order": None,
                "unmatched": [], "turns_used": turns, "turns_left": turns_left, "closed": False}
    finally:
        _behaviour.reset_override(_btok)

    turns += 1
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set turns=$2 where token=$1", token, turns)
    reply = (out.get("text") or out.get("force_text") or "").strip()

    order = None
    unmatched: list[dict[str, Any]] = []
    if any(a.get("take_order") for a in (out.get("actions") or [])):
        drafted = await _fetch_drafted(scope, tenant)
        if drafted:
            order = drafted["order"]
            unmatched = drafted["unmatched"]
        if not reply:
            reply = "Recibido — déjame confirmarlo y te digo enseguida."

    turns_left = max(0, config.DEMO_MAX_TURNS - turns)
    closed = turns_left <= 0
    # §6 — the soft prompt, appended the one turn it applies to. Ahead of the `closed` block so the
    # two can never both fire on the same reply (30 > 15, they never coincide in practice either).
    if turns == _SOFT_PROMPT_TURN:
        reply = (reply + "\n\n" + _SOFT_PROMPT).strip()
    if closed:
        async with db.get_pool().acquire() as con:
            await con.execute("update demo_sessions set closed=true where token=$1", token)
        reply = (reply + "\n\n" + _CLOSE).strip()

    return {"ok": True, "reply": reply, "order": order, "unmatched": unmatched,
            "turns_used": turns, "turns_left": turns_left, "closed": closed}


def _payload(raw: Any) -> dict[str, Any]:
    """An `event.payload` as a dict, whichever way the driver handed it over."""
    if isinstance(raw, str):
        import json as _json
        try:
            return _json.loads(raw or "{}")
        except Exception:
            return {}
    return dict(raw or {})


async def _corrections(con, scope: str, limit: int = 40) -> dict[str, dict[str, Any]]:
    """ref → the NEWEST correction of that drafted order (§17.57 ①).

    A correction is an `order.corrected` event carrying the whole corrected sheet plus the `ref` of
    the `order.drafted` row it supersedes. Append-only, like everything else on the spine: the
    original stays exactly as the mind read it — which is the half of the demo that proves the
    machine was wrong once — and the board folds the newest correction over it when it draws.
    Newest first, so the first sighting of a ref is the one that wins."""
    out: dict[str, dict[str, Any]] = {}
    rows = await con.fetch(
        "select payload from event where scope=$1::ltree and type=$2 "
        "order by id desc limit $3", scope, CORRECTED_EVENT, limit)
    for r in rows:
        p = _payload(r["payload"])
        ref = str(p.get("ref") or "")
        if ref and ref not in out:
            out[ref] = p
    return out


async def _fetch_drafted(scope: str, tenant: str) -> Optional[dict[str, Any]]:
    """The latest order.drafted event, WITH its unmatched tail — try_chat._fetch_drafted_order
    drops `unmatched` because its widget has nowhere to put it; here «Para revisar» is half the
    screen, so the held-not-guessed lines are the payload, not noise. Each unmatched line is
    enriched with the doubt faculty's `kind` when the matcher can answer cheaply (one match run
    per line, bounded upstream by the mind's own extraction), fail-soft to the bare reason."""
    try:
        async with db.scoped_tx(scope) as con:
            row = await con.fetchrow(
                "select id, payload from event where scope=$1::ltree and type='order.drafted' "
                "order by id desc limit 1", scope)
            fixes = await _corrections(con, scope) if row else {}
        if not row or not row["payload"]:
            return None
        p = fixes.get(str(row["id"])) or row["payload"]
        if isinstance(p, str):
            import json as _json
            p = _json.loads(p)
        lines = [l for l in (p.get("lines") or []) if l.get("name")]
        unmatched = [u for u in (p.get("unmatched") or []) if u.get("mention")]
        if not lines and not unmatched:
            return None
        # `ref` = this event's own id, and it is the handle the ORDER-CARD IMAGE is fetched by
        # (`order_card_png`). Without it the customer view could only ask for «the latest» order,
        # and a session that drafted two would show the second one's picture in the first one's
        # message. It names an event on THIS session's scope, so it is not a capability: the door
        # re-reads it under the same scope before rendering anything.
        order = ({"ref": str(row["id"]), "lines": lines, "total": p.get("total"),
                  "currency": p.get("currency") or "eur"} if lines else None)
        return {"order": order,
                "unmatched": await _enrich_unmatched(scope, tenant, unmatched)}
    except Exception:
        log.exception("demo_flow: drafted fetch failed for %s", scope)
        return None


async def _enrich_unmatched(scope: str, tenant: str,
                            unmatched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """unmatched + {kind, candidates} — the NeedsYouCard grammar's inputs. The kind comes from
    doubt.classify_line over the matcher's OWN output (the same read pipeline/build_options do),
    the candidates from the same run. Everything fail-soft: the bare {mention,qty,unit,reason}
    line is already honest, enrichment only sharpens it."""
    out: list[dict[str, Any]] = []
    if not unmatched:
        return out
    try:
        import doubt as doubt_mod
        from brain import matcher
    except Exception:
        return [dict(u) for u in unmatched]
    for u in unmatched[:6]:                      # bound the (embed+rerank) spend per fetch
        enriched = dict(u)
        try:
            res = await matcher.match(str(u.get("mention") or ""), tenant=tenant,
                                      unit_hint=(u.get("unit") or None),
                                      qty=(u.get("qty") or None))
            d = doubt_mod.classify_line({"mention": u.get("mention"), "qty": u.get("qty"),
                                         "unit": u.get("unit"), "match": res.as_dict()})
            if d.get("kind"):
                enriched["kind"] = d["kind"]
            # THE CANDIDATES ARE ONLY THE CUSTOMER'S TO SEE WHEN THE FACULTY SAYS SO (2026-08-16).
            # `doubt.classify_line` returns `ask` (is a question worth asking at all) and `direction`
            # (who can even answer it) beside the candidates, and this copied the list ignoring both.
            # For an UNKNOWN line the faculty returns {kind: UNKNOWN, direction: COMERCIAL,
            # ask: False, candidates: […]} — a shortlist meant for the person who owns the catalogue
            # — and the client turned any two names into tappable buttons for the CUSTOMER. On
            # 2026-08-13 a real prospect was shown exactly that and tapped the escape hatch
            # («Ninguno, te digo»), which is how we know. §5.7a is explicit that the direction is the
            # load-bearing half: getting it wrong is what turns this product back into a guess.
            #
            # `ask`/`direction` also go ON THE WIRE now, so the surface can render the comercial's
            # shortlist as what it is — a review aid — instead of inferring intent from a list length.
            enriched["ask"] = bool(d.get("ask"))
            enriched["direction"] = str(d.get("direction") or "")
            # Compared against the faculty's OWN constant, never a literal — the direction vocabulary
            # lives in doubt.py and a copy here is the drift BUILD-CONCERNS #25 is about.
            customer_may_choose = bool(d.get("ask")) and d.get("direction") == doubt_mod.CUSTOMER
            enriched["candidates"] = [
                {"sku_id": c.get("sku_id") or c.get("id") or "",
                 "name": str(c.get("name") or "").strip()}
                for c in (d.get("candidates") or [])[:2] if str(c.get("name") or "").strip()
            ] if customer_may_choose else []
        except Exception:
            log.debug("demo_flow: unmatched enrich fail-soft for %r", u.get("mention"),
                      exc_info=True)
        out.append(enriched)
    out.extend(dict(u) for u in unmatched[6:])
    return out


# ── the board (left half of the four-quadrant screen) ────────────────────────────────────────────

async def board(token: str) -> Optional[dict[str, Any]]:
    """«Pedidos» + «Para revisar» in one read: every order.drafted on this session's scope (newest
    first, capped — a demo that drafted 20 orders has made its point) and the DEDUPED unmatched
    tail across all of them. Dedupe by folded mention: the same off-list word asked three ways is
    ONE review item, or the pane becomes the nagging §5.7a forbids in chat."""
    row = await resolve(token)
    if row is None:
        return None
    scope = scope_of_row(row)
    tenant = tenant_of_row(row)
    orders: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    seen: set[str] = set()
    try:
        async with db.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select id, payload, ts from event where scope=$1::ltree and type='order.drafted' "
                "order by id desc limit 20", scope)
            fixes = await _corrections(con, scope)
        for r in rows:
            # the correction wins where there is one; the drafted row is still the thing it names
            p = fixes.get(str(r["id"])) or r["payload"]
            if isinstance(p, str):
                import json as _json
                try:
                    p = _json.loads(p)
                except Exception:
                    continue
            lines = [l for l in (p.get("lines") or []) if l.get("name")]
            if lines:
                orders.append({"ref": str(r["id"]), "lines": lines, "total": p.get("total"),
                               "currency": p.get("currency") or "eur",
                               "at": r["ts"].isoformat() if r["ts"] else None})
            for u in (p.get("unmatched") or []):
                key = " ".join(str(u.get("mention") or "").lower().split())
                if not key or key in seen:
                    continue
                seen.add(key)
                pending.append(u)
    except Exception:
        log.exception("demo_flow: board read failed for %s", scope)
    review = await _enrich_unmatched(scope, tenant, pending)
    return {"ok": True, "orders": orders, "review": review}


# ── §17.57 · THE LEARNING LOOP: the catalogue, the correction, the profile, the reset ────────────
#
# Peter's frame for the whole section: «it's not a demo really cos it's real. it's just limited to
# what it is.» Everything below is therefore the product's own machinery pointed at this session's
# world — the operator-edit learner the panel calls, the alias row the matcher reads, the ficha the
# panel draws. Nothing here invents a demo-only memory, and nothing here leaves a dead end.

async def skus(token: str, limit: int = 400) -> Optional[dict[str, Any]]:
    """This session's own price list, for the line editor's picker (§17.57 ①).

    The SAME columns and the SAME order `GET /api/sup/catalogue` serves — the picker on the desk and
    the picker in the app are looking at one table. Capped because the picker is a list a human
    reads and a distributor's tarifa can run to thousands of rows; the box that answers this also
    answers paying customers' webhooks."""
    row = await resolve(token)
    if row is None:
        return None
    tenant = tenant_of_row(row)
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, code, name, base_unit, price from catalogue_skus "
            "where tenant_id = $1 and in_assortment order by family, name limit $2", tenant, limit)
    return {"ok": True, "skus": [{
        "id": r["id"], "code": r["code"] or "", "name": r["name"],
        "base_unit": r["base_unit"] or "",
        "price": float(r["price"]) if r["price"] is not None else None,
    } for r in rows]}


async def _party_phone(scope: str) -> Optional[str]:
    """The address this session's orders are grounded FOR — `orders_tool._scope_phone`, called the
    way `draft_order` calls it and for the identical reason.

    This is load-bearing rather than fussy. `matcher._alias_lookup` reads
    `(phone_number = $3 or phone_number is null)`, so an alias written against a DIFFERENT address
    than the one the next draft matches with is a memory that exists and never fires — the exact
    shape of «it says it learned and nothing changed». One reader, so the write and the read can
    never disagree.

    EMPTY BECOMES `None`, and that is the robust end of the pair rather than a tidy-up. A demo
    party is `test.demo.t.<slug>.<sid>`, which encodes no number, so this usually answers '' today —
    and an alias filed under the literal '' is found ONLY by a lookup that also passes ''. The day
    this scope gains a contact endpoint (a QR handoff, a phone rung) the read starts arriving with a
    real address and every '' row silently stops firing. `None` files it tenant-wide instead, which
    the `or phone_number is null` half of the lookup finds under BOTH addresses. The demo world is
    one visitor's sandbox, so tenant-wide is exactly the right radius here."""
    try:
        import orders_tool
        async with db.scoped_tx(scope) as con:
            return (await orders_tool._scope_phone(con, scope)) or None
    except Exception:
        log.debug("demo_flow: party phone read fail-soft for %s", scope, exc_info=True)
        return None


async def correct_line(token: str, ref: str, index: int, *, sku_id: str = "",
                       qty: Optional[float] = None) -> dict[str, Any]:
    """The operator corrects ONE line of a drafted order — and the correction teaches (§17.57 ①②).

    Two writes, in this order, and the order is the promise:
      ① the corrected sheet lands as an `order.corrected` event on this session's scope, so every
         surface that draws the order (the board, the customer's card picture) shows the corrected
         one from the next read;
      ② `pipeline.learn_from_correction` writes the memory — the `sku_aliases` row the matcher hits
         on its fast path, the `learned_patterns` qty habit, and the recall fact the ficha shows.

    ② is the product claim, so it is REPORTED rather than assumed: the answer carries `learned` and
    the alias itself, and the screen only says «Guardado en la memoria» when this said so.

    Never raises. Unknown session / unknown ref / index off the end are all `ok: False` with a code
    the route turns into its one sentence."""
    row = await resolve(token)
    if row is None:
        return {"ok": False, "error": "unknown_session"}
    scope = scope_of_row(row)
    tenant = tenant_of_row(row)
    try:
        ev_id = int(str(ref))
    except (TypeError, ValueError):
        return {"ok": False, "error": "unknown_order"}

    async with db.scoped_tx(scope) as con:
        ev = await con.fetchrow(
            "select id, payload from event where scope=$1::ltree and type='order.drafted' "
            "and id=$2 limit 1", scope, ev_id)
        if not ev:
            return {"ok": False, "error": "unknown_order"}
        fixes = await _corrections(con, scope)
    sheet = dict(fixes.get(str(ev_id)) or _payload(ev["payload"]))
    before = [dict(l) for l in (sheet.get("lines") or [])]
    if index < 0 or index >= len(before):
        return {"ok": False, "error": "unknown_line"}

    after = [dict(l) for l in before]
    line = after[index]
    picked: Optional[dict[str, Any]] = None
    if sku_id:
        async with db.get_pool().acquire() as con:
            picked = await con.fetchrow(
                "select id, code, name, base_unit, price, variable_weight from catalogue_skus "
                "where tenant_id = $1 and id = $2", tenant, str(sku_id))
        # A SKU THAT IS NOT ON THEIR LIST IS NOT A SKU. The picker only ever offers rows from
        # `skus()` above, so this is the fence rather than the validation: a hand-made request
        # cannot bind a customer's word to another tenant's article.
        if picked is None:
            return {"ok": False, "error": "unknown_sku"}
        line["sku"] = picked["id"]
        line["code"] = picked["code"]
        line["name"] = picked["name"]
        line["unit"] = line.get("unit") or (picked["base_unit"] or "")
        line["price"] = float(picked["price"]) if picked["price"] is not None else None
        line["variable_weight"] = bool(picked["variable_weight"])
    if qty is not None:
        try:
            line["qty"] = float(qty)
        except (TypeError, ValueError):
            return {"ok": False, "error": "unknown_line"}

    # the arithmetic is the sheet's own (orders_tool's rule: no price and not variable-weight means
    # no total, never an invented number)
    price, q = line.get("price"), line.get("qty")
    line["line_total"] = (round(float(price) * float(q), 2)
                          if price is not None and q else None)
    after[index] = line
    sheet["lines"] = after
    sheet["total"] = round(sum(float(l.get("line_total") or 0) for l in after), 2)
    sheet["ref"] = str(ev_id)

    import spine
    async with db.scoped_tx(scope) as con:
        await spine.append_event(con, scope, CORRECTED_EVENT, "operator",
                                 {"ref": str(ev_id), "index": index, "lines": after,
                                  "unmatched": sheet.get("unmatched") or [],
                                  "total": sheet["total"],
                                  "currency": sheet.get("currency") or "eur"},
                                 caused_by=ev_id, lane="world")
    card_cache_clear()      # the picture is rendered from the sheet, and the sheet just moved

    # ── ② THE MEMORY ────────────────────────────────────────────────────────────────────────────
    # THE ADDRESS IS PASSED VERBATIM, empty string and all — see `_party_phone`. The scope is passed
    # too, because the recall fact belongs in THIS world and `learn.reconcile` would otherwise
    # compute a party scope out of a synthetic number (see its own note).
    phone = await _party_phone(scope)
    learned: dict[str, Any] = {"ok": True, "learned": False}
    try:
        from brain import pipeline as _pl
        learned = await _pl.learn_from_correction(
            phone,
            scope=scope,
            # `name` rides on BOTH sides so `learn.customer_words` can recognise our own annotation
            # («sarta del rojo (chorizo sarta dulce)») — the old name is the one inside the brackets
            before_lines=[{"sku_id": l.get("sku"), "name": l.get("name"),
                           "mention": l.get("mention") or l.get("name"),
                           "qty": l.get("qty"), "unit": l.get("unit")} for l in before],
            after_lines=[{"sku_id": l.get("sku"), "name": l.get("name"),
                          "mention": l.get("mention") or l.get("name"),
                          "qty": l.get("qty"), "unit": l.get("unit")} for l in after],
            tenant=tenant)
    except Exception:
        log.exception("demo_flow: correction learning failed (the correction still stands)")
    return {"ok": True, "learned": bool(learned.get("learned")),
            "alias": str(learned.get("alias") or ""),
            "name": str(line.get("name") or ""),
            "order": {"ref": str(ev_id), "lines": after, "total": sheet["total"],
                      "currency": sheet.get("currency") or "eur"}}


# what a learned memory is made of, and what the reset takes back. The catalogue projection
# (`seed`/`golive`/`create`) is MACHINERY — the vocabulary their own price list produced — so it
# survives a reset; `sup_api._ALIAS_MACHINE_SOURCES` draws the same line for the same reason.
_LEARNED_ALIAS_SOURCES = ("edit", "learned", "historial")


async def customer(token: str) -> Optional[dict[str, Any]]:
    """THE FICHA, for this session's one customer (§17.57 ②⑥).

    Same wire as `GET /api/sup/customers/{phone}`, because the screen behind «Abrir perfil» is the
    panel's own `FichaBody` and a second shape would be a second dossier. The rows are this world's
    real ones: `card` / `open_loop` / `fact` off the session's scope — so the recall sentence
    `learn.reconcile` writes («cuando dice «X» se refiere a «Y»») appears under «Lo que Rocoto sabe»
    the moment a correction lands, which is the whole of §17.57 ② made visible in the product's own
    UI rather than announced by a toast.

    The order history and the week rhythm come from the session's own `order.drafted` events
    (corrections folded), which is what §17.57 ⑥ means by weight: a long conversation fills this
    page because the conversation really happened, never because anything was seeded."""
    row = await resolve(token)
    if row is None:
        return None
    scope = scope_of_row(row)
    orders: list[dict[str, Any]] = []
    week = [0] * 7
    basket: dict[str, dict[str, Any]] = {}
    card, tabs, facts = "", [], []
    try:
        async with db.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select id, payload, ts from event where scope=$1::ltree and type='order.drafted' "
                "order by id desc limit 30", scope)
            fixes = await _corrections(con, scope)
            card = await con.fetchval(
                "select body from card where scope = $1::ltree", scope) or ""
            # OUR OWN OBJECTIVES ARE NOT THE CUSTOMER'S DOSSIER. The runtime opens a `pursuit` loop
            # on every party — «conseguir esa primera llamada de alta con Peter
            # (send_booking_link)» — which is Rocoto's sales lane talking to itself. On the panel
            # that is fine; on /demo the reader is the prospect that sentence is ABOUT, and it
            # arrived in their ficha naming a tool. The tabs shown here are the ones that are about
            # THEM (measured: the pursuit row was the only internal kind this world produced).
            open_rows = await con.fetch(
                "select id, kind, text, due_at from open_loop where scope = $1::ltree "
                "and status = 'open' and kind <> 'pursuit' order by opened_at desc limit 20", scope)
            fact_rows = await con.fetch(
                "select kind, text from fact where scope = $1::ltree and invalid_at is null "
                "order by created_at desc limit 40", scope)
        tabs = [{"id": str(r["id"]), "kind": r["kind"], "text": r["text"],
                 "due_at": r["due_at"].isoformat() if r["due_at"] else None,
                 "timer": None} for r in open_rows]
        facts = [{"kind": r["kind"], "text": r["text"], "dead": False} for r in fact_rows]
        for r in rows:
            p = fixes.get(str(r["id"])) or _payload(r["payload"])
            lines = [l for l in (p.get("lines") or []) if l.get("name")]
            if not lines:
                continue
            when = r["ts"]
            if when is not None:
                week[when.weekday()] += 1
            orders.append({"id": str(r["id"]), "status": "needs_review",
                           "date": when.date().isoformat() if when else "",
                           "lines": len(lines),
                           "eur": float(p.get("total") or 0) or None})
            for l in lines:
                key = str(l.get("name") or "")
                seen = basket.setdefault(key, {"name": key, "qty": 0, "unit": l.get("unit") or ""})
                try:
                    seen["qty"] = round(float(seen["qty"]) + float(l.get("qty") or 0), 2)
                except (TypeError, ValueError):
                    pass
    except Exception:
        log.exception("demo_flow: customer view read failed for %s", scope)

    total_cents = round(sum((o.get("eur") or 0) for o in orders) * 100)
    typical = sorted(basket.values(), key=lambda b: -float(b["qty"] or 0))[:8]
    # WHO THIS DOSSIER IS ABOUT. The visitor is playing their own customer, and this world has
    # exactly one of them, so the head reads as the thread does on the WhatsApp side. `tenants` is
    # read unscoped for `order_card_png`'s reason: it is not a table the party's RLS scope may see.
    who = "Tu cliente"
    try:
        async with db.get_pool().acquire() as con:
            r = await con.fetchrow("select name from tenants where slug=$1", tenant_of_row(row))
        if r and (r["name"] or "").strip():
            who = f"Cliente de {str(r['name']).strip()}"
    except Exception:
        log.debug("demo_flow: tenant name read fail-soft", exc_info=True)
    return {
        "phone_number": await _party_phone(scope) or _fake_phone(row["sid"]),
        "name": who,
        "business": None,
        "last_order_at": orders[0]["date"] if orders else None,
        "cadence_days": None,
        "ltv_cents": total_cents,
        "erp_client_code": None,
        "typical_basket": typical,
        "top_products": [b["name"] for b in typical[:6]],
        "orders": orders,
        "week_rhythm": week,
        "card": card, "tabs": tabs, "facts": facts,
    }


async def clear_orders(token: str) -> Optional[dict[str, int]]:
    """«Vaciar pedidos y reenviar» — the BOARD emptied, and nothing else (§17.57 ③).

    The narrow half of the reset, and the difference is the whole argument: this takes the orders
    away and LEAVES the memory, so the same words sent again land on an empty desk and produce the
    corrected line with nothing of the old one beside it to squint at. `reset_world` below is the
    other door — that one takes the memory too."""
    row = await resolve(token)
    if row is None:
        return None
    scope = scope_of_row(row)
    async with db.scoped_tx(scope) as con:
        n = _n_status(await con.execute(
            "delete from event where scope <@ $1::ltree and type = any($2::text[])",
            scope, ["order.drafted", CORRECTED_EVENT]))
    card_cache_clear()
    return {"event": n}


async def reset_world(token: str) -> Optional[dict[str, int]]:
    """«Reiniciar chat y memoria» (§17.57 ⑤) — the world back to the moment the catalogue landed.

    WHAT GOES: everything the CONVERSATION produced. The scope's runtime rows (its events, facts,
    card, open loops, timers…) and the memory those turns taught — the learned `sku_aliases` and the
    `learned_patterns` habits keyed to this party.

    WHAT STAYS: their price list — `catalogue_skus` and the alias vocabulary the projection derived
    from it are the thing they uploaded, not the thing they said, so taking it would send them back
    to step 2 of a flow they finished, which is a different dead end — AND, since 2026-08-11
    (PEDIDOS-PRICING-BUILD.md §6, closing the loophole), `turns` and `closed`.

    ── THE LOOPHOLE THIS USED TO BE ────────────────────────────────────────────────────────────
    Until 2026-08-11 the memory half of this function ALSO ran
    `update demo_sessions set turns = 0, closed = false where token = $1` — so «Reiniciar» did not
    just clear the desk, it refilled the meter. A visitor at message 30 pressed the one button on
    the closed screen and had another 30 free messages, forever, on a loop that cost nothing and
    left no trace: the cap this whole surface exists to enforce (§6, «Cap 30 messages, confirmed by
    Peter») was decorative the moment someone noticed the button did double duty. The fix is the
    absence of that statement, not a guard on it — `reset_world` no longer touches `turns` or
    `closed` at all, on either connection, so there is nothing left here that could be re-added by a
    future edit that mistook the omission for an oversight. THE BUTTON KEEPS WORKING: a session that
    has not yet hit 30 can still reset its world and keep typing, at the SAME running total — it is
    only the refill that is gone.

    Deletes are `scope <@` fenced and tenant-equality fenced, and the RLS-owned tables go through
    `db.scoped_tx` for `_drop_demo_world`'s measured reason: a DELETE on those from the owner pool
    matches zero rows and reports success."""
    row = await resolve(token)
    if row is None:
        return None
    scope = scope_of_row(row)
    tenant = tenant_of_row(row)
    # the SAME address the corrections filed their habits against — `_party_phone` verbatim, so the
    # delete cannot miss rows the write made under a different spelling
    phone = await _party_phone(scope)
    counts: dict[str, int] = {}

    async def _exists(c, table: str) -> bool:
        return bool(await c.fetchval("select to_regclass($1)", f"public.{table}"))

    # ① the conversation's own rows, inside the fence that can actually delete them
    async with db.scoped_tx(scope) as sc:
        for t in _DEMO_SCOPE_TABLES_ORDERED:
            # `scope_node` and `contact` are the ANCHORS — the party itself, not what it said. They
            # stay, so the next message lands in the world it already had rather than bootstrapping
            # a second one mid-session.
            if t in ("scope_node", "contact", "entity_map") or t not in _RLS_FENCED:
                continue
            if not await _exists(sc, t):
                continue
            counts[t] = _n_status(await sc.execute(
                f"delete from {t} where scope <@ $1::ltree", scope))
        # the card is the mind's running ficha: emptied, never dropped (the row IS the party's slot)
        if await _exists(sc, "card"):
            await sc.execute(
                "insert into card(scope,body,version,lineage) values($1::ltree,'',0,'test') "
                "on conflict (scope) do update set body='', version=0", scope)

    # ② the memory those turns taught
    async with db.get_pool().acquire() as con:
        if await _exists(con, "sku_aliases"):
            counts["sku_aliases"] = _n_status(await con.execute(
                "delete from sku_aliases where tenant_id = $1 and source = any($2::text[])",
                tenant, list(_LEARNED_ALIAS_SOURCES)))
        if await _exists(con, "learned_patterns"):
            counts["learned_patterns"] = _n_status(await con.execute(
                "delete from learned_patterns where tenant_id = $1 "
                "and phone_number is not distinct from $2", tenant, phone))
        # `demo_sessions.turns` / `.closed` are DELIBERATELY NOT TOUCHED HERE — see the docstring's
        # «THE LOOPHOLE THIS USED TO BE». Nothing in `counts` names them any more, on purpose: a
        # `counts["turns"]` key that always reads 0 would look like the reset was still doing
        # something to the meter, which is exactly the false impression a reviewer must not get.
    card_cache_clear()
    log.info("demo reset: %s → %s", scope, counts)
    return counts


# ── the order card the CUSTOMER receives, as a picture ───────────────────────────────────────────

# ── THE ORDER-CARD BYTE CACHE (2026-08-09, BUG 3) ────────────────────────────────────────────────
# `/order-card` is a few HUNDRED MILLISECONDS of Pillow rasterisation per hit, on the single uvicorn
# worker that also answers paying customers' WhatsApp webhooks and Twilio callbacks. It is drawn by
# a browser `<img>`, so a re-render, a re-mount, a scroll-back or a stuck retry loop fetches it
# again — and the answer is IDENTICAL every time, because the lines come out of an APPEND-ONLY
# event whose payload cannot change. Rendering it twice is pure waste, and the second render is
# waste that competes with an order arriving on WhatsApp.
#
# Keyed on (scope, ref) — the scope, not the token, so it cannot survive into another world, and it
# is only ever reached AFTER the route's full authorisation chain (cookie → cap → the row is yours →
# the tenant is in test mode). A cache hit is not a shortcut past a fence; the fence ran.
#
# IT EXPIRES, and the reason is not memory: the card carries `pipeline.fecha_es_now()`, so a card
# cached before midnight is WRONG after it. Ten minutes is longer than any burst of re-renders and
# far shorter than the thing that makes it stale. The size cap makes the whole structure bounded
# under an adversary who drafts orders in a loop: oldest-out, never unbounded growth.
_CARD_CACHE: "OrderedDict[str, tuple[float, bytes]]" = OrderedDict()
_CARD_CACHE_TTL_S = float(os.getenv("ROCOTO_DEMO_CARD_CACHE_S", "600") or "600")
_CARD_CACHE_MAX = int(os.getenv("ROCOTO_DEMO_CARD_CACHE_MAX", "256") or "256")


def _card_cache_get(key: str) -> Optional[bytes]:
    hit = _CARD_CACHE.get(key)
    if hit is None:
        return None
    when, png = hit
    if time.monotonic() - when > _CARD_CACHE_TTL_S:
        _CARD_CACHE.pop(key, None)
        return None
    _CARD_CACHE.move_to_end(key)
    return png


def _card_cache_put(key: str, png: bytes) -> None:
    _CARD_CACHE[key] = (time.monotonic(), png)
    _CARD_CACHE.move_to_end(key)
    while len(_CARD_CACHE) > _CARD_CACHE_MAX:
        _CARD_CACHE.popitem(last=False)


def card_cache_clear() -> None:
    """For the vitals, and for anyone debugging a stale card. Never called on a request path."""
    _CARD_CACHE.clear()


async def order_card_png(token: str, ref: str) -> Optional[bytes]:
    """THE IMAGE A REAL CUSTOMER GETS, for a demo session's order (§17.56d ①).

    Peter, on the first cut of the customer view: *«our runtime ALREADY generates images!!!»* — it
    does. `brain/order_card.render_order_card` has existed since 2026-07-27 for exactly this
    message, and `brain/pipeline.ask_order_confirm` sends it on WhatsApp before the Sí/No. The
    demo was drawing the A4 albarán (a delivery note) with a React component instead, which is
    both the wrong DOCUMENT and the wrong RENDERER.

    So this is a seam, not a second implementation, and every step of it is the live path's:
      · the lines come out of THIS session's own `order.drafted` event, read under the session's
        scope (RLS), through `portal._lines_out` — the same function `ask_order_confirm` feeds the
        renderer, so «the order» means one thing in the picture, on the confirmation page and in
        «Pedidos»;
      · the total is `portal._order_total`, which refuses to invent one for a variable-weight or
        unpriced line — the card then simply has no money furniture, the same as on WhatsApp;
      · the date is `pipeline.fecha_es_now()`, the one both callers share;
      · the bytes are `render_order_card`'s. Nothing here draws anything.

    THE CUSTOMER NAME IS DELIBERATELY BLANK. On the live rail it is `orders.customer_name`; a demo
    session has no customer row and no profile, and a plausible-looking «Cliente de prueba» painted
    into the image would be this module inventing a fact about the order. `render_order_card`
    already omits the line when the name is empty — which is what a real unnamed customer's card
    looks like too.

    Returns None for an unknown session, an unknown/foreign ref, or an order with no lines — the
    route turns all of those into the ONE 404 sentence, exactly like every other /demo door."""
    row = await resolve(token)
    if row is None:
        return None
    scope = scope_of_row(row)
    tenant = tenant_of_row(row)
    try:
        ev_id = int(str(ref))
    except (TypeError, ValueError):
        return None
    # the cache key is the SCOPE and the event id — never the token, which rotates, and never the
    # ref as the client spelled it («007» and «7» are the same card and must not be two entries).
    ck = f"{scope}|{ev_id}"
    cached = _card_cache_get(ck)
    if cached is not None:
        return cached
    try:
        # scoped: the ref names an event, and only this session's scope may name it. A ref from
        # another visitor's session simply does not exist through this connection.
        async with db.scoped_tx(scope) as con:
            ev = await con.fetchrow(
                "select payload from event where scope=$1::ltree and type='order.drafted' "
                "and id=$2 limit 1", scope, ev_id)
            fixes = await _corrections(con, scope) if ev else {}
        if not ev or not ev["payload"]:
            return None
        # THE PICTURE FOLLOWS THE CORRECTION. The card is what the CUSTOMER receives, so a corrected
        # order that still mailed the wrong sheet would be the demo contradicting itself on the one
        # screen where both halves are visible at once.
        p = fixes.get(str(ev_id)) or ev["payload"]
        if isinstance(p, str):
            import json as _json
            p = _json.loads(p)

        import portal
        lines = portal._lines_out(p.get("lines") or [])
        if not lines:
            return None
        total = portal._order_total(lines)

        # the supplier's display name — read unscoped for portal.py's own reason: `tenants` is not
        # a table the customer's RLS scope has any business seeing.
        biz = ""
        try:
            pool = db.get_pool()
            async with pool.acquire() as con:
                r = await con.fetchrow("select name from tenants where slug=$1", tenant)
            biz = str((r and r["name"]) or "")
        except Exception:
            log.debug("demo_flow: tenant name read fail-soft for %s", tenant, exc_info=True)

        from brain import order_card, pipeline
        png = order_card.render_order_card(
            business_name=biz or tenant, customer_name="", lines=lines, total=total,
            fecha=pipeline.fecha_es_now())
        if png:
            _card_cache_put(ck, png)
        return png
    except Exception:
        log.exception("demo_flow: order card render failed for %s ref=%s", scope, ref)
        return None


# ── seeds (the 20-seconds-of-silence nudge) ──────────────────────────────────────────────────────

# Food nouns for the off-code ask — common enough that a Spanish food catalogue plausibly lacks at
# most a few, ordered so the deterministic pick is stable. The first one ABSENT from the session's
# own names wins; if the visitor somehow sells all of them, the last is used regardless (a demo
# seed that is occasionally in-catalogue is a weaker demo, not a wrong one).
_OFF_NOUNS = ("alcachofas", "percebes", "trufa negra", "mozzarella", "salmón ahumado",
              "pan de centeno", "mantequilla", "aguacates", "azafrán", "kombucha")


async def seeds(token: str) -> Optional[dict[str, Any]]:
    """Three canned messy inputs built FROM THE SESSION'S OWN CATALOGUE — a run-on order, the vague
    «lo de siempre», and an off-code ask — so one click produces the priced-order moment against
    the visitor's real names. DETERMINISTIC (random seeded with the sid): the same session always
    offers the same three, so the screen never shuffles under the visitor's cursor."""
    row = await resolve(token)
    if row is None:
        return None
    tenant = tenant_of_row(row)
    try:
        async with db.get_pool().acquire() as con:
            skus = await con.fetch(
                "select name, family, base_unit from catalogue_skus "
                "where tenant_id=$1 and in_assortment order by name limit 60", tenant)
    except Exception:
        log.exception("demo_flow: seeds catalogue read failed for %s", tenant)
        skus = []
    if not skus:
        return {"ok": True, "seeds": []}
    rng = random.Random(row["sid"])

    names = [str(r["name"] or "").strip() for r in skus if r["name"]]
    picks = rng.sample(names, min(4, len(names)))

    def _short(n: str) -> str:
        # the first couple of words, lowercased — how a customer actually types their supplier's
        # articles («chorizo ibérico», not the full ERP row). Never invented, only truncated.
        return " ".join(n.lower().split()[:2])

    def _qty(unit: str) -> str:
        u = (unit or "kg").lower()
        if u in ("kg", "kilo", "kilos"):
            return f"{rng.choice((2, 3, 4, 5, 6))} kg de"
        return f"{rng.choice((2, 3, 4, 6, 10, 12))}"

    unit_of = {str(r["name"] or "").strip(): str(r["base_unit"] or "kg") for r in skus}
    parts = [f"{_qty(unit_of.get(n, 'kg'))} {_short(n)}" for n in picks[:4]]
    seed1 = ("hola ponme " + ", ".join(parts[:-1]) + " y " + parts[-1]
             + " pa el " + rng.choice(("viernes", "jueves", "sábado")) + " porfa")

    fams = [str(r["family"] or "").strip().replace("_", " ") for r in skus if r["family"]]
    fam = (max(set(fams), key=fams.count) if fams
           else _short(picks[-1]))              # no families in their file → a real product word
    seed2 = f"lo de siempre más 2 cajas de {fam}"

    folded = " ".join(names).lower()
    off = next((n for n in _OFF_NOUNS if n.split()[0] not in folded), _OFF_NOUNS[-1])
    seed3 = f"¿me puedes poner también {rng.choice((1, 2))} de {off}?"

    return {"ok": True, "seeds": [seed1, seed2, seed3]}


# ── REAPING (2026-08-09 review, F8) ───────────────────────────────────────────────────────────────
# THE DOCSTRING AT THE TOP OF THIS FILE USED TO CLAIM the anonymous tenants were «REAPABLE by the
# same sweep that reaps every test tenant». They were not: `sweep.py`, `worker.py` and `lifecycle.py`
# contain no reaper for `tenants`, `demo_sessions`, `demo_magic_links` or `catalogue_intake`, the
# only `delete from tenants` outside the tests is the manual `test_account.py drop` CLI, and
# `expires_at` on all three tables was read by resolvers and acted on by nobody. Prod already holds
# five orphan `demo_*` tenants from one afternoon of testing, and `brain.teams.ensure_seed` iterates
# every tenant on EVERY boot inserting a membership row per tenant — so the junk was not only
# permanent, it was making process start slower for good.
#
# This is the reaper, in `demo_media.maybe_reap`'s idiom and for its reason: these tables grow only
# when somebody uses the demo, so the demo's own request path is where the sweep belongs — no
# traffic, no growth, no timer to forget. Bounded deletes (never the statement that locks a table),
# fail-soft throughout, and callable by hand or by cron for anyone who wants it on a clock.
#
# THE TENANT DELETE IS DELIBERATELY NARROW — see `_reapable_tenants` below, which is the ONE
# selection and the only place the predicate is written.
#
# ── THE 2026-08-09 CORRECTION: THE REAPER MATCHED NOTHING IT CREATES ────────────────────────────
# The rung above was written for the ANONYMOUS world (`demo_<sid>`, `seeded=true`) and its predicate
# was `slug like 'demo\_%' and seeded is true`. That rung was deleted the same day. What mints a
# demo tenant NOW is `provisioning.provision`, which derives the slug from the EMAIL and (correctly,
# see its docstring) never sets `seeded`. So the sweep matched ZERO rows, forever, while
# soyrocoto.com/privacy.html and /datos-seguridad.html both stated — live, in Spanish, to the data
# subject — «los datos de una demo se conservan un máximo de 90 días si no llegamos a trabajar
# juntos». A published retention period nobody performs is a false statement (GDPR Art. 5(1)(e) +
# 13(2)(a)), and it was false about every visitor's tenant, their uploaded price list, their email
# and their sign-in IP.
#
# WHY A COLUMN AND NOT A BETTER PATTERN. Slug-shape was the coupling that broke: the reaper inferred
# «is this a demo world» from a string another module mints for unrelated reasons, so the day that
# module changed how it spells a slug the reaper silently stopped reaching anything — no error, no
# count, no alarm, just a promise quietly going unperformed. `tenants.provisioned_via` is written by
# the door that KNOWS the answer (provisioning.provision, one writer, two callers) at the moment of
# creation. It cannot drift, and a `select` on it is a statement about intent rather than a guess.
#
# ┌── THE SHAPE ALL THREE OF THE 2026-08-09 FINDINGS SHARE. READ THIS BEFORE ADDING A RULE. ──────┐
# │ Each one was A RULE EXPRESSED SOMEWHERE THAT COULD SILENTLY DRIFT FROM THE THING IT DESCRIBES.│
# │   · here    — «which tenants are demo tenants» expressed as a SLUG PATTERN, while the slug is │
# │               minted by another module for unrelated reasons (§17.56c changed it; this broke).│
# │   · spine   — «which events are test events» expressed as a KWARG DEFAULT that 155 call sites │
# │               had to pass correctly (two didn't; see `spine.lineage_of`).                     │
# │   · app.py  — «which routes are expensive» expressed as a COMMENT, while the limiter was      │
# │               applied by hand route by route (five weren't; see `_demo_rate_ok`).             │
# │ The failure mode is identical and it is the nastiest one available: NOTHING RAISES. The rule  │
# │ still looks right in the file where it is written, the code it describes has moved, and the   │
# │ only symptom is an absence — nothing deleted, nothing tagged, nothing limited.                │
# │ THE FIX IS ALWAYS THE SAME SHAPE: move the rule to the ONE place that already knows the answer│
# │ (the writer, the statement, the helper), and derive everything else from it. If you find      │
# │ yourself pattern-matching a value another module owns, or documenting a default that every    │
# │ caller must remember, you are re-introducing this bug.                                        │
# └───────────────────────────────────────────────────────────────────────────────────────────────┘
#
# THE RULE, and it is the only rule:
#     a tenant that went through the demo and NEVER WENT LIVE is reapable;
#     a tenant a real customer went live with is NEVER reapable, however it was created.
# «Went live» is not one flag, because we do not get to be wrong in that direction — it is the union
# of every mark a real activation leaves (`status <> 'test'`, `golive_at`, `onboarded_at`, a bound
# WhatsApp line either way it is recorded, a Stripe subscription row, any `tenant_product` past
# 'off'). Any ONE of them present ⇒ out of the selection. Their absence is what «never went live»
# means, and it is checked in SQL rather than assumed from a slug.

_last_reap = 0.0
_REAP_EVERY_S = int(os.getenv("ROCOTO_DEMO_REAP_EVERY_S", "3600") or "3600")

# THE WINDOW FOR A PROVISIONED (signed-in) DEMO WORLD. Its own knob, and it defaults to the number
# on the public page — 90 days — rather than reusing `DEMO_SESSION_TTL_DAYS` (14). A session is a
# handle that expires; this is a person's workspace with their catalogue in it, and the promise we
# published about it says 90. Deleting earlier than the published maximum is permitted and deleting
# later is not, so the default IS the published maximum: nobody has to reconcile two numbers.
DEMO_TENANT_TTL_DAYS = int(os.getenv("ROCOTO_DEMO_TENANT_TTL_DAYS", "90") or "90")

# ── THE SELECTION, WRITTEN ONCE ──────────────────────────────────────────────────────────────────
# `reap()` and `reap_preview()` used to carry two hand-copied versions of this predicate, which is
# the same hazard one rung up: the DRY RUN a human reads before pressing the button is only evidence
# if it is the SAME statement the button runs. It is now literally the same function, and
# tests/vital_demo_reap.py asserts the returned set slug-by-slug against a fixture of worlds built
# to sit on both sides of every clause.
#
# The two rungs are deliberately separate SELECTs unioned in Python rather than one clever WHERE:
# they answer different questions about different populations, they are allowed to have different
# windows, and a reader has to be able to check each one on its own. `rung` rides on the row so the
# audit trail and the dry run can say WHY a world was chosen.
_REAP_LEGACY_SQL = """
select t.slug, 'legacy_anonymous' as rung
  from tenants t
 where t.slug like 'demo\\_%'
   and t.seeded is true
   and t.status = 'test'
   and t.created_at < now() - ($1 || ' days')::interval
   and not exists (select 1 from demo_sessions s where s.sid = right(t.slug, -5))
 order by t.created_at
 limit $2
"""

# Every clause below is a REFUSAL, and each one names the mark a real activation leaves. Read it as:
# «a world minted by the /demo door, still empty of every sign of a real customer, with nobody
# holding a live session on it, older than the window we published.»
_REAP_PROVISIONED_SQL = """
select t.slug, 'provisioned_demo' as rung
  from tenants t
 where t.provisioned_via = 'demo'          -- the DOOR, recorded at creation. Never inferred.
   and t.status = 'test'                   -- 'live' bills; anything but 'test' is not ours to drop
   and t.seeded is not true                -- a seeded world is the deployment's, not a visitor's
   and t.golive_at is null                 -- the activation stamp (§6 `live` box) — ever set ⇒ never
   and t.onboarded_at is null              -- the wizard ran ⇒ a person did real work in here
   and t.number is null                    -- a WhatsApp line was bound…
   and t.wa_phone_number_id is null        -- …either way it gets recorded
   and t.created_at < now() - ($1 || ' days')::interval
   and t.updated_at < now() - ($1 || ' days')::interval   -- quiet for the whole window, not just old
   and not exists (select 1 from demo_sessions s  where s.tenant_slug = t.slug)
   and not exists (select 1 from sup_session ss
                    where ss.tenant_slug = t.slug and ss.revoked_at is null
                      and ss.expires_at > now())          -- somebody is signed in RIGHT NOW
   and not exists (select 1 from employee_subscriptions es where es.tenant_id = t.slug)
   and not exists (select 1 from tenant_product tp
                    where tp.tenant_id = t.slug and tp.state <> 'off')
 order by t.created_at
 limit $2
"""


async def _reapable_tenants(con, *, limit: int = 200) -> list[dict[str, str]]:
    """THE selection: [{slug, rung}] — every world this sweep may drop, and nothing else.

    Never raises: a missing table (a clone built from `schema_runtime.sql` alone has no `tenants`)
    yields an empty list for that rung rather than an exception, because the sweep's failure mode
    must be «deleted nothing» and never «died halfway through a delete».

    `config.BRAIN_TENANT` is filtered HERE rather than at the delete, so it is impossible for it to
    appear in a dry run either. The deployment's own world is not a demo, whatever any column says."""
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for sql, ttl in ((_REAP_LEGACY_SQL, int(config.DEMO_SESSION_TTL_DAYS)),
                     (_REAP_PROVISIONED_SQL, int(DEMO_TENANT_TTL_DAYS))):
        try:
            rows = await con.fetch(sql, str(ttl), limit)
        except Exception:
            # WARNING, not debug. «The selection raised» and «the selection is empty» are the same
            # observable outcome — nothing gets deleted — and that outcome is exactly the bug this
            # rewrite exists to fix. It must never again be something you can only find by turning
            # on debug logging.
            log.warning("demo reap: a selection rung FAILED and reaped nothing (ttl=%s days) — "
                        "the published retention window is not being performed for it", ttl,
                        exc_info=True)
            continue
        for r in rows:
            slug = str(r["slug"])
            if not slug or slug == config.BRAIN_TENANT or slug in seen:
                continue
            seen.add(slug)
            out.append({"slug": slug, "rung": str(r["rung"])})
    return out


# ── WHAT «DROP THE WORLD» MEANS, table by table ──────────────────────────────────────────────────
# The legacy rung only ever deleted `sup_session`, `team_members` and the `tenants` row, which was
# defensible for an anonymous throwaway that had a slug and nothing else. It is NOT enough for a
# provisioned world: the retention sentence is about «los datos de una demo», and the data is the
# CONVERSATION (events, facts, the card), the PRICE LIST they uploaded, and their EMAIL.
#
# FK ORDER IS LOAD-BEARING and it is why this list is ordered by hand rather than reused from
# `cr_control._SCOPE_TABLES` (which is alphabetical-ish and deletes `event` first). `open_loop`,
# `timer` and `action` all carry `references event(id)` with no ON DELETE clause, so removing the
# events first raises a FK violation at that statement's end. Children first, `event` last, then the
# anchors. `event.caused_by` and `open_loop.parent_loop_id` are SELF-references — deleting a whole
# subtree in ONE statement is fine (NO ACTION is checked at end of statement, not per row).
# tests/vital_demo_reap.py asserts this list still covers every `scope ltree` table in the schema,
# so a new organ table cannot be quietly left behind.
_DEMO_SCOPE_TABLES_ORDERED = [
    "timer", "action", "open_loop",                    # → event, open_loop
    "contact_role", "fact", "card", "summary", "pending_turn", "scope_state", "sweep_state",
    "wake", "assembly_snapshot", "standing_instruction",
    "manifest_sense", "manifest_tool", "manifest_stakeholder", "manifest_duty", "manifest_presence",
    "event",                                           # after everything that references it
    "contact", "scope_node",                           # the anchors, last (endpoint FKs contact)
    "entity_map",
]

# WHICH OF THOSE ARE BEHIND THE RLS FENCE, and it is not a detail — it decides WHICH CONNECTION may
# delete them. `schema_rls.sql` puts these tables under ENABLE + **FORCE** row level security, and
# the `rocoto` owner role does NOT carry BYPASSRLS (checked: `rolbypassrls=false`, deliberately —
# §15.7's «never BYPASSRLS»). So a DELETE issued on the OWNER pool against `event` matches ZERO ROWS
# and reports success. Measured, not reasoned: `DELETE 0` from the owner, `DELETE 1` from
# `rocoto_rt` at the same scope, on the same row.
#
# That is a silent-no-op trap with the worst possible failure mode for this function — the tenant
# row disappears, the person's conversation does not, and every count says it worked. The reap runs
# these through `db.scoped_tx(test.demo.t.<slug>)`: the policy is `scope <@ current_setting(...)`,
# so ONE transaction pinned at the world's ROOT can lawfully see and delete its whole subtree, and
# cannot touch anything outside it. Everything NOT in this set has no policy and is deleted on the
# owner connection as before. tests/vital_demo_reap.py asserts this set still equals the array in
# schema_rls.sql, because a table that gains a policy later and stays on the owner path would go
# back to deleting nothing, quietly.
_RLS_FENCED = frozenset({
    "event", "contact", "contact_role", "fact", "card", "summary", "open_loop", "timer",
    "pending_turn", "action", "scope_state", "scope_node", "sweep_state", "wake",
    "assembly_snapshot", "manifest_sense", "manifest_tool", "manifest_stakeholder",
    "manifest_duty", "manifest_presence", "standing_instruction",
})

# Keyed by tenant, not by scope. The uploaded price list lives here.
_DEMO_TENANT_TABLES = ["catalogue_skus", "sku_aliases", "catalogue_directory", "tenant_product"]


async def _drop_demo_world(con, slug: str) -> dict[str, int]:
    """Erase ONE provisioned demo world. Returns per-table counts. RAISES on failure, on purpose.

    Everything is fenced on `slug`: the scope deletes use `scope <@ ('test.demo.t.' || slug)::ltree`,
    which cannot reach another tenant (a different slug is a different ltree label), and every
    tenant-keyed delete is a plain equality. There is no wildcard and no `like` anywhere in here.

    TWO CONNECTIONS, IN THIS ORDER, and the order is the safety property:
      A. the RLS-fenced runtime tables, through `db.scoped_tx` at the world's ROOT (see `_RLS_FENCED`
         — the owner cannot delete these, it can only appear to);
      B. everything else plus the `tenants` row, on the caller's owner connection, in ONE
         transaction.
    A before B because a failure between them must leave the world SELECTABLE: the tenant row is the
    last thing to go, so a half-finished erase is retried on the next pass instead of becoming data
    nobody can find any more. And this raises rather than swallowing — `reap()` catches per world,
    skips it, and logs; a delete that reports success it did not achieve is the one outcome that
    cannot be allowed here.

    `to_regclass` guards each table: this runs against a live box, a rehearsal clone and a fresh
    schema, and a table that does not exist must be a skipped line rather than an aborted
    transaction that leaves the world half-deleted."""
    counts: dict[str, int] = {}
    root = f"test.demo.t.{slug}"

    async def _exists(c, table: str) -> bool:
        return bool(await c.fetchval("select to_regclass($1)", f"public.{table}"))

    # ── A. THE RUNTIME WORLD, through the role the policy actually admits ────────────────────────
    # `endpoint` has no `scope` column (it hangs off `contact`) and no policy, so `rocoto_rt` has no
    # grant on it: read the contact ids inside the fence, delete the endpoints outside it, and only
    # then drop the contacts. Three steps because the FK and the fence disagree about which
    # connection is allowed to see what.
    contact_ids: list[int] = []
    async with db.scoped_tx(root) as sc:
        if await _exists(sc, "contact"):
            contact_ids = [int(r["id"]) for r in await sc.fetch(
                "select id from contact where scope <@ $1::ltree", root)]
    if contact_ids and await _exists(con, "endpoint"):
        counts["endpoint"] = _n_status(await con.execute(
            "delete from endpoint where contact_id = any($1::bigint[])", contact_ids))
    async with db.scoped_tx(root) as sc:
        for t in _DEMO_SCOPE_TABLES_ORDERED:
            if t not in _RLS_FENCED or not await _exists(sc, t):
                continue
            counts[t] = _n_status(await sc.execute(
                f"delete from {t} where scope <@ $1::ltree", root))

    # ── B. THE TENANT'S OWN ROWS, in ONE transaction on the owner connection ──────────────
    # None of these carries a policy, so the owner really can delete them — and the `tenants`
    # row goes LAST inside the same transaction, so the world stays selectable until every
    # other row it owns is gone.
    async with con.transaction():
        for t in _DEMO_SCOPE_TABLES_ORDERED:
            if t in _RLS_FENCED or not await _exists(con, t):
                continue
            counts[t] = _n_status(await con.execute(
                f"delete from {t} where scope <@ $1::ltree", root))

        # THE PRICE LIST AND THE REST OF THE TENANT'S OWN ROWS.
        for t in _DEMO_TENANT_TABLES:
            if not await _exists(con, t):
                continue
            counts[t] = _n_status(await con.execute(f"delete from {t} where tenant_id = $1", slug))

        # the intake rows AND their bytes (the file they uploaded). The generic intake pass above only
        # reaches EXPIRED rows; a world going now takes its intakes with it whatever their clock says.
        if await _exists(con, "catalogue_intake"):
            counts["catalogue_intake"] = await _drop_intakes_of(con, slug)

        # the demo's own tables, by session.
        if await _exists(con, "demo_sessions"):
            sids = [r["sid"] for r in await con.fetch(
                "select sid from demo_sessions where tenant_slug = $1", slug)]
            for t in ("demo_media", "demo_phone_link"):
                if sids and await _exists(con, t):
                    counts[t] = _n_status(await con.execute(
                        f"delete from {t} where sid = any($1::text[])", sids))
            counts["demo_sessions"] = _n_status(await con.execute(
                "delete from demo_sessions where tenant_slug = $1", slug))

        # IDENTITY. The operator row is the email — the thing the promise is most obviously about — but
        # it is deleted ONLY when this world was their only membership and the row is neither seeded nor
        # a founder. A person who also belongs to a real team keeps their identity and loses only this
        # membership; that is the one case where leaving a row behind is the correct answer.
        emails: list[str] = []
        if await _exists(con, "operators") and await _exists(con, "team_members"):
            emails = [str(r["email"] or "") for r in await con.fetch(
                "select o.email from operators o join team_members tm on tm.operator_id = o.id "
                "where tm.tenant_slug = $1 and o.email is not null", slug)]
        counts["sup_session"] = _n_status(await con.execute(
            "delete from sup_session where tenant_slug = $1", slug))
        counts["team_members"] = _n_status(await con.execute(
            "delete from team_members where tenant_slug = $1", slug))
        await con.execute("update operators set active_tenant = null where active_tenant = $1", slug)
        counts["operators"] = _n_status(await con.execute(
            "delete from operators o where o.seeded is not true and o.is_founder is not true "
            "  and not exists (select 1 from team_members tm where tm.operator_id = o.id) "
            "  and o.email = any($1::text[])", emails or [""]))
        if emails and await _exists(con, "demo_magic_links"):
            counts["demo_magic_links"] = _n_status(await con.execute(
                "delete from demo_magic_links where lower(email) = any($1::text[])",
                [e.lower() for e in emails]))

        # `consent_events` and `sup_audit` are NOT touched, and that is deliberate. They are the
        # append-only evidence registers — the rows that answer «did they consent?» and «did you
        # actually delete it?». Erasing the proof of erasure alongside the data is how a retention
        # promise becomes unevidenceable (Art. 5(2) accountability); they hold an address and an act,
        # never the catalogue or the conversation.
        counts["tenants"] = _n_status(await con.execute(
            "delete from tenants where slug = $1 and status = 'test' and provisioned_via = 'demo'",
            slug))
    return counts


async def _drop_intakes_of(con, slug: str) -> int:
    """Every `catalogue_intake` row for one tenant, bytes first (the unlink-then-row order the
    generic pass uses, for the same reason: an orphan row is retried, orphan bytes are forever)."""
    import shutil as _sh
    from pathlib import Path as _P

    from brain import onboarding as _ob
    rows = await con.fetch("select id, raw_ref from catalogue_intake where tenant_id = $1", slug)
    for r in rows:
        ref = str(r["raw_ref"] or "")
        try:
            d = _P(ref).resolve().parent if ref else None
            if d is not None and d.is_relative_to(_ob._INTAKE_DIR.resolve()):
                _sh.rmtree(d, ignore_errors=True)
        except Exception:
            log.debug("demo reap: could not unlink intake %s", ref, exc_info=True)
    if not rows:
        return 0
    return _n_status(await con.execute(
        "delete from catalogue_intake where id = any($1::text[])", [r["id"] for r in rows]))


def _n_status(status: Any) -> int:
    """asyncpg's `DELETE 7` command tag → 7."""
    return int(str(status or "").rsplit(" ", 1)[-1] or 0)


async def _orphan_pass_sound(con) -> bool:
    """May the ORPHAN-DIRECTORY pass run against the database on this connection?

    A STRUCTURAL GUARD, added 2026-08-09 after the vital for this file nearly proved the hazard the
    flag's own docstring describes. `MEDIA_DIR` belongs to the BOX; `catalogue_intake` belongs to
    the DATABASE. «This directory is an orphan» is only a sound inference when the two are the same
    deployment — point the sweep at a rehearsal clone (whose `catalogue_intake` is empty by
    construction) and EVERY production intake on disk answers «no row names me».
    `sweep_orphans=False` by default was the whole defence, and a default is not a fence: one
    `reap(sweep_orphans=True)` in a test, a console or a future caller and real bytes are gone.

    THE PAIR THAT MAKES IT SOUND, and either half is enough:
      · THIS DATABASE IS THE BOX'S OWN — read out of the live env file, not out of this process
        (comparing a process to itself proves nothing). Then the bytes under its MEDIA_DIR are the
        ones this `catalogue_intake` describes, and the inference holds. This is the systemd unit.
      · THE DIRECTORY IS NOT THE BOX'S — a caller that has repointed `_INTAKE_DIR` somewhere of its
        own (every vital that touches this does) is sweeping bytes it owns, and production's are not
        in the conversation at all.
    Only the dangerous combination is refused: SOMEBODY ELSE'S DATABASE, THE BOX'S BYTES. No env
    file to compare against → allow; a box without /opt/rocoto/.env is not this deployment."""
    try:
        dbname = str(await con.fetchval("select current_database()") or "")
    except Exception:
        return False
    from pathlib import Path as _P
    want_db, want_media = "", ""
    try:
        envf = _P(os.getenv("ROCOTO_ENV_FILE", "/opt/rocoto/.env"))
        if envf.exists():
            for line in envf.read_text().splitlines():
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not want_db:
                    want_db = line.split("=", 1)[1].strip().rsplit("/", 1)[-1].split("?")[0]
                elif line.startswith("ROCOTO_MEDIA_DIR=") and not want_media:
                    want_media = line.split("=", 1)[1].strip()
            want_media = want_media or "/opt/rocoto/media"
    except Exception:
        want_db, want_media = "", ""
    if not want_db:
        return True
    if dbname == want_db:
        return True
    try:
        from brain import onboarding as _ob
        here = _ob._INTAKE_DIR.resolve()
        if not here.is_relative_to(_P(want_media).resolve() / "intake"):
            return True                       # not the box's bytes — nothing of production at risk
    except Exception:
        pass
    log.info("demo reap: orphan pass SKIPPED — db %r is not this box's %r, and the intake directory "
             "IS the box's (MEDIA_DIR belongs to the box, catalogue_intake to the database)",
             dbname, want_db)
    return False


async def reap(limit: int = 2000, *, sweep_orphans: bool = False) -> dict[str, int]:
    """Drop what the demo left behind. Returns a per-table count; never raises.

    `sweep_orphans` DEFAULTS OFF, and the default is a safety property rather than a preference.
    The orphan pass deletes directories under `MEDIA_DIR/intake` that no row in THIS database
    names — which is only a sound inference when this database is the one that wrote them.
    `MEDIA_DIR` belongs to the BOX, not to the database, so a vital pointed at a rehearsal clone
    sees an empty `catalogue_intake` and would conclude that every production intake on disk is an
    orphan. Only `demo_reap.py` (the systemd unit, running from /opt/rocoto with the live .env) and
    `maybe_reap()` (inside the live process) turn it on."""
    out = {"sessions": 0, "links": 0, "intakes": 0, "orphan_dirs": 0, "tenants": 0}
    try:
        await ensure_demo_schema()
    except Exception:
        log.debug("demo reap: schema ensure fail-soft", exc_info=True)
        return out

    _n = _n_status

    # ONE try PER PASS, not one around both (2026-08-09). `demo_magic_links` is created lazily by
    # `demo_auth.ensure_schema`, which this module never calls — so on a box where nobody has asked
    # for a link yet, a shared try meant the missing table also cancelled the SESSION delete, and
    # `reap_preview` reported a flat row of zeros for everything. A dry run that answers «nothing to
    # delete» because of an unrelated absent table is worse than one that errors.
    try:
        async with db.get_pool().acquire() as con:
            out["sessions"] = _n(await con.execute(
                "with dead as (select token from demo_sessions "
                "  where expires_at is not null and expires_at < now() limit $1) "
                "delete from demo_sessions s using dead d where s.token = d.token", limit))
    except Exception:
        log.debug("demo reap: sessions fail-soft", exc_info=True)
    try:
        async with db.get_pool().acquire() as con:
            # a link is dead the moment it is consumed or expired; a day's grace so a support
            # question («did that link ever arrive?») is still answerable the next morning.
            out["links"] = _n(await con.execute(
                "with dead as (select token_hash from demo_magic_links "
                "  where expires_at < now() - interval '1 day' "
                "     or consumed_at < now() - interval '1 day' limit $1) "
                "delete from demo_magic_links l using dead d "
                "where l.token_hash = d.token_hash", limit))
    except Exception:
        log.debug("demo reap: links fail-soft (the table is created by demo_auth, lazily)",
                  exc_info=True)

    # the intake BYTES, then the row. Order matters: unlink first and the worst case is an orphan
    # row pointing at nothing (harmless, retried next pass); drop the row first and the bytes are
    # unreachable forever, which is the leak this exists to stop.
    try:
        import shutil as _sh
        from pathlib import Path as _P

        from brain import onboarding as _ob
        await _ob.ensure_intake_schema()
        async with db.get_pool().acquire() as con:
            dead = await con.fetch(
                "select id, raw_ref from catalogue_intake "
                "where expires_at is not null and expires_at < now() limit $1", limit)
            for r in dead:
                ref = str(r["raw_ref"] or "")
                try:
                    # the per-intake directory, and ONLY if it really sits under MEDIA_DIR/intake.
                    # `raw_ref` is a path this process wrote, but a delete that trusts a database
                    # string is one bad row away from being an arbitrary rmtree.
                    d = _P(ref).resolve().parent if ref else None
                    if d is not None and d.is_relative_to(_ob._INTAKE_DIR.resolve()):
                        _sh.rmtree(d, ignore_errors=True)
                except Exception:
                    log.debug("demo reap: could not unlink %s", ref, exc_info=True)
            if dead:
                out["intakes"] = _n(await con.execute(
                    "delete from catalogue_intake where id = any($1)", [r["id"] for r in dead]))

            # ORPHAN DIRECTORIES — bytes with no row at all. Measured on prod 2026-08-09: 76 of
            # them under /opt/rocoto/media/intake, against a `catalogue_intake` table that does not
            # even exist in that database. They come from runs whose rows lived in a rehearsal
            # clone (MEDIA_DIR is the box's, not the database's) and from any create_intake whose
            # row was later dropped. A reaper that walks ROWS can never reach them, so it walks the
            # DIRECTORY too — anything past the TTL that no row names. See the flag's note above
            # for why this is not the default.
            cutoff = time.time() - int(_ob.INTAKE_TTL_DAYS) * 86400
            root = _ob._INTAKE_DIR
            if sweep_orphans and root.is_dir() and await _orphan_pass_sound(con):
                known = {r["id"] for r in await con.fetch("select id from catalogue_intake")}
                for d in list(root.iterdir())[:limit]:
                    try:
                        if not d.is_dir() or d.name in known or d.stat().st_mtime > cutoff:
                            continue
                        _sh.rmtree(d, ignore_errors=True)
                        out["orphan_dirs"] = out.get("orphan_dirs", 0) + 1
                    except Exception:
                        log.debug("demo reap: orphan dir %s", d, exc_info=True)
    except Exception:
        log.debug("demo reap: intake fail-soft", exc_info=True)

    # THE WORLDS. Two rungs, one selection (`_reapable_tenants`), one world at a time so a failure
    # on one leaves the others untouched — and, within a world, the runtime data before the tenant
    # row, so a failure between them leaves the world still SELECTABLE and simply retried.
    try:
        async with db.get_pool().acquire() as con:
            for row in await _reapable_tenants(con, limit=200):
                slug, rung = row["slug"], row["rung"]
                try:
                    if rung == "provisioned_demo":
                        counts = await _drop_demo_world(con, slug)
                        dropped = int(counts.get("tenants") or 0)
                    else:
                        # the LEGACY anonymous world: nothing mints these any more, and they never
                        # had an operator, a catalogue or an intake — the three rows below are the
                        # whole of what one is, and none of them is behind the RLS fence, so the
                        # owner connection really can delete them. Its delete keeps `seeded is true`
                        # in the statement itself, so even a mis-selected slug cannot take a real
                        # org.
                        async with con.transaction():
                            await con.execute(
                                "delete from sup_session where tenant_slug = $1", slug)
                            await con.execute(
                                "delete from team_members where tenant_slug = $1", slug)
                            await con.execute("update operators set active_tenant = null "
                                              "where active_tenant = $1", slug)
                            counts = {"tenants": _n(await con.execute(
                                "delete from tenants where slug = $1 and seeded is true "
                                "and status = 'test'", slug))}
                        dropped = int(counts["tenants"])
                except Exception:
                    # one bad world must not cost the sweep the other twenty (§4.3's fail-soft law)
                    log.exception("demo reap: dropping %s (%s) failed — skipped", slug, rung)
                    continue
                out["tenants"] += dropped
                if dropped:
                    # ONE AUDIT ROW PER WORLD DROPPED. A retention promise nobody can evidence is
                    # the same problem as a retention promise nobody performs: when a data subject
                    # asks «did you delete it?», `sup_audit` is the answer. Non-PII by the audit
                    # spine's own rule — the slug, the rung and the row counts, never the catalogue.
                    await _audit_drop(slug, detail={"rung": rung,
                                                    "counts": {k: v for k, v in counts.items() if v}})
    except Exception:
        log.debug("demo reap: tenant fail-soft", exc_info=True)

    if any(out.values()):
        log.info("demo reap: %s", out)
        try:
            await _audit_drop("", action="demo.reap", detail=dict(out))
        except Exception:
            log.debug("demo reap: summary audit fail-soft", exc_info=True)
    return out


async def _audit_drop(slug: str, *, action: str = "demo.reap.tenant",
                      detail: Optional[dict[str, Any]] = None) -> None:
    """Append-only evidence that the sweep ran and what it took. Fail-soft and lazily imported:
    `sup_session.audit` re-raises by design on money/state actions, and a housekeeping pass must
    not die because the trail could not be written — it logs loudly instead."""
    try:
        import sup_session as _ss
        await _ss.audit("system:demo-reap", slug or "-", "", action,
                        target_id=slug or None, detail=detail or {})
    except Exception:
        log.warning("demo reap: audit row failed for %r (fail-soft)", slug, exc_info=True)


async def reap_preview() -> dict[str, Any]:
    """What `reap()` WOULD delete, deleting nothing — `python -m demo_reap --dry-run`.

    It exists because the first run of a delete against a production database should be a COUNT.
    Deliberately a separate function rather than a `dry` flag threaded through `reap()`: a delete
    path with a branch that sometimes does not delete is a delete path one bad boolean away from
    doing nothing at all, silently, for months.

    THE TENANT HALF IS NOT A SECOND PREDICATE ANY MORE (2026-08-09). It calls `_reapable_tenants`,
    the SAME function `reap()` calls, and returns the SLUGS as well as the count under `worlds` —
    because «5» is not something a human can check before pressing a button that deletes tenants,
    and a preview computed by a hand-copied WHERE clause is evidence about the copy, not the sweep."""
    out: dict[str, Any] = {"sessions": 0, "links": 0, "intakes": 0, "orphan_dirs": 0,
                           "tenants": 0, "worlds": []}
    # EVERY LINE IS INDEPENDENTLY FAIL-SOFT, for the reason `reap()` now is: this used to be ONE
    # try, and a missing `demo_magic_links` (created lazily by demo_auth, not by this module) made
    # the whole preview answer «0 · 0 · 0 · 0 · 0». The dry run is what a human reads before running
    # a delete against production, so a silent all-zeros is the most dangerous shape it can take.
    async def _count(con, sql: str) -> int:
        try:
            return int(await con.fetchval(sql) or 0)
        except Exception:
            log.debug("demo reap preview: %s fail-soft", sql.split("from ")[-1][:40], exc_info=True)
            return 0

    try:
        await ensure_demo_schema()
        async with db.get_pool().acquire() as con:
            out["sessions"] = await _count(con, (
                "select count(*) from demo_sessions "
                "where expires_at is not null and expires_at < now()"))
            out["links"] = await _count(con, (
                "select count(*) from demo_magic_links "
                "where expires_at < now() - interval '1 day' "
                "   or consumed_at < now() - interval '1 day'"))
            out["intakes"] = await _count(con, (
                "select count(*) from catalogue_intake "
                "where expires_at is not null and expires_at < now()"))
            worlds = await _reapable_tenants(con, limit=200)
            out["worlds"] = [f"{w['slug']} ({w['rung']})" for w in worlds]
            out["tenants"] = len(worlds)
            from brain import onboarding as _ob
            try:
                known = {r["id"] for r in await con.fetch("select id from catalogue_intake")}
            except Exception:
                known = set()
            cutoff = time.time() - int(_ob.INTAKE_TTL_DAYS) * 86400
            if _ob._INTAKE_DIR.is_dir() and await _orphan_pass_sound(con):
                out["orphan_dirs"] = sum(
                    1 for d in _ob._INTAKE_DIR.iterdir()
                    if d.is_dir() and d.name not in known and d.stat().st_mtime <= cutoff)
    except Exception:
        log.debug("demo reap preview fail-soft", exc_info=True)
    return out


async def maybe_reap() -> None:
    """Throttled housekeeping hung off the demo's own request path (demo_media.maybe_reap's shape).
    Once per process per hour, fail-soft, and never in the caller's way."""
    global _last_reap
    now = time.time()
    if now - _last_reap < _REAP_EVERY_S:
        return
    _last_reap = now
    try:
        # inside the live process, so `catalogue_intake` IS the table that wrote these bytes
        await reap(sweep_orphans=True)
    except Exception:
        log.debug("demo maybe_reap fail-soft", exc_info=True)
