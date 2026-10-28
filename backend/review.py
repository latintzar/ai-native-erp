"""review.py — THE REVIEW RULE (SPEC §5.8). The comercial's queue is near-EMPTY by design.

Peter, 2026-07-26 (Mercamadrid): the review queue is not "everything the AI wasn't sure about". THE
CUSTOMER resolves ambiguity, not the distributor — so **exactly three things** put a matter in front
of the human, and this module is the closed set:

    LOW_STOCK  — inventory is ON for this world and there isn't enough. We must HOLD and tell the
                 customer to wait, so a human decides what actually ships. Written by
                 `brain/stock.check_lines` through `brain/pipeline._settle_review`.
    FLAG       — an explicit rule/condition where we have to say "espera, esto lo reviso" before
                 promising anything: money, terms, unusual order shapes. (The money gate's park and
                 sombra's held draft are this source — they are the same sentence: a human must speak.)
                 As of 2026-07-26 it also carries the three order-brain reasons §5.8a named: OUT OF
                 RANGE (`brain/range`), TOO BIG OVERALL (`brain/validators.validate_order`) and the
                 DOUBT verdict (`doubt.py`). They are one source because they are one sentence to the
                 comercial — *a human must decide before we promise* — and a fourth source would be
                 the exact drift this module exists to prevent. WHICH of them fired is the row's
                 `why`, not a new bucket.
    TIMEOUT    — Rocoto asked THE CUSTOMER a closed question (§5.7 disambiguation) and the customer
                 did not answer inside the window (ONE HOUR, per-distributor). ONLY THEN is it the
                 comercial's problem. An ANSWERED question never reaches him at all.

THE WINDOW IS ONE HOUR (Peter, LOCKED 2026-07-26 — SPEC §5.8b). Orders land 05:00–07:00 against a prep
cutoff, so two hours can consume the entire window in which the decision still matters; an hour keeps
the queue near-empty without ever being the reason a van leaves late.

WHY IT IS A MODULE AND NOT A PARAGRAPH: a rule that lives only in prose drifts the first time someone
adds a fourth reason "just for now". Here the set is CLOSED and the door is ONE function — an unknown
source RAISES. `source_of()` runs the same rule over the rows already on the sheet, so the queue can
always answer "why is this in front of me?" in the three words the product promises.

This is a REGISTRY, not a situation module (§16.6): it knows no situation. The timeout is not code
here — it is a TIMER on an open loop, armed by the `question_timeout` manifest_duty ROW
(schema_runtime.sql) and fired by the worker's generic `channel: 'review'` transport. Never a poll.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

log = logging.getLogger("rocoto.review")

# ── THE CLOSED SET ────────────────────────────────────────────────────────────────────────────
LOW_STOCK = "low_stock"
FLAG = "flag"
TIMEOUT = "timeout"
SOURCES: tuple[str, ...] = (LOW_STOCK, FLAG, TIMEOUT)

# es-ES, boss-facing: what the queue says the item is doing there. The comercial reads THIS, not a kind.
WHY: dict[str, str] = {
    LOW_STOCK: "no hay stock suficiente — hay que decirle al cliente que espere",
    FLAG:      "hace falta tu visto bueno antes de prometer nada",
    TIMEOUT:   "el cliente no ha contestado a la pregunta — lo resuelves tú",
}

# The action `kind`s already written by the runtime, mapped onto the rule (the READ side). Everything
# that parks needs_human today is a FLAG — a human must speak before we promise — except the ones the
# writers below tag explicitly. A kind nobody has classified is reported as a FLAG and logged LOUD:
# that is the fourth-reason smell, and it should be visible, not swallowed.
_KIND_SOURCE: dict[str, str] = {
    "draft": FLAG,          # sombra held the sentence (§5.5)
    "place_order": FLAG,    # a money-shaped order parked by the gate (§5)
    "concession": FLAG,
    "duty_open": FLAG,      # a config hole — a human must look
    "review": TIMEOUT,      # written by hold_for_review; the payload's own source wins below
    # ── THE FOUR THAT WERE ON THE SHEET WITHOUT BEING IN THE RULE (found 2026-07-27) ──────────
    # Each of these writes `needs_human=true` and therefore appears in `runtime.review_list`, and
    # none of them was named here. The consequence was not theoretical: `source_of` logged an ERROR
    # for EVERY such row on EVERY read of the queue, and `annotate` fell through to the category
    # line — so the comercial's answer to "why is this in front of me?" was «hace falta tu visto
    # bueno antes de prometer nada» for a WhatsApp that simply never arrived. They are all FLAG:
    # a human must act. None is a shortfall (LOW_STOCK) and none is a silence (TIMEOUT).
    "send_outbound": FLAG,       # worker.py ×3 + brain/golive.py — a message that had to go out, didn't
    "wa_delivery_failed": FLAG,  # app.py ×3 — the mouth may be down (the 63112 outage's own surface)
    "order_review": FLAG,        # learn.py — dirty audio, gated before it could become an order
    "voice.aside": FLAG,         # voice_protocol.py — parked only when the aside touches money
}

# WHAT THE MATTER IS, per kind — es-ES, boss-facing, ONE sentence, used when the writer left no
# sentence of its own on the payload. It sits BETWEEN the writer's words and the category line
# because those are three different amounts of knowledge and the queue should spend the most it has:
#   1. the writer's own `text`     — «no te queda suficiente PALETA COCIDA (quedan 4 kg, te piden 12)»
#   2. the KIND's line, below      — «no he podido mandar un mensaje que tenía que salir»
#   3. the SOURCE's category line  — «hace falta tu visto bueno antes de prometer nada»
# Tier 3 was doing tier 2's job for seven of the eight writers, which is how a delivery failure and a
# price concession ended up reading identically on the sheet.
#
# The action row's `reason` COLUMN is deliberately NOT used as a fallback even though it is often
# populated: it is where machine tags («money_concession», «needs_approval») and engineer English
# («duty 'x' fired but its manifest row has no rungs») live. Showing that to a Spanish comercial is
# not more specific, it is less honest — it looks like a sentence and isn't one.
KIND_WHY: dict[str, str] = {
    "draft":              "lo he dejado escrito sin mandar — lo mandas tú",
    "place_order":        "hay dinero de por medio en este pedido — no lo cierro yo",
    "concession":         "una concesión de precio o condiciones — eso lo decides tú",
    "duty_open":          "un aviso mío no ha podido abrirse: le falta configuración",
    "send_outbound":      "no he podido mandar un mensaje que tenía que salir",
    "wa_delivery_failed": "un WhatsApp no ha llegado a su destino",
    "order_review":       "no me fío de lo que se oye en el audio — confírmalo tú",
    "voice.aside":        "quedé en comprobar algo en una llamada y toca dinero",
}


# ══ THE SECOND AXIS — WHAT THE HUMAN HAS TO DO (Peter, 2026-08-16) ══════════════════════════════
# «There should be two review types: (1) review an order to confirm it's okay, (2) a nudge to do an
# action — reply to a customer. One of them is the customer asked something or complained, and the
# UI would be nudging them to answer now.»
#
# THIS IS NOT A FOURTH SOURCE, and the distinction is the whole reason it is safe. `review_source`
# answers WHY IS THIS IN FRONT OF ME and is closed at three; `review_act` answers WHAT DO I DO ABOUT
# IT and is closed at two. They are orthogonal by construction — a TIMEOUT can need a decision or a
# sentence, and a FLAG raised by «el cliente dice que su pedido no es correcto» plainly needs words.
# Collapsing them into one string is exactly the drift this module's docstring exists to prevent,
# and `why_kind` is already the codebase's own precedent that one row carries more than one axis.
#
# DERIVED HERE, NEVER RESTATED ELSEWHERE. Two branches in this repo already read a `review_source`
# of «doubt», which is not a source at all but a `cause` — dead code in both places, and the exact
# shape BUILD-CONCERNS #25 is about. So the rule lives in one function beside `source_of`.
CONFIRM = "confirm"     # decide about a thing: an order, a filing, a price
ANSWER = "answer"       # a person is waiting on words from you
ACTS: tuple[str, ...] = (CONFIRM, ANSWER)

# es-ES, boss-facing: what the queue asks of him. Read next to `why`, never instead of it.
ACT_CALL: dict[str, str] = {
    CONFIRM: "revisar el pedido",
    ANSWER:  "contestar al cliente",
}

# The action `kind`s mapped onto the two verbs. Same keys as _KIND_SOURCE, deliberately — a kind
# that gains a source and not an act is a kind somebody half-added.
_KIND_ACT: dict[str, str] = {
    "draft":              ANSWER,   # sombra held a SENTENCE: the whole artefact is words to send
    "place_order":        CONFIRM,
    "concession":         CONFIRM,
    "duty_open":          CONFIRM,  # a config hole — nobody is waiting on a reply
    "review":             CONFIRM,  # the payload's own act wins below when the writer set one
    "send_outbound":      ANSWER,   # a message that had to go out, didn't — it still has to
    "wa_delivery_failed": ANSWER,
    "order_review":       CONFIRM,
    "voice.aside":        CONFIRM,
}

# The writers' own machine tags. `cause` already exists «so a surface can filter without parsing
# Spanish» (brain/pipeline), so this reads the writer's stamp rather than inventing a second one.
_CAUSE_ACT: dict[str, str] = {
    "customer_said_incorrect": ANSWER,   # they tapped «No es correcto» — they are owed a reply
    "scope_orders":            ANSWER,   # §17.46 parked a non-order message for a human to answer
    "price_question":          ANSWER,
    "complaint":               ANSWER,
}


def is_source(s: Any) -> bool:
    return isinstance(s, str) and s in SOURCES


def is_act(a: Any) -> bool:
    return isinstance(a, str) and a in ACTS


def act_of(kind: str, payload: Any = None, source: str = "") -> str:
    """WHAT does this row want from the human — one of exactly two answers.

    Most-knowledge-first, the same three-tier shape `annotate` already uses for `why`:
      ① the writer said so (`payload.review_act`) — it had the most context;
      ② the writer's machine tag (`payload.cause`) — already designed to be filtered on;
      ③ a TIMEOUT is by definition a customer left hanging, so it is ANSWER;
      ④ the action `kind`.

    CONFIRM is the default for the same reason FLAG is `source_of`'s: getting it wrong that way
    still shows the boss the writer's true `why`, whereas mislabelling a config hole as «contesta al
    cliente» pushes him into a composer with nobody on the other end. It does NOT log an error —
    `source_of` has already screamed about an unmapped kind on this same row."""
    if isinstance(payload, dict):
        a = payload.get("review_act")
        if is_act(a):
            return str(a)
        c = str(payload.get("cause") or "").strip()
        if c in _CAUSE_ACT:
            return _CAUSE_ACT[c]
    if source == TIMEOUT:
        return ANSWER
    return _KIND_ACT.get((kind or "").strip(), CONFIRM)


def source_of(kind: str, payload: Any = None) -> str:
    """WHY is this row in front of the human — one of exactly three answers.

    An explicit `review_source` on the payload wins (the writer knew); otherwise the action `kind`
    decides. Anything unmapped answers FLAG (the safe answer: a human looks) at log level ERROR, so a
    smuggled fourth reason shows up in the log instead of quietly widening the rule."""
    if isinstance(payload, dict):
        s = payload.get("review_source")
        if is_source(s):
            return str(s)
    k = (kind or "").strip()
    if k in _KIND_SOURCE:
        return _KIND_SOURCE[k]
    log.error("review: action kind %r is not in the three-source rule — reporting it as %r. "
              "Either tag its write with a review_source or it does not belong on the sheet.", k, FLAG)
    return FLAG


def annotate(item: dict) -> dict:
    """Add `review_source` + `why` (+ `why_kind`) to one review-sheet row (runtime.review_list / CR).

    `why` IS THE ONE REASON (§5.8a tone law: the comercial needs to know what to decide, not
    everything the system noticed) — and THE WRITER'S OWN SENTENCE WINS. Every park through the door
    below puts it on the payload as `text`: «no te queda suficiente PALETA COCIDA (quedan 4 kg, te
    piden 12)», «fuera de tu radio de reparto: ~34 km». Only the module that found the fact can name
    it in a sentence a human can act on, and re-wording it here would be a second voice saying the
    same thing worse.

    THREE TIERS, most-knowledge-first (see KIND_WHY): the writer's own `text`, then the KIND's own
    es-ES line, then the SOURCE's category line. Tier 3 used to catch everything that wasn't a
    `hold_for_review` park — a failed WhatsApp, a held draft and a price concession all read as
    «hace falta tu visto bueno antes de prometer nada», which answers the question with the name of
    the drawer instead of what is in it. It is now genuinely the last resort: a kind nobody has
    classified, which is also the case that logs LOUD.

    `why_kind` carries that category on every row regardless, because grouping a queue and explaining
    a row are different jobs and one string cannot do both: the surface groups by `why_kind`, the
    comercial reads `why`.
    """
    payload = item.get("payload")
    if isinstance(payload, str):            # a pool without the jsonb decoder — never assume shape
        try:
            payload = json.loads(payload or "{}")
        except ValueError:
            payload = {}
    kind = (item.get("kind") or "").strip()
    src = source_of(kind, payload)
    kind_why = WHY.get(src, WHY[FLAG])
    text = str((payload or {}).get("text") or "").strip() if isinstance(payload, dict) else ""
    act = act_of(kind, payload, src)
    return {**item, "review_source": src, "review_act": act, "act_call": ACT_CALL[act],
            "why": (text or KIND_WHY.get(kind) or kind_why), "why_kind": kind_why}


# ── THE ONE DOOR ──────────────────────────────────────────────────────────────────────────────
async def hold_for_review(scope: str, source: str, *, text: str = "", act: str = "",
                          detail: Optional[dict] = None, con=None,
                          money: bool = False, opened_by_event: Optional[int] = None) -> dict[str, Any]:
    """Put ONE matter in front of the human — the only way anything reaches the comercial's queue.

    Writes onto the SAME review sheet as every other park (`action`, needs_human, `runtime.review_list`)
    plus a reasoning-lane `review.held` event, so nothing new becomes a system of record and the
    standing `review_nudge` duty already chases it. `source` MUST be one of SOURCES — an unknown one
    RAISES, because a queue that can grow a fourth reason is the defect this rule exists to prevent.

    Fail-soft on the WRITE (a live turn is never taken down), never on the RULE."""
    if not is_source(source):
        raise ValueError(f"review.hold_for_review: {source!r} is not one of {SOURCES} "
                         "— the review rule is a closed set (SPEC §5.8)")
    if act and not is_act(act):
        raise ValueError(f"review.hold_for_review: act={act!r} is not one of {ACTS}")
    import db
    import spine
    # `act` rides the payload beside `review_source` so `act_of` reads the writer's own answer as its
    # first tier. Omitting it is correct and normal — the derivation handles every existing caller,
    # which is why this landed without touching one of them.
    payload = {"review_source": source, "text": (text or "")[:2000],
               **({"review_act": act} if act else {}), **(detail or {})}
    out: dict[str, Any] = {"ok": False, "review_source": source, "action_id": None}
    own = con is None
    cm = None
    try:
        if own:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        eid, _ = await spine.append_event(con, scope, "review.held", "review", payload,
                                         caused_by=opened_by_event, lane="reasoning")
        out["action_id"] = int(await con.fetchval(
            "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event) "
            "values($1::ltree,'review',$2,'pending',$3,true,$4,$5) returning id",
            scope, payload, WHY.get(source, WHY[FLAG]), bool(money), eid))
        out["ok"] = True
        log.info("REVIEW: %s parked on %s (action %s)", source, scope, out["action_id"])
    except Exception:
        log.exception("review.hold_for_review: could not park %s on %s", source, scope)
    finally:
        if own and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass
    return out


# ── THE TONE LAW — ACKNOWLEDGED, NEVER CONFIRMED (§5.8a) ──────────────────────────────────────
# «recibido — déjame que lo confirme y te digo enseguida». Until the comercial decides, that is the
# whole of what the customer has been told. No «listo», no «apuntado», no «confirmado».
#
# WHY THIS IS A FOLD NOTE AND NOT A TEMPLATE: the acknowledgement sentence is THE MIND'S — it is
# written fresh, in character, on the conversational rail, and the product would be worse if it were
# a canned line. So the law cannot be enforced by owning the sentence; it is enforced by making sure
# the mind KNOWS the fact before it writes one. Same shape as `doubt.doubt_note` and
# `confidence.perception_note`: a hard datum injected BEFORE reasoning, EMPTY when there is nothing
# held, so an ordinary turn carries no prompt noise at all.
#
# It is deliberately COUNT-FREE and REASON-FREE. The comercial's reason is his; telling the customer
# «tu pedido está parado porque no hay stock» would hand him our internal state and, worse, would
# promise a diagnosis nobody has confirmed. The mind is told THAT something is waiting on a human,
# never WHAT.
_HOLD_NOTE = (
    "⚠️ ESTADO (pre-razonamiento, dato duro): este cliente tiene algo pendiente de que lo mire el "
    "comercial. Puedes ACUSAR RECIBO con naturalidad («recibido — déjame que lo confirme y te digo "
    "enseguida»), pero NO puedes darlo por hecho: nada de «listo», «apuntado», «anotado», "
    "«confirmado» ni fechas ni precios cerrados. No le cuentes por qué está pendiente — eso es "
    "nuestro. Si te pregunta, dile la verdad: lo está confirmando el comercial y le dices enseguida.")


async def hold_note(scope: str, con=None) -> str:
    """The §5.8a tone-law note for THIS party's fold, or "" when nothing of theirs is held.

    Reads the same review sheet everything else reads (`action`, pending + needs_human) on the
    party's own scope — the state is already there, so this invents no second system of record and
    cannot drift from the queue the comercial is actually looking at.

    Fail-soft to "" (a live turn is never taken down by the queue). The cost of the failure mode is
    understood and accepted: on an unreadable sheet the mind loses the fact, not the turn — and the
    park itself, the nudge and the queue are all unaffected."""
    import db
    own = con is None
    cm = None
    try:
        if own:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        held = await con.fetchval(
            "select 1 from action where scope=$1::ltree and state='pending' "
            "and needs_human=true limit 1", scope)
        return _HOLD_NOTE if held else ""
    except Exception:
        log.debug("review.hold_note fail-soft on %s", scope, exc_info=True)
        return ""
    finally:
        if own and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


# ══ §5.8a's OTHER HALF — A CLAIM WITH NOTHING FILED (2026-08-10) ═══════════════════════════════
# `_HOLD_NOTE` above is the tone law for a turn that ALREADY filed. This is the opposite failure and
# a far worse one, measured on the real runtime on 2026-08-10:
#
#   customer: «¿para cuándo me podéis traer un pedido grande esta semana?»   → Rocoto asks what.
#   customer: «ponme 2 kg de chorizo ibérico dulce y 3 kg de panceta ibérica curada»
#   Rocoto:   «Perfecto, apuntado. Te confirmo: — 2 kg… — 3 kg… ¿Para cuándo lo necesitas?»
#   events:   message, reasoning, msg.sent.  NO order.drafted. take_order was never called.
#
# The customer has been told, in Rocoto's own voice, that their order is in. The supplier's Pedidos
# is empty. Nobody knows. That is the precise failure this product exists to eliminate, and the next
# order-bearing message compounds it — turn 3 narrated a three-line order that existed only in the
# model's conversational memory.
#
# THE TEST IS A CONTRADICTION, NOT A STYLE CHECK. «Lo apunto» meaning "I'll make a note of that" is a
# normal thing for an employee to say, so a bare word match would fire on healthy turns. Three
# conditions must hold TOGETHER:
#   ① the sentence says the thing IS recorded — a perfective claim, not an intention;
#   ② the turn is order-SHAPED — quantities of products, read by the ONE order-line reader
#     (`orders_tool.mentions_products`), on the reply itself or on what the customer just said;
#   ③ the turn recorded NOTHING — no take_order, and no other recording verb either, because a turn
#     that called `remember` / `open_tab` / `teach_rule` genuinely did note something and «anotado»
#     about it is TRUE.
# Pure, so it is testable without a model, a database or a network.
_CLAIM_RE = re.compile(
    r"\b("
    r"apuntad[oa]s?|anotad[oa]s?|a[ñn]adid[oa]s?|agregad[oa]s?|registrad[oa]s?|"
    r"tramitad[oa]s?|cursad[oa]s?|confirmad[oa]s?|"
    r"(?:ya\s+est[áa]|queda|quedan|dejo|tengo)\s+(?:todo\s+)?list[oa]s?|"
    r"noted|recorded|logged|booked|added|all\s+set|got\s+it\s+down"
    r")\b",
    re.IGNORECASE)

# The verbs that MAKE a record. `take_order` is the only one that files an ORDER; the rest genuinely
# write something down, which is what makes «anotado» honest on their turns.
FILING_ACTION = "take_order"
_NOTE_ACTIONS = ("remember", "open_tab", "update_tab", "resolve_tab", "teach_rule",
                 "draft_tracker", "create_tracker", "set_delivery_window", "escalate", "send_email")


def claims_recorded(text: str) -> bool:
    """① Does this sentence claim something IS recorded (rather than that it will be)? PURE."""
    return bool(_CLAIM_RE.search(text or ""))


def claims_filing_without_one(text: str, actions: Any = None, *, inbound: str = "") -> bool:
    """TRUE when the reply claims an order was recorded and this turn recorded nothing (①∧②∧③).

    `actions` is the mind's `[{verb: detail}, …]`. PURE and fail-soft: anything it cannot read is
    read as "no contradiction", because a false alarm costs a customer a re-worded sentence and a
    missed one costs them their order — but a crash here would cost the whole turn."""
    try:
        if not claims_recorded(text):
            return False
        acts = set()
        for a in actions or []:
            if isinstance(a, dict):
                acts.update(str(k) for k in a.keys())
        if FILING_ACTION in acts or acts.intersection(_NOTE_ACTIONS):
            return False
        import orders_tool
        return orders_tool.mentions_products(text) or orders_tool.mentions_products(inbound)
    except Exception:
        log.debug("review.claims_filing_without_one fail-soft", exc_info=True)
        return False


# What the mind is told the instant the contradiction is caught, IN THE SAME TURN, with its hands
# still on the table. It is deliberately TWO DOORS and not an order to file: the check reads shape,
# not meaning, so «lo tengo apuntado, lo miro» about a complaint that happens to name 3 kg of
# chorizo must be able to resolve by rewriting the sentence — forcing a filing there would invent an
# order nobody placed, which is the same lie in the other direction.
CONTRADICTION_NOTE = (
    "⚠️ ALTO (dato duro del sistema, no es el cliente quien te escribe esto): acabas de decirle que "
    "queda apuntado/anotado/añadido/confirmado, y NO has usado take_order en este turno. Ahora mismo "
    "no hay NADA registrado: el jefe no lo ve y ese pedido se pierde. Arréglalo ya, de una de estas "
    "dos formas y solo una: (1) si es un pedido suyo, llama a take_order con las líneas exactas que "
    "te ha dicho — aunque falte la fecha o cualquier otro dato — y después contéstale; (2) si no es "
    "un pedido, reescribe tu respuesta sin decir que has apuntado, anotado ni confirmado nada. "
    "Contesta solo con lo que le dirías al cliente.")

# The last resort, when the sentence STILL claims a filing that did not happen. Same shape as the
# money gate's park: the sentence is REPLACED, not softened, because at that point it is a provable
# lie to a customer. It is the §5.8a acknowledgement, which is the true thing to say.
ACK_ES = "Recibido — déjame que lo confirme y te digo enseguida."
ACK_EN = "Got it — let me confirm it and I'll come straight back to you."


def honest_ack(lang: str = "es") -> str:
    """The §5.8a acknowledgement in the turn's language. It states arrival and promises nothing."""
    return ACK_EN if str(lang or "").lower().startswith("en") else ACK_ES


