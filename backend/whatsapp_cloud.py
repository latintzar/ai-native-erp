"""whatsapp_cloud.py — Meta WhatsApp Cloud API DIRECT rail (our own WABA, no BSP in the path).

WHY (2026-07-21): the Twilio-managed sender for +1 555 919 3021 died platform-side (error 63112 on
every send since ~09:00 UTC) while Meta showed the WABA healthy end to end — a middleman's stale
record silenced the whole product for a day. This module is the escape hatch AND the strategic
end-state Peter already named: WhatsApp messaging on Meta Cloud API direct (only Meta conversation
fees, no BSP markup, no third record to rot); Twilio stays for VOICE only.

THE RAIL SWITCH: twilio_wa.send_whatsapp routes here when ROCOTO_WA_RAIL=cloud — all 13 call sites
untouched. Inbound rides POST /meta/whatsapp/webhook (app.py), same pipeline as the Twilio route.

THE FLIP (gated — needs Peter's system-user token + explicit go; NEVER run automatically):
  1. Peter mints a System User token in Business Settings (scopes: whatsapp_business_messaging +
     whatsapp_business_management) → lands in /opt/rocoto/.env as WA_CLOUD_TOKEN (via peter-keys).
  2. Webhook: subscribe the app to the WABA (subscribe_app()) + set the callback in the developer
     console (or via API) → GET verify handshake answers with WA_CLOUD_VERIFY_TOKEN.
  3. register_number(pin) — POST /{phone_id}/register. THIS is the moment the number LEAVES Twilio
     (their inbound webhooks stop; a number holds ONE registration). Reversible only by
     re-registering back through Twilio's flow. Requires the two-step PIN if one is set.
  4. ROCOTO_WA_RAIL=cloud in .env → restart → the mouth is ours.

Fail behavior: send errors RAISE with the Graph error body (callers are fail-soft and log);
delivery statuses arrive on the webhook (statuses[]) and failed ones append ops.wa_send_failed +
park an alert — same contract as the Twilio status callback. With egress enabled, IDs returned are
wamid.* strings, and ONLY real ones: a 2xx with no wamid in the body raises CloudSendError rather
than inventing an id (an invented sid can never be matched by the status webhook, so the failure
could never be undone). The global egress sandbox returns an explicit synthetic marker before HTTP.
"""
from __future__ import annotations

import asyncio
import logging
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

import config

log = logging.getLogger("rocoto.whatsapp_cloud")

GRAPH = "https://graph.facebook.com/v21.0"

# Explicit UA on every Graph call (httpx's default "python-httpx/x.y" is a known WAF-block magnet).
_UA = "Rocoto/1.0 (+https://soyrocoto.com)"


def _digits(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())


def _headers() -> dict:
    return {"Authorization": f"Bearer {config.WA_CLOUD_TOKEN}", "User-Agent": _UA}


class CloudSendError(RuntimeError):
    """A Graph send that did NOT produce a real wamid. Raised instead of returning a placeholder id:
    a sid we invented is a silent success — the delivery-status webhook keys on the wamid, so a fake
    one can never be corrected later (2026-07-26, the async-reaction-failure fix)."""


# ── WHO WE SEND AS ─────────────────────────────────────────────────────────────────────────────
# Until 2026-08-17 the answer was one process-global env value, so every tenant's customers were
# answered from the SAME number — a US line displaying «Rocoto». Inbound was already per-tenant and
# the vitals were green, so multi-tenant looked finished from every surface except the one that
# sends. `from_id` is that hole closed: every send takes the number it must leave from, and the box
# default survives only as the last resort for the single-tenant rails that predate the change.
_SENDER: "ContextVar[str]" = ContextVar("wa_sender", default="")


def sender_scope(from_id: str):
    """Pin the sending number for this task. Returns the token — reset it in a finally.

    A ContextVar rather than a parameter on forty call sites: the mouth is reached through the
    mind's tool loop, and threading an id through every one of those would be forty chances to
    forget one. The same shape `agent_reply._SCOPE_OVERRIDE` already uses, for the same reason."""
    return _SENDER.set((from_id or "").strip())


def reset_sender(token) -> None:
    try:
        _SENDER.reset(token)
    except Exception:
        log.debug("wa sender reset fail-soft", exc_info=True)


