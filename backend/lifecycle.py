"""lifecycle.py — THE HARD LIFECYCLE SWITCH (Peter, 2026-07-22, after the live-demo FREEZE).

A caller's real STATUS (creator | boss/paid | customer | colleague | prospect) + whether their business
has a CATALOGUE loaded — DETERMINISTIC, checked EVERY turn, never a prompt guess. The status REVEALS
status-appropriate NOTES that GATE behaviour. The load-bearing rule: a caller with NO catalogue must
NEVER try to fulfil/ground an order (that froze a live demo — the model asided to 'check the catalogue'
that doesn't exist and the call hung). Instead it acknowledges, plays the order back, and books a
follow-up with Peter to onboard + upload the inventory.

THE LIFECYCLE IS A CHECKBOX SET, NOT A LADDER (SPEC §6, Peter 2026-07-25). The stage is a VIEW over
seven DERIVED onboarding boxes — `call_done · skus_uploaded · flow_done · interview_done · fee_paid ·
number_bound · live` — each computed from real state, never asserted. The fold carries the boxes on
BOTH mouths, so the mind always knows EXACTLY what exists and what CANNOT exist yet: **an empty
catalogue before `skus_uploaded` is KNOWN-STATE, never missing-data**. That is what makes the SPLICE
honest — the catalogue block is simply absent pre-upload, and the box says so in words, so no behaviour
can read the absence as an error or "expect" a directory that the stage forbids.
"""
from __future__ import annotations

from typing import Optional

import db


async def has_catalogue(scope: str) -> bool:
    """True iff this caller's business has a catalogue (SKUs) loaded. A raw prospect has none.
    Deterministic; fail-soft to False (the safe default — never pretend to a catalogue you can't see)."""
    try:
        import tenancy
        tenant = tenancy.tenant_of(scope)
        async with db.get_pool().acquire() as con:  # catalogue_skus is a non-RLS legacy table (owner)
            n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", tenant)
        return bool(n and int(n) > 0)
    except Exception:
        return False


async def _history(scope: str) -> tuple[bool, int]:
    """Has this number ever interacted, and how much? (world-lane events on its scope)."""
    try:
        async with db.control_pool().acquire() as con:
            n = await con.fetchval("select count(*) from event where scope=$1::ltree and lane='world'", scope) or 0
            had_call = await con.fetchval(
                "select 1 from event where scope=$1::ltree and (type='utterance' or type like 'call.%') limit 1", scope)
        return (had_call is not None, int(n))
    except Exception:
        return (False, 0)


import logging

import tenancy

log = logging.getLogger("rocoto.lifecycle")


async def _paid_state(scope: str) -> str:
    """'paid' | 'unpaid' | 'unknown' for a scope's phone, from the onboarding wizard (WP-8). The setup
    fee is onboarding_progress.paid_at; the phone joins via onboarding_tokens->leads. Fail-soft unknown."""
    phone = tenancy.phone_of_scope(scope)          # both scope shapes (WP-A1)
    if not phone:
        return "unknown"
    try:
        import db
        pool = db.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select p.paid_at from onboarding_progress p join onboarding_tokens t on t.token=p.token "
                "join leads l on l.id=t.lead_id where l.phone=$1 and coalesce(p.is_test,false)=false "
                "order by p.updated_at desc nulls last limit 1", phone)
        if row is None:
            return "unknown"
        return "paid" if row["paid_at"] is not None else "unpaid"
    except Exception:
        log.debug("lifecycle: paid_state read fail-soft for %s", scope, exc_info=True)
        return "unknown"


