"""behaviour.py — the per-tenant behaviour settings (KERNEL: config + db only) (§17.46, §17.35, §17.51's `S` vocabulary; §17.56 widened it).

    S = {doubts: ask|review|amount · offsku: review|open|reject · voice: never|mirror|always ·
         scope: all|orders · confirm: always|doubt|never · custom: keep|ignore ·
         calls: listen|after_hours|always}

§17.56 (the /demo persona questions) WIDENED the vocabulary rather than forking it — the demo's 5
questions write THESE keys, so the panel's «Cómo actúa» page inherits the new values for free
(§17.55j: the primitive is an exposed setting, never prompt garnish). The additions:
    doubts += amount   — big doubted lines to the team, small to the customer
                         (split at config.DOUBT_AMOUNT_THRESHOLD_EUR; pipeline owns the wiring)
    offsku += reject   — an off-list ask is declined plainly instead of parked/offered
    confirm (NEW key)  — always|doubt|never: when the ¿Es correcto? card goes out
                         (pipeline.ask_order_confirm's call site reads it; `always` IS today)
                         IT GOVERNS THAT ONE MESSAGE AND NOTHING ELSE (punch list B0, 2026-08-09).
                         It used to also switch off the customer's portal receipt, because the link
                         was only ever sent from the card's «Sí» branch — a supplier who called the
                         card noise lost the receipt rail for every one of their customers, silently.
                         `pipeline._settle_review` now offers the link on the filing when no question
                         is asked, so this key means exactly what its label says.

ONE ROW, ONE JSONB (`tenants.behaviour`), because these are the settings a supplier flips on the
«Cómo actúa» page and they are read on the hot path of every turn. The shape is the board's shape
deliberately (§17.51 froze the wire vocabulary: «the mockup's JS shapes = the API contract; copy
deliberately»), so the panel's toggles and this module never need a translation layer.

THE DEFAULTS ARE THE CURRENT BEHAVIOUR, not the new one. §17.46's implementation note is explicit:
«additive, OFF-flavour default, no live tenant changes until flipped». A tenant with no row, a NULL
column, or an unrecognised value behaves exactly as it did before this module existed — which is
what makes shipping it a no-op and turning it on a decision.
"""
from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.behaviour")