def current_sender() -> str:
    """The number this task sends from: the pinned one, else the box default. Never empty in a
    configured deployment — `_post_messages` raises when it is, rather than guessing."""
    return _SENDER.get() or (config.WA_CLOUD_PHONE_ID or "")


async def _post_messages(payload: dict, *, from_id: str = "") -> str:
    """POST to /{phone_id}/messages; return the wamid. Raises on Graph errors (callers fail-soft).

    NO SILENT SUCCESS: a 2xx whose body carries no messages[0].id is a FAILURE here, not the old
    'wamid.unknown' placeholder — that placeholder was recorded as the sid of a real send, could
    never be matched by an inbound status webhook, and so left a permanent phantom in the log."""
    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] suppressed Cloud WhatsApp message")
        return "SANDBOX-wa"
    sender = (from_id or "").strip() or current_sender()
    if not (config.WA_CLOUD_TOKEN and sender):
        raise RuntimeError("cloud rail not configured (WA_CLOUD_TOKEN / no sending number)")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/{sender}/messages",
                         headers=_headers(), json=payload)
    if r.status_code >= 400:
        raise CloudSendError(f"cloud send failed {r.status_code}: {r.text[:400]}")
    try:
        data = r.json()
    except Exception:
        raise CloudSendError(f"cloud send returned non-JSON {r.status_code}: {r.text[:200]}")
    wamid = ((data.get("messages") or [{}])[0].get("id")) or ""
    if not wamid:
        raise CloudSendError(f"cloud send returned no wamid ({r.status_code}): {r.text[:200]}")
    return wamid


async def send_text(to_phone: str, text: str, *, from_id: str = "") -> str:
    """Send a session (freeform) text. to_phone = +E.164 or digits. Returns the wamid.

    `from_id` overrides the task's pinned sender for one message; almost nothing should need it —
    prefer `sender_scope()` around the turn, so every message a turn produces leaves from one
    number rather than each call site deciding."""
    return await _post_messages({
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": _digits(to_phone), "type": "text",
        "text": {"preview_url": True, "body": text or ""},
    }, from_id=from_id)


# ── presence suite (2026-07-25): typing indicator + reactions on the CLOUD rail ─────────────
async def send_typing_indicator(inbound_wamid: str) -> bool:
    """Show WhatsApp's "typing…" bubble to the sender of `inbound_wamid` — the CLOUD-rail counterpart
    of twilio_wa.send_typing_indicator (whose Twilio Typing.json 400s on wamids; the journal showed
    exactly that after the rail switch). Meta's contract: POST /{phone_id}/messages with
    {"status":"read","message_id":<inbound wamid>,"typing_indicator":{"type":"text"}} — marks the
    inbound READ (blue ticks) AND shows the bubble; it clears when our reply arrives or after ~25s.
    FULLY fail-soft (returns False): presence is a nicety and must NEVER block or crash the reply path."""
    wamid = (inbound_wamid or "").strip()
    if not wamid:
        return False
    try:
        await _post_messages({
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": wamid,
            "typing_indicator": {"type": "text"},
        })
        return True
    except Exception:
        log.debug("cloud typing indicator failed for %s (fail-soft)", wamid, exc_info=True)
        return False


# ── reaction limits, empirically established (2026-07-26) ───────────────────────────────────
# Meta accepts the POST and answers 200 with a wamid even when the reaction can never be delivered;
# the refusal arrives LATER as a delivery-status webhook (status=failed, errors[].code=131009). So a
# 200 here means "accepted", never "the customer saw it" — the truth is the status webhook, and the
# cheap pre-flight (actions.send_reaction_as_rocoto) keeps most of these from ever being sent.
REACTION_MAX_AGE_DAYS = 30       # Meta drops a reaction to a message older than 30 days
ERR_REACTION_TARGET = "131009"   # "parameter value is not valid" — the target is stale/deleted/not reactable


