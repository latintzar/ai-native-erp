"""Order pipeline — the seam the durable queue drains into.

Full flow (Register #18): gather multi-scale context → 5 parallel Haiku scale-reads →
Sonnet synthesiser (merge + run the SKU match) → deterministic validators → THE DOUBT FACULTY →
Sonnet decision (pick the SKU + doubt note) → keep-in-mind bands → tabular order → Sonnet
personalisation → event-sourced order. Phase-A extraction stays as the error fallback (never lose
an order).

THE DOUBT WIRE (WP-2, 2026-07-26 — SPEC §5.7/§5.7a). `doubt.py` shipped built and called by nothing.
This module is where it is CALLED, because this is the only place that holds all four of its inputs
at once, index-aligned, on a live connection:

    grounded lines (+ their matcher `match`)  ·  vflags  ·  the burst's AUDIO verdict  ·  the tenant's
    grounding (`doubt.catalogue_ready`)

and the only place that can then act on the verdict without inventing a second interactive path:

    ② the note   → `decision.build_user()` splices it ABOVE the evidence (twin of perception_note)
    ④ the ask    → `actions.send_interactive_as_rocoto` — the SAME door `agent_reply.ask_options`
                   uses, with the same money/sombra gates and the same `review.on_question_asked`
                   clock, so the 1h timeout (§5.8 source 3) arms itself exactly as it does for the
                   conversational rail
    ⑤ the tap    → `resolve_doubt_tap()` writes `sku_aliases` via `brain/learn._write_alias`, so the
                   matcher's alias fast-path hits FIRST next time and doubt is never consulted again
                   for that word (§5.7's self-extinguishing friction)
    ⑥ the review → `review.hold_for_review(FLAG)`, ONE reason, never a list (§5.8)

THE ONE PARK (the integration, 2026-07-26 — SPEC §5.8a). Doubt is no longer the only thing that can
put an order in front of the comercial. Four checks now run over the same order — the doubt verdict,
the ORDER-LEVEL norm (`validators.validate_order`), the STOCK levels (`brain/stock.check_lines`) and
the DELIVERY RANGE (`brain/range.check`) — and `park_decision()` turns "several fired" into the ONE
sentence §5.8a's tone law allows, under an explicit precedence written out above that function. The
review SOURCE set stays closed at three: stock is `low_stock`, everything else is `flag`.

WHAT THE ORDER BRAIN STILL DOES NOT DO: speak in prose. The only thing that leaves here is the
question itself, and only when the faculty spent this order's one question on it. The acknowledgement
sentence stays the conversational rail's — the tone law reaches it as a FOLD NOTE
(`review.hold_note`, spliced in `runtime.run_turn`), never as a template written here.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

import config
import db
import doubt as doubt_mod
import fcm
import orders as orders_mod
from brain import (
    context,
    decision,
    events,
    identity,
    junkgate,
    matcher,
    personalise,
    queue,
    scales,
    synthesiser,
    tabular,
    validators,
)

log = logging.getLogger("rocoto.brain.pipeline")

_MEDIA_TYPES = {"audio", "image", "document", "video"}
# Sentinel: run_burst paused (requeued, waiting on a transcription) — the drainer must NOT mark done.
REQUEUED = object()

# ── the one-tap answer's wire format ──────────────────────────────────────────────────────────
# The chosen option's id comes back verbatim on the inbound (app.py's interactive branch), so the id
# is where we put the ANSWER: `sku:<sku_id>`. Encoding it means a tap resolves to an alias write with
# no re-inference — we never ask a model to work out what the customer just told us in one tap.
OPTION_SKU_PREFIX = "sku:"
# §5.7's escape row. It ALWAYS goes out: a multiple choice with no way out is an interrogation, and a
# customer who means none of them must be able to say so in one tap instead of being nudged into a
# wrong SKU. It also eats one of Meta's three buttons, which is why MAX_CANDIDATES is 2.
ESCAPE_ID = "none"
ESCAPE_TITLE = "Ninguno, te digo"
# The spine event this wire writes when a question actually WENT OUT. It is the NEVER-TWICE ledger
# (§5.7a) and the tap's lookup key, in one row. Reasoning lane: it is how we think, not world state.
ASKED_EVENT = "doubt.asked"
ANSWERED_EVENT = "doubt.answered"
DECLINED_EVENT = "doubt.declined"

# ── the order confirmation questionnaire (2026-07-27) ─────────────────────────────────────────────
# Peter: *"the runtime shouldn't send the links before it confirms the order. and should make an
# image of the clean order card and send it as an image to the customer with a questionnaire to
# confirm if that's correct."* Same wire shape as the doubt loop above (an `*.asked` event keyed by
# the wamid we asked with, a tap resolves it) — a second instance of one pattern, not a second pattern.
ORDER_CONFIRM_ASKED_EVENT = "order_confirm.asked"
ORDER_CONFIRM_YES_EVENT = "order_confirm.yes"
ORDER_CONFIRM_NO_EVENT = "order_confirm.no"
ORDER_CONFIRM_YES_ID = "yes"
ORDER_CONFIRM_NO_ID = "no"

# «14 ago» — the order card's date line. It lives HERE rather than in `brain/order_card` because
# that module refuses to hold a timezone opinion ("no timezone opinion belongs in a drawing
# function" — its own docstring), and it is a function rather than four lines inside
# `ask_order_confirm` because /demo renders the SAME card for a demo session
# (`demo_flow.order_card_png`): two callers, one date, or the picture a visitor is shown could be
# stamped differently from the picture a customer gets.
_MESES_ES = ("ene", "feb", "mar", "abr", "may", "jun",
             "jul", "ago", "sep", "oct", "nov", "dic")


def fecha_es_now() -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Europe/Madrid"))
    return f"{now.day} {_MESES_ES[now.month - 1]}"


async def _gather(message_ids: List[str]) -> List[Dict[str, Any]]:
    if not message_ids:
        return []
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select id, message_text, transcript, transcript_status, transcript_meta,
                      message_type, reply_to_wa_id, created_at
                 from whatsapp_messages where id = any($1::text[]) order by created_at""",
            message_ids,
        )
    out = [dict(r) for r in rows]
    # §17.49 (WP-G5): a Choco link in a text message is MEDIA whose words are its cart lines —
    # opened once here (choco_tried marks win or lose), persisted as the transcript, and the
    # whole downstream (_combine reads transcript-or-text) books it like any order. Fail-soft:
    # a dead link leaves the bare url for the mind, which is the honest old behaviour.
    for m in out:
        if m.get("message_type") == "text":
            try:
                from brain import choco
                if choco.find_link(m.get("message_text") or ""):
                    await choco.enrich_row(m)
            except Exception:
                log.debug("choco enrich fail-soft", exc_info=True)
    return out


def _any_transcribing(msgs: List[Dict[str, Any]]) -> bool:
    """True if any media message in the burst is STILL being transcribed (pause intake until done).
    Only counts a 'pending' that's RECENT — a transcription stuck/failed long ago must not pause the
    order forever (Peter: it got stuck on 'listening' off a failed transcription from yesterday)."""
    now = datetime.now(timezone.utc)
    for m in msgs:
        if m.get("message_type") in _MEDIA_TYPES and m.get("transcript_status") == "pending":
            ca = m.get("created_at")
            if not isinstance(ca, datetime) or (now - ca).total_seconds() < 75:
                return True
    return False


async def _order_source_ids(order_id: str) -> List[str]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        r = await con.fetchval("select source_message_ids from orders where id=$1", order_id)
    return list(r or [])


async def _attach_entities(message_ids: List[str], order: Dict[str, Any]) -> None:
    """Write the grounded product mentions back onto the SOURCE messages so the chat + transcript
    auto-highlight them — visibly showing Rocoto understood the order."""
    lines = order.get("lines") or []
    terms: List[tuple] = []
    for i, ln in enumerate(lines):
        for key in ("mention", "item", "name"):
            term = (ln.get(key) or "").strip().lower()
            if term and len(term) >= 3:
                terms.append((term, i))
                break
    if not terms:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select id, message_text, transcript, transcript_meta from whatsapp_messages where id = any($1::text[])",
            message_ids)
        for r in rows:
            text = ((r["transcript"] or r["message_text"] or "")).lower()
            ents = [{"text": term, "category": "producto", "order_line_index": i}
                    for term, i in terms if term in text]
            if ents:
                tm = dict(r["transcript_meta"] or {})
                tm["entities"] = ents
                await con.execute("update whatsapp_messages set transcript_meta=$2 where id=$1", r["id"], tm)


def _combine(msgs: List[Dict[str, Any]]) -> (str, bool):
    parts: List[str] = []
    has_media = False
    for m in msgs:
        if m.get("message_type") in _MEDIA_TYPES:
            has_media = True
        t = (m.get("transcript") or m.get("message_text") or "").strip()
        if t:
            parts.append(t)
    return "\n".join(parts), has_media


async def _notify_order(order: Dict[str, Any]) -> None:
    try:
        tokens = await db.get_tokens()
        if tokens:
            title = order.get("customer_name") or order.get("phone_number") or "New order"
            heading = "Order updated" if order.get("_was_amendment") else "New order"
            await asyncio.to_thread(fcm.push_to_all, tokens, heading, title,
                                    {"order_id": order["id"], "phone": order.get("phone_number", ""), "name": title})
    except Exception:
        log.exception("order push failed")


# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE DOUBT FACULTY'S WIRE (SPEC §5.7a)
# ══════════════════════════════════════════════════════════════════════════════════════════════

