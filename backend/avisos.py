"""avisos.py — EL AVISO: the message that arrives at the right place, and the conversation it
starts (SPEC §5.11.5).

Peter's framing, kept verbatim because it IS the design: *the boss and the driver are having a
conversation in which each message is delivered only in the configuration where it matters* — at
that customer, on that doorstep, that morning. So an aviso is NOT a notification (a notification
arrives when it is sent, wherever you happen to be standing) and NOT a task list (a list is a place
you have to remember to go and look). It is a message whose address is made of three things — the
CUSTOMER it is about, the AUDIENCE it is for, and the fact that it is still open — and it is shown
WHOLE in that one configuration, never as a badge. A driver will not tap to discover something he
needs.

TWO KINDS, ONE OBJECT, and the only difference is who wrote it:
  · `auto` — computed from data. v1 has EXACTLY ONE generator and it is money, and that generator
    already exists: `delivery.sync_overdue_aviso`. This module CALLS it (`_sync_auto`) and never
    re-derives it. A second copy of the overdue rule is precisely how the driver's screen and the
    desk end up disagreeing about a debt, and `delivery.py` owns every euro in this feature — there
    is no amount in this file, no column that holds one, and no argument that accepts one.
    **An `auto` aviso is not dismissible.** `resolve()` REFUSES it by kind, in es-ES, naming the
    only thing that closes it. It is not an opinion; it goes away when the fact does.
  · `nota` — a person wrote it, from the customer ficha («Nota para el repartidor»), typed or
    dictated. Dictation is already text by the time it reaches this module: a voice note nobody
    plays is not a record (`delivery.attach` says the same thing about a stop note).

A NOTA BELONGS TO THE CUSTOMER, NOT TO A DRIVER. There is deliberately no driver column on it. The
boss does not write to Manolo-who-drives-on-Tuesdays; he writes something true about Casa Bermejo,
and whoever stands at that door next is the one who needs to read it. That is why it «surfaces on
the next stop for that customer and nowhere else» — the read filters on (tenant, phone, audience,
open), and nothing else.

THE LOOP, WHICH IS THE WHOLE FEATURE. A nota resolved by the driver RAISES the counter-aviso to the
boss carrying the driver's own words; the boss resolves that either by closing it (the thread ends)
or by writing back, which lands as the next nota at that customer's next stop. `parent_id` is the
thread and `next_rung()` is the rule, kept PURE so the entire conversation is assertable with no
database — the same discipline as `window.resolve()` and `range.verdict()`.

REFUSED, AND NAMED SO NOBODY RE-OPENS IT:
  1. **A «descartar» button on the money aviso** (or a `dismissed` column). An aviso you can silence
     is a fact you can hide, and the fact here is that a restaurant owes a man money. Refused.
  2. **A second `avisos` writer for the overdue rule.** See above: connect, never rebuild.
  3. **Two tables, `avisos` and `notas`.** The resolution machinery, the thread, the event and the
     surface are identical for both kinds; the only difference is the author. One object.
  4. **Pre-generating the questionnaire when the aviso is raised** (and caching it on a column).
     Attractive — the options would be ready before the van arrives — and refused: the options
     depend on the customer's state AT THE DOOR, and an option generated last night can be about a
     debt that has since been paid. A stale question is worse than a duller one.
  5. **Reading «write back» out of the boss's chosen phrase.** The options are model-written text; a
     generated string is not a control signal. Writing back is its own argument (`reply=`), so the
     branch is deterministic and a re-worded option can never silently change what happens.
  6. **Showing the model the ledger.** It receives the already-formatted es-ES label from
     `delivery.euros` and nothing numeric of its own to work from — and any figure it mints that we
     did not hand it is dropped from the option (`_clean`). NEVER INVENT A NUMBER holds even when
     the number is only being *suggested* to a driver.
  7. **Re-opening a resolved aviso.** Resolution is append-only, like the ledger: the next thing is
     a NEW aviso with a parent, never an edit of the last one. (The money aviso re-appears the same
     way — the partial unique index only covers OPEN rows, so a customer who falls behind again gets
     a new row, with its own history.)
  8. **Emitting an event from the read path.** `open_for` runs once per stop on a driver's list; a
     read that writes to the spine would put a dozen transactions behind a list nobody changed. The
     events are written by the WRITES (`_raise`, `resolve`) — see `_emit`.

WHERE THIS PLUGS IN, so nobody re-derives it. `open_for` is what a stop screen and a customer ficha
read; `list_for_jefe` is the boss's queue and is the seam «LO QUE TE TOCA» (`/api/app/review`, app.py)
should call — wiring it into that surface is an edit to THAT file, not a second queue in this one.
The one automatic aviso comes from `delivery.sync_overdue_aviso`, the events go onto the existing
spine through `runtime.emit_sense`, and the questionnaire rides `brain/llm.call_tool`. This module
adds no machinery; it connects the machinery that is already there.

TENANT ISOLATION IS ABSOLUTE. The client never names its tenant: every function here takes it from
the caller's session context and every statement filters on it. A wrong-tenant id therefore misses
the WHERE and raises `LookupError` — loudly, never an empty 200 dressed as "you have no avisos".
(`repartidor` holds exactly one capability, `deliver`, so the routes that will call this are the
only ones he can reach at all — the cap set does the gating, not a check in here.)

es-ES for everything a driver or a boss reads; English for code and comments (LANGUAGE LAW §0.11).
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

import delivery

log = logging.getLogger("rocoto.avisos")

# ── the closed sets (mirror db.py's column comments exactly; none of these is a flag) ─────────────
AUTO, NOTA = "auto", "nota"
KINDS = (AUTO, NOTA)

REPARTIDOR, JEFE = "repartidor", "jefe"
AUDIENCES = (REPARTIDOR, JEFE)

ABIERTO, RESUELTO = "abierto", "resuelto"
STATES = (ABIERTO, RESUELTO)

# The attention band, not a colour: the client owns the crimson. `subrayado` is reserved for the
# money aviso, which is the only thing that ships underlined — if every note is underlined, nothing
# is, and the one that means "this man is owed 480,20 €" stops being visible.
BANDA_NOTA, BANDA_SUBRAYADO = "nota", "subrayado"
BANDS = (BANDA_NOTA, BANDA_SUBRAYADO)

# Lengths. The asymmetry is deliberate and it is about WHERE the person is standing:
#   · a nota is typed at a desk, so an over-long one RAISES and the boss shortens it;
#   · a driver's answer is dictated in the rain at 6 a.m., so it is CLIPPED rather than refused —
#     refusing a man his own words at a door is worse than clipping a runaway transcript.
MAX_BODY = 500
MAX_CHOICE = 160
MAX_NOTE = 1000

_FIELDS = ("id", "tenant_id", "phone_number", "kind", "audience", "band", "body", "state",
           "created_by", "created_at", "resolved_at", "resolved_by", "resolved_choice",
           "resolved_note", "parent_id", "auto_key")


def _cols(prefix: str = "") -> str:
    return ", ".join(prefix + f for f in _FIELDS)


# ══ text (pure; no DB, no config, no network — the vital runs all of this with nothing installed) ══
_WS = re.compile(r"\s+")


def _one_line(text: Any) -> str:
    """Anything a human or a client sent → one clean line. Dictation arrives with newlines in it and
    an aviso is read on a phone at arm's length; the words are untouched, only the whitespace."""
    return _WS.sub(" ", str(text or "")).strip()


