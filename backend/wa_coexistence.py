"""wa_coexistence.py — the half of coexistence that is NOT the Connect button.

Coexistence means one number answered by two clients: the owner's thumb in the WhatsApp Business
app, and us. That only works if we can see what they do. Three webhook fields carry it, and each is
a NEW `field` value with a DIFFERENTLY-NAMED array — which is why the ordinary `value["messages"]`
reader is blind to all of them:

    field                 array              what it is
    ─────                 ─────              ──────────
    history               history[]          up to 180 days of past 1:1 chats, once, at onboarding
    smb_app_state_sync    state_sync[]       their phone's CONTACTS — and it fires forever after
    smb_message_echoes    message_echoes[]   what the OWNER just sent by hand, as they send it

THE ECHO IS THE ONE THAT MATTERS MOST DAILY. Without it Carlos answers a restaurant on his phone,
we never see it, and Rocoto answers the same question again an hour later — the product looking
stupid in front of his customer, in a way he cannot even explain.

── THE SYNC, AND WHY IT IS DANGEROUS ───────────────────────────────────────────────────────────
Two calls, `POST /{phone_number_id}/smb_app_data`, one for contacts and one for history. Meta's
rules, each of which shapes the code below:

  · **24 hours** from onboarding, or the customer is offboarded and redoes the ENTIRE flow —
    including the taps on their phone.
  · **Each call may be made EXACTLY ONCE.** Re-running is not a retry, it is an offboard. So this
    module records the attempt BEFORE it fires and never loops on a 200.
  · A 200 means «request accepted», NOT «the business agreed to share history».
  · The history is pulled off their HANDSET, so they must keep the app open. That is a sentence for
    the onboarding screen, not a footnote.
  · `request_id` is what Meta support asks for. Persisted, always.

── WHAT WE WILL NEVER SEE, AND MUST SAY OUT LOUD ───────────────────────────────────────────────
**Groups are not supported, not synced, and never will be.** If a restaurant orders in a WhatsApp
group, coexistence cannot see it — not at history, not live. That is a product fact for the sales
conversation, not a technical caveat to bury.

And a business may DECLINE history sharing on the confirm screen. Then the `history` webhook carries
error **2593109**. That is a normal outcome, not a failure: «connected, but no past orders» is a
first-class state, and treating it as an error would tell a customer their setup broke when it
didn't.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

import channels

log = logging.getLogger("rocoto.wa_coex")

GRAPH = "https://graph.facebook.com/v21.0"

FIELD_HISTORY = "history"
FIELD_STATE_SYNC = "smb_app_state_sync"
FIELD_ECHOES = "smb_message_echoes"
COEXISTENCE_FIELDS = (FIELD_HISTORY, FIELD_STATE_SYNC, FIELD_ECHOES)

SYNC_CONTACTS = "smb_app_state_sync"
SYNC_HISTORY = "history"

# «History sync is turned off by the business from the WhatsApp Business App» — a CHOICE, not a fault.
ERR_HISTORY_DECLINED = 2593109


# ── the two sync calls ─────────────────────────────────────────────────────────────────────────
async def request_sync(connection_id: int, phone_number_id: str, sync_type: str) -> dict[str, Any]:
    """Ask Meta to pull one kind of data off the owner's handset. ONCE, ever.

    The attempt is recorded BEFORE the call and the row is the guard: `attempts` going above zero
    means we have already spent the one shot, and a second call would not retry — it would force the
    customer through the whole Embedded Signup flow again. So a failure here is surfaced, never
    looped."""
    import db
    token = await channels.token_for(int(connection_id))
    if not token:
        return {"ok": False, "error": "no_token"}

    async with db.get_pool().acquire() as con:
        # Claim the single attempt atomically. If the update touches nothing, somebody already
        # spent it — a concurrent worker tick, or a previous deploy's sweep.
        claimed = await con.fetchval(
            "update channel_sync_deadline set attempts = attempts + 1 "
            "where connection_id=$1 and kind=$2 and attempts = 0 and done_at is null "
            "returning connection_id", int(connection_id), _kind_of(sync_type))
    if not claimed:
        log.info("wa_coex: sync %s for connection %s already attempted — not repeating",
                 sync_type, connection_id)
        return {"ok": False, "error": "already_attempted"}

    try:
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.post(
                f"{GRAPH}/{phone_number_id}/smb_app_data",
                headers={"Authorization": f"Bearer {token}"},
                json={"messaging_product": "whatsapp", "sync_type": sync_type})
        body = r.json() if r.content else {}
    except Exception as e:
        await _note(connection_id, sync_type, error=f"transport: {e}")
        log.exception("wa_coex: sync %s transport failure for %s", sync_type, phone_number_id)
        return {"ok": False, "error": "transport"}

    if r.status_code >= 400 or "error" in body:
        err = body.get("error") or {}
        await _note(connection_id, sync_type, error=str(err.get("message"))[:300])
        log.warning("wa_coex: sync %s refused code=%s msg=%s",
                    sync_type, err.get("code"), str(err.get("message"))[:200])
        return {"ok": False, "error": "refused", "code": err.get("code")}

    # `request_id` is the only handle Meta support will accept later. A 200 means ACCEPTED, not
    # agreed — the business may still have declined history on their phone, which arrives later as
    # a webhook error rather than here.
    req = str(body.get("request_id") or "")
    await _note(connection_id, sync_type, request_id=req)
    log.info("wa_coex: sync %s requested for %s (request_id=%s)", sync_type, phone_number_id, req)
    return {"ok": True, "request_id": req}


def _kind_of(sync_type: str) -> str:
    return "coexistence_history" if sync_type == SYNC_HISTORY else "coexistence_contacts"


async def _note(connection_id: int, sync_type: str, *, request_id: str = "", error: str = "") -> None:
    import db
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update channel_sync_deadline set last_error=$3, "
                "       done_at = case when $4 <> '' then now() else done_at end "
                "where connection_id=$1 and kind=$2",
                int(connection_id), _kind_of(sync_type), error[:300], request_id)
    except Exception:
        log.exception("wa_coex: could not record the sync outcome for %s", connection_id)


async def run_due_syncs() -> dict[str, int]:
    """The worker's tick. Fires whatever has not been fired, for connections still inside their
    window — and LOUDLY records the ones whose window has closed, because that customer now has to
    redo Embedded Signup and somebody has to tell them."""
    from datetime import datetime, timezone

    import wa_onboard
    fired = expired = 0
    for row in await wa_onboard.pending_syncs():
        due = row.get("due_at")
        if due and due < datetime.now(timezone.utc):
            expired += 1
            log.error("wa_coex: THE 24H WINDOW CLOSED for connection %s (tenant %s) — this customer "
                      "must be offboarded and redo Embedded Signup", row["connection_id"], row["tenant_id"])
            continue
        nums = await channels.numbers_for(str(row["tenant_id"]))
        for n in nums:
            if n.get("mode") != channels.MODE_COEXISTENCE:
                continue
            for st in (SYNC_CONTACTS, SYNC_HISTORY):
                out = await request_sync(int(row["connection_id"]), str(n["external_id"]), st)
                if out.get("ok"):
                    fired += 1
    return {"fired": fired, "expired": expired}


# ── the webhooks ───────────────────────────────────────────────────────────────────────────────
async def handle(field: str, value: dict[str, Any], tenant: str) -> dict[str, Any]:
    """Dispatch one coexistence webhook. Called from app.py's webhook AFTER the tenant is resolved —
    every coexistence field carries `value.metadata.phone_number_id`, so the existing router already
    answers «whose is this», and this only has to answer «what is it»."""
    f = (field or "").strip().lower()
    if f == FIELD_ECHOES:
        return await _echoes(value, tenant)
    if f == FIELD_STATE_SYNC:
        return await _contacts(value, tenant)
    if f == FIELD_HISTORY:
        return await _history(value, tenant)
    return {"ok": False, "ignored": f}


async def _echoes(value: dict[str, Any], tenant: str) -> dict[str, Any]:
    """THE OWNER JUST SENT SOMETHING BY HAND. This is the field that keeps Rocoto from talking over
    a person: the message is recorded on the customer's own scope as an OUTBOUND from the business,
    so the fold shows it, the mind sees a reply already happened, and the review sheet does not nag
    about a question somebody already answered on their phone."""
    import db
    import runtime
    import spine
    echoes = value.get("message_echoes") or []
    n = 0
    for m in echoes:
        to = str(m.get("to") or "")
        text = ((m.get("text") or {}).get("body") or "").strip()
        if not to:
            continue
        scope = runtime.scope_of(to, tenant)
        try:
            async with db.scoped_tx(scope) as con:
                await spine.append_event(
                    con, scope, "msg.sent", "smb_echo",
                    {"text": text, "wamid": m.get("id") or "", "by": "owner_handset"},
                    lane="world")
            n += 1
        except Exception:
            log.exception("wa_coex: could not record an echo on %s", scope)
    if n:
        log.info("wa_coex: recorded %d owner-sent message(s) for %s", n, tenant)
    return {"ok": True, "echoes": n}


async def _contacts(value: dict[str, Any], tenant: str) -> dict[str, Any]:
    """Their phone's address book. Fires at onboarding AND FOREVER AFTER — every time the owner
    edits a contact on their handset. `add` covers both added and edited; `remove` arrives with the
    name fields omitted, so a removal is a phone number and nothing else."""
    import db
    rows = value.get("state_sync") or []
    added = removed = 0
    for s in rows:
        if str(s.get("type") or "") != "contact":
            continue
        c = s.get("contact") or {}
        phone = str(c.get("phone_number") or "").strip()
        if not phone:
            continue
        action = str(s.get("action") or "add").lower()
        try:
            async with db.get_pool().acquire() as con:
                if action == "remove":
                    # NOT a delete. Their address book is not our customer list, and a contact
                    # removed from a phone is not a customer who stopped existing.
                    await con.execute(
                        "update customer_profiles set stats = coalesce(stats,'{}'::jsonb) "
                        "|| '{\"smb_contact\": false}'::jsonb "
                        "where tenant_id=$1 and phone_number=$2", tenant, phone)
                    removed += 1
                else:
                    name = str(c.get("full_name") or c.get("first_name") or "").strip()
                    await con.execute(
                        """insert into customer_profiles (tenant_id, phone_number, name, stats)
                           values ($1,$2,$3,'{"smb_contact": true}'::jsonb)
                           on conflict (tenant_id, phone_number) do update
                             set name = case when customer_profiles.name is null
                                              or customer_profiles.name = ''
                                         then excluded.name else customer_profiles.name end,
                                 stats = coalesce(customer_profiles.stats,'{}'::jsonb)
                                         || '{"smb_contact": true}'::jsonb""",
                        tenant, phone, name)
                    added += 1
        except Exception:
            log.exception("wa_coex: contact sync row failed for %s", phone)
    log.info("wa_coex: contacts for %s — %d added/updated, %d removed", tenant, added, removed)
    return {"ok": True, "added": added, "removed": removed}


async def _history(value: dict[str, Any], tenant: str) -> dict[str, Any]:
    """Up to 180 days of past 1:1 chats, in three phases and many chunks.

    THREE RULES FROM THE DOCS, EACH LEARNED THE EXPENSIVE WAY BY SOMEBODY:
      · **Completion is `progress == 100`, never `phase`.** Meta's own text says a phase value of 2
        means the phase is complete, which contradicts its own definition where 2 is simply the
        third phase. That sentence is a doc bug; building on it would mean declaring a sync finished
        while two thirds of it is still arriving.
      · **Chunks arrive OUT OF ORDER** — `chunk_order` is the sequence, not arrival.
      · **One webhook can describe thousands of messages**, so this captures and returns rather than
        processing inline. A webhook that does real work per message is a webhook that times out.

    A DECLINED SYNC IS NOT A FAILURE. Error 2593109 means the business chose not to share their
    history on the confirm screen, which is their right. It is recorded as a state, and the
    onboarding surface says «connected, sin historial» rather than showing them an error."""
    import db
    errs = [e for e in (value.get("errors") or []) if isinstance(e, dict)]
    for e in errs:
        if int(e.get("code") or 0) == ERR_HISTORY_DECLINED:
            log.info("wa_coex: %s declined history sharing — connected without past orders", tenant)
            await _mark_history_state(tenant, "declined")
            return {"ok": True, "declined": True}

    items = value.get("history") or []
    progress = 0
    chunks = 0
    for h in items:
        meta = h.get("metadata") or h
        try:
            progress = max(progress, int(meta.get("progress") or 0))
        except Exception:
            pass
        chunks += 1
    # Captured, not processed — grounding thousands of past messages belongs in the worker, off the
    # webhook's clock. Stored raw so the processing can be rewritten without asking Meta again,
    # which we cannot do: the sync is a one-shot.
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                """insert into wa_history_chunk (tenant_id, payload, progress, received_at)
                   values ($1,$2::jsonb,$3, now())""",
                tenant, __import__("json").dumps(value), progress)
    except Exception:
        log.exception("wa_coex: could not store a history chunk for %s", tenant)
    if progress >= 100:
        await _mark_history_state(tenant, "complete")
        log.info("wa_coex: history sync COMPLETE for %s", tenant)
    return {"ok": True, "chunks": chunks, "progress": progress}


async def _mark_history_state(tenant: str, state: str) -> None:
    import db
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update channel_connection set last_error = case when $2='declined' "
                "  then 'history_declined' else '' end, updated_at = now() "
                "where tenant_id=$1 and kind='whatsapp' and revoked_at is null", tenant, state)
    except Exception:
        log.debug("wa_coex: history state note fail-soft", exc_info=True)
