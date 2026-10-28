"""directory.py — THE SUPPLIER-CARD PRODUCT DIRECTORY (PRODUCT-SPEC §5.10.1; §6/WP-4). Organ ③.

The Tier-0 "knows the menu cold" knowledge: the tenant's catalogue_skus DISTILLED into a compact
directory block pinned into EVERY fold for that supplier (boss AND their customers, voice AND chat) —
so «¿tenéis tomates cherry?» is answered inline from pinned knowledge, never a catalogue lookup.

**THE CARD IS FOR *KNOWING*; catalogue_skus IS FOR *MATCHING*.** The grounding (exact, unbounded, in
Postgres) is what an order line stands on. This body is what the mind holds in its head. Keeping the
two apart is the whole design, and it buys ONE refusal: *a card is never allowed to make the mind
confident about an ABSENCE it cannot see*.

§5.10.1 — GRADUATED TIERING (Peter, 2026-07-27: «it summarizes down in different brackets … so it
wouldn't summarize down to the small amounts of characters for a list that are in the highest amount
of character tiers»). Four renderings, and **the tier is DERIVED BY FIT, never by a SKU threshold**:
render A; if it fits the ceiling, stop; else B, then C, then D (then D dense, then D elided — the only
place anything is ever missing, and the one place the body says so out loud).

  A · VERBATIM  one line per SKU with its price      keeps everything                 (~46 B/SKU)
  B · NOMBRES   every name, price RANGE per family   drops the per-SKU price          (~30 B/SKU)
  C · CALIBRES  one line per product STEM + its      drops the literal full name of   (~32 B/stem)
                dimension set                        a folded row, and the price
  D · FAMILIAS  per-family count + range + top       drops WHICH ARTICLES EXIST      (~141 B/family)
                stems                                                                 O(families)

Why that order: the first thing you can afford to lose is the exact price (the mind must look a price
up before quoting it either way — §4.1 «exactness never depends on the card»); the next is the literal
spelling of a calibre (the product and its calibre SET both survive); and only last, and loudly, the
article list itself.

THE HEAD TRAVELS WITH THE BODY. Each tier's Spanish head states what this card is and is not, and it
is stored INSIDE `body` — never in a prompt template — because the body is what gets cached, spliced
into two mouths and replayed in a why-trace, and a warning that lives anywhere else will one day be
present on one mouth and absent on the other. At tier D the head carries, verbatim, «no digas que no
lo tienes». Two structured flags ride with it so the runtime never has to parse Spanish:
`names_complete` (A, B, C) and `prices_complete` (A only) — they are what gates `look_up_product`.

Mechanics (review H7 — the trigger must be DEBOUNCED, never per-SKU):
  · catalogue_skus loads row-at-a-time (Medusa subscriber / seed). schedule_rebuild(tenant) arms a
    debounce timer; the LAST upsert wins; when ingest settles the distill runs ONCE and emits
    `onboarding.catalogue_ready` on the tenant scope.
  · IDEMPOTENT: the SKU set is content-hashed TOGETHER WITH the renderer version and the ceiling, so
    a renderer change or a re-budget invalidates every stored body by construction (a stored body
    from an older renderer can never be served as "unchanged").
  · FAIL-SOFT: a distill failure keeps the LAST GOOD directory + surfaces via ops (never a hole).
  · The renderer is ARITHMETIC, always (§5.10.1). A model may contribute exactly one thing — a GROUP
    MAP (`{sku_id → label}`, validated, discarded WHOLE on any violation) — because a summariser
    licensed to write free text into this slot is a summariser licensed to invent an article, and
    that is the standing law: never invent a SKU, abstain rather than guess.

Storage: catalogue_directory (tenant_id pk, body, alias_map, sku_hash, n_skus, group_map, tier,
names_complete, prices_complete, budget_bytes, generated_at) — additive.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from typing import Any, Optional

log = logging.getLogger("rocoto.directory")

# THE CEILING (§5.10.1 knob `ROCOTO_DIRECTORY_BYTES`): 4,400 B ≈ 1,100 tok, and the §4.1 ledger now
# carries the row that pays for it. It was 2,600, which crushed a 65-line charcutería list (2,986 B
# verbatim) into the family rollup — Peter's complaint, already true in production.
CEILING = int(os.environ.get("ROCOTO_DIRECTORY_BYTES", "4400"))
BYTE_BUDGET = CEILING          # back-compat alias (older vitals read directory.BYTE_BUDGET)
DEBOUNCE_S = float(os.environ.get("ROCOTO_DIRECTORY_DEBOUNCE_S", "20"))

# bump when a renderer changes shape — it is part of the idempotency key, so every stored body
# rebuilds on the next distill instead of being served stale under an unchanged sku_hash.
RENDER_VERSION = "t1"

_PENDING: dict[str, asyncio.Task] = {}          # tenant → armed debounce task


# ── the heads (§5.10.1, verbatim) ───────────────────────────────────────────────────────────────
# es-ES, model-facing. Each says exactly what the mind may answer from memory and what it must go
# and look up. The D head is the one that keeps a compressed card honest.
HEAD_A = ("Tienes el catálogo ENTERO delante, con precios. Responde de memoria: qué hay, qué no hay "
          "y a cuánto.")
HEAD_B = ("Tienes TODOS los artículos delante; los precios van por familia. Qué hay y qué no hay, de "
          "memoria. Un precio concreto, míralo antes de decirlo.")
HEAD_C = ("Tienes todos los artículos delante, agrupados por calibre/formato; los precios van por "
          "familia. Qué hay y qué no, de memoria. Un precio concreto, míralo antes de decirlo.")
HEAD_D = ("Esto es un RESUMEN POR FAMILIAS de un catálogo de {n} artículos: NO está todo listado. Si "
          "algo no aparece aquí, no digas que no lo tienes — búscalo.")
# the ONE sentence that must survive every compaction. Asserted verbatim by vital_directory_tiers.
NO_DENIAL = "no digas que no lo tienes"
# the elision sentinel — the only place a family can be missing, and it says so.
ELIDED = "[+{m} familias no mostradas — pregúntame y lo miro]"


async def ensure_schema(con) -> None:
    """Verify the explicit deployment revision before directory operations."""
    from schema_migrations import assert_current

    await assert_current(con)



# ═══════════════════════════════════════════════════════════════════════════════════════════════
# THE STEM — shared with doubt.py (§5.10.4). ONE definition of "the same product at a different
# calibre", or the card shows a customer calibres the doubt faculty will not ask about.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
def catalogue_stem(name: str) -> str:
    """The product STEM: the leading two DIGIT-FREE words of the catalogue name, upper-cased.

    This is how these catalogues are written — «CHORIZO SARTA EXTRA 500 G» vs «CHORIZO SARTA EXTRA
    1 KG» — and it is the same notion `doubt._same_product` compares on (§5.7a DIMENSIONLESS). Tier C
    groups by exactly this, so the two must be ONE function: if they drift, the card and the doubt
    faculty disagree about what a product IS."""
    words = [w for w in str(name or "").upper().split() if not any(ch.isdigit() for ch in w)]
    return " ".join(words[:2])


def _dimension_of(name: str, stem: str) -> str:
    """What is left of the name once the stem is taken off the front — «EXTRA 500 G». '' when the
    name IS the stem."""
    up = " ".join(str(name or "").upper().split())
    if stem and up.startswith(stem):
        return up[len(stem):].strip()
    return up


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# THE GROUP MAP — the ONE thing a model may contribute, and it is DATA, never prose.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
def validate_group_map(gmap: Any, rows) -> dict:
    """Return the map iff it is total, exact and label-clean; else {} — DISCARDED WHOLE, never
    partially applied (§5.10.1).

      · every id in the map exists in the SKU set;
      · every id in the set appears exactly once;
      · a label may not contain a digit-bearing token (that is a product name leaking into a group
        label, i.e. the model naming an article — the exact thing it is not allowed to do).
    """
    if not isinstance(gmap, dict) or not gmap:
        return {}
    ids = {str(r["id"]) for r in rows}
    if set(map(str, gmap.keys())) != ids:
        return {}
    out: dict[str, str] = {}
    for k, v in gmap.items():
        label = str(v or "").strip()
        if not label:
            return {}
        if any(any(ch.isdigit() for ch in tok) for tok in label.split()):
            return {}
        out[str(k)] = label
    return out


def _groups(rows, gmap: Optional[dict] = None) -> list[tuple[str, list]]:
    """(label, rows) in a DETERMINISTIC order: label A→Z, rows by name. The label comes from the
    validated group map where present, and from the `family` column where not — an unavailable model
    costs a shade of organisation and nothing else (never a hole, never stale, never blocking)."""
    buckets: dict[str, list] = {}
    for r in rows:
        if gmap:
            label = gmap.get(str(r["id"])) or (r["family"] or "otros")
        else:
            label = r["family"] or "otros"
        label = str(label).strip().replace("_", " ").upper() or "OTROS"
        buckets.setdefault(label, []).append(r)
    return [(lab, sorted(buckets[lab], key=lambda x: (str(x["name"]), str(x["id"]))))
            for lab in sorted(buckets)]


# ── price formatting: es-ES, comma decimal (the house style everywhere else in the product) ─────
def _num(p) -> str:
    return f"{float(p):.2f}".replace(".", ",")


def _eur(p) -> str:
    return _num(p) + "€"


def _range(items) -> str:
    """The family's price BAND — «3,90–19,80€», one € for the pair (it is one band, not two prices)."""
    prices = [float(r["price"]) for r in items if r["price"] is not None]
    if not prices:
        return ""
    lo, hi = min(prices), max(prices)
    return f" · {_eur(lo)}" if lo == hi else f" · {_num(lo)}–{_eur(hi)}"


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# THE FOUR RENDERINGS — pure functions of (rows, groups). No I/O, no clock, no model.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
def _render_a(groups) -> str:
    """A · VERBATIM — one line per SKU with its own price. Keeps EVERYTHING."""
    out: list[str] = []
    for lab, items in groups:
        out.append(f"• {lab} ({len(items)}):")
        for r in items:
            price = f" — {_eur(r['price'])}/{r['base_unit']}" if r["price"] is not None else ""
            out.append(f"    {r['name']}{price}")
    return "\n".join(out)