def _short(text: str, n: int) -> str:
    """A quote of somebody's words, clipped with an ellipsis so it is VISIBLY a quote of part of it.
    Never a silent truncation: a half sentence pretending to be the whole one is a small lie."""
    t = _one_line(text)
    return t if len(t) <= n else t[: max(0, n - 1)].rstrip() + "…"


# ══ el cuestionario — the shape, and the set that is always there ════════════════════════════════
OTRA = "Otra cosa"          # the free-text/dictation door; ALWAYS last, always present

# THE GENERIC SET. This is not a placeholder — it is the guarantee. A driver is never blocked by our
# LLM, so every aviso can be resolved with these three even if no model, no key and no network exist
# (SPEC §5.11.5: «si el modelo no está disponible el aviso se resuelve igual»). The boss's set is
# his own three moves, because "No he podido" is not a thing a man at a desk does about a note.
GENERIC = {
    REPARTIDOR: ("Hecho", "No he podido", "Hablamos"),
    JEFE: ("Cerrado", "Le escribo al repartidor", "Lo hablo yo con el cliente"),
}

MAX_OPTION = 52      # one line on a phone, tappable in the rain
MAX_OPTIONS = 4      # 3–4 numbered options + «Otra cosa» (the AskUserQuestion shape, in Compose)
MIN_OPTIONS = 2      # fewer than two "generated" options is not a questionnaire → the generic set
OPTIONS_TIMEOUT_S = 4.0


