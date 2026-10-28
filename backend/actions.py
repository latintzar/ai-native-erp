"""actions.py — Rocoto's outward AGENCY beyond replying (SPEC §5/§7). Each fail-soft + evented.

send_email (Resend), escalate (hand something UP to a human — 'chasing other people'), and the shared
send_whatsapp_as_rocoto outbound primitive the mind + worker use. Small, typed, fail-soft — never
raise into a turn.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

import config
import tenancy
import twilio_wa as twa

log = logging.getLogger("rocoto.actions")

EMAIL_FROM = config._env("ONBOARD_EMAIL_FROM", "Rocoto <hello@soyrocoto.com>")


async def send_email(to: str, subject: str, html: str, reply_to: Optional[str] = None,
                     headers: Optional[dict] = None,
                     attachments: Optional[list] = None) -> bool:
    """Send an email via Resend. Returns True on 2xx. Fail-soft.

    `headers` is ADDITIVE (§17.56c) and exists for exactly one thing today: RFC 8058 one-click
    unsubscribe on MARKETING mail — `consent.list_unsubscribe_headers(email)` produces the
    List-Unsubscribe / List-Unsubscribe-Post pair that makes Gmail and Outlook render their own
    unsubscribe control. It is a parameter rather than something this function derives, because
    THIS FUNCTION MUST NOT GUESS WHICH MAIL IS MARKETING: the magic link and «tu catálogo está
    listo» are transactional, must not carry the header (it declares the message as bulk), and must
    not consult consent at all. The caller knows which kind it is sending; a sender that inferred it
    would eventually infer it wrong in the direction that mails somebody who said no."""
    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] suppressed email to %s (subject=%r)", to, subject[:40])
        return True
    if not (config.RESEND_API_KEY and to and subject):
        return False
    body = {"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html or ""}
    if reply_to:
        body["reply_to"] = reply_to
    if headers:
        body["headers"] = {str(k): str(v) for k, v in headers.items()}
    # `attachments` is [{"filename": str, "content": <base64 str>}] — Resend's own shape, passed
    # through rather than built here (2026-08-12, for the welcome mail's factura PDF). Kept out of
    # the log line on purpose: an invoice is the customer's document, not ours to print.
    if attachments:
        body["attachments"] = attachments
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post("https://api.resend.com/emails",
                             headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"}, json=body)
            if r.status_code < 300:
                return True
            log.warning("send_email non-2xx %s: %s", r.status_code, r.text[:200])
    except Exception:
        log.exception("send_email failed (fail-soft)")
    return False


async def _scope_wa(con, scope: str) -> Optional[str]:
    """Resolve the wa endpoint (E.164) for a party scope."""
    try:
        return await con.fetchval(
            "select e.addr from endpoint e join contact c on c.id=e.contact_id "
            "where c.scope=$1::ltree and e.kind='wa' order by e.id desc limit 1", scope)
    except Exception:
        return None


# ── Art. 50(1) on the text rail — the notice, and the marker that keeps it to once ──────────────
async def _ai_notice_prefix(con, scope: str) -> str:
    """The AI disclosure to put in front of the next message, or "" if this conversation has had it.

    FAIL-OPEN, deliberately, and it is the opposite of most of this file. Everywhere else a broken
    read means Rocoto stays quiet; here a broken read means the notice goes out again. Saying it
    twice costs a line of text; not saying it is the breach, priced at up to €15M or 3 % of turnover
    (art. 99(4)(g)), or 7,5 M€ / 1 % under the Spanish bill, policed by AESIA."""
    import ai_disclosure
    try:
        told = await con.fetchval(
            "select ai_notice_at is not null from scope_state where scope=$1::ltree", scope)
        if told:
            return ""
    except Exception:
        log.debug("ai notice read fail-open for %s", scope, exc_info=True)
    business = ""
    try:
        slug = tenancy.tenant_of(scope)
        if slug:
            # Tenant metadata is an owner-pool table. Querying it on the RLS runtime
            # connection aborts the send transaction even when the exception is caught.
            import db
            async with db.get_pool().acquire() as metadata:
                business = await metadata.fetchval("select name from tenants where slug=$1", slug) or ""
    except Exception:
        log.debug("ai notice business lookup fail-soft for %s", scope, exc_info=True)
    return ai_disclosure.whatsapp_line(business)


async def _mark_ai_notice_sent(con, scope: str) -> None:
    """Record that this conversation has been told. Fail-soft: the cost of a lost stamp is one
    repeated sentence, and `_ai_notice_prefix` is already written to prefer that over silence."""
    try:
        await con.execute(
            "insert into scope_state (scope, ai_notice_at) values ($1::ltree, now()) "
            "on conflict (scope) do update set ai_notice_at = "
            "coalesce(scope_state.ai_notice_at, excluded.ai_notice_at)", scope)
    except Exception:
        log.debug("ai notice stamp fail-soft for %s", scope, exc_info=True)


async def send_whatsapp_as_rocoto(scope: str, text: str, con=None,
                                  media_url: Optional[str] = None,
                                  override: bool = False) -> Optional[str]:
    """Send a WhatsApp from Rocoto to the party owning `scope`, and record it as a msg.sent event.
    Returns the Twilio SID or None. Fail-soft. If the scope is itself the wa.<digits> convenience
    scope, the digits ARE the number. `media_url` (presence suite 2026-07-25) rides the cloud
    send-media path (image/document/audio typed by extension, whatsapp_cloud.send_media) with `text`
    as the caption — the event carries kind=media so the log tells speech from showing. Registered
    capability: the manifest_tool row 'send_media' (schema_runtime.sql).

    `override=True` is the §15.4 OVERRIDE RAIL — a HUMAN speaking through Rocoto (the CR's send-as
    and the supplier app's «Enviar como Rocoto»). MODO SOMBRA shuts ROCOTO's mouth, never the boss's,
    so the override rail passes. It is an explicit named argument precisely so the exemption is
    visible at every call site instead of being inferred from context."""
    import db
    import gate
    import spine
    own_con = con is None
    try:
        if own_con:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        addr = await _scope_wa(con, scope)
        if not addr:
            addr = tenancy.phone_of_scope(scope)   # both scope shapes (WP-A1)
        if not addr:
            return None
        # MODO SOMBRA (SPEC §5.5) — the mouth is shut for this scope: the draft is recorded on the
        # review sheet and NOTHING reaches the rail. No SID is returned, because none was earned.
        if not override and await gate.hold_if_sombra(
                scope, "media" if media_url else "message", text, con=con,
                detail={"media_url": media_url or ""}):
            return None

        # ── THE HUMAN HOLD (Raquel, 2026-08-19) ───────────────────────────────────────────────
        # «Pueda meterme como humana… enderezar la conversación.» The boss typing as herself IS
        # the takeover gesture — no toggle to know about. Her message (override=True) bumps a TTL
        # on the scope; while it stands, Rocoto's own replies are drafted and HELD on the review
        # sheet (sombra's exit, zero new machinery), never sent over her. Expiry is the handback:
        # a forgotten takeover must not kill a thread forever, so silence hands it back and the
        # next customer message gets answered again. Deliberate /api/takeover still outranks this.
        if override:
            try:
                await con.execute(
                    "insert into scope_state (scope, human_hold_until) values ($1::ltree, now() + "
                    "($2 || ' minutes')::interval) on conflict (scope) do update set "
                    "human_hold_until = excluded.human_hold_until",
                    scope, str(config.HUMAN_HOLD_MINUTES))
            except Exception:
                log.debug("human hold bump fail-soft for %s", scope, exc_info=True)
        elif text:
            held = False
            try:
                held = bool(await con.fetchval(
                    "select human_hold_until > now() from scope_state where scope=$1::ltree", scope))
            except Exception:
                log.debug("human hold read fail-soft for %s", scope, exc_info=True)
            if held:
                import gate as _gate
                await _gate.hold(scope, "media" if media_url else "message", text, con=con,
                                 detail={"origin": "human_hold"})
                return None
            import market_voice
            text = await market_voice.apply_for(scope, text)

            # ── ART. 50(1), ONCE PER NUMBER ───────────────────────────────────────────────────
            # The AI Act has applied since 2 August 2026 and the duty is the PROVIDER's — ours —
            # so it ships in the thread rather than in a distributor's terms. The Commission's
            # guidelines are explicit that a disclosure «contained only in terms and conditions,
            # URLs, or documentation» is insufficient, and that human review of the output does
            # not excuse it.
            #
            # It rides ONLY the non-override branch, and that is the whole design: `override=True`
            # is a human typing through Rocoto, and announcing an AI over a person's own sentence
            # would be a false statement about who is speaking — the same reason listen-mode calls
            # carry no spoken AI line.
            #
            # Once per scope, and a scope is one customer's conversation. Never again after that,
            # because Raquel's "no se van a parar a leer una biblia" is the constraint that decides
            # whether a notice is read at all.
            notice = await _ai_notice_prefix(con, scope)
            if notice:
                text = f"{notice} {text}".strip() if text else notice

        # (the market voice for non-override sends is applied inside the human-hold branch above —
        #  one non-override path, so the two gates cannot be passed separately)
        sid = await twa.send_whatsapp(addr, text, media_url=media_url)
        # STAMPED ONLY ON A SEND THAT HAPPENED. A stamp before the wire would spend the one notice
        # this number gets on a message that never arrived.
        if not override and sid:
            await _mark_ai_notice_sent(con, scope)
        payload: dict = {"text": text, "sid": sid}
        if media_url:
            payload["kind"] = "media"
            payload["media_url"] = media_url
        await spine.append_event(con, scope, "msg.sent", "runtime", payload)
        return sid
    except Exception:
        log.exception("send_whatsapp_as_rocoto failed (fail-soft)")
        return None
    finally:
        if own_con and con is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


async def _reaction_target_verdict(target: str) -> tuple[bool, str]:
    """THE PRE-FLIGHT (2026-07-26). Meta answers a reaction POST with 200 + a wamid even when the
    target can never be reacted to, and refuses it LATER on the delivery-status webhook (131009) —
    so without this check we spend a send and briefly show a gesture that never happened.

    Refuse what we can already know is invalid:
      · a target we have never seen on this thread (not a real inbound/outbound message id),
      · a target older than Meta's 30-day reaction window,
      · a target that is itself a reaction row (you cannot react to a reaction).
    Returns (ok, reason). A DB fault is NOT a refusal — it returns (True, 'unverified'): the cheap
    guard must never become a new way to lose a gesture; the status webhook stays the authority."""
    import db
    import whatsapp_cloud as wc
    try:
        row = await db.message_by_wamid(target)
    except Exception:
        log.warning("reaction pre-flight could not check %s (proceeding, webhook stays the authority)",
                    target[:40], exc_info=True)
        return True, "unverified"
    if row is None:
        return False, "unknown_target"
    if (row.get("message_type") or "") == "reaction":
        return False, "target_is_a_reaction"
    age = float(row.get("age_days") or 0.0)
    if age > wc.REACTION_MAX_AGE_DAYS:
        return False, f"target_older_than_{wc.REACTION_MAX_AGE_DAYS}d:{age:.1f}"
    return True, "ok"


async def send_reaction_as_rocoto(scope: str, target_wamid: str, emoji: str, con=None) -> dict:
    """React with an emoji to a specific customer message — PRESENCE, not speech (suite 2026-07-25).
    Cloud rail only (reactions address wamid.* ids; whatsapp_cloud.send_reaction). GATE-EXEMPT by
    design — no money can ride an emoji — but never silent: appended as a msg.sent event with
    kind=reaction and projected into whatsapp_messages so the app shows the gesture. An empty emoji
    REMOVES a prior reaction (Meta's contract). Registered capability: the manifest_tool row
    'send_reaction' (schema_runtime.sql).

    THE 200 IS NOT DELIVERY (2026-07-26). Two halves keep this honest:
      · PRE-FLIGHT here — a stale/unknown/non-reactable target is refused with a typed reason,
        logged, evented (ops.reaction_refused) and NEVER sent;
      · POST-FLIGHT in app.py — a 131009 status webhook events ops.reaction_failed and ROLLS BACK
        the projection, so the app never shows a gesture the customer did not see.
    Fail-soft, typed (same shape as send_interactive_as_rocoto — a bare sid string could not carry
    the refusal reason): {ok, sid, reason, target_wamid, emoji}. Never raises into a turn."""
    import db
    import spine
    target = (target_wamid or "").strip()
    emoji = emoji or ""

    def _out(ok: bool, reason: str, sid: Optional[str] = None) -> dict:
        return {"ok": ok, "sid": sid, "reason": reason, "target_wamid": target, "emoji": emoji}

    if not target.startswith("wamid."):
        log.info("reaction refused: %r is not a cloud-rail wamid (only Meta ids are reactable)",
                 target[:40])
        return _out(False, "not_a_wamid")  # only cloud-rail messages can be reacted to
    ok, verdict = await _reaction_target_verdict(target)
    own_con = con is None
    cm = None
    try:
        if own_con:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        # MODO SOMBRA (SPEC §5.5) FIRST, ahead of the pre-flight: a reaction is gate-EXEMPT on money
        # and still SPEECH — §5.5 names it explicitly ("no messages, no reactions"). It goes first so
        # the reason the boss reads is the true one (the mouth is shut), not an incidental complaint
        # about the target, and so a held gesture always leaves the same trace as every other hold.
        import gate
        if (h := await gate.hold_if_sombra(scope, "reaction", emoji, con=con,
                                           detail={"target_wamid": target})):
            return _out(False, h["reason"])
        if not ok:
            log.warning("reaction refused pre-flight (%s) target=%s emoji=%r", verdict, target[:40], emoji)
            try:
                await spine.append_event(
                    con, scope, "ops.reaction_refused", "runtime",
                    {"reason": verdict, "target_wamid": target, "emoji": emoji}, lane="reasoning")
            except Exception:
                log.debug("reaction-refusal event fail-soft", exc_info=True)
            return _out(False, verdict)
        addr = await _scope_wa(con, scope)
        if not addr:
            addr = tenancy.phone_of_scope(scope)   # both scope shapes (WP-A1)
        if not addr:
            return _out(False, "no_endpoint")
        if config.EGRESS_SANDBOX:
            log.info("[EGRESS_SANDBOX] suppressed reaction %r to %s", emoji, addr)
            sid = "SANDBOX-reaction"
        else:
            import whatsapp_cloud
            sid = await whatsapp_cloud.send_reaction(addr, target, emoji)
        eid, _ = await spine.append_event(
            con, scope, "msg.sent", "runtime",
            {"text": emoji, "kind": "reaction", "emoji": emoji,
             "target_wamid": target, "sid": sid})
        try:
            import projector
            await projector.project_msg_sent(scope, emoji, sid, eid,
                                             kind="reaction", reply_to_wa_id=target)
        except Exception:
            log.debug("reaction projection fail-soft", exc_info=True)
        return _out(True, "accepted", sid)
    except Exception as e:  # noqa: BLE001
        # the rail raised (Graph error / no wamid in the body) — nothing is evented, nothing is
        # projected, and the caller is TOLD. A send we could not make is never recorded as one.
        log.exception("send_reaction_as_rocoto failed (fail-soft)")
        return _out(False, f"send_failed:{type(e).__name__}")
    finally:
        if own_con and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


async def send_interactive_as_rocoto(scope: str, body: str, options: list[dict], con=None,
                                     header: Optional[str] = None, footer: Optional[str] = None,
                                     list_button_label: str = "Ver opciones") -> dict:
    """Ask a CLOSED question with one-tap options (2026-07-26) — the honest replacement for polls.

    `options` = [{"id": ..., "title": ..., "description"?: ...}] (2..10). THE CODE picks the surface:
    ≤3 short options → reply BUTTONS; anything more (or a title too long for a button but fine for a
    list row) → a LIST. Nobody upstream should have to think about Meta's UI limits.

    Contract, same as every other mouth here:
      · GATED — the body AND every option title go through gate.check_outbound with the scope's keyed
        standing prices. A price in a button is still a quote: it PARKS (action row, needs_human,
        money) and NOTHING is sent.
      · EVENTED — msg.sent with kind=interactive and the FULL option set in the payload, so the fold
        and the why-trace show exactly WHAT was offered (not just that we asked something).
      · PROJECTED — into whatsapp_messages so the app/CR thread renders it (body + the offered
        options as '▸' lines: a plain-text mirror of what the customer sees).
      · SANDBOX-honoured — EGRESS_SANDBOX records the would-do send, nothing reaches Meta.
    Registered capability: the manifest_tool rows 'send_interactive' + 'ask_options'.
    Fail-soft: returns {ok, sid, kind, parked, reason, options} — never raises into a turn."""
    import db
    import gate
    import spine
    import whatsapp_cloud as wc

    def _fail(reason: str, **kw) -> dict:
        return {"ok": False, "sid": None, "kind": None, "parked": False, "reason": reason, **kw}

    body = (body or "").strip()
    norm: list[dict] = []
    for i, o in enumerate(options or []):
        if isinstance(o, str):
            o = {"title": o}
        if not isinstance(o, dict):
            continue
        title = (o.get("title") or "").strip()
        if not title:
            continue
        row: dict = {"id": (o.get("id") or f"opt{i + 1}").strip()[:wc.IA_ID_MAX], "title": title}
        desc = (o.get("description") or "").strip()
        if desc:
            row["description"] = desc
        norm.append(row)
    if not body:
        return _fail("empty_body")
    if len(norm) < 2:
        return _fail("needs_at_least_2_options")
    if len(norm) > wc.IA_MAX_ROWS:
        return _fail(f"too_many_options:{len(norm)}")

    own_con = con is None
    cm = None
    try:
        if own_con:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        addr = await _scope_wa(con, scope)
        if not addr:
            addr = tenancy.phone_of_scope(scope)   # both scope shapes (WP-A1)
        if not addr:
            return _fail("no_endpoint")

        # ── MODO SOMBRA (SPEC §5.5): a one-tap question is speech too — held before the money gate,
        #    because a held send never needs pricing an answer it will not give ──────────────────
        if (h := await gate.hold_if_sombra(scope, "interactive", body, con=con,
                                           detail={"options": [o["title"] for o in norm]})):
            return {"ok": False, "sid": None, "kind": None, "parked": False,
                    "reason": h["reason"], "options": norm}

        # ── the GATE: the question a customer TAPS is speech like any other sentence ──────────
        checked = "\n".join([body] + [o["title"] for o in norm])
        try:
            sp = await gate.standing_prices(con, scope)
        except Exception:
            sp = []
        verdict = gate.check_outbound(checked, sp)
        if verdict.get("needs_approval"):
            try:
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,money) "
                    "values($1::ltree,'concession',$2,'pending','money_concession',true,true)",
                    scope, {"draft": body[:600], "surface": "interactive",
                            "options": [o["title"] for o in norm], "gate": verdict.get("reason", "")})
            except Exception:
                log.debug("interactive gate park fail-soft", exc_info=True)
            return {"ok": False, "sid": None, "kind": None, "parked": True,
                    "reason": f"gate:{verdict.get('reason', 'money')}", "options": norm}

        # ── the surface choice belongs to the CODE, never to the caller ───────────────────────
        fits_buttons = (len(norm) <= wc.IA_MAX_BUTTONS
                        and all(len(o["title"]) <= wc.IA_BUTTON_TITLE_MAX for o in norm)
                        and not any("description" in o for o in norm))
        kind = "button" if fits_buttons else "list"

        if config.EGRESS_SANDBOX:
            log.info("[EGRESS_SANDBOX] suppressed interactive (%s, %d options) to %s",
                     kind, len(norm), addr)
            sid = "SANDBOX-interactive"
        elif kind == "button":
            sid = await wc.send_interactive_buttons(
                addr, body, [{"id": o["id"], "title": o["title"]} for o in norm],
                header=header, footer=footer)
        else:
            sid = await wc.send_interactive_list(
                addr, body, list_button_label, [{"rows": norm}], header=header, footer=footer)

        eid, _ = await spine.append_event(
            con, scope, "msg.sent", "runtime",
            {"text": body, "kind": "interactive", "interactive": kind, "options": norm,
             "header": header or "", "footer": footer or "", "sid": sid})
        try:
            import projector
            shown = body + "\n" + "\n".join(f"▸ {o['title']}" for o in norm)
            await projector.project_msg_sent(scope, shown, sid, eid, kind="interactive")
        except Exception:
            log.debug("interactive projection fail-soft", exc_info=True)
        return {"ok": True, "sid": sid, "kind": kind, "parked": False, "reason": "sent",
                "options": norm}
    except wc.InteractiveLimitError as e:
        log.warning("send_interactive_as_rocoto refused by the limit guard: %s", e)
        return _fail(f"limit:{e}")
    except Exception:
        log.exception("send_interactive_as_rocoto failed (fail-soft)")
        return _fail("send_failed")
    finally:
        if own_con and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


async def escalate(con, scope: str, to_role: str, reason: str, text: str,
                   boss_wa: Optional[str] = None) -> None:
    """Rocoto hands something UP to a human (boss/colleague) — 'chasing OTHER people about something'.
    Appends an escalate event AND pings the human on WhatsApp if we know their number. Fail-soft."""
    import spine
    try:
        await spine.append_event(con, scope, "escalate", "runtime",
                                 {"to_role": to_role, "reason": reason, "text": text}, lane="world")
    except Exception:
        log.exception("escalate: event append failed")
    target = boss_wa
    if not target:
        try:
            target = await con.fetchval(
                "select e.addr from manifest_stakeholder s join contact c on c.id=s.contact_id "
                "join endpoint e on e.contact_id=c.id where s.scope <@ $1::ltree and s.role=$2 and e.kind='wa' limit 1",
                scope, to_role)
        except Exception:
            target = None
    if target:
        try:
            ping = text if text.lower().startswith(("oye", "peter", "jefe")) else f"Aviso de Rocoto: {text}"
            await twa.send_whatsapp(target, ping)
        except Exception:
            log.exception("escalate: whatsapp ping failed")