def _render_b(groups) -> str:
    """B · NOMBRES — every name survives; the per-SKU price folds into the family's price BAND."""
    out: list[str] = []
    for lab, items in groups:
        names = " · ".join(str(r["name"]) for r in items)
        out.append(f"• {lab} ({len(items)}{_range(items)}): {names}")
    return "\n".join(out)


def _render_c(groups) -> str:
    """C · CALIBRES — the same names as B, with each product's CALIBRE SET folded onto one entry:
    `CHORIZO SARTA — EXTRA 500 G / EXTRA 1 KG`. Every product and every calibre of it survives; what
    is lost is the literal full spelling of a folded row.

    TWO DELIBERATE DEPARTURES from the §5.10.1 sketch, both to keep the LADDER MONOTONE — a rung that
    can render BIGGER than the rung above it is not a rung, it is a lie, and the whole "chosen by
    fit" design rests on each step being strictly cheaper:
      · the family stays ONE line (as in B) instead of one line per stem — the 4-space indent and a
        newline per stem cost more than they save on a catalogue of mostly single-calibre articles;
      · a stem with exactly ONE row prints its FULL NAME verbatim, with no `—` separator, because
        the separator (an em dash is 3 bytes) would make C cost MORE than B on that row and buys
        nothing: with one calibre there is no set to show."""
    out: list[str] = []
    for lab, items in groups:
        order: list[str] = []
        dims: dict[str, list[str]] = {}
        names: dict[str, list[str]] = {}
        for r in items:
            st = catalogue_stem(r["name"]) or str(r["name"]).upper()
            if st not in dims:
                dims[st], names[st] = [], []
                order.append(st)
            names[st].append(str(r["name"]))
            dim = _dimension_of(r["name"], st)
            if dim and dim not in dims[st]:
                dims[st].append(dim)
        entries = []
        for st in sorted(order):
            if len(names[st]) <= 1:
                entries.append(names[st][0])
                continue
            plain = " · ".join(names[st])
            folded = f"{st} — {' / '.join(dims[st])}" if dims[st] else st
            # NEVER pay more than B for the same information. The stem is the leading two DIGIT-FREE
            # words, which is not always a PREFIX of the name («500 G CHORIZO SARTA»); when it is not,
            # the "dimension" is the whole name again and folding would cost the stem for nothing.
            # Taking the cheaper of the two per stem is what makes C ≤ B by construction.
            entries.append(folded if len(folded.encode()) <= len(plain.encode()) else plain)
        out.append(f"• {lab} ({len(items)}{_range(items)}): " + " · ".join(entries))
    return "\n".join(out)


