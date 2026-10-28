"""Operator teams — the typed contract behind multi-team operation.

An operator (a person who runs shops) belongs to one or more teams (= tenants) and operates as ONE
active team at a time. The founder is a member of every shop and toggles between them in settings. This
module owns that contract: who is in which team, with what role, and which team is currently active.
`active_tenant()` is the single resolver the rest of the brain reads to know "which shop am I acting as"
(it falls back to the configured default, so nothing breaks before the per-query migration). It is also
the natural seam for per-team pricing/plans later.

═══════════════════════════════════════════════════════════════════════════════════════════════════
§5.11.3 · ADDING A PERSON — THE DOOR THAT DID NOT EXIST (audited 2026-07-27)

Until this build there was NO WAY TO CREATE A SECOND TEAM MEMBER anywhere in the product. `/api/sup/
team` was GET-only, no screen and no CLI wrote `team_members`, and the ONLY production writer of
either table was `ensure_seed` below — which only ever writes the founder. So the new `repartidor`
role (a driver, holding exactly `deliver`) would have shipped as a role nobody could grant: a login
for Peter's first driver meant two hand-run INSERTs on prod, with no invite, no revocation, and — the
part that matters — **no audit row for the act of granting somebody access to a company's data**.
`add` / `set_role` / `remove` are that door, and the routes behind them are cap:admin + audited for
exactly that reason.

**ELEVATION IS GOOGLE-OAUTH-ONLY, AND THAT CONSTRAINT SHAPES THE WHOLE UX — DO NOT "FIX" IT.**
`brain/auth.has_matching_oauth` is the gate on both carriers (the desk cookie and the phone bearer),
because Supabase email-confirmation is OFF on this project: a password signup is AUTO-CONFIRMED, so
`email_confirmed_at` proves nothing and anyone who signed up `boss@sudistribuidora.com` with a
password would walk into that tenant. **There is therefore no non-Google door and none may be built
here.** A driver is added BY THE GOOGLE ACCOUNT ALREADY ON HIS ANDROID PHONE, and that is the whole
provisioning story. Three shapes were refused, and all three look like conveniences:
  · **AN INVITE CODE / A MAGIC LINK.** A second, weaker way into a tenant — which is the exact thing
    the OAuth gate exists to prevent. A code is bearer authority: whoever holds it is the driver.
  · **CREATING THE SUPABASE USER FOR HIM** (an admin-API signup with a temporary password). That
    mints precisely the password identity the gate refuses, so the account we created could not
    enter — a door with no handle, and a support call that ends in someone relaxing the gate.
  · **VERIFYING THE ADDRESS IS A GOOGLE ONE, HERE.** We cannot: `nombre@sudominio.es` is a perfectly
    ordinary Google Workspace address and `nombre@gmail.com` can be a password-only account. Any
    check we wrote would be a guess that rejects real drivers. So the address is stored as given
    (lowercased) and the API says out loud, in es-ES, that he must enter WITH GOOGLE — `GOOGLE_NOTE`
    on the way in, and a typed `oauth_required` refusal at `/session/login` when he later tries a
    password. Absence of proof is stated, never papered over.

THE ROLE IS NEVER COERCED. Both resolvers used to collapse an unrecognised `team_members.role` to
'staff' (read+act), which made every future role string a privilege GRANT; that is fixed at the
resolvers (DENY-ALL) and it is fixed again here, at the door: `check_role` RAISES on anything outside
the assignable set instead of picking a role for the caller. Case included — «Repartidor» is refused
rather than folded, because the resolvers match exactly and a folded string would store a role that
silently reaches nothing.

THE LAST ADMIN IS PROTECTED. A tenant whose only `admin`-capable member is demoted or removed can
never reach Ajustes again — there is no support path back that is not a hand-run INSERT on prod,
which is the state this module exists to end. `_guard` refuses it in es-ES and names the fix.
"""
from __future__ import annotations

import logging
import re
import secrets
from typing import Any, Dict, List, Optional, Tuple

