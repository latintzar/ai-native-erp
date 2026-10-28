"""tenancy.py — scope→tenant resolution, KERNEL-owned (kernel-boundary pass, 2026-07-22).

The runtime scope for a tenant's customer is `t.<slug>.c.<id>`; commerce read-models
(catalogue_skus, catalogue_directory) are keyed by tenant_id. This tiny category is what lets kernel
organs (lifecycle, directory) reason about tenancy WITHOUT importing the commerce stack.

2026-07-27 — THE INBOUND DOOR (multi-tenancy pass). `tenant_of` answers "whose world is this scope?".
This module now also answers the question the WhatsApp webhook has to ask BEFORE a scope exists:
"whose NUMBER did this message arrive on?". Meta's payload already carries
`value.metadata.phone_number_id` — the business line the message landed on, which IS the tenant key —
and until now nothing read it, so every inbound on every rail was processed as `config.BRAIN_TENANT`.

THE FALLBACK IS THE PRODUCT DECISION, not a shortcut: an unrecognised number resolves to
BRAIN_TENANT and is LOUD (an ops event + a dead_letter row, once per number), never dropped and
never guessed. A fail-closed resolver on a webhook is a silent outage on Peter's own line — today
`tenants.rocoto.wa_phone_number_id` may still be unset, and refusing there would drop 100% of his
traffic. Loud-and-serve is the only posture a live number survives.
"""
from __future__ import annotations

import logging
import time
from typing import Optional, Tuple

import config

log = logging.getLogger("rocoto.tenancy")

# in-proc resolver cache: phone_number_id → (slug, known). The webhook is hot and the tenant registry
# is tiny and near-immutable; a miss costs one indexed read per TTL. Single-worker invariant holds.
_WA_TTL = float(config._env("ROCOTO_TENANT_CACHE_TTL", "60") or "60")
_wa_cache: dict[str, tuple[float, str, bool]] = {}
_shouted: set[str] = set()          # numbers we have already dead-lettered this process


# ── THE SCOPE SHAPE — one home, three helpers (WP-A1 phase E, 2026-08-06) ────────────────────────
# Read A1-TENANT-SCOPE-CUTOVER.md before touching these. They live in THIS module because it is the
# leaf that already owns scope parsing (`tenant_of` below) and imports nothing but config, so every
# organ can reach them without an import cycle.
#
# A WhatsApp party's scope is moving from FLAT to TENANT-PATHED:
#
#     wa.<digits>            →   t.<slug>.wa.<digits>
#
# because a flat scope is ONE row per phone, so two distributors who share a customer share one
# `scope_node` row — and its `tenant_slug` can only hold one value. Sharing a customer is the normal
# shape of a food market, and today it means those two distributors share that customer's MEMORY
# (vital_multitenant §⑧ states this as the one thing that pass did not close).
#
# THE RULE THIS INTRODUCES: no module spells a scope. Not `f"wa.{d}"`, not `startswith("wa.")`,
# not `scope.split(".", 1)[1]`. Everything goes through the three functions below, because the
# failure mode of a hand-spelled scope is SILENT: `"t.rocoto.wa.34…".startswith("wa.")` is False,
# so the reply address is never derived and the action goes out with no addressee, the lifecycle
# branch simply never runs, the phone resolves to "". Nothing raises. Nothing logs.
#
# During the cutover BOTH shapes are READ and only the flat one is WRITTEN; phase M flips the
# writer (one line, here), phase C deletes the flat branch. See §5 of the design doc.


def is_wa_scope(scope: str) -> bool:
    """Is this scope a WhatsApp party? True for BOTH shapes, for the length of the cutover."""
    s = scope or ""
    return s.startswith("wa.") or ".wa." in s


def phone_of_scope(scope: str) -> str:
    """The E.164 a WhatsApp scope encodes, from either shape — or '' if it encodes none.

    The scope IS the number for a wa party, which is why this can answer without a query — that is
    what every `"+" + scope.split(".", 1)[1]` in the codebase was doing by hand. Returns '' rather
    than a half-parsed guess for any other shape, so a caller that forgets to check `is_wa_scope`
    gets an empty string it has to handle, never a fragment of another party's number.
    """
    s = scope or ""
    _, sep, tail = s.rpartition(".wa.")
    if sep:
        return ("+" + tail.split(".", 1)[0]) if tail else ""
    if s.startswith("wa."):
        d = s[3:].split(".", 1)[0]
        return ("+" + d) if d else ""
    return ""