async def send_reaction(to_phone: str, target_wamid: str, emoji: str) -> str:
    """React with an emoji to a specific message (type=reaction). An EMPTY emoji REMOVES a prior
    reaction (Meta's contract). Returns the response id. Raises on Graph errors — callers are
    fail-soft, same contract as every other send here. Gate-exempt by design (no money can ride an
    emoji) but the caller (actions.send_reaction_as_rocoto) still EVENTS it as msg.sent kind=reaction.

    A 200 from this call is NOT delivery: an invalid target (>30 days old, deleted, itself a
    reaction) fails ASYNCHRONOUSLY with error 131009 on the status webhook, which app.py turns into
    ops.reaction_failed + a projection rollback."""
    target = (target_wamid or "").strip()
    if not target:
        raise ValueError("send_reaction needs the wamid of the message to react to")
    return await _post_messages({
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": _digits(to_phone), "type": "reaction",
        "reaction": {"message_id": target, "emoji": emoji or ""},
    })


# ── outbound media (2026-07-25 fix for Meta error 131053) ───────────────────────────────────
# The old two-way guess (pdf/xlsx/csv → document, EVERYTHING else → image) sent .ogg voice notes as
# type=image by LINK; Meta fetched the audio, failed to process it as an image, and every voice reply
# died async with 131053 ("media upload error") from the day the Twilio WA rail was retired (Jul 23).
# Fix: (a) a real extension→type map so audio/video are typed honestly; (b) the ROBUST send pattern —
# UPLOAD the bytes to Meta's media API (→ media_id) and send by id, falling back to the link form only
# if the upload path fails. Our own /wamedia/ files are read straight off disk (no HTTP round-trip).
_KIND_BY_EXT = {
    "ogg": "audio", "opus": "audio", "mp3": "audio", "m4a": "audio", "aac": "audio", "amr": "audio",
    "mp4": "video", "3gp": "video",
    "pdf": "document", "xlsx": "document", "xls": "document", "csv": "document",
    "doc": "document", "docx": "document", "ppt": "document", "pptx": "document", "txt": "document",
}
_MIME_BY_EXT = {
    "ogg": "audio/ogg", "opus": "audio/ogg", "mp3": "audio/mpeg", "m4a": "audio/mp4",
    "aac": "audio/aac", "amr": "audio/amr", "mp4": "video/mp4", "3gp": "video/3gpp",
    "pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
}


def _url_ext(media_url: str) -> str:
    """Lowercase file extension of the URL path ('' when none). Query string ignored."""
    name = Path(urlparse(media_url).path).name.lower()
    return name.rsplit(".", 1)[-1] if "." in name else ""


async def upload_media(data: bytes, mime: str, filename: str = "media.bin", *,
                       from_id: str = "") -> str:
    """POST /{phone_id}/media — upload bytes to Meta, return the media_id. Raises on Graph errors.
    (Empirically verified 2026-07-25 with the exact 131053-failed voice note: audio/ogg uploads clean.)

    THE UPLOAD MUST LEAVE FROM THE NUMBER THAT WILL SEND IT (2026-08-19). A media_id belongs to the
    business phone number that uploaded it — send it from a different number and Meta rejects the
    id, not the bytes. This hardcoded `config.WA_CLOUD_PHONE_ID` while `_post_messages` had already
    moved to the per-tenant `current_sender()` (2026-08-17), so on a multi-tenant box every picture,
    voice note and document was uploaded to the BOX DEFAULT and then sent from the tenant's own
    number: a send that can only fail. It resolves the sender the same way every other send here
    does, so the single-tenant behaviour is byte-identical (nothing pinned ⇒ the box default)."""
    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] suppressed Cloud WhatsApp media upload")
        return "SANDBOX-media"
    sender = (from_id or "").strip() or current_sender()
    if not (config.WA_CLOUD_TOKEN and sender):
        raise RuntimeError("cloud rail not configured (WA_CLOUD_TOKEN / no sending number)")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            f"{GRAPH}/{sender}/media", headers=_headers(),
            data={"messaging_product": "whatsapp", "type": mime},
            files={"file": (filename, data, mime)},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"cloud media upload failed {r.status_code}: {r.text[:400]}")
    media_id = (r.json() or {}).get("id") or ""
    if not media_id:
        raise RuntimeError(f"cloud media upload returned no id: {r.text[:200]}")
    return media_id