def _render_d(groups, tops: Optional[int] = 4) -> str:
    """D · FAMILIAS — O(families), not O(SKUs): count, price band, the family's product STEMS,
    `(+N más)` for whatever did not fit. `tops=None` lists every stem; `tops=0` lists none.

    HOW MANY STEMS IS CHOSEN BY FIT, like the tier itself (see `render`): a 250-row catalogue that
    overflows tier C still has room to name nearly every product it sells, and spending that room is
    the difference between the mind knowing «vendemos CHORIZO SARTA» and only knowing «vendemos
    embutido curado». Leaving 3.5 kB of the budget unused while dropping article knowledge would be a
    bug wearing a tier's clothes.

    The stems are ALPHABETICAL, not "most ordered", on purpose: the body's idempotency key is the SKU
    hash, so a body that moved with order frequency would go stale silently — the distill would never
    re-fire when the counts changed. A deterministic list that is always current beats a livelier one
    that rots."""
    out: list[str] = []
    for lab, items in groups:
        head = f"• {lab} ({len(items)}{_range(items)})"
        if tops is not None and tops <= 0:
            out.append(head)
            continue
        stems: list[str] = []
        for r in items:
            st = catalogue_stem(r["name"]) or str(r["name"]).upper()
            if st not in stems:
                stems.append(st)
        stems.sort()
        shown = stems if tops is None else stems[:tops]
        more = len(stems) - len(shown)
        tail = ", ".join(shown) + (f" (+{more} más)" if more > 0 else "")
        out.append(f"{head}: {tail}")
    return "\n".join(out)