def option(oid: str, label: str, *, free: bool = False) -> Dict[str, Any]:
    """One tappable outcome. `label` is load-bearing and `id` is not: `resolve()` stores the LABEL
    verbatim in `resolved_choice`, because the id is OUR word for what he meant and the label is
    his. `free` marks the one option that opens the keyboard/dictation instead of closing."""
    return {"id": oid, "label": label, "free": bool(free)}


def fallback_options(audience: str = REPARTIDOR) -> List[Dict[str, Any]]:
    """The questionnaire when there is no model — and the reason `generate_options` can promise it
    never raises and never blocks."""
    aud = audience if audience in AUDIENCES else REPARTIDOR
    return [option(f"g{i + 1}", t) for i, t in enumerate(GENERIC[aud])] + [option("otra", OTRA, free=True)]


_FIGURE = re.compile(r"\d[\d.,]*")


def _figures(text: str) -> set:
    """Every number in a piece of text, normalised to bare digits («480,20 €» → «48020»), so the
    two separator conventions and a thousands point can never make the same figure look different."""
    out = set()
    for tok in _FIGURE.findall(text or ""):
        norm = tok.replace(".", "").replace(",", "").strip()
        if norm:
            out.add(norm)
    return out


def _clean(raw: Any, source: str) -> List[str]:
    """Whatever the model returned → the options we are willing to put under a driver's thumb.

    THE NUMBER GUARD IS THE POINT. An option is DROPPED when it carries a figure that does not
    appear in the material we handed the model. «Me ha pagado los dos albaranes» is a phrase; «Me ha
    pagado 480,20 €» is a claim about money, and a model is not allowed to make one here — the
    ledger is the only source of any amount in this feature. It is deliberately strict: it will also
    drop a perfectly good «los 2 albaranes» when the note said «los dos», and that trade is right,
    because the cost of dropping a good option is a duller phrase and the cost of keeping an
    invented one is a made-up euro amount spoken at a restaurant's door. One bad option costs that
    option, not the questionnaire — the rest stand, and the generic set is always underneath."""
    known = _figures(source)
    out: List[str] = []
    seen = {OTRA.lower()}
    for item in (raw or []):
        label = _one_line(item)
        if not label or len(label) > MAX_OPTION:
            continue                                  # it ignored the shape we asked for → not ours
        if label.lower() in seen:
            continue
        if not _figures(label) <= known:
            log.debug("avisos: dropping an option that minted a figure: %r", label)
            continue
        seen.add(label.lower())
        out.append(label)
        if len(out) >= MAX_OPTIONS:
            break
    return out


# ── the model call (the ONLY thing in this file that touches a model, and nothing waits on it) ────
# es-ES on purpose: what comes out is read by a driver, so the instructions are written in the
# language of the thing being produced (`window.TOOL`'s idiom — written for the mind, not for us).
_SYSTEM = (
    "Eres el ayudante de un repartidor y de su jefe en una distribuidora de alimentación en España. "
    "Te doy un AVISO sobre un cliente y me devuelves los 3 o 4 DESENLACES posibles de ese aviso: "
    "qué puede haber pasado realmente, en corto.\n"
    "REGLAS:\n"
    "· Cada opción, una frase de menos de 50 caracteres, en español de España, que se pueda leer de "
    "un vistazo y tocar con el pulgar bajo la lluvia.\n"
    "· Habla de ESTE aviso y de ESTE cliente, no en general. Si el aviso habla de «los dos albaranes "
    "de junio», las opciones hablan de esos albaranes.\n"
    "· NO inventes NINGUNA cifra, ni euros, ni fechas, ni días: solo puedes repetir las que te doy.\n"
    "· No propongas «Otra cosa» ni «Cancelar»: eso ya está puesto.\n"
    "· Son desenlaces, no tareas: se marcan cuando ya han ocurrido."
)