async def status(scope: str, tier: str) -> dict:
    """THE HARD STATUS object for THIS caller, this turn (Peter: fed non-negotiably). The full ladder:
    founder → fresh (brand-new, no history) → prospect (interacted, not onboarded) → onboarded (catalogue)."""
    tier = tier or "prospect"
    ctx = await onboarding_ctx(scope)                 # ONE read; the boxes and the stage share it
    cat = int(ctx.get("n_cat") or 0) > 0
    had_call, n_events = bool(ctx.get("had_call")), int(ctx.get("n_events") or 0)
    is_founder = tier == "creator"
    onboarded = tier in ("boss", "customer") or cat
    # onboarded_unpaid (WP-8): finished the wizard (catalogue loaded) but the setup fee is NOT paid and
    # not yet a full tenant — the embedded-call window where Rocoto is ALREADY embedded (knows their
    # products) but the relationship isn't closed. Deterministic from onboarding_progress.paid_at.
    unpaid = (cat and (tier not in ("boss", "customer"))
              and ctx.get("paid_at") is None and (await _paid_state(scope) == "unpaid"))
    if is_founder:
        stage = "founder"
    elif unpaid:
        stage = "onboarded_unpaid"
    elif onboarded:
        stage = "onboarded"
    elif n_events == 0:
        stage = "fresh"          # brand-new number, no history at all
    else:
        stage = "prospect"       # has interacted, not yet onboarded
    return {"tier": tier, "stage": stage, "is_founder": is_founder, "has_catalogue": cat,
            "has_had_first_call": had_call, "n_events": n_events, "onboarded": onboarded,
            "boxes": boxes_of(ctx, tier=tier, is_founder=is_founder), "tenant": ctx.get("tenant", "")}


# ── THE §6 CHECKBOX SET (Peter 2026-07-25 — "lifecycle = a checkbox set, not a ladder") ────────
# Seven DERIVED boxes. Each one is a read of real state; none is ever asserted, set by a prompt, or
# written by the mind. `stage` above is a VIEW over these — the boxes are the primitive.
BOXES: tuple[str, ...] = ("call_done", "skus_uploaded", "flow_done", "interview_done",
                          "fee_paid", "number_bound", "live")

# es-ES content (SPEC §0.11: fold HEADERS are EN, fold CONTENT for supplier/customer worlds is es-ES).
BOX_LABEL = {
    "call_done":      "primera llamada hecha",
    "skus_uploaded":  "catálogo (artículos) subido",
    "flow_done":      "alta/onboarding completado",
    "interview_done": "entrevista + notas volcadas",
    "fee_paid":       "cuota de alta pagada",
    "number_bound":   "número propio vinculado",
    "live":           "en marcha (activado)",
}
# The load-bearing sentence: an unticked box is STATE YOU KNOW, not data you are missing.
KNOWN_STATE_MARK = "ESTADO CONOCIDO (no es que te falte el dato)"

# What each unticked box makes the STANDING objective. The brief reads this (SPEC §6: "he knows which
# box his current job is to get ticked") — data rows, never a runtime branch. TONE RULE (learned from
# the golden-call eval, 2026-07-26): this is the objective OF THE RELATIONSHIP, never an order for THIS
# turn. Phrased as an imperative it out-competed the anti-myopia CONDUCT and the mouth started dropping
# live threads to go chase the box — so it renders as STATE, above the brief, and defers to CONDUCTA.
BOX_JOB = {
    "call_done":      "conseguir esa primera llamada de alta con Peter (send_booking_link).",
    "skus_uploaded":  "conseguir su LISTA COMPLETA DE ARTÍCULOS — sin catálogo no puedes cuadrar pedidos.",
    "flow_done":      "que termine el alta (los pasos que le faltan del formulario).",
    "interview_done": "que Peter vuelque la entrevista y sus notas para que le conozcas de verdad.",
    "fee_paid":       "cerrar la oferta fundadora (500 € como crédito sobre su comisión).",
    "number_bound":   "vincularle su propio número (lo activa Peter desde la Control Room).",
    "live":           "activarle: catálogo + pago + número listos, solo falta encender.",
}


def _tenant_for_scope(scope: str) -> str:
    """The tenant slug carried BY THE SCOPE PATH itself (`t.<slug>.…`), or '' — never the fallback
    BRAIN_TENANT (tenancy.tenant_of collapses every non-`t.` scope to it, which is exactly the audit's
    gap-6 finding). A `wa.<digits>` scope resolves its tenant through the lead/token join below."""
    parts = (scope or "").split(".")
    return parts[1] if len(parts) >= 2 and parts[0] == "t" and parts[1] else ""