def _head(tier: str, n_skus: int, n_groups: int) -> str:
    """The head that TRAVELS WITH THE BODY (§5.10.1) — what this card is, and what it is not."""
    if tier == "D":
        return "CATÁLOGO — " + HEAD_D.format(n=n_skus)
    line = {"A": HEAD_A, "B": HEAD_B, "C": HEAD_C}[tier]
    return f"CATÁLOGO ({n_skus} artículos · {n_groups} familias — precios de lista). {line}"


def render(rows, ceiling: Optional[int] = None, gmap: Optional[dict] = None) -> dict:
    """THE LADDER. Pure: same rows + same ceiling ⇒ byte-identical body (the §4.5 determinism the
    fold depends on). Returns {body, tier, names_complete, prices_complete, bytes, budget_bytes,
    n_skus, n_groups, elided_groups}.

    Chosen BY FIT, never by a hardcoded SKU threshold: a supplier whose article names are sentences
    degrades one tier earlier, automatically, instead of blowing the turn budget."""
    cap = int(ceiling or CEILING)
    rows = list(rows)
    n = len(rows)
    groups = _groups(rows, validate_group_map(gmap, rows) if gmap else None)
    g = len(groups)

    def _fits(tier: str, body: str) -> Optional[dict]:
        head = _head(tier, n, g)
        full = head + "\n" + body
        if len(full.encode()) <= cap:
            return {"body": full, "tier": tier, "bytes": len(full.encode()),
                    "names_complete": tier in ("A", "B", "C"), "prices_complete": tier == "A",
                    "budget_bytes": cap, "n_skus": n, "n_groups": g, "elided_groups": 0}
        return None

    for tier, body in (("A", _render_a(groups)), ("B", _render_b(groups)), ("C", _render_c(groups))):
        hit = _fits(tier, body)
        if hit:
            return hit

    # D, spending whatever room is left on product STEMS — most generous first. The family line
    # degrades before a family is ever dropped (§5.10.1: "Tier D never truncates a family" —
    # protected content collapses to a rollup, it does not spill or silently drop).
    for tops in (None, 24, 12, 8, 4, 2, 1, 0):
        hit = _fits("D", _render_d(groups, tops=tops))
        if hit:
            return hit

    # Only now — a catalogue with more families than the ceiling can name even at one line each.
    # Keep the BIGGEST families, and say out loud how many are missing. Nothing here is silent.
    head = _head("D", n, g)
    room = cap - len(head.encode()) - 1
    by_size = sorted(groups, key=lambda kv: (-len(kv[1]), kv[0]))
    kept: list = []
    used = 0
    for lab, items in by_size:
        line = _render_d([(lab, items)], tops=0)
        cost = len(line.encode()) + 1
        # always leave room for the sentinel, which is what makes the elision honest
        if used + cost + len(ELIDED.format(m=g).encode()) + 1 > room:
            break
        kept.append((lab, items))
        used += cost
    kept.sort(key=lambda kv: kv[0])
    lines = [_render_d([(lab, items)], tops=0) for lab, items in kept]
    missing = g - len(kept)
    if missing > 0:
        lines.append(ELIDED.format(m=missing))
    full = head + "\n" + "\n".join(lines)
    return {"body": full, "tier": "D", "bytes": len(full.encode()), "names_complete": False,
            "prices_complete": False, "budget_bytes": cap, "n_skus": n, "n_groups": g,
            "elided_groups": missing}