def audio_verdict(msgs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The burst's audio verdict, for `doubt.classify(audio=…)`.

    THE GAP THIS CLOSES (named, because the survey found it and it is the reason the whole argument
    exists): `confidence.classify()` runs at the SENSE (app.py) and is stored on
    `whatsapp_messages.transcript_meta['confidence']`. `_gather` already selects that column, but
    `_combine` reads only the text and DROPPED the blob — so the order brain has never known whether
    it could trust the words it was matching. It does now. A multiple choice built on a transcript we
    do not trust is worse than silence, so this is the gate that decides whether asking is worth
    anything at all.

    WORST WINS across a burst, not an average: three clean texts do not launder one dirty voice note
    when the order is the UNION of all of them. A burst with no audio at all returns None (the
    faculty then classifies on retrieval alone, which is correct — there is no transcript to distrust).
    """
    worst: Optional[Dict[str, Any]] = None
    for m in msgs or []:
        meta = m.get("transcript_meta") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta or "{}")
            except Exception:
                meta = {}
        cf = (meta or {}).get("confidence") if isinstance(meta, dict) else None
        if not isinstance(cf, dict) or not cf:
            continue
        if worst is None or (cf.get("review") and not worst.get("review")):
            worst = cf
    return worst


def doubt_lines(grounded: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """`grounded_lines` re-projected with the one field the faculty needs and the synthesiser drops.

    `doubt._money()` ranks the question budget by money at risk and reads `line['price']`, but
    `synthesiser.grounded_lines` carry only mention/qty/unit/note/match — every line would have
    valued 0.0 and the budget would have degenerated to "ask about the shortest word". The price is
    already in hand at `match.pick.price`; threading it here keeps `doubt.py` pure (it never learns
    the matcher's dict shape) and makes the ranking mean what §5.7a says it means.
    """
    out: List[Dict[str, Any]] = []
    for gl in grounded or []:
        pick = ((gl.get("match") or {}).get("pick") or {})
        out.append({**gl, "price": gl.get("price", pick.get("price"))})
    return out


async def catalogue_grounded(tenant: str) -> bool:
    """The grounding gate — `doubt.catalogue_ready()` on the OWNER pool (`catalogue_skus` is
    tenant-keyed, not scope-keyed, so it is not visible through `db.scoped_tx`).

    ASSUMPTION on failure: True. By the time this runs the matcher has already read the same table
    through the same pool successfully, so a failure here is a transient blip, not an empty
    catalogue — and answering False would tell the comercial «no tienes catálogo» about a tenant who
    plainly does, which is a lie in his queue. True degrades to ordinary classification, and ordinary
    classification never auto-confirms a doubted line, so nothing unsafe follows.
    """
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            return bool((await doubt_mod.catalogue_ready(con, tenant)).get("grounded"))
    except Exception:
        log.debug("catalogue_ready fail-soft — assuming grounded", exc_info=True)
        return True


async def asked_mentions(phone: str) -> Optional[Set[str]]:
    """Every mention we have ALREADY asked this customer about — §5.7a's NEVER TWICE ledger.

    Source of truth: the `doubt.asked` spine events this wire writes when a question actually WENT
    OUT (not when one was merely contemplated). That is the honest state: it exists only if the mouth
    spoke, it is per-customer because the scope is the customer, and it carries the ask_key the tap
    resolves against, so one row serves both halves of the loop.

    WHY IT DOES NOT ALSO NEED THE ANSWERED ONES: a mention the customer ANSWERED became an
    `sku_aliases` row, so `match.alias_hit` fires and `doubt.classify_line` returns silence before
    this set is ever consulted. What is left in the set is therefore exactly what §5.7a means by
    "asked and IGNORED" — plus the customer who tapped «Ninguno, te digo», who has also told us not
    to ask that again.

    Returns None on a read failure, which the caller MUST read as "we cannot prove we haven't already
    asked" and suppress asking for this burst. Fail-soft on the WRITE path, never on the RULE: the
    rule is never nag, and an empty set would nag. A suppressed question costs one order's worth of
    silence and self-heals on the next burst; a nagged customer does not.
    """
    try:
        import runtime
        scope = runtime.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select payload->>'mention' as mention from event "
                "where scope=$1::ltree and type=$2 order by id desc limit 500",
                scope, ASKED_EVENT)
        return {str(r["mention"] or "").lower() for r in rows if r["mention"]}
    except Exception:
        log.debug("asked_mentions read failed — suppressing this burst's question", exc_info=True)
        return None


async def classify_doubt(phone: str, tenant: str, grounded: List[Dict[str, Any]],
                         vflags: List[Dict[str, Any]],
                         audio: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Gather the faculty's four inputs and classify. Never raises — a doubt read must not cost an
    order. On total failure it returns a verdict that asks nothing and parks nothing, which is
    exactly the behaviour this pipeline had before the wire existed.

    §17.56 Q1: the tenant's `behaviour.doubts` posture OVERLAYS the verdict here — this is the one
    seam where the whole verdict is in hand and nothing downstream (the mind's perception note, the
    ask, `park_reason`) has consumed it yet, so ONE overlay reaches all three consistently. The
    default `ask` is a strict no-op, so a tenant who never touched the setting is byte-identical."""
    try:
        lines = doubt_lines(grounded)
        asked = await asked_mentions(phone)
        if asked is None:
            # unprovable ⇒ ask nothing this burst (see asked_mentions' docstring). Marking every
            # mention as already-asked is how you say that in the faculty's own vocabulary.
            asked = {str(ln.get("mention") or "").lower() for ln in lines}
        verdict = doubt_mod.classify(lines, audio=audio, validators=vflags, asked_aliases=asked,
                                     grounded=await catalogue_grounded(tenant))
        try:
            import behaviour as _behaviour
            posture = (await _behaviour.get(tenant)).get("doubts") or "ask"
        except Exception:
            posture = "ask"        # fail-soft to today's law — a settings blip must not reroute doubt
        return apply_doubt_posture(verdict, posture, config.DOUBT_AMOUNT_THRESHOLD_EUR)
    except Exception:
        log.exception("doubt classification failed (fail-soft: no question, no park)")
        return {"ask": [], "flagged": [], "review": False, "reason": "", "lines": []}


def apply_doubt_posture(verdict: Dict[str, Any], posture: str,
                        threshold_eur: float) -> Dict[str, Any]:
    """§17.56 Q1 — `behaviour.doubts` over a `doubt.classify()` verdict. PURE and in-place-free
    (returns the same dict when it changes nothing), so the vitals can assert it without a DB.

      · 'ask'    → today's per-kind law, untouched. THE DEFAULT.
      · 'review' → everything doubted goes to the TEAM: no customer question, every doubted line
                   re-directed COMERCIAL, review forced. The supplier said «las dudas las miro yo».
      · 'amount' → today's law PLUS a money gate: any doubted line whose value (qty×price when the
                   line carries one, else the order's summed value standing in — a line we cannot
                   price individually is judged by the basket it rides in) is ≥ `threshold_eur`
                   goes to the TEAM regardless of kind. Small lines keep the per-kind law — note
                   that this deliberately NEVER converts a comercial-kind (unknown/conflict) into a
                   customer question: a small catalogue gap is still not the customer's to fix, and
                   there would be nothing honest to ask them about it.

    Untouched on the two states that outrank any posture: an UNGROUNDED tenant (our catalogue is
    missing — routing has already collapsed to one honest reason) and the DIRTY-AUDIO gate (we do
    not trust the words; a posture cannot restore that trust)."""
    if not verdict or posture in ("", "ask"):
        return verdict
    if verdict.get("ungrounded") or verdict.get("audio"):
        return verdict
    lines = verdict.get("lines") or []
    doubted = [d for d in lines if d.get("kind")]
    if not doubted:
        return verdict

    if posture == "review":
        forced = set(map(id, doubted))
    elif posture == "amount":
        order_value = sum(float(d.get("value") or 0) for d in lines)
        def _worth(d: Dict[str, Any]) -> float:
            v = float(d.get("value") or 0)
            return v if v > 0 else order_value
        forced = {id(d) for d in doubted if _worth(d) >= float(threshold_eur)}
    else:
        return verdict             # unknown posture → today's law (same rule as behaviour.coerce)
    if not forced:
        return verdict

    for d in doubted:
        if id(d) in forced:
            d["direction"] = doubt_mod.COMERCIAL
            d["ask"] = False
            d["reason"] = (f"{d.get('reason') or ''} · ajuste del proveedor: esta duda la mira el "
                           f"equipo").strip(" ·")
    still_ask = [d for d in (verdict.get("ask") or []) if id(d) not in forced]
    newly_flagged = [d for d in (verdict.get("ask") or []) if id(d) in forced]
    verdict["ask"] = still_ask
    verdict["flagged"] = list(verdict.get("flagged") or []) + newly_flagged
    verdict["review"] = any(d.get("direction") == doubt_mod.COMERCIAL for d in doubted)
    verdict["posture"] = posture   # the overlay declares itself, like the audio gate does
    return verdict


# ── ⑥ THE REVIEW REASON — exactly ONE, never a list (§5.8) ────────────────────────────────────
def park_reason(verdict: Dict[str, Any]) -> Optional[str]:
    """The SINGLE es-ES sentence this order goes in front of the comercial with, or None.

    §5.8's rule is not "surface everything the AI was unsure about" — it is that a review carries ONE
    reason a human can act on. So the precedence below is a strict ordering, not a join: the first
    true thing wins and the rest are silent (they still ride the order's keep-in-mind notes, where
    they belong). Pure and deterministic so the vital can assert the rule without a database.

    Precedence, most-fundamental first:
      1. UNGROUNDED — we have no catalogue. Every other reason is downstream of this one and saying
         them too would blame the customer for our own missing data.
      2. DIRTY AUDIO — we do not trust the words. Judging the match of a transcript we distrust is
         judging noise. Read off the gate's OWN flag (`verdict['audio']`), never inferred from the
         shape of the verdict — see the comment at that branch for what inferring it cost.
      3. UNKNOWN — a real catalogue gap. His to fix, never the customer's.
      4. CONFLICT — resolves cleanly but contradicts what we know (§5.8's "pedido muy grande").
    """
    if not verdict:
        return None
    if verdict.get("ungrounded"):
        return ("sin catálogo cargado — el pedido entero lo miras tú "
                "(al cliente no se le ha preguntado nada)")
    lines = verdict.get("lines") or []
    if verdict.get("audio"):
        # THE GATE DECLARES ITSELF (`doubt.classify` sets `audio` — 2026-07-26). This used to be
        # inferred from "reviewed but asked nothing", and that shape is NOT unique to dirty audio: an
        # order whose only customer-facing doubt was already asked once, alongside one comercial-facing
        # line, produces exactly it. The comercial then read «audio poco fiable» about a clean voice
        # note — a reason that was not true, in the one place §5.8 promises only true ones.
        return "audio poco fiable — no le he preguntado nada al cliente; confírmalo tú"
    unknown = next((d for d in lines if d.get("kind") == doubt_mod.UNKNOWN), None)
    if unknown:
        return f"«{unknown.get('mention')}» no está en tu catálogo — no es duda del cliente, es un hueco nuestro"
    conflict = next((d for d in lines if d.get("kind") == doubt_mod.CONFLICT), None)
    if conflict:
        return f"«{conflict.get('mention')}»: {conflict.get('reason')}"
    # §17.56 Q1 — a customer-kind line the supplier's `behaviour.doubts` posture re-directed to the
    # team ('review', or 'amount' over the threshold). Without this rung a forced doubt would be
    # review=True with NO sentence, i.e. a park nobody could write — the setting would silently do
    # nothing, which is the one failure §17.55j forbids (a knob that looks wired and is not). Last
    # in the precedence: it is the supplier's own preference, not a defect in the order.
    if verdict.get("posture"):
        forced = next((d for d in lines
                       if d.get("kind") and d.get("direction") == doubt_mod.COMERCIAL
                       and d.get("kind") not in (doubt_mod.UNKNOWN, doubt_mod.CONFLICT)), None)
        if forced:
            return f"«{forced.get('mention')}»: {forced.get('reason')}"
    return None


async def park_doubt(phone: str, verdict: Dict[str, Any], order_id: str = "") -> Dict[str, Any]:
    """Put the order in front of the comercial with `park_reason()`'s one sentence, through §5.8's
    ONE door. FLAG is the source: a human must speak before we promise anything (LOW_STOCK is
    inventory's, TIMEOUT is the unanswered question's — neither is this).

    Kept as the doubt-only door (the eval path and `vital_doubt_wire` reach it directly); the LIVE
    order path goes through `_settle_review`, which weighs this reason against stock, range and the
    order-level norm and parks exactly one of them."""
    reason = park_reason(verdict)
    if not reason:
        return {"ok": True, "noop": True}
    try:
        import review
        import runtime
        return await review.hold_for_review(
            runtime.scope_of(phone), review.FLAG, text=reason,
            detail={"doubt": True, "order_id": order_id,
                    "kinds": sorted({str(d.get("kind")) for d in (verdict.get("lines") or [])
                                     if d.get("kind")})})
    except Exception:
        log.exception("doubt review park failed (fail-soft)")
        return {"ok": False}


# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE ONE PARK — four reasons arrive, ONE goes in front of the comercial (SPEC §5.8 / §5.8a)
# ══════════════════════════════════════════════════════════════════════════════════════════════
# §5.8's set of REVIEW SOURCES is closed at three (low_stock · flag · timeout) and §5.8a's tone law
# is that a review carries ONE reason, never a list: the comercial needs to know what to decide, not
# everything the system noticed. Four independent checks now run over the same order, so this is
# where "several fired" becomes "one sentence".
#
# THE PRECEDENCE IS A STRICT ORDER, NOT A JOIN, and the ordering principle is: **the reason that
# invalidates the most of the order, soonest, wins** — a comercial who reads one line must read the
# one that changes what he does. First true wins; the rest are silent (they still ride the order's
# keep-in-mind notes, where they belong).
#
#   1. UNGROUNDED — this tenant has no catalogue. Every other check ran against nothing, so every
#      other reason it produced is an artefact of OUR missing data, and saying one of them would
#      blame the customer for a hole of ours. (Doubt's own reason, rank 1 of its internal order.)
#   2. OUT OF RANGE — the only fact here that is not about the goods at all. If the van does not go
#      there, what is on the order and whether we have it are both moot, and the decision is a single
#      yes/no the comercial can take in three seconds. It outranks everything downstream of it.
#   3. DIRTY AUDIO — we do not trust the words. Judging the CONTENTS of an order read off a
#      transcript we distrust is judging noise: a shortfall or a 4× total computed from mis-heard
#      quantities would send him to decide about an order nobody placed.
#   4. LOW STOCK — we cannot fill it as asked. It is a physical fact with a customer consequence
#      (someone must be told to wait), and only a human may make that promise. Ahead of the two
#      judgement calls below because it is a FACT and they are OPINIONS.
#   5. UNKNOWN — a word that is in no catalogue of his. A real gap, one line, his to fix.
#   6. TOO BIG OVERALL — the order is complete, servable, fillable and understood; the only question
#      left is whether this customer is good for it. That is the least urgent kind of decision (a big
#      order is a good problem), so it goes last among the reasons that fire on a healthy order.
#   7. CONFLICT — a line that resolves cleanly but contradicts what we know about this customer.
#      Last: the per-line keep-in-mind note already carries it where the comercial will see it anyway.
#
# The SOURCE each maps onto is §5.8's, unchanged: only stock is LOW_STOCK; everything else is FLAG.
# The REASON STRING IS THE OWNING MODULE'S, VERBATIM — `range.distance_reason`,
# `stock.short_reason`, `validators.validate_order`'s reason, `park_reason`'s. Re-wording it here
# would put a second voice on the queue and make the vitals that assert those sentences lie.
_RANK_UNGROUNDED, _RANK_RANGE, _RANK_AUDIO, _RANK_STOCK = 1, 2, 3, 4
_RANK_UNKNOWN, _RANK_TOO_BIG, _RANK_CONFLICT = 5, 6, 7


def _doubt_rank(verdict: Dict[str, Any]) -> int:
    """Which rung of the precedence above THIS doubt reason sits on. `park_reason` already chose
    WHICH doubt reason to give (its own four-step order); this only has to place that choice in the
    combined order. It therefore re-reads the same four conditions IN THE SAME ORDER rather than
    parsing the sentence back — the sentence is es-ES prose that will be re-worded one day, and a
    precedence that depends on a substring of it is a bug waiting for a copy edit."""
    if verdict.get("ungrounded"):
        return _RANK_UNGROUNDED
    if verdict.get("audio"):                    # the gate names itself; see park_reason
        return _RANK_AUDIO
    if any(d.get("kind") == doubt_mod.UNKNOWN for d in (verdict.get("lines") or [])):
        return _RANK_UNKNOWN
    return _RANK_CONFLICT


def park_decision(doubt_verdict: Optional[Dict[str, Any]] = None,
                  stock_verdict: Optional[Dict[str, Any]] = None,
                  range_verdict: Optional[Dict[str, Any]] = None,
                  order_norm: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, str]]:
    """The ONE park for this order, or None. Pure and deterministic — no DB, no config, no network —
    so the rule can be asserted without a database, exactly like `park_reason`.

    Returns {source, reason, cause}: `source` is one of `review.SOURCES`, `reason` is the owning
    module's own es-ES sentence verbatim, and `cause` is a machine tag that rides the payload so a
    surface can filter without parsing Spanish. Candidates are collected, then the LOWEST rank wins —
    written as a collect-then-min rather than a cascade of ifs so that adding a reason later is one
    tuple and cannot accidentally shadow an existing one."""
    cands: List[Tuple[int, str, str, str]] = []

    if range_verdict and range_verdict.get("known") and not range_verdict.get("servable"):
        cands.append((_RANK_RANGE, "flag", str(range_verdict.get("reason") or ""), "range"))
    if stock_verdict and stock_verdict.get("inventory") and not stock_verdict.get("ok"):
        cands.append((_RANK_STOCK, "low_stock", str(stock_verdict.get("reason") or ""), "stock"))
    if order_norm and order_norm.get("value_off_norm"):
        cands.append((_RANK_TOO_BIG, "flag", str(order_norm.get("reason") or ""), "order_value"))
    d_reason = park_reason(doubt_verdict or {})
    if d_reason:
        cands.append((_doubt_rank(doubt_verdict or {}), "flag", d_reason, "doubt"))

    cands = [c for c in cands if c[2]]          # a reason nobody wrote is not a reason
    if not cands:
        return None
    rank, source, reason, cause = min(cands, key=lambda c: c[0])
    return {"source": source, "reason": reason, "cause": cause}


async def order_checks(phone: str, tenant: str,
                       lines: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """(stock_verdict, range_verdict) for a FILED order. The two checks that need the database.

    THE OWNER POOL, NOT `scoped_tx`: `tenant_range`, `stock_levels` and `customer_profiles` are
    tenant-keyed, not scope-keyed, so they are invisible through a scoped connection — the same
    reason `catalogue_grounded` above reaches for `db.get_pool()`.

    Never raises. Both modules already fail soft to "we know nothing", and "we know nothing" is the
    answer that holds no order — so a database blip can cost a review, never an order."""
    empty_stock = {"ok": True, "short": [], "reason": "", "inventory": False}
    empty_range = {"known": False, "servable": True, "distance_km": None, "reason": ""}
    try:
        from brain import range as rng
        from brain import stock as stock_mod
        pool = db.get_pool()
        async with pool.acquire() as con:
            st = await stock_mod.check_lines(con, tenant, lines)
            here = await rng.customer_point(con, tenant, phone)
            rg = (await rng.check(con, tenant, lat=here[0], lon=here[1])) if here else empty_range
        return st, rg
    except Exception:
        log.exception("order checks (stock/range) failed for %s — no claim (fail-soft)", phone)
        return empty_stock, empty_range


# ── ④ THE ASK — through the EXISTING one-tap door, never a second interactive path ────────────
def _shared_head(names: List[str]) -> List[str]:
    """The leading WORDS every candidate shares. «MANZANA GOLDEN 20 - 4/5 PZAS KG» and «MANZANA
    GOLDEN 26 - 7/8 PZAS KG» share «MANZANA GOLDEN», and what is left is the actual question."""
    if len(names) < 2:
        return []
    heads = [n.split() for n in names]
    out: List[str] = []
    for i in range(min(len(h) for h in heads)):
        w = heads[0][i]
        if all(h[i] == w for h in heads):
            out.append(w)
        else:
            break
    return out


def build_options(entry: Dict[str, Any]) -> List[Dict[str, str]]:
    """The one-tap options for ONE `doubt.classify()` ask entry: the real catalogue rows + the escape.

    THE CALIBRE IS THE QUESTION (§5.7). When two candidates share a product name and differ only in
    calibre/format, the shared head is noise on a 20-character button — «MANZANA GOLDEN 20 - 4/5 PZAS
    KG» does not fit and, worse, buries the ONE thing being asked. So the shared head is stripped from
    the labels and the product is named in the sentence instead, which is both the honest UX and what
    turns a list back into three buttons.

    Meta's limits are hard errors upstream (`whatsapp_cloud._ia_str` RAISES, never truncates), so a
    label that still does not fit a LIST row is truncated here and the full catalogue name rides the
    description — nothing is ever silently lost, and the surface choice stays `actions.py`'s.
    """
    import whatsapp_cloud as wc
    # a nameless candidate cannot be offered — drop it HERE rather than let a filtered `names` list
    # slip out of step with `cands` and mint an option whose title belongs to a different SKU
    cands = [c for c in ((entry or {}).get("candidates") or []) if str(c.get("name") or "").strip()]
    names = [str(c.get("name") or "").strip() for c in cands]
    head = _shared_head(names)
    labels: List[str] = []
    for n in names:
        rest = " ".join(n.split()[len(head):]).strip(" -–—·,") if head else n
        labels.append(rest or n)
    if len(set(labels)) != len(labels) or any(not l for l in labels):
        labels = names   # stripping made them ambiguous — say the whole name instead

    long = any(len(l) > wc.IA_BUTTON_TITLE_MAX for l in labels)
    opts: List[Dict[str, str]] = []
    for c, label, full in zip(cands, labels, names):
        sku = str(c.get("sku_id") or c.get("id") or "").strip()
        row = {"id": (OPTION_SKU_PREFIX + sku)[:wc.IA_ID_MAX] if sku else "",
               "title": label[:wc.IA_ROW_TITLE_MAX]}
        if long:
            row["description"] = full[:wc.IA_ROW_DESC_MAX]
        opts.append(row)
    opts.append({"id": ESCAPE_ID, "title": ESCAPE_TITLE})
    return opts


async def ask_doubt_question(phone: str, verdict: Dict[str, Any], question: str,
                             order_id: str = "") -> Dict[str, Any]:
    """Send this order's ONE question through `actions.send_interactive_as_rocoto` — the same door
    `agent_reply`'s `ask_options` hand uses, with the same MODO SOMBRA hold, the same money gate, the
    same `msg.sent` event and the same thread projection. There is deliberately no second path: a
    parallel sender would be a second set of gates to keep in step, and the first divergence would be
    a price going out un-gated.

    On success it does the two things a question owes the rest of the system:
      · `review.on_question_asked` — arms §5.8 source 3's ONE-HOUR clock. An answered question
        cancels it in the same commit and never reaches the comercial; silence parks it.
      · the `doubt.asked` spine event — the NEVER-TWICE ledger AND the tap's lookup key, carrying
        the mention, the ask_key (the wamid we asked with) and every option's sku_id, so the answer
        resolves with no re-inference.
    Fail-soft: a failed send never takes down the order that was already filed.
    """
    ask = (verdict or {}).get("ask") or []
    q = (question or "").strip()
    if not ask or not q:
        return {"ok": False, "reason": "nothing_to_ask"}
    entry = ask[0]
    opts = build_options(entry)
    if len([o for o in opts if o.get("id") != ESCAPE_ID]) < 1:
        return {"ok": False, "reason": "no_real_candidates"}
    try:
        import actions as rt_actions
        import runtime
        scope = runtime.scope_of(phone)
        res = await rt_actions.send_interactive_as_rocoto(scope, q, opts)
    except Exception:
        log.exception("doubt ask failed (fail-soft)")
        return {"ok": False, "reason": "send_failed"}
    if not res.get("ok"):
        # sombra held it, the money gate parked it, or the rail refused. Either way NOTHING was said,
        # so nothing is recorded as asked — the next order may still ask, which is the honest state.
        log.info("doubt question not sent phone=%s reason=%s", phone, res.get("reason"))
        return res
    sid = str(res.get("sid") or "")
    try:
        import review
        await review.on_question_asked(scope, q, sid or f"doubt:{order_id}", tier="customer")
    except Exception:
        log.debug("review clock fail-soft", exc_info=True)
    try:
        import spine
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, ASKED_EVENT, "doubt", {
                "mention": entry.get("mention"), "kind": entry.get("kind"),
                "ask_key": sid, "question": q[:300], "order_id": order_id,
                "options": [{"id": o["id"], "title": o["title"],
                             "sku_id": o["id"][len(OPTION_SKU_PREFIX):] if o["id"].startswith(OPTION_SKU_PREFIX) else ""}
                            for o in opts],
            }, lane="reasoning")
    except Exception:
        log.debug("doubt.asked ledger fail-soft", exc_info=True)
    return res


# ── ⑤ THE TAP — the answer closes the loop into sku_aliases ───────────────────────────────────
def resolve_option(asked: Dict[str, Any], option_id: str = "",
                   option_title: str = "") -> Tuple[bool, str, str]:
    """(is_answer, sku_id, name) — what the customer's reply means against the recorded question. Pure.

    THE FIRST RETURN VALUE IS THE IMPORTANT ONE. A burst is not made of answers: most of what arrives
    after a question is ordinary conversation, and treating every message as a reply to the last thing
    we asked would record refusals nobody made and, worse, retire questions the customer never saw.
    So `is_answer` is True only when the message is unmistakably one: it carries the option id we
    minted, or its text IS one of the offered titles verbatim.

    The id is authoritative when present — it is the string WE minted and Meta echoed back, so it
    needs no interpretation. The title is the fallback for rails that carry no id (a Twilio button
    arrives as plain text; a customer may simply type the option back). The quoted wamid, handled by
    the caller, chooses WHICH question this is about; it is not by itself evidence of an answer — a
    free-text reply quoting our question («el del 20») is a conversation for the mind, not a tap, and
    it must not mint an alias off a guess.

    `(True, "", "")` is the escape row — a real answer that must NOT write an alias.
    """
    opts = (asked or {}).get("options") or []
    oid = (option_id or "").strip()
    if oid == ESCAPE_ID:
        return True, "", ""
    if oid.startswith(OPTION_SKU_PREFIX):
        sku = oid[len(OPTION_SKU_PREFIX):]
        name = next((str(o.get("title") or "") for o in opts if o.get("id") == oid), "")
        return True, sku, name
    t = (option_title or "").strip().lower()
    if not t:
        return False, "", ""
    if t == ESCAPE_TITLE.lower():
        return True, "", ""
    for o in opts:
        if str(o.get("title") or "").strip().lower() == t:
            return True, str(o.get("sku_id") or ""), str(o.get("title") or "")
    return False, "", ""


async def resolve_doubt_tap(phone: str, *, asked_wamid: str = "", option_id: str = "",
                            option_title: str = "", tenant: Optional[str] = None) -> Dict[str, Any]:
    """The customer answered our question → WRITE THE ALIAS. This is the whole point of §5.7.

    Connects to the loop that already exists rather than rebuilding it:
      · `brain/learn._write_alias` — the row the MATCHER reads. Its alias fast-path
        (`matcher._alias_lookup`) runs before any scoring, so the next order with this word never
        reaches the faculty at all — which is what makes the friction self-extinguishing instead of
        merely smaller.
      · `learn.reconcile` — the MEMORY side («cuando dice «X» se refiere a «Y»»), so the conversational
        mind knows it too. Both, because they feed different organs: one is retrieval, one is recall.

    An escape tap («Ninguno, te digo») writes NO alias and is recorded as `doubt.declined` — a
    refusal is data about the question, not about the product, and §5.7a says we do not ask again
    either way.

    Fail-soft, and idempotent-by-nature: a repeated tap re-runs `_write_alias`, which bumps `weight`
    rather than duplicating — a customer confirming the same thing twice is evidence, not a bug.
    """
    tenant = tenant or config.BRAIN_TENANT
    try:
        import runtime
        import spine
        scope = runtime.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            if asked_wamid:
                row = await con.fetchrow(
                    "select id, payload from event where scope=$1::ltree and type=$2 "
                    "and payload->>'ask_key' = $3 order by id desc limit 1",
                    scope, ASKED_EVENT, asked_wamid)
            else:
                # no context.id on this rail — the most recent question is the one being answered
                row = await con.fetchrow(
                    "select id, payload from event where scope=$1::ltree and type=$2 "
                    "order by id desc limit 1", scope, ASKED_EVENT)
            if not row:
                return {"ok": True, "noop": True, "reason": "no_open_question"}
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload or "{}")
            mention = str((payload or {}).get("mention") or "")
            is_answer, sku_id, name = resolve_option(payload or {}, option_id, option_title)
            if not is_answer:
                return {"ok": True, "noop": True, "reason": "not_an_answer"}
            # ALREADY SETTLED? The latest question stays the lookup target forever, so without this a
            # second unrelated message that happens to quote it would re-write the same alias and
            # inflate `weight` — evidence we did not actually get.
            settled = await con.fetchval(
                "select 1 from event where scope=$1::ltree and type = any($2::text[]) "
                "and caused_by=$3 limit 1",
                scope, [ANSWERED_EVENT, DECLINED_EVENT], int(row["id"]))
            if settled:
                return {"ok": True, "noop": True, "reason": "already_answered"}
            if not sku_id:
                await spine.append_event(con, scope, DECLINED_EVENT, "doubt",
                                         {"mention": mention, "answer": option_title[:120],
                                          "ask_key": asked_wamid},
                                         caused_by=int(row["id"]), lane="reasoning")
                return {"ok": True, "learned": False, "reason": "escape"}
            await spine.append_event(con, scope, ANSWERED_EVENT, "doubt",
                                     {"mention": mention, "sku_id": sku_id, "chose": name,
                                      "ask_key": asked_wamid},
                                     caused_by=int(row["id"]), lane="reasoning")
    except Exception:
        log.exception("resolve_doubt_tap: could not read the question (fail-soft)")
        return {"ok": False}

    alias = matcher.normalize(mention)
    if not alias:
        return {"ok": True, "learned": False, "reason": "empty_mention"}
    try:
        from brain import learn as brain_learn
        pool = db.get_pool()
        async with pool.acquire() as con:
            await brain_learn._write_alias(con, tenant, alias, sku_id, phone)
    except Exception:
        log.exception("resolve_doubt_tap: alias write failed (fail-soft)")
        return {"ok": False, "learned": False}
    try:
        import learn as rt_learn
        await rt_learn.reconcile(phone, mention, name or sku_id)
    except Exception:
        log.debug("reconcile fail-soft", exc_info=True)
    log.info("DOUBT LEARNED: %s → %s for %s (never asked again)", alias, sku_id, phone)
    return {"ok": True, "learned": True, "alias": alias, "sku_id": sku_id}


