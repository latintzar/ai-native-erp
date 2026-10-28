"""voice_protocol.py — the in-call §7 LATENCY PROTOCOL brain (answer-first / check-aside / rejoin).

This is the per-utterance runtime reasoning for a LIVE voice call — the organ the ElevenLabs bridge
calls once per ASR-final. It is the spoken-mode sibling of the written mind: same spine, same memory,
same gate, but bent around a hard human constraint — on a phone call, silence reads as failure. So the
protocol is built to ALWAYS put something true in Rocoto's mouth within a ~1s budget, and to never let
a slow lookup turn into dead air.

SPEC §7 LATENCY PROTOCOL — three moves, decided in ONE Haiku pass (R1 classify+reply):

  (1) INLINE / answer-first — the utterance can be answered from what is already PINNED in the call
      context (the card + the tabs + the contingencies riding on session_ctx), OR it needs an EXACT
      keyed lookup (this customer's price, their debt, an order's status). Keyed lookups run
      SYNCHRONOUSLY through memory.lookup_fact / memory.search — they are millisecond-scale index hits
      (schema_runtime.sql ix_fact_key: `(scope,key) where invalid_at is null`), and MONEY IS NEVER
      ANSWERED STALE. The reply is spoken immediately. deferred=False.

  (2) CHECK-ASIDE — anything that CANNOT be answered inside the budget (a Medusa round-trip, an email,
      an external confirmation, a human hand-off) does not block the call. We speak a natural holding
      line ("déjame comprobarlo, sigo contigo"), schedule the real work as a parked action + a
      voice.aside event, and return deferred=True. The bridge keeps the human company; the worker (or
      the bridge's own aside executor) does the slow thing and calls rejoin() when it lands.

  (3) REJOIN — rejoin(scope, session_ctx, answer) composes the follow-up sentence Rocoto says when the
      aside completes ("ya lo tengo — …"), passing it back through the gate, and marks the open aside
      resolved on session_ctx.

THE MONEY FLOOR (SPEC §5): every outbound sentence that carries money content passes gate.check_outbound
SYNCHRONOUSLY, block-then-speak. On a live call there is no review sheet the human will see mid-call, so
a gated (parked) money sentence is REPLACED with a safe deferral ("eso ya lo confirmo yo y te lo paso") —
Rocoto never voices an off-book price or a concession. Over-deferring is safe; voicing bad money is not.

PURITY (BUILD-PLAN, bridge-wiring note): this module is pure-ish. in_call_turn takes (scope:str,
utterance:str, session_ctx:dict) and does its own scoped_tx for the spine append + the keyed reads. The
ElevenLabs bridge owns the socket, the ASR, and the TTS; it calls in_call_turn per ASR-final, speaks the
returned `reply`, and — when deferred — keeps a holding presence until it receives a rejoin() sentence
for one of the keyed_reads/aside ids. `session_ctx` is the bridge-owned per-call scratch dict:
  {
    "call_id": str,                # the bridge's call handle (dedupe + aside correlation)
    "card": str,                   # the pinned FICHA body (memory.regen_card output), read once at answer
    "tabs": [ {id,kind,text,entity_key,answer_shape,money}, ... ],   # open_loop rows pinned at call start
    "contingencies": [ ... ],      # pre-armed branches riding from the tabs (schema open_loop.contingencies)
    "standing_prices": { "price:jamon": 12.0, ... },   # keyed standing prices for the gate delta check
    "open_asides": { aside_id: {utterance, keyed_reads, opened_at}, ... },  # in-flight check-asides
    "lang": "es",
  }
session_ctx is mutated in place (open_asides bookkeeping) so the bridge can correlate a rejoin.

jsonb params are passed as Python dicts (never json.dumps()+::jsonb — the codec double-encodes). Scope
is cast ::ltree at the SQL boundary (asyncpg has no ltree codec). Everything is fail-soft: a live call
must never crash on a reasoning error — the worst case is a graceful "déjame confirmarlo".
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import config
import gate
import memory
import soul as _soul
import spine
import triggers as _triggers

log = logging.getLogger("rocoto.voice_protocol")

# ── the ~1s budget knobs (SPEC §7) ───────────────────────────────────────────────────────────
# The R1 Haiku pass is the only model call per utterance. Keyed reads are index hits (ms-scale) so
# they ride inside INLINE; anything heavier than a keyed read is a CHECK-ASIDE by construction.
_R1_TIMEOUT_S = 1.6           # hard cap on the classify+reply call; EL's soft-timeout filler fires at 1.8s, so the human hears «Vale…» right as we'd fall back — never dead air
_R1_MAX_TOKENS = 220          # a spoken sentence or two — kept tight for latency
_KEYED_READ_CAP = 4           # how many exact keyed lookups we'll run synchronously in one INLINE turn

# holding lines (SPEC §7 CHECK-ASIDE) — natural, short, keep-the-human-company. Spanish default.
_HOLDING_LINE = "Déjame comprobarlo un momento, sigo contigo."
_HOLDING_MONEY = "Eso lo confirmo yo bien y te lo paso, que en dinero no quiero jugármela."
_REJOIN_PREFIX = "Ya lo tengo:"
_SAFE_FALLBACK = "Déjame confirmarlo y te digo con seguridad."
# The ONE no-model floor (2026-07-25): spoken ONLY when the R1 pass returned nothing (fail/timeout) on
# a no-catalogue caller — infrastructure, never stage behaviour. WHAT to say at a stage is the JOB
# BRIEF's job (lifecycle.notes → the R1 system slot); the old canned pitch/dodge branches are retired.
# Two variants so consecutive timeouts alternate naturally instead of parroting.
_NO_MODEL_FLOOR = "Perdona, me he quedado un segundo colgado — ¿me lo repites, que te lo apunto bien?"
_NO_MODEL_FLOOR_2 = "Perdona, sigo un poco espeso — dime otra vez qué necesitas, que te lo apunto."


# ── the shared Anthropic client (one per process; mirrors voice_reply's F7/F8) ────────────────
_async_anthropic = None            # anthropic.AsyncAnthropic | None
_anthropic_ready = False


def _anthropic():
    """Lazily build + cache ONE AsyncAnthropic client (SPEC §7: one Haiku pass per utterance, on the
    event loop so a slow model call doesn't park a shared thread). Returns the client or None (no key /
    SDK absent) — callers degrade to a holding line."""
    global _async_anthropic, _anthropic_ready
    if _anthropic_ready:
        return _async_anthropic
    _anthropic_ready = True
    if not config.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic
    except Exception:
        log.exception("voice_protocol: anthropic sdk import failed")
        return None
    try:
        _async_anthropic = anthropic.AsyncAnthropic(
            api_key=config.ANTHROPIC_API_KEY, max_retries=0, timeout=_R1_TIMEOUT_S + 0.4)  # NO retry in a live call — a retry doubles the lag (Peter's 3.4s turns); fail → the natural fallback
    except Exception:
        log.exception("voice_protocol: AsyncAnthropic init failed")
        _async_anthropic = None
    return _async_anthropic


# ── keyed-intent detection (which EXACT facts the utterance is asking about) ───────────────────
# Money/status utterances map to canonical keys we can hit synchronously. Deliberately conservative:
# a keyed read must be an EXACT lookup, never a guess. The utterance's own words + the pinned tabs
# tell us which keys to pull. (SPEC §4.4: the must-not-miss exact path is index-backed, ms-scale.)
_PRICE_Q = _triggers.PRICE_Q
_DEBT_Q = _triggers.DEBT_Q
_STATUS_Q = _triggers.STATUS_Q

# heavy intents that CANNOT complete inside the budget → always CHECK-ASIDE (a network round-trip or a
# human hand-off). These are recognized so the classifier's holding-line branch is deterministic, not
# left to the model. (SPEC §7: place/confirm/email/escalate are aside work, never inline.)
_ASIDE_HINTS = _triggers.ASIDE_HINTS


async def pinned_window(con, scope: str, now=None) -> str:
    """THE RECENCY WINDOW for the pinned fold — DELEGATED to `assemble` so the two mouths can never
    hold two different ideas of "recent" (SPEC §4.1/§4.1.1 ③).

    Three audited deltas closed here (2026-07-25 context audit, gap 9):
      · the bound is the open tab's ORIGIN EVENT, not its `opened_at` (a tab opened today about a
        three-week-old event must pull the CAUSE in);
      · no 12-ROW CAP — the TOKEN BUDGET binds, exactly like the chat fold;
      · ALL world-lane event types ride (a payment, a call, a delivery webhook are all "what just
        happened"), not only message/msg.sent/utterance;
      · the clock is the PINNED assembled_at, never now().
    Deterministic, fail-soft ''."""
    try:
        from datetime import datetime as _dt
        from datetime import timezone as _tz

        import assemble as _assemble
        now = now or _dt.now(_tz.utc)
        rows = await _assemble.window_rows(con, scope, now)
        lines, _ = _assemble.render_window(rows, now)
        return "\n".join("  " + ln for ln in lines)
    except Exception:
        return ""


async def pinned_tabs(con, scope: str, cap: int = 40) -> list[dict]:
    """Structured open tabs (dicts: id/kind/text/entity_key/verdict) for the voice pinned fold.
    `assemble.assemble` returns tabs as RENDERED STRINGS, but the voice path reads fields —
    `_grounding_block` (id/kind/text/verdict) and `_pinned_keys` (entity_key, for the keyed money
    reads) — so passing the rendered strings crashes into the holding line on any call with an open
    tab. B1: each tab now carries `verdict`, its LATEST reasoning output (SPEC §4.1.1 ④ — a tab's
    verdicts ride WITH the tab, never as an anonymous recall line). Fail-soft []."""
    try:
        rows = await con.fetch(
            "select id, kind, text, entity_key from open_loop where scope=$1::ltree and status='open' "
            "order by opened_at desc, id desc limit $2", scope, cap)
        out = [dict(r) for r in rows]
        try:
            import assemble as _assemble
            verdicts = await _assemble.tab_reasoning(con, scope, [int(r["id"]) for r in rows])
        except Exception:
            verdicts = {}
        for t in out:
            t["verdict"] = verdicts.get(int(t["id"]), "")
        return out
    except Exception:
        return []


async def recall_at_start(con, scope: str, tabs: list) -> list[str]:
    """At-call-start recall (the pinned fold's 4th block): query = the open tabs + the latest summary
    (the call's likely topics). Returns memory lines. Fail-soft []."""
    try:
        import memory
        q = " ".join((t.get("text") or "") if isinstance(t, dict) else str(t) for t in (tabs or [])[:5])
        last_sum = await con.fetchval(
            "select text from summary where scope=$1::ltree order by id desc limit 1", scope) or ""
        q = (q + " " + last_sum[:200]).strip() or "cliente pedido"
        hits = await memory.search(con, scope, q, k=5)
        return [h.get("text", "") for h in hits if h.get("text")]
    except Exception:
        return []


def _pinned_keys(session_ctx: dict) -> list[str]:
    """The entity_keys already pinned on the call's tabs (open_loop.entity_key) — the cheap read set."""
    keys: list[str] = []
    for t in (session_ctx.get("tabs") or []):
        k = (t or {}).get("entity_key")
        if k:
            keys.append(str(k))
    return keys


def _keys_for_utterance(utterance: str, session_ctx: dict) -> list[str]:
    """Choose the EXACT keys to look up synchronously for this utterance. Price/debt/status questions map
    to their canonical key families; we prefer keys already pinned on the call's tabs, then fall back to
    the well-known key prefixes. Capped at _KEYED_READ_CAP. Never invents a customer-specific value —
    it only names a KEY; memory.lookup_fact returns None if there's no current fact."""
    u = utterance or ""
    pinned = _pinned_keys(session_ctx)
    wanted: list[str] = []

    def _add(prefix: str) -> None:
        # prefer a pinned key in this family; else the bare family key (lookup returns None if absent).
        hit = next((k for k in pinned if k.startswith(prefix)), None)
        wanted.append(hit or prefix.rstrip(":"))

    if _DEBT_Q.search(u):
        # debt is the sum of open invoices; the pinned invoice tabs are the exact keys.
        inv_keys = [k for k in pinned if k.startswith("invoice:")]
        wanted.extend(inv_keys or ["debt"])
    if _STATUS_Q.search(u):
        ord_keys = [k for k in pinned if k.startswith("order:")]
        wanted.extend(ord_keys or ["order:last"])
    if _PRICE_Q.search(u):
        _add("price:")

    # de-dup, preserve order, cap.
    seen: set[str] = set()
    out: list[str] = []
    for k in wanted:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
        if len(out) >= _KEYED_READ_CAP:
            break
    return out


def _has_money(utterance: str, keyed: list[str]) -> bool:
    """A turn touches money if it asked a money question OR we pulled a money key (price/debt/invoice)."""
    if _PRICE_Q.search(utterance or "") or _DEBT_Q.search(utterance or ""):
        return True
    return any(str(k).startswith(("price:", "invoice:", "debt")) for k in keyed)


# ── (1) INLINE keyed reads — synchronous, ms-scale, money-never-stale (SPEC §4.4/§7) ──────────
async def _run_keyed_reads(con, scope: str, keys: list[str]) -> dict[str, Optional[str]]:
    """Run the exact keyed lookups SYNCHRONOUSLY (index hit on fact(scope,key) where invalid_at is null).
    Returns {key: current_fact_text_or_None}. Fail-soft: a broken read yields None, never raises."""
    out: dict[str, Optional[str]] = {}
    for k in keys:
        try:
            out[k] = await memory.lookup_fact(con, scope, k)
        except Exception:
            log.exception("voice_protocol: keyed read failed for %s (fail-soft None)", k)
            out[k] = None
    return out


def _grounding_block(card: str, keyed: dict[str, Optional[str]], tabs: list[dict],
                     recall: Optional[list] = None, window: str = "",
                     recall_inflight: bool = False, ahora: str = "", directory: str = "",
                     frame: str = "", lifecycle_block: str = "", standing: str = "",
                     supplier: str = "", order_state: str = "", message: str = "") -> str:
    """The pinned, ANSWER-FIRST context the R1 pass may answer FROM — rendered against the SAME
    §4.1.1 registry the chat fold uses (`assemble.COMPONENTS`), so a component can never exist on one
    mouth only. Nothing here is a guess; keyed holes are shown as holes so the model doesn't fabricate
    a value it doesn't have (it must aside instead).

    The EXACT-DATA block is voice-only and deliberately so: it is the §7 in-call keyed read (money is
    never stale on a live call), which the chat lane resolves mid-turn instead."""
    import assemble as _assemble
    C = _assemble.COMPONENTS
    parts: list[str] = []
    if frame:
        parts.append(C["frame"] + "\n" + frame.strip())
    if card:
        parts.append(C["profile_card"] + "\n" + card.strip())
    parts.append(C["lifecycle"] + "\n" + (lifecycle_block.strip() if lifecycle_block
                 else "(fase no disponible — no asumas nada sobre su alta)"))
    parts.append(C["standing"] + "\n" + (standing.strip() if standing
                 else "(el jefe no te ha dejado ninguna instrucción permanente aquí)"))
    if keyed:
        lines = []
        for k, v in keyed.items():
            lines.append(f"  · {k} = {v}" if v is not None else f"  · {k} = (no consta — NO lo inventes)")
        parts.append("### EXACT DATA (recién consultados, no caducados)\n" + "\n".join(lines))
    parts.append(C["window"] + "\n" + (window if window else "  (nada reciente)"))
    if tabs:
        tl = []
        for t in tabs[:8]:
            ln = f"  · #{t.get('id')} {t.get('kind','')}: {t.get('text','')}".rstrip()
            if (t.get("verdict") or "").strip():
                ln += f"\n      ↳ lo que ya has razonado sobre esto — {t['verdict'].strip()}"
            tl.append(ln)
        parts.append(C["tabs"] + "\n" + "\n".join(tl))
    else:
        parts.append(C["tabs"] + "\n  (ninguno)")
    parts.append(C["supplier"] + "\n" + (supplier.strip() if supplier
                 else "(sin proveedor detrás de esta conversación)"))
    if directory:
        # SPLICED by the §6 `skus_uploaded` box (the caller decides) — absent is KNOWN-STATE.
        parts.append(_assemble.CATALOGUE_HEAD + "\n" + directory.strip())
    parts.append(C["order_state"] + "\n" + (order_state.strip() if order_state
                 else "(nada en curso ni parado en la puerta)"))
    parts.append(C["right_now"] + "\n" + (ahora.strip() if ahora
                 else "(nada en marcha en otro canal ahora mismo)"))
    if recall:
        head = C["recall"] + (" (refrescándose ahora — puede llegar más en el siguiente turno)"
                              if recall_inflight else "")
        parts.append(head + "\n" + "\n".join(f"  · {r}" for r in recall[:8]))
    elif recall_inflight:
        parts.append(C["recall"] + "\n  (buscando en la memoria ahora mismo — si te falta un dato, "
                     "dilo con naturalidad y sigue)")
    else:
        parts.append(C["recall"] + "\n  (la búsqueda no ha traído nada relevante)")
    if message:
        parts.append(C["message"] + "\n" + message.strip())
    return "\n\n".join(parts)


# the spoken-channel delivery overlay is SOUL-owned (soul.VOICE_OVERLAY — one SOUL, many mouths).
_R1_SYSTEM = _soul.VOICE_OVERLAY


async def _r1_classify_reply(scope: str, utterance: str, grounding: str, lang: str,
                             system_extra: str = "") -> tuple[str, bool]:
    """THE single Haiku pass (SPEC §7 R1): classify INLINE-vs-ASIDE and, if inline, produce the spoken
    reply — in ONE call, within the budget. Returns (reply_text, wants_aside). The model emits the
    literal <ASIDE> token when it cannot answer from the pinned context; we map that to a check-aside.
    `system_extra` (2026-07-25 slot fix) carries the identity + stage JOB BRIEF (persona + lifecycle
    notes) as SYSTEM bytes — the same slot the chat mouth uses — never as counterparty-adjacent user
    data. Fail-soft: any error/timeout → ("", True) so the caller falls to a holding line, not dead air."""
    client = _anthropic()
    if client is None:
        return "", True
    system = _R1_SYSTEM.format(lang="español" if (lang or "es").startswith("es") else lang)
    if (system_extra or "").strip():
        system = system + "\n\n" + system_extra.strip()
    # the utterance already rides the fold's ### MESSAGE slot (one registry, both mouths); this is the
    # spoken-turn instruction, not a second copy of the context.
    user = (grounding + "\n\n" if grounding else "") + f"La persona acaba de decir: «{utterance}»\nTu respuesta hablada:"
    try:
        # PROMPT CACHE (2026-07-25): the system slot (overlay + persona + stage brief) is STABLE within
        # a call — cache it so turns 2+ pay ~zero prefill for the brief bytes (keeps the §7 ~1s budget
        # honest after the job-brief rework grew the system). Below the model's cacheable minimum this
        # is a harmless no-op.
        resp = await client.messages.create(
            model=config.VOICE_CHAT_MODEL, max_tokens=_R1_MAX_TOKENS,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}])
        text = "".join(getattr(b, "text", "") for b in resp.content
                       if getattr(b, "type", None) == "text").strip()
    except Exception:
        log.exception("voice_protocol: R1 pass failed/timed out — deferring to holding line")
        return "", True
    if not text:
        return "", True
    up = text.upper()
    # legacy token OR the new natural-bridge marker → aside, but KEEP the model's natural bridge sentence
    if "[[CHECK]]" in up or "<ASIDE>" in up:
        bridge = text.replace("[[CHECK]]", "").replace("[[check]]", "")
        for tok in ("<ASIDE>", "<aside>", "<Aside>"):
            bridge = bridge.replace(tok, "")
        bridge = bridge.strip()
        return bridge, True   # bridge != "" → the caller speaks it (no dead air); still schedules the check
    return text, False


# ── the money gate on the SPOKEN sentence — block-then-speak (SPEC §5) ────────────────────────
def _gate_spoken(sentence: str, session_ctx: dict, keyed: list[str]) -> tuple[bool, str]:
    """Pass the candidate spoken sentence through gate.check_outbound SYNCHRONOUSLY. Returns
    (ok, reason). If a standing price is known for a keyed price the turn touched, we hand it to the
    gate so an off-book quote is caught as a delta. On a call there's no mid-call review sheet the human
    sees, so a blocked money sentence is NOT spoken — the caller replaces it with a safe deferral."""
    standing: Optional[float] = None
    prices = session_ctx.get("standing_prices") or {}
    for k in keyed:
        if str(k).startswith("price:") and k in prices:
            try:
                standing = float(prices[k])
            except (TypeError, ValueError):
                standing = None
            break
    try:
        verdict = gate.check_outbound(sentence, standing_price=standing)
    except Exception:
        log.exception("voice_protocol: gate.check_outbound raised — treating as PARK (fail-closed on money)")
        return False, "gate_error_failclosed"
    return bool(verdict.get("ok")), str(verdict.get("reason") or "")


# (the check-aside EXECUTOR lives on the fabric now: voice_fabric.aside_resolve — one envelope.)

async def _pending_rejoin(con, scope: str, session_ctx: Optional[dict] = None) -> str:
    """If a prior check-aside has RESOLVED but not yet been spoken, return the rejoin sentence
    ('ya lo tengo: …') and mark it delivered — so the next voice turn naturally circles back (SPEC §7
    REJOIN). Empty string if nothing is waiting.

    THE MONEY FLOOR APPLIES HERE TOO (review C2, 2026-07-22): _resolve_aside reasons over the FULL fold
    (card + recall include COMMERCIAL prices), so a resolved answer can carry a euro figure even when the
    original utterance classified non-money. Every rejoin answer passes _gate_spoken block-then-speak —
    a blocked answer is replaced with the safe deferral, never voiced. This is the ONE live rejoin path
    (the standalone rejoin() is not called on the EL bridge), so gating here closes the gap."""
    try:
        row = await con.fetchrow(
            "select e.id, e.payload from event e where e.scope=$1::ltree and e.type='aside.resolved' "
            "and not exists (select 1 from event d where d.scope=e.scope and d.type='aside.delivered' "
            "  and (d.payload->>'resolved_event_id')::bigint = e.id) "
            "order by e.id desc limit 1", scope)
        fab = None
        if not row:
            # THE FABRIC MOUTH (§9.1): undelivered process.completed `say` results ride the SAME gated
            # rejoin — the one background→speech path in the repo.
            import voice_fabric as _vf
            pend = await _vf.pending_say(con, scope)
            if not pend:
                return ""
            fab = pend[0]
            p, ans = {"action_id": None}, fab["say"]
        else:
            p = row["payload"] or {}
            if isinstance(p, str):
                p = json.loads(p)
            ans = (p.get("answer") or "").strip()
        if not ans:
            return ""
        # GATE the resolved answer before it reaches the mouth — block-then-speak, FAIL-CLOSED on money:
        # the aside executor reasons over the FULL fold (card + recall carry COMMERCIAL prices), so the
        # answer can quote a figure. check_outbound only parks a bare price when standing prices are
        # KNOWN to differ — so a price with NO standing context must ALSO park (unverifiable money is
        # never voiced; over-deferring is safe, voicing bad money is not — the vital_incall C2 case).
        try:
            standing = [v for v in ((session_ctx or {}).get("standing_prices") or {}).values() if v is not None]
            if not standing:
                standing = await gate.standing_prices(con, scope)
            verdict = gate.check_outbound(ans, standing_price=standing)
            gated, reason = (not verdict.get("ok")), str(verdict.get("reason") or "")
            if not gated and not standing and gate.extract_prices(ans.lower()):
                gated, reason = True, "price quoted with no standing context (fail-closed)"
        except Exception:
            log.exception("voice_protocol: rejoin gate raised — PARK (fail-closed on money)")
            gated, reason = True, "gate_error_failclosed"
        if gated:
            log.info("voice_protocol: rejoin GATED (%s) for %s — safe deferral spoken", reason, scope)
            ans = "casi lo tengo cerrado — el dato exacto te lo confirmo y te lo paso, que en números no me la juego"
        # mark delivered by appending the delivery marker (append-only spine — never mutate a past row).
        if fab is not None:
            import voice_fabric as _vf
            await _vf.mark_delivered(con, scope, fab["event_id"], gated)
        else:
            await spine.append_event(con, scope, "aside.delivered", "voice",
                                     {"resolved_event_id": row["id"], "action_id": p.get("action_id"),
                                      "gated": gated}, lane="reasoning")
        return "Ya lo tengo: " + ans + " "
    except Exception:
        log.debug("pending_rejoin fail-soft", exc_info=True)
        return ""


async def _open_aside(con, scope: str, utterance: str, keyed: list[str], session_ctx: dict,
                      money: bool, opened_by_event: Optional[int]) -> int:
    """Park the slow work as an action(kind='voice.aside', needs_human=<money>) and append a voice.aside
    event, so the worker / the bridge's aside executor can do the real thing (Medusa place, email,
    external confirm, human hand-off) and later rejoin(). Returns the action id (the aside handle the
    bridge correlates a rejoin against). Records the aside on session_ctx.open_asides. Fail-soft: a
    scheduling failure still returns a handle-less 0 so the caller can at least speak the holding line."""
    payload = {
        "call_id": session_ctx.get("call_id"),
        "utterance": utterance,
        "keyed_reads": keyed,
        "lang": session_ctx.get("lang", "es"),
    }
    reason = "voice check-aside (money)" if money else "voice check-aside"
    try:
        aid = await con.fetchval(
            "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event) "
            "values($1::ltree,'voice.aside',$2,'pending',$3,$4,$5,$6) returning id",
            scope, payload, reason, bool(money), bool(money), opened_by_event)
        aid = int(aid)
    except Exception:
        log.exception("voice_protocol: could not park voice.aside action (fail-soft handle-less)")
        aid = 0
    try:
        await spine.append_event(
            con, scope, "voice.aside", "voice",
            {"action_id": aid, "utterance": utterance, "keyed_reads": keyed, "money": bool(money),
             "call_id": session_ctx.get("call_id")},
            lane="reasoning", caused_by=opened_by_event, actor="rocoto")
    except Exception:
        log.exception("voice_protocol: voice.aside event append failed (non-fatal)")
    # bookkeeping the bridge reads to correlate the rejoin.
    asides = session_ctx.setdefault("open_asides", {})
    asides[aid] = {"utterance": utterance, "keyed_reads": keyed, "opened_at": time.time()}
    # EXECUTE the aside off the latency path — resolve it in the background so the next utterance rejoins.
    if not money:  # money asides wait for the gate/human — never auto-answered
        import voice_fabric as _vf
        _vf.fire_named("aside_resolve", scope, utterance, session_ctx, aid=aid)
    return aid


# ── the per-utterance entry point the ElevenLabs bridge calls per ASR-final ────────────────────
async def in_call_turn(scope: str, utterance: str, session_ctx: dict) -> dict[str, Any]:
    """Reason about ONE live-call utterance (SPEC §7 LATENCY PROTOCOL). Called by the ElevenLabs bridge
    per ASR-final. Returns:
        { "reply": str,            # what Rocoto should SAY right now (already gated)
          "deferred": bool,        # True → this was a CHECK-ASIDE; a rejoin() will follow when it lands
          "keyed_reads": [str],    # the exact keys we hit synchronously this turn (for the why-trace)
          "aside_id": int|None }   # the aside handle to correlate a rejoin (present iff deferred)

    Flow (all inside a single scoped_tx so the utterance event + keyed reads share one snapshot):
      · append the utterance as an event (spine.append_event type 'utterance', lane 'world').
      · pick the exact keys this utterance needs → run them SYNCHRONOUSLY (ms-scale, money-never-stale).
      · one Haiku pass classifies INLINE vs ASIDE and, if inline, writes the spoken reply.
      · money content is gated block-then-speak; a blocked money sentence becomes a safe deferral.
      · anything not answerable inline (or a heavy intent) → CHECK-ASIDE: park the work, speak a holding
        line, deferred=True.

    Fail-soft throughout: a live call must never crash on reasoning — the floor is a graceful deferral."""
    utterance = (utterance or "").strip()
    lang = session_ctx.get("lang", "es")
    keyed_keys = _keys_for_utterance(utterance, session_ctx)
    heavy = bool(_ASIDE_HINTS.search(utterance))

    if not utterance:
        return {"reply": "", "deferred": False, "keyed_reads": [], "aside_id": None}

    try:
        async with __import__("db").scoped_tx(scope) as con:
            # 1) the utterance is a first-class world event (SPEC §3: append-only spine).
            try:
                eid, _ = await spine.append_event(
                    con, scope, "utterance", "voice",
                    {"text": utterance, "call_id": session_ctx.get("call_id")},
                    lane="world", actor="human")
            except Exception:
                log.exception("voice_protocol: utterance append failed (non-fatal)")
                eid = None

            # REJOIN (SPEC §7): did a prior "déjame comprobar" land? If so, circle back with the answer
            # first, then handle whatever they just said.
            rejoin = await _pending_rejoin(con, scope, session_ctx)

            # 2) INLINE keyed reads — synchronous, exact, current (money never stale).
            keyed = await _run_keyed_reads(con, scope, keyed_keys)
            money = _has_money(utterance, keyed_keys)

            # LIFECYCLE (hard switch, Peter 2026-07-22, after the live-demo freeze): a caller with NO
            # catalogue must never aside into a void. PINNED at ring-time (review H3 — two DB round-trips
            # per utterance otherwise); computed here only when the caller didn't pin it (direct callers,
            # vitals) so the hard switch never silently disappears.
            if session_ctx.get("lifecycle"):
                _lc = session_ctx["lifecycle"]
                _lc_notes = session_ctx.get("lc_notes", "")
            else:
                try:
                    import lifecycle as _lifecycle
                    _lc = await _lifecycle.status(scope, session_ctx.get("tier") or "prospect")
                    _lc_notes = _lifecycle.notes(_lc)
                except Exception:
                    _lc, _lc_notes = {"has_catalogue": True}, ""

            # the DECISION TRACE (review H4) — attached to every return; app.py folds it into
            # ops.voice_turn so any bad call is explainable from one event.
            trace: dict[str, Any] = {"rejoin_fired": bool(rejoin), "heavy_intent": heavy,
                                     "money": money, "keyed_reads": keyed_keys,
                                     "recall_used": bool(session_ctx.get("recall")),
                                     "deferred": False, "gate_verdict": "clean",
                                     "guard_repeat_tripped": False}

            # 3) a heavy intent skips the model entirely — BUT only if there is a catalogue to check
            # against; a no-catalogue heavy intent would aside into a void, so it goes to the inline pass.
            if heavy and _lc.get("has_catalogue"):
                aid = await _open_aside(con, scope, utterance, keyed_keys, session_ctx, money, eid)
                holding = (rejoin + (_HOLDING_MONEY if money else _HOLDING_LINE)).strip()
                trace["deferred"] = True
                return {"reply": holding, "deferred": True, "keyed_reads": keyed_keys, "aside_id": aid,
                        "trace": trace}

            # 4) the ONE Haiku pass: classify INLINE-vs-ASIDE and (if inline) produce the spoken reply.
            # THE FABRIC (§9.1/WP-3): fire every process whose trigger matches — order-brain drafts,
            # recall refreshes — in the BACKGROUND; the reflex covers with the stall derived from the
            # slowest fired process (§4: functional non-verbals — the hum happens BECAUSE work runs).
            try:
                import voice_fabric as _vf
                _fired = _vf.fire_triggers(scope, utterance, {"lifecycle": _lc, **session_ctx})
                _stall = _vf.stall_hint(_fired)
                trace["fabric_fired"] = _fired
            except Exception:
                _fired, _stall = [], ""

            # §15 AHORA MISMO — computed LIVE per turn (two indexed reads on the open tx), never pinned:
            # a WhatsApp text that landed seconds ago must reach THIS turn, not the next refresh.
            try:
                import presence_call as _presence
                ahora_live = await _presence.ahora_block(con, scope, channel="voice")
            except Exception:
                ahora_live = session_ctx.get("ahora", "")
            # THE §4.1.1 COMPONENTS — pinned at ring time (app._build_voice_pin), rendered here against
            # the SAME registry the chat fold uses. A component computed only when the caller did not
            # pin it (direct callers, vitals) so the checklist can never silently shrink on a mouth.
            _lcb = session_ctx.get("lifecycle_block", "")
            if not _lcb and _lc:
                try:
                    import lifecycle as _lf
                    _lcb = (f"fase={_lc.get('stage')} · relación={_lc.get('tier')} "
                            "(derivado, comprobado — no supuesto)\n"
                            + _lf.checkbox_block(_lc.get("boxes") or {}))
                except Exception:
                    _lcb = ""
            grounding = _grounding_block(session_ctx.get("card", ""), keyed, session_ctx.get("tabs") or [],
                                         recall=session_ctx.get("recall"), window=session_ctx.get("window", ""),
                                         recall_inflight=bool(session_ctx.get("recall_inflight")),
                                         ahora=ahora_live, directory=session_ctx.get("directory", ""),
                                         frame=session_ctx.get("frame", ""), lifecycle_block=_lcb,
                                         standing=session_ctx.get("standing", ""),
                                         supplier=session_ctx.get("supplier_card", ""),
                                         order_state=session_ctx.get("order_state", ""),
                                         message=utterance)
            # PERSONA + STAGE BRIEF ride the SYSTEM slot (2026-07-25 slot fix): the call is the SAME
            # employee as WhatsApp — identity (voice_persona) and the per-stage JOB BRIEF
            # (lifecycle.notes) reach the model as SYSTEM bytes, exactly like the chat mouth (one brief,
            # two mouths, identical bytes). Only per-call DATA (call origin, stall) stays in the fold.
            persona = (session_ctx.get("persona") or "").strip()
            sys_extra = "\n\n".join(
                p for p in (("QUIÉN ERES Y CON QUIÉN HABLAS:\n" + persona) if persona else "",
                            _lc_notes) if p)
            prefix = []
            cc = (session_ctx.get("call_context") or "").strip()
            if cc:
                prefix.append("ESTA LLAMADA (contexto):\n" + cc)
            if _stall:
                prefix.append(_stall)
            if prefix:
                grounding = "\n\n".join(prefix) + ("\n\n" + grounding if grounding else "")
            reply, wants_aside = await _r1_classify_reply(scope, utterance, grounding, lang,
                                                          system_extra=sys_extra)

            # STRUCTURAL SAFETY NET (no aside-into-a-void): with NO catalogue there is nothing an aside
            # could resolve against — the call would freeze on dead air (it did, live, 2026-07-22). WHAT
            # to say at this stage is the JOB BRIEF's job (lifecycle.notes, in the R1 system slot above);
            # the runtime only refuses the void: stay INLINE, keep the model's own words (a [[CHECK]]
            # bridge is still its natural sentence), and when the model produced nothing (fail/timeout)
            # speak the ONE neutral floor line. No stage script lives here — SITUATIONS ARE DATA
            # (2026-07-25: the canned pitch/dodge branches are retired in favour of the briefs).
            if (wants_aside or not reply) and not _lc.get("has_catalogue"):
                wants_aside = False
                if not reply:
                    reply = (rejoin + " " + _NO_MODEL_FLOOR).strip()
            # REPETITION GUARD (the mouth never parrots): an identical consecutive reply becomes a short
            # natural ack instead of the same monologue again. A repeated NO-MODEL floor is the one
            # exception — that's two timeouts in a row (infrastructure), not parroting, and «como te
            # acabo de decir» would be its own little amnesia (it never said anything): alternate the
            # neutral floor variant instead.
            _cs = session_ctx.setdefault("call_state", {})
            if reply and reply == _cs.get("last_reply"):
                if _NO_MODEL_FLOOR in reply:
                    reply = reply.replace(_NO_MODEL_FLOOR, _NO_MODEL_FLOOR_2)
                elif _NO_MODEL_FLOOR_2 in reply:
                    reply = reply.replace(_NO_MODEL_FLOOR_2, _NO_MODEL_FLOOR)
                else:
                    reply = "Sí, eso — como te acabo de decir. ¿Qué más?"
                trace["guard_repeat_tripped"] = True
            _cs["last_reply"] = reply

            if wants_aside or not reply:
                aid = await _open_aside(con, scope, utterance, keyed_keys, session_ctx, money, eid)
                # FLUIDITY (Peter 2026-07-22): speak the model's NATURAL engage-while-working bridge — it
                # keeps the human talking so there is never dead air and the rejoin lands on their reply.
                # Money always uses the safe canned deferral (never voice an ungated money bridge).
                if money:
                    holding = (rejoin + " " + _HOLDING_MONEY).strip()
                else:
                    bridge = reply.strip() if (reply and reply.strip()) else _HOLDING_LINE
                    holding = (rejoin + " " + bridge).strip()
                trace["deferred"] = True
                return {"reply": holding, "deferred": True, "keyed_reads": keyed_keys, "aside_id": aid,
                        "trace": trace}

            # 5) block-then-speak: a money sentence must clear the gate SYNCHRONOUSLY before it's voiced.
            if money:
                ok, reason = _gate_spoken(reply, session_ctx, keyed_keys)
                if not ok:
                    # never voice off-book money on a live call — park it and defer safely.
                    aid = await _open_aside(con, scope, utterance, keyed_keys, session_ctx, True, eid)
                    log.info("voice_protocol: money sentence gated (%s) — deferring", reason)
                    trace["deferred"], trace["gate_verdict"] = True, f"park:{reason}"
                    return {"reply": (rejoin + _HOLDING_MONEY).strip(), "deferred": True,
                            "keyed_reads": keyed_keys, "aside_id": aid, "trace": trace}

            # 6) INLINE answer-first — speak it now (with any rejoin from a resolved check-aside first).
            return {"reply": (rejoin + reply).strip(), "deferred": False, "keyed_reads": keyed_keys,
                    "aside_id": None, "trace": trace}

    except Exception:
        # the ABSOLUTE floor — a broken turn still keeps the human company, never dead air, never a crash.
        log.exception("voice_protocol.in_call_turn failed — safe holding line")
        return {"reply": _SAFE_FALLBACK, "deferred": True, "keyed_reads": keyed_keys, "aside_id": None}


# ── (3) REJOIN — the follow-up sentence when a check-aside lands (SPEC §7) ─────────────────────
async def rejoin(scope: str, session_ctx: dict, answer: str,
                 aside_id: Optional[int] = None, money: Optional[bool] = None) -> dict[str, Any]:
    """Compose the sentence Rocoto says when a CHECK-ASIDE completes ("ya lo tengo — …"). The bridge
    calls this once the parked work returns with `answer` (the resolved value/outcome). We gate the
    rejoin sentence (money still gated block-then-speak), close the aside on session_ctx, and mark the
    action executed. Returns { "reply": str, "gated": bool, "aside_id": aside_id }.

    `money` defaults to the aside's own money flag if known on session_ctx; a money rejoin that fails the
    gate is NOT spoken with the raw value — it collapses to a safe hand-off line (Rocoto still never
    voices off-book money, even on the rejoin)."""
    answer = (answer or "").strip()
    sentence = f"{_REJOIN_PREFIX} {answer}".strip() if answer else _SAFE_FALLBACK

    # resolve the aside's money flag from session_ctx if the caller didn't pass one.
    if money is None and aside_id is not None:
        rec = (session_ctx.get("open_asides") or {}).get(aside_id) or {}
        keyed = rec.get("keyed_reads") or []
        money = _has_money(rec.get("utterance", ""), keyed)
    money = bool(money)

    gated = False
    if money and answer:
        keyed = ((session_ctx.get("open_asides") or {}).get(aside_id) or {}).get("keyed_reads") or []
        ok, reason = _gate_spoken(sentence, session_ctx, keyed)
        if not ok:
            log.info("voice_protocol: rejoin money sentence gated (%s) — safe hand-off", reason)
            sentence = "Ya lo miré; el detalle de dinero prefiero confirmártelo yo directamente para no equivocarme."
            gated = True

    # close the aside on session_ctx + mark the action executed (fail-soft — the spoken rejoin matters most).
    if aside_id is not None:
        try:
            (session_ctx.get("open_asides") or {}).pop(aside_id, None)
        except Exception:
            pass
        try:
            async with __import__("db").scoped_tx(scope) as con:
                await con.execute(
                    "update action set state='executed', resolved_at=now(), "
                    "outcome=$2 where id=$1 and kind='voice.aside'",
                    int(aside_id), {"answer": answer, "gated": gated})
                await spine.append_event(
                    con, scope, "voice.rejoin", "voice",
                    {"action_id": int(aside_id), "answer": answer, "gated": gated,
                     "call_id": session_ctx.get("call_id")},
                    lane="reasoning", actor="rocoto")
        except Exception:
            log.exception("voice_protocol: rejoin bookkeeping failed (non-fatal — reply still stands)")

    return {"reply": sentence, "gated": gated, "aside_id": aside_id}