def _hash_rows(rows, ceiling: Optional[int] = None, gmap: Optional[dict] = None) -> str:
    """The idempotency key: the SKU set AND the renderer version AND the ceiling AND the group map.
    An unchanged catalogue never re-distills; a changed RENDERER always does."""
    h = hashlib.sha256()
    h.update(f"{RENDER_VERSION}|{int(ceiling or CEILING)}|".encode())
    for r in rows:
        h.update(f"{r['id']}|{r['name']}|{r['base_unit']}|{r['price']}|{r['family']}".encode())
    if gmap:
        for k in sorted(gmap):
            h.update(f"|g:{k}={gmap[k]}".encode())
    return h.hexdigest()[:32]


async def build(tenant_id: str, force: bool = False) -> dict:
    """Distill the tenant's catalogue into the directory. Idempotent on the SKU hash. Fail-soft:
    keeps the last good body on any error. Returns {built, n_skus, tier, bytes, reason}."""
    import db
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await ensure_schema(con)
            rows = await con.fetch(
                "select id, name, family, base_unit, price from catalogue_skus "
                "where tenant_id=$1 and in_assortment order by family, name, id", tenant_id)
            if not rows:
                return {"built": False, "n_skus": 0, "reason": "no_skus"}
            prev = await con.fetchrow(
                "select sku_hash, group_map from catalogue_directory where tenant_id=$1", tenant_id)
            gmap_raw = (prev["group_map"] if prev else None) or {}
            if isinstance(gmap_raw, str):
                import json as _json
                try:
                    gmap_raw = _json.loads(gmap_raw)
                except Exception:
                    gmap_raw = {}
            gmap = validate_group_map(gmap_raw, rows)
            h = _hash_rows(rows, gmap=gmap)
            if prev and prev["sku_hash"] == h and not force:
                return {"built": False, "n_skus": len(rows), "reason": "unchanged"}
            d = render(rows, gmap=gmap)
            alias_map = {}
            for r in rows:
                first = (r["name"] or "").split()[0].lower()
                if len(first) > 3:
                    alias_map.setdefault(first, r["name"])
            await con.execute(
                "insert into catalogue_directory(tenant_id, body, alias_map, sku_hash, n_skus, "
                "tier, names_complete, prices_complete, budget_bytes) "
                "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (tenant_id) do update set "
                "body=excluded.body, alias_map=excluded.alias_map, sku_hash=excluded.sku_hash, "
                "n_skus=excluded.n_skus, tier=excluded.tier, names_complete=excluded.names_complete, "
                "prices_complete=excluded.prices_complete, budget_bytes=excluded.budget_bytes, "
                "generated_at=now()",
                tenant_id, d["body"], alias_map, h, len(rows),
                d["tier"], d["names_complete"], d["prices_complete"], d["budget_bytes"])
        # the settled-ingest event (the §6/H7 trigger contract, deduped on the hash)
        try:
            import spine
            scope = f"t.{tenant_id}"
            async with db.scoped_tx(scope) as con:
                await spine.append_event(con, scope, "onboarding.catalogue_ready", "directory",
                                         {"tenant_id": tenant_id, "n_skus": len(rows), "sku_hash": h,
                                          "tier": d["tier"], "bytes": d["bytes"]},
                                         lane="world", dedupe_key=f"catready:{tenant_id}:{h}")
        except Exception:
            log.debug("directory: catalogue_ready event fail-soft", exc_info=True)
        log.info("directory: built for %s (%d skus, tier %s, %d B)", tenant_id, len(rows),
                 d["tier"], d["bytes"])
        return {"built": True, "n_skus": len(rows), "tier": d["tier"], "bytes": d["bytes"],
                "elided_groups": d["elided_groups"], "reason": "built"}
    except Exception:
        log.warning("directory: build FAILED for %s — keeping last good (fail-soft)", tenant_id,
                    exc_info=True)
        return {"built": False, "n_skus": 0, "reason": "error_kept_last_good"}