# PHASE M's SWITCH. Off by default: the flip is a deploy of its own, after the history rewrite
# (backfill_20260806_scope_pathed.sql) has run on the same box. With it off, this module behaves
# exactly as phase E shipped it — which is what lets the flag be deployed long before it is turned on.
SCOPE_PATHED = (config._env("ROCOTO_SCOPE_PATHED", "") or "").strip() == "1"


def scope_of(phone: str, tenant: Optional[str] = None) -> str:
    """Build a WhatsApp party's scope.

    OWNERSHIP DECIDES THE SHAPE, and a missing tenant is NOT a reason to invent one:

        scope_of("+34600111222", "rocoto")  →  t.rocoto.wa.34600111222   (owned)
        scope_of("+34600111222")            →  wa.34600111222            (nobody owns it yet)

    Defaulting an absent tenant to BRAIN_TENANT would be the single most dangerous line in this
    cutover: ~59 of the 137 audited call sites reach here with no tenant in hand, and quietly
    stamping the deployment tenant onto all of them would mis-attribute other tenants' parties
    with nothing raised and nothing logged. An unowned scope is the honest answer — it is a real,
    supported shape (the try-chat rail lives there), and `bind_scope_tenant` already adopts such a
    party into its tenant on the next inbound, without a migration.

    See A1-TENANT-SCOPE-CUTOVER.md §3 and audits/2026-08-06-a1-scope-callsites.md.
    """
    d = _digits(phone)
    if SCOPE_PATHED and tenant:
        return f"t.{tenant}.wa.{d}"
    return f"wa.{d}"


def _digits(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())


def has_identity(phone: str) -> bool:
    """Does this caller/sender string identify ANYONE? «anonymous», «unknown», «Restricted», «» and
    «+» all answer no — they are the network saying it has no number to give, not a number."""
    return bool(_digits(phone))


def party_scope(phone: str, tenant: Optional[str] = None, *, fallback_key: str = "") -> str:
    """THE SAFE PARTY-SCOPE BUILDER — use this at every webhook entry, not `scope_of`.

    `scope_of` is a pure function of the digits, and for a caller with NO digits it therefore
    returns the same string every time: `wa.` (or `t.<slug>.wa.`). That is one shared conversation,
    and every anonymous caller in Spain lands in it together — one customer's name, order history
    and standing facts read back to the next. Nothing raises; the merge is silent.

    It is not a rare path. 3GPP TS 22.081 §1.4 says the called party gets «an indication that the
    calling line identity is not available» whenever the signalling can't carry it, and CLIR is a
    free supplementary service any caller can invoke. On the phone rail this arrives as `From` =
    "anonymous" — a string with no digits.

    So: when the network gives us no identity, this returns a scope keyed on THIS CALL
    (`anon.<call sid>`), which is unshareable by construction. The conversation is real and fully
    recorded; it simply starts empty and ends with the call, because an unidentified caller has no
    history we are entitled to hand them.

        party_scope("+34600111222", "sitjar")                    → t.sitjar.wa.34600111222
        party_scope("anonymous", "sitjar", fallback_key="CAx1")   → t.sitjar.anon.CAx1
        party_scope("anonymous", "sitjar")                        → raises ValueError

    The missing `fallback_key` RAISES rather than falling back to the shared bucket: a caller that
    cannot name the call it is handling cannot be given a safe answer, and silently returning the
    merged scope is the exact bug this exists to remove."""
    if has_identity(phone):
        return scope_of(phone, tenant)
    key = "".join(ch for ch in (fallback_key or "") if ch.isalnum())
    if not key:
        raise ValueError(
            "party_scope: no caller identity and no fallback_key — refusing to return the shared "
            "anonymous scope (it merges every unidentified caller into one conversation)")
    return f"t.{tenant}.anon.{key}" if (SCOPE_PATHED and tenant) else f"anon.{key}"


