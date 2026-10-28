"""agent_reply.py — Rocoto himself on WhatsApp: the agentic runtime, with hands + memory + awareness.

This IS Rocoto on the shared line (+15559193021) — not a bolt-on. Every inbound turn he:
  * knows WHO he is (the employee) and that THIS number is the shared line people chat with him on now
    (later each tenant gets their own Rocoto number; both work);
  * knows WHERE this person is in the lifecycle — a cold prospect, someone who booked/took the alta
    call, someone who paid the setup, someone mid-onboarding, or Peter his creator — and adapts;
  * REMEMBERS them (runtime facts/card on scope wa.<digits>) so he doesn't make them repeat;
  * has real ACTIONS (tools), not just talk: call them now, send the booking link (a call with PETER),
    send the signup link, remember a fact — and picks the right one for their state;
  * applies the channel rule: a link / price / confirmation goes as TEXT, never a dictated voice note;
  * never concedes money on his own (the gate discipline lives in the persona + the outbound check).

Contract: agentic_reply(...) → {"text", "force_text", "actions"}. Fail-soft (the caller also guards).
"""
from __future__ import annotations

import contextvars
import logging
import re
from typing import Any, Callable, Optional

import anthropic

import config
import db
import demo_call
import gate

# review owns the §5.8a tone law (`hold_note`) AND its other half — the contradiction check that
# catches a reply claiming an order was recorded on a turn that recorded nothing. Module-level
# because the check runs on every customer turn; review itself imports only stdlib at module scope.
import review
import tenancy
from brain import window

log = logging.getLogger("rocoto.agent_reply")

# THE SCOPE-OVERRIDE LEAK (found 2026-07-28 building WP-E's try-chat widget, verified against a real
# DB): every tool a turn's mind can call (take_order/place_order, react, ask_options, send_image,
# escalate, open_tab/resolve_tab/update_tab, the money-gate park) resolves its scope by calling
# `_scope(phone)` FRESH, right here in this module — NOT the scope `runtime.run_turn` actually pinned
# via `scope_override`. So a scope-pinned turn (the §13 persona console; WP-E's public try-chat
# widget, both of which promise "lineage=test, never touches a real tenant's scope") still had every
# TOOL WRITE land on a plain `wa.<digits(phone)>` scope with lineage='live' — the exact leak those
# consoles exist to prevent. `runtime.run_turn` itself (ingest/assemble/card) already respects
# scope_override correctly; only the tool loop inside `_run_mind` didn't.
# Fix: a contextvar `_run_mind` (see its wrapper below) sets for the duration of ONE turn when the
# caller pins a scope, and `_scope()` consults it first. Unset (the live WhatsApp path, which never
# passes scope_override) → byte-identical to before: `_scope(phone)` still returns `wa.<digits>`.
_SCOPE_OVERRIDE: "contextvars.ContextVar[Optional[str]]" = contextvars.ContextVar(
    "agent_reply_scope_override", default=None)


def _scope(phone: str) -> str:
    override = _SCOPE_OVERRIDE.get()
    return override if override else tenancy.scope_of(phone)   # WP-A1


async def _ensure_scope(con, scope: str) -> None:
    # tenant_slug used to be a literal `null` here (and in _memory_card / _save_fact below). That is
    # the column `/api/app/review` filters «LO QUE TE TOCA» on, so a null wrote a row the comercial's
    # own sheet could never match. `tenancy.tenant_of` is the one resolver: the tenant in the path
    # wins, everything else is the single-tenant fallback.
    await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'prospect',$2) on conflict do nothing",
                      scope, tenancy.tenant_of(scope))
    await con.execute("insert into card(scope,body,version) values($1::ltree,'',0) on conflict do nothing", scope)


async def _runtime_context(phone: str, message: str) -> tuple[str, str]:
    """Open tabs Rocoto is holding + recalled memory relevant to this message (SPEC §4/§5). Fail-soft."""
    tabs_txt, recall_txt = "", ""
    try:
        import memory
        scope = _scope(phone)
        async with db.scoped_tx(scope) as con:
            await _ensure_scope(con, scope)
            tabs = await con.fetch(
                "select id, kind, text, due_at from open_loop where scope=$1::ltree and status='open' order by opened_at desc limit 8", scope)
            if tabs:
                tabs_txt = "\n".join(
                    f"  · [#{t['id']}] ({t['kind']}) {t['text']}" + (f" — vence {t['due_at']:%d/%m}" if t['due_at'] else "")
                    for t in tabs)
            hits = await memory.search(con, scope, message, k=6)
            if hits:
                recall_txt = "\n".join(f"  · {h['text']}" for h in hits)
    except Exception:
        log.debug("runtime_context fail-soft", exc_info=True)
    return tabs_txt, recall_txt


async def _do_open_tab(phone: str, kind: str, text: str, follow_up_days: float, chase_message: str,
                       answer_shape: str = "free") -> Optional[int]:
    """Open a pending matter with a chase timer — the worker pursues it if silence (SPEC §3.1/§5.0)."""
    try:
        from datetime import datetime, timedelta, timezone

        import spine
        scope = _scope(phone)
        due = datetime.now(timezone.utc) + timedelta(days=max(0.02, float(follow_up_days or 3)))
        conts = [{"branch_id": "si_silencio", "trigger": "si no hay respuesta antes del plazo",
                  "action": {"class": "nudge", "sentence": chase_message or "Oye, ¿pudiste verlo? Sigo aquí para lo que necesites."}}]
        # money-shaped tab? (SPEC §3.1 — a money branch always escalates, never auto-fires a concession)
        money = bool(re.search(r"\d+[.,]?\d*\s*€|\bprecio|descuent|cr[eé]dito|rebaj|gratis|plazo|factura|\bpag(a|o|ar)",
                               (str(text) + " " + str(chase_message)).lower()))
        # the tab's watch-vector (§3.1) — embed what it's watching for, so an inbound message can be
        # matched to it (R3 attribution / T0). Fail-soft to no vector (FTS/recency still rank it).
        try:
            import rt_embed
            emb = await rt_embed.aembed(f"{kind or ''} {text} {chase_message or ''}".strip())
        except Exception:
            emb = None
        async with db.scoped_tx(scope) as con:
            await _ensure_scope(con, scope)
            eid, _ = await spine.append_event(con, scope, "tab.opened", "runtime", {"kind": kind, "text": text})
            _shape = answer_shape if answer_shape in ("yesno", "date", "quantity", "money", "free") else "free"
            loop_id = await con.fetchval(
                "insert into open_loop(scope,kind,text,contingencies,due_at,answer_shape,opened_by_event,money,emb) "
                "values($1::ltree,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
                scope, kind or "pending", text, conts, due, _shape, eid, money, emb)
            await con.execute(
                "insert into timer(scope,loop_id,fires_at,branch_id,armed_by_event) values($1::ltree,$2,$3,'si_silencio',$4)",
                scope, int(loop_id), due, eid)
        return int(loop_id)
    except Exception:
        log.exception("open_tab failed")
        return None


async def _do_resolve_tab(phone: str, tab_id: Optional[int]) -> bool:
    try:
        import spine
        scope = _scope(phone)
        async with db.scoped_tx(scope) as con:
            row = await con.fetchrow(
                "select id from open_loop where scope=$1::ltree and status='open'" +
                (" and id=$2" if tab_id else " order by opened_at desc limit 1"),
                *( (scope, int(tab_id)) if tab_id else (scope,) ))
            if not row:
                return False
            lid = int(row["id"])
            await con.execute("update open_loop set status='resolved', resolved_at=now() where id=$1", lid)
            await con.execute("update timer set state='cancelled' where loop_id=$1 and state='armed'", lid)
            await spine.append_event(con, scope, "tab.resolved", "runtime", {"loop_id": lid})
            # LEARN-FROM-CONFIRMATION (learn.py): an «aprender» tab resolving = the customer answered
            # what «X» meant — close the loop: reconcile writes the learned alias + learn.alias event.
            lrow = await con.fetchrow("select kind, text, resolution from open_loop where id=$1", lid)
        try:
            if lrow and (lrow["kind"] or "") == "aprender":
                import re as _re
                m = _re.search(r"«([^»]+)»", lrow["text"] or "")
                confirmed = (lrow["resolution"] or "").strip()
                if m and confirmed:
                    import learn as _learn
                    await _learn.reconcile(phone, m.group(1), confirmed)
        except Exception:
            log.debug("aprender reconcile fail-soft", exc_info=True)
        return True
    except Exception:
        log.exception("resolve_tab failed")
        return False