async def close_ask_from_grounding(phone: str, lines: List[Dict[str, Any]],
                                   tenant: Optional[str] = None) -> Dict[str, Any]:
    """The tap's missing half (BUILD-CONCERNS #12): a free-text answer to a disambiguation.

    `resolve_option`'s law stands — a free-text reply is a conversation for the MIND, and the
    tap must never mint an alias off a guess. But when the mind then takes the order and the
    GROUNDING lands a line on one of the sku_ids the question OFFERED, that is no longer a
    guess: the customer chose from the menu in their own words, and the full matcher confirmed
    which row. Without this closure the order books and the question never retires — the same
    customer gets asked about «jamoncito» forever, which is the anti-§5.7 outcome (friction
    that never self-extinguishes).

    Same lookup, same settled-guard, same tail as `resolve_doubt_tap` — one loop, two doors.
    Fail-soft everywhere: an unclosed ask must never break an order that already booked."""
    tenant = tenant or config.BRAIN_TENANT
    line_skus = {str(l.get("sku_id") or "") for l in (lines or []) if l.get("sku_id")}
    if not line_skus:
        return {"ok": True, "noop": True, "reason": "no_grounded_lines"}
    try:
        import runtime
        import spine
        scope = runtime.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            row = await con.fetchrow(
                "select id, payload from event where scope=$1::ltree and type=$2 "
                "order by id desc limit 1", scope, ASKED_EVENT)
            if not row:
                return {"ok": True, "noop": True, "reason": "no_open_question"}
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload or "{}")
            mention = str((payload or {}).get("mention") or "")
            offered = {}
            for o in (payload or {}).get("options") or []:
                sid = str(o.get("sku_id") or "")
                if not sid and str(o.get("id") or "").startswith(OPTION_SKU_PREFIX):
                    sid = str(o.get("id"))[len(OPTION_SKU_PREFIX):]
                if sid:
                    offered[sid] = str(o.get("title") or "")
            hit = next((s for s in line_skus if s in offered), "")
            if not hit or not mention:
                return {"ok": True, "noop": True, "reason": "not_about_the_question"}
            settled = await con.fetchval(
                "select 1 from event where scope=$1::ltree and type = any($2::text[]) "
                "and caused_by=$3 limit 1",
                scope, [ANSWERED_EVENT, DECLINED_EVENT], int(row["id"]))
            if settled:
                return {"ok": True, "noop": True, "reason": "already_answered"}
            await spine.append_event(con, scope, ANSWERED_EVENT, "doubt",
                                     {"mention": mention, "sku_id": hit,
                                      "chose": offered.get(hit, ""), "via": "grounding"},
                                     caused_by=int(row["id"]), lane="reasoning")
    except Exception:
        log.exception("close_ask_from_grounding: could not read the question (fail-soft)")
        return {"ok": False}
    alias = matcher.normalize(mention)
    if not alias:
        return {"ok": True, "learned": False, "reason": "empty_mention"}
    try:
        from brain import learn as brain_learn
        pool = db.get_pool()
        async with pool.acquire() as con:
            await brain_learn._write_alias(con, tenant, alias, hit, phone)
    except Exception:
        log.exception("close_ask_from_grounding: alias write failed (fail-soft)")
        return {"ok": False, "learned": False}
    try:
        import learn as rt_learn
        await rt_learn.reconcile(phone, mention, offered.get(hit, "") or hit)
    except Exception:
        log.debug("reconcile fail-soft", exc_info=True)
    log.info("DOUBT LEARNED VIA GROUNDING: %s → %s for %s", alias, hit, phone)
    return {"ok": True, "learned": True, "alias": alias, "sku_id": hit}


