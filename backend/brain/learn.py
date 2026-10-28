"""Learn from the operator's edit trail (RUNTIME L5 — "make it cheaper" running live).

Every correction hardens a cheap shortcut:
  - SKU correction  -> a customer-scoped alias (mention -> corrected SKU), so the same phrasing
                       grounds cleanly (alias fast-path) next time, no model needed.
  - qty correction  -> a per-customer qty habit (feeds the off-norm validator + defaults).
The deterministic bank grows and the LLM's share shrinks every week.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

import config
from brain import matcher


async def _write_alias(con, tenant: str, alias: str, sku_id: str, phone: Optional[str]) -> None:
    exists = await con.fetchval(
        """select 1 from sku_aliases
             where tenant_id=$1 and alias=$2 and sku_id=$3 and phone_number is not distinct from $4""",
        tenant, alias, sku_id, phone,
    )
    if exists:
        await con.execute(
            """update sku_aliases set weight=weight+1
                 where tenant_id=$1 and alias=$2 and sku_id=$3 and phone_number is not distinct from $4""",
            tenant, alias, sku_id, phone,
        )
    else:
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               values ($1,$2,$3,$4,'edit',2)""",
            tenant, alias, sku_id, phone,
        )


async def _write_pattern(con, tenant: str, phone: Optional[str], ptype: str,
                         key: str, value: Dict[str, Any]) -> None:
    await con.execute(
        """insert into learned_patterns (tenant_id, phone_number, pattern_type, pattern_key, pattern_value, support)
           values ($1,$2,$3,$4,$5,1)""",
        tenant, phone, ptype, str(key), value,
    )


_ANNOTATION = re.compile(r"\s*\(([^()]*)\)\s*$")


def customer_words(mention: str, *names: Optional[str]) -> str:
    """The mention with OUR OWN ANNOTATION removed — measured, 2026-08-10.

    An alias is «what the customer said» → «what it is», so the left-hand side has to be their
    words. It stopped being their words once the extractor started resolving in place: a second
    order for the same thing came back as `sarta del rojo (chorizo sarta dulce)`, because the
    matched name was already in the mind's context and it wrote what it knew. Correct that line and
    the alias minted is `sarta del rojo chorizo sarta dulce` — a string no customer will ever type
    again, so the memory is real, filed, and dead on arrival.

    The rule is deliberately narrow: a trailing parenthetical is dropped ONLY when what is inside it
    is one of the line's own product names. «jamón (el bueno)» is a customer writing, and it
    survives untouched."""
    m = _ANNOTATION.search(mention or "")
    if not m:
        return (mention or "").strip()
    inside = matcher.normalize(m.group(1))
    if inside and any(inside == matcher.normalize(n or "") for n in names if n):
        return (mention or "")[: m.start()].strip()
    return (mention or "").strip()


def _pair_lines(before: List[dict], after: List[dict]) -> List[tuple]:
    """Pair an edit's before/after lines by IDENTITY, falling back to position only when safe.

    The order of preference is the order of confidence: a sku is the same article by definition;
    the customer's own words are the same article by intent; a position is the same article only by
    accident, and only when nothing else claimed either side."""
    def keys(ln: dict) -> List[str]:
        out = []
        for k in ("sku_id", "sku"):
            v = str((ln or {}).get(k) or "").strip()
            if v:
                out.append("sku:" + v)
        for k in ("mention", "raw_text", "item", "name"):
            v = " ".join(str((ln or {}).get(k) or "").lower().split())
            if v:
                out.append("txt:" + v)
        return out

    pairs: List[tuple] = []
    used_a: set = set()
    used_b: set = set()
    by_key: dict = {}
    for j, a in enumerate(after):
        for k in keys(a):
            by_key.setdefault(k, []).append(j)

    for i, b in enumerate(before):
        hit = None
        for k in keys(b):
            for j in by_key.get(k, []):
                if j not in used_a:
                    hit = j
                    break
            if hit is not None:
                break
        if hit is not None:
            used_a.add(hit)
            used_b.add(i)
            pairs.append((b or {}, after[hit] or {}))

    # the positional remainder — only where BOTH sides are still unclaimed, so a deleted line
    # cannot marry its mention to whatever moved up into its slot
    for i in range(min(len(before), len(after))):
        if i in used_b or i in used_a:
            continue
        used_b.add(i)
        used_a.add(i)
        pairs.append((before[i] or {}, after[i] or {}))
    return pairs


async def learn_from_edit(con, phone: Optional[str], before_lines: List[dict],
                          after_lines: List[dict], tenant: Optional[str] = None) -> List[dict]:
    """Diff before/after order lines and persist what the edit taught us.

    ⚠️ PAIRED BY IDENTITY, NEVER BY INDEX (2026-08-19). This diffed `before[i]` against `after[i]`
    over two independently-built baskets. Reorder the lines — which a desk edit does routinely, and
    which the line-identity merge in brain/events.py now does deliberately — and index 0 is
    «costillas» before and «merluza» after. The function then reads that as «she corrected me» and
    writes the customer's word for RIBS as a permanent alias for HAKE, which the matcher grounds on
    the FAST PATH from then on. A learning system that learns the wrong thing is worse than one
    that learns nothing, because it is confident and invisible.

    Pairing is now by `sku_id`, then by the customer's own words, then by position — and a
    positional pair is only trusted when NEITHER side was already claimed by identity, so deleting
    a line cannot hand its mention to its neighbour.

    `tenant` still defaults to BRAIN_TENANT and both production callers omit it — see the
    VENTAS-COVERAGE.md note; that is a separate fix and the wrong-tenant write is why aliases
    Raquel's corrections mint land where her matcher never reads them."""
    tenant = tenant or config.BRAIN_TENANT
    learned: List[dict] = []
    for b, a in _pair_lines(before_lines, after_lines):
        a_sku = a.get("sku_id")
        b_sku = b.get("sku_id")
        # 1) SKU correction -> customer alias from the original mention
        if a_sku and b_sku != a_sku:
            mention = customer_words(
                (b.get("mention") or b.get("raw_text") or b.get("item")
                 or a.get("mention") or a.get("raw_text") or ""),
                b.get("name"), a.get("name"))
            alias = matcher.normalize(mention)
            if alias:
                await _write_alias(con, tenant, alias, a_sku, phone)
                await _write_pattern(con, tenant, phone, "alias", a_sku, {"alias": alias})
                learned.append({"type": "alias", "alias": alias, "sku_id": a_sku})
        # 2) qty correction -> per-customer qty habit
        sku_for_qty = a_sku or b_sku
        if sku_for_qty and a.get("qty") is not None and b.get("qty") != a.get("qty"):
            await _write_pattern(con, tenant, phone, "qty_norm", sku_for_qty,
                                 {"qty": a.get("qty"), "unit": a.get("unit")})
            learned.append({"type": "qty_norm", "sku_id": sku_for_qty, "qty": a.get("qty")})
    return learned