# key → (allowed values, default). The default column IS the pre-existing behaviour — that rule
# survives the §17.56 widening untouched: `ask`, `review` and `always` are exactly what the code
# did before those values had names, so a tenant who never opens the page changes nothing.
_SPEC: dict[str, tuple[tuple[str, ...], str]] = {
    "doubts": (("ask", "review", "amount"), "ask"),
    "offsku": (("review", "open", "reject"), "review"),
    # ── THE TWO SETUP QUESTIONS NOBODY WAS EVER ASKED (2026-08-19) ────────────────────────────
    # Peter, after the demo: «in the setup they need to be asked if they wanna put inventory, and
    # if not, if they're happy to review all orders or if they accept everything. You did not do a
    # proper good questionnaire about their setup of handling inventory.»
    #
    # These two decide how the whole account behaves and were never put to anyone, so every
    # supplier silently got the cautious answer. Cautious is the right DEFAULT — it is also the
    # pre-existing behaviour, which is this module's law — but a default nobody chose is not the
    # same as a decision, and the difference shows up as «why is it asking me about every order».
    "stock": (("no", "yes"), "no"),          # do they keep stock in Rocoto at all?
    "approve": (("review", "auto"), "review"),  # every order past their eyes, or straight through?
    # ── WHAT IT MAY SAY ABOUT MONEY (2026-08-19) ──────────────────────────────────────────────
    # Peter: «whether it says anything about price or doesn't». A price out of Rocoto's mouth is a
    # quote, and in this trade a quote is a commitment — fish moves daily and some suppliers price
    # per customer. `quote` IS the pre-existing behaviour (the catalogue carries prices and the
    # order card shows a total), so it stays the default; `hide` is for the supplier who prices on
    # the phone and does not want a number said before they say it.
    "prices": (("quote", "hide"), "quote"),
    # ── HOW AN ORDER FINISHES (Peter, 2026-08-19, designing it out loud) ───────────────────────
    # «The fact that we have a status of printed is already a really good one. CLOSED might be if
    # they have a setting for sending to the ERP after weighing. With other ones, we already know
    # the weight, or the ERP knows the weight and we don't need it.»
    #
    # This is the fork that decides whether an order has a LAST STEP at all, and it is per-supplier
    # because the trade genuinely splits:
    #   · print   — the paper IS the end. She prints it, works off it, and her own program does the
    #               rest. Nothing more to track. (The default: it is what happens today.)
    #   · weigh   — fish and meat at the weight. The order needs a real kg before it can be billed,
    #               so it gets a weight step and closes when the weight is in.
    #   · close   — they mark an order handled here (they may have closed it in their program
    #               already, so this is their bookkeeping, not ours).
    #
    # ⚠️ THE UI RULE THAT COMES WITH IT (Peter, same message): «that should only be revealed if they
    # set it the best way they can in the settings». A weight column, a Cerrar button, a «pesado»
    # label — none of them appear for a supplier who chose `print`. A control for an operating model
    # you do not have is clutter that also teaches a rule the product does not have for you.
    "finish": (("print", "weigh", "close"), "print"),
    # `mirror` IS THE PRE-EXISTING BEHAVIOUR, and this said `never` (corrected 2026-08-16).
    # The voice rail has been live on prod for every tenant — `ROCOTO_VOICE_REPLY_ENABLED=true`,
    # app.py's inbound-audio hook → `voice_reply.maybe_reply_to_voice_note` — i.e. a voice note is
    # answered with a voice note, which is exactly `mirror`. The default above claimed the opposite,
    # which broke this module's own law twice over: a tenant who never opens the page would have had
    # their voice replies switched OFF the moment anything read the key, and /demo's own header
    # («the first option is what you already do») was false on the one question whose first option
    # is `mirror`. The default column IS the pre-existing behaviour — so it is `mirror`.
    "voice": (("never", "mirror", "always"), "mirror"),
    "scope": (("all", "orders"), "all"),
    "confirm": (("always", "doubt", "never"), "always"),
    # §PERSONALIZACIÓN (Peter, 2026-08-16): «if people ask for something — chicken breast FROZEN —
    # the runtime should handle customisations, put down in a notes column… and that's just a
    # setting they should do.» `keep` is the pre-existing behaviour: the reader tool has always had
    # a per-line `note` and it has always ridden to the Nota column and the albarán. What it lacked
    # was a description telling the model to fill it, which is the same commit as this key.
    #   keep   — carry the customer's qualifier on the line, labelled
    #   ignore — take the product and the quantity, drop the qualifier
    "custom": (("keep", "ignore"), "keep"),
    # §LLAMADAS (Peter, 2026-08-17): «we're not answering with the Rocoto voice for now. That should
    # be a setting if they've enabled voice, and only work when it's answering out of hours and they
    # set it to run, otherwise it just listens and acts if they talk about the phone.»
    #
    # `listen` IS the pre-existing behaviour and therefore the default: today nothing answers a
    # phone, and a supplier who never opens this page must not discover one morning that a machine
    # has been greeting their customers.
    #   listen      — a human answers their own phone; Rocoto transcribes and acts on what was said.
    #                 No AI speaks, so no Art. 50 disclosure is owed (announcing one would be false).
    #   after_hours — Rocoto answers ONLY outside their receiving hours, when the alternative is a
    #                 phone ringing into an empty warehouse. Inside hours it goes back to listening.
    #   always      — Rocoto answers every call.
    # The last two make it an AI «intended to interact directly with natural persons», which is
    # exactly when ai_disclosure's spoken line becomes mandatory.
    "calls": (("listen", "after_hours", "always"), "listen"),
}

DEFAULTS: dict[str, str] = {k: v[1] for k, v in _SPEC.items()}


def coerce(raw: Any) -> dict[str, str]:
    """Any stored value → a complete, valid S. Unknown keys are dropped; an unrecognised VALUE falls
    back to that key's default rather than to the whole dict's, so one bad field cannot silently
    reset the others."""
    out = dict(DEFAULTS)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return out
    if not isinstance(raw, dict):
        return out
    for k, (allowed, default) in _SPEC.items():
        v = raw.get(k)
        out[k] = v if isinstance(v, str) and v in allowed else default
    return out


# ── THE PER-TURN OVERRIDE — a rehearsal's answers, without touching anybody's business ──────────
# /demo lets a visitor answer five questions that configure the agent, and `demo_flow.persona_set`
# used to apply them by calling `set_keys` on `tenant_of_row`, which for a SIGNED-IN operator is
# their REAL workspace. A paying supplier who opened the demo and clicked through the questions
# rewrote the behaviour of the agent answering their actual customers, and nothing on any screen
# said so. It also ran backwards: an operator who had set «solo pedidos» on /actua met a demo that
# looked broken, because `scope` IS honoured on the demo path.
#
# So a rehearsal's answers now ride a ContextVar for the duration of the turn instead of a write.
# Same shape as `agent_reply._SCOPE_OVERRIDE`, and the same reason: a demo must be able to behave
# differently without owning a different row. `demo_sessions.persona` remains the durable record —
# it always was — and a genuinely demo-provisioned tenant still gets the write-through, so nothing
# about the anonymous path changes.
_OVERRIDE: "ContextVar[Optional[dict[str, str]]]" = ContextVar("behaviour_override", default=None)


def set_override(s: Optional[dict[str, str]]):
    """Apply `s` for this task only. Returns the token — reset it in a finally."""
    return _OVERRIDE.set(coerce(s) if s else None)


def reset_override(token) -> None:
    try:
        _OVERRIDE.reset(token)
    except Exception:
        log.debug("behaviour override reset fail-soft", exc_info=True)