_TOOL: Dict[str, Any] = {
    "name": "proponer_opciones",
    "description": "Devuelve los 3 o 4 desenlaces posibles de este aviso, en frases muy cortas.",
    "input_schema": {
        "type": "object",
        "properties": {
            "opciones": {
                "type": "array",
                "items": {"type": "string", "description": "un desenlace, menos de 50 caracteres"},
                "description": "3 o 4 opciones, de la más probable a la menos",
            }
        },
        "required": ["opciones"],
    },
}

# The es-ES labels for the context we are willing to show the model. Only keys PRESENT and non-empty
# are rendered — an absent one is simply not a line, never «desconocido» and never a placeholder.
_CTX_LABEL = (
    ("customer", "CLIENTE"),
    ("owed_label", "LO QUE DEBE"),        # already formatted by delivery.euros — never cents
    ("age_label", "LA MÁS ANTIGUA"),
    ("window_label", "FRANJA"),
    ("answer", "LO QUE HA CONTESTADO EL REPARTIDOR"),
)


def _user(body: str, ctx: Dict[str, Any]) -> str:
    lines = [f"AVISO: {body}"]
    for key, label in _CTX_LABEL:
        val = _one_line(ctx.get(key))
        if val:
            lines.append(f"{label}: {val}")
    lines.append("QUIÉN LO RESUELVE: "
                 + ("el jefe, desde la oficina" if ctx.get("audience") == JEFE
                    else "el repartidor, en la puerta del cliente"))
    return "\n".join(lines)


def _source_text(body: str, ctx: Dict[str, Any]) -> str:
    """Everything the model was allowed to see — and therefore every figure it is allowed to use."""
    return " ".join([body] + [_one_line(ctx.get(k)) for k, _ in _CTX_LABEL])