async def _resolve_media_bytes(media_url: str, ext: str) -> tuple[bytes, str]:
    """(bytes, mime) for an outbound media URL. Our own /wamedia/ files come straight off disk
    (MEDIA_DIR/out — the exact dir app.py serves that route from); anything else is fetched over
    HTTP. Raises on failure (caller falls back to the link send)."""
    mime = _MIME_BY_EXT.get(ext, "application/octet-stream")
    pr = urlparse(media_url)
    name = Path(pr.path).name
    if pr.path.startswith("/wamedia/") and name and ".." not in name:
        p = Path(config.MEDIA_DIR) / "out" / name
        if p.is_file():
            return await asyncio.to_thread(p.read_bytes), mime
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        r = await c.get(media_url, headers={"User-Agent": _UA})
        r.raise_for_status()
        ct = (r.headers.get("content-type") or "").split(";")[0].strip()
        return r.content, (ct or mime)


async def send_media(to_phone: str, media_url: str, caption: str = "", *, from_id: str = "") -> str:
    """Send media (audio/image/video/document) — upload-by-media-id first, link as fallback.
    Returns the wamid. An .ogg here is a voice note: typed 'audio' (audio/ogg + opus = WhatsApp PTT).
    Cloud API quirk: the audio object has NO caption field — a caption rides after it as a text."""
    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] suppressed Cloud WhatsApp media to %s", to_phone)
        return "SANDBOX-wa"
    ext = _url_ext(media_url)
    kind = _KIND_BY_EXT.get(ext, "image")

    obj: dict[str, Any]
    try:
        data, mime = await _resolve_media_bytes(media_url, ext)
        media_id = await upload_media(data, mime,
                                      filename=Path(urlparse(media_url).path).name or "media.bin",
                                      from_id=from_id)
        obj = {"id": media_id}
    except Exception:
        log.warning("cloud media upload path failed for %s — falling back to link send", media_url,
                    exc_info=True)
        obj = {"link": media_url}

    if caption and kind != "audio":
        obj["caption"] = caption
    wamid = await _post_messages({
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": _digits(to_phone), "type": kind, kind: obj,
    }, from_id=from_id)
    if caption and kind == "audio":
        # audio can't carry a caption — deliver it as a follow-up text (fail-soft: audio already out).
        # The follow-up MUST leave from the same number as the note it explains.
        try:
            await send_text(to_phone, caption, from_id=from_id)
        except Exception:
            log.exception("cloud audio caption follow-up text failed for %s", to_phone)
    return wamid


async def send_image_bytes(to_phone: str, data: bytes, *, caption: str = "",
                           filename: str = "image.png", mime: str = "image/png",
                           from_id: str = "") -> str:
    """Send an image we COMPOSED IN MEMORY — upload the bytes, send by media_id. Returns the wamid.

    WHY BYTES AND NOT A URL (2026-08-19, the order-confirmation card). `send_media` above takes a
    URL, so a picture we drew ourselves had to be written to MEDIA_DIR/out first and handed to Meta
    as a public `/wamedia/` link. That round-trip is where the confirmation card has already been
    lost once: the earlier `/media/` route is per-user authed, answered 401 to Meta's anonymous
    fetcher, and the image silently never arrived while the question sent beside it did (Peter,
    2026-07-28: «keeps saying es correcto tu pedido but doesn't send the image of the pedido»). A
    composed image has no reason to exist on a public URL at all — nothing outside this process
    needs to read it, and the file left on disk afterwards is a customer's order sitting in a
    world-readable directory. So: bytes in, media_id out, nothing published."""
    if not data:
        raise ValueError("send_image_bytes needs the image bytes")
    media_id = await upload_media(data, mime, filename=filename, from_id=from_id)
    obj: dict[str, Any] = {"id": media_id}
    if caption:
        obj["caption"] = caption
    return await _post_messages({
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": _digits(to_phone), "type": "image", "image": obj,
    }, from_id=from_id)