def demo_scope(sid: str, tenant: Optional[str] = None) -> str:
    """Build a /demo session's party scope (§17.56 / §17.56c). The WRITER for the rung `tenant_of`
    reads below — one file, so the two can never drift (the same reason `scope_of` lives here).

        demo_scope("9f3a…")                →  test.demo.9f3a…            (anonymous, pre-auth)
        demo_scope("9f3a…", "casa-vega")   →  test.demo.t.casa-vega.9f3a… (signed in, THEIR tenant)

    WHY NOT `t.<slug>.wa.<digits>`, WHICH IS WHAT §17.56c ASKS FOR. Two independent reasons, both
    measured rather than assumed:

    ① `ROCOTO_SCOPE_PATHED` IS OFF ON PROD, DELIBERATELY (BUILD-CONCERNS #2: turning it on still
       fails four `pin_watch` checks, one of them nondeterministically). With the flag off,
       `scope_of(phone, tenant)` returns the FLAT `wa.<digits>` — so anything downstream that
       re-derives a party scope from its phone computes the flat shape, `tenant_of("wa.…")` answers
       BRAIN_TENANT, and a stranger's demo would ground against Peter's real catalogue. Hand-spelling
       the pathed shape here while the writer stays flat is precisely the silent half-cutover §5 of
       A1-TENANT-SCOPE-CUTOVER.md warns about. So the demo does not use a `wa.` scope at all — and it
       never needed one: a demo party has no phone (`demo_flow._fake_phone` is unroutable by
       construction) and `egress_stub=True` means the HTTP response IS the delivery.

    ② THE `test.` PREFIX IS LOad-BEARING. `runtime.run_turn` derives `lineage` from it
       (`scope.startswith("test.")`), and lineage=test is what keeps a demo's parks and drafts off
       every live review sheet. A bare `t.<slug>.…` scope would be lineage='live' — a stranger's
       experiment landing in a real work queue. So the shape carries BOTH facts: `test.` for the
       lineage, `t.<slug>` for the owner.

    The slug rides as an ltree label, which PG16 accepts hyphens in (asserted against the live
    `casa-vega` in tests/vital_scope_shape.py) — the same assumption A1's own `t.<slug>.wa.<digits>`
    already makes, so this adds no new constraint. When the operator later adds a number and goes
    live, their real WhatsApp parties are minted by the normal inbound door under phase M; this rung
    is the test-lineage world, not a competing shape for it.
    """
    s = (sid or "").strip()
    t = (tenant or "").strip()
    return f"test.demo.t.{t}.{s}" if t else f"test.demo.{s}"