async def get(tenant: Optional[str] = None) -> dict[str, str]:
    """The tenant's S. Fail-soft to DEFAULTS: a settings read is on the turn's hot path, and a
    database hiccup must never change how the employee behaves.

    A per-turn override (see above) WINS, because the only thing that sets one is a rehearsal
    speaking for itself rather than for the business it borrows a tenant from."""
    ov = _OVERRIDE.get()
    if ov is not None:
        return dict(ov)
    slug = tenant or config.BRAIN_TENANT
    try:
        async with db.get_pool().acquire() as con:
            raw = await con.fetchval("select behaviour from tenants where slug = $1", slug)
        return coerce(raw)
    except Exception:
        log.debug("behaviour read fail-soft for %s", slug, exc_info=True)
        return dict(DEFAULTS)


async def set_keys(tenant: Optional[str], **changes: str) -> tuple[dict[str, str], dict[str, str]]:
    """Patch some keys, keep the rest. Returns the new S. Rejects unknown keys and values loudly —
    this is reached from the panel and from the copilot's verb registry (§17.48b), and a silently
    ignored setting is a supplier who believes they changed something they did not.

    RETURNS (before, after) so the CALLER can audit §17.34.6's «¿quién cambió esto y cuándo?» with
    both halves — "someone changed the behaviour" without saying from what is not an answer to that
    question. The audit is deliberately NOT done here: this is a kernel module, it does not know who
    the actor is, and reaching for the desk's session module to find out would be exactly the
    kernel→app edge vital_kernel_boundary forbids. The API layer has the actor; it does the audit.
    """
    slug = tenant or config.BRAIN_TENANT
    for k, v in changes.items():
        if k not in _SPEC:
            raise ValueError(f"unknown behaviour key {k!r} (known: {sorted(_SPEC)})")
        if v not in _SPEC[k][0]:
            raise ValueError(f"{k}={v!r} is not one of {_SPEC[k][0]}")
    before = await get(slug)
    cur = dict(before)
    cur.update(changes)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update tenants set behaviour = $2::jsonb, updated_at = now() where slug = $1",
            slug, json.dumps(cur))
    return before, cur


# ── §17.46 · WHAT ROCOTO ANSWERS ─────────────────────────────────────────────────────────────────
# Dana (Escofruit) asked for an agent that handles orders and stays out of everything else. In
# `scope='orders'` a non-order message gets NO reply — it parks for a human, untouched.
#
# SILENCE IS THE HONEST STATE HERE, and that is the whole argument: an ignored customer is better
# than a confident wrong answer she never saw. It is the same fail-toward-parking posture as §5,
# and mechanically it is the SOMBRA seam — everything upstream still happens (the sense is ingested,
# the fold assembled, the mind ran, orders were extracted and booked); only the SPEAKING stops, and
# the sentence it would have said is kept as a draft on the review sheet rather than vanishing.
#
# Orders still book themselves. That is the point of the setting: it narrows the MOUTH, not the ears.

_ORDER_ACTION_PREFIXES = ("book",)
_ORDER_ACTION_CONTAINS = ("order",)


def turn_produced_an_order(actions: list) -> bool:
    """Did this turn actually do order work? `actions` is the mind's `[{kind: detail}, …]`.

    Loosely matched on purpose: the manifest already carries order.drafted / order.parked /
    order.placed / order_lines, and a new order verb should be in scope the day it is added, not the
    day someone remembers to extend a list here. A narrower exact-match set is how this setting
    would quietly start muting real order replies.

    WHY «order» IS A CONTAINMENT TEST AND «book» IS STILL A PREFIX (2026-08-16, a live defect).
    Both used to be prefixes, and the ONLY order-taking key the mind ever emits is `take_order`
    (agent_reply's tool loop) — which starts with «take». So `scope='orders'` muted EVERY turn
    including the ones that booked an order: a supplier who flipped «solo pedidos» got an agent that
    answered nothing at all, which is the exact failure the docstring above says this shape exists to
    prevent. Containment fixes it and keeps the openness: `place_order`, `order_lines` and any future
    `*_order` are all in scope by construction.

    «book» stays a PREFIX deliberately, because containment would swallow `send_booking_link` — a
    calendar link, not order work — and silently re-open the mouth on a turn that did none.
    """
    for a in actions or []:
        if not isinstance(a, dict):
            continue
        for kind in a.keys():
            k = str(kind).lower()
            if any(k.startswith(p) for p in _ORDER_ACTION_PREFIXES):
                return True
            if any(c in k for c in _ORDER_ACTION_CONTAINS):
                return True
    return False


async def should_stay_silent(tenant: Optional[str], actions: list) -> bool:
    """True → this turn must not speak (§17.46). Only ever true in `scope='orders'`, and only when
    the turn did no order work."""
    s = await get(tenant)
    if s.get("scope") != "orders":
        return False
    return not turn_produced_an_order(actions)