# ── INTERACTIVE / ONE-TAP (2026-07-26) — the honest replacement for polls ───────────────────
# Polls are NOT available to us (no Cloud API surface); PIN is built-but-not-enabled (131000). What IS
# empirically supported on our WABA: reply BUTTONS (≤3) and LIST messages (≤10 rows total). A tap comes
# back as an inbound type=interactive carrying {id,title} + context.id = the wamid we asked with.
#
# Meta's caps are enforced HERE, in code, with a typed error — never silent truncation. A cropped option
# is a changed question: the customer taps something we never offered and the whole answer is a lie.
class InteractiveLimitError(ValueError):
    """A Meta interactive-message limit was violated. Raised BEFORE any Graph call."""


IA_MAX_BUTTONS = 3           # reply buttons per message
IA_MAX_ROWS = 10             # list rows — TOTAL across every section
IA_MAX_SECTIONS = 10
IA_BUTTON_TITLE_MAX = 20     # reply-button title
IA_ROW_TITLE_MAX = 24        # list-row title
IA_ROW_DESC_MAX = 72
IA_ID_MAX = 256
IA_BODY_MAX = 1024
IA_HEADER_MAX = 60
IA_FOOTER_MAX = 60
IA_BUTTON_LABEL_MAX = 20     # the "open the list" button label
IA_SECTION_TITLE_MAX = 24


def _ia_str(value: Any, field: str, limit: int, *, required: bool = True) -> str:
    """One validated interactive string field. Raises InteractiveLimitError — never truncates."""
    s = (value or "").strip() if isinstance(value, str) else ("" if value is None else str(value).strip())
    if required and not s:
        raise InteractiveLimitError(f"{field} is required and cannot be empty")
    if len(s) > limit:
        raise InteractiveLimitError(f"{field} is {len(s)} chars, Meta's limit is {limit}: {s[:40]!r}")
    return s


def _ia_envelope(to_phone: str, kind: str, body: str, action: dict,
                 header: Optional[str], footer: Optional[str],
                 header_media: Optional[dict] = None) -> dict:
    """The shared type=interactive payload (button|list) with the optional header/footer.

    `header_media` is {"id": <media_id>} or {"link": <url>} and turns the header into a PICTURE —
    the WhatsApp message shape everyone already knows: the image, the sentence, the taps, one
    bubble. Meta allows exactly ONE header, so a media header and a text header are mutually
    exclusive and asking for both is refused rather than silently resolved in someone's favour."""
    interactive: dict[str, Any] = {
        "type": kind,
        "body": {"text": _ia_str(body, "body", IA_BODY_MAX)},
        "action": action,
    }
    if header_media:
        if header:
            raise InteractiveLimitError(
                "a message carries ONE header: an image header and a text header cannot both ride")
        # LIST MESSAGES TAKE A TEXT HEADER AND NOTHING ELSE — Meta's own constraint, enforced here
        # because the alternative is a 400 from Graph at send time with the customer waiting.
        if kind != "button":
            raise InteractiveLimitError(
                f"an image header rides a BUTTON message; a {kind} message takes only a text header")
        interactive["header"] = {"type": "image", "image": dict(header_media)}
    elif header:
        interactive["header"] = {"type": "text", "text": _ia_str(header, "header", IA_HEADER_MAX)}
    if footer:
        interactive["footer"] = {"text": _ia_str(footer, "footer", IA_FOOTER_MAX)}
    return {"messaging_product": "whatsapp", "recipient_type": "individual",
            "to": _digits(to_phone), "type": "interactive", "interactive": interactive}