async def set_group_map(tenant_id: str, gmap: dict) -> dict:
    """Store a model-produced GROUP MAP and re-render on it. Validated first and discarded WHOLE on
    any violation (§5.10.1) — a partially-applied map is a card that names articles the model made
    up. Never blocks: a rejected map leaves the family-column body exactly as it was."""
    import db
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await ensure_schema(con)
            rows = await con.fetch(
                "select id, name, family, base_unit, price from catalogue_skus "
                "where tenant_id=$1 and in_assortment order by family, name, id", tenant_id)
            if not rows:
                return {"ok": False, "reason": "no_skus"}
            clean = validate_group_map(gmap, rows)
            if not clean:
                return {"ok": False, "reason": "rejected_whole"}
            await con.execute(
                "insert into catalogue_directory(tenant_id, body, alias_map, sku_hash, n_skus, group_map) "
                "values($1,'',  '{}'::jsonb, '', 0, $2) on conflict (tenant_id) do update set "
                "group_map=excluded.group_map", tenant_id, clean)
        r = await build(tenant_id, force=True)
        return {"ok": bool(r.get("built")), "reason": r.get("reason"), "tier": r.get("tier")}
    except Exception:
        log.warning("directory: set_group_map failed for %s (fail-soft)", tenant_id, exc_info=True)
        return {"ok": False, "reason": "error"}