import config
import db
import sup_session  # ROLE_CAPS is the ONE table of what a role may do — never re-listed here

log = logging.getLogger("rocoto.teams")

# Single operator today (the founder). When real operator auth lands, the id comes from the session.
FOUNDER_ID = config._env("ROCOTO_FOUNDER_ID")
FOUNDER_EMAIL = config._env("ROCOTO_FOUNDER_EMAIL").lower()
FOUNDER_NAME = config._env("ROCOTO_FOUNDER_NAME", "Workspace owner")


async def ensure_seed() -> None:
    """Idempotently ensure the founder operator exists, is a member of every shop, and has an active
    team. Safe on every boot; picks up tenants added since the last run."""
    if not FOUNDER_ID or not FOUNDER_EMAIL or not FOUNDER_NAME:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into operators (id, email, name, is_founder, active_tenant, seeded, updated_at)
                 values ($1,$2,$3,true,$4,true, now())
               on conflict (id) do update set email=excluded.email, is_founder=true, updated_at=now()""",
            FOUNDER_ID, FOUNDER_EMAIL, FOUNDER_NAME, config.BRAIN_TENANT)
        tenants = await con.fetch("select slug from tenants")
        for t in tenants:
            await con.execute(
                """insert into team_members (operator_id, tenant_slug, role, seeded)
                     values ($1,$2,'founder',true)
                   on conflict (operator_id, tenant_slug) do nothing""",
                FOUNDER_ID, t["slug"])
        await con.execute(
            "update operators set active_tenant=coalesce(active_tenant,$2) where id=$1",
            FOUNDER_ID, config.BRAIN_TENANT)
    log.info("teams: ensured founder + memberships (%d teams)", len(tenants))


async def list_for(operator_id: str = FOUNDER_ID) -> Dict[str, Any]:
    """The teams an operator can switch between + which one is active."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        op = await con.fetchrow("select * from operators where id=$1", operator_id)
        rows = await con.fetch(
            """select tm.tenant_slug, tm.role, t.name, t.status, t.city
                 from team_members tm join tenants t on t.slug = tm.tenant_slug
                where tm.operator_id=$1
                order by t.name""",
            operator_id)
    active = (op["active_tenant"] if op else None) or config.BRAIN_TENANT
    return {
        "operator": operator_id,
        "active": active,
        "teams": [
            {"slug": r["tenant_slug"], "name": r["name"], "role": r["role"], "status": r["status"], "city": r["city"]}
            for r in rows
        ],
    }


async def set_active(operator_id: str, slug: str) -> Dict[str, Any]:
    """Switch the operator's active team (must be a member)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        member = await con.fetchrow(
            "select 1 from team_members where operator_id=$1 and tenant_slug=$2", operator_id, slug)
        if not member:
            return {"ok": False, "reason": "not_a_member"}
        await con.execute("update operators set active_tenant=$2, updated_at=now() where id=$1", operator_id, slug)
    return {"ok": True, "active": slug}


async def active_tenant(operator_id: str = FOUNDER_ID) -> str:
    """The team the operator is currently operating as — the single resolver the brain reads instead of
    the hardcoded config.BRAIN_TENANT default. Falls back to the configured tenant."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        v = await con.fetchval("select active_tenant from operators where id=$1", operator_id)
    return v or config.BRAIN_TENANT


# ══ THE TEAM AS A DOOR (§5.11.3) ═════════════════════════════════════════════════════════════════
# The roles this door may grant — a CLOSED set, and deliberately a SUBSET of sup_session.ROLE_CAPS:
#   · owner      — the boss:   read + act + admin + deliver (Ajustes included, so he can add people)
#   · staff      — la oficina: read + act + deliver
#   · repartidor — la furgoneta: `deliver` and nothing else (§5.11.3)
# `founder` IS NOT GRANTABLE, and that is not an oversight. It is not a rank a company hands out — it
# is Rocoto's OWN seeded identity (`operators.is_founder`, written by `ensure_seed` above and re-run
# on every boot), and cap-for-cap it is identical to `owner`. So refusing it costs a tenant nothing
# and stops this route from minting the one role the seeder uses to recognise itself.
OWNER, STAFF, REPARTIDOR, FOUNDER = "owner", "staff", "repartidor", "founder"
ASSIGNABLE: Tuple[str, ...] = (OWNER, STAFF, REPARTIDOR)