async def send_interactive_buttons(to_phone: str, body: str, buttons: list[dict],
                                   header: Optional[str] = None,
                                   footer: Optional[str] = None, *,
                                   header_image_id: str = "",
                                   header_image_link: str = "") -> str:
    """Reply BUTTONS (≤3). `buttons` = [{"id": ..., "title": ...}] — the id comes back on the tap.
    Returns the wamid. Raises InteractiveLimitError on any cap violation (before any Graph call),
    RuntimeError on a Graph error — same contract as every other send here.

    `header_image_id` (preferred, from `upload_media`) or `header_image_link` puts a picture above
    the question. Prefer the id: a link makes Meta fetch a URL from the outside, which is exactly
    how the order card was lost before (see `send_image_bytes`).

    NO `from_id` HERE, on purpose: the interactive family takes its sending number from the task's
    `sender_scope()`, which is this module's own stated preference («prefer sender_scope() around
    the turn, so every message a turn produces leaves from one number rather than each call site
    deciding»). Both halves of an image+buttons send then resolve the same number from the same
    ContextVar, so the media_id and the message that carries it can never disagree."""
    if not isinstance(buttons, list) or not buttons:
        raise InteractiveLimitError("at least 1 reply button is required")
    if len(buttons) > IA_MAX_BUTTONS:
        raise InteractiveLimitError(
            f"{len(buttons)} reply buttons requested, Meta allows {IA_MAX_BUTTONS} "
            f"— use a list message for more options")
    seen: set[str] = set()
    out = []
    for i, b in enumerate(buttons):
        if not isinstance(b, dict):
            raise InteractiveLimitError(f"button {i} must be an object with id + title")
        bid = _ia_str(b.get("id"), f"button[{i}].id", IA_ID_MAX)
        title = _ia_str(b.get("title"), f"button[{i}].title", IA_BUTTON_TITLE_MAX)
        if bid in seen:
            raise InteractiveLimitError(f"duplicate button id {bid!r} — a tap must be unambiguous")
        seen.add(bid)
        out.append({"type": "reply", "reply": {"id": bid, "title": title}})
    media: Optional[dict] = None
    if header_image_id and header_image_link:
        raise InteractiveLimitError("give the image header an id OR a link, never both")
    if header_image_id:
        media = {"id": header_image_id.strip()}
    elif header_image_link:
        media = {"link": header_image_link.strip()}
    return await _post_messages(
        _ia_envelope(to_phone, "button", body, {"buttons": out}, header, footer, media))


async def send_image_with_buttons(to_phone: str, image: bytes, body: str, buttons: list[dict], *,
                                  footer: Optional[str] = None, filename: str = "pedido.png",
                                  mime: str = "image/png") -> str:
    """A PICTURE, A SENTENCE AND THE TAPS — in ONE message. Returns the wamid.

    This is the shape a person already recognises on WhatsApp, and it is what Raquel's customers
    were owed and never got (Peter, 2026-08-19: «con botones en mensajes para responder a cosas y
    con imágenes con confirmaciones de orden. Eso no estaba sucediendo»). Sent as two messages the
    picture and the question can arrive out of order, and the picture can fail on its own and leave
    a question about an order the customer cannot see — which is precisely the failure the earlier
    `ask_order_confirm` hit.

    NO GATE LIVES HERE. This is the wire, like every other send in this module; MODO SOMBRA and the
    money gate belong to the caller (`order_receipt.send`, which runs both once before choosing a
    wire format)."""
    media_id = await upload_media(image, mime, filename=filename)
    return await send_interactive_buttons(to_phone, body, buttons, footer=footer,
                                          header_image_id=media_id)


async def send_interactive_list(to_phone: str, body: str, button_label: str, sections: list[dict],
                                header: Optional[str] = None,
                                footer: Optional[str] = None) -> str:
    """A LIST message: `button_label` opens the sheet, `sections` = [{"title":…, "rows":[{"id","title",
    "description"?}]}]. HARD cap: 10 rows TOTAL across all sections (not per section — the trap).
    Returns the wamid. Raises InteractiveLimitError on any cap violation, RuntimeError on Graph errors."""
    if not isinstance(sections, list) or not sections:
        raise InteractiveLimitError("at least 1 section is required")
    if len(sections) > IA_MAX_SECTIONS:
        raise InteractiveLimitError(f"{len(sections)} sections requested, Meta allows {IA_MAX_SECTIONS}")
    label = _ia_str(button_label, "button_label", IA_BUTTON_LABEL_MAX)
    total = sum(len((s or {}).get("rows") or []) for s in sections)
    if total == 0:
        raise InteractiveLimitError("at least 1 row is required")
    if total > IA_MAX_ROWS:
        raise InteractiveLimitError(
            f"{total} list rows requested across {len(sections)} section(s), Meta allows "
            f"{IA_MAX_ROWS} TOTAL — ask a narrower question")
    seen: set[str] = set()
    out_sections = []
    for si, s in enumerate(sections):
        if not isinstance(s, dict):
            raise InteractiveLimitError(f"section {si} must be an object with rows")
        rows = []
        for ri, r in enumerate(s.get("rows") or []):
            if not isinstance(r, dict):
                raise InteractiveLimitError(f"section[{si}].row[{ri}] must be an object with id + title")
            rid = _ia_str(r.get("id"), f"section[{si}].row[{ri}].id", IA_ID_MAX)
            row: dict[str, Any] = {
                "id": rid,
                "title": _ia_str(r.get("title"), f"section[{si}].row[{ri}].title", IA_ROW_TITLE_MAX),
            }
            desc = _ia_str(r.get("description"), f"section[{si}].row[{ri}].description",
                           IA_ROW_DESC_MAX, required=False)
            if desc:
                row["description"] = desc
            if rid in seen:
                raise InteractiveLimitError(f"duplicate row id {rid!r} — a tap must be unambiguous")
            seen.add(rid)
            rows.append(row)
        sec: dict[str, Any] = {"rows": rows}
        stitle = _ia_str(s.get("title"), f"section[{si}].title", IA_SECTION_TITLE_MAX, required=False)
        if stitle:
            sec["title"] = stitle
        out_sections.append(sec)
    return await _post_messages(
        _ia_envelope(to_phone, "list", body, {"button": label, "sections": out_sections},
                     header, footer))


