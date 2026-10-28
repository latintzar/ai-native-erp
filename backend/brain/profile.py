"""Customer profile — the "always" scale + Customer DNA source (Register #5, Stage 5).

HYBRID, not all-LLM (Register memory note): deterministic stats (typical days, cadence, streak,
top products, typical basket, per-weekday typical order, lifetime value, volatility) are cheap and
exact; a Sonnet pass writes only the narrative + usual personalisations. Triggered on every order
SUBMIT. Read cheaply at order time and by the Customer DNA screen.
"""
from __future__ import annotations

import logging
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import config
import db
from brain import llm

log = logging.getLogger("rocoto.brain.profile")

PROFILE_SYSTEM = (
    "You write a short customer profile for a pork supplier's operator. Given deterministic stats and "
    "a few recent messages, write: (1) a 2-3 sentence narrative capturing who this customer is and how "
    "they order (their rhythm, their staples, anything notable like late-night emergency orders), and "
    "(2) a short list of their usual personalisations (how they like things prepared/delivered, "
    "standing preferences) — only ones genuinely evidenced. Warm, concrete, operator-facing. No fluff."
)
PROFILE_TOOL = {
    "name": "write_profile",
    "description": "The narrative + usual personalisations for this customer.",
    "input_schema": {
        "type": "object",
        "properties": {
            "narrative": {"type": "string"},
            "usual_personalisations": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["narrative"],
    },
}


def _order_date(o: Dict[str, Any]) -> Optional[date]:
    d = o.get("delivery_date")
    if d:
        try:
            return datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            pass
    c = o.get("created_at")
    return c.date() if isinstance(c, datetime) else None


def _line_total(ln: Dict[str, Any]) -> float:
    # For lifetime VALUE we estimate qty×price even for variable-weight cuts (the order card still
    # shows "—" for weighed items; this is just the spend estimate the DNA screen reports).
    lt = ln.get("line_total")
    if isinstance(lt, (int, float)):
        return float(lt)
    q, p = ln.get("qty"), ln.get("price")
    if isinstance(q, (int, float)) and isinstance(p, (int, float)):
        return float(q) * float(p)
    return 0.0


def _key(ln: Dict[str, Any]) -> Optional[str]:
    return ln.get("sku_id") or ln.get("name") or ln.get("item") or ln.get("mention")


def _name(ln: Dict[str, Any]) -> str:
    return ln.get("name") or ln.get("item") or ln.get("mention") or (ln.get("sku_id") or "?")


def _modal_basket(orders: List[Dict[str, Any]], min_share: float = 0.5) -> List[Dict[str, Any]]:
    n = len(orders)
    if not n:
        return []
    present = Counter()
    qtys: Dict[str, List[float]] = defaultdict(list)
    names: Dict[str, str] = {}
    units: Dict[str, List[str]] = defaultdict(list)
    skus: Dict[str, Optional[str]] = {}
    for o in orders:
        seen = set()
        for ln in (o.get("lines") or []):
            k = _key(ln)
            if not k or k in seen:
                continue
            seen.add(k)
            present[k] += 1
            names[k] = _name(ln)
            skus[k] = ln.get("sku_id")
            if isinstance(ln.get("qty"), (int, float)):
                qtys[k].append(float(ln["qty"]))
            if ln.get("unit"):
                units[k].append(ln["unit"])
    out = []
    for k, c in present.most_common():
        if c / n >= min_share:
            out.append({
                "sku_id": skus.get(k), "name": names[k],
                "qty": statistics.median(qtys[k]) if qtys[k] else None,
                "unit": Counter(units[k]).most_common(1)[0][0] if units[k] else "",
            })
    return out


async def compute_stats(phone: str, tenant: str) -> Dict[str, Any]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        # TENANT-SCOPED (2026-07-27): the Customer DNA (cadence, streak, typical basket, LTV) is a
        # per-distributor fact. Blending two suppliers' order books would invent a rhythm the
        # customer has with neither of them.
        orders = [dict(r) for r in await con.fetch(
            """select id, lines, delivery_date, created_at, status, seeded
                 from orders where phone_number=$1 and tenant_id=$2 and status in ('approved','sent')
                 order by created_at""", phone, tenant)]
        media = [dict(r) for r in await con.fetch(
            """select id, media_types, message_type, created_at from whatsapp_messages
                 where phone_number=$1 and message_type in ('image','document','audio')
                 order by created_at desc limit 20""", phone)]
        wprof = await con.fetchrow("select display_name from whatsapp_user_profiles where phone_number=$1", phone)
        existing = await con.fetchrow(
            "select * from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, phone)
        recent_msgs = [dict(r) for r in await con.fetch(
            """select message_text, transcript, role, created_at from whatsapp_messages
                 where phone_number=$1 order by created_at desc limit 20""", phone)]

    n = len(orders)
    dated = [(d, o) for o in orders if (d := _order_date(o))]
    dates = sorted({d for d, _ in dated})

    # typical days (weekday histogram)
    wd = Counter(d.weekday() for d, _ in dated)
    thresh = max(2, round(0.25 * n)) if n else 1
    typical_days = sorted([w for w, c in wd.items() if c >= thresh]) or [w for w, _ in wd.most_common(2)]

    # cadence
    diffs = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
    cadence_days = round(statistics.mean(diffs), 1) if diffs else None

    # streak (consecutive ISO weeks ending at the latest order)
    streak = 0
    if dates:
        weeks = {(d.isocalendar()[0], d.isocalendar()[1]) for d in dates}
        cur = max(dates)
        y, w, _ = cur.isocalendar()
        from datetime import timedelta
        probe = cur
        while True:
            yw = (probe.isocalendar()[0], probe.isocalendar()[1])
            if yw in weeks:
                streak += 1
                probe = probe - timedelta(days=7)
            else:
                break

    # top products
    present = Counter()
    names = {}
    skus = {}
    for o in orders:
        for k in {_key(ln) for ln in (o.get("lines") or []) if _key(ln)}:
            present[k] += 1
        for ln in (o.get("lines") or []):
            k = _key(ln)
            if k:
                names[k] = _name(ln); skus[k] = ln.get("sku_id")
    top_products = [{"sku_id": skus.get(k), "name": names[k], "share": round(c / n, 2)}
                    for k, c in present.most_common(6)] if n else []

    typical_basket = _modal_basket(orders)

    # per-weekday typical order
    by_day: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for d, o in dated:
        by_day[d.weekday()].append(o)
    days = {}
    for w, os in by_day.items():
        days[str(w)] = {
            "weekday": w,
            "order_count": len(os),
            "typical_order": _modal_basket(os, min_share=0.4),
        }

    lifetime_value = round(sum(_line_total(ln) for o in orders for ln in (o.get("lines") or [])), 2)
    order_totals = [sum(_line_total(ln) for ln in (o.get("lines") or [])) for o in orders]
    volatility = round(statistics.pstdev(order_totals), 2) if len(order_totals) > 1 else 0.0
    first_seen = str(min(dates)) if dates else None

    display_name = (existing and existing["display_name"]) or (wprof and wprof["display_name"]) or ""
    phone_numbers = list((existing and existing["phone_numbers"]) or [])
    autopilot = bool(existing and existing["autopilot"])

    return {
        "phone_number": phone,
        "display_name": display_name,
        "typical_days": typical_days,
        "cadence_days": cadence_days,
        "streak_weeks": streak,
        "top_products": top_products,
        "typical_basket": typical_basket,
        "phone_numbers": phone_numbers,
        "shared_media_refs": [{"id": m["id"], "type": m["message_type"],
                               "at": m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else None}
                              for m in media],
        "autopilot": autopilot,
        "days": days,
        "stats": {"lifetime_value": lifetime_value, "order_count": n,
                  "volatility": volatility, "first_seen": first_seen},
        "_recent_msgs": recent_msgs,
    }


async def _sonnet(stats: Dict[str, Any]) -> Dict[str, Any]:
    tb = ", ".join(f"{b.get('qty','?')}{b.get('unit','')} {b['name']}" for b in stats["typical_basket"][:8])
    tp = ", ".join(f"{p['name']} ({int(p['share']*100)}%)" for p in stats["top_products"][:6])
    recent = "\n".join(
        f"- {(m.get('transcript') or m.get('message_text') or '')[:160]}"
        for m in (stats.get("_recent_msgs") or [])[:8] if (m.get("transcript") or m.get("message_text")))
    user = "\n".join([
        f"Customer: {stats['display_name'] or stats['phone_number']}",
        f"Orders: {stats['stats']['order_count']}, every ~{stats['cadence_days']} days, "
        f"streak {stats['streak_weeks']} weeks, lifetime €{stats['stats']['lifetime_value']}",
        f"Usual basket: {tb or '(thin history)'}",
        f"Top products: {tp or '(n/a)'}",
        f"Recent messages:\n{recent or '(none)'}",
    ])
    try:
        out = await llm.call_tool(config.PROFILE_MODEL, PROFILE_SYSTEM, user, PROFILE_TOOL,
                                  "write_profile", max_tokens=512,
                                  fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    except Exception:
        log.exception("profile sonnet failed")
        out = None
    return out or {"narrative": "", "usual_personalisations": []}


async def backfill_narratives(phones: list[str], tenant: Optional[str] = None) -> int:
    """Fill in the MISSING narratives for already-written profiles, one model call each, fail-soft.

    Exists because the demo world-switch writes profiles with `skip_narrative=True` so the switch does
    not block on 6-9 sequential model calls (see [save_profile]). The narrative is the customer-DNA
    prose the app actually shows, so skipping it and stopping there left the DNA panel empty — Peter,
    2026-07-28: "no customer dna data, just nothing". The switch kicks this off in the BACKGROUND
    instead: it returns immediately, and the prose lands seconds later.

    Returns how many narratives were written. Never raises: this is a background enrichment task, and a
    dead model key (or an exhausted balance — the exact condition that started all this) must degrade
    the DNA panel, never take down the seed that already succeeded."""
    tenant = tenant or config.BRAIN_TENANT
    written = 0
    for phone in phones:
        try:
            pool = db.get_pool()
            async with pool.acquire() as con:
                has = await con.fetchval(
                    "select coalesce(narrative,'') <> '' from customer_profiles "
                    "where phone_number=$1 and tenant_id=$2", phone, tenant)
            if has:
                continue                      # already has one — never spend a call to rewrite it
            stats = await compute_stats(phone, tenant)
            narr = await _sonnet(stats)
            text = (narr or {}).get("narrative") or ""
            if not text:
                continue
            async with pool.acquire() as con:
                await con.execute(
                    "update customer_profiles set narrative=$3, "
                    "usual_personalisations=$4, updated_at=now() "
                    "where phone_number=$1 and tenant_id=$2",
                    phone, tenant, text, (narr or {}).get("usual_personalisations") or [])
            written += 1
        except Exception:
            log.debug("backfill_narratives: skipped %s (fail-soft)", phone, exc_info=True)
    if written:
        log.info("backfill_narratives: wrote %d narrative(s) for %s", written, tenant)
    return written


async def save_profile(phone: str, tenant: Optional[str] = None, *,
                       skip_narrative: bool = False) -> Dict[str, Any]:
    """`skip_narrative=True` writes the same row — every real, computed stat (basket, cadence,
    top products, lifetime value) — but never calls the model for the flavour-text narrative, which
    is the only part of a profile that needs one. Used by the demo seed loader (brain/seed.py): the
    world-switch button used to call this once per seeded contact unconditionally, which meant an
    everyday app action made 6-9 sequential live Claude calls whose only output nobody was reading at
    that moment (Peter, 2026-07-28: "why do we need the key for the switching lol")."""
    tenant = tenant or config.BRAIN_TENANT
    stats = await compute_stats(phone, tenant)
    narr = {"narrative": "", "usual_personalisations": []} if skip_narrative else await _sonnet(stats)
    pool = db.get_pool()
    async with pool.acquire() as con:
        seeded = bool(await con.fetchval(
            "select seeded from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, _seat(phone)) or False)
        await con.execute(
            """insert into customer_profiles
                 (phone_number, tenant_id, display_name, typical_days, cadence_days, streak_weeks,
                  top_products, typical_basket, usual_personalisations, phone_numbers, shared_media_refs,
                  autopilot, narrative, stats, seeded, updated_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
               on conflict (tenant_id, phone_number) do update set
                 display_name=excluded.display_name, typical_days=excluded.typical_days,
                 cadence_days=excluded.cadence_days, streak_weeks=excluded.streak_weeks,
                 top_products=excluded.top_products, typical_basket=excluded.typical_basket,
                 usual_personalisations=excluded.usual_personalisations,
                 phone_numbers=excluded.phone_numbers, shared_media_refs=excluded.shared_media_refs,
                 narrative=excluded.narrative, stats=excluded.stats, updated_at=now()""",
            _seat(phone), tenant, stats["display_name"], stats["typical_days"], stats["cadence_days"],
            stats["streak_weeks"], stats["top_products"], stats["typical_basket"],
            narr.get("usual_personalisations") or [], stats["phone_numbers"], stats["shared_media_refs"],
            stats["autopilot"], narr.get("narrative", ""),
            {**stats["stats"], "days": stats["days"]}, seeded,
        )
    log.info("profile saved phone=%s orders=%d", phone, stats["stats"]["order_count"])
    return await get_profile(phone, tenant)


async def get_profile(phone: str, tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select * from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, phone)
    if not row:
        return None
    p = dict(row)
    st = p.get("stats") or {}
    days = st.get("days") if isinstance(st, dict) else {}
    # B6 (SPEC §5.5): `autopilot` is a VIEW of the one mode field, not the profile's own column. The
    # column is still written (a projection for the profile pane) but it is never the answer — a boss
    # who switched the whole app to sombra must not see a customer reading "autopilot on".
    try:
        import gate
        import runtime
        autopilot = (await gate.effective_mode(runtime.scope_of(phone)))["mode"] == gate.AUTO
    except Exception:
        autopilot = bool(p.get("autopilot"))
    return {
        "phone_number": p["phone_number"],
        "display_name": p.get("display_name") or "",
        "typical_days": p.get("typical_days") or [],
        "cadence_days": float(p["cadence_days"]) if p.get("cadence_days") is not None else None,
        "streak_weeks": p.get("streak_weeks") or 0,
        "top_products": p.get("top_products") or [],
        "typical_basket": p.get("typical_basket") or [],
        "usual_personalisations": p.get("usual_personalisations") or [],
        "phone_numbers": p.get("phone_numbers") or [],
        "shared_media_refs": p.get("shared_media_refs") or [],
        "autopilot": autopilot,
        "narrative": p.get("narrative") or "",
        "days": days or {},
        "stats": {k: v for k, v in (st or {}).items() if k != "days"},
        "updated_at": p["updated_at"].isoformat() if isinstance(p.get("updated_at"), datetime) else None,
    }


def _seat(phone: str) -> str:
    """THE IDENTITY BOUNDARY (R8/SOTA: the «+34+600+12+34+56» row). Every customer_profiles
    write goes through canon() so a caller that hands us a form-encoded, space-as-plus or
    otherwise un-normalised string cannot seat a second identity for the same human. canon()
    falls back to the stripped input on an unparseable number, so nothing is ever dropped —
    but the +-riddled shape stops being writable."""
    from identity_phone import canon as _canon
    return _canon(phone or "")


async def set_autopilot(phone: str, on: bool, tenant: Optional[str] = None) -> bool:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into customer_profiles (phone_number, tenant_id, autopilot)
               values ($1,$2,$3)
               on conflict (tenant_id, phone_number) do update set autopilot=excluded.autopilot, updated_at=now()""",
            _seat(phone), tenant, on)
    return on