# The one sentence that has to travel with every invitation, because the OAuth gate is the whole
# provisioning story (module docstring) and a boss who does not hear it will add an address that
# cannot enter and will call it a bug.
GOOGLE_NOTE = ("Dile que entre con ESE mismo correo, con «Entrar con Google». Es la única puerta: "
               "una contraseña no abre la empresa.")

# «Le he quitado el acceso» has to be TRUE the moment it is said. A cookie already minted carries the
# role stamped into it AT LOGIN and lives up to 12 h (sup_session.SESSION_TTL_S), so `set_role` and
# `remove` both hand the caller the email and the CALLER revokes (sup_session.revoke_all). It is done
# there rather than here so this module keeps taking the connection it was given and nothing else.

_MAX_NAME = 120
_MAX_EMAIL = 200
# Deliberately permissive: it rejects what is plainly not an address and nothing else. A stricter
# pattern would reject real Spanish addresses (accented domains, «+» tags, four-letter TLDs) and each
# rejection is a real driver who cannot be given a login.
_EMAIL = re.compile(r"^[^@\s,;]+@[^@\s,;.]+(?:\.[^@\s,;.]+)+$")


def _admin_roles() -> frozenset:
    """The roles that can reach Ajustes, READ OUT OF THE CAP TABLE rather than re-listed here. If a
    future role gains `admin`, the last-admin guard below starts counting it the same day — a second
    hand-maintained list is how a tenant ends up locked out of its own settings."""
    return frozenset(r for r, caps in sup_session.ROLE_CAPS.items() if "admin" in caps)


def check_role(role: str) -> str:
    """A role string → itself, or a ValueError in es-ES. **IT NEVER COERCES**, and that is the whole
    point: collapsing an unrecognised role to 'staff' is what made adding `repartidor` a privilege
    grant instead of a restriction (§5.11.3), and the fix belongs at the door as well as at the
    resolvers. Case is NOT folded either — the resolvers match exactly, so «Repartidor» would be
    stored as a role that reaches nothing at all; refused here, it can at least be explained."""
    r = (role or "").strip()
    if r in ASSIGNABLE:
        return r
    if not r:
        raise ValueError("Dime qué va a ser: owner (dueño), staff (oficina) o repartidor.")
    if r in sup_session.ROLE_CAPS:
        raise ValueError(f"«{r}» es un rol que no se da de alta desde aquí. Elige owner (dueño), "
                         "staff (oficina) o repartidor.")
    raise ValueError(f"No conozco el rol «{r}». Elige owner (dueño), staff (oficina) o repartidor.")


def check_email(email: str) -> str:
    """The address, lowercased — or a ValueError in es-ES.

    **LOWERCASING IS NOT COSMETIC.** `sup_session.resolve_membership` matches on `lower(o.email)`, so
    a row stored «Juan@Gmail.com» resolves fine — but `operators.email` is UNIQUE on the RAW string,
    so the same person added twice in two casings becomes two operators, one of which is a member of
    a tenant nobody can see in the list. One casing on the way in is what keeps the person and the
    row the same thing."""
    e = (email or "").strip().lower()
    if not e or not _EMAIL.match(e) or len(e) > _MAX_EMAIL:
        raise ValueError("Necesito el correo de Google con el que va a entrar en el móvil "
                         "(por ejemplo «nombre@gmail.com»).")
    return e


def effective_role(row: Dict[str, Any]) -> str:
    """What the RESOLVER will actually call this member — `operators.is_founder` beats
    `team_members.role`, exactly as `sup_session.resolve_membership` decides it. Reading the stored
    role alone would let this module count admins the session world does not agree with, and the
    last-admin guard would then protect a tenant that was already unprotected."""
    return FOUNDER if row.get("is_founder") else (row.get("role") or "")