# ── PIN — the contract Meta's schema KNOWS but our WABA will not execute (2026-07-26) ────────
# Empirically established, do not re-derive (it cost real probes):
#   · the Cloud API VALIDATES {"type":"pin","pin":{"type":"pin"|"unpin","message_id":<wamid>,
#     "expiration_days":1..30}} — a wrong field name is rejected as a schema error, this one is not;
#   · EXECUTING it answers 131000 on our WABA — the feature is BUILT, just not enabled for us;
#   · the public docs still list pinning as unsupported. Schema and docs disagree.
# So the honest state is NOT-YET-AVAILABLE, and the code below exists to be READY — plus a weekly
# probe (brain/pin_watch.py) that tells us the day it opens instead of us re-discovering it by luck.
#
# INERT BY DEFAULT: both senders refuse unless config.ROCOTO_WA_PIN_ENABLED is on, BEFORE building a
# payload. With the flag off nothing in this process can put a pin on the wire — that is the whole
# safety story, and it is why the probe needs no separate arming switch.
class PinDisabledError(RuntimeError):
    """A pin/unpin was attempted with ROCOTO_WA_PIN_ENABLED off. Raised before any payload is built."""


class PinLimitError(ValueError):
    """A pin argument violates Meta's validated schema. Raised BEFORE any Graph call — never coerced:
    silently clamping an expiration would pin for a duration nobody asked for."""


PIN_MIN_EXPIRATION_DAYS = 1
PIN_MAX_EXPIRATION_DAYS = 30
PIN_DEFAULT_EXPIRATION_DAYS = 30
ERR_PIN_NOT_ENABLED = "131000"   # "Something went wrong" — what our WABA answers to a valid pin today


def _pin_envelope(to_phone: str, target_wamid: str, action: str,
                  expiration_days: Optional[int] = None) -> dict:
    """The validated pin/unpin payload. `action` ∈ {'pin','unpin'}; `expiration_days` rides ONLY on a
    pin (the schema was validated with it present on a pin; whether unpin tolerates it is UNVERIFIED,
    so we do not send what we have not seen accepted). Raises PinLimitError / PinDisabledError."""
    if not config.ROCOTO_WA_PIN_ENABLED:
        raise PinDisabledError(
            "pin/unpin refused: ROCOTO_WA_PIN_ENABLED is off (the capability is not enabled for our "
            "WABA — Meta answers 131000; brain/pin_watch watches for the day it opens)")
    if action not in ("pin", "unpin"):
        raise PinLimitError(f"pin action must be 'pin' or 'unpin', got {action!r}")
    target = (target_wamid or "").strip()
    if not target.startswith("wamid."):
        raise PinLimitError(
            f"pin target must be a cloud-rail wamid, got {target[:40]!r} — only Meta ids are pinnable")
    pin: dict[str, Any] = {"type": action, "message_id": target}
    if action == "pin":
        if isinstance(expiration_days, bool) or not isinstance(expiration_days, int):
            raise PinLimitError(f"expiration_days must be an int, got {expiration_days!r}")
        if not (PIN_MIN_EXPIRATION_DAYS <= expiration_days <= PIN_MAX_EXPIRATION_DAYS):
            raise PinLimitError(
                f"expiration_days is {expiration_days}, Meta's range is "
                f"{PIN_MIN_EXPIRATION_DAYS}..{PIN_MAX_EXPIRATION_DAYS}")
        pin["expiration_days"] = expiration_days
    return {"messaging_product": "whatsapp", "recipient_type": "individual",
            "to": _digits(to_phone), "type": "pin", "pin": pin}