async def learn_from_correction(phone: Optional[str], *, before_lines: List[Dict[str, Any]],
                                after_lines: List[Dict[str, Any]],
                                tenant: Optional[str] = None,
                                scope: Optional[str] = None) -> Dict[str, Any]:
    """⑤'s THIRD DOOR: the OPERATOR corrected a line we read wrong (§17.57 ②).

    The other two doors need an open question. This one is the case where there was none — the
    matcher was CONFIDENT and wrong, so nothing was ever asked, and the only evidence that the word
    means something else is the human swapping the row. That evidence is worth exactly as much as a
    customer's tap, so it writes exactly the same memory:

      · `brain/learn.learn_from_edit` — the runtime's OWN operator-edit learner, the one
        `brain/events.edit_order` calls when the panel saves lines. It diffs before/after by index
        and writes `sku_aliases` through `_write_alias` (the row `matcher._alias_lookup` reads on the
        fast path, before any scoring) plus a `learned_patterns` qty habit when the quantity moved.
        One learner, three callers — the demo is not a fork of the product.
      · `learn.reconcile` — the MEMORY side, «cuando dice «X» se refiere a «Y»», so the
        conversational mind knows it too and the customer's ficha SHOWS it. Both, for the reason
        `resolve_doubt_tap` gives: one is retrieval, one is recall.
      · `close_ask_from_grounding` — and if there WAS an open question about this word after all,
        the correction answers it, so the ask retires here rather than being asked again forever.

    `phone` is passed through VERBATIM, `None` and all: it is the address `matcher._alias_lookup`
    will be given on the next draft, and an alias filed against a different one is a memory that
    exists and never fires. `scope` names the party for the recall fact when the caller has it
    (see `learn.reconcile`) — the WhatsApp rail leaves it out and keeps its derivation.

    Fail-soft in the same shape as its two siblings: a memory that could not be written must never
    take the correction with it, because the corrected order is the thing the operator asked for.
    """
    tenant = tenant or config.BRAIN_TENANT
    learned: List[Dict[str, Any]] = []
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            from brain import learn as brain_learn
            learned = await brain_learn.learn_from_edit(con, phone, before_lines or [],
                                                        after_lines or [], tenant)
    except Exception:
        log.exception("learn_from_correction: alias/habit write failed (fail-soft)")
        return {"ok": False, "learned": False}

    # THE NAME WE LEARNED IT AS, for the recall sentence. `learn_from_edit` returns the sku_id; the
    # human-readable name is on the after-line the operator picked, which is where it is honest.
    names = {str(l.get("sku_id") or ""): str(l.get("name") or "")
             for l in (after_lines or []) if l.get("sku_id")}
    for item in learned:
        if item.get("type") != "alias":
            continue
        try:
            import learn as rt_learn
            await rt_learn.reconcile(phone or "", str(item.get("alias") or ""),
                                     names.get(str(item.get("sku_id") or "")) or str(item.get("sku_id") or ""),
                                     scope=scope)
        except Exception:
            log.debug("reconcile fail-soft", exc_info=True)

    # ONLY WHERE THE PARTY IS ITS PHONE. `close_ask_from_grounding` derives the scope from the
    # number, so a caller that had to hand us a scope is by definition one it would get wrong —
    # it would read another party's open question and find nothing, which is a no-op dressed as a
    # step. Those surfaces settle their own doubts (the demo's candidate pills do it in chat).
    if phone and not scope:
        try:
            await close_ask_from_grounding(phone, after_lines or [], tenant)
        except Exception:
            log.debug("close_ask_from_grounding fail-soft after a correction", exc_info=True)

    aliases = [i for i in learned if i.get("type") == "alias"]
    if aliases:
        log.info("CORRECTION LEARNED: %s → %s for %s",
                 aliases[0].get("alias"), aliases[0].get("sku_id"), phone)
    return {"ok": True, "learned": bool(aliases), "items": learned,
            "alias": (aliases[0].get("alias") if aliases else ""),
            "sku_id": (aliases[0].get("sku_id") if aliases else "")}