async def _do_update_tab(phone: str, tab_id: Optional[int], new_text: Optional[str] = None,
                         follow_up_days: Optional[float] = None) -> bool:
    """WP-6: update-in-place / RESCHEDULE an open tab (two of the nine tab actions) — the reality moved
    but the matter is still open, so amend its text and/or push its chase timer rather than churn a new
    tab. Keeps the arm-together invariant (the timer's branch stays; only fires_at moves)."""
    try:
        from datetime import datetime, timedelta, timezone

        import spine
        scope = _scope(phone)
        async with db.scoped_tx(scope) as con:
            row = await con.fetchrow(
                "select id from open_loop where scope=$1::ltree and status='open'" +
                (" and id=$2" if tab_id else " order by opened_at desc limit 1"),
                *((scope, int(tab_id)) if tab_id else (scope,)))
            if not row:
                return False
            lid = int(row["id"])
            if new_text:
                await con.execute("update open_loop set text=$2 where id=$1", lid, new_text)
            if follow_up_days is not None:
                due = datetime.now(timezone.utc) + timedelta(days=max(0.02, float(follow_up_days)))
                await con.execute("update open_loop set due_at=$2 where id=$1", lid, due)
                await con.execute("update timer set fires_at=$2 where loop_id=$1 and state='armed'", lid, due)
            await spine.append_event(con, scope, "tab.updated", "runtime",
                                     {"loop_id": lid, "new_text": bool(new_text), "rescheduled": follow_up_days is not None})
        return True
    except Exception:
        log.exception("update_tab failed")
        return False

CAL_URL = "https://cal.com/leo-casa/rocoto-alta"
SIGNUP_URL = "https://soyrocoto.com"
_LINKY = re.compile(r"https?://|wa\.me/|cal\.com|soyrocoto|\b\d+[.,]?\d*\s*€")
_CREATOR = {n.strip() for n in (config._env("ROCOTO_CREATOR_NUMBERS", "+12025550110")).split(",") if n.strip()}


def _digits(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())


def _lang(s: str) -> str:
    s = (s or "").lower()
    if re.search(r"[áéíóúñ¿¡]|\b(hola|quiero|pedido|gracias|vale|llámame|negocio|cuánto|cómo)\b", s):
        return "es"
    if re.search(r"\b(the|you|call me|hello|please|want|how much|thanks)\b", s):
        return "en"
    return "es"


async def _lookup_person(phone: str) -> dict:
    """Resolve who this is + their lifecycle stage from the existing tables (fail-soft)."""
    out: dict[str, Any] = {"phone": phone, "is_creator": phone in _CREATOR,
                           "name": "", "business": "", "stage": "unknown",
                           "has_booked_call": False, "took_demo": False}
    try:
        async with db.get_pool().acquire() as con:
            lead = await con.fetchrow(
                "select name, business, status, cal_booking_start from leads "
                "where phone=$1 and coalesce(is_test,false)=false order by created_at desc limit 1", phone)
            if lead:
                out["name"] = lead["name"] or ""
                out["business"] = lead["business"] or ""
                out["stage"] = lead["status"] or "unknown"
                out["has_booked_call"] = bool(lead["cal_booking_start"]) or lead["status"] in ("call_booked", "called", "done", "wizard_sent")
            demo = await con.fetchrow(
                "select name, business, summary, status from demo_leads where phone=$1 order by created_at desc limit 1", phone)
            if demo:
                out["took_demo"] = True
                out["name"] = out["name"] or (demo["name"] or "")
                out["business"] = out["business"] or (demo["business"] or "")
                out["demo_summary"] = demo["summary"] or ""
    except Exception:
        log.exception("agent_reply: lifecycle lookup failed for %s (fail-soft)", phone)
    return out


async def _memory_card(phone: str) -> str:
    """The runtime card for this person (what Rocoto has remembered). Fail-soft empty."""
    try:
        import memory  # noqa
        scope = tenancy.scope_of(phone)            # WP-A1
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'prospect',$2) on conflict do nothing",
                              scope, tenancy.tenant_of(scope))
            body = await con.fetchval("select body from card where scope=$1::ltree", scope)
            return body or ""
    except Exception:
        return ""


async def _business_name_for(tenant: str) -> str:
    """The supplier's own name, for anything a CUSTOMER reads.

    A receipt signed «rocoto» would tell a restaurant they are dealing with a software company
    instead of their fishmonger. Falls back to the slug — which is at least theirs — rather than to
    a brand name that is not."""
    try:
        async with db.get_pool().acquire() as con:
            r = await con.fetchrow("select name from tenants where slug=$1", tenant)
        return str((r and r["name"]) or "") or tenant
    except Exception:
        log.debug("business name read fail-soft for %s", tenant, exc_info=True)
        return tenant


async def _save_fact(phone: str, text: str, kind: str = "RELATION",
                     scope: Optional[str] = None, lineage: str = "live") -> None:
    try:
        import memory
        scope = scope or tenancy.scope_of(phone)   # WP-A1
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'prospect',$2) on conflict do nothing",
                              scope, tenancy.tenant_of(scope))
            await con.execute("insert into card(scope,body,version) values($1::ltree,'',0) on conflict do nothing", scope)
            await memory.write_fact(con, scope, kind, text)
            await memory.regen_card(con, scope, display_name="", tier="prospect")
    except Exception:
        log.exception("agent_reply: save_fact failed (fail-soft)")


# NOTE (convergence, WP2 part 4): a duplicate chat-persona builder lived here — a dead, broken copy of
# soul.assemble_soul (it read a SOUL attribute off voice_reply that never existed, and had ZERO callers:
# the prod mind gets its `system` solely from soul.assemble_soul via runtime.run_turn -> _run_mind).
# Deleted so soul.assemble_soul is the one and only chat-side persona builder (soul owns the voice one too).


