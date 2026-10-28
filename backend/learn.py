"""learn.py — LEARN FROM CONFIRMATION (Peter 2026-07-22). A spoken order the runtime couldn't fully
resolve splits by TRANSCRIPTION CONFIDENCE (confidence.py):

  * DIRTY audio → a parked REVIEW action (a human confirms what was actually said — you can't learn from
    noise, and even great SKU matching is worthless on a bad transcript).
  * CLEAR but UNFAMILIAR (good audio, slang/aliases the matcher didn't resolve) → an open LEARNING TAB.
    When the order is later CONFIRMED / EDITED (the review-sheet approve or the order webhook fires),
    `reconcile()` compares what they SAID vs what they CONFIRMED → writes a per-tenant learned alias
    ('cuando dicen «X» quieren «Y»') and can fire a 'did you mean X?' follow-up. Next time it just knows.
"""
from __future__ import annotations

import json

import db
import spine


async def gate_audio_order(phone: str, said_text: str, conf: dict, unmatched: list) -> dict:
    """Route a spoken order by transcription confidence. Returns {route ∈ 'review'|'learning'|'ok', …}.
    DIRTY → a needs_human review action (money-flagged, never auto-acts). CLEAR+UNMATCHED → learning tab."""
    import runtime
    scope = runtime.scope_of(phone)
    if conf.get("review"):
        async with db.scoped_tx(scope) as con:
            await con.execute(
                "insert into action(scope,kind,payload,state,reason,needs_human,money) "
                "values($1::ltree,'order_review',$2::jsonb,'pending',$3,true,true)",
                scope, json.dumps({"said": said_text[:500], "unmatched": unmatched[:20], "confidence": conf}),
                conf.get("reason", "audio poco fiable — a revisión"))
            await spine.append_event(con, scope, "order.review_gated", "runtime",
                                     {"reason": "dirty_audio", "confidence": conf.get("avg")}, lane="reasoning")
        return {"route": "review", "reason": conf.get("reason")}
    if unmatched:
        import agent_reply
        for m in unmatched[:5]:
            await agent_reply._do_open_tab(
                phone, "aprender", f"Aclarar qué es «{m}» (lo dijo en un pedido y no me cuadró)",
                3.0, f"Oye, una cosita: cuando me dijiste «{m}», ¿a qué te referías exactamente? Así te lo dejo fino para la próxima.",
                answer_shape="free")
        return {"route": "learning", "unclear": unmatched[:5]}
    return {"route": "ok"}


async def reconcile(phone: str, said: str, confirmed: str, scope: str | None = None) -> dict:
    """LEARN: the customer SAID «said» (unclear), the order was CONFIRMED as «confirmed». Write a
    per-tenant learned alias fact + record the learning. Next time the mind/matcher knows said→confirmed.

    `scope` OVERRIDES the derivation, and the reason is /demo (2026-08-10). Every WhatsApp caller
    lets the party scope be computed from the number, which is right for a rail whose parties ARE
    numbers. A demo session's party is `test.demo.t.<slug>.<sid>` and its «phone» is a synthetic,
    unroutable address — so `scope_of` on it names a DIFFERENT scope, and the recall fact this
    function writes would land outside the world it belongs to: invisible in that customer's ficha,
    and left behind in somebody else's. The callers who have the scope in their hand pass it."""
    import memory
    import runtime
    scope = scope or runtime.scope_of(phone)
    async with db.scoped_tx(scope) as con:
        await memory.write_fact(
            con, scope, "RELATION",
            f"Cuando dice «{said}» se refiere a «{confirmed}» (aprendido de un pedido que confirmó).")
        await spine.append_event(con, scope, "learn.alias", "runtime",
                                 {"said": said, "means": confirmed}, lane="reasoning")
    return {"ok": True, "learned": f"{said} → {confirmed}"}
