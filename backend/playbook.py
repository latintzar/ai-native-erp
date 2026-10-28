"""playbook.py — the data layer behind `/internal/playbook`, Peter's sales tool.

NOT a product surface and never a tenant one. These two tables (`pb_account`, `pb_note`, declared
in db.PLAYBOOK_SCHEMA) hold what Peter knows about a PROSPECT — volumes he was told on a call,
where the money would come from, who the champion is. No customer's data passes through here, no
scope is attached, and nothing in this module may ever be reached from a tenant path: every route
in app.py that calls it sits behind `require_cr_session`, and that session is the whole guard.

WHAT IS DELIBERATELY ABSENT: the calculator's outputs. `volumes` stores the INPUTS; the monthly
quote, the floor and the return multiple are derived in ONE place (pb/pb.js) and never written
down. A stored derivation is a second truth that goes stale the first time a rate changes and the
sales conversation quotes it anyway.

The stage ladder is closed and ordered — see STAGES. A stage the UI has never heard of would
render as an empty chip and sort nowhere, so it is validated on write rather than trusted.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Optional

import db

log = logging.getLogger("rocoto.playbook")

# The ladder, in order. The UI renders it as a row of chips and the index is the progress.
STAGES = ("contacted", "demo_used", "qualifying", "scope_proposed",
          "scope_running", "implementation", "live")

# The calculator's inputs, with the defaults the brief fixed. A missing key resolves to its default
# here rather than in the browser, so an account created before a field existed still opens.
VOLUME_DEFAULTS: dict[str, float] = {
    "ordersPerDay": 120,
    "workingDaysPerMonth": 24,
    "avgOrderValue": 280,
    "peopleKeying": 2,
    "hoursPerDayEach": 4,
    "loadedCostPerPerson": 24000,
    "errorRate": 0.02,
    "costPerError": 45,
    "captureRate": 0.25,
}

# The eight MEDDPICC slots. Free text each; the completeness bar counts the non-empty ones.
MEDDPICC_KEYS = ("metrics", "economicBuyer", "decisionCriteria", "decisionProcess",
                 "paperProcess", "identifiedPain", "champion", "competition")

_MAX_TEXT = 4000          # one free-text field
_MAX_MAP_ROWS = 60        # a mutual action plan longer than this is a project plan, not a MAP


def _iso(v: Any) -> Any:
    return v.isoformat() if isinstance(v, (datetime, date)) else v


def _row(rec) -> dict[str, Any]:
    d = {k: _iso(v) for k, v in dict(rec).items()}
    d["volumes"] = {**VOLUME_DEFAULTS, **(d.get("volumes") or {})}
    d["meddpicc"] = {k: (d.get("meddpicc") or {}).get(k, "") for k in MEDDPICC_KEYS}
    d["map_rows"] = d.get("map_rows") or []
    return d


# ── validation — every one of these is a WRITE guard, not a UI nicety ────────────────────────────
def _clean_text(v: Any, limit: int = _MAX_TEXT) -> str:
    return ("" if v is None else str(v)).strip()[:limit]


def _clean_stage(v: Any) -> str:
    s = _clean_text(v, 40)
    return s if s in STAGES else STAGES[0]


def _clean_date(v: Any) -> Optional[date]:
    """Accepts 'YYYY-MM-DD' or empty. Anything else is dropped rather than guessed — a date typed
    into the wrong format must clear the field visibly, not silently become today."""
    s = _clean_text(v, 32)
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _clean_volumes(v: Any) -> dict[str, float]:
    """Only the nine known keys, only finite non-negative numbers. A stray key would ride into the
    browser and a NaN would poison every output on the screen at once."""
    out: dict[str, float] = {}
    src = v if isinstance(v, dict) else {}
    for k, default in VOLUME_DEFAULTS.items():
        raw = src.get(k, default)
        try:
            n = float(raw)
        except (TypeError, ValueError):
            n = float(default)
        if n != n or n in (float("inf"), float("-inf")) or n < 0:
            n = float(default)
        out[k] = n
    return out


def _clean_meddpicc(v: Any) -> dict[str, str]:
    src = v if isinstance(v, dict) else {}
    return {k: _clean_text(src.get(k, "")) for k in MEDDPICC_KEYS}


def _clean_map(v: Any) -> list[dict[str, str]]:
    rows = v if isinstance(v, list) else []
    out = []
    for r in rows[:_MAX_MAP_ROWS]:
        if not isinstance(r, dict):
            continue
        d = _clean_date(r.get("date"))
        who, what = _clean_text(r.get("who"), 200), _clean_text(r.get("what"), 600)
        if not (d or who or what):
            continue
        out.append({"date": d.isoformat() if d else "", "who": who, "what": what})
    return out


# ── reads ────────────────────────────────────────────────────────────────────────────────────────
async def list_accounts(include_archived: bool = False) -> list[dict[str, Any]]:
    """Screen 1. Sorted by what is due next; a row with no next date sorts last, not first."""
    sql = ("select * from pb_account "
           + ("" if include_archived else "where archived = false ")
           + "order by next_date asc nulls last, updated_at desc")
    async with db.get_pool().acquire() as con:
        return [_row(r) for r in await con.fetch(sql)]


async def get_account(acct_id: int) -> Optional[dict[str, Any]]:
    async with db.get_pool().acquire() as con:
        rec = await con.fetchrow("select * from pb_account where id = $1", int(acct_id))
        if not rec:
            return None
        out = _row(rec)
        out["notes"] = [
            {k: _iso(v) for k, v in dict(n).items()}
            for n in await con.fetch(
                "select id, body, author, created_at from pb_note where account_id = $1 "
                "order by created_at desc limit 200", int(acct_id))
        ]
        return out


# ── writes ───────────────────────────────────────────────────────────────────────────────────────
async def create_account(name: str, contact: str = "", role: str = "") -> dict[str, Any]:
    n = _clean_text(name, 200)
    if not n:
        raise ValueError("an account needs a name")
    async with db.get_pool().acquire() as con:
        rec = await con.fetchrow(
            "insert into pb_account (name, contact, role, volumes, meddpicc) "
            "values ($1,$2,$3,$4,$5) returning *",
            n, _clean_text(contact, 200), _clean_text(role, 200),
            dict(VOLUME_DEFAULTS), dict.fromkeys(MEDDPICC_KEYS, ""))
        return _row(rec)


# The one PATCH the SPA uses for everything on screens 1–4. Every field is optional and every one
# that arrives is cleaned above; a key that is absent is left alone rather than blanked, which is
# what lets the calculator autosave a single input without carrying the whole record.
_PATCHABLE = {
    "name": lambda v: _clean_text(v, 200),
    "contact": lambda v: _clean_text(v, 200),
    "role": lambda v: _clean_text(v, 200),
    "stage": _clean_stage,
    "next_action": lambda v: _clean_text(v, 400),
    "next_date": _clean_date,
    "volumes": _clean_volumes,
    "meddpicc": _clean_meddpicc,
    "map_rows": _clean_map,
    "archived": lambda v: bool(v),
}


async def patch_account(acct_id: int, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
    fields, values = [], []
    for key, clean in _PATCHABLE.items():
        if key in patch:
            fields.append(key)
            values.append(clean(patch[key]))
    if not fields:
        return await get_account(acct_id)
    sets = ", ".join(f"{f} = ${i + 2}" for i, f in enumerate(fields))
    async with db.get_pool().acquire() as con:
        rec = await con.fetchrow(
            f"update pb_account set {sets}, updated_at = now() where id = $1 returning *",
            int(acct_id), *values)
    return _row(rec) if rec else None


async def touch_account(acct_id: int) -> None:
    """«I just spoke to them.» Its own verb rather than a patch field: last_touch is a fact about
    an event, and letting the client send a timestamp would let a stale tab rewrite history."""
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update pb_account set last_touch = now(), updated_at = now() where id = $1",
            int(acct_id))


async def add_note(acct_id: int, body: str, author: str = "") -> Optional[dict[str, Any]]:
    b = _clean_text(body)
    if not b:
        raise ValueError("an empty note is not a note")
    async with db.get_pool().acquire() as con:
        exists = await con.fetchval("select 1 from pb_account where id = $1", int(acct_id))
        if not exists:
            return None
        rec = await con.fetchrow(
            "insert into pb_note (account_id, body, author) values ($1,$2,$3) "
            "returning id, body, author, created_at",
            int(acct_id), b, _clean_text(author, 200))
        await con.execute("update pb_account set last_touch = now(), updated_at = now() "
                          "where id = $1", int(acct_id))
    return {k: _iso(v) for k, v in dict(rec).items()}


async def delete_account(acct_id: int) -> bool:
    """Hard delete, notes and all (the FK cascades). Archiving is the soft path and it is the one
    the UI offers; this exists for a row created by a typo."""
    async with db.get_pool().acquire() as con:
        res = await con.execute("delete from pb_account where id = $1", int(acct_id))
    return res.endswith("1")