def schedule_rebuild(tenant_id: str) -> None:
    """The DEBOUNCED trigger (review H7): each upsert re-arms; the distill runs once ingest settles.
    Never blocks the upsert path, never raises."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    async def _later():
        try:
            await asyncio.sleep(DEBOUNCE_S)
            await build(tenant_id)
        except asyncio.CancelledError:
            pass
        except Exception:
            log.debug("directory: debounced build fail-soft", exc_info=True)
        finally:
            _PENDING.pop(tenant_id, None)

    old = _PENDING.get(tenant_id)
    if old and not old.done():
        old.cancel()
    _PENDING[tenant_id] = loop.create_task(_later())


async def card_for_scope(con, scope: str) -> dict:
    """THE read for a party scope: {body, tier, names_complete, prices_complete, n_skus}.

    `body` is '' when the tenant has no directory — and then `names_complete`/`prices_complete` are
    FALSE, which is the honest reading: a mouth with no card knows nothing about the book and must
    look everything up.

    NOTE: reads via the OWNER pool, not the passed scoped (RLS) connection — catalogue_directory is a
    commerce-world read-model keyed by tenant (exactly like catalogue_skus in orders_tool), not a
    scope-fenced runtime table; the rt role has no grant on it by design."""
    empty = {"body": "", "tier": None, "names_complete": False, "prices_complete": False, "n_skus": 0}
    try:
        import db
        import tenancy
        tenant = tenancy.tenant_of(scope)
        pool = db.get_pool()
        async with pool.acquire() as ocon:
            try:
                row = await ocon.fetchrow(
                    "select body, n_skus, tier, names_complete, prices_complete "
                    "from catalogue_directory where tenant_id=$1", tenant)
            except Exception:
                # THE DEPLOY WINDOW: `db.py`'s BRAIN_SCHEMA still creates this table with the first
                # cut's columns, and `ensure_schema` only adds the §5.10.1 ones on the next DISTILL.
                # Between a code deploy and that distill the columns can be absent — and losing the
                # whole catalogue from the fold over a missing metadata column would be a far worse
                # bug than not knowing the tier. Read what is certainly there, and assume the
                # CONSERVATIVE reading of what is not (incomplete ⇒ look it up).
                r2 = await ocon.fetchrow(
                    "select body, n_skus from catalogue_directory where tenant_id=$1", tenant)
                if not r2 or not (r2["body"] or "").strip():
                    return empty
                return {"body": r2["body"], "tier": None, "names_complete": False,
                        "prices_complete": False, "n_skus": r2["n_skus"] or 0}
        if not row or not (row["body"] or "").strip():
            return empty
        body = row["body"]
        # a body stored by an older renderer carries no head of its own; never serve it bare, and
        # never claim completeness we cannot see. (The next distill replaces it — RENDER_VERSION is
        # in the hash — this is only the window in between.)
        if not body.lstrip().startswith("CATÁLOGO"):
            body = _head("D", row["n_skus"] or 0, 0) + "\n" + body
            return {"body": body, "tier": "D", "names_complete": False, "prices_complete": False,
                    "n_skus": row["n_skus"] or 0}
        return {"body": body, "tier": row["tier"], "n_skus": row["n_skus"] or 0,
                "names_complete": bool(row["names_complete"]),
                "prices_complete": bool(row["prices_complete"])}
    except Exception:
        return empty


async def block_for_scope(con, scope: str) -> str:
    """The fold block for a party scope — '' when the tenant has no directory. Fail-soft.
    The head is INSIDE the stored body (§5.10.1), so this adds nothing: what the mind reads about how
    complete its own knowledge is, is the same string on both mouths, in the cache, and in the why."""
    return (await card_for_scope(con, scope))["body"]


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# look_up — the second source. «Búscalo» is a lie unless there is something to search with.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
_WORD = re.compile(r"[0-9a-záéíóúñü]+", re.I)


# The grounding engine, handed in by the app layer. See `look_up` for why this is a seam and not an
# import: the kernel may not reach up into `brain/`. None = fall back to the deterministic SQL search.
_MATCHER = None


def use_matcher(fn) -> None:
    """Register the §5.7 grounding path for `look_up`. Called by the app layer at startup; the kernel
    never learns which module it came from."""
    global _MATCHER
    _MATCHER = fn


async def look_up(tenant_id: str, query: str, k: int = 5) -> list[dict]:
    """A BOUNDED READ over this tenant's catalogue: at most `k` rows of
    {name, code, base_unit, price, in_assortment} and nothing else.

    Never writes, never leaves the tenant, never invents: a miss returns []. Tries the real matcher
    first (the §5.7 grounding path — aliases, dense, sparse, rerank) and falls back to a deterministic
    SQL search when the matcher cannot run (no embedding key, sandbox), so the tool still answers with
    REAL rows instead of failing into silence."""
    q = (query or "").strip()
    if not q:
        return []
    k = max(1, min(int(k or 5), 10))
    out: list[dict] = []
    seen: set[str] = set()
    try:
        # THE MATCHER IS INJECTED, NEVER IMPORTED (2026-07-27). `directory` is a KERNEL module and
        # `brain.matcher` is an APP module; importing it here is a kernel→app breach and
        # `vital_kernel_boundary` refuses it — correctly, and it caught this on the deploy gate.
        # The capability is worth keeping, so the dependency is inverted instead of deleted: the app
        # layer calls `directory.use_matcher(matcher.match)` at startup and the kernel holds only a
        # callable it was handed. Unregistered, this falls straight through to the SQL search below,
        # which is why a miss is still a real answer rather than an exception.
        if _MATCHER is None:
            raise LookupError("no matcher registered")
        res = await _MATCHER(q, tenant=tenant_id, k=k)
        for c in (getattr(res, "candidates", None) or [])[:k]:
            row = c if isinstance(c, dict) else getattr(c, "__dict__", {})
            sid = str(row.get("id") or row.get("sku_id") or "")
            if sid and sid not in seen:
                seen.add(sid)
                out.append({"name": row.get("name"), "code": row.get("code"),
                            "base_unit": row.get("base_unit"), "price": row.get("price"),
                            "in_assortment": row.get("in_assortment", True)})
    except Exception:
        log.debug("directory.look_up: matcher unavailable — SQL fallback", exc_info=True)
    if out:
        return out[:k]
    try:
        import db
        _fold = str.maketrans("áéíóúüñ", "aeiouun")
        toks = [t.translate(_fold) for t in _WORD.findall(q.lower()) if len(t) > 2][:4]
        if not toks:
            return []
        # accent-folded LIKE, done with translate() rather than unaccent(): the extension is not
        # installed on this cluster and a lookup must never depend on one being added.
        fold = "translate(lower(name), 'áéíóúüñ', 'aeiouun')"
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                f"select name, code, base_unit, price, in_assortment from catalogue_skus "
                f"where tenant_id=$1 and {fold} like all($2::text[]) "
                f"order by in_assortment desc, name limit $3",
                tenant_id, [f"%{t}%" for t in toks], k)
            if not rows:
                rows = await con.fetch(
                    f"select name, code, base_unit, price, in_assortment from catalogue_skus "
                    f"where tenant_id=$1 and {fold} like $2 "
                    f"order by in_assortment desc, name limit $3",
                    tenant_id, f"%{toks[0]}%", k)
        return [{"name": r["name"], "code": r["code"], "base_unit": r["base_unit"],
                 "price": float(r["price"]) if r["price"] is not None else None,
                 "in_assortment": r["in_assortment"]} for r in rows]
    except Exception:
        log.debug("directory.look_up: SQL fallback failed", exc_info=True)
        return []