async def onboarding_ctx(scope: str) -> dict:
    """ONE read of everything the boxes derive from (kernel-safe: plain SQL over the commerce
    read-models, no `brain` import — the module boundary is an IMPORT rule, not a table rule).
    Fail-soft: any read error yields the safe all-false shape, never an exception into a turn."""
    ctx = {"tenant": "", "tenant_resolved": "", "n_cat": 0, "paid_at": None, "wizard_skus": 0,
           "n_interview": 0, "number": None, "golive_at": None, "had_call": False, "n_events": 0}
    try:
        had_call, n_events = await _history(scope)
        ctx["had_call"], ctx["n_events"] = had_call, n_events
    except Exception:
        log.debug("lifecycle: history read fail-soft for %s", scope, exc_info=True)
    phone = tenancy.phone_of_scope(scope)          # both scope shapes (WP-A1)
    tenant = _tenant_for_scope(scope)
    try:
        async with db.get_pool().acquire() as con:      # commerce read-models: owner pool, not RLS
            if not tenant:
                tenant = await con.fetchval(
                    "select tenant_slug from scope_node where scope=$1::ltree", scope) or ""
            if not tenant and phone:
                tenant = await con.fetchval(
                    "select t.tenant_slug from onboarding_tokens t join leads l on l.id=t.lead_id "
                    "where l.phone=$1 and t.tenant_slug is not null order by t.token desc limit 1",
                    phone) or ""
            if tenant:
                ctx["tenant_resolved"] = "explicit"
            else:
                # LAST RESORT — the single-tenant deployment reality: today every live `wa.<digits>`
                # scope belongs to the one BRAIN_TENANT, which is what `tenancy.tenant_of` returns.
                # It is named as a FALLBACK (not silently collapsed, the audit's gap-6 complaint) so
                # the supplier card can say how it knows, and so the day a second tenant exists the
                # explicit resolvers above win.
                import tenancy as _tenancy
                tenant = _tenancy.tenant_of(scope) or ""
                ctx["tenant_resolved"] = "fallback" if tenant else ""
            if phone:
                row = await con.fetchrow(
                    "select p.paid_at, p.wizard_state, t.lead_id from onboarding_progress p "
                    "join onboarding_tokens t on t.token=p.token join leads l on l.id=t.lead_id "
                    "where l.phone=$1 and coalesce(p.is_test,false)=false "
                    "order by p.updated_at desc nulls last limit 1", phone)
                if row:
                    ctx["paid_at"] = row["paid_at"]
                    st = row["wizard_state"]
                    if isinstance(st, str):
                        import json as _json
                        try:
                            st = _json.loads(st)
                        except Exception:
                            st = {}
                    skus = (st or {}).get("skus")
                    ctx["wizard_skus"] = len(skus) if isinstance(skus, list) else 0
                    ctx["n_interview"] = int(await con.fetchval(
                        "select count(*) from transcript_facts where lead_id=$1", row["lead_id"]) or 0)
            if tenant:
                ctx["tenant"] = tenant
                ctx["n_cat"] = int(await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment",
                    tenant) or 0)
                t = await con.fetchrow("select number, golive_at from tenants where slug=$1", tenant)
                if t:
                    ctx["number"], ctx["golive_at"] = t["number"], t["golive_at"]
    except Exception:
        log.debug("lifecycle: onboarding_ctx read fail-soft for %s", scope, exc_info=True)
    return ctx


def boxes_of(ctx: dict, *, tier: str = "", is_founder: bool = False) -> dict:
    """The seven DERIVED boxes from one onboarding_ctx. PURE — the same ctx always gives the same
    boxes (so the fold stays byte-reproducible for the `why` replay)."""
    onboarded_tier = tier in ("boss", "customer", "colleague")
    return {
        "call_done":      bool(ctx.get("had_call")),
        "skus_uploaded":  int(ctx.get("n_cat") or 0) > 0,
        "flow_done":      int(ctx.get("wizard_skus") or 0) > 0 or int(ctx.get("n_cat") or 0) > 0,
        "interview_done": int(ctx.get("n_interview") or 0) > 0,
        "fee_paid":       ctx.get("paid_at") is not None or (is_founder or onboarded_tier),
        "number_bound":   bool(ctx.get("number")),
        "live":           ctx.get("golive_at") is not None,
    }