async def _last_inbound_wamid(phone: str) -> str:
    """The wamid of the LATEST inbound customer message on this thread — the natural target of a
    reaction (you react to what was just said). Cloud-rail ids only (wamid.*; Twilio SIDs cannot be
    reacted to) and never a reaction row itself. Fail-soft to ''."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            return await con.fetchval(
                "select wa_message_id from whatsapp_messages where phone_number=$1 and role='user' "
                "and message_type <> 'reaction' and wa_message_id like 'wamid.%' "
                "order by created_at desc, id desc limit 1", phone) or ""
    except Exception:
        log.debug("_last_inbound_wamid fail-soft", exc_info=True)
        return ""


def _tools(tier: str = "", hooks_note: str = "") -> list[dict]:
    """The mind's hands. `tier` gates the L2 verbs: only the BOSS (or the creator) may write standing
    instructions or install a VIGILANCIA — a customer can never reach a tool that reconfigures the
    employee (SPEC §5.6: "tier-gated tools in the normal mind turn … customers can never reach them").
    The gate is STRUCTURAL: the tool is not in the customer's list at all, so there is nothing to
    refuse — which is why the vital asserts absence from the list, not a rejection at call time.

    `hooks_note` (BLOCK C) is the REAL hook menu for this world, introspected by `trackers.hooks` and
    spliced into `draft_tracker`'s description: the mind designs the watch out of events that actually
    exist here, instead of inventing an event type nothing will ever emit."""
    tools = [
        {"name": "place_call", "description": "Llama por teléfono a esta persona AHORA MISMO (tú, Rocoto). Para «llámame» o cuando una llamada inmediata es lo que toca. NO es agendar.",
         "input_schema": {"type": "object", "properties": {"motivo": {"type": "string"}}, "required": []}},
        {"name": "send_booking_link", "description": "Envía el enlace de la llamada de ALTA con PETER (fundador humano). ÚSALO SIEMPRE que menciones esa llamada o cuando pregunten cómo empezar / cómo hablar / cómo ponerlo en marcha — si nombras la llamada con Peter, MANDA el enlace en ese mismo turno, no solo la describas.",
         "input_schema": {"type": "object", "properties": {}, "required": []}},
        {"name": "send_signup_link", "description": "Envía el enlace para registrarse/empezar en soyrocoto.com (cuando ya quiere dar el paso).",
         "input_schema": {"type": "object", "properties": {}, "required": []}},
        {"name": "remember", "description": "Guarda un hecho importante sobre esta persona/su negocio para no hacerle repetir.",
         "input_schema": {"type": "object", "properties": {"hecho": {"type": "string"}}, "required": ["hecho"]}},
        {"name": "open_tab", "description": "Abre un ASUNTO PENDIENTE con seguimiento automático: algo que queda por cerrar (esperas su confirmación, prometiste mandarle algo, dijiste que le llamas otro día). Si no hay respuesta a tiempo, tú mismo le persigues. Úsalo siempre que dejes algo abierto.",
         "input_schema": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["question", "order", "issue", "pending", "expect"]}, "text": {"type": "string", "description": "qué queda pendiente"}, "follow_up_days": {"type": "number", "description": "días hasta perseguir si hay silencio"}, "chase_message": {"type": "string", "description": "qué le escribirás si no responde"}, "answer_shape": {"type": "string", "enum": ["yesno", "date", "quantity", "money", "free"], "description": "qué tipo de respuesta esperas (ayuda a reconocer cuando llega)"}}, "required": ["text", "follow_up_days", "chase_message"]}},
        {"name": "resolve_tab", "description": "Cierra un asunto pendiente que YA se ha resuelto (te confirmó, ya se hizo). Deja de perseguirlo.",
         "input_schema": {"type": "object", "properties": {"tab_id": {"type": "integer", "description": "el # del asunto (opcional; si no, cierra el más reciente)"}}, "required": []}},
        {"name": "update_tab", "description": "Actualiza un asunto abierto que SIGUE vigente pero cambió: corrige su texto y/o aplázalo (nuevo plazo). Cuando la realidad se movió pero el asunto NO está cerrado — no abras uno nuevo ni lo cierres.",
         "input_schema": {"type": "object", "properties": {"tab_id": {"type": "integer", "description": "el # del asunto (opcional; si no, el más reciente)"}, "new_text": {"type": "string", "description": "el texto corregido del asunto (opcional)"}, "follow_up_days": {"type": "number", "description": "nuevo plazo en días para perseguir (opcional)"}}, "required": []}},
        {"name": "send_email", "description": "Manda un email (por ejemplo un resumen, un presupuesto o una confirmación) cuando el email es el canal correcto.",
         "input_schema": {"type": "object", "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}}, "required": ["to", "subject", "body"]}},
        {"name": "escalate", "description": "Avisa a PETER (el jefe/fundador) de algo que necesita a un humano: una duda que no puedes resolver, un problema, una oportunidad importante. Se lo mandas por WhatsApp.",
         "input_schema": {"type": "object", "properties": {"reason": {"type": "string"}, "text": {"type": "string"}}, "required": ["text"]}},
        # THE «AUNQUE FALTEN DATOS» HALF is in the description on purpose (2026-08-10): this is the
        # text the mind reads at the moment it decides, and the measured failure was a JUDGEMENT one —
        # with a delivery-date question of its own still open it read the order as incomplete and
        # narrated an acknowledgement instead of filing. The standing LEY DEL PEDIDO in soul._HANDS
        # says the same thing; a law the mind meets twice, once where it decides, is the point.
        {"name": "take_order", "description": "Apunta un PEDIDO que te hace un cliente (lo que pide, en su lenguaje). Lo cuadras contra el catálogo y lo dejas listo — colocarlo de verdad lo aprueba el jefe (nunca lo colocas tú solo). ÚSALO EN CUANTO nombre producto y cantidad, AUNQUE FALTEN DATOS (la fecha de entrega, la dirección) y aunque tengas una pregunta tuya sin contestar: apuntas las líneas ahora y preguntas lo que falte en la misma respuesta. Sin esta herramienta el pedido no existe para nadie.",
         "input_schema": {"type": "object", "properties": {"items": {"type": "string", "description": "lo que pide, tal cual lo dijo"}}, "required": ["items"]}},
        {"name": "react", "description": "Reacciona con UN emoji al último mensaje de esta persona, como en WhatsApp (👍 conforme, ❤️ gracias, 😂…). Es un GESTO, no una respuesta: úsalo cuando un gesto suma (p. ej. 👍 al quedar apuntado un pedido) — no sustituye al texto cuando hay algo que contestar.",
         "input_schema": {"type": "object", "properties": {"emoji": {"type": "string", "description": "un solo emoji"}}, "required": ["emoji"]}},
        {"name": "ask_options", "description": "Haz una pregunta CERRADA con opciones que la persona TOCA en WhatsApp (un toque y contesta, sin escribir). Úsalo cuando la respuesta es una de pocas y elegir le AHORRA TIEMPO: qué día quiere la entrega, qué formato/caja, confirmar o cambiar un pedido, elegir una hora. NO lo uses para preguntas abiertas («¿qué necesitas?», «¿cómo va el negocio?», «¿cuántos kilos?») ni cuando la respuesta es libre — ahí escribe normal. Da entre 2 y 10 opciones, cortas y distintas entre sí. La pregunta SE ENVÍA ya con las opciones: no la repitas después en texto.",
         "input_schema": {"type": "object", "properties": {
             "pregunta": {"type": "string", "description": "la pregunta, tal cual se la harías"},
             "opciones": {"type": "array", "minItems": 2, "maxItems": 10,
                          "description": "entre 2 y 10 opciones para tocar",
                          "items": {"type": "object", "properties": {
                              "titulo": {"type": "string", "description": "la opción, corta y clara"},
                              "descripcion": {"type": "string", "description": "matiz opcional de una línea"}},
                              "required": ["titulo"]}}},
             "required": ["pregunta", "opciones"]}},
        {"name": "retrieve", "description": "Busca EN TU MEMORIA algo concreto que sabes que existe pero no tienes delante (un pedido raro de marzo, lo que os disteis por hablado el año pasado, una queja antigua). Úsalo SOLO cuando te falte un dato que crees recordar: escribe la consulta COMPLETA y sin pronombres («pedido anómalo marzo 2026 Bar Manolo»), no «aquello». Si no encuentra nada, dilo con naturalidad — nunca te lo inventes.",
         "input_schema": {"type": "object", "properties": {
             "consulta": {"type": "string", "description": "la búsqueda, completa y con nombres/fechas"},
             "cuantos": {"type": "integer", "description": "cuántos resultados quieres (por defecto 8, máximo 30)"}},
             "required": ["consulta"]}},
        # The delivery window (§5.8a). Defined in `brain/window.py` so the behaviour lives with the
        # store and the parse, and this file only has to hand it over. It is a CUSTOMER-tier verb on
        # purpose: the franja is a fact about them, and they are the ones who know it.
        window.TOOL,
        {"name": "send_image", "description": "Envía por WhatsApp una imagen o archivo que YA existe: una URL http(s) que aparezca literalmente en el contexto de esta conversación (una foto recibida, un documento generado). NUNCA inventes ni construyas una URL.",
         "input_schema": {"type": "object", "properties": {"url": {"type": "string", "description": "la URL exacta del contexto"}, "caption": {"type": "string", "description": "pie de foto opcional (sin precios fuera de tarifa)"}}, "required": ["url"]}},
    ]
    if tier in ("boss", "creator", "colleague"):
        tools.append(
            {"name": "teach_rule", "description": "Guarda una INSTRUCCIÓN PERMANENTE que te da tu jefe sobre cómo comportarte («a partir de ahora, con Manolo mano izquierda con los retrasos», «nunca cierres un pedido grande sin confirmarlo por escrito»). NO es un dato sobre el cliente (eso es remember): es una REGLA sobre TI, y la tendrás delante en cada conversación con esa persona hasta que él la retire. Repítesela con tus palabras al guardarla para que compruebe que la has entendido.",
             "input_schema": {"type": "object", "properties": {
                 "regla": {"type": "string", "description": "la instrucción, tal cual la vas a recordar"},
                 "obligatoria": {"type": "boolean", "description": "true si es innegociable (nunca se recorta del contexto)"}},
                 "required": ["regla"]}})
    if tier in ("boss", "creator"):
        # BLOCK C — VIGILANCIAS/TRACKERS (SPEC §5.6): the boss builds a standing watch BY TALKING.
        # Two verbs, deliberately: DRAFT (understand + play back, as many turns as it takes) and
        # CREATE (install the row once he confirms). The draft lives on a creation TAB, so the session
        # survives across turns and days with no mode flag anywhere.
        tools.append(
            {"name": "draft_tracker",
             "description": (
                 "APUNTA/ACTUALIZA el borrador de una VIGILANCIA que tu jefe te está pidiendo «vigílame "
                 "el precio del aguacate», «cada lunes repásame los clientes que llevan 2 semanas sin "
                 "pedir», «avísame si un cliente se queja». Úsalo EN CUANTO entiendas algo del encargo, "
                 "y otra vez cada vez que él lo matice: abre (o actualiza) la sesión de creación y te "
                 "devuelve tu propio resumen para que se lo LEAS y él lo confirme o lo corrija. NO "
                 "instala nada todavía.\n" + (hooks_note or "")),
             "input_schema": {"type": "object", "properties": {
                 "titulo": {"type": "string", "description": "cómo se llamará la vigilancia, en corto"},
                 "gancho": {"type": "string", "description": "el EVENTO que la dispara, exactamente uno de los ganchos disponibles (vacío si es solo por cadencia)"},
                 "cada": {"type": "string", "description": "cada cuánto se repite (p. ej. 7d, 1d, 2h). Vacío = salta una vez con el gancho"},
                 "condicion": {"type": "object", "description": "opcional: pares campo=valor que deben cumplirse en el evento"},
                 "ambito": {"type": "string", "description": "opcional: el ámbito donde vive la vigilancia (por defecto, todo el negocio)"},
                 "aviso": {"type": "string", "description": "LA FRASE EXACTA que le dirás cuando salte (te la lee él, escríbela lista para enviar)"}},
                 "required": []}})
        tools.append(
            {"name": "create_tracker",
             "description": (
                 "INSTALA la vigilancia que acabáis de acordar — solo cuando él te la ha CONFIRMADO. "
                 "Escribe la regla y queda funcionando sola desde ese momento; la sesión de creación se "
                 "cierra al instalarla. Si algo falta te lo dirá y NO se instalará: pregúntaselo y "
                 "vuelve a intentarlo."),
             "input_schema": {"type": "object", "properties": {
                 "confirmado": {"type": "boolean", "description": "true solo si él te lo ha confirmado en este hilo"}},
                 "required": ["confirmado"]}})
    return tools


async def agentic_reply(phone: str, message: str, history: Optional[list[dict]] = None,
                        place_call_fn: Optional[Callable] = None,
                        perception_note: Optional[str] = None) -> dict[str, Any]:
    """BACK-COMPAT shim → the event-sourced cycle. Every caller (the WhatsApp send layer, the persona
    console, the tests) now goes through runtime.run_turn: the inbound is appended as an event, the mind
    decides from the assembled FOLD (not legacy tables), and every action + the reply are appended as
    events. `history` is ignored — the conversation is reconstructed from the event window."""
    import runtime
    return await runtime.run_turn(phone, message, place_call_fn=place_call_fn,
                                  perception_note=perception_note)


async def _run_mind(phone: str, system: str, msgs: list[dict], person: dict, lang: str,
                    place_call_fn: Optional[Callable] = None, egress_stub: bool = False,
                    tier: str = "", hooks_note: str = "", scope: Optional[str] = None) -> dict[str, Any]:
    """Thin wrapper around `_run_mind_impl`: pins `_SCOPE_OVERRIDE` for the duration of this ONE turn
    when the caller passes `scope` (runtime.run_turn's `scope_override`, e.g. the persona console or
    WP-E's try-chat widget) — see the module docstring note above `_SCOPE_OVERRIDE` for why this
    exists. `scope=None` (the live WhatsApp path) leaves the contextvar untouched: byte-identical to
    before this wrapper existed."""
    token = _SCOPE_OVERRIDE.set(scope) if scope else None
    try:
        return await _run_mind_impl(phone, system, msgs, person, lang, place_call_fn,
                                    egress_stub=egress_stub, tier=tier, hooks_note=hooks_note)
    finally:
        if token is not None:
            _SCOPE_OVERRIDE.reset(token)


async def _run_mind_impl(phone: str, system: str, msgs: list[dict], person: dict, lang: str,
                    place_call_fn: Optional[Callable] = None, egress_stub: bool = False,
                    tier: str = "", hooks_note: str = "") -> dict[str, Any]:
    """④ THE MIND — one reply call over the ASSEMBLED context (passed in as `system` + `msgs`), with
    hands. Returns {text, force_text, actions, pending_facts, reasoning}. No persistence here — the
    caller (runtime.run_turn) appends the events + saves the fact candidates.

    `egress_stub=True` (the §13 persona console / CSO #2 sandbox): NOTHING leaves to a real person — the
    real-egress hands (send_email, escalate) are recorded as would-do actions but never executed. Call
    dialing is already stubbed via `place_call_fn`.

    Every scope this function's tool loop touches goes through the module-level `_scope(phone)` — which
    resolves to `_SCOPE_OVERRIDE` when the `_run_mind` wrapper above has pinned one for this turn, and
    to the plain `wa.<digits(phone)>` otherwise. This function never reads `scope` directly; that is
    what keeps this rename a pure no-op for the live WhatsApp path."""
    place = place_call_fn or demo_call.place_call_to
    client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=40.0)
    actions: list[dict] = []
    force_text = False
    text = ""
    pending_facts: list[str] = []
    # §5.8a's OTHER HALF (2026-08-10) — see review.claims_filing_without_one for the measured bug.
    # `inbound` is what the customer actually just said; the check reads it as well as the reply,
    # because «Perfecto, apuntado» on its own is not order-shaped and the lines may live only in the
    # message being answered. It is the LAST plain-string user turn, which is exactly what
    # runtime.run_turn appends for the burst.
    inbound = next((m["content"] for m in reversed(msgs)
                    if m.get("role") == "user" and isinstance(m.get("content"), str)), "")
    claim_caught = False        # the contradiction fired at least once this turn
    claim_corrected = False     # …and the sentence had to be replaced deterministically
    try:
        for _ in range(4):
            resp = await client.messages.create(
                model=config.VOICE_CHAT_MODEL, max_tokens=600, system=system,
                tools=_tools(tier, hooks_note), messages=msgs)
            tools_used = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
            # KEEP THE LAST THING IT ACTUALLY SAID — never overwrite real words with silence.
            # This line used to assign `text` unconditionally, so a turn that spoke and THEN called a
            # tool had its sentence destroyed by the next turn's empty text block: the loop ended with
            # text="" and the caller fell through to the generic «Recibido / Hecho, queda anotado»
            # fallback. That is why the runtime appeared to answer every message with the same canned
            # line while the logs showed the model returning 200 OK with real content — the content was
            # being thrown away right here (Peter, 2026-07-28: "it says the hecho thing to everything",
            # "keeps saying recibido", "it asked questions but no confirmation").
            turn_text = "".join(getattr(b, "text", "") for b in resp.content
                                if getattr(b, "type", None) == "text").strip()
            if turn_text:
                text = turn_text
            if not tools_used:
                # THE CONTRADICTION CHECK (§5.8a, 2026-08-10). The mind is about to hand back a
                # sentence telling a customer their order is recorded, having recorded nothing. It
                # still has its hands on the table, so the cheapest and most honest fix is to say so
                # and let it decide: file the order, or stop claiming it did. ONE re-prompt per turn
                # — a second would be arguing with it — and only on the CUSTOMER tier, the one
                # relationship where an inbound message IS an order (a boss saying «anotado» about
                # 3 cajas of stock must never be pushed toward filing a customer order).
                if (tier == "customer" and not claim_caught
                        and review.claims_filing_without_one(text, actions, inbound=inbound)):
                    claim_caught = True
                    log.warning("§5.8a claim-without-filing caught; re-prompting the mind once")
                    msgs.append({"role": "assistant", "content": [{"type": "text", "text": text}]})
                    msgs.append({"role": "user", "content": review.CONTRADICTION_NOTE})
                    text = ""   # the corrected pass writes the sentence that ships
                    continue
                break
            msgs.append({"role": "assistant", "content": resp.content})
            results = []
            for tu in tools_used:
                nm, inp = tu.name, (tu.input or {})
                if nm == "place_call":
                    try:
                        r = await place(phone, lang, person.get("name", ""))
                        actions.append({"place_call": r})
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "content": "Llamada iniciada — está sonando ahora mismo."})
                    except Exception as e:  # noqa: BLE001
                        log.warning("place_call failed: %s", e)
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": f"No pude llamar ({e}). Ofrécete a intentarlo de nuevo o a agendar."})
                elif nm == "send_booking_link":
                    force_text = True
                    actions.append({"send_booking_link": CAL_URL})
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": f"Enlace de alta con Peter listo (en texto): {CAL_URL}"})
                elif nm == "send_signup_link":
                    force_text = True
                    actions.append({"send_signup_link": SIGNUP_URL})
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": f"Enlace de registro listo (en texto): {SIGNUP_URL}"})
                elif nm == "remember":
                    fact = (inp.get("hecho") or "").strip()
                    if fact:
                        pending_facts.append(fact)
                        actions.append({"remember": fact})
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": "Guardado."})
                elif nm == "open_tab":
                    lid = await _do_open_tab(phone, inp.get("kind", "pending"), inp.get("text", ""),
                                             inp.get("follow_up_days", 3), inp.get("chase_message", ""),
                                             inp.get("answer_shape", "free"))
                    actions.append({"open_tab": lid})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": (f"Asunto abierto (#{lid}); si no hay respuesta a tiempo, le persigo yo."
                                                if lid else "No pude abrir el asunto ahora.")})
                elif nm == "resolve_tab":
                    ok = await _do_resolve_tab(phone, inp.get("tab_id"))
                    actions.append({"resolve_tab": ok})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": "Asunto cerrado." if ok else "No había asunto abierto que cerrar."})
                elif nm == "update_tab":
                    ok = await _do_update_tab(phone, inp.get("tab_id"), inp.get("new_text"), inp.get("follow_up_days"))
                    actions.append({"update_tab": ok})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": "Asunto actualizado." if ok else "No había asunto abierto que actualizar."})
                elif nm == "send_email":
                    sent = False
                    if egress_stub:
                        sent = True  # sandbox: pretend it sent, never touch Resend
                    else:
                        try:
                            import actions as rt_actions
                            sent = await rt_actions.send_email(inp.get("to", ""), inp.get("subject", ""),
                                                               (inp.get("body", "") or "").replace("\n", "<br>"))
                        except Exception:
                            log.exception("send_email tool failed")
                    force_text = True
                    actions.append({"send_email": {"to": inp.get("to"), "ok": bool(sent)}})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": "Email enviado." if sent else "No pude enviar el email."})
                elif nm == "escalate":
                    ok = False
                    if egress_stub:
                        ok = True  # sandbox: pretend Peter was notified, never send the real WhatsApp
                    else:
                        try:
                            import actions as rt_actions
                            boss = next(iter(_CREATOR), None)
                            async with db.scoped_tx(_scope(phone)) as con:
                                await _ensure_scope(con, _scope(phone))
                                await rt_actions.escalate(con, _scope(phone), "boss", inp.get("reason", ""),
                                                          inp.get("text", ""), boss_wa=boss)
                            ok = True
                        except Exception:
                            log.exception("escalate tool failed")
                    actions.append({"escalate": ok})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": "Avisé a Peter." if ok else "No pude avisar a Peter ahora."})
                elif nm == "take_order":
                    try:
                        import orders_tool
                        draft = await orders_tool.draft_order(_scope(phone), inp.get("items", ""))
                        # PLACING IS GATED AGENCY (§0/§5.0.1) — and the supplier owns the gate.
                        # `approve` was asked at setup («¿ves tú cada pedido antes de que salga?»)
                        # and had ZERO readers until now: every supplier got `review` whether they
                        # chose it or not. `review` stays the default and the fail-soft answer,
                        # because the wrong direction of this error is an order leaving without the
                        # boss ever seeing it.
                        _auto = False
                        try:
                            import behaviour as _bhv
                            import tenancy as _tn
                            _auto = (await _bhv.get(_tn.tenant_of(_scope(phone)))).get("approve") == "auto"
                        except Exception:
                            log.debug("take_order: approve setting unavailable — reviewing", exc_info=True)
                        await orders_tool.place_order(_scope(phone), draft, approved=_auto)

                        # ── THE RECEIPT THE CUSTOMER ACTUALLY GETS (wired 2026-08-19) ──────────
                        # Peter: «no enviaron la confirmación. La misma experiencia que personas
                        # tienen en WhatsApp, con botones en mensajes para responder a cosas y con
                        # imágenes con confirmaciones de orden. Eso no estaba sucediendo.»
                        #
                        # `order_receipt` was written and CALLED BY NOTHING — a complete module
                        # with no caller is the same species as a setting with no reader, and it
                        # is why the confirmation still was not happening after it was «built».
                        # This is the moment it belongs to: the order is filed, so there is
                        # something true to acknowledge.
                        #
                        # It says «recibido», never «confirmado» — `order_receipt` takes that
                        # sentence from `market_voice`'s own constant rather than retyping it, so
                        # Raquel's rule cannot drift in one of two places. Fail-soft: a receipt
                        # that cannot go leaves the order exactly where it is.
                        try:
                            import order_receipt as _rcpt
                            import tenancy as _tn2
                            _sc = _scope(phone)
                            _tenant = _tn2.tenant_of(_sc)
                            _biz = await _business_name_for(_tenant)
                            await _rcpt.send_for_order(
                                _sc, business_name=_biz, lines=(draft or {}).get("lines"),
                                customer_name=(draft or {}).get("customer_name") or "",
                                delivery_date=(draft or {}).get("delivery_date"),
                                order_id=str((draft or {}).get("id") or ""), tenant=_tenant)
                        except Exception:
                            log.exception("take_order: the receipt could not go (order stands)")
                        # the tap's missing half (§5.7 / BUILD-CONCERNS #12): if this grounding
                        # landed on a sku an OPEN QUESTION offered, the free-text answer stops
                        # being a guess — retire the ask and learn the alias. Fail-soft.
                        #
                        # THE TENANT IS THE SCOPE'S, never `config.BRAIN_TENANT` (2026-08-10). It was
                        # the fallback, four lines above a sibling read that already resolves it
                        # properly — so on a multi-tenant box the alias a customer taught landed in
                        # the deployment's default tenant, where the matcher that needs it never
                        # looks. /demo is where this became visible: every session is its own tenant,
                        # so «it learns» was measurably false there.
                        try:
                            import tenancy as _tn
                            from brain import pipeline as _pl
                            await _pl.close_ask_from_grounding(phone, draft.get("lines", []),
                                                               _tn.tenant_of(_scope(phone)))
                        except Exception:
                            log.debug("close_ask_from_grounding fail-soft", exc_info=True)
                        nl = len(draft.get("lines", []))
                        unm = len(draft.get("unmatched", []))
                        actions.append({"take_order": {"lines": nl, "unmatched": unm}})
                        # ACKNOWLEDGED, NEVER CONFIRMED (SPEC §5.8a, 2026-07-26). This tool result used
                        # to open «Pedido apuntado …» and end «Confírmalo con naturalidad al cliente» —
                        # and the mind, correctly, echoed both. But `place_order(approved=False)` PARKS
                        # it: nothing is placed until the boss says so, so telling the customer it is
                        # done is a promise we have not got. The vocabulary matters as much as the
                        # instruction — a mind handed «apuntado» writes «apuntado» — so the words this
                        # sentence must not produce do not appear in it except as prohibitions.
                        #
                        # §17.56 Q3 — `behaviour.offsku` shapes what the MOUTH does with the unmatched
                        # tail. This is deliberately the mouth layer and nothing deeper: the lines
                        # still park exactly as above under every posture (the write-down is not
                        # optional; only what is SAID about it is), and every alternative offered is a
                        # real catalogue row from the matcher — never an invented SKU, never an
                        # invented price (orders_tool's §4.3 law reaches the suggestion too).
                        #   'review' (default) → the sentence above, byte-identical to before.
                        #   'open'   → name the nearest real alternative(s) and tell the mind to OFFER.
                        #   'reject' → tell the mind to say plainly, politely, that it is not carried.
                        offsku_note = ""
                        if unm:
                            try:
                                import behaviour as _behaviour
                                import tenancy as _tenancy
                                _offsku = (await _behaviour.get(
                                    _tenancy.tenant_of(_scope(phone)))).get("offsku") or "review"
                            except Exception:
                                _offsku = "review"   # fail-soft to today's posture
                            if _offsku == "open":
                                try:
                                    alts = await orders_tool.suggest_alternatives(
                                        _scope(phone), draft.get("unmatched", []))
                                except Exception:
                                    log.debug("offsku alternatives fail-soft", exc_info=True)
                                    alts = []
                                offers = "; ".join(
                                    f"«{a['mention']}» → " + " o ".join(f"«{c['name']}»" for c in a["candidates"])
                                    for a in alts if a.get("candidates"))
                                if offers:
                                    offsku_note = (" Lo que no está en catálogo, OFRÉCELE la alternativa "
                                                   "más parecida DEL CATÁLOGO por su nombre exacto y "
                                                   "pregúntale si le vale: " + offers + ". No inventes "
                                                   "productos ni precios que no estén en esas filas.")
                            elif _offsku == "reject":
                                nombres = ", ".join(f"«{u.get('mention')}»"
                                                    for u in draft.get("unmatched", [])[:4]
                                                    if u.get("mention"))
                                offsku_note = (" Lo que no está en catálogo NO se trabaja: dile con "
                                               "claridad y buena educación que "
                                               + (f"{nombres} no lo lleváis" if nombres else "eso no lo lleváis")
                                               + ", sin ofrecer sustitutos y sin inventar nada.")
                        results.append({"type": "tool_result", "tool_use_id": tu.id,
                                        "content": (f"Tengo el pedido delante ({nl} línea(s)"
                                                    + (f", {unm} sin encontrar en catálogo" if unm else "")
                                                    + "), pendiente del visto bueno del jefe. ACUSA RECIBO al "
                                                      "cliente («recibido — déjame que lo confirme y te digo "
                                                      "enseguida») y no se lo des por hecho: nada de «listo», "
                                                      "«apuntado» ni «anotado» mientras el jefe no lo confirme."
                                                    + offsku_note)})
                    except Exception as e:  # noqa: BLE001
                        log.exception("take_order failed")
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": f"No pude apuntar el pedido ({e})."})
                elif nm == "retrieve":
                    # SPEC §4.5 ④ — the KNOWN-UNKNOWN path: the mind widens its own memory search when
                    # the θ-floored pre-pass didn't surface something it believes exists. Deterministic
                    # given the query string (the model's DECISION to call is the one non-deterministic
                    # hinge); k <= 30 per §4.4. A CHAT-lane mechanism only — on a live call the §7
                    # answer-first/check-aside protocol replaces it.
                    q = (inp.get("consulta") or inp.get("query") or "").strip()
                    kk = max(1, min(int(inp.get("cuantos") or 8), 30))
                    hits = []
                    if q:
                        try:
                            import memory as _mem
                            async with db.scoped_tx(_scope(phone)) as con:
                                hits = await _mem.search(con, _scope(phone), q, k=kk)
                        except Exception:
                            log.exception("retrieve tool failed")
                    actions.append({"retrieve": {"q": q, "n": len(hits)}})
                    body = "\n".join(f"- [{h.get('shelf')}] {h.get('text')}" for h in hits)
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": (f"{len(hits)} resultado(s):\n{body}" if hits else
                                                "Nada en la memoria para esa búsqueda. Dilo con "
                                                "naturalidad — NO te lo inventes.")})
                elif nm == "teach_rule":
                    # L2 STANDING INSTRUCTION (SPEC §16.2/§5.6) — reachable only from a boss/creator
                    # turn (the tool isn't in a customer's set at all, so this is a second lock, not
                    # the only one).
                    rule = (inp.get("regla") or inp.get("rule") or "").strip()
                    ok_rule = False
                    if rule:
                        try:
                            import install as _install
                            r = await _install.teach_instruction_scoped(
                                _scope(phone), rule, binding=bool(inp.get("obligatoria")))
                            ok_rule = bool(r.get("ok"))
                        except Exception:
                            log.exception("teach_rule tool failed")
                    actions.append({"teach_rule": {"rule": rule[:200], "ok": ok_rule}})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": ("Instrucción permanente guardada — la tendré delante "
                                                "en cada conversación aquí." if ok_rule else
                                                "No pude guardar la instrucción ahora.")})
                elif nm == "draft_tracker":
                    # BLOCK C (SPEC §5.6) — the DRAFT half of routines-by-talking. It opens (or resumes)
                    # the creation TAB and re-renders the playback onto it; the tool result IS the
                    # playback, so the mind reads its own understanding back to the boss instead of
                    # paraphrasing a schema. Reachable only from a boss/creator turn (tier-gated set).
                    draft = {"title": inp.get("titulo") or inp.get("title") or "",
                             "hook": inp.get("gancho") or inp.get("hook") or "",
                             "every": inp.get("cada") or inp.get("every") or "",
                             "when": inp.get("condicion") if isinstance(inp.get("condicion"), dict) else None,
                             "scope": inp.get("ambito") or "",
                             "say": inp.get("aviso") or inp.get("say") or ""}
                    r_draft = {"ok": False}
                    try:
                        import trackers as _trackers
                        r_draft = await _trackers.update_draft(_scope(phone), draft)
                    except Exception:
                        log.exception("draft_tracker tool failed")
                    actions.append({"draft_tracker": {"ok": bool(r_draft.get("ok")),
                                                      "loop_id": r_draft.get("loop_id")}})
                    if r_draft.get("ok"):
                        gaps = r_draft.get("missing") or []
                        content = ("Borrador de la vigilancia, tal y como lo he entendido:\n"
                                   + str(r_draft.get("playback"))
                                   + ("\nTe falta acordar con él: " + ", ".join(gaps) +
                                      ". Pregúntaselo con naturalidad." if gaps else
                                      "\nEstá completo: LÉESELO tal cual y, si te lo confirma, "
                                      "instálalo con create_tracker."))
                    else:
                        content = "No pude apuntar el borrador ahora. Dile que lo reintentas."
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": content})
                elif nm == "create_tracker":
                    # …and the INSTALL half: the draft on the tab becomes a manifest_duty ROW, and the
                    # creation tab resolves itself with that row as its resolution (§5.6). An
                    # incomplete draft is REFUSED with what is missing — never a half-installed watch.
                    r_new = {"ok": False, "reason": "no_session"}
                    try:
                        import trackers as _trackers
                        sc = _scope(phone)
                        sess = await _trackers.session(sc)
                        if sess is None:
                            r_new = {"ok": False, "reason": "no_session"}
                        else:
                            r_new = await _trackers.create(sc, sess["draft"], source="user",
                                                           loop_id=sess["loop_id"])
                    except Exception:
                        log.exception("create_tracker tool failed")
                        r_new = {"ok": False, "reason": "error"}
                    actions.append({"create_tracker": {k: r_new.get(k) for k in
                                                       ("ok", "name", "scope", "reason")}})
                    if r_new.get("ok"):
                        content = (f"Vigilancia instalada y funcionando: {r_new.get('playback')}. "
                                   "Ya está en su lista de Trackers; dile en una frase que queda activa.")
                    elif r_new.get("reason") == "incomplete":
                        content = ("Todavía no puedo instalarla, falta: "
                                   + ", ".join(r_new.get("missing") or []) + ". Pregúntaselo.")
                    elif r_new.get("reason") == "no_session":
                        content = ("No hay ninguna vigilancia en borrador. Usa antes draft_tracker con "
                                   "lo que te ha pedido.")
                    else:
                        content = "No pude instalarla ahora mismo. No le prometas que está activa."
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": content})
                elif nm == "react":
                    # presence suite (2026-07-25): a WhatsApp reaction on the customer's last message.
                    # GATE-EXEMPT (no money rides an emoji) but evented msg.sent kind=reaction inside
                    # actions.send_reaction_as_rocoto. Cloud rail only (wamid targets).
                    # 2026-07-26: the call returns a TYPED verdict — a stale/unknown target is refused
                    # pre-flight, so the mind is told "no" instead of believing a gesture landed.
                    emo = (inp.get("emoji") or "").strip()
                    r_react = {"ok": False, "sid": None, "reason": "no_emoji"}
                    if emo:
                        if egress_stub:
                            # sandbox: record the would-do gesture, never hit Meta
                            r_react = {"ok": True, "sid": "SANDBOX-react", "reason": "sandbox"}
                        else:
                            try:
                                import actions as rt_actions
                                target = await _last_inbound_wamid(phone)
                                if not target:
                                    r_react = {"ok": False, "sid": None, "reason": "no_reactable_message"}
                                else:
                                    async with db.scoped_tx(_scope(phone)) as con:
                                        await _ensure_scope(con, _scope(phone))
                                        r_react = await rt_actions.send_reaction_as_rocoto(
                                            _scope(phone), target, emo, con=con)
                            except Exception:
                                log.exception("react tool failed")
                                r_react = {"ok": False, "sid": None, "reason": "exception"}
                    ok_react = bool(r_react.get("ok"))
                    actions.append({"react": {"emoji": emo, "ok": ok_react,
                                              "reason": r_react.get("reason", "")}})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": ("Reacción enviada." if ok_react else
                                                "No pude reaccionar a ese mensaje — si hay algo que decir, dilo en texto.")})
                elif nm == "ask_options":
                    # ONE-TAP (2026-07-26): the mind supplies a QUESTION + 2..10 options; the code
                    # picks buttons (≤3) vs a list (>3) — Meta's UI limits are never the mind's
                    # problem. The body is money-gated inside actions.send_interactive_as_rocoto
                    # (a price on a button is still a quote → parks), evented msg.sent
                    # kind=interactive WITH the option set, and projected into the thread.
                    q = (inp.get("pregunta") or inp.get("question") or "").strip()
                    opts: list[dict] = []
                    for o in (inp.get("opciones") or inp.get("options") or []):
                        if isinstance(o, str):
                            o = {"titulo": o}
                        if not isinstance(o, dict):
                            continue
                        t = (o.get("titulo") or o.get("title") or "").strip()
                        if not t:
                            continue
                        d = (o.get("descripcion") or o.get("description") or "").strip()
                        opts.append({"title": t, "description": d} if d else {"title": t})
                    if not q or len(opts) < 2:
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": "Necesito una pregunta y al menos 2 opciones. Si la respuesta es abierta, pregúntalo en texto normal."})
                    elif len(opts) > 10:
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": "Son demasiadas opciones (máximo 10). Acota la pregunta."})
                    else:
                        res: dict = {}
                        if egress_stub:
                            res = {"ok": True, "sid": "SANDBOX-interactive",
                                   "kind": "button" if len(opts) <= 3 else "list", "parked": False}
                        else:
                            try:
                                import actions as rt_actions
                                res = await rt_actions.send_interactive_as_rocoto(_scope(phone), q, opts)
                            except Exception:
                                log.exception("ask_options tool failed")
                                res = {"ok": False, "reason": "send_failed"}
                        actions.append({"ask_options": {"question": q, "n": len(opts),
                                                        "kind": res.get("kind"), "ok": bool(res.get("ok"))}})
                        if res.get("ok"):
                            # THE REVIEW CLOCK (BLOCK D · SPEC §5.8 source 3). A question that WENT OUT
                            # starts the silence window: the sense opens the `question_timeout` tab and
                            # arms its timer. If the customer answers, the tab resolves and the human
                            # never sees it; if they go quiet, the timer parks it in review. The window,
                            # the tone and who it applies to are all in the ROW — this is one sense.
                            try:
                                import review as _review
                                await _review.on_question_asked(
                                    _scope(phone), q,
                                    str(res.get("sid") or "") or f"{tu.id}", tier=tier)
                            except Exception:
                                log.debug("review clock fail-soft", exc_info=True)
                            results.append({"type": "tool_result", "tool_use_id": tu.id,
                                            "content": ("Pregunta enviada con las opciones para tocar ("
                                                        + ", ".join(o["title"] for o in opts)
                                                        + "). YA está dicha: no la repitas en texto; calla o añade como mucho una frase corta que no sea la misma pregunta.")})
                        elif res.get("parked"):
                            results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                            "content": "Esa pregunta lleva un precio/concesión — eso lo aprueba Peter. Pregunta sin el precio."})
                        else:
                            results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                            "content": "No pude mandar las opciones — pregúntaselo en texto normal."})
                elif nm == "set_delivery_window":
                    # THE TENANT COMES FROM THE SCOPE, NEVER FROM THE DEPLOYMENT (2026-08-16). This
                    # read `tenant=config.BRAIN_TENANT`, which is the same defect the alias branch
                    # above already carries a comment about: on a multi-tenant box every customer's
                    # receiving hours were looked up in the deployment's default tenant, so anyone
                    # who is not BRAIN_TENANT was told «No tengo aún la ficha de este cliente» while
                    # their profile sat in their own tenant. Live for every paying customer but one.
                    r = await window.handle_tool(phone, inp,
                                                 tenant=tenancy.tenant_of(_scope(phone)))
                    if r.get("ok"):
                        actions.append({"set_delivery_window": r.get("label", "")})
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "is_error": not r.get("ok"), "content": r["tool_result"]})
                elif nm == "send_image":
                    # presence suite (2026-07-25): outbound media on the cloud rail. The URL must be a
                    # real http(s) one from the fold; a caption quoting money still goes THROUGH THE GATE
                    # (a price on a photo is a quote like any other — refuse and let the mind rephrase).
                    murl = (inp.get("url") or "").strip()
                    mcap = (inp.get("caption") or "").strip()
                    if not murl.lower().startswith(("http://", "https://")):
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": "Solo puedo enviar una URL http(s) real que esté en el contexto."})
                    elif mcap and gate.check_outbound(mcap).get("needs_approval"):
                        results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                        "content": "Ese pie de foto lleva un precio/concesión — eso lo aprueba Peter. Envíala sin el precio o consulta antes."})
                    else:
                        sid_m = None
                        if egress_stub:
                            sid_m = "SANDBOX-media"  # sandbox: never touch the rail
                        else:
                            try:
                                import actions as rt_actions
                                sid_m = await rt_actions.send_whatsapp_as_rocoto(
                                    _scope(phone), mcap, media_url=murl)
                            except Exception:
                                log.exception("send_image tool failed")
                        actions.append({"send_image": {"url": murl, "ok": bool(sid_m)}})
                        results.append({"type": "tool_result", "tool_use_id": tu.id,
                                        "content": ("Imagen enviada." if sid_m else
                                                    "No pude enviarla ahora — sigue en texto.")})
            msgs.append({"role": "user", "content": results})
    except Exception:
        log.exception("agent_reply: agentic loop failed (fail-soft)")
    finally:
        try:
            await client.close()
        except Exception:
            pass

    # ── THE BRACES (§5.8a, 2026-08-10) ───────────────────────────────────────────────────────────
    # The re-prompt above is the belt and it is the one that fixes the product: the mind files the
    # order and the sentence becomes true. This is what happens when it does not — the mind insisted,
    # or the loop ran out of passes, or the whole agentic block fell into its fail-soft handler with a
    # claim already in `text`. At that point the sentence is a PROVABLE LIE to a customer: it says a
    # thing is recorded and the turn recorded nothing. There is no version of shipping it that is
    # right, so it is REPLACED — the same move the money gate makes ten lines below, for the same
    # reason. What replaces it is the §5.8a acknowledgement, which is simply what is true.
    _filed = any(review.FILING_ACTION in a for a in actions)
    if tier == "customer" and review.claims_filing_without_one(text, actions, inbound=inbound):
        log.error("§5.8a claim-without-filing SURVIVED the correction — replacing the sentence "
                  "(text=%r actions=%s)", (text or "")[:160], [list(a)[0] for a in actions])
        text = review.honest_ack(lang)
        claim_corrected = True
    elif claim_caught and not text and not _filed:
        # the corrected pass went silent. The generic empty-text fallback below would answer a real
        # order message with «Perdona, ¿me lo repites?» — this turn knows better than that.
        text = review.honest_ack(lang)
        claim_corrected = True
    # ONE marker per turn, so this is countable on the spine (`action.claim_without_filing`) instead
    # of living in a log nobody greps. `filed` is the outcome that matters: True means the re-prompt
    # worked and the order is real.
    if claim_caught or claim_corrected:
        actions.append({"claim_without_filing": {"filed": _filed, "rewritten": claim_corrected}})

    # outbound gate — a CONCRETE money concession (a number/discount/credit grant) never ships; the
    # persona already refuses, this is the backstop. Deliberately narrow so ordinary sales talk
    # («te hago un precio a medida», «depende de lo que vendas») is NOT nuked — only an actual grant.
    # WP-8 (eng-review HIGH): thread the scope's keyed standing prices so a BARE off-book quote gates too
    # (not only a concession verb). Fail-soft to no prices.
    _sp: list = []
    if text:
        try:
            async with db.scoped_tx(_scope(phone)) as con:
                _sp = await gate.standing_prices(con, _scope(phone))
        except Exception:
            _sp = []
    if text and gate.check_outbound(text, _sp).get("needs_approval") and \
            re.search(r"\d|descuento|mitad|gratis|rebaj|\bfi[ao]\b|cr[eé]dito|plazo", text.lower()):
        # PARK it (SPEC §5/§15.8) — a money concession is a GATED action Peter approves on the review
        # sheet, not merely a softened sentence. Record the drafted concession as action.pending.
        try:
            async with db.scoped_tx(_scope(phone)) as con:
                await _ensure_scope(con, _scope(phone))
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,money) "
                    "values($1::ltree,'concession',$2,'pending','money_concession',true,true)",
                    _scope(phone), {"draft": text[:600]})
        except Exception:
            log.debug("gate park fail-soft", exc_info=True)
        text = ("Para precios o descuentos lo confirmo con Peter y te digo — no te lo puedo cerrar yo aquí."
                if lang == "es" else
                "For prices or discounts I'll check with Peter and get back to you — I can't close that myself.")

    if not text and any((a.get("ask_options") or {}).get("ok") for a in actions if "ask_options" in a):
        pass  # the QUESTION already went out as the interactive message — a trailing "hecho" would
        # be a second, dumber message right under it. Silence here is the correct behaviour, and the
        # only exception to the speak-after-acting rule (the mouth did speak; it spoke with buttons).
    elif not text:
        # The mind must always SPEAK — silence after acting is a bug (a person confirms what they did).
        if any("place_call" in a for a in actions):
            text = "Te llamo ahora mismo." if lang == "es" else "Calling you right now."
        elif any("take_order" in a for a in actions):
            # §5.8a: an ORDER is the one action this fallback must not confirm. It was parked for the
            # boss a few lines up, so «queda anotado» would be the false confidence the whole review
            # rule exists to prevent — and this is the path where the mind said nothing, so nobody
            # else is going to correct it.
            text = ("Recibido — déjame que lo confirme y te digo enseguida." if lang == "es"
                    else "Got it — let me confirm it and I'll come straight back to you.")
        elif actions:
            # §5.7 TONE LAW, and this line broke it: «anotado» is in the banned set (portal.py's
            # `_TONE_BANNED`) precisely because it CLAIMS something is recorded and settled. This is
            # the path where the mind produced no sentence at all — the one moment we know least — so
            # promising "noted, I'll follow up" was the most confident thing said by the least
            # informed branch in the file. Peter kept hitting it (2026-07-28) whenever the model
            # returned empty, e.g. while the API key was out of credit. It now states only what is
            # actually true: it arrived, a person will come back. No claim about what was recorded.
            text = ("Recibido — te digo algo enseguida." if lang == "es"
                    else "Got it — I'll come back to you shortly.")
        else:
            text = "Perdona, ¿me lo repites?" if lang == "es" else "Sorry, could you say that again?"
    if _LINKY.search(text or "") or any(("send_booking_link" in a or "send_signup_link" in a) for a in actions):
        force_text = True
    reasoning = ("decidí: " + (", ".join(list(a.keys())[0] for a in actions) if actions else "responder"))
    return {"text": text, "force_text": force_text, "actions": actions,
            "pending_facts": pending_facts, "reasoning": reasoning}


async def why(phone: str, event_id: Optional[int] = None) -> str:
    """WP-3: replay the EXACT fold the mind saw for a turn — the byte-reproducible `why` (SPEC §4.5 ⑥).
    Reads the persisted assembly_snapshot verbatim (the latest turn, or a specific inbound event)."""
    scope = _scope(phone)
    async with db.scoped_tx(scope) as con:
        if event_id:
            row = await con.fetchrow("select rendered, why_hash, assembled_at from assembly_snapshot "
                                     "where scope=$1::ltree and event_id=$2", scope, int(event_id))
        else:
            row = await con.fetchrow("select rendered, why_hash, assembled_at from assembly_snapshot "
                                     "where scope=$1::ltree order by event_id desc limit 1", scope)
    if not row:
        return "No tengo la instantánea de ese turno todavía."
    return (f"POR QUÉ · fold ensamblado [{row['why_hash'][:12]}] · {row['assembled_at']:%Y-%m-%d %H:%M}\n\n"
            + row["rendered"])


async def xray(phone: str) -> str:
    """The full THOUGHT + ACTION chain since Peter's last message — pretty, for WhatsApp. A pure READ of
    the event spine (introspection, never an action). Triggered by texting 'xray'."""
    try:
        scope = _scope(phone)
        async with db.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select type, lane, payload, ts from event where scope=$1::ltree "
                "and type <> 'reasoning' or lane='reasoning' order by ts desc, id desc limit 60", scope)
        rows = list(reversed(rows))
        # window = since the SECOND-to-last inbound 'message' (the last one is the 'xray' command itself)
        msg_idx = [i for i, r in enumerate(rows) if r["type"] == "message"]
        start = msg_idx[-2] if len(msg_idx) >= 2 else 0
        chain = rows[start:]
        out = ["🔎 RAYOS X — desde tu último mensaje\n"]
        for r in chain:
            p = r["payload"] or {}
            if isinstance(p, str):
                import json as _j
                try:
                    p = _j.loads(p)
                except Exception:
                    p = {}
            when = r["ts"].strftime("%H:%M:%S")
            t = r["type"]
            if t == "message":
                out.append(f"📩 {when} · tú: {(p.get('text') or '')[:130]}")
            elif r["lane"] == "reasoning":
                out.append(f"💭 {when} · pensé: {(p.get('text') or '')[:130]}")
            elif t.startswith("action."):
                out.append(f"⚡ {when} · acción: {t[7:]}  {str(p.get('detail',''))[:70]}")
            elif t == "msg.sent":
                out.append(f"↩️ {when} · respondí: {(p.get('text') or '')[:130]}")
            elif t.startswith("tab."):
                out.append(f"📌 {when} · {t}")
            elif t in ("timer.fired",):
                out.append(f"⏰ {when} · reloj disparó")
            else:
                out.append(f"·  {when} · {t}")
        if len(out) == 1:
            out.append("(nada aún — háblame primero y luego pide xray)")
        return "\n".join(out)
    except Exception:
        log.exception("xray failed")
        return "No pude abrir los rayos X ahora mismo."
