"""provisioning.py — AN EMAIL BECOMES A WORKSPACE. One writer, two doors (§17.17, §17.56c).

Extracted, not invented: every line below was living inline in `sup_api.sup_alta` and is now the ONE
place that turns a verified address into the three rows a Rocoto account IS —

    tenants(slug, name, status='test')   the world
    operators(id, email, name, …)        the person
    team_members(operator_id, slug,      the membership that `sup_session.resolve_membership`
                 role='owner')           reads back, and therefore what a session can ever claim

WHY IT MOVED OUT OF sup_api. §17.56c makes the /demo sign-in mint a real tenant, so there are now
TWO doors onto the same act (the alta CTA and the demo). Copy-pasting the block would have made a
FOURTH tenant-insert in this codebase, and the failure mode of a divergent copy is silent and
permanent: a workspace minted through one door that the other door's assumptions do not hold for —
a missing `team_members` row means `resolve_membership` returns None and the operator can sign in
nowhere, a missing `operators` row means the same, a slug minted without the collision loop means
an `insert` that raises on the second person called Pedro. So: one function, two callers, and
sup_alta's observable behaviour is byte-identical to what it was (same slug derivation, same
suffixing, same name text, same op_id shape, same column set, same one transaction).

WHAT THIS FILE DELIBERATELY DOES **NOT** DO:
  · It does not decide WHO may provision. That is the door's job — the alta checks
    `ROCOTO_SELF_SERVE` and a Google-matched OAuth identity; the demo checks its own gate. A leaf
    that decided policy would make the policy invisible at the call site.
  · It does not mint a session. `sup_session.mint` is the session world's writer and stays there.
  · It does not seed anything. `status='test'` with an EMPTY world is the honest start (§17.13);
    the catalogue arrives through the intake family, from the operator's own file.
  · It never sets `seeded=true`. That flag marks a world the reaper may DROP; a real person's
    account — even one that exists only to try the demo — is nobody's to drop. The reapable rung is
    the ANONYMOUS `demo_<sid>` tenant demo_flow mints, which is a different thing with a different
    lifetime.

es-ES for anything a human reads; en for code. Nothing here is user-facing — the doors write the
sentences, because only they know which door refused.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

import db

log = logging.getLogger("rocoto.provisioning")


def alta_slug(email: str) -> str:
    """The email's handle, made slug-safe. VERBATIM `sup_api._alta_slug` — moved, not rewritten.

    Hyphens survive on purpose (`peter.a` → `peter-a`): the slug is minted ONCE and then lives in
    URLs and in ltree paths forever, and PG16 accepts a hyphen in an ltree label (asserted by
    tests/vital_scope_shape.py against the live `casa-vega`). Changing this derivation is a
    URL-breaking change for every tenant already provisioned, so it does not move."""
    base = re.sub(r"[^a-z0-9_-]", "-", ((email or "").split("@")[0] or "negocio").lower()).strip("-") or "negocio"
    return base[:32]


async def membership_of(con, email: str) -> Optional[str]:
    """The tenant this address already belongs to, or None. The ONE-IDENTITY check (§17.33): a second
    workspace minted from a mis-click strands the person, because `resolve_membership` picks ONE and
    they will not understand which. Both doors ask this before provisioning; they answer it
    differently (the alta refuses with a 409, the demo RESUMES) and that difference is the product
    decision, so it lives at the doors.

    `order by tm.created_at asc` is NOT decoration (2026-08-09 security review, F1). A bare `limit 1`
    over a person with two memberships returns whichever row the planner reached first, so the SAME
    address could resume into a DIFFERENT workspace on two consecutive sign-ins — and `resolve_membership`
    already orders deterministically (active_tenant first, then `tm.created_at asc`), so an
    undetermined answer here contradicts the session layer it feeds. Earliest membership wins, which
    is the same tiebreak the session uses. `lower(o.email)` matches `resolve_membership`'s predicate
    exactly, so the two cannot disagree about which rows belong to an address."""
    return await con.fetchval(
        "select tm.tenant_slug from team_members tm join operators o on o.id = tm.operator_id "
        "where lower(o.email) = $1 order by tm.created_at asc limit 1",
        (email or "").strip().lower())


async def _unique_slug(con, email: str) -> str:
    """`alta_slug`, suffixed only on collision (-2, -3, …), capped at 40. The loop is not a race-free
    reservation and does not pretend to be: the `tenants.slug` PK is what actually decides, and the
    insert below runs inside the caller's transaction, so the loser of a genuine tie raises rather
    than silently sharing a world. At this traffic that tie has never happened; the honest note is
    here so nobody reads the loop as a lock."""
    base = alta_slug(email)
    slug = base
    n = 1
    while await con.fetchval("select 1 from tenants where slug = $1", slug):
        n += 1
        slug = f"{base}-{n}"[:40]
    return slug


def _person_of(email: str) -> tuple[str, str, str]:
    """(handle, display person, fallback business name) — sup_alta's derivation, unchanged. The name
    is the FALLBACK the operator renames in Empresa (or that WhatsApp overwrites at go-live); it
    exists so no screen has to render an empty title. §17.56d③ supersedes it whenever the person
    actually told us their company at sign-in."""
    handle = (email or "").split("@")[0]
    person = handle.replace(".", " ").replace("_", " ").title()
    return handle, person, f"El negocio de {person.split(' ')[0]}"


# The longest thing a Spanish trading name plausibly is, plus room. Cap, never truncate silently
# into nonsense — `clean_company` returns '' for anything unusable and the caller falls back.
COMPANY_MAX = 120


def clean_company(name: str) -> str:
    """§17.56d③ — trim, collapse runs of whitespace, drop control characters, cap the length.

    AND NOTHING ELSE. No accent folding, no ñ→n, no case normalisation, no stripping «S.L.» or
    «, S.A.U.» — a Spanish company name IS the accents and the legal form, and this string goes
    straight onto the top bar of a WhatsApp thread the person is about to recognise as their own.
    Store what they typed. Returns '' when there is nothing usable left, which is the caller's cue
    to fall back — never a placeholder minted here."""
    s = "".join(ch for ch in (name or "") if ch.isprintable() or ch == " ")
    s = " ".join(s.split())
    return s[:COMPANY_MAX].strip()


def company_fallback(email: str) -> str:
    """When no company was given (§17.56d③: «never show a placeholder»). The email's DOMAIN is the
    better guess than the local part — `pedidos@carnicasaldonza.es` is a business, `pedidos` is not —
    so the domain wins whenever it is not a consumer mailbox provider. Title-cased because it is
    going on a top bar, and this is a guess the operator is invited to correct."""
    e = (email or "").strip().lower()
    handle, _, domain = e.partition("@")
    host = (domain or "").split(".")[0]
    _CONSUMER = {"gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "msn", "protonmail",
                 "proton", "gmx", "aol", "me", "telefonica", "movistar"}
    if host and host not in _CONSUMER:
        return host.replace("-", " ").title()[:COMPANY_MAX]
    person = (handle or "negocio").replace(".", " ").replace("_", " ").title()
    return f"El negocio de {person.split(' ')[0]}"[:COMPANY_MAX]


async def _operator_id_for(con, email: str) -> str:
    """The `operators.id` for a VERIFIED address — the existing one, or a globally unique new one.

    THIS IS THE FIX FOR THE 2026-08-09 REVIEW'S F1, AND IT IS THE WHOLE OF IT. The line it replaces
    was `op_ + re.sub(r'[^a-z0-9]', '_', email.split('@')[0])[:24]` — the DOMAIN was discarded, so
    `pedidos@evil.tld` and `pedidos@carnicasaldonza.es` derived the SAME primary key. Paired with an
    `on conflict (id) do update`, one stranger with one mailbox at a domain they own could seize an
    existing operator row: repoint its `active_tenant` at a workspace they controlled, and (because
    the `team_members` PK is the PAIR) add themselves as `owner` of the victim's. `op_peter` — minted
    on every boot by `brain.teams.ensure_seed` — was squattable by anyone registering `peter@…`, and
    `ensure_seed`'s self-heal is `coalesce(active_tenant, …)`, which cannot repair a poisoned
    non-null value. Until §17.56c this derivation only ran behind `ROCOTO_SELF_SERVE` (off); the
    public /demo door is what turned a latent hazard into an unauthenticated takeover.

    So: LOOK THE ADDRESS UP FIRST and reuse the id it already has. Mint only when absent, through
    `brain.teams._mint_id` — `op_<handle>_<token_hex(3)>`, whose own comment says the random tail
    exists precisely to stop «two people who share a local part across domains» colliding. Reusing
    that function rather than inventing a third id scheme is deliberate: two derivations of the same
    key is how this class of bug comes back.

    Imported inside the function on purpose — `brain.teams` imports `sup_session`, which imports
    `brain.auth`; keeping the edge lazy means the identity organs cannot deadlock each other's
    module init on a boot-order change."""
    from brain import teams as _teams
    e = (email or "").strip().lower()
    existing = await con.fetchval("select id from operators where lower(email) = $1", e)
    if existing:
        return existing
    return _teams._mint_id(e)


# The two doors, spelled once. `tenants.provisioned_via` records WHICH ONE minted a world, because
# the /demo retention promise («máximo 90 días si no llegamos a trabajar juntos») can only be
# performed against a population the reaper can NAME. Before 2026-08-09 the reaper inferred it from
# the slug (`demo\_%`), and since this function derives the slug from the EMAIL, it named nothing:
# the sweep matched zero rows while two live public pages said data self-deletes. A marker written
# by the door that knows the answer cannot drift from a pattern that guesses it.
VIA_DEMO = "demo"
VIA_ALTA = "alta"


async def provision(con, email: str, company: str = "", *, via: str = "") -> dict[str, Any]:
    """Mint the workspace for `email` inside the CALLER's connection, in ONE transaction.

    `via` is the DOOR (VIA_DEMO | VIA_ALTA | '' for a caller that will not say). It is recorded on
    the tenant row and is read by exactly one consumer — `demo_flow.reap`, which may drop a
    `provisioned_via='demo'` world that never went live and may never drop anything else. It is
    deliberately NOT a policy input anywhere else: a door is a fact about how a world started, not a
    permission, and the moment it starts gating features it stops being safe to reap on.

    Returns {slug, op_id, name, person, role}. Raises if the address already has a membership — the
    caller must have asked `membership_of` first and decided what that means (refuse vs resume); a
    provisioner that silently returned the existing tenant would make «did I just create a world?»
    unanswerable at the call site.

    `company` (§17.56d③) sets `tenants.name` and NOTHING ELSE — in particular NOT the slug. The slug
    stays email-derived because that is what the alta already does, it is minted once and lives in
    URLs forever, and a second derivation convention would mean two tenants provisioned through two
    doors get differently-shaped identities for no gain. Absent/unusable → `company_fallback`, never
    a placeholder.

    `operators` is upserted rather than inserted because the row may already exist from an earlier
    identity touch (brain.auth mints operator rows on other rails); `team_members` is a plain insert
    because reaching here with a membership is the caller's bug, and it should say so.

    IDENTITY IS THE VERIFIED ADDRESS. See `_operator_id_for` — this used to derive the primary key
    from the email's LOCAL PART, which was a cross-tenant account takeover the moment §17.56c put a
    public door in front of it."""
    e = (email or "").strip().lower()
    if not e:
        raise ValueError("provision: empty email")
    slug = await _unique_slug(con, e)
    _handle, person, name = _person_of(e)
    given = clean_company(company)
    if given:
        name = given
    async with con.transaction():
        # the test_account transaction, WITHOUT seeded=true: a real signup is nobody's to drop,
        # and its world starts honestly EMPTY (§17.13's explore: nothing configured, nothing
        # demanded — the panel's empty states are the design, not a gap)
        await con.execute(
            "insert into tenants(slug, name, status, provisioned_via) values($1,$2,'test',$3)",
            slug, name, (via or "").strip().lower() or None)
        candidate = await _operator_id_for(con, e)
        # ON CONFLICT (email), NEVER (id). The unique key that means «the same person» is the
        # VERIFIED ADDRESS; the id is an internal handle. Conflicting on the id meant a stranger who
        # merely controlled a mailbox with the right local part took over the existing row — this
        # statement makes that failure a raise (PK violation) instead of a silent DO UPDATE.
        op_id = await con.fetchval(
            "insert into operators(id, email, name, is_founder, active_tenant) "
            "values($1,$2,$3,false,$4) "
            "on conflict (email) do update set active_tenant = excluded.active_tenant, "
            "  updated_at = now() "
            "returning id",
            candidate, e, person, slug)
        if not op_id:
            raise RuntimeError(f"provision: operators upsert returned no id for {e}")
        await con.execute(
            "insert into team_members(operator_id, tenant_slug, role) values($1,$2,'owner')",
            op_id, slug)
    log.info("provisioned workspace slug=%s op=%s for %s", slug, op_id, e)
    return {"slug": slug, "op_id": op_id, "name": name, "person": person, "role": "owner"}


async def resume_or_provision(email: str, company: str = "", *, via: str = VIA_DEMO) -> dict[str, Any]:
    """The DEMO's door onto the same act (§17.56c): one operator, one workspace, forever.

    Returns {slug, role, created, status, name, onboarded}. `onboarded` (§11, PEDIDOS-PRICING-
    BUILD.md, 2026-08-11) is `tenants.onboarded_at is not null` — the SAME fact `sup_api._wire_session`
    already puts on the panel session for every other sign-in door. `demo_auth._wire` had never
    carried it at all, so `parseSupSession`'s `onboarded: bool(r.onboarded, true)` silently DEFAULTED
    TO TRUE for anyone provisioned through this door — invisible while every /demo Google/magic sign-
    in landed on `/demo/catalog`, a route outside the Gate that never reads the flag, and only
    reachable now that a `/plan`-routed signup can land back inside the Gate with `onboarded` unset. A
    brand-new tenant is never onboarded by construction (`onboarded_at` is null the moment `provision`
    inserts the row); a resumed one reads the real column. `created` is the honest bit the caller needs —
    a returning operator RESUMES the tenant they already have (never a second one, never a demo
    tenant layered over a live one), and a first-timer gets one minted. The role is read back from
    the membership rather than assumed, because a person invited into someone else's team as
    `staff` must not be handed `owner` by walking in through /demo.

    ON A RESUME, `company` DOES NOT OVERWRITE A NAME THE OPERATOR CHOSE. It fills one in only when
    the stored name is still an auto-derived fallback — a sign-in must never silently rename a
    workspace somebody renamed in Empresa, and «I typed my company again at the second sign-in» is
    not an instruction to undo that. Correcting a typo is `rename` below, which is explicit.

    A RESUME NEVER RE-MARKS `provisioned_via`, in either direction. Signing into an existing
    workspace through /demo does not make it a demo world (it may be a paying customer taking a
    second look), and it does not clear a marker either — the door that MINTED the world is a
    historical fact, and the reaper's other conditions (go-live, the window) are what decide."""
    e = (email or "").strip().lower()
    given = clean_company(company)
    async with db.get_pool().acquire() as con:
        slug = await membership_of(con, e)
        if slug:
            row = await con.fetchrow(
                "select t.name, t.status, t.onboarded_at, tm.role, o.is_founder from tenants t "
                "join team_members tm on tm.tenant_slug = t.slug "
                "join operators o on o.id = tm.operator_id "
                "where t.slug = $1 and o.email = $2", slug, e)
            role = ("founder" if (row and row["is_founder"])
                    else ((row["role"] if row else None) or "staff"))
            name = (row["name"] if row else "") or ""
            if given and (not name or name in _auto_names(e)):
                await con.execute("update tenants set name = $2, updated_at = now() "
                                  "where slug = $1", slug, given)
                name = given
            return {"slug": slug, "role": role, "created": False,
                    "status": (row["status"] if row else "test") or "test",
                    "name": name or company_fallback(e),
                    "onboarded": bool(row and row["onboarded_at"] is not None)}
        out = await provision(con, e, company=given, via=via)
    # a freshly minted tenant has no `onboarded_at` by construction — `provision` never sets it
    return {"slug": out["slug"], "role": "owner", "created": True, "status": "test",
            "name": out["name"], "onboarded": False}


def _auto_names(email: str) -> set[str]:
    """The names this file can produce on its own. A stored name in this set was never chosen by a
    human, so `resume_or_provision` may replace it; anything else is theirs and is left alone."""
    _, _, derived = _person_of(email)
    return {derived, company_fallback(email), "Demo — tus productos"}


async def rename(slug: str, company: str) -> str:
    """Correct the company name (§17.56d③: «somebody will typo their own company name and it is on
    screen for the rest of the demo»). Returns the stored name, or '' if the input was unusable —
    the caller refuses out loud rather than writing an empty top bar."""
    given = clean_company(company)
    if not given or not slug:
        return ""
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set name = $2, updated_at = now() where slug = $1",
                          slug, given)
    log.info("tenant %s renamed to %r", slug, given)
    return given