# ── SOURCE 3'S TWO SENSES — the clock on an unanswered question ───────────────────────────────
# Neither of these knows what the timeout DOES. They append a sense and hand it to the generic binder;
# the whole behaviour (the ONE-HOUR window, the tab, the park) is the `question_timeout` manifest_duty
# ROW (schema_runtime.sql), per §16.6 — which is why moving the window to 1h was an edit to that row's
# `after` and to this prose, and to no constant anywhere. A distributor's own window is a NEARER row,
# not a branch here.
ASKED = "question.asked"
ANSWERED = "question.answered"


async def on_question_asked(scope: str, question: str, ask_key: str, *, tier: str = "",
                            con=None) -> dict:
    """Rocoto just asked a CUSTOMER a closed question. Opens the tab + arms its clock (via the row).

    The `tier` rides the payload so the ROW decides who this applies to (`opens_on.when.tier`) — a
    question to the boss is a conversation, not a queue item, and that distinction stays in data."""
    return await _sense(scope, ASKED,
                        {"ask_key": ask_key or "", "question": (question or "")[:300],
                         "tier": tier or "", "cutoff_iso": (await prep_cutoff_iso()) or ""},
                        con=con)


async def on_answer(scope: str, *, con=None) -> dict:
    """The party wrote back. Whatever they said, the SILENCE is over — the open question tab resolves
    and its armed timer is cancelled in the same commit, so an answered question can never reach the
    comercial. (The tab measures silence, not correctness: if the reply doesn't actually answer, the
    mind re-asks and a fresh tab + fresh clock open on that turn.)

    Emits NOTHING when no question is open — this runs on every inbound turn, and a `question.answered`
    on a party who was never asked anything is a lie in the world lane and noise in the fold window."""
    import db
    try:
        async with db.scoped_tx(scope) as c0:
            open_tab = await c0.fetchval(
                "select 1 from open_loop where scope=$1::ltree and kind='question' "
                "and status='open' limit 1", scope)
        if not open_tab:
            return {"ok": True, "noop": True}
    except Exception:
        log.debug("review.on_answer: open-tab probe fail-soft on %s", scope, exc_info=True)
        return {"ok": False}
    return await _sense(scope, ANSWERED, {}, con=con)