async def _ask_model(body: str, ctx: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The existing LLM seam (`brain/llm.call_tool`: one forced tool call, temperature 0, with the
    overload fallback model), imported LAZILY so this module can be read, imported and tested with
    no key, no config and no `anthropic` installed — and so the vital can stub exactly this.

    Haiku by default: this is a phrasebook call on a doorstep, not a decision. A dedicated env var
    is one `getattr` away the day somebody wants to pin it separately."""
    import config
    if not getattr(config, "ANTHROPIC_API_KEY", ""):
        return None                                   # no key → no wait; the generic set is right here
    from brain import llm
    model = getattr(config, "AVISO_OPTIONS_MODEL", "") or config.VOICE_CHAT_MODEL
    return await llm.call_tool(model, _SYSTEM, _user(body, ctx), _TOOL, _TOOL["name"],
                               max_tokens=400,
                               fallback=getattr(config, "ORDER_EXTRACT_FALLBACK_MODEL", None))


async def generate_options(body: str, context: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """THE QUESTIONNAIRE: this aviso → 3–4 outcomes specific to it, plus «Otra cosa».

    **A DRIVER IS NEVER BLOCKED BY OUR LLM.** This function cannot raise and cannot hang: no key, a
    dead model, a 529, junk in the tool call, four seconds of silence — every one of them lands on
    the generic set (Hecho · No he podido · Hablamos) and the aviso resolves exactly the same way,
    because `resolve()` takes the option's TEXT and has no idea where it came from. That is the
    guarantee, and it is structural rather than promised: the model is on this path only to make the
    question better, never to make it possible.

    On timeout the worker thread `llm.call_tool` left running is simply abandoned — it finishes into
    nothing. We do not wait on it, and a man at a door does not wait on it either."""
    ctx = dict(context or {})
    audience = ctx.get("audience") if ctx.get("audience") in AUDIENCES else REPARTIDOR
    ctx["audience"] = audience
    text = _one_line(body)
    if not text:
        return fallback_options(audience)
    raw: Any = None
    try:
        raw = await asyncio.wait_for(_ask_model(text, ctx), timeout=OPTIONS_TIMEOUT_S)
    except asyncio.TimeoutError:
        log.debug("avisos.generate_options: model slower than %ss — the generic set stands",
                  OPTIONS_TIMEOUT_S)
    except Exception:
        log.debug("avisos.generate_options fail-soft — the generic set stands", exc_info=True)
    opts = _clean(raw.get("opciones") if isinstance(raw, dict) else None,
                  _source_text(text, ctx))
    if len(opts) < MIN_OPTIONS:
        return fallback_options(audience)
    return [option(f"o{i + 1}", t) for i, t in enumerate(opts)] + [option("otra", OTRA, free=True)]


# ══ la conversación — the loop, as a pure rule ═══════════════════════════════════════════════════
def counter_body(parent_body: str, choice: str, note: str) -> str:
    """The boss's aviso, built ONLY out of words people actually said: the driver's chosen option
    and his free text, VERBATIM, quoted, over the note they answer. Nothing is summarised and
    nothing is interpreted — the boss reads what his man said, not our reading of it. Empty when
    there is nothing to carry, which is what stops an empty rung being raised."""
    said = " · ".join(p for p in (_one_line(choice), _one_line(note)) if p)
    if not said:
        return ""
    head = _short(parent_body, 90)
    return f"«{said}» — sobre tu nota: «{head}»" if head else f"«{said}»"


def next_rung(aviso: Dict[str, Any], choice: str = "", note: str = "",
              reply: str = "") -> Dict[str, Any]:
    """THE LOOP, AS A RULE — pure, so the whole conversation is assertable with no database.

    Given the aviso being resolved and what the human said, what happens next:
      {"audience": '' | 'jefe' | 'repartidor', "band": …, "body": …}
    and an empty `audience` means THE THREAD ENDS HERE, which is how this terminates:

      · a `nota` the DRIVER answered  → the counter-aviso to the JEFE, carrying his words verbatim.
      · a `nota` the JEFE answered, with a reply → the next nota back to the driver: it lands at
        that customer's next stop, and the loop has gone round once more because a human chose to.
      · a `nota` the JEFE answered, with NO reply → nothing. Closed. The common ending.
      · an `auto` → nothing, ever. It is not part of a conversation; it is a fact about money and it
        never gets here anyway (`resolve` refuses it by kind before this is called).

    Each rung costs a human tap, so the loop cannot run away on its own — and it is deliberately not
    capped at N rungs: a boss and a driver going back and forth four times about one customer is the
    feature working, not a bug to defend against."""
    a = aviso or {}
    if (a.get("kind") or NOTA) == AUTO:
        return {"audience": "", "band": BANDA_NOTA, "body": ""}
    if (a.get("audience") or REPARTIDOR) == REPARTIDOR:
        return {"audience": JEFE, "band": BANDA_NOTA,
                "body": counter_body(a.get("body") or "", choice, note)}
    back = _one_line(reply)
    if not back:
        return {"audience": "", "band": BANDA_NOTA, "body": ""}
    return {"audience": REPARTIDOR, "band": BANDA_NOTA, "body": back[:MAX_BODY]}


# ══ the wire shape ═══════════════════════════════════════════════════════════════════════════════
def shape(row: Any) -> Dict[str, Any]:
    """One `avisos` row → the shape both clients read (the phone's stop screen and the desk), so an
    aviso can never mean one thing in the van and another at the desk. `dismissible` is computed
    here rather than stored: it is not a property somebody set, it is what the KIND means.

    It maps the aviso's OWN columns and nothing else. The customer's name comes off the ficha
    through a join and is added by the one function that joins (`list_for_jefe`) — a shape whose
    keys depended on which query produced it is how a client ends up writing `if "customer" in …`."""
    d = dict(row) if row else {}
    kind = d.get("kind") or NOTA
    return {
        "id": int(d["id"]) if d.get("id") is not None else 0,
        "phone_number": d.get("phone_number") or "",
        "kind": kind,
        "audience": d.get("audience") or REPARTIDOR,
        "band": d.get("band") or BANDA_NOTA,
        "body": d.get("body") or "",
        "state": d.get("state") or ABIERTO,
        "dismissible": kind != AUTO,
        "parent_id": int(d["parent_id"]) if d.get("parent_id") is not None else None,
        "created_by": d.get("created_by") or "",
        "created_at": d.get("created_at"),
        "resolved_choice": d.get("resolved_choice") or "",
        "resolved_note": d.get("resolved_note") or "",
    }


# ══ the events (SPEC §5.11.8 — every rung writes one, on the existing spine) ══════════════════════
async def _emit(phone: str, etype: str, payload: Dict[str, Any], key: str) -> None:
    """One rung → one event on the CUSTOMER's scope, through `runtime.emit_sense` (which appends on
    wa.<digits>, bootstrapping the party if it has to). This is how the delivery conversation
    becomes part of what the employee KNOWS about a customer instead of something that happened
    outside the product.

    `dedupe_key` is the aviso's own id, so a retried write cannot double-write the timeline. Imported
    lazily and fail-soft twice over (emit_sense is itself fail-soft): the aviso is already written
    when we get here, and a spine hiccup must never turn a resolved aviso into an error at a door."""
    if not phone:
        return
    try:
        import runtime
        await runtime.emit_sense(phone=phone, type=etype, source="avisos",
                                 payload=payload, dedupe_key=key)
    except Exception:
        log.debug("avisos._emit fail-soft (%s)", etype, exc_info=True)


# ══ the store ════════════════════════════════════════════════════════════════════════════════════
async def _sync_auto(con, tenant: str, phone: str) -> Optional[int]:
    """The one automatic generator, CALLED and never copied: `delivery.sync_overdue_aviso` opens the
    money aviso when the customer is past the tenant's terms and closes it when he is not.

    It runs on the READ because the aviso is a projection of the ledger: an aviso that is only
    refreshed when somebody happens to write is a stale claim about somebody's money. Fail-soft
    inside `delivery` already; the driver's list survives it either way."""
    return await delivery.sync_overdue_aviso(con, tenant, phone)


async def open_for(con, tenant: str, phone: str, audience: str = REPARTIDOR) -> List[Dict[str, Any]]:
    """EVERY OPEN AVISO for this customer, for this audience — the read the stop screen and the
    ficha make. Money first (the underlined band), then the oldest note first, because a note that
    has been waiting three stops is the one somebody is still waiting on.

    Fail-soft, and that is the law rather than caution: a settings/list read must never take a
    driver's day down. An unreadable table means "no avisos", the stop still renders, and the money
    aviso is refreshed on the next read."""
    aud = audience if audience in AUDIENCES else REPARTIDOR
    if aud == REPARTIDOR:
        # The money aviso is written with audience='repartidor' by its generator, so only the
        # driver's read needs to re-derive it. The boss sees the money on his own surfaces.
        await _sync_auto(con, tenant, phone)
    try:
        rows = await con.fetch(
            f"select {_cols()} from avisos where tenant_id=$1 and phone_number=$2 "
            f"and audience=$3 and state=$4 "
            f"order by (band=$5) desc, created_at asc, id asc",
            tenant, phone, aud, ABIERTO, BANDA_SUBRAYADO)
    except Exception:
        log.debug("avisos.open_for fail-soft for %s", phone, exc_info=True)
        return []
    return [shape(r) for r in rows]


async def list_for_jefe(con, tenant: str, *, limit: int = 50) -> List[Dict[str, Any]]:
    """THE BOSS'S QUEUE — every open aviso addressed to him, across all his customers, oldest first,
    with the customer's name off the ficha so «LO QUE TE TOCA» reads as a person and not a phone
    number. Tenant-filtered like everything else here; a `left join` so a customer with no ficha row
    still appears — and then `customer` falls back to his NUMBER, which is the name we honestly
    have, rather than the key going missing and the boss's queue showing a blank where a business
    should be. The key is always present; only its value can be thin.

    Fail-soft on the same grounds as `open_for`: an empty queue renders, a broken one does not."""
    try:
        rows = await con.fetch(
            f"select {_cols('a.')}, p.display_name from avisos a "
            f"left join customer_profiles p "
            f"  on p.tenant_id = a.tenant_id and p.phone_number = a.phone_number "
            f"where a.tenant_id=$1 and a.audience=$2 and a.state=$3 "
            f"order by a.created_at asc, a.id asc limit $4",
            tenant, JEFE, ABIERTO, max(1, int(limit)))
    except Exception:
        log.debug("avisos.list_for_jefe fail-soft for %s", tenant, exc_info=True)
        return []
    return [{**shape(r), "customer": (r["display_name"] or r["phone_number"] or "")} for r in rows]


async def thread(con, tenant: str, aviso_id: int, *, limit: int = 20) -> List[Dict[str, Any]]:
    """THE WHOLE CONVERSATION this aviso belongs to, oldest rung first — what makes `parent_id` a
    real thread and not a decorative column. Walks up to the root, then back down.

    Bounded by `limit` on both walks: a parent is always older than its child so a cycle cannot
    happen, but a reader that would loop forever if the data ever lied is not a reader I want on a
    phone. Fail-soft; an unreadable thread is an empty one."""
    try:
        root = int(aviso_id)
        for _ in range(limit):
            parent = await con.fetchval(
                "select parent_id from avisos where id=$1 and tenant_id=$2", root, tenant)
            if parent is None:
                break
            root = int(parent)
        rows = await con.fetch(
            f"with recursive t as ("
            f"  select {_cols()} from avisos where id=$1 and tenant_id=$2 "
            f"  union all "
            f"  select {_cols('a.')} from avisos a join t on a.parent_id = t.id "
            f"    where a.tenant_id=$2) "
            f"select {_cols()} from t order by id asc limit $3",
            root, tenant, max(1, int(limit)))
    except Exception:
        log.debug("avisos.thread fail-soft for %s", aviso_id, exc_info=True)
        return []
    return [shape(r) for r in rows]


async def _raise(con, tenant: str, phone: str, body: str, *, audience: str, band: str = BANDA_NOTA,
                 by: str = "", parent_id: Optional[int] = None) -> Dict[str, Any]:
    """Write ONE aviso and its event. Internal on purpose: `kind` is hard-wired to `nota` here,
    because in this module a person is always the author — `auto` has exactly one writer in the
    codebase and it is `delivery.sync_overdue_aviso`. Nothing here can mint one."""
    row = await con.fetchrow(
        f"insert into avisos (tenant_id, phone_number, kind, audience, band, body, created_by, "
        f"parent_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning {_cols()}",
        tenant, phone, NOTA, audience, band, body, by or None,
        int(parent_id) if parent_id else None)
    out = shape(row)
    text = (f"Nota para el repartidor sobre este cliente: «{_short(out['body'], 160)}»"
            if audience == REPARTIDOR else
            f"Aviso para el jefe: «{_short(out['body'], 160)}»")
    await _emit(phone, "aviso.raised",
                {"text": text, "aviso_id": out["id"], "kind": out["kind"],
                 "audience": out["audience"], "band": out["band"], "parent_id": out["parent_id"]},
                f"aviso.raised:{out['id']}")
    return out


async def write_nota(con, tenant: str, phone: str, body: str, *, audience: str = REPARTIDOR,
                     band: str = BANDA_NOTA, by: str = "",
                     parent_id: Optional[int] = None) -> Dict[str, Any]:
    """«NOTA PARA EL REPARTIDOR» — the boss writing from the customer ficha, typed or dictated.

    RAISES in es-ES on anything that is not a note: fail soft on the read, never on the rule. The
    error names the FIX and never a code, because the person reading it is a supplier at a desk who
    just lost what he typed if we are careless about this.

    Validation happens BEFORE `con` is touched (the `range.set_range` discipline), so a bad write is
    refused without a round-trip and the vital can prove the refusal with no database at all."""
    text = _one_line(body)
    if not text:
        raise ValueError("Escribe la nota antes de guardarla.")
    if len(text) > MAX_BODY:
        raise ValueError(f"La nota es demasiado larga ({len(text)} caracteres): resúmela en una o "
                         f"dos frases, que se lee de un vistazo en la puerta.")
    if audience not in AUDIENCES:
        raise ValueError("Di para quién es la nota: para el repartidor o para ti.")
    if band not in BANDS:
        raise ValueError("Esa banda de atención no existe.")
    return await _raise(con, tenant, phone, text, audience=audience, band=band, by=by,
                        parent_id=parent_id)


async def resolve(con, tenant: str, aviso_id: int, *, choice: str = "", note: str = "",
                  by: str = "", reply: str = "", audience: str = "") -> Dict[str, Any]:
    """RESOLVE ONE AVISO — and raise whatever the loop says comes next.

    Returns {"aviso": …, "raised": …|None, "already": bool}. `raised` is the next rung when there is
    one; `already` is a second tap on a resolution that already happened, which is a double-tap in
    the rain and not a second answer — it changes nothing and it raises nothing, so the boss never
    gets the same message twice.

    THREE RULES, ALL OF THEM REFUSALS:
      · An `auto` aviso cannot be resolved by a person. It is money; it closes when the money moves.
      · A resolution with neither a chosen option nor free text is not a resolution.
      · Another tenant's aviso does not exist here — the filter misses and this raises LookupError,
        which the router turns into a 403/404. Never an empty 200 that reads as "nothing to do".
      · **Somebody else's audience does not exist here either.** `audience=` narrows the SELECT, and
        the driver's route passes REPARTIDOR. Without it, a `deliver`-only account could resolve
        avisos addressed to the JEFE — the counter-avisos carrying other drivers' words and the
        boss's own «LO QUE TE TOCA» queue — and because the boss's branch of `next_rung` terminates
        on an empty `reply`, the thread would die SILENTLY: his queue empties, nobody is told, and
        the audit row says a driver did it. Same filter, same LookupError, same 404.

    `resolved_choice` is stored VERBATIM — it is what he said, and §5.11.8 puts it, verbatim, on the
    event too. Note that nothing on this path asks the model anything: the questionnaire is upstream
    and optional, so an aviso resolves identically whether the options were generated or generic."""
    ch, nt = _one_line(choice)[:MAX_CHOICE], _one_line(note)[:MAX_NOTE]
    if not ch and not nt:
        raise ValueError("Elige una opción o escribe qué ha pasado para cerrar el aviso.")
    if not ch:
        ch = OTRA                                     # he typed instead of tapping; that IS «Otra cosa»
    want = (audience or "").strip()
    row = await con.fetchrow(
        f"select {_cols()} from avisos where id=$1 and tenant_id=$2 "
        "  and ($3::text = '' or audience = $3::text)",
        int(aviso_id), tenant, want)
    if not row:
        raise LookupError("no_such_aviso")
    current = shape(row)
    if current["kind"] == AUTO:
        raise ValueError("Ese aviso no se cierra a mano: desaparece solo cuando se liquide lo que "
                         "el cliente debe.")
    done = await con.fetchrow(
        f"update avisos set state=$3, resolved_at=now(), resolved_by=$4, resolved_choice=$5, "
        f"resolved_note=$6 where id=$1 and tenant_id=$2 and state=$7 returning {_cols()}",
        int(aviso_id), tenant, RESUELTO, by or None, ch, nt, ABIERTO)
    if not done:
        return {"aviso": current, "raised": None, "already": True}
    out = shape(done)
    await _emit(out["phone_number"], "aviso.resolved",
                {"text": f"Aviso resuelto: «{ch}»" + (f" · {_short(nt, 160)}" if nt else ""),
                 "aviso_id": out["id"], "choice": ch, "note": nt,
                 "audience": out["audience"], "parent_id": out["parent_id"]},
                f"aviso.resolved:{out['id']}")
    rung = next_rung(out, ch, nt, reply)
    if not rung["audience"] or not rung["body"]:
        return {"aviso": out, "raised": None, "already": False}
    raised = await _raise(con, tenant, out["phone_number"], rung["body"],
                          audience=rung["audience"], band=rung["band"], by=by,
                          parent_id=out["id"])
    return {"aviso": out, "raised": raised, "already": False}