def tenant_of(scope: str) -> str:
    parts = (scope or "").split(".")
    if len(parts) >= 2 and parts[0] == "t" and parts[1]:
        return parts[1]
    # WP-E (SITE-V2-PLAN.md §6): the public "Prueba la IA" widget mints scopes `test.try.<session>` —
    # they must NOT fall through to BRAIN_TENANT (that would ground a random internet visitor's chat,
    # and ANY catalogue/order lookup on it, against Peter's REAL supplier catalogue and prices — a
    # public data leak, not a demo). Narrow, explicit, additive: every other scope shape (t.*, wa.*,
    # test.persona.*, test.clone.*, prospect.*) is completely unaffected and still resolves exactly as
    # before — those consoles are internal and grounding against BRAIN_TENANT there is intentional.
    if len(parts) >= 2 and parts[0] == "test" and parts[1] == "try":
        return config.TRY_CHAT_DEMO_TENANT
    # §17.56 / §17.56c (/demo — «Prueba Rocoto con tus productos»): TWO forms, one rung, written by
    # `demo_scope` above (read its docstring for why neither is `t.<slug>.wa.<digits>`):
    #
    #   test.demo.<sid>              → demo_<sid>   LEGACY ANONYMOUS. No longer minted (2026-08-09,
    #                                               see demo_flow.py); kept because scopes written
    #                                               before that date are in the database and must
    #                                               still resolve — including for `demo_flow.reap`,
    #                                               which cannot delete a world it cannot name.
    #   test.demo.t.<slug>.<sid>     → <slug>       SIGNED IN. The operator's REAL workspace, minted
    #                                               once by provisioning.py and resumed forever.
    #
    # THE WORD «REAPABLE» USED TO APPEAR HERE AND IT WAS NOT TRUE. Nothing swept these tenants: not
    # sweep.py (scope facts only), not lifecycle.py, not any timer. `demo_flow.reap()` is the sweep
    # that claim was describing, built on 2026-08-09 and wired to `rocoto-demo-reap.timer`.
    #
    # Both mappings are derivable from the scope alone (no DB in the hot path, same as every rung
    # here). Falling through to BRAIN_TENANT would ground a stranger's chat against Peter's real
    # catalogue — the same leak the try branch exists to prevent, now per visitor.
    if len(parts) >= 3 and parts[0] == "test" and parts[1] == "demo" and parts[2]:
        # §17.56c — the SIGNED-IN form is checked FIRST because it is the longer, more specific
        # shape and the anonymous branch below would otherwise swallow it, answering `demo_t` for
        # `test.demo.t.<slug>.<sid>`. That exact bug was caught by the invariant smoke
        # (`tenant_of(demo_scope(sid, slug)) == slug`) and it is the reason the invariant is a test
        # rather than a comment: a builder and a reader in the same file still drifted.
        if len(parts) >= 5 and parts[2] == "t" and parts[3]:
            return parts[3]
        return "demo_" + parts[2]
    # §17.56d — THE PANEL'S REHEARSAL, and the worst tenant bug this file has held.
    #
    # «Modo de prueba» mints `test.sup.t.<slug>.<digits>` (sup_api.sup_testchat). It used to mint
    # `test.sup.<digits>` — a shape with NO RUNG HERE, which fell through the line below and
    # answered BRAIN_TENANT. So every rehearsal, on every account, was grounded against the
    # FOUNDER'S OWN CATALOGUE: the matcher, `approve`, `offsku`, the house style and every alias
    # the rehearsal taught all read Peter's world. It looked perfect — lines matched, prices
    # appeared — against a book that was not theirs. And `/testchat` is open on every account, so
    # a paying supplier rehearsing before a demo was reading somebody else's fish.
    #
    # The shape mirrors the signed-in demo rung above for exactly that reason: the tenant belongs
    # IN the scope, because a reader that has to be told the tenant separately is a reader that
    # will one day not be told.
    if len(parts) >= 5 and parts[0] == "test" and parts[1] == "sup" and parts[2] == "t" and parts[3]:
        return parts[3]
    return config.BRAIN_TENANT


def tenant_of_sql(scope_expr: str, fallback_param: str) -> str:
    """`tenant_of` written as SQL, so a read can filter by tenant without joining Python.

    EXACTLY the same ranking as the Python function above: the tenant in the PATH wins, everything
    else is the single-tenant fallback (which the caller binds — never a literal, so BRAIN_TENANT
    stays one source of truth). Used by the review sheet, where the row's own scope may be the only
    tenant evidence that exists (a park written before its scope_node row).

    DELIBERATELY NOT taught the test.try/test.demo rungs: every write on those scopes is
    lineage='test' (runtime.run_turn tags it off the `test.` prefix), and every caller of this SQL
    filters live rows — a demo session's parks are invisible to the review sheet by construction,
    so a rung here would be dead code that still had to be kept in step with the Python.
    """
    return (f"(case when nlevel({scope_expr}) >= 2 and subpath({scope_expr},0,1)::text = 't' "
            f"then subpath({scope_expr},1,1)::text else {fallback_param} end)")


def forget_wa_cache() -> None:
    """Drop the resolver cache (a test that inserts a tenant mid-run, or an onboarding that just
    bound a number, must not wait out the TTL)."""
    _wa_cache.clear()
    _shouted.clear()


