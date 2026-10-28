"""§17.30g / §17.35-adjacent — THE HABIT ENGINE: order habits as a POPULATION, with confidence.

The surfaces this feeds (PRODUCT-SPEC §17.30f–g, WEB-PRODUCT-BUILD-PLAN §2b.1):
  · Home's quiet line — «8 quiet against their habit · ~486 € unheard from · 3 worth a nudge»
  · Customers › quiet-today ranked worklist — per-row evidence «orders by 14:00 · nine weeks»
  · the day band's baseline — «usual by now on a Tuesday: ~34 · ~1.680 €»

Laws it implements:
  · POPULATIONS, NOT SPECIMENS: every answer is the whole set, ranked; top-K is the caller's cut.
  · CRY-WOLF DISCIPLINE: a habit is ARMED only at confidence ≥ 0.8 (8 of the last 10 same
    weekdays). Below the bar it never rings anyone.
  · DERIVED, NEVER ASSERTED: everything comes from the orders table; there is no habit row to
    drift out of date. Mutes («Not today») are the caller's state, passed in — this engine is
    stateless on purpose.
  · ONE BASELINE, TWO SURFACES: the same history that arms the ghost slots prices the pace
    caption. Never two models for one truth (§17.30g).

Pure halves (`build_habits`, `quiet_from`, `baseline_from`) take rows and are testable with no
database — the `build_dimension_index` precedent.
"""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Set

WINDOW_WEEKS = 10          # the habit window: the last 10 occurrences of that weekday
ARM_FLOOR = 0.8            # §17.30g: armed only when ≥8 of the last 10 same-weekdays ordered
USUAL_BY_PCTL = 0.75       # «orders BY 14:00» = the 75th percentile of their order times


def _minutes(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def build_habits(rows: Sequence[Dict[str, Any]], now: datetime) -> List[Dict[str, Any]]:
    """rows: [{phone_number, customer_name, created_at(datetime tz-aware), cents(int|None)}] over
    ≥ WINDOW_WEEKS weeks. Returns one habit per (phone, weekday) that has ≥2 occurrences:
    {phone, name, weekday, usual_by_min, usual_cents, weeks_seen, confidence, armed}."""
    per: Dict[tuple, Dict[str, Any]] = {}
    horizon = now - timedelta(weeks=WINDOW_WEEKS)
    for r in rows:
        ts = r["created_at"]
        if ts < horizon:
            continue
        key = (r["phone_number"], ts.weekday())
        h = per.setdefault(key, {"phone": r["phone_number"],
                                 "name": r.get("customer_name") or "",
                                 "weekday": ts.weekday(),
                                 "_weeks": set(), "_mins": [], "_cents": []})
        h["_weeks"].add(ts.isocalendar()[:2])          # (year, week) — one order per week counts once
        h["_mins"].append(_minutes(ts))
        if r.get("cents"):
            h["_cents"].append(int(r["cents"]))
        if r.get("customer_name") and not h["name"]:
            h["name"] = r["customer_name"]
    out: List[Dict[str, Any]] = []
    for h in per.values():
        weeks_seen = len(h["_weeks"])
        if weeks_seen < 2:
            continue
        mins = sorted(h["_mins"])
        usual_by = mins[min(len(mins) - 1, int(len(mins) * USUAL_BY_PCTL))]
        confidence = round(min(1.0, weeks_seen / WINDOW_WEEKS), 2)
        out.append({"phone": h["phone"], "name": h["name"], "weekday": h["weekday"],
                    "usual_by_min": usual_by,
                    "usual_cents": int(statistics.median(h["_cents"])) if h["_cents"] else None,
                    "weeks_seen": weeks_seen, "confidence": confidence,
                    "armed": confidence >= ARM_FLOOR})
    out.sort(key=lambda x: (-(x["usual_cents"] or 0) * x["confidence"]))
    return out


def quiet_from(habits: Sequence[Dict[str, Any]], ordered_today: Set[str], now: datetime,
               muted: Optional[Set[str]] = None) -> List[Dict[str, Any]]:
    """The quiet POPULATION for `now`: armed habits for today's weekday whose usual-by has passed
    with no order today and no mute. Ranked by what the miss costs:
    usual_cents × confidence × lateness (capped at 3h)."""
    muted = muted or set()
    wd, now_min = now.weekday(), _minutes(now)
    quiet = []
    for h in habits:
        if not h["armed"] or h["weekday"] != wd:
            continue
        if h["phone"] in ordered_today or h["phone"] in muted:
            continue
        late = now_min - h["usual_by_min"]
        if late <= 0:
            continue
        score = (h["usual_cents"] or 0) * h["confidence"] * min(late, 180) / 180.0
        quiet.append({**h, "late_min": late, "score": round(score, 1)})
    quiet.sort(key=lambda x: -x["score"])
    return quiet


def baseline_from(rows: Sequence[Dict[str, Any]], now: datetime) -> Dict[str, Any]:
    """«Usual by now on a Tuesday»: over the same weekday in the window, the MEDIAN count and cents
    of orders placed up to now's time-of-day. rows as in build_habits."""
    wd, now_min = now.weekday(), _minutes(now)
    today = now.date()
    per_day: Dict[Any, Dict[str, int]] = {}
    for r in rows:
        ts = r["created_at"]
        if ts.weekday() != wd or ts.date() == today or _minutes(ts) > now_min:
            continue
        d = per_day.setdefault(ts.date(), {"n": 0, "cents": 0})
        d["n"] += 1
        d["cents"] += int(r.get("cents") or 0)
    if not per_day:
        return {"orders": None, "cents": None, "days": 0}
    ns = sorted(v["n"] for v in per_day.values())
    cs = sorted(v["cents"] for v in per_day.values())
    return {"orders": int(statistics.median(ns)), "cents": int(statistics.median(cs)),
            "days": len(per_day)}


# ── async halves: fetch + delegate to the pure functions ────────────────────────────────────────

_ROWS_SQL = """
select phone_number, customer_name, created_at,
       coalesce(value_snapshot_cents,
                (select sum((l->>'line_total')::numeric * 100)::bigint
                   from jsonb_array_elements(lines) l
                  where l->>'line_total' is not null)) as cents
  from orders
 where tenant_id = $1
   and created_at >= $2
   and status not in ('cancelled', 'rejected')
   and coalesce(stage, '') <> 'test'
"""


async def _rows(con, tenant: str, now: datetime) -> List[Dict[str, Any]]:
    horizon = now - timedelta(weeks=WINDOW_WEEKS)
    rs = await con.fetch(_ROWS_SQL, tenant, horizon)
    return [dict(r) for r in rs]


async def habits(con, tenant: str, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    return build_habits(await _rows(con, tenant, now), now)


async def quiet_now(con, tenant: str, now: Optional[datetime] = None,
                    muted: Optional[Set[str]] = None) -> List[Dict[str, Any]]:
    now = now or datetime.now(timezone.utc)
    rows = await _rows(con, tenant, now)
    today = now.date()
    ordered_today = {r["phone_number"] for r in rows if r["created_at"].date() == today}
    return quiet_from(build_habits(rows, now), ordered_today, now, muted)


async def usual_by_now(con, tenant: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    return baseline_from(await _rows(con, tenant, now), now)