def member_wire(row: Dict[str, Any]) -> Dict[str, Any]:
    """One member, in the SAME shape `GET /api/sup/team` already serves — plus `operator_id`, which
    is what makes a member addressable at all (the GET used to return name/email/role only, so there
    was no id to PATCH or DELETE). `you` is added by the route, from the SESSION's actor."""
    return {
        "operator_id": row.get("id") or "",
        "name": row.get("name") or "",
        "email": row.get("email") or "",
        # The display default mirrors the existing GET verbatim; `team_members.role` is NOT NULL
        # DEFAULT 'staff' in the schema, so this branch is unreachable in practice.
        "role": effective_role(row) or STAFF,
    }


def _mint_id(email: str) -> str:
    """'op_<handle>_<rand>' — the id shape `ensure_seed` already uses ('op_peter'). The handle comes
    off the address so a row is legible in psql at three in the morning; the random tail is what
    keeps two people who share a local part across domains from colliding on the primary key."""
    handle = re.sub(r"[^a-z0-9]+", "", (email.split("@")[0] or ""))[:20] or "member"
    return f"op_{handle}_{secrets.token_hex(3)}"


async def operator_id_for(con, tenant: str, email: str) -> str:
    """WHO IS ACTING, as an `operators.id` — the address on a session → the id every signed row in
    this product points at (`delivery_stops.delivered_by`, `delivery_settlements.recorded_by`,
    `avisos.created_by`).

    ONE QUERY FOR THE WHOLE PRODUCT, and that is the reason it lives here rather than beside each
    door. Neither session carries an operator id: the desk's cookie holds `actor_email` and the
    phone's bearer holds `email`, because both resolve a TENANCY CLAIM and not a row. So every
    surface that signs something has to make this lookup, and a second copy of it is how one door
    ends up stamping an operator of another team onto this tenant's work. **Tenant-checked through
    `team_members`**, exactly like `_member` above, so that cannot happen from any of them.

    Returns "" when we cannot say, and the direction is chosen: every column that takes this id is
    nullable, and "" means «we do not know which of your people it was» — a gap in OUR data, which is
    honest. Failing instead would let a missing membership row stop a van or refuse a boss his note,
    and no bookkeeping rule is worth that. The caller decides whether to be fail-soft about the
    lookup ITSELF (`reparto_api._operator_id` is, on a driver's path)."""
    e = (email or "").strip().lower()
    if not e or not tenant:
        return ""
    return await con.fetchval(
        "select o.id from operators o join team_members tm on tm.operator_id = o.id "
        "where lower(o.email) = $1 and tm.tenant_slug = $2 limit 1", e, tenant) or ""


async def _member(con, tenant: str, operator_id: str) -> Optional[Dict[str, Any]]:
    """One member OF THIS TENANT, or None. **Tenant-filtered by construction** — this is the only
    lookup the write paths use, so an operator_id belonging to another company simply does not
    resolve and the caller 404s honestly instead of editing somebody else's team."""
    row = await con.fetchrow(
        "select o.id, o.email, o.name, o.is_founder, tm.role from team_members tm "
        "join operators o on o.id = tm.operator_id "
        "where tm.tenant_slug = $1 and tm.operator_id = $2", tenant, operator_id)
    return dict(row) if row else None


async def _admin_ids(con, tenant: str) -> List[str]:
    """Every member of this tenant who can reach Ajustes. `is_founder` counts here for the same
    reason `effective_role` exists: it is what the resolver will say, whatever the row stores."""
    rows = await con.fetch(
        "select o.id from team_members tm join operators o on o.id = tm.operator_id "
        "where tm.tenant_slug = $1 and (o.is_founder or tm.role = any($2::text[]))",
        tenant, sorted(_admin_roles()))
    return [r["id"] for r in rows]