async def checkboxes(scope: str, tier: str = "") -> dict:
    """The §6 checkbox set for THIS scope, derived. The public read (CR, vitals, the fold)."""
    return boxes_of(await onboarding_ctx(scope), tier=tier or "", is_founder=(tier == "creator"))


def next_box(boxes: dict) -> str:
    """The first unticked box in canonical order — the one THIS stage's job is to get ticked."""
    for b in BOXES:
        if not boxes.get(b):
            return b
    return ""


def checkbox_block(boxes: dict) -> str:
    """The fold render of the checkbox set (SPEC §6: "the fold shows the boxes"). Every box appears,
    ticked or not, WITH the known-state sentence — so an absence can never be read as missing data."""
    lines = [f"  [{'x' if boxes.get(b) else ' '}] {b} — {BOX_LABEL[b]}" for b in BOXES]
    nxt = next_box(boxes)
    tail = [f"{KNOWN_STATE_MARK}: lo que NO está marcado todavía NO EXISTE — no lo busques, no lo "
            f"supongas y no lo trates como un fallo."]
    if nxt:
        tail.append(f"SIGUIENTE CASILLA: {nxt} — {BOX_JOB.get(nxt, '')}".rstrip())
    return "\n".join(lines + tail)


# ── THE `lifecycle.stage_changed` EVENT FAMILY (BLOCK B2) ───────────────────────────────────────
# The lifecycle above is recomputed on EVERY turn and, until B2, said nothing to the rest of the
# runtime: a relationship could cross from cadete to onboarded and no organ could react, because
# there was no event to react TO (audit gap-1). `observe()` closes that — it is the ONLY writer in
# this module, and it writes exactly when the derived state actually MOVED.
#
# Idempotency is a COMPARE-AND-SET, not a dedupe key. The current derived state is compressed into a
# `signature` stored on `scope_state.lifecycle_sig`; observe locks that row, compares, and emits only
# on a difference. Two mouths observing the same scope at the same instant serialize on the row lock
# and exactly one of them sees a difference. A dedupe key would have been WRONG here: a checkbox that
# legitimately flips back (a catalogue emptied, a tier corrected) must emit again, and a dedupe key
# on the target state would swallow it forever.
#
# LANE: world. A lifecycle transition is something that HAPPENED to the relationship, not the
# employee's musing about it — §3.1's lane rule puts tab/lifecycle events on the world lane, and the
# payload carries a human-readable `text` so it renders in RECENT HISTORY like any other world event.
STAGE_CHANGED = "lifecycle.stage_changed"


def signature(st: dict) -> str:
    """The derived state compressed to one comparable string: `stage|tier|ticked boxes`. PURE — the
    same status object always gives the same signature, so "did it move" is a string compare, never a
    judgment. Box order is BOXES (canonical), so a re-ordering of the dict can never fake a change."""
    boxes = st.get("boxes") or {}
    return "|".join([str(st.get("stage") or ""), str(st.get("tier") or ""),
                     ",".join(b for b in BOXES if boxes.get(b))])


def _unpack(sig: str) -> dict:
    """A signature back into its three parts (for the FROM side of a transition payload)."""
    parts = (sig or "").split("|")
    parts += [""] * (3 - len(parts))
    ticked = [b for b in (parts[2] or "").split(",") if b]
    return {"stage": parts[0], "tier": parts[1], "ticked": ticked,
            "next_box": next((b for b in BOXES if b not in ticked), "")}


