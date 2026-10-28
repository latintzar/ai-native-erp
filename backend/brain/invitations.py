"""invitations.py — §17.41's invitation, whose TOKEN IS THE LINK (WP-A3).

    invite → pending → accept → active · resend · revoke (the link dies immediately) · 7-day expiry

THE STATES ARE §17.33's, and they are states a PERSON is in, not rows in a queue: «Company › People
is a roster of states, not a list of names.» That is why `accepted_at` / `revoked_at` / `opened_at`
are columns rather than one status string — the roster has to say *when it was sent, whether it has
been opened, and that revoking killed the link immediately*, and a single enum cannot.

TWO LAWS THIS MODULE EXISTS TO KEEP:
  · «nothing about the person changes until they accept» (§17.33). A pending invitation grants
    NOTHING: no membership row, no session, no read. `accept()` is the only thing that creates
    membership, and it is the only thing that can.
  · «revoking kills the link immediately; they were never in the data» (§17.33). Revocation is not
    a flag a later sweep honours — `accept()` re-checks on every use, so a revoked link is dead the
    instant the column is written, even for a link already open in someone's browser.

EXPIRY IS CHECKED ON USE, not by a background sweep. A sweep that lags leaves a live link past its
promise; checking at the door cannot.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.invitations")

EXPIRY_DAYS = 7                      # §17.41: «caduca en 7 días»
ROLES = ("owner", "staff", "repartidor")   # §17.34's three, and only these


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create(tenant: str, email: str, role: str = "staff", *, invited_by: str = "") -> dict[str, Any]:
    """Mint an invitation. Re-inviting a still-pending address RESENDS (a new token, a fresh clock)
    rather than accumulating live links — the partial unique index makes that structural."""
    email = (email or "").strip().lower()
    if "@" not in email:
        raise ValueError("an invitation needs a real email address — it is the identity it binds to")
    if role not in ROLES:
        raise ValueError(f"role must be one of {ROLES}, not {role!r}")

    token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(days=EXPIRY_DAYS)
    async with db.get_pool().acquire() as con, con.transaction():
        # a resend supersedes the previous live link: the old token must stop working, or
        # «revoke» would be the only way to retire a link and a resend would multiply them.
        await con.execute(
            "update invitation set revoked_at = now() "
            "where tenant_slug = $1 and lower(email) = $2 "
            "and accepted_at is null and revoked_at is null", tenant, email)
        await con.execute(
            "insert into invitation(token, tenant_slug, email, role, invited_by, expires_at) "
            "values($1,$2,$3,$4,$5,$6)", token, tenant, email, role, invited_by, expires)
    return {"token": token, "tenant_slug": tenant, "email": email, "role": role,
            "expires_at": expires, "invited_by": invited_by}


async def peek(token: str) -> Optional[dict[str, Any]]:
    """What the invite PAGE shows before anyone accepts (§17.41: the inviter is the subject).

    Marks it opened — «sent 2 days ago · not opened yet» is a real sentence on the roster, and the
    only place it can be learned is here. Returns None for a token that does not exist; returns the
    row WITH its `state` for one that does, because «this link has expired» and «this link was
    revoked» must be sayable plainly rather than collapsing into a 404.
    """
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select i.*, t.name as tenant_name from invitation i "
            "left join tenants t on t.slug = i.tenant_slug where i.token = $1", token)
        if not row:
            return None
        first_open = (row["accepted_at"] is None and row["revoked_at"] is None
                      and row["opened_at"] is None)
        if first_open:
            await con.execute("update invitation set opened_at = now() where token = $1", token)
    d = dict(row)
    if first_open:
        # the row was read BEFORE the update, so reflect it rather than handing the caller a value
        # we know to be stale — the roster's «sin abrir» sentence is computed off exactly this field.
        d["opened_at"] = _now()
    d["state"] = _state_of(d)
    return d


def _state_of(row: dict[str, Any]) -> str:
    if row.get("revoked_at"):
        return "revoked"
    if row.get("accepted_at"):
        return "accepted"
    exp = row.get("expires_at")
    if exp and exp <= _now():
        return "expired"
    return "pending"


async def accept(token: str, email: str) -> dict[str, Any]:
    """Turn an invitation into a MEMBERSHIP. The only path that creates one from a link.

    Fails closed and says which wall it hit, because §17.41 requires that an expired or revoked link
    «says so plainly and offers nothing» — a generic error would send someone to support over a
    thing the page could simply have told them.

    The email must MATCH: a link is an invitation to one person, and letting whoever holds it join
    would make the token a bearer credential for an org.
    """
    email = (email or "").strip().lower()
    async with db.get_pool().acquire() as con, con.transaction():
        row = await con.fetchrow("select * from invitation where token = $1 for update", token)
        if not row:
            return {"ok": False, "error": "unknown"}
        st = _state_of(dict(row))
        if st != "pending":
            return {"ok": False, "error": st}
        if (row["email"] or "").strip().lower() != email:
            return {"ok": False, "error": "wrong_email"}

        op_id = f"op_{''.join(ch for ch in email.split('@')[0].lower() if ch.isalnum())[:24] or 'user'}"
        await con.execute(
            "insert into operators(id, email, name, is_founder) values($1,$2,'',false) "
            "on conflict (id) do update set email = excluded.email, updated_at = now()",
            op_id, email)
        await con.execute(
            "insert into team_members(operator_id, tenant_slug, role) values($1,$2,$3) "
            "on conflict (operator_id, tenant_slug) do update set role = excluded.role",
            op_id, row["tenant_slug"], row["role"])
        await con.execute("update invitation set accepted_at = now() where token = $1", token)

    return {"ok": True, "tenant_slug": row["tenant_slug"], "role": row["role"],
            "email": email, "operator_id": op_id}


async def revoke(token: str) -> bool:
    """Kill a link, this instant. §17.33: «revoking kills the link immediately; they were never in
    the data» — so this touches the invitation only. A member who already ACCEPTED is removed
    through the roster, which is a different act with a different consequence."""
    async with db.get_pool().acquire() as con:
        res = await con.execute(
            "update invitation set revoked_at = now() "
            "where token = $1 and accepted_at is null and revoked_at is null", token)
    return res.endswith("1")


async def roster(tenant: Optional[str] = None) -> list[dict[str, Any]]:
    """Every OUTSTANDING invitation for the org, newest first — the amber half of §17.33's People.

    EXPIRED ONES STAY ON THE LIST, carrying `state='expired'`. §17.33 makes People «a roster of
    states, not a list of names», and an invitation that quietly vanished after seven days is the
    one state the operator most needs to see: it is the row that wants Resend. Only accepting or
    revoking removes it, because those are the two acts that end an invitation.
    """
    slug = tenant or config.BRAIN_TENANT
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select * from invitation where tenant_slug = $1 and accepted_at is null "
            "and revoked_at is null order by created_at desc", slug)
    out = []
    for r in rows:
        d = dict(r)
        d["state"] = _state_of(d)
        d.pop("token", None)          # the roster lists invitations; it does not hand out their keys
        out.append(d)
    return out