async def _guard(con, tenant: str, row: Dict[str, Any], *, becoming: str = "") -> None:
    """The two refusals that stop a company from locking itself out. `becoming` is the role the
    member would end up with; '' means they are being removed. RAISES in es-ES — a write validates.

    1 · **THE ROCOTO ACCOUNT.** `is_founder` is seeded into every tenant by `ensure_seed` on every
        boot, so "removing" it is a button that undoes itself at the next deploy. Refusing loudly is
        the honest answer; silently re-adding it would be worse than either.
    2 · **THE LAST ADMIN.** A tenant with nobody holding `admin` can never open Ajustes again, and
        there is no support path back that is not a hand-run INSERT on prod — the exact state this
        module exists to end. The message names the fix (promote somebody first), because an error
        that only says «no» leaves the boss with a screen he cannot get out of."""
    if row.get("is_founder"):
        raise ValueError("Esa es la cuenta de Rocoto. No se gestiona desde aquí: vuelve a aparecer "
                         "sola en el siguiente arranque.")
    admins = _admin_roles()
    if effective_role(row) not in admins or becoming in admins:
        return                                   # not an admin, or still one afterwards → nothing to protect
    if len(await _admin_ids(con, tenant)) <= 1:
        raise ValueError("Es la única cuenta que puede entrar en Ajustes. Nombra antes a otro dueño "
                         "(owner) y cambia luego esta — si no, tu empresa se queda sin nadie que "
                         "pueda tocar la configuración.")


async def add(con, tenant: str, email: str, name: str = "",
              role: str = REPARTIDOR) -> Dict[str, Any]:
    """ADD A PERSON TO THIS TENANT'S TEAM — «Ajustes → Equipo → + Repartidor», and the only way a
    driver gets a login. Returns {ok, created, member, note}; RAISES ValueError (es-ES) on a role or
    an address that is not one, and LookupError('no_such_tenant') on a tenant that does not exist.

    **THE EMAIL IS THE WHOLE INVITATION**, and it must be the Google account already on his phone —
    see the module docstring for why there is no other door and why none may be built. Nothing is
    sent from here: no code, no link, no Supabase user. The row simply says «this address belongs to
    this team», and the first time he signs in with Google the desk and the phone both resolve it.

    **AN ADDRESS ALREADY ON THE TEAM IS A ROLE CHANGE, NEVER A SECOND ROW.** `team_members` is keyed
    (operator_id, tenant_slug), so a duplicate would be silently swallowed by the conflict and the
    boss would think he had changed a role he had not. It routes through `set_role`, guards included:
    re-adding the last owner as a repartidor is the same lock-out as demoting him, and is refused the
    same way.

    An operator row that already exists (the same person in another team, or the founder) is REUSED
    rather than duplicated — `operators.email` is unique, and a second row for one human is how the
    audit trail on a delivery (`delivery_stops.delivered_by`) stops naming anybody. `active_tenant`
    is set ONLY when the operator is brand new: moving an existing person's active team from another
    company's Ajustes would reach across the tenant wall, which is exactly what must never happen."""
    r = check_role(role)
    e = check_email(email)
    nm = " ".join((name or "").split())[:_MAX_NAME]
    if not await con.fetchval("select 1 from tenants where slug = $1", tenant):
        raise LookupError("no_such_tenant")

    op = await con.fetchrow(
        "select id, email, name, is_founder from operators where lower(email) = $1", e)
    if op:
        oid = op["id"]
        if op["is_founder"]:
            # The Rocoto account, offered a role by a tenant. Same refusal as `_guard`'s first rule,
            # made here too so it never gets as far as writing a role the resolver would ignore.
            raise ValueError("Esa es la cuenta de Rocoto. No se gestiona desde aquí: vuelve a "
                             "aparecer sola en el siguiente arranque.")
        if nm and nm != (op["name"] or ""):
            await con.execute("update operators set name = $2, updated_at = now() where id = $1",
                              oid, nm)
        if await _member(con, tenant, oid):
            out = await set_role(con, tenant, oid, r)
            return {**out, "created": False, "note": GOOGLE_NOTE}
    else:
        # `on conflict (email)` closes the race between the lookup above and this insert (two admins
        # adding the same driver at once): the loser reads back the winner's id instead of raising a
        # unique violation at a boss who did nothing wrong.
        oid = await con.fetchval(
            "insert into operators (id, email, name, active_tenant, updated_at) "
            "values ($1,$2,$3,$4, now()) "
            "on conflict (email) do update set "
            "  name = case when excluded.name <> '' then excluded.name else operators.name end, "
            "  updated_at = now() returning id",
            _mint_id(e), e, nm, tenant)

    await con.execute(
        "insert into team_members (operator_id, tenant_slug, role) values ($1,$2,$3) "
        "on conflict (operator_id, tenant_slug) do update set role = excluded.role",
        oid, tenant, r)
    row = await _member(con, tenant, oid)
    if not row:                                   # the tenant row vanished under us — never claim a win
        raise LookupError("no_such_tenant")
    log.info("teams: %s added to %s as %s by API", e, tenant, r)
    return {"ok": True, "created": True, "member": member_wire(row), "email": e,
            "note": GOOGLE_NOTE}