async def _resolve_taps(phone: str, msgs: List[Dict[str, Any]], tenant: str) -> None:
    """Close the loop for any answer sitting in this burst.

    ⚠️ NAMED GAP (2026-07-26, app.py is not this WP's to edit): the Meta rail's inbound TEXT branch
    does not call `_maybe_extract_order`, so a tap on the cloud rail never enters the ingest queue and
    never reaches this function — only the Twilio rail and the media path do today. `resolve_doubt_tap`
    is therefore deliberately PUBLIC and takes the exact three values app.py's interactive branch
    already has in hand (`opt_id`, `body`, `asked_wamid`): closing the gap is one call there, not a
    redesign here.
    """
    for m in msgs or []:
        rid = (m.get("reply_to_wa_id") or "").strip()
        body = (m.get("message_text") or "").strip()
        if not body:
            continue
        # An option title can never exceed Meta's 24-char row limit, so a long message that does not
        # quote our question cannot be a tap — skip it rather than spend a scoped read per sentence
        # of an ordinary order. (A quoted message is always checked: it is cheap and it is evidence.)
        if not rid and len(body) > 64:
            continue
        try:
            await resolve_doubt_tap(phone, asked_wamid=rid, option_title=body, tenant=tenant)
        except Exception:
            log.debug("tap resolution fail-soft", exc_info=True)
        try:
            await resolve_order_confirm_tap(phone, asked_wamid=rid, option_title=body, tenant=tenant)
        except Exception:
            log.debug("order-confirm tap resolution fail-soft", exc_info=True)