async def retire_answered_parks(scope: str) -> dict:
    """The customer wrote back, so a row that exists BECAUSE THEY DIDN'T is no longer true.

    Peter, 2026-08-16: «if something was left for review and then they clarified that topic just in
    the chat instead of doing it in the review UI, that should already wipe out the review thing.»

    WHAT RETIRES, AND WHY ONLY THIS. A `timeout` park exists because of silence and nothing else —
    §5.8's own words: «Rocoto asked THE CUSTOMER a closed question and the customer did not answer
    inside the window. ONLY THEN is it the comercial's problem.» Any real inbound from that party
    falsifies the row's whole premise, so no key and no matching are needed: the SOURCE is the
    retirement condition. That evidence standard is already this codebase's law one step earlier —
    `duties._resolve` defends `by: "kind"` with «ONE reply from the customer ends the SILENCE,
    whichever question it answers». This applies the same rule to the park that silence produced.

    WHAT NEVER RETIRES, stated so nobody widens it later: `low_stock` (a clarification puts nothing
    on the shelf), every `flag` (a human still holds a decision about money, range, order size or a
    catalogue gap — «plátanos» is ours to fill and the customer's next sentence does not fill it),
    and every non-`review` kind, which is somebody else's unfinished business entirely.

    RETIREMENT IS NOT APPROVAL, and this is the trap worth naming. The function already sitting
    there is `runtime.resolve_action`, and routing through it would arm an `approval` wake — making
    a CUSTOMER'S MESSAGE cause the mind to execute a concession. A retired row asks for nothing and
    does nothing: `needs_human` goes false, which retires it from all six readers at once because
    they share one predicate, and `state` stays `pending` so nobody can read it as a decision that
    was taken. The outcome records who retired it and why."""
    import json as _json

    import db
    out = {"ok": False, "retired": 0}
    try:
        async with db.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select id, payload from action where scope=$1::ltree and kind='review' "
                "and state='pending' and needs_human=true", scope)
            ids = []
            for r in rows:
                p = r["payload"]
                if isinstance(p, str):
                    try:
                        p = _json.loads(p or "{}")
                    except ValueError:
                        p = {}
                if source_of("review", p) == TIMEOUT:
                    ids.append(int(r["id"]))
            for aid in ids:
                await con.execute(
                    "update action set needs_human=false, resolved_at=now(), "
                    "outcome = coalesce(outcome,'{}'::jsonb) || $2::jsonb "
                    "where id=$1 and state='pending' and needs_human=true",
                    aid, _json.dumps({"retired_by": "customer_replied",
                                      "retired_at": "now", "note": ANSWERED}))
            out = {"ok": True, "retired": len(ids), "ids": ids}
            if ids:
                log.info("REVIEW: retired %d timeout park(s) on %s — the customer wrote back",
                         len(ids), scope)
    except Exception:
        log.exception("review.retire_answered_parks fail-soft on %s", scope)
    return out