async def set_role(con, tenant: str, operator_id: str, role: str) -> Dict[str, Any]:
    """CHANGE WHAT A MEMBER MAY DO. Returns {ok, member, was, email}; RAISES ValueError (es-ES) on an
    unknown role or a lock-out, LookupError('no_such_member') on somebody who is not on this team.

    `was` is returned because the audit row must be able to say what the access WAS — «cambió a
    repartidor» does not tell you whether a driver was created or an owner was stripped.

    **THE CALLER MUST REVOKE THEIR SESSIONS** (`sup_session.revoke_all(email)`): the role is stamped
    into the session row at login, so a demotion that is not followed by a revocation leaves the old
    caps alive for up to 12 h. `email` is returned for exactly that, and the route does it."""
    r = check_role(role)
    row = await _member(con, tenant, operator_id)
    if not row:
        raise LookupError("no_such_member")
    await _guard(con, tenant, row, becoming=r)
    await con.execute("update team_members set role = $3 "
                      "where tenant_slug = $1 and operator_id = $2", tenant, operator_id, r)
    log.info("teams: %s in %s: %s → %s", row["email"], tenant, row["role"], r)
    return {"ok": True, "member": member_wire({**row, "role": r}), "was": row["role"] or "",
            "email": (row["email"] or "").lower()}


async def remove(con, tenant: str, operator_id: str) -> Dict[str, Any]:
    """TAKE A PERSON OFF THIS TEAM. Returns {ok, removed, email}; RAISES the same two refusals as
    `set_role` (LookupError('no_such_member') · ValueError in es-ES for the Rocoto account and the
    last admin).

    **THE MEMBERSHIP IS DELETED; THE OPERATOR IS NOT.** `delivery_stops.delivered_by` and
    `delivery_settlements.recorded_by` carry `operators.id`: deleting the person would orphan the
    signature on deliveries that actually happened and settlements somebody actually took money for,
    turning a real record into an id nobody can name. He also may be in another company's team, which
    is none of this tenant's business. Losing the membership is losing the access, which is the thing
    that was asked for.

    **THE CALLER MUST REVOKE THEIR SESSIONS** — see `set_role`. Until that runs, a cookie minted
    before the removal still resolves; `sup_session.verify` reads the session row, not the
    membership, so nothing else in the system will notice."""
    row = await _member(con, tenant, operator_id)
    if not row:
        raise LookupError("no_such_member")
    await _guard(con, tenant, row, becoming="")
    await con.execute("delete from team_members where tenant_slug = $1 and operator_id = $2",
                      tenant, operator_id)
    log.info("teams: %s removed from %s", row["email"], tenant)
    return {"ok": True, "removed": member_wire(row), "email": (row["email"] or "").lower()}