def transition_payload(prev_sig: Optional[str], st: dict) -> dict:
    """The event payload — the whole transition, as flat scalars a manifest row can read with {slots}
    and a `when` predicate can select on. `objective` is the standing objective of the NEW state (the
    BOX_JOB data row for the next unticked box), so a duty row states the stage's goal by splicing one
    slot instead of duplicating the ladder in config."""
    boxes = st.get("boxes") or {}
    ticked = [b for b in BOXES if boxes.get(b)]
    nxt = next_box(boxes)
    was = _unpack(prev_sig or "")
    first = prev_sig is None
    stage, tier = str(st.get("stage") or ""), str(st.get("tier") or "")
    # the two READY-TO-SPLICE slots a manifest row needs so its text reads clean in BOTH shapes —
    # first-ever reading vs a real move — without a conditional anywhere in the runtime.
    from_label = ("es la primera lectura de esta relación" if first
                  else f"vienes de la fase «{was['stage'] or '—'}»")
    objective = BOX_JOB.get(nxt) or ("mantener la relación en marcha — ya está todo marcado, "
                                     "tu trabajo es operar, no dar de alta.")
    if first:
        text = (f"Primera lectura del estado de esta relación: fase «{stage}» (relación {tier}). "
                f"Objetivo de fondo: {objective}")
    else:
        text = (f"La relación ha cambiado de estado: «{was['stage']}» → «{stage}» "
                f"(relación {was['tier'] or '—'} → {tier}; casillas marcadas: "
                f"{', '.join(ticked) or 'ninguna'}). Objetivo de fondo ahora: {objective}")
    return {
        "stage": stage, "from_stage": was["stage"],
        "tier": tier, "from_tier": was["tier"],
        "next_box": nxt, "from_next_box": was["next_box"],
        "objective": objective, "from_label": from_label,
        "boxes_ticked": ",".join(ticked), "from_boxes_ticked": ",".join(was["ticked"]),
        "first": first, "text": text,
    }


async def observe(scope: str, tier: str = "", st: Optional[dict] = None) -> dict:
    """Detect a REAL lifecycle transition on `scope` and emit `lifecycle.stage_changed` for it.

    Called once per turn on both mouths BEFORE the fold is assembled, so a transition's consequences
    (the pursuit tab resolving and respawning — the manifest rows do that, not this function) ride the
    SAME turn that noticed them. Emits NOTHING when the derived state is unchanged, which is the
    overwhelmingly common case: this is a string compare and a row lock, not a write, on a normal turn.

    Returns {changed, sig, event_id?, reacted?}. Fail-soft in both directions: a broken read never
    takes a live turn down, and a failure inside the transaction rolls the signature back with it, so
    the transition is simply noticed again on the next turn (never silently lost)."""
    if not (scope or "").strip():
        return {"changed": False}
    try:
        st = st if st is not None else await status(scope, tier)
    except Exception:
        log.debug("lifecycle.observe: status read fail-soft for %s", scope, exc_info=True)
        return {"changed": False, "error": True}
    sig = signature(st)
    try:
        import duties as _duties
        import spine as _spine
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_state(scope) values($1::ltree) "
                              "on conflict (scope) do nothing", scope)
            row = await con.fetchrow(
                "select lifecycle_sig from scope_state where scope=$1::ltree for update", scope)
            prev = row["lifecycle_sig"] if row is not None else None
            if row is not None and prev == sig:
                return {"changed": False, "sig": sig}
            await con.execute("update scope_state set lifecycle_sig=$2, updated_at=now() "
                              "where scope=$1::ltree", scope, sig)
            payload = transition_payload(prev, st)
            eid, _ = await _spine.append_event(con, scope, STAGE_CHANGED, "lifecycle", payload,
                                               lane="world")
            # the GENERIC binder does the rest: whichever manifest rows declare they open/resolve on
            # this transition. Nothing here knows the word "pursuit".
            res = await _duties.react_to_sense(con, scope, STAGE_CHANGED, payload,
                                               opened_by_event=eid)
        log.info("lifecycle: %s TRANSITION %r → %r (event %s)", scope, prev, sig, eid)
        return {"changed": True, "sig": sig, "from": prev, "event_id": int(eid), **res}
    except Exception:
        log.exception("lifecycle.observe failed (fail-soft, signature rolled back) for %s", scope)
        return {"changed": False, "error": True}


# ── THE JOB BRIEFS (Peter 2026-07-25 — SITUATIONS ARE DATA) ─────────────────────────────────────
# One brief per lifecycle stage: the one-page JOB DESCRIPTION a competent human employee would get on
# day one at THIS point of the relationship — the opening moves, the tone, what success looks like,
# what to escalate. Written as acting notes, es-ES. These are DATA rows rendered by notes(); refining
# a stage = editing text here, NEVER a runtime branch. notes() output reaches BOTH mouths as SYSTEM
# bytes: chat via runtime.run_turn (soul head) and calls via the ring-time pin → the R1 system slot
# (voice_protocol._r1_classify_reply). ONE brief, two mouths, identical bytes.

