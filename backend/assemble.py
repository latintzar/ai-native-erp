"""assemble.py — the bounded turn (SPEC §4.1/§4.1.1/§4.5 ③; BUILD-PLAN 3.1). DETERMINISTIC, no LLM.

Builds the mind's perception for one turn from a party's scope. The rendered payload is a PURE
FUNCTION of the store — every read ends in `, id` so no tie can reorder, no LLM touches it — so
`assemble` twice yields a byte-identical `why_hash` (the §4.5 determinism invariant) and the context
stays BOUNDED BY CONSTRUCTION however far history grows (the slot budgets, not the row count, bind).

**THIS MODULE OWNS THE §4.1.1 CONTEXT CHECKLIST** (`COMPONENTS` below) — the canonical list of what a
full-reasoning turn's context IS, on BOTH mouths. Adding a component = a row here + a renderer here +
a slot on each mouth; `tests/vital_context.py` asserts every row appears in the ASSEMBLED BYTES of the
chat fold AND the voice pin. A component that renders on one mouth only is a bug, not a variant.

The component builders (`window_rows`, `tab_lines`, `standing_block`, `order_state_block`,
`supplier_block`) are PUBLIC and SHARED: the voice pin calls the very same functions, so the two
mouths can never drift into two different ideas of the same slot.

Fold section headers are ENGLISH (SPEC §0.11 LANGUAGE LAW — model-facing/internal); the CONTENT stays
es-ES, because the worlds these folds describe are Spanish suppliers and their customers.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import asyncpg

import soul  # WP2.2 — the authoritative frame header (pure, deterministic; no cycle: soul imports only typing)

# ── THE §4.1.1 CONTEXT COMPONENTS — the ONE registry (id → fold header) ─────────────────────────
# SPEC §4.1.1: "Every full-reasoning turn's context is EXACTLY these, both mouths (chat + voice pin),
# no silent omissions." Order here IS the render order.
COMPONENTS: dict[str, str] = {
    "frame":        "### FRAME",                 # MARCO: quién · canal · situación (+ stage job brief)
    "profile_card": "### PROFILE CARD",          # ① the identity-resolved party card (la ficha)
    "lifecycle":    "### LIFECYCLE",             # ② the deterministic stage + the §6 CHECKBOX SET
    "standing":     "### STANDING INSTRUCTIONS", # L2 standing instructions (the §4.1 ledger's row 2)
    "window":       "### RECENT HISTORY",        # ③ 7 days OR back to the oldest open tab's ORIGIN
    "tabs":         "### OPEN TABS",             # ④ open tabs + their REASONING OUTPUTS, on the line
    "supplier":     "### SUPPLIER CARD",         # ⑤ the tenant card (+ CATALOGUE once skus_uploaded)
    "order_state":  "### ORDER STATE",           # the live order draft + pending-gate state
    "right_now":    "### RIGHT NOW",             # AHORA MISMO — live cross-channel presence
    "recall":       "### RECALL",                # ⑥ hybrid recall (θ-floored, k-capped)
    "message":      "### MESSAGE",               # the burst / utterance
}
CATALOGUE_HEAD = "### CATALOGUE"   # a SUB-block of ⑤, spliced in ONLY once `skus_uploaded` is ticked
SUPPLIER_SELF_MARK = "ERES TÚ QUIEN LE SIRVE"   # the caller IS the supplier (case A of §4.1.1 ⑤)

# slot budgets in tokens (SPEC §4.1 ledger). ~4 chars/token heuristic for the deterministic bound.
CARD_BUDGET = 800
WINDOW_BUDGET = 1200
TABS_BUDGET = 400
STANDING_BUDGET = 300
WINDOW_DAYS = 7          # SPEC §4.1 — the per-stakeholder recency window (knob)
_CHARS_PER_TOK = 4


def _toks(s: str) -> int:
    return len(s) // _CHARS_PER_TOK


def _age(ts: datetime, now: datetime) -> str:
    d = now - ts
    secs = d.total_seconds()
    if secs < 3600:
        return f"hace {int(secs // 60)}m"
    if secs < 86400:
        return f"hace {int(secs // 3600)}h"
    return f"hace {int(secs // 86400)}d"


def _payload(e) -> dict:
    p = e["payload"] or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except Exception:
            p = {}
    return p if isinstance(p, dict) else {}


def _render_event(e: asyncpg.Record, now: datetime) -> str:
    p = _payload(e)
    text = p.get("text") or p.get("body") or e["type"]
    who = e["source"]
    return f"[{_age(e['ts'], now)} · {who}] {text}"


# ── ③ THE WINDOW — 7 days OR back to the oldest open tab's ORIGIN (SPEC §4.1/§4.1.1) ────────────
async def window_since(con, scope: str, now: datetime) -> datetime:
    """The window's LOWER BOUND: `now - WINDOW_DAYS`, EXTENDED backward to the ORIGIN EVENT of the
    oldest still-open tab when that reaches further (SPEC §4.1: "unless an open tab reaches further
    back … the *cause* of a 3-week dispute rides working memory regardless of the 7-day tail").

    The bound is the origin EVENT's ts (`open_loop.opened_by_event`), not `opened_at` — a tab opened
    today about a three-week-old event must pull the CAUSE in, which is exactly what `opened_at` misses
    (the audited voice-window delta). Falls back to `opened_at` when a tab has no origin event.
    The clock is the PINNED `assembled_at`, never now() — so a replay decays identically."""
    floor = now - timedelta(days=WINDOW_DAYS)
    try:
        origin = await con.fetchval(
            "select min(coalesce(e.ts, l.opened_at)) from open_loop l "
            "left join event e on e.id = l.opened_by_event "
            "where l.scope=$1::ltree and l.status='open'", scope)
    except Exception:
        origin = None
    if origin is not None and origin < floor:
        return origin
    return floor


async def window_rows(con, scope: str, now: datetime) -> list:
    """The window's ROWS, newest-first, over the §4.1 span. ALL world-lane types ride (a call, a
    payment, a delivery webhook are all "what just happened" — the voice mouth's message-only filter
    was a delta); trimming is by the TOKEN BUDGET, never a row cap.

    The `limit` is a FETCH bound, not a render cap, and it is derived so it can NEVER bind before the
    budget does: `render_window` stops at WINDOW_BUDGET tokens and every rendered line costs at least
    one token, so no fold can ever show more than WINDOW_BUDGET rows — fetching more is pure waste.
    It matters since BLOCK B2: every relationship now carries a permanently-open pursuit tab, so
    `window_since` reaches back to that tab's origin on EVERY turn rather than only for the odd
    long-running matter. Without the bound, an old relationship's every turn materialises its whole
    history before throwing almost all of it away. `ix_event_scope_ts` matches the ORDER BY, so with
    the bound Postgres stops the index scan early instead."""
    since = await window_since(con, scope, now)
    return await con.fetch(
        "select id, ts, type, source, payload from event "
        "where scope=$1::ltree and lane='world' and ts >= $2 "
        "order by ts desc, id desc limit $3", scope, since, WINDOW_BUDGET)


def render_window(rows: list, now: datetime, budget: int = WINDOW_BUDGET) -> tuple[list[str], int]:
    """Fill the window slot to its token budget, oldest trimmed first with the elision sentinel."""
    win: list[str] = []
    wtok = 0
    dropped = 0
    for i, e in enumerate(rows):
        line = _render_event(e, now)
        t = _toks(line)
        if win and wtok + t > budget:
            dropped = len(rows) - i
            break
        win.append(line)
        wtok += t
    if dropped:
        win.append(f"[+{dropped} no mostrados]")            # elision sentinel (SPEC §4.1)
    return list(reversed(win)), dropped


# ── ④ THE ADVISOR SLOT — a tab's REASONING OUTPUTS ride WITH the tab (SPEC §4.1.1 ④) ────────────
async def tab_reasoning(con, scope: str, tab_ids: list[int]) -> dict[int, str]:
    """The LATEST reasoning output per tab: {loop_id: one-line verdict}. SPEC §4.1.1 ④ — "the
    inputs/results of any tab reasoning call that produced something (cascade T1 verdicts, advisor
    recommendations, process.completed results) ride WITH their tabs".

    Every producer already writes a reasoning-lane spine event carrying `loop_id`; this is the READ
    that binds them back to their tab so the mind sees the verdict ON the line it belongs to, instead
    of an anonymous line floating in a recall block (the audited gap-2). Deterministic (`order by id`),
    fail-soft {}."""
    if not tab_ids:
        return {}
    try:
        rows = await con.fetch(
            "select coalesce(payload->>'loop_id', payload->>'tab_id')::bigint lid, type, payload "
            "from event where scope=$1::ltree and lane='reasoning' "
            "  and (payload ? 'loop_id' or payload ? 'tab_id') "
            "  and coalesce(payload->>'loop_id', payload->>'tab_id')::bigint = any($2::bigint[]) "
            "order by id desc", scope, tab_ids)
    except Exception:
        return {}
    out: dict[int, str] = {}
    for r in rows:
        lid = int(r["lid"])
        if lid in out:                      # `order by id desc` → the FIRST hit is the LATEST verdict
            continue
        p = _payload(r)
        # ONE read, several producers, each already writing its own reasoning-lane event:
        #   · the fabric's `process.completed`  → {say} / {fold.advice}
        #   · an advisor / T1 verdict           → {verdict} / {recommendation} / {result}
        #   · cascade's matched-money escalate  → {reason} on `escalate.tab`
        # A row that carries no produced TEXT (e.g. `tab.touched`, a bare T0 match) is not a reasoning
        # OUTPUT and is skipped — the slot shows judgment, not bookkeeping.
        fold = p.get("fold") if isinstance(p.get("fold"), dict) else {}
        txt = (fold.get("advice") or p.get("verdict") or p.get("recommendation")
               or p.get("say") or p.get("result") or "")
        if (not txt) and r["type"] == "escalate.tab":
            txt = f"lo subiste al jefe (motivo: {p.get('reason') or 'sin motivo registrado'})"
        if not isinstance(txt, str) or not txt.strip():
            continue
        who = p.get("process") or r["type"]
        out[lid] = f"{who}: {txt.strip()[:220]}"
    return out


def _render_tab(t, verdict: str = "") -> str:
    conts = t["contingencies"] or []
    if isinstance(conts, str):
        try:
            conts = json.loads(conts)
        except Exception:
            conts = []
    branches = ", ".join(c.get("branch_id", "?") for c in conts) if conts else "—"
    due = f" · vence {t['due_at']:%Y-%m-%d}" if t["due_at"] else ""
    key = f" [{t['entity_key']}]" if t["entity_key"] else ""
    line = f"• #{t['id']} ({t['kind']}) {t['text']}{key} → ramas: {branches}{due}"
    if verdict:
        line += f"\n    ↳ lo que ya has razonado sobre esto — {verdict}"
    return line


async def tab_lines(con, scope: str, budget: int = TABS_BUDGET, cap: int = 40) -> list[str]:
    """The OPEN TABS slot, each tab carrying its latest reasoning output. Shared by both mouths."""
    rows = await con.fetch(
        "select id, kind, text, contingencies, due_at, entity_key from open_loop "
        "where scope=$1::ltree and status='open' order by opened_at desc, id desc limit $2", scope, cap)
    verdicts = await tab_reasoning(con, scope, [int(r["id"]) for r in rows])
    lines: list[str] = []
    ttok = 0
    for i, t in enumerate(rows):
        line = _render_tab(t, verdicts.get(int(t["id"]), ""))
        if lines and ttok + _toks(line) > budget:
            lines.append(f"… (+{len(rows) - i} tabs más, ver lista)")   # counted rollup
            break
        lines.append(line)
        ttok += _toks(line)
    return lines


# ── L2 STANDING INSTRUCTIONS (SPEC §4.1 ledger row 2) ───────────────────────────────────────────
async def standing_block(con, scope: str, budget: int = STANDING_BUDGET) -> str:
    """The boss's permanent rules for this world. Ledger order: `binding DESC, priority, id`; the
    budget cuts the LOWEST-priority row first and **`binding` rows are never cut**. Fail-soft ''."""
    try:
        rows = await con.fetch(
            "select text, binding from standing_instruction where scope=$1::ltree and revoked_at is null "
            "order by binding desc, priority, id", scope)
    except Exception:
        return ""
    out: list[str] = []
    tok = 0
    dropped = 0
    for i, r in enumerate(rows):
        line = ("· [obligatorio] " if r["binding"] else "· ") + (r["text"] or "").strip()
        if out and tok + _toks(line) > budget and not r["binding"]:
            dropped = len(rows) - i
            break
        out.append(line)
        tok += _toks(line)
    if dropped:
        out.append(f"[+{dropped} no mostradas]")
    return "\n".join(out)


# ── THE LIVE ORDER DRAFT + PENDING-GATE STATE (SPEC §4.1.1 "plus the frame") ────────────────────
async def order_state_block(con, scope: str) -> str:
    """What is IN FLIGHT right now on the money path: the live order DRAFT (the last `order.drafted`
    not yet superseded by a placement) and everything the GATE parked awaiting the boss.

    Why it is a first-class component: the mind that drafted an order mid-turn, or whose sentence the
    gate parked, must SEE that on the next turn — otherwise it re-drafts, or re-promises something a
    human has not approved (the audited gap-5). Deterministic, fail-soft ''."""
    parts: list[str] = []
    try:
        row = await con.fetchrow(
            "select id, ts, payload from event where scope=$1::ltree and type='order.drafted' "
            "order by id desc limit 1", scope)
        placed = await con.fetchval(
            "select id from event where scope=$1::ltree and type in ('order.placed','order.parked') "
            "order by id desc limit 1", scope)
        if row is not None and (placed is None or int(placed) < int(row["id"])):
            p = _payload(row)
            lines = p.get("lines") or []
            unm = p.get("unmatched") or []
            body = ", ".join(
                f"{l.get('qty')} {l.get('unit') or ''} de {l.get('name')}".strip().replace("  ", " ")
                for l in lines[:8] if isinstance(l, dict))
            parts.append("BORRADOR DE PEDIDO en curso (NO colocado — lo aprueba el jefe): "
                         + (body or "(sin líneas cuadradas)")
                         + (" · sin encontrar en catálogo: "
                            + ", ".join(str(u.get('mention')) for u in unm[:4] if isinstance(u, dict))
                            if unm else ""))
    except Exception:
        pass
    try:
        rows = await con.fetch(
            "select id, kind, reason, payload from action where scope=$1::ltree and state='pending' "
            "order by id desc limit 5", scope)
        for r in rows:
            p = _payload(r)
            sent = (p.get("sentence") or p.get("draft") or "").strip()
            parts.append(f"PARADO EN LA PUERTA (#{r['id']} {r['kind']} · motivo={r['reason'] or '?'}): "
                         + (f"«{sent[:160]}» — " if sent else "")
                         + "esperando el visto bueno del jefe; NO lo des por hecho ni lo repitas como cerrado.")
    except Exception:
        pass
    return "\n".join(parts)


# ── ⑤ THE SUPPLIER CARD — both cases (SPEC §4.1.1 ⑤) ────────────────────────────────────────────
async def tenant_card(con, scope: str) -> dict:
    """The TENANT-CARD OBJECT for this scope: who the supplier is, and whether THIS caller IS them.

    SPEC §4.1.1 ⑤: the supplier card is "the same as the profile card when the caller IS the supplier;
    additional when the caller is their customer". Two cases, one object — the audit's gap-6 was that
    `tenancy.tenant_of` collapsed every scope to BRAIN_TENANT and no tenant-card object existed at all.
    Returns {tenant, name, number, is_self, boxes}. Fail-soft empty dict."""
    try:
        import lifecycle as _lc
        parts = (scope or "").split(".")
        tenant = parts[1] if len(parts) >= 2 and parts[0] == "t" and parts[1] else ""
        tier = await con.fetchval("select tier from scope_node where scope=$1::ltree", scope) or ""
        if not tenant:
            tenant = await con.fetchval(
                "select tenant_slug from scope_node where scope=$1::ltree", scope) or ""
        ctx = await _lc.onboarding_ctx(scope)
        tenant = tenant or ctx.get("tenant", "")
        name = ""
        if tenant:
            try:
                import db as _db
                async with _db.get_pool().acquire() as ocon:
                    name = await ocon.fetchval("select name from tenants where slug=$1", tenant) or ""
            except Exception:
                name = ""
        # a FALLBACK-resolved tenant that has neither a row nor a catalogue is not a supplier this
        # conversation sits behind — say so plainly rather than naming a slug nobody has heard of.
        if not tenant or (ctx.get("tenant_resolved") == "fallback"
                          and not name and int(ctx.get("n_cat") or 0) == 0):
            return {"tenant": "", "name": "", "number": None, "is_self": False,
                    "resolved": ctx.get("tenant_resolved", ""), "boxes": _lc.boxes_of(ctx, tier=tier)}
        # the caller IS the supplier when the scope IS the tenant root or they hold the tenant's own
        # tier (boss/colleague/creator); a `t.<slug>.c.<id>` customer scope is case B.
        is_self = (scope == f"t.{tenant}") or (tier in ("boss", "colleague", "creator"))
        return {"tenant": tenant, "name": name, "number": ctx.get("number"), "is_self": is_self,
                "resolved": ctx.get("tenant_resolved", ""), "boxes": _lc.boxes_of(ctx, tier=tier)}
    except Exception:
        return {}


async def supplier_catalogue(con, scope: str, card: dict | None = None) -> dict:
    """The SUPPLIER CARD slot + the CATALOGUE sub-block + **the catalogue's completeness flags**.

    THE SPLICE (SPEC §6): the catalogue listing is returned ONLY when the `skus_uploaded` box is
    ticked. Pre-upload the caller gets the supplier card WITHOUT a catalogue and the LIFECYCLE slot
    states, in words, that this is KNOWN-STATE — never a hole the mind has to guess about.

    THE FLAGS (SPEC §5.10.1): `tier` · `names_complete` · `prices_complete` come straight off the
    stored directory row, because the catalogue body is COMPACTED BY SIZE and the runtime has to be
    able to branch on how complete it is WITHOUT parsing Spanish. They are what gates the
    `look_up_product` capability: exposed iff `names_complete and prices_complete` is false — i.e. at
    tiers B/C/D and on any scope with no directory at all. At tier A the card genuinely holds the
    whole book and the tool would buy nothing but latency (§5.2 bounded action space).

    Returns {supplier, catalogue, tier, names_complete, prices_complete, n_skus}."""
    c = card if card is not None else await tenant_card(con, scope)
    boxes = (c or {}).get("boxes") or {}
    out = {"supplier": "", "catalogue": "", "tier": None,
           "names_complete": False, "prices_complete": False, "n_skus": 0}
    if not (c or {}).get("tenant"):
        out["supplier"] = ("Todavía NO hay proveedor dado de alta detrás de esta conversación: no "
                           "existe ficha de empresa ni catálogo — es lo normal en esta fase, no un "
                           "dato que falte.")
        return out
    who = (c.get("name") or c.get("tenant") or "").strip()
    num = f" · número {c['number']}" if c.get("number") else " · sin número propio todavía"
    if c.get("is_self"):
        out["supplier"] = (f"{SUPPLIER_SELF_MARK}: esta persona ES el proveedor — {who}{num}. Su ficha "
                           "de arriba ES la ficha de la empresa; tú trabajas PARA él.")
    else:
        out["supplier"] = (f"Esta persona es CLIENTE de {who}{num} — tú eres el empleado de {who} y le "
                           "atiendes en su nombre. Nunca nombres a otro cliente de este proveedor.")
    if boxes.get("skus_uploaded"):
        try:
            import directory as _directory
            d = await _directory.card_for_scope(con, scope)
            out.update({"catalogue": d["body"], "tier": d["tier"], "n_skus": d["n_skus"],
                        "names_complete": d["names_complete"],
                        "prices_complete": d["prices_complete"]})
        except Exception:
            pass
    return out


async def supplier_block(con, scope: str, card: dict | None = None) -> tuple[str, str]:
    """(supplier_body, catalogue_body) — the SHARED builder both mouths call (voice: app.py's call
    session → voice_protocol._grounding_block; chat: the COMPONENTS registry below). Kept at two
    values so neither mouth changes shape; anything that needs the §5.10.1 completeness flags calls
    `supplier_catalogue` instead. Either value may be ''."""
    d = await supplier_catalogue(con, scope, card)
    return (d["supplier"], d["catalogue"])


async def assemble(con: asyncpg.Connection, scope: str, burst_text: str = "",
                   assembled_at: Optional[datetime] = None, qv: Optional[list] = None) -> dict[str, Any]:
    """Assemble the bounded turn for `scope`. Returns a dict with `rendered` (the prompt-ready text),
    `why_hash`, `tokens`, `card`, and structured `window`/`tabs`. Pinned clock: pass `assembled_at`
    for a replay (defaults to now). WP-3: pass the turn's precomputed `qv` (embedded ONCE) to drive the
    §4.4 RECALL pre-pass deterministically — so the central claim ('como el año pasado') can finally
    fire on a TEXT turn, and the fold is byte-reproducible for the `why` replay.

    B1: the render is the §4.1.1 COMPONENTS registry, in registry order. Every component is either
    present or its absence is stated (never silently missing) — `tests/vital_context.py` is the gate."""
    now = assembled_at or datetime.now(timezone.utc)

    card = await con.fetchval("select body from card where scope=$1::ltree", scope) or ""
    # WP2.2 — the party's tier, read in the SAME snapshot (indexed PK lookup, deterministic) to pin the
    # compact frame header. This is the DATA-plane copy of the frame (QUIÉN·CANAL only — the full
    # SITUACIÓN posture lives once at the top of the soul heads, never duplicated inside one fold).
    tier = await con.fetchval("select tier from scope_node where scope=$1::ltree", scope) or "prospect"

    # ③ window — 7 days OR back to the oldest open tab's ORIGIN, token-budgeted, every row dated.
    rows = await window_rows(con, scope, now)
    window_chrono, _dropped = render_window(rows, now)

    # ④ open tabs — each carrying its latest REASONING OUTPUT (the advisor slot).
    tabs = await tab_lines(con, scope)

    # ② lifecycle — the deterministic stage + the §6 CHECKBOX SET (fail-soft: never a hole).
    #
    # ROCOTO'S OWN SALES LIFECYCLE HAS NO PLACE IN A REHEARSAL (2026-08-16, measured on a real
    # prospect). `lifecycle` tracks OUR commercial relationship with the SUPPLIER — fresh → prospect
    # → onboarded → the founder offer. In a `test.` world the party on the other end is not the
    # supplier at all: it is the supplier's own CUSTOMER, played by a visitor trying the product. So
    # the stage was answering a question nobody in the conversation had asked, and the mind did the
    # obvious thing with it — Xavier Sitjar's very first message on 2026-08-13 opened «veo que ya
    # estás dado de alta — catálogo cargado, cuota pagada, todo en orden», a fabricated statement
    # about his own account, in the voice of the business he was evaluating.
    #
    # The POSTURE the demo wants is the `onboarded` one (work like an employee already inside, zero
    # selling); what it must never carry is the alta/cuota/oferta vocabulary that posture is written
    # in. So a test world gets that posture stated for its own situation, and the checkbox set is
    # dropped rather than translated — those boxes are onboarding facts about a supplier who, here,
    # is the person reading the screen rather than the person being spoken to.
    lc_block, lc_boxes = "", {}
    import spine as _spine  # THE one derivation of «is this a rehearsal» (spine.lineage_of)
    if _spine.lineage_of(scope) == "test":
        lc_block = (
            "fase=ensayo · relación=cliente (mundo de prueba)\n"
            "TU PUESTO AHORA — EMPLEADO YA DENTRO de este negocio: tienes su catálogo y trabajas "
            "como quien lleva tiempo aquí. Pedidos cuadrados contra el catálogo, memoria de lo que "
            "os traéis entre manos, cero venta.\n"
            "QUIEN TE ESCRIBE ES UN CLIENTE DEL NEGOCIO, no el negocio. Su alta, su cuota, su "
            "contrato y cualquier condición comercial de Rocoto quedan FUERA de esta conversación: "
            "no los menciones, no los des por hechos y no los preguntes.")
    else:
        try:
            import lifecycle as _lifecycle
            st = await _lifecycle.status(scope, tier)
            lc_boxes = st.get("boxes") or {}
            lc_block = (f"fase={st.get('stage')} · relación={st.get('tier')} (derivado, comprobado — no supuesto)\n"
                        + _lifecycle.checkbox_block(lc_boxes))
        except Exception:
            lc_block = "(fase no disponible en este momento — no asumas nada sobre su alta)"

    # L2 standing instructions.
    standing = await standing_block(con, scope)

    # ⑤ supplier card (+ the CATALOGUE sub-block, spliced by the skus_uploaded box). The §5.10.1
    # completeness flags ride out with it: the catalogue is compacted BY SIZE, so what the turn may
    # answer from memory — and whether `look_up_product` belongs in this turn's action space — is a
    # measured property of the pinned knowledge, not a role guess.
    sup = {}
    try:
        sup = await supplier_catalogue(con, scope)
    except Exception:
        sup = {}
    sup_body, dir_block = sup.get("supplier", ""), sup.get("catalogue", "")

    # the live order draft + pending-gate state.
    order_state = await order_state_block(con, scope)

    # §4.4 RECALL — the pre-pass (WP-3): deeper memory the card+window don't already show.
    # Deterministic (search carries a text tiebreak + the pinned qv), so the fold stays byte-reproducible.
    recall_lines: list[str] = []
    if burst_text:
        try:
            import memory
            for h in await memory.search(con, scope, burst_text, k=8, qv=qv, now=now):
                t = (h.get("text") or "").strip()
                if t and t not in card:            # never echo a line already on the (fresh) card
                    recall_lines.append(f"— {t}")
        except Exception:
            pass

    # §15 CHANNEL CONTINUITY — the RIGHT NOW liveness block (a live call on this scope makes a chat
    # turn AWARE it's the same conversation happening on the phone right now). Deterministic from spine
    # events + the pinned clock; empty when nothing is live. Fail-soft.
    ahora = ""
    try:
        import presence_call
        ahora = await presence_call.ahora_block(con, scope, channel="chat", now=now)
    except Exception:
        pass

    # ── render — the §4.1.1 registry, in registry order (SPEC §4.5: labelled slots, not a blob) ──
    C = COMPONENTS
    parts = [C["frame"] + "\n" + soul.frame_block(tier, "chat", compact=True),
             C["profile_card"], card or "(sin ficha todavía — aún no sabes casi nada de esta persona)",
             "\n" + C["lifecycle"], lc_block,
             "\n" + C["standing"], standing or "(el jefe no te ha dejado ninguna instrucción permanente aquí)",
             "\n" + C["window"], *(window_chrono or ["(nada reciente)"]),
             "\n" + C["tabs"], *(tabs or ["(ninguno)"]),
             "\n" + C["supplier"], sup_body or "(sin proveedor detrás de esta conversación)"]
    if dir_block:
        parts += ["\n" + CATALOGUE_HEAD, dir_block]
    parts += ["\n" + C["order_state"], order_state or "(nada en curso ni parado en la puerta)"]
    parts += ["\n" + C["right_now"], ahora or "(nada en marcha en otro canal ahora mismo)"]
    parts += ["\n" + C["recall"], *(recall_lines or ["(la búsqueda no ha traído nada relevante)"])]
    parts += ["\n" + C["message"], burst_text or "(sin mensaje — turno propio)"]
    rendered = "\n".join(parts)
    why_hash = hashlib.sha256(rendered.encode("utf-8")).hexdigest()

    return {
        "rendered": rendered,
        "why_hash": why_hash,
        "tokens": _toks(rendered),
        "card": card,
        "window": window_chrono,
        "tabs": tabs,
        "standing": standing,
        "supplier": sup_body,
        "catalogue": dir_block,
        # §5.10.1 — what the mind may answer about the book FROM MEMORY on this turn. `tier` is the
        # derived compaction level (A/B/C/D); `names_complete` is true when every article is
        # representable in the body (A/B/C) so a «no lo llevamos» is safe; `prices_complete` is true
        # only at A. `look_up_product` belongs in the turn iff NOT (names and prices complete).
        "catalogue_tier": sup.get("tier"),
        "names_complete": bool(sup.get("names_complete")),
        "prices_complete": bool(sup.get("prices_complete")),
        "catalogue_lookup_needed": not (bool(sup.get("names_complete")) and bool(sup.get("prices_complete"))),
        "order_state": order_state,
        "lifecycle_block": lc_block,
        "boxes": lc_boxes,
        "n_events_available": len(rows),
        "assembled_at": now.isoformat(),
    }