async def _compute(phone: str, text: str, ident: Dict[str, Any], message_ids: List[str],
                   tenant: str, oid: Optional[str] = None,
                   audio: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """The full 5-scale pipeline. Returns an UNPERSISTED order dict, or None if not an order.
    Updates the live `stage` on the preparing order as it goes (the loader reads it)."""
    async def stage(s: str) -> None:
        if oid:
            await events.set_stage(oid, s)

    await stage("reading")
    ctx = await context.gather(phone, text, ident, tenant)
    reads = await scales.read_all(ctx)
    await stage("matching")
    synth = await synthesiser.synthesise(ctx, reads)
    grounded = synth.get("grounded_lines") or []
    if not synth.get("is_order") and not grounded:
        return None
    if not grounded:
        return None
    vflags = validators.validate(grounded, ctx)
    # THE ORDER-LEVEL NORM (§5.8a item 1), computed HERE and not at settle time because this is where
    # `ctx` is — the same eight-order window the mind is reading in this same turn, so the validator
    # can never disagree with the history it saw. It is a REVIEW reason, never a keep-in-mind band:
    # nobody but the comercial can decide whether this customer is good for a €4.000 basket.
    order_norm = validators.validate_order(grounded, vflags, ctx)
    # ── ② THE DOUBT FACULTY, between the validators and the mind ────────────────────────────────
    # This is the only seam where all four inputs are in hand and index-aligned (`grounded` and
    # `vflags` share their indices), and it is BEFORE `decision.decide`, which is the whole point: a
    # perception note is a datum the mind reasons WITH, not a verdict applied to what it concluded.
    verdict = await classify_doubt(phone, tenant, grounded, vflags, audio)
    await stage("deciding")
    decided = await decision.decide(ctx, synth, vflags, doubt_verdict=verdict)
    lines = await tabular.build(decided, synth, vflags, ctx)
    if not lines:
        return None
    order_note, lines = await personalise.personalise(lines, decided.get("order_note", ""), ctx)
    delivery_date = synth.get("delivery_date") or None
    if delivery_date and not validators.date_ok(delivery_date):
        delivery_date = None
    return {
        "phone_number": phone,
        "customer_name": ident.get("customer_name") or synth.get("customer_name", "") or "",
        "source_message_ids": message_ids,
        "lines": lines,
        "delivery_date": delivery_date,
        "note": order_note or ident.get("note", ""),
        # the synthesiser may have judged this a CHANGE to an existing open order, not a new one
        "amends_order_id": synth.get("amends_order_id"),
        # …or a CALL-OFF of one, which has no lines and so must survive the «no lines» drop below
        "cancels_order_id": synth.get("cancels_order_id"),
        "change_reason": synth.get("change_reason", ""),
        # THE VERDICT RIDES OUT (underscored like `_was_amendment`: transport between the stages of
        # one burst, never a persisted order field — `events.finalize_order` reads named keys only).
        # `_build_order` owns the acting on it, so that the eval path (`run_message`) can compute a
        # verdict and inspect it without a real customer's phone ever ringing.
        "_doubt": verdict,
        "_doubt_question": (decided.get("pregunta") or "").strip()
                           or (decision.fallback_question(verdict["ask"][0]) if verdict.get("ask") else ""),
        # …and so does the order-level norm, for the same reason and by the same convention: it was
        # computed where `ctx` lives and is CONSUMED by `_settle_review`, which has the connection.
        "_order_norm": order_norm,
    }


async def _phase_a(phone: str, text: str, ident: Dict[str, Any],
                   message_ids: List[str]) -> Optional[Dict[str, Any]]:
    """Ungrounded fallback — only on a brain-pipeline error, so an order is never lost."""
    if not text.strip():
        return None
    extracted = await asyncio.to_thread(
        orders_mod.extract_order_sync, text, phone, ident.get("customer_name", ""), message_ids)
    if not extracted or not extracted.get("lines"):
        return None
    return {
        "phone_number": phone,
        "customer_name": ident.get("customer_name") or extracted.get("customer_name", ""),
        "source_message_ids": message_ids,
        "lines": extracted["lines"],
        "delivery_date": extracted.get("delivery_date"),
        "note": ident.get("note", ""),
    }


async def _say_cancelled(phone: str, order: Dict[str, Any], tenant: Optional[str]) -> None:
    """Tell them it is off. A cancellation the customer cannot SEE land is the same as no
    cancellation — they call, and now two people are handling one order."""
    try:
        import runtime as _rt
        day = str(order.get("delivery_date") or "")
        when = f" del {day[8:10]}/{day[5:7]}" if len(day) == 10 else ""
        await actions.send_whatsapp_as_rocoto(
            _rt.scope_of(phone, tenant),
            f"Anulado el pedido{when}. Cuando quieras otro, aquí estoy.")
    except Exception:
        log.debug("cancel confirmation not sent for %s (fail-soft)", phone, exc_info=True)


async def _say_too_late(phone: str, order_id: str, tenant: Optional[str]) -> None:
    """It is already out. Say the true thing and hand them a person — the one reply that must
    never be a cheerful «hecho», because they would stop worrying about goods that are coming."""
    try:
        import runtime as _rt
        await actions.send_whatsapp_as_rocoto(
            _rt.scope_of(phone, tenant),
            "Ese pedido ya ha salido. Te llamamos ahora para verlo.")
    except Exception:
        log.debug("late-cancel notice not sent for %s (fail-soft)", phone, exc_info=True)


async def _flash_none(order_id: str) -> None:
    """A junk message slipped the gate — flash 'no order' (red) on the card, then drop it."""
    try:
        await events.set_stage(order_id, "none")
        await asyncio.sleep(1.8)
        await events.delete_order(order_id)
    except Exception:
        log.exception("flash_none failed %s", order_id)


async def _flash_amended(order_id: str) -> None:
    """A customer follow-up just changed this (already-filed) order — pulse 'Updated' on the card for
    a few seconds, then clear back to the normal order view."""
    try:
        await events.set_stage(order_id, "amended")
        await asyncio.sleep(6)
        await events.set_stage(order_id, "")
    except Exception:
        log.exception("flash_amended failed %s", order_id)


async def _settle_review(phone: str, computed: Dict[str, Any], order_id: str,
                         tenant: str) -> None:
    """After the order is FILED: spend this order's one question, and put AT MOST ONE matter in front
    of the comercial (SPEC §5.8/§5.8a).

    ORDER MATTERS. The question goes out only once the order exists, so we never ask a customer about
    an order that turned out to be junk and got flashed away. And the park is what makes the tone law
    survivable in practice — the customer has been ACKNOWLEDGED, never CONFIRMED (the conversational
    rail writes that sentence; `review.hold_note` is what stops the mind saying «listo» about it),
    and the comercial holds the decision.

    FOUR CHECKS, ONE PARK. Doubt is computed upstream in `_compute` (it must be, it feeds the mind);
    the order-level norm rides out beside it; stock and range are read HERE, off the filed lines,
    because the filed lines are what was actually ordered — the decision agent may have picked a
    different SKU from the one the matcher preferred, and holding an order over a shortfall of a
    product nobody ended up ordering is exactly the kind of noise §5.8 exists to end.
    `park_decision` then picks the single most decision-relevant reason.

    Every half is fail-soft: a filed order is never lost to a mouth, a shelf or a queue failing.
    """
    verdict = computed.get("_doubt") or {}
    q = (computed.get("_doubt_question") or "").strip()
    if verdict.get("ask") and q:
        try:
            await ask_doubt_question(phone, verdict, q, order_id=order_id)
        except Exception:
            log.exception("doubt ask failed after filing %s", order_id)

    try:
        stock_v, range_v = await order_checks(phone, tenant, computed.get("lines") or [])
        park = park_decision(doubt_verdict=verdict, stock_verdict=stock_v,
                             range_verdict=range_v, order_norm=computed.get("_order_norm") or {})
        # NOTHING TO PARK IS THE GOOD CASE, NOT AN EXIT. This block used to `return` when `park` was
        # empty, which skipped the whole tail of this function — including `ask_order_confirm` below.
        # The effect was exactly backwards: an order WITH a problem got parked and got its confirmation
        # card, while a CLEAN order — the common one, the one where the customer is owed an answer
        # fastest — got neither the card, nor the Sí/No, nor (therefore) the portal link, since the link
        # only ever fires from the Sí tap. Peter, 2026-07-28: "didn't confirm order… it asked questions
        # but no confirmation or link".
        if park:
            import review
            import runtime
            await review.hold_for_review(
                runtime.scope_of(phone), park["source"], text=park["reason"],
                detail={"order_id": order_id, "cause": park["cause"],
                        # the losing checks ride the payload as FACTS, never as reasons: the sheet shows
                        # one sentence, the drill-down can still say what else was true.
                        "checks": {"stock_ok": bool(stock_v.get("ok")),
                                   "inventory": bool(stock_v.get("inventory")),
                                   "range_known": bool(range_v.get("known")),
                                   "distance_km": range_v.get("distance_km"),
                                   "value_ratio": (computed.get("_order_norm") or {}).get("ratio"),
                                   "doubt_kinds": sorted({str(d.get("kind"))
                                                          for d in (verdict.get("lines") or [])
                                                          if d.get("kind")})}})
    except Exception:
        log.exception("review park failed after filing %s (fail-soft)", order_id)

    # THE LINK NO LONGER GOES OUT HERE (2026-07-27). Peter caught it: the runtime was sending a
    # customer their confirmation link the moment an order was FILED — which the docstring below
    # used to say out loud, unflinchingly: "the customer has been ACKNOWLEDGED, never CONFIRMED".
    # The link is now `_offer_portal_link`'s job ONLY, and it fires from `resolve_order_confirm_tap`
    # once the customer has actually said the order is correct. What happens here instead is the
    # question itself.
    #
    # §17.56 Q5 — `behaviour.confirm` gates WHETHER the question goes out at all:
    #   'always' → today's behaviour, verbatim (and the default, so an untouched tenant changes
    #              nothing); 'never' → the supplier said the card is noise, skip it entirely;
    #   'doubt'  → ask only when this turn actually left something doubtful — any line the faculty
    #              classified (the verdict's own per-line kinds; an UNKNOWN kind IS the unmatched
    #              line on this pipeline). That is the cheapest signal that is already in hand and
    #              already honest: it was computed for the mind this same turn, so the confirm gate
    #              can never disagree with what the customer was told.
    # Fail-soft toward ASKING: behaviour.get already degrades to defaults, and a settings blip must
    # not silently stop confirmations — the un-asked customer is the invisible failure here.
    confirm = "always"
    try:
        import behaviour as _behaviour
        confirm = (await _behaviour.get(tenant)).get("confirm") or "always"
    except Exception:
        log.debug("behaviour.confirm read fail-soft — asking as always", exc_info=True)
    doubted_turn = any(d.get("kind") for d in (verdict.get("lines") or []))
    if confirm == "never" or (confirm == "doubt" and not doubted_turn):
        log.info("order confirm skipped for %s (behaviour.confirm=%s, doubted=%s)",
                 order_id, confirm, doubted_turn)
        # ONE SETTING, ONE EFFECT (punch list B0, fixed 2026-08-09). This used to be a bare
        # `return`, and the return skipped `ask_order_confirm` — whose Sí branch is the ONLY caller
        # of `_offer_portal_link`. So a supplier turning off ONE MESSAGE («la tarjeta ¿Es correcto?
        # es ruido») silently also turned off the RECEIPT RAIL for every one of their customers,
        # forever, with nothing logged and nothing on the setting's label to warn them. Reachable in
        # production through `POST /api/sup/behaviour`; §17.55j's exact failure mode — a label that
        # promises one thing and delivers two.
        #
        # THE LINK IS THE RECEIPT, NOT THE CONFIRMATION. When no question is asked there is no
        # answer to wait for, so the customer's own door is offered on the FILING instead. Nothing
        # changes for `confirm='always'` (the default, and every untouched tenant), and nothing can
        # be sent twice: `_offer_portal_link` is once-per-customer and the once is enforced by a
        # `portal.link_sent` event on their scope, not by this branch.
        await _offer_portal_link(phone, tenant)
        return
    await ask_order_confirm(phone, order_id, tenant)


async def ask_order_confirm(phone: str, order_id: str, tenant: str) -> Dict[str, Any]:
    """§5.9, the missing step — the clean order card as a PICTURE, then one tap: **¿Es correcto?**

    Runs where `_offer_portal_link` used to run (right after the park, "an extra must never be able
    to cost a filing" applies here just as much): renders `brain/order_card.render_order_card` off
    the SAME lines `portal._lines_out` would show on the confirmation page (one source of truth,
    never two descriptions of the same order), saves it under MEDIA_DIR exactly the way a stock
    capture photo is served, sends it through `actions.send_whatsapp_as_rocoto` (the gated door — a
    price on this card is still a quote, so MODO SOMBRA and the money gate apply to it precisely as
    they do to a typed sentence), then asks Sí/No through `send_interactive_as_rocoto`. The
    `order_confirm.asked` event records `ask_key` (the wamid we asked with) exactly like the doubt
    loop's `doubt.asked`, which is what lets a tap resolve with no re-inference — see
    `resolve_order_confirm_tap`.

    ONCE PER ORDER, not once per customer (unlike the portal link): a different order is a different
    question, so the guard is `order_id`, not the scope. Fail-soft throughout — a render failure, a
    mouth failure or a gate hold leaves the order exactly where it was; the comercial still has it in
    «lo que te toca» either way, and the customer just does not get asked on this one."""
    try:
        import actions
        import db
        import portal
        import runtime as _rt
        import spine
        scope = _rt.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            already = await con.fetchval(
                "select 1 from event where scope=$1::ltree and type=$2 "
                "and payload->>'order_id' = $3 limit 1",
                scope, ORDER_CONFIRM_ASKED_EVENT, order_id)
        if already:
            return {"ok": True, "noop": True, "reason": "already_asked"}
        # `orders`/`tenants` are NOT read through the scope-RLS connection above — same seam
        # `portal.py`'s own reads use (`db.get_pool()`, unscoped): the customer's own RLS scope has
        # no reason to be able to see either table directly, and a scoped connection reading them
        # would either read nothing (RLS blocks it) or, worse, rely on a policy nobody wrote for
        # this call site to happen to allow it.
        pool = db.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select customer_name, lines from orders where id=$1", order_id)
            if not row:
                return {"ok": False, "reason": "order_not_found"}
            biz = await con.fetchrow("select name from tenants where slug=$1", tenant)
        lines = portal._lines_out(row["lines"])
        if not lines:
            return {"ok": False, "reason": "no_lines"}
        total = portal._order_total(lines)
        from brain import order_card
        png = order_card.render_order_card(
            business_name=(biz["name"] if biz else "") or tenant,
            customer_name=str(row["customer_name"] or ""), lines=lines, total=total,
            fecha=fecha_es_now())
    except Exception:
        log.exception("ask_order_confirm: could not render the card for %s (fail-soft)", order_id)
        return {"ok": False, "reason": "render_failed"}

    try:
        import uuid
        from pathlib import Path

        import config
        # `/wamedia/{f}` (OUTBOUND_DIR = MEDIA_DIR/out), NOT `/media/{f}`. Meta fetches an outbound
        # media URL ITSELF, anonymously — and `/media` is per-user authed (`require_media_auth`), so
        # it answered 401 to Meta and the picture silently never arrived while the Sí/No question,
        # sent as plain text on the same rail, did. Peter, 2026-07-28: "keeps saying es correcto tu
        # pedido but doesn't send the image of the pedido". `/wamedia` is the no-auth route that
        # exists for exactly this ("so Twilio's CDN can fetch it") and is what `/api/send-media`
        # already uses for every operator-sent photo.
        outbound = Path(config.MEDIA_DIR) / "out"
        fname = f"order-{order_id}-{uuid.uuid4().hex[:8]}.png"
        outbound.mkdir(parents=True, exist_ok=True)
        (outbound / fname).write_bytes(png)
        image_url = f"{config.PUBLIC_BASE_URL.rstrip('/')}/wamedia/{fname}"
        sent = await actions.send_whatsapp_as_rocoto(scope, "", media_url=image_url)
        if not sent:
            # sombra held it, or the mouth failed. Nothing was said, so nothing is asked either —
            # the comercial still has the order, and a later order gets another chance to ask.
            return {"ok": False, "reason": "image_send_failed"}
        res = await actions.send_interactive_as_rocoto(
            scope, "¿Es correcto tu pedido?",
            [{"id": ORDER_CONFIRM_YES_ID, "title": "Sí, es correcto"},
             {"id": ORDER_CONFIRM_NO_ID, "title": "No es correcto"}])
        if not res.get("ok"):
            log.info("order confirm question not sent phone=%s order=%s reason=%s",
                     phone, order_id, res.get("reason"))
            return res
        sid = str(res.get("sid") or "")
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, ORDER_CONFIRM_ASKED_EVENT, "portal",
                                     {"order_id": order_id, "ask_key": sid, "tenant": tenant},
                                     lane="world", dedupe_key=f"orderconfirm:{order_id}")
        return {"ok": True, "sid": sid}
    except Exception:
        log.exception("ask_order_confirm: send failed for %s (fail-soft)", order_id)
        return {"ok": False, "reason": "send_failed"}