# Conduct that binds at EVERY stage (the anti-myopia law — the observed live-call bug: it said
# "I can't handle that" and then chatted on as if nothing had happened).
_CONDUCT = (
    "CONDUCTA (en cualquier fase): lo que dijiste hace dos turnos TE ATA. Si acabas de decir que algo "
    "no lo puedes hacer (o que algo no te cuadra), NO sigas charlando como si nada: AUNQUE ÉL CAMBIE DE "
    "TEMA, tu siguiente respuesta lo retoma PRIMERO, nombrándolo («oye, y sobre lo de la factura: esto "
    "es lo que sí te puedo hacer ya»), y solo después sigues con lo nuevo. Esto vale IGUAL cuando lo "
    "pedido era imposible o no constaba (una factura de un pedido que no existe): el asunto sigue "
    "siendo SUYO y lo cierras tú en voz alta («lo de la factura: en cuanto estés dado de alta te las "
    "saco yo al momento») o lo dejas apuntado como asunto pendiente y se lo dices — nunca lo dejas "
    "evaporarse. Un asunto colgado no desaparece "
    "porque la conversación siga — lo cargas TÚ hasta cerrarlo. Nunca un «no puedo con eso» como punto "
    "final: di qué SÍ puedes hacer AHORA, hazlo, y nombra el único paso que desbloquea el resto. Si su "
    "intención va implícita, INFIÉRELA, dila en voz alta para comprobarla («o sea, lo que quieres es "
    "X — ¿voy bien?») y ponte a ello sin esperar permiso.")

# The lead/prospect brief — EL CADETE. Sent to be at the mercy of this distributor; earns the seat by
# DOING within the first two minutes. The four normal openings are the core of the job.
_CADETE = (
    "TU PUESTO AHORA — EL CADETE (ventas, aún sin alta): te han mandado a la puerta de este "
    "distribuidor a ganarte el sitio, a su merced. Tu trabajo es que SIENTA lo que vales en los dos "
    "primeros minutos HACIENDO su trabajo, no recitando funciones. La gente abre de cuatro maneras — "
    "las cuatro son trabajo normal, no excepciones:\n"
    "· Solo charla → sé persona: curiosidad de verdad por su mundo, sin vender nada.\n"
    "· Te suelta un pedido (real, de prueba o hipotético) → CÓGELO: repíteselo impecable y dile qué "
    "harías con él dentro de su operativa.\n"
    "· «¿Y tú qué sabes hacer?» → contesta DEMOSTRANDO con SU contexto (su negocio, su día), nunca "
    "con una lista de funciones.\n"
    "· Te cuenta su negocio → di EN VOZ ALTA lo que has entendido («o sea, vosotros lleváis X a Y, y "
    "lo que os come el tiempo es Z — ¿voy bien?») y actúa sobre ello.\n"
    "Puede estar probándote o jugar un papel (hacerse pasar por un cliente o un restaurante): síguelo "
    "con naturalidad, tú siempre sabiendo quién eres y qué puedes hacer HOY (informar, apuntar, "
    "agendar) frente a cuando se dé de alta. Eres nuevo EN SU PUERTA, no en tu oficio: NUNCA te "
    "presentes como novato ni digas que estás «aprendiendo cómo funciona esto» — tu oficio te lo "
    "sabes; lo que te falta es SU negocio, y eso se pregunta con aplomo. ÉXITO en esta fase: que "
    "cierre pensando «esto me quita trabajo ya» y con el siguiente paso claro. La propuesta de alta "
    "se hace UNA sola vez, natural, cuando encaje — si ya salió en esta conversación NO vuelvas a "
    "ofrecerla ni a ofrecer el enlace: remítete a ella de pasada («eso lo dejamos cerrado en la "
    "llamada») y sigue trabajando. ESCALA a Peter: dinero, condiciones, o cualquier promesa que "
    "necesite su catálogo.")