async def pin_message(to_phone: str, target_wamid: str,
                      expiration_days: int = PIN_DEFAULT_EXPIRATION_DAYS) -> str:
    """Pin a message at the top of a chat for `expiration_days` (1..30). Returns the response id.
    TODAY this raises CloudSendError carrying 131000 — the capability is not enabled for our WABA.
    Refuses outright (PinDisabledError) while ROCOTO_WA_PIN_ENABLED is off."""
    return await _post_messages(_pin_envelope(to_phone, target_wamid, "pin", expiration_days))


async def unpin_message(to_phone: str, target_wamid: str) -> str:
    """Remove a pin. Returns the response id. Same 131000 reality and same flag guard as pin_message."""
    return await _post_messages(_pin_envelope(to_phone, target_wamid, "unpin"))


def is_pin_not_enabled_error(err: BaseException) -> bool:
    """True when a failed pin carries Meta's 131000 — i.e. 'still not enabled for us', the ONE outcome
    the weekly probe treats as normal. Anything else (auth, network, a shape rejection) is a real
    fault and must be reported as one, never swallowed as 'not open yet'."""
    return ERR_PIN_NOT_ENABLED in str(err)


async def send_template(to_phone: str, name: str, lang: str = "es",
                        components: Optional[list] = None) -> str:
    """Send an approved template by NAME (Meta-side names, not Twilio HX sids)."""
    tpl: dict[str, Any] = {"name": name, "language": {"code": lang}}
    if components:
        tpl["components"] = components
    return await _post_messages({
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": _digits(to_phone), "type": "template", "template": tpl,
    })


# ── the FLIP helpers (gated; each is a deliberate operator action, never auto-run) ───────────
async def register_number(pin: str) -> dict:
    """POST /{phone_id}/register — claims the number's Cloud API registration for US (and thereby
    OFF Twilio). Requires the two-step PIN if the number has one set. Returns the Graph response."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/{config.WA_CLOUD_PHONE_ID}/register", headers=_headers(),
                         json={"messaging_product": "whatsapp", "pin": str(pin)})
    return {"status": r.status_code, "body": r.json() if r.content else {}}


async def subscribe_app() -> dict:
    """POST /{waba_id}/subscribed_apps — subscribe the token's app to this WABA's webhooks."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/{config.WA_CLOUD_WABA_ID}/subscribed_apps", headers=_headers())
    return {"status": r.status_code, "body": r.json() if r.content else {}}


async def download_media(media_id: str) -> tuple[bytes, str]:
    """Meta media two-step: GET /{media_id} -> {url, mime_type}; GET url (Bearer) -> bytes.
    So an inbound voice note / photo / doc on the cloud rail is fetched exactly like Twilio's, then
    ridden through the SAME _do_process_media pipeline (transcribe/OCR/extract -> ingest -> reply)."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(f"{GRAPH}/{media_id}", headers=_headers())
        r.raise_for_status()
        meta = r.json()
        url = meta.get("url")
        mime = meta.get("mime_type", "application/octet-stream")
        r2 = await c.get(url, headers=_headers())
        r2.raise_for_status()
        return r2.content, mime


async def phone_status() -> dict:
    """READ-ONLY diagnostic: what Meta itself says about the number (platform, name status,
    quality, throughput). Useful before/after the flip and for the Twilio ticket evidence."""
    fields = "display_phone_number,verified_name,name_status,quality_rating,platform_type,throughput,status"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{GRAPH}/{config.WA_CLOUD_PHONE_ID}?fields={fields}", headers=_headers())
    return {"status": r.status_code, "body": r.json() if r.content else {}}