async def _sense(scope: str, event_type: str, payload: dict, *, con=None) -> dict:
    """Append the sense on `scope` and let the GENERIC binder react. Fail-soft — a live turn is never
    taken down by the review clock."""
    import db
    import duties
    import spine
    own = con is None
    cm = None
    try:
        if own:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        eid, is_new = await spine.append_event(con, scope, event_type, "review", payload, lane="world")
        if not is_new:
            return {"ok": True, "dedup": True}
        res = await duties.react_to_sense(con, scope, event_type, payload, opened_by_event=eid)
        return {"ok": True, "event_id": int(eid), **res}
    except Exception:
        log.exception("review._sense(%s) failed (fail-soft) on %s", event_type, scope)
        return {"ok": False}
    finally:
        if own and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


# ── THE PREP CUTOFF — the second hand on the timeout ──────────────────────────────────────────
async def prep_cutoff_iso() -> Optional[str]:
    """Today's dispatch/prep cutoff as an ISO instant, or None when it has already passed / is unset.

    The timeout window is ONE HOUR, but the PREP CUTOFF also forces it (Peter): a question asked at
    05:00 against a 05:40 cutoff cannot have until 06:00 to reach the human — by then the order sheet
    has already gone out and the answer is worth nothing. Rides the `question.asked` payload as the
    rung's `not_after` bound (duties._open clamps the armed timer to it). Fail-soft → None means "no
    clamp", the plain window applies."""
    try:
        import db
        st = await db.settings_get("orders") or {}
        raw = str(st.get("schedule_time") or "").strip()
        if not raw:
            return None
        hh, _, mm = raw.partition(":")
        from datetime import datetime, timezone
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo("Europe/Madrid")
        except Exception:
            tz = timezone.utc
        now = datetime.now(tz)
        cutoff = now.replace(hour=int(hh), minute=int(mm or 0), second=0, microsecond=0)
        return cutoff.isoformat() if now < cutoff else None
    except Exception:
        log.debug("review.prep_cutoff_iso fail-soft", exc_info=True)
        return None