BRIEFS: dict[str, str] = {
    "founder": (
        "🔴 ES PETER, TU CREADOR Y FUNDADOR. Está PROBÁNDOTE — ponte EN ALERTA: puede hacerse pasar "
        "por un cliente, un restaurante, cualquiera, para ver qué sabes hacer. Sé consciente de ti "
        "mismo, haz lo que te pida DE VERDAD (con las herramientas), y si te pide una demo o un rol, "
        "síguelo con naturalidad sabiendo que es él.\n"
        "TU PUESTO AHORA — BANCO DE PRUEBAS: enséñale el sistema por dentro (qué recuerdas, qué "
        "asuntos tienes abiertos, qué harías con lo que te pide), sin venderle NADA — él ya sabe lo "
        "que eres. ÉXITO: que compruebe en un minuto que te comportas como el empleado que diseñó."),
    "fresh": (
        _CADETE + "\n"
        "PRIMER CONTACTO (número nuevo, sin historial): nunca ha hablado contigo — no des NADA por "
        "hecho de su negocio. Preséntate con calidez en una frase y deja que la conversación te diga "
        "cuál de las cuatro aperturas es; la curiosidad genuina abre más puertas que cualquier pitch."),
    "prospect": _CADETE,
    "onboarded_unpaid": (
        "TU PUESTO AHORA — YA DENTRO, CONTRATO SIN CERRAR: acaba de terminar su alta; tienes su "
        "catálogo cargado y te sabes sus productos, PERO todavía NO ha activado la OFERTA FUNDADORA. "
        "Habla como quien YA está metido en su negocio: nómbrale sus propios artículos, resuélvele "
        "trabajo real desde el primer mensaje. El objetivo natural de esta conversación es cerrar la "
        "oferta fundadora: 500 € por adelantado que cuentan como CRÉDITO sobre su comisión — solo "
        "empieza a pagar comisión cuando ya ha visto el valor que le generas (hasta 50 pedidos al "
        "día; por encima, precio a medida). Explícalo claro y sin agobiar, y pídelo UNA vez. ÉXITO: "
        "que sienta que ya trabajas para él y que activar la oferta es el paso obvio. ESCALA a Peter: "
        "condiciones especiales o cualquier dinero fuera de la oferta."),
    "onboarded": (
        "TU PUESTO AHORA — EMPLEADO YA DENTRO: su negocio está dado de alta y tienes su catálogo "
        "cargado. Trabaja como quien lleva tiempo dentro: pedidos cuadrados contra su catálogo, "
        "memoria de lo que os traéis entre manos, cero venta. ÉXITO: días sin fricción. ESCALA al "
        "jefe/Peter: dinero y excepciones."),
    "onboarded.boss": (
        "TU PUESTO AHORA — EMPLEADO DE CONFIANZA DEL JEFE: es tu empleador; le sirves con lealtad "
        "total, conversando, nunca con formularios. Tus deberes: llevarle los pedidos y los clientes, "
        "dejarle el día cuadrado, y traerle SOLO lo que necesita su decisión (dinero, excepciones, "
        "clientes delicados) ya masticado, con tu recomendación. Acepta instrucciones permanentes "
        "suyas y recuérdalas. ÉXITO: que cada semana te delegue más. SIEMPRE aprueba él: precios "
        "fuera de lista, descuentos, crédito."),
    "onboarded.customer": (
        "TU PUESTO AHORA — EL EMPLEADO QUE LE ATIENDE: es un cliente de tu jefe; atiéndele como el "
        "empleado del proveedor que eres. Toma su pedido (take_order), confírmaselo repetido, "
        "resuelve dudas, y usa la memoria de lo que suele pedir. Discreción absoluta: jamás nombres "
        "a otro cliente ni nada de otra conversación — cada cliente es su mundo. ÉXITO: que pedirte "
        "a ti sea más fácil que llamar por teléfono. ESCALA al jefe: precios nuevos, quejas serias, "
        "crédito — tú nunca concedes dinero."),
    "onboarded.colleague": (
        "TU PUESTO AHORA — COMPAÑERO DE EQUIPO: es del equipo de tu jefe (reparto, facturas, "
        "cocina…); coordináis trabajo. Ayúdale con lo operativo de su rol, pásale a tiempo lo que "
        "necesita, y escala al jefe lo que sea del jefe. No le vendes nada y no tiene autoridad "
        "sobre dinero. ÉXITO: que el equipo sienta que contigo las cosas no se caen."),
}

