"""cascade.py — the tab cognitive cascade (SPEC §5.0.1): T0 match → T1 classify → execute_branch.

ONE implementation, used by every path an event arrives on:
  * MESSAGE (run_turn): the cascade STOPS at matching — the verdict rides into the mind as a labelled
    candidate (R3 attribution); R1 is the sole actor on a message (it resolves/updates via its tools).
  * NON-MESSAGE (webhook via emit_sense; timer via the worker): a matched branch EXECUTES through the
    gate — the nine tab actions — EXCEPT money/price/credit, which escalate to R1 on fresh facts (the
    matched-money tenth outcome). A payment matching the invoice tab RESOLVES it + cancels its timers.

Deterministic + fail-soft: a broken cascade never blocks a turn or a webhook (it just doesn't enrich)."""
from __future__ import annotations

import logging
from typing import Optional

log = logging.getLogger("rocoto.cascade")

_TERMINAL = ("stripe.payment", "medusa.paid", "payment", "order.placed", "invoice.paid", "paid")


async def attribute_message(con, scope: str, burst: str, qv: Optional[list] = None) -> str:
    """T0/T1 on a message (SPEC §4.5 R3 / §5.0.1): which OPEN tab does this message most likely answer?
    Returns a hint the mind reasons WITH (never acts on its own for a message). Ranked by watch-vector
    cosine + recency + answer-shape. Empty when there are no open tabs."""
    try:
        rows = await con.fetch(
            "select id, kind, text, answer_shape, "
            "  case when emb is not null and $2::vector is not null then 1-(emb <=> $2::vector) else 0 end as sim "
            "from open_loop where scope=$1::ltree and status='open' "
            "order by sim desc, opened_at desc limit 4", scope, qv)
    except Exception:
        log.debug("attribute_message rank fail-soft", exc_info=True)
        return ""
    if not rows:
        return ""
    lines = [f"  · #{r['id']} ({r['kind']}, espera {r['answer_shape']}): {(r['text'] or '')[:75]}" for r in rows]
    hint = ("ASUNTOS ABIERTOS que este mensaje podría estar respondiendo — si lo resuelve ciérralo con "
            "resolve_tab; si lo cambia, ábrelo de nuevo con el matiz:\n" + "\n".join(lines))
    top = rows[0]
    if (top["sim"] or 0) >= 0.45:
        hint += f"\n→ El más probable es #{top['id']}."
    return hint


async def on_nonmessage_event(con, scope: str, event_id: Optional[int], wtype: str,
                              entity_key: Optional[str], payload: dict) -> dict:
    """A webhook/timer event (SPEC §5.0.1): match an OPEN tab by its exact entity_key and EXECUTE the
    matched branch — the nine actions. The canonical on-script case: a payment matching the invoice tab
    RESOLVES it (action 1) + cancels its timers (the timer trio). MONEY tabs never auto-fire — they
    append escalate.tab reason=money so R1 re-reasons on fresh facts. Idempotent (a resolved tab no-ops).
    Returns {matched, action, tab_id}."""
    if not entity_key:
        return {"matched": False}
    import spine
    tab = await con.fetchrow(
        "select id, money, status from open_loop where scope=$1::ltree and entity_key=$2 "
        "and status='open' order by opened_at desc limit 1", scope, entity_key)
    if not tab:
        return {"matched": False}
    lid = int(tab["id"])
    if tab["money"]:
        # matched-money: suppress any pre-armed action, hand up to R1 on current facts.
        eid, _ = await spine.append_event(con, scope, "escalate.tab", "runtime",
                                          {"tab_id": lid, "triggering_event_id": event_id, "reason": "money"},
                                          lane="reasoning", caused_by=event_id)
        # WP-1: arm the wake so the worker fires a fresh R1 on the new facts (deduped per tab).
        await spine.arm_wake(con, scope, "escalate", {"tab_id": lid, "reason": "money"},
                             dedupe_key=f"tab:{lid}", caused_by=eid)
        return {"matched": True, "action": "escalate_money", "tab_id": lid}
    if wtype in _TERMINAL:
        # resolve + cancel timers (the timer trio) — a late fire into this resolved tab now no-ops.
        await con.execute("update open_loop set status='resolved', resolved_at=now(), resolution=$2 where id=$1",
                          lid, {"branch_id": "terminal", "resolved_by_event": event_id})
        await con.execute("update timer set state='cancelled' where loop_id=$1 and state='armed'", lid)
        await spine.append_event(con, scope, "tab.resolved", "runtime",
                                 {"loop_id": lid, "by": wtype}, caused_by=event_id)
        return {"matched": True, "action": "resolved", "tab_id": lid}
    # a non-terminal match that touches the tab but doesn't close it — record the hit, keep watching.
    await spine.append_event(con, scope, "tab.touched", "runtime",
                             {"loop_id": lid, "by": wtype}, lane="reasoning", caused_by=event_id)
    return {"matched": True, "action": "noop", "tab_id": lid}