async def resolve_order_confirm_tap(phone: str, *, asked_wamid: str = "", option_id: str = "",
                                    option_title: str = "", tenant: Optional[str] = None) -> Dict[str, Any]:
    """The customer answered **¿Es correcto?** — same lookup shape as `resolve_doubt_tap`: find the
    `order_confirm.asked` event this wamid answers, act once, record the answer so a repeat tap is a
    no-op rather than a second link or a second park.

    Sí → `_offer_portal_link` — THE ONLY place that function is called from now. The customer's own
    yes is what "confirmed" means; the link was never the acknowledgement, it is the reward for it.

    No → held for review with the customer's own words as the reason (§5.8a's tone law — ONE
    sentence, never a composed one), so the comercial sees it in «lo que te toca» instead of a link
    going out on an order the customer just said is wrong."""
    tenant = tenant or config.BRAIN_TENANT
    try:
        import db
        import runtime
        import spine
        scope = runtime.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            if asked_wamid:
                row = await con.fetchrow(
                    "select id, payload from event where scope=$1::ltree and type=$2 "
                    "and payload->>'ask_key' = $3 order by id desc limit 1",
                    scope, ORDER_CONFIRM_ASKED_EVENT, asked_wamid)
            else:
                row = await con.fetchrow(
                    "select id, payload from event where scope=$1::ltree and type=$2 "
                    "order by id desc limit 1", scope, ORDER_CONFIRM_ASKED_EVENT)
            if not row:
                return {"ok": True, "noop": True, "reason": "no_open_question"}
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload or "{}")
            order_id = str((payload or {}).get("order_id") or "")
            oid = (option_id or "").strip()
            is_yes = oid == ORDER_CONFIRM_YES_ID or option_title.strip().lower() == "sí, es correcto"
            is_no = oid == ORDER_CONFIRM_NO_ID or option_title.strip().lower() == "no es correcto"
            if not (is_yes or is_no):
                return {"ok": True, "noop": True, "reason": "not_an_answer"}
            settled = await con.fetchval(
                "select 1 from event where scope=$1::ltree and type = any($2::text[]) "
                "and caused_by=$3 limit 1",
                scope, [ORDER_CONFIRM_YES_EVENT, ORDER_CONFIRM_NO_EVENT], int(row["id"]))
            if settled:
                return {"ok": True, "noop": True, "reason": "already_answered"}
            await spine.append_event(
                con, scope, ORDER_CONFIRM_YES_EVENT if is_yes else ORDER_CONFIRM_NO_EVENT, "portal",
                {"order_id": order_id, "ask_key": asked_wamid}, caused_by=int(row["id"]), lane="world")
    except Exception:
        log.exception("resolve_order_confirm_tap: could not read the question (fail-soft)")
        return {"ok": False}

    if is_yes:
        await _offer_portal_link(phone, tenant)
        return {"ok": True, "confirmed": True, "order_id": order_id}

    try:
        import review
        await review.hold_for_review(
            runtime.scope_of(phone), "flag",
            text="El cliente dice que su pedido no es correcto.",
            detail={"order_id": order_id, "cause": "customer_said_incorrect"})
    except Exception:
        log.exception("resolve_order_confirm_tap: hold_for_review failed for %s (fail-soft)", order_id)
    return {"ok": True, "confirmed": False, "order_id": order_id}