async def _lookup(column: str, value: str) -> Optional[str]:
    import db
    pool = db.get_pool()
    if pool is None:
        return None
    async with pool.acquire() as con:
        return await con.fetchval(
            f"select slug from tenants where {column} = $1 and coalesce({column},'') <> '' limit 1",
            value)


async def _shout(kind: str, value: str, resolved: str) -> None:
    """An inbound we could not attribute. LOUD once per (kind,value) per process: an ERROR line the
    journal greps for + a dead_letter row so the question "did Meta send it, and where did it go?"
    is answerable after the fact. Never raises — the door must still answer 200."""
    key = f"{kind}:{value}"
    if key in _shouted:
        return
    _shouted.add(key)
    log.error("TENANT UNKNOWN: inbound arrived on %s=%r which is in no tenants row — "
              "serving it as %r (the single-tenant fallback). Bind it: "
              "update tenants set wa_phone_number_id=... where slug=...", kind, value, resolved)
    try:
        import json as _json

        import db
        pool = db.get_pool()
        if pool is None:
            return
        async with pool.acquire() as con:
            await con.execute(
                "insert into dead_letter(source,reason,raw,problem) values($1,$2,$3,$4)",
                "tenancy", f"unknown_{kind}",
                _json.dumps({kind: value, "served_as": resolved}),
                f"inbound on {kind}={value} matches no tenants row; served as {resolved}")
    except Exception:
        log.debug("tenancy dead_letter fail-soft", exc_info=True)


async def tenant_for_wa_number_id(phone_number_id: str, *, loud: bool = True) -> Tuple[str, bool]:
    """Meta's `value.metadata.phone_number_id` → (tenant slug, was_it_known).

    The ONLY tenant key on the cloud rail: it is the business line the customer wrote TO, so it is
    the distributor, independent of who wrote and of any scope. Unknown/absent → (BRAIN_TENANT, False)
    plus the loud trail. Fail-soft on any DB hiccup — a resolver that raises is a dead webhook."""
    pid = str(phone_number_id or "").strip()
    fallback = config.BRAIN_TENANT
    if not pid:
        return fallback, False
    hit = _wa_cache.get(pid)
    now = time.monotonic()
    if hit and now - hit[0] < _WA_TTL:
        return hit[1], hit[2]
    slug = None
    try:
        # THE CHANNEL TABLE FIRST, THE LEGACY COLUMN SECOND (2026-08-17). `channel_number` is where a
        # tenant's numbers live once they have run Connect; `tenants.wa_phone_number_id` still
        # answers for the one number that predates the table, so this is additive and the old rail
        # keeps working untouched while callers move. Both are unique on the platform id, so the two
        # can never disagree about who owns a number — only about whether they know it.
        import channels as _channels
        slug = await _channels.tenant_of_external(pid)
        if not slug:
            slug = await _lookup("wa_phone_number_id", pid)
    except Exception:
        log.debug("tenant_for_wa_number_id lookup fail-soft", exc_info=True)
        try:
            slug = await _lookup("wa_phone_number_id", pid)
        except Exception:
            log.debug("tenant_for_wa_number_id legacy lookup fail-soft", exc_info=True)
    known = bool(slug)
    out = slug or fallback
    _wa_cache[pid] = (now, out, known)
    if not known and loud:
        await _shout("wa_phone_number_id", pid, out)
    return out, known


async def tenant_for_wa_number(number: str, *, loud: bool = True) -> Tuple[str, bool]:
    """The E.164 counterpart, for rails that only know the number they were dialled on (Twilio's
    `To`). Same contract as `tenant_for_wa_number_id`."""
    num = str(number or "").strip()
    fallback = config.BRAIN_TENANT
    if not num:
        return fallback, False
    key = f"num:{num}"
    hit = _wa_cache.get(key)
    now = time.monotonic()
    if hit and now - hit[0] < _WA_TTL:
        return hit[1], hit[2]
    slug = None
    try:
        slug = await _lookup("number", num)
    except Exception:
        log.debug("tenant_for_wa_number lookup fail-soft", exc_info=True)
    known = bool(slug)
    out = slug or fallback
    _wa_cache[key] = (now, out, known)
    if not known and loud:
        await _shout("number", num, out)
    return out, known
