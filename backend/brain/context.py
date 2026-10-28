"""Multi-scale context for the readers (Register #8, memory windows).

History is QUERIED, never dumped: we fetch a bounded window of recent messages + recent orders +
the precomputed profile, condense each scale (today verbatim · 3-day · week · month · always), and
hand each reader only its window. Cost stays flat per message regardless of customer age.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import config
import db

_MEDIA = {"audio": "[voice note]", "image": "[photo]", "document": "[document]", "video": "[video]"}


def _fmt_msg(r: Dict[str, Any]) -> str:
    who = "customer" if r.get("role") == "user" else "us"
    t = (r.get("transcript") or r.get("message_text") or "").strip()
    if not t and r.get("message_type") in _MEDIA:
        t = _MEDIA[r["message_type"]]
    t = t.replace("\n", " ")[:240]
    d = r.get("created_at")
    ds = d.strftime("%a %d %b %H:%M") if isinstance(d, datetime) else ""
    return f"[{ds}] {who}: {t}"


def _order_summary(o: Dict[str, Any]) -> str:
    lines = o.get("lines") or []
    parts = []
    for ln in lines[:8]:
        name = ln.get("name") or ln.get("item") or ln.get("mention") or "?"
        parts.append(f"{ln.get('qty', '?')}{ln.get('unit', '')} {name}")
    d = o.get("delivery_date") or (o.get("created_at").strftime("%Y-%m-%d") if isinstance(o.get("created_at"), datetime) else "")
    return f"{d}: " + ", ".join(parts)


def _profile_text(prof: Optional[Dict[str, Any]]) -> str:
    if not prof:
        return "(no profile yet — new or thin-history customer)"
    out = []
    if prof.get("display_name"):
        out.append(f"name: {prof['display_name']}")
    tb = prof.get("typical_basket") or []
    if tb:
        out.append("usual basket: " + ", ".join(
            f"{b.get('qty','?')}{b.get('unit','')} {b.get('name', b.get('sku_id',''))}" for b in tb[:10]))
    tp = prof.get("top_products") or []
    if tp:
        out.append("top products: " + ", ".join(p.get("name", p.get("sku_id", "")) for p in tp[:6]))
    if prof.get("cadence_days"):
        out.append(f"orders about every {round(float(prof['cadence_days']))} days")
    up = prof.get("usual_personalisations") or []
    if up:
        out.append("usual personalisations: " + "; ".join(str(x) for x in up[:6]))
    if prof.get("narrative"):
        out.append("notes: " + str(prof["narrative"])[:400])
    return "\n".join(out)


async def gather(phone: str, today_text: str, identity: Dict[str, Any],
                 tenant: Optional[str] = None) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select role, message_text, transcript, message_type, created_at
                 from whatsapp_messages
                 where phone_number=$1 and created_at > now() - interval '35 days'
                 order by created_at desc limit 60""",
            phone,
        )
        # TENANT-SCOPED (2026-07-27). This window is what the mind reasons from AND what numbers the
        # amendable orders the synthesiser may pick as `amends_order_id`. Un-scoped, a restaurant that
        # buys from two distributors would have distributor A's basket read into distributor B's turn
        # — and a follow-up could amend the wrong distributor's order.
        orders = await con.fetch(
            """select id, lines, delivery_date, created_at, status
                 from orders where phone_number=$1 and tenant_id=$2
                   and status not in ('rejected','preparing')
                 order by created_at desc limit 8""",
            phone, tenant,
        )
        prof = await con.fetchrow(
            "select * from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, phone)

    now = datetime.now(timezone.utc)
    cut = {"3day": now - timedelta(days=3), "week": now - timedelta(days=7), "month": now - timedelta(days=35)}

    # ── «TODAY» IS THE SUPPLIER'S WORKING DAY, NOT THE UTC CALENDAR (2026-08-19) ────────────────
    # This is the LIVE rail of Raquel's «mañana» bug — the 2026-08-19 business_day fix landed on
    # the fallback extractor (orders._date_context) and this file kept handing the synthesiser
    # `now.strftime(...)` in UTC. Concretely: at 02:30 Madrid in summer, UTC has ticked over, the
    # prompt says TODAY IS the 20th, a chef's «para mañana» files for the 21st, and her 06:00 print
    # of the 20th is missing the order — «cuando voy a imprimir no lo tengo, me vuelvo loca». She
    # is at the market at exactly the hours where UTC and her working day disagree. Fail-soft to
    # the UTC date it always used, because a settings hiccup must not move everyone's orders.
    try:
        import business_day
        _bd = await business_day.for_tenant(tenant)
        dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
        today_date = f"{_bd.isoformat()} ({dias[_bd.weekday()]})"
    except Exception:
        today_date = now.strftime("%Y-%m-%d (%A)")
    win: Dict[str, List[str]] = {"3day": [], "week": [], "month": []}
    for r in reversed(rows):  # chronological
        d = r.get("created_at")
        if not isinstance(d, datetime):
            continue
        line = _fmt_msg(dict(r))
        for k, c in cut.items():
            if d >= c:
                win[k].append(line)
    # cap each window
    windows = {k: "\n".join(v[-25:]) or "(nothing in this window)" for k, v in win.items()}

    recent_orders = [dict(o) for o in orders]
    recent_orders_text = "\n".join(_order_summary(o) for o in recent_orders) or "(no past orders)"

    # The orders a follow-up could still CHANGE (needs_review/approved), numbered for the synthesiser
    # to point at via amends_ref. Shipped/rejected orders are not changeable — they don't appear here.
    open_orders = [o for o in recent_orders if o.get("status") in ("needs_review", "approved")][:5]
    open_orders_text = "\n".join(
        f"[{i + 1}] ({o.get('status')}) {_order_summary(o)}" for i, o in enumerate(open_orders)
    ) or "(no open orders to change)"

    return {
        "phone": phone,
        "tenant": tenant,
        "today_date": today_date,
        "today_text": today_text,
        "identity": identity,
        "windows": windows,
        "profile": dict(prof) if prof else None,
        "profile_text": _profile_text(dict(prof) if prof else None),
        "recent_orders": recent_orders,
        "recent_orders_text": recent_orders_text,
        "open_orders": open_orders,
        "open_orders_text": open_orders_text,
    }