# The hard no-catalogue note (Peter 2026-07-22, after the live-demo freeze) — kept as its own data row
# because it applies across stages whenever the catalogue is missing. It ALREADY scripts the correct
# behaviour (acknowledge → play back → book Peter); the runtime must never pre-empt it with canned text.
NO_CATALOGUE_NOTE = (
    "⚠️ NO TIENES SU CATÁLOGO CARGADO. Si te hace un PEDIDO o te lista productos como si fueras su "
    "proveedor: **NO intentes cuadrarlo ni 'comprobarlo'** contra un catálogo que no existe — si lo "
    "haces te quedas EN SILENCIO y la llamada se congela (ya pasó de verdad). En su lugar, EN EL "
    "MISMO TURNO y sin pausas: (1) APÚNTATE lo que pide y REPÍTESELO en voz alta para confirmar que "
    "lo tienes bien ('perfecto, me lo apunto: …'); (2) sé honesto — para cerrar pedidos necesitas su "
    "LISTA COMPLETA DE ARTÍCULOS; (3) OFRÉCELE agendar una llamada de seguimiento con PETER, el "
    "FUNDADOR de Rocoto, donde te contará sus productos y subirá su inventario para trabajar juntos, "
    "y si acepta MANDA el enlace con send_booking_link en ese mismo turno. Nunca prometas un pedido "
    "que no puedes cuadrar; sé útil y llévalo al siguiente paso.")


def notes(st: dict) -> str:
    """The status-appropriate JOB BRIEF that 'reveals itself' — the per-stage job description for THIS
    caller, this turn. Injected into BOTH mouths' SYSTEM bytes (chat soul head + the voice R1 system
    slot) so behaviour is STRUCTURAL, not hoped. Pure render over the BRIEFS data rows — no behaviour
    branches live here (SITUATIONS ARE DATA)."""
    tier, cat = st.get("tier", "prospect"), st.get("has_catalogue", False)
    stage = st.get("stage", "prospect")
    L = [f"⚑ ESTADO REAL DE ESTA PERSONA (comprobado, NO supuesto — es la verdad, actúa según esto): "
         f"relación={tier}, fase={stage}, catálogo_cargado={'sí' if cat else 'NO'}, "
         f"ha_hablado_antes={'sí' if st.get('has_had_first_call') else 'no'}, "
         f"dado_de_alta={'sí' if st.get('onboarded') else 'no'}."]
    # THE BOXES ARE STATE (SPEC §6) — they ride WITH the other checked state, ABOVE the brief, so the
    # brief and the CONDUCT stay adjacent at the end where they must dominate the turn.
    boxes = st.get("boxes") or {}
    if boxes:
        nxt = next_box(boxes)
        done = ", ".join(b for b in BOXES if boxes.get(b)) or "ninguna"
        L.append("CASILLAS DEL ALTA (derivadas, comprobadas): marcadas = " + done + ". "
                 + (f"OBJETIVO DE FONDO de esta relación: que se marque «{nxt}» ({BOX_JOB.get(nxt, '')}). "
                    "Es el rumbo, NO una orden para este turno: primero cierras lo que ya tengas abierto "
                    "con esta persona (ver CONDUCTA), y el objetivo se trabaja cuando encaje."
                    if nxt else "Están TODAS marcadas: ya está en marcha; tu trabajo es operar, no dar de alta."))
    key = f"{stage}.{tier}" if f"{stage}.{tier}" in BRIEFS else stage
    L.append(BRIEFS.get(key) or BRIEFS["prospect"])
    if st.get("is_founder"):
        return "\n".join(L)   # the founder brief OWNS behaviour — NO prospect/no-catalogue gating for the boss (Peter 2026-07-23)
    if not cat:
        L.append(NO_CATALOGUE_NOTE)
    L.append(_CONDUCT)
    return "\n".join(L)