async def _offer_portal_link(phone: str, tenant: str) -> None:
    """§5.9 — hand the customer their OWN door, exactly once.

    TWO CALLERS SINCE 2026-08-09, and the pair is the rule: the link goes out when the customer has
    said the order is correct (`resolve_order_confirm_tap`), OR — when `behaviour.confirm` means no
    question is asked at all — on the FILING (`_settle_review`), because there is then no answer to
    wait for. THE LINK IS THE RECEIPT, NOT THE CONFIRMATION: it was one caller before, and that made
    one setting silently govern two rails (punch list B0).

    `portal.link_for()` mints (or re-uses) the one active link for this customer and
    `portal.link_line_es()` writes the sentence.

    ONCE, and the once is enforced by the SPINE, not by a flag: a `portal.link_sent` event on the
    customer's own scope. A link in every order confirmation would be spam, and a customer who has
    bookmarked theirs does not need it again. The event is the record, so it survives restarts and
    is answerable later ("did we ever send them one?").

    Fail-soft throughout — a mint failure, a mouth failure or a spine hiccup leaves the order exactly
    where it was and simply means the customer gets their link on a later order."""
    try:
        import actions
        import db
        import portal
        import runtime as _rt
        scope = _rt.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            already = await con.fetchval(
                "select 1 from event where scope=$1::ltree and type='portal.link_sent' limit 1", scope)
        if already:
            return
        link = await portal.link_for(phone, tenant=tenant)
        url = (link or {}).get("url") or ""
        if not url:
            return
        await actions.send_whatsapp_as_rocoto(scope, portal.link_line_es(url))
        # Recorded only AFTER the send returns, so a mouth that failed does not burn the one chance.
        import spine
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, "portal.link_sent", "portal",
                                     {"tenant": tenant}, lane="world",
                                     dedupe_key=f"portallink:{scope}")
    except Exception:
        log.debug("portal link offer skipped for %s (fail-soft)", phone, exc_info=True)


async def _build_order(phone: str, msgs: List[Dict[str, Any]], text: str, ident: Dict[str, Any],
                       message_ids: List[str], tenant: str,
                       audio: Optional[Dict[str, Any]] = None,
                       seeded: bool = False) -> Optional[Dict[str, Any]]:
    # 1) Recognised: reuse the 'preparing' card already dropped at message-arrival (so the operator saw
    #    it instantly). MERGE any messages it already covered with this burst, so anything that came in
    #    while Rocoto was taking the order is folded into the SAME order.
    oid = await events.find_preparing(phone, tenant)
    all_ids = list(message_ids)
    if oid:
        prev = await _order_source_ids(oid)
        all_ids = list(dict.fromkeys(list(prev) + list(message_ids)))
        if set(all_ids) != set(message_ids):
            msgs = await _gather(all_ids)
            text, _ = _combine(msgs)
    else:
        # `seeded` rides the `created` event (the fold carries it forward through finalize), so an order
        # the DEMO WORLD filed through the real brain is marked as the seed's own from birth. Without it
        # `reset_demo_seed` could not remove an order the seed itself created — and a reset that leaves
        # its own rows behind is not a reset. Production always passes False.
        o = await events.create_order({
            "phone_number": phone, "customer_name": ident.get("customer_name", ""),
            "source_message_ids": message_ids, "lines": [], "status": "preparing",
        }, actor="system", seeded=seeded, tenant=tenant)
        oid = o["id"]
    try:
        computed = await _compute(phone, text, ident, all_ids, tenant, oid=oid, audio=audio)
    except Exception:
        log.exception("brain pipeline failed phone=%s — falling back to Phase-A", phone)
        computed = await _phase_a(phone, text, ident, all_ids)
    # 1b) CALLED OFF? «Anúlame el pedido de mañana.» This is checked BEFORE the «no lines» drop
    #     below, because a cancellation legitimately carries no lines — which is exactly how it
    #     used to vanish: the customer said the words, the placeholder flashed «no order», and the
    #     goods stayed on tomorrow's sheet. See `events.cancel_order` for why it is an amendment
    #     rather than a deletion.
    cancel_id = computed.get("cancels_order_id") if computed else None
    if cancel_id and cancel_id != oid:
        cancelled = await events.cancel_order(
            cancel_id, reason=computed.get("change_reason", ""),
            source_message_ids=all_ids, actor="customer")
        await events.delete_order(oid)   # the placeholder was never a separate order
        if cancelled:
            await _attach_entities(all_ids, cancelled)
            cancelled["_was_cancellation"] = True
            await _say_cancelled(phone, cancelled, tenant)
            await _notify_order(cancelled)   # she may have printed it — the phone buzzes
            return cancelled
        # PAST CANCELLING — already on the van. Say so rather than confirm something we cannot do;
        # `_build_order`'s reply path is not reached for a call-off, so this is the one place the
        # truth can be told.
        log.info("cancel refused (not amendable) order=%s phone=%s", cancel_id, phone)
        await _say_too_late(phone, cancel_id, tenant)
        return None

    if not computed or not computed.get("lines"):
        asyncio.create_task(_flash_none(oid))   # briefly flash "no order" (red) then drop the placeholder
        return None

    # 2) CHANGE to an existing order? The customer modified one they already placed (e.g. "actually
    #    make the ribs 10kg" minutes later). Fold the change into the SAME order — keep its identity,
    #    evolve its state, keep the trail — instead of filing a confusing duplicate. Falls through to a
    #    new order if the target turns out to be already shipped/gone.
    amend_id = computed.get("amends_order_id")
    if amend_id and amend_id != oid:
        amended = await events.amend_order(
            amend_id, computed, reason=computed.get("change_reason", ""),
            source_message_ids=all_ids, actor="customer")
        if amended:
            await events.delete_order(oid)   # the transient placeholder isn't a separate order
            await _attach_entities(all_ids, amended)
            asyncio.create_task(_flash_amended(amended["id"]))
            amended["_was_amendment"] = True
            await _settle_review(phone, computed, amended["id"], tenant)
            return amended

    order = await events.finalize_order(oid, computed)
    if order:
        await _attach_entities(all_ids, order)   # auto-highlight the products in the source messages
        await _settle_review(phone, computed, order["id"], tenant)
    return order


async def run_burst(phone: str, message_ids: List[str],
                    tenant: Optional[str] = None,
                    seeded: bool = False) -> Optional[Dict[str, Any]]:
    """`seeded` marks an order the DEMO WORLD filed through the real brain (brain/seed.py's
    ingest_demo_message), so `reset_demo_seed` can remove its own rows. Production never passes it."""
    tenant = tenant or config.BRAIN_TENANT
    msgs = await _gather(message_ids)
    if not msgs:
        return None

    # PAUSE intake while anything is still transcribing — keep the card 'listening' and retry shortly,
    # so a voice note mid-transcription is never dropped from the order (Peter: trust the debounce).
    if _any_transcribing(msgs):
        oid = await events.find_preparing(phone, tenant)
        if oid:
            await events.set_stage(oid, "listening")
        await queue.requeue(message_ids, delay=4)
        return REQUEUED   # tell the drainer NOT to mark these done — the requeue retries them

    text, has_media = _combine(msgs)

    junk, reason = junkgate.is_junk(text, has_media)
    if junk:
        log.info("junk dropped phone=%s reason=%s msgs=%d", phone, reason, len(message_ids))
        return None

    # ⑤ CLOSE THE LOOP FIRST. An answer sitting in this burst must become an `sku_aliases` row BEFORE
    # the matcher runs on the same burst — that way the customer's tap resolves the very order it was
    # about, instead of taking effect one order late.
    await _resolve_taps(phone, msgs, tenant)

    ident = await identity.resolve(phone, text=text, tenant=tenant)
    order = await _build_order(phone, msgs, text, ident, message_ids, tenant,
                               audio=audio_verdict(msgs), seeded=seeded)
    if order:
        log.info("order %s built phone=%s (%d msgs, %d lines)",
                 order["id"], phone, len(message_ids), len(order.get("lines") or []))
        await _notify_order(order)
    return order


async def run_message(text: str, phone: Optional[str] = None, *, persist: bool = False,
                      tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Run a single ad-hoc message through the pipeline (eval / /api/brain/run). Uses the phone's
    seeded/real history for context. persist=False returns the computed order without saving."""
    tenant = tenant or config.BRAIN_TENANT
    phone = phone or "+10000000000"
    ident = await identity.resolve(phone, text=text, tenant=tenant)
    try:
        order = await _compute(phone, text, ident, ["adhoc"], tenant)
    except Exception:
        log.exception("brain run_message failed")
        order = await _phase_a(phone, text, ident, ["adhoc"])
    if persist and order:
        order = await events.create_order(order, actor="system", tenant=tenant)
    return order
