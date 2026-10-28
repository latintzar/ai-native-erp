"""demo_media.py — /demo HEARS AND SEES: voice notes in, photos in (SPEC §17.56, build order ⑤).

Typing is the demo's first input and the least real one. A customer talking is the most common real
input after text, and a photo of a handwritten note or a supplier's price sheet is the highest-value
one there is (§17.20). A demo that cannot take either is showing a chat box, not the product.

────────────────────────────────────────────────────────────────────────────────────────────────────
THE ONE ARCHITECTURAL CLAIM, and everything below exists to make it true rather than to assert it:

    A SPOKEN ORDER AND A PHOTOGRAPHED ORDER PRODUCE THE SAME ORDER AS A TYPED ONE.

So this module contains NO order logic, NO matching, NO reply. It does exactly two things — turn
sound into text and turn pixels into text — and then hands that text to `demo_flow.turn_from_media`,
which is `demo_flow.chat`'s own guts (one `_turn`, three doors). If the four-quadrant screen ever
shows a different order for a voice note than for the same sentence typed, that is a bug in the
runtime, not a fork here, because there is nowhere here for a fork to live.

────────────────────────────────────────────────────────────────────────────────────────────────────
THE RAILS THIS RIDES, and the evidence each is the REAL one (not a second implementation):

  · VOICE → `transcribe.deepgram_diarize` + `parse_utterances` + `polish_sync` + `confidence.classify`.
    That is byte-for-byte the WhatsApp inbound voice-note path (`app._do_process_media`, the
    `mtype == "audio"` branch): the same nova-3 call, the same utterance parse, the same faithful
    Sonnet polish, and the same PERCEPTION step that classifies transcription confidence AT THE SENSE
    before any reasoning sees the text. One Deepgram client, one key, one set of params, in
    transcribe.py — this module does not own an HTTP call to Deepgram and must never grow one.

    ⚠️ `deepgram_diarize` asks for diarization unconditionally, and a demo voice note is one speaker.
    Rather than grow a parameter on a shared organ for a cosmetic difference, the `Speaker N:`
    prefixes are stripped from the raw text — which is exactly what the product's other single-
    speaker caller already does (`brain/onboarding_ext.voice_rule`). Same rail, same treatment.

  · PHOTO → `transcribe.ocr_image_sync(bytes, mime, caption)`. That is the identical call, with the
    identical argument shape, that the WhatsApp inbound PHOTO-ORDER path makes
    (`app._do_process_media`, the `mtype == "image"` branch) before handing the text to the mind.

    HONEST REGISTER, because the brief asked for it: the real photo→order path is NOT a single
    callable. On WhatsApp it is a composition — `_do_process_media` OCRs, writes the transcript onto
    a `whatsapp_messages` row, appends a spine sense and fires `_extract_for_msg`. Everything in that
    wrapper except the OCR call is WhatsApp-rail plumbing (Meta media download, the projection row,
    MEDIA_DIR, the FCM push); none of it can run for a demo session, which has no phone, no message
    row and no Meta media id. So the reuse is at the ORGAN, which is where the product's own
    understanding of a photo actually lives, and the composition after it is `demo_flow`'s single
    `_turn`. What is deliberately NOT reused: `brain/skuparse`'s `foto` source kind — that reads a
    photo as a CATALOGUE (a price sheet → SKU rows), which is the /demo catalogue door's job and is
    already wired at `POST /api/demo/session/{t}/catalog`. A photo of an ORDER is a different
    question asked of the same pixels, and answering it with skuparse would return SKUs where the
    screen expects order lines.

────────────────────────────────────────────────────────────────────────────────────────────────────
WHERE THE BYTES LAND — the whole answer, because a public endpoint that accumulates media is a
finding waiting to happen:

    NOWHERE. They are never written to disk, never put in a bucket, never stored in a column, and
    never served back out. They exist in this process's memory for the length of one request, go to
    Deepgram (audio) or the Anthropic vision call (images), and are dropped when the request ends.
    There is no `/media/<id>` for a demo upload because there is no file. The WhatsApp rail writes to
    MEDIA_DIR because a real thread must be re-openable months later; a demo has no such promise to
    keep, so it makes no such copy — which is also the strongest possible answer to «where does my
    price list go?», the question the whole §17.56c sign-in exists to answer honestly.

What DOES persist is one small `demo_media` row per upload, carrying the extracted TEXT (the same
text the spine already holds as the turn's message), the size in bytes, the mime, the state and the
turn's own result — no payload. It exists for three reasons and no others: §17.20's per-image states
on both screens, idempotent retries keyed by the phone's `client_id`, and the state doc the desk
re-renders from. Rows are reaped with their session (`reap`, called on a throttle from this module
and available to cron), so the table cannot grow without bound either.

EXIF: stripped by construction. Every accepted image is re-encoded through Pillow before the vision
call, and a re-encode writes no EXIF unless asked. Orientation is the one tag that must survive as
PIXELS — `ImageOps.exif_transpose` is applied first, so an iPhone's sideways portrait shot is upright
for the OCR and its GPS coordinates never leave the box.

es-ES is canonical on every visitor-facing string (LOCKED LAW). Code, comments, logs in English.
"""
from __future__ import annotations

import asyncio
import io
import logging
import re
import secrets
import time
from typing import Any, Optional

import config
import db
import demo_flow

log = logging.getLogger("rocoto.demo_media")

# ── the two kinds, and the ONE vocabulary of states (§17.20's table, on both screens) ─────────────
KIND_VOICE = "voz"
KIND_PHOTO = "foto"
STATES = ("recibida", "leyendo", "leida", "fallida")

# ── what the door accepts. The DECLARED content-type is the client's CLAIM; the sniff below is the
# evidence, and the evidence wins. A browser that labels a webm `application/octet-stream` still gets
# in; a .exe renamed .jpg does not. ────────────────────────────────────────────────────────────────
AUDIO_MIMES = ("audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav")
IMAGE_MIMES = ("image/jpeg", "image/png", "image/webp", "image/gif", "image/heic")

# Anthropic's vision endpoint accepts exactly these four; anything else must be converted first
# (`_clean_image` does), never passed through and hoped for — `transcribe.ocr_image_sync` silently
# relabels an unknown mime as image/jpeg, which turns a HEIC into a 400 with no explanation.
VISION_MIMES = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"})

# NOTE ON `vital_rls_coverage`: that gate discovers its subjects by `column_name='scope'`, and this
# table deliberately has none. It is keyed by `sid` — a /demo flow handle — and holds no scope-keyed
# runtime memory; the isolation that matters (the world a turn reads and writes) is enforced where it
# always is, on the `test.demo.…` scope by the RLS GUC in `demo_flow._turn`. Adding a scope column
# here would put this table inside the RLS regime and would REQUIRE a matching entry in
# schema_rls.sql in the same change. It has none, so it does not, and this comment is the receipt.

_schema_ready = False


async def ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


# ── the sentences. Every refusal a visitor can trip is a Spanish sentence they can act on ─────────
ES = {
    "too_big_voice": "Ese audio es demasiado largo para la prueba. Mándame una nota de voz corta, "
                     "como la que le mandarías a tu proveedor.",
    "too_big_photo": "Esa foto pesa demasiado. Hazla otra vez con menos resolución y te la leo.",
    "too_long": "Esa nota de voz es muy larga para la prueba (el máximo son {max} segundos). "
                "Mándame una más corta y te la escucho entera.",
    "empty": "No me ha llegado nada. Inténtalo otra vez.",
    "bad_audio": "No he podido leer ese audio. Grábalo otra vez desde el micrófono y te escucho.",
    "bad_image": "No he podido abrir esa imagen. Prueba con una foto normal (JPG o PNG).",
    "heic": "Tu móvil la ha mandado en HEIC y aquí no puedo abrirla. En Ajustes › Cámara › Formatos "
            "elige «Más compatible», o mándamela como JPG.",
    "silence": "No he oído nada en esa nota de voz. Prueba a grabarla otra vez, más cerca del "
               "micrófono.",
    "unreadable": "No he sacado nada legible de esa foto. Prueba con más luz, o enfocando solo la "
                  "parte donde está el pedido.",
    "stt_down": "Ahora mismo no puedo escuchar audios. Escríbeme el pedido y lo cojo igual.",
    "ocr_down": "Ahora mismo no puedo leer fotos. Escríbeme lo que pone y lo cojo igual.",
    "in_flight": "Todavía estoy leyendo esa. Dame un segundo.",
    "rate": "Vas muy rápido para la prueba. Espera un momento y sigue.",
    "off": "Los audios y las fotos no están disponibles ahora mismo. Escríbeme el pedido y lo cojo "
           "igual.",
}


# ══ ① SNIFFING — the declared type is a claim, the bytes are the evidence ═════════════════════════

def sniff_mime(data: bytes) -> str:
    """Canonical mime from MAGIC BYTES alone, or '' when nothing here recognises it.

    PURE and synchronous on purpose: it is the one guard a smoke test can exercise with no DB, no
    network and no keys, and it is the guard that decides whether a stranger's bytes reach a paid
    API. Ordered cheapest-first; every container we can actually receive from a browser or a phone
    is here, and anything else is refused rather than guessed at."""
    b = data or b""
    if len(b) < 12:
        return ""
    # ── images ────────────────────────────────────────────────────────────────────────────────
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] in (b"GIF8",):
        return "image/gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    if b[:4] == b"RIFF" and b[8:12] == b"WAVE":
        return "audio/wav"
    # ── ISO-BMFF (mp4 / m4a / HEIC all share the ftyp box; the BRAND is what separates them) ──
    if b[4:8] == b"ftyp":
        brand = b[8:12]
        if brand in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"heim", b"heis"):
            return "image/heic"
        if brand in (b"avif", b"avis"):
            return "image/avif"
        return "audio/mp4"          # m4a / mp4 audio — a video mp4 lands here too and Deepgram
        #                              reads its audio track, which is the honest behaviour anyway.
    # ── audio ─────────────────────────────────────────────────────────────────────────────────
    if b[:4] == b"OggS":
        return "audio/ogg"
    if b[:4] == b"\x1a\x45\xdf\xa3":
        # EBML — WebM and Matroska share it. MediaRecorder's default output on Chrome/Edge/Android.
        return "audio/webm"
    if b[:3] == b"ID3" or (b[0] == 0xFF and (b[1] & 0xE0) == 0xE0):
        return "audio/mpeg"
    return ""


def audio_seconds(mime: str, data: bytes) -> Optional[float]:
    """Best-effort duration BEFORE a byte is sent to Deepgram, or None when the container will not
    say cheaply.

    Deliberately partial, and the gap is named rather than papered over: WebM from a live
    MediaRecorder is written in streaming mode and usually carries `Duration: unknown`, and an MP3's
    length needs a full frame walk. So the pre-flight check bites for WAV / Ogg / MP4 and returns
    None for the most common browser case — which is why the AUTHORITATIVE duration check is the one
    on Deepgram's OWN reported duration afterwards (`voice()` below). Three layers, in order of how
    early they can fire: the byte cap at the socket, this when the container is honest, and the
    reported duration before the mind is ever touched."""
    b = data or b""
    try:
        if mime == "audio/wav":
            # walk the RIFF chunks: byte-rate from `fmt `, payload size from `data`.
            i, byte_rate, payload = 12, 0, 0
            while i + 8 <= len(b):
                cid, size = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], "little")
                if cid == b"fmt " and i + 16 <= len(b):
                    byte_rate = int.from_bytes(b[i + 16:i + 20], "little")
                elif cid == b"data":
                    payload = size
                    break
                i += 8 + size + (size & 1)
            return round(payload / byte_rate, 2) if byte_rate and payload else None
        if mime == "audio/ogg":
            # The LAST page's granule position is the stream length in samples. A browser's ogg is
            # Opus, whose granule clock the spec FIXES at 48 kHz regardless of the capture rate —
            # so this is exact for the case it fires on, not an estimate.
            j = b.rfind(b"OggS")
            if j < 0 or j + 14 > len(b):
                return None
            granule = int.from_bytes(b[j + 6:j + 14], "little")
            return round(granule / 48000.0, 2) if 0 < granule < (1 << 62) else None
        if mime == "audio/mp4":
            k = b.find(b"mvhd")
            if k < 0:
                return None
            ver = b[k + 4]
            if ver == 1 and k + 36 <= len(b):
                ts = int.from_bytes(b[k + 24:k + 28], "big")
                dur = int.from_bytes(b[k + 28:k + 36], "big")
            elif k + 24 <= len(b):
                ts = int.from_bytes(b[k + 16:k + 20], "big")
                dur = int.from_bytes(b[k + 20:k + 24], "big")
            else:
                return None
            return round(dur / ts, 2) if ts and dur else None
    except Exception:
        log.debug("audio_seconds fail-soft for %s", mime, exc_info=True)
    return None


def _clean_image(data: bytes, mime: str) -> tuple[bytes, str, str]:
    """(bytes, mime, error_key) — EXIF stripped, orientation baked in, downscaled for the vision call.

    Three jobs, all of them load-bearing and none of them cosmetic:
      ① EXIF DIES HERE. A photo of a handwritten note taken in a warehouse carries GPS. We never
         store the file, but we DO send it to a model, and shipping someone's coordinates to a third
         party because nobody thought about it is the kind of default this product does not have.
         A Pillow re-encode writes no EXIF unless asked, so the strip is the save itself.
      ② ORIENTATION SURVIVES AS PIXELS. `exif_transpose` first — dropping EXIF from a sideways
         iPhone portrait without rotating it would hand the OCR a rotated page and blame the model.
      ③ SIZE. Downscaled to DEMO_PHOTO_MAX_SIDE on the long edge before the vision call: Anthropic's
         own guidance puts the cost/quality knee around 1568 px, and a 12 MP price sheet costs
         several times the tokens for no extra legibility.

    Pillow is a hard dependency of this box already (`brain/order_card.py` renders the confirmation
    card with it). If it is somehow absent we do NOT invent a fallback that quietly skips ① — we pass
    a format the vision call already accepts and refuse anything else, and the log says why."""
    try:
        from PIL import Image, ImageOps
    except Exception:                                     # pragma: no cover — Pillow is required
        log.error("demo_media: Pillow missing — EXIF cannot be stripped; refusing anything but a "
                  "format the vision call takes as-is")
        return (data, mime, "") if mime in VISION_MIMES else (b"", mime, "bad_image")
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)                  # ② before ①, or the rotation is lost
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        side = max(im.size)
        if side > config.DEMO_PHOTO_MAX_SIDE:
            f = config.DEMO_PHOTO_MAX_SIDE / float(side)
            im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))),
                           Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=88, optimize=True)   # ① no exif= ⇒ no EXIF
        return out.getvalue(), "image/jpeg", ""
    except Exception:
        # A HEIC without a HEIF plugin lands here, and it is the single most likely refusal an
        # iPhone user will meet — so it gets its OWN sentence telling them the setting to change,
        # not the generic one. Everything else that will not open is genuinely «bad_image».
        log.info("demo_media: image would not open (mime=%s, %d bytes)", mime, len(data or b""),
                 exc_info=True)
        return b"", mime, ("heic" if mime in ("image/heic", "image/avif") else "bad_image")


# ══ ② THE DOORS ═══════════════════════════════════════════════════════════════════════════════════

def _rate_ok(sid: str, ip: str) -> bool:
    """try_chat's ONE sliding-window store, with media-prefixed keys — a tighter, separate budget
    that sits IN FRONT of the paid call, because a media turn spends a Deepgram or a vision call
    before `demo_flow._turn`'s own limits are ever consulted."""
    import try_chat as _tc
    return (_tc._rate_ok(f"demomediaip:{ip}", limit=config.DEMO_MEDIA_IP_LIMIT,
                         window_s=config.DEMO_MEDIA_IP_WINDOW_S)
            and _tc._rate_ok(f"demomediasess:{sid}", limit=config.DEMO_MEDIA_LIMIT,
                             window_s=config.DEMO_MEDIA_WINDOW_S))


def _clean_client_id(client_id: str) -> str:
    """The phone's own uuid, or one we mint. Narrow alphabet: it is a unique-index key and it comes
    from an untrusted device, so it is bounded rather than trusted to be a uuid."""
    c = re.sub(r"[^0-9A-Za-z._:-]", "", str(client_id or ""))[:80]
    return c or ("srv-" + secrets.token_hex(8))


async def _claim_slot(sid: str, client_id: str, kind: str, origin: str,
                      mime: str, size: int) -> tuple[Optional[str], Optional[dict[str, Any]]]:
    """(new_id, replay) — the idempotency fork, decided by the unique index and nothing else.

    · nothing there  → a fresh `recibida` row, and we do the work.
    · a `leida` row  → THE SAME ANSWER AS LAST TIME, replayed from `result`, no second transcription
                       and no second turn burned. That is what «idempotent retries» has to mean; a
                       retry that re-runs the mind would show the visitor two orders for one photo.
    · a `leyendo` row → still in flight (or an interrupted attempt) → 409, «dame un segundo».
    · a `fallida` row → re-armed and retried, because the phone showed «reintentar» and a person
                       tapped it. The row is reused so the retry does not stack a second slot.
    """
    await ensure_schema()
    mid = "dmed_" + secrets.token_hex(10)
    async with db.get_pool().acquire() as con:
        got = await con.fetchval(
            "insert into demo_media(id,sid,client_id,kind,origin,state,mime,bytes) "
            "values($1,$2,$3,$4,$5,'recibida',$6,$7) "
            "on conflict (sid, client_id) do nothing returning id",
            mid, sid, client_id, kind, origin, mime, int(size))
        if got:
            return mid, None
        row = await con.fetchrow(
            "select * from demo_media where sid=$1 and client_id=$2", sid, client_id)
        if row is None:                       # deleted between the two statements — treat as fresh
            return mid, None
        if row["state"] == "leida":
            out = dict(row["result"] or {})
            out["replayed"] = True
            out.setdefault("media", _public(row))
            return None, out
        if row["state"] == "fallida":
            await con.execute(
                "update demo_media set state='recibida', error='', mime=$2, bytes=$3, "
                "updated_at=now() where id=$1", row["id"], mime, int(size))
            return row["id"], None
        return None, {"ok": False, "error": "in_flight", "reply": ES["in_flight"]}


async def _mark(mid: str, state: str, **cols: Any) -> None:
    """State transitions are a WRITE, never an inference. §17.20's law: events are hints, this row is
    the truth both screens re-render from. Fail-soft — a lost state write must never lose the turn."""
    sets = ["state=$2", "updated_at=now()"]
    vals: list[Any] = [mid, state]
    for k, v in cols.items():
        vals.append(v)
        sets.append(f"{k}=${len(vals)}")
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(f"update demo_media set {', '.join(sets)} where id=$1", *vals)
    except Exception:
        log.debug("demo_media state write fail-soft (%s → %s)", mid, state, exc_info=True)


def _public(row: Any) -> dict[str, Any]:
    """The per-image state, in the ONE vocabulary both screens speak (§17.20's table). Never the
    bytes — there are none — and never the raw `result`, which the caller already holds."""
    return {"id": row["id"], "kind": row["kind"], "state": row["state"],
            "origin": row["origin"], "mime": row["mime"], "bytes": int(row["bytes"] or 0),
            "seconds": (float(row["seconds"]) if row["seconds"] is not None else None),
            "text": row["text"] or "", "error": row["error"] or "",
            "at": row["created_at"].isoformat() if row["created_at"] else None}


async def _fail(mid: str, key: str, **cols: Any) -> dict[str, Any]:
    await _mark(mid, "fallida", error=key, **cols)
    return {"ok": False, "error": key, "reply": ES.get(key, ES["bad_audio"]),
            "media": {"id": mid, "state": "fallida", "error": key}}


async def voice(*, row: dict[str, Any], audio: bytes, content_type: str, ip: str,
                origin: str = "desk", client_id: str = "",
                lang: str = "es") -> dict[str, Any]:
    """A voice note in → the transcript → the ordinary turn. Never raises.

    ⚠️ Q2 (`behaviour.voice`) IS NOT CONSULTED HERE, AND THAT IS THE POINT. Q2 governs how ROCOTO
    REPLIES — never · always · mirror — not whether a customer may SEND audio. A customer can always
    send a voice note; that is what WhatsApp IS, and a demo that greys out the mic because the
    supplier chose text replies would be teaching a rule the product does not have. Voice REPLIES
    are a later lane (§17.56's «gates the composer's mic and (later lane) voice replies» — the mic
    half of that sentence is superseded by this function's existence).

    The transcript comes back to the caller as well as going to the mind: «the UI shows what it
    heard» is most of the trust in a demo, and a wrong transcription that is VISIBLE is a forgivable
    machine, while a wrong order with no visible cause is a broken product."""
    if not config.DEMO_MEDIA_ENABLED:
        return {"ok": False, "error": "off", "reply": ES["off"]}
    sid = row["sid"]
    if not _rate_ok(sid, ip):
        return {"ok": False, "error": "rate_limited", "reply": ES["rate"]}
    if not audio:
        return {"ok": False, "error": "empty", "reply": ES["empty"]}
    if len(audio) > config.DEMO_VOICE_MAX_BYTES:
        # the belt to the route's pre-read suspender: a chunked upload declares no content-length.
        return {"ok": False, "error": "too_big_voice", "reply": ES["too_big_voice"]}

    mime = sniff_mime(audio) or ""
    if mime not in AUDIO_MIMES:
        # The declared type never rescues unrecognised bytes — it is the client's claim, and the
        # thing on the other side of this door is an unauthenticated stranger's file.
        log.info("demo_media: refusing audio sniffed=%r declared=%r (%d bytes)",
                 mime, content_type, len(audio))
        return {"ok": False, "error": "bad_audio", "reply": ES["bad_audio"]}

    secs = audio_seconds(mime, audio)
    if secs is not None and secs > config.DEMO_VOICE_MAX_SECONDS:
        return {"ok": False, "error": "too_long",
                "reply": ES["too_long"].format(max=int(config.DEMO_VOICE_MAX_SECONDS))}

    mid, replay = await _claim_slot(sid, _clean_client_id(client_id), KIND_VOICE, origin,
                                    mime, len(audio))
    if replay is not None:
        return replay
    assert mid is not None
    await _mark(mid, "leyendo")

    import transcribe as tx
    try:
        # the supplier's own article names bias the model toward what this trade actually says
        # (Carlos, 2026-08-19: a harder voice note «no lo ha transcrito bien»). Fail-soft to [].
        _kt = await tx.catalogue_keyterms(demo_flow.tenant_of_row(row))
        dg = await tx.deepgram_diarize(audio, mime, keyterms=_kt)
        raw, utts = tx.parse_utterances(dg)
    except Exception:
        log.exception("demo_media: deepgram failed for %s", mid)
        return await _fail(mid, "stt_down")

    # Deepgram's OWN duration is the authoritative check — it is the only one that fires for a
    # MediaRecorder webm, and it fires BEFORE the mind is touched, so an over-long clip costs one
    # transcription and never a turn.
    reported = None
    try:
        d = (dg.get("metadata") or {}).get("duration")
        reported = float(d) if d is not None else None
    except Exception:
        reported = None
    secs = reported if reported is not None else secs
    if secs is not None and secs > config.DEMO_VOICE_MAX_SECONDS:
        return await _fail(mid, "too_long", seconds=secs)

    polished = await asyncio.to_thread(tx.polish_sync, raw)
    # one speaker → drop the diarization labels (onboarding_ext.voice_rule's own treatment)
    text = re.sub(r"(?m)^Speaker \d+:\s*", "", polished or raw or "").strip()
    if not text:
        return await _fail(mid, "silence", seconds=secs)

    # PERCEPTION at the sense (organ ②): the WhatsApp rail classifies transcription confidence
    # before any reasoning sees the text, and so does this one. It is CARRIED, not acted on — the
    # demo shows «no te he oído del todo bien» honestly; routing a shaky transcript to review is the
    # live rail's job and has no review sheet here to route to.
    try:
        import confidence as _conf
        conf = _conf.classify(utts)
    except Exception:
        conf = {"level": "shaky", "review": True, "reason": "confidence classify failed — review"}

    await _mark(mid, "leida", text=text[:4000], seconds=secs, confidence=conf)
    out = await demo_flow.turn_from_media(row=row, text=text, ip=ip, kind=KIND_VOICE, lang=lang)
    return await _finish(mid, out, transcript=text, seconds=secs, confidence=conf)


async def photo(*, row: dict[str, Any], image: bytes, content_type: str, ip: str,
                caption: str = "", origin: str = "desk", client_id: str = "",
                lang: str = "es") -> dict[str, Any]:
    """A photo in → what it says → the ordinary turn. Never raises.

    A photo of a handwritten note is the highest-value real input there is (§17.20), and it is the
    one the demo most has to accept, because it is the moment a supplier stops comparing us to a
    chatbot. The caption rides along exactly as it does on WhatsApp — a customer who sends a photo
    and types «pa mañana» has said something the pixels do not contain."""
    if not config.DEMO_MEDIA_ENABLED:
        return {"ok": False, "error": "off", "reply": ES["off"]}
    sid = row["sid"]
    if not _rate_ok(sid, ip):
        return {"ok": False, "error": "rate_limited", "reply": ES["rate"]}
    if not image:
        return {"ok": False, "error": "empty", "reply": ES["empty"]}
    if len(image) > config.DEMO_PHOTO_MAX_BYTES:
        return {"ok": False, "error": "too_big_photo", "reply": ES["too_big_photo"]}

    mime = sniff_mime(image) or ""
    if mime not in IMAGE_MIMES and mime != "image/avif":
        log.info("demo_media: refusing image sniffed=%r declared=%r (%d bytes)",
                 mime, content_type, len(image))
        return {"ok": False, "error": "bad_image", "reply": ES["bad_image"]}

    mid, replay = await _claim_slot(sid, _clean_client_id(client_id), KIND_PHOTO, origin,
                                    mime, len(image))
    if replay is not None:
        return replay
    assert mid is not None
    await _mark(mid, "leyendo")

    clean, cmime, err = await asyncio.to_thread(_clean_image, image, mime)
    if err or not clean:
        return await _fail(mid, err or "bad_image")

    import transcribe as tx
    try:
        text = await asyncio.to_thread(tx.ocr_image_sync, clean, cmime,
                                       (caption or "").strip()[:300])
    except Exception:
        log.exception("demo_media: ocr failed for %s", mid)
        return await _fail(mid, "ocr_down")
    text = (text or "").strip()
    if not text:
        # ocr_image_sync swallows its own failures and returns '' — which is the same shape as «the
        # photo is a blurry wall». Both answers are «I got nothing from this», said once, honestly.
        return await _fail(mid, "unreadable")

    # The caption is part of what the customer said, so it rides INTO the turn, not just into the
    # OCR prompt — the same combine the WhatsApp rail does (brain/pipeline._combine).
    cap = (caption or "").strip()[:300]
    turn_text = f"{cap}\n{text}".strip() if cap else text
    await _mark(mid, "leida", text=text[:4000])
    out = await demo_flow.turn_from_media(row=row, text=turn_text, ip=ip, kind=KIND_PHOTO, lang=lang)
    return await _finish(mid, out, transcript=text)


async def _finish(mid: str, turn: dict[str, Any], *, transcript: str,
                  seconds: Optional[float] = None,
                  confidence: Optional[dict] = None) -> dict[str, Any]:
    """The turn's answer + what we heard/read, and the same pair stored for an idempotent replay.

    The turn's own failure modes are NOT turned into media failures: a rate-limited or turn-capped
    session read the media fine, and marking the row `fallida` would tell the phone to «reintentar»
    into the same wall. The row stays `leida` — the read succeeded, the turn is a separate answer."""
    out = dict(turn or {})
    out["transcript"] = transcript
    if seconds is not None:
        out["seconds"] = seconds
    if confidence is not None:
        out["confidence"] = confidence
    try:
        async with db.get_pool().acquire() as con:
            r = await con.fetchrow("select * from demo_media where id=$1", mid)
        if r is not None:
            out["media"] = _public(r)
        # store the WHOLE answer: a retry must replay what the visitor already saw, not a summary.
        await _mark(mid, "leida", result=_slim(out))
    except Exception:
        log.debug("demo_media finish bookkeeping fail-soft for %s", mid, exc_info=True)
    return out


def _slim(out: dict[str, Any]) -> dict[str, Any]:
    """The replay payload, bounded. An order with 200 lines is a real thing a demo can produce and a
    jsonb column is not the place to keep an unbounded copy of it."""
    keep = {k: out.get(k) for k in
            ("ok", "reply", "turns_used", "turns_left", "closed", "transcript", "seconds",
             "confidence", "needs_catalog", "error")}
    order = out.get("order")
    if isinstance(order, dict):
        keep["order"] = {**order, "lines": list(order.get("lines") or [])[:60]}
    unmatched = out.get("unmatched")
    if isinstance(unmatched, list):
        keep["unmatched"] = unmatched[:20]
    keep["media"] = out.get("media")
    return keep


# ══ ③ THE STATE DOC — §17.20's «events are hints; state is truth» ═════════════════════════════════

async def state(sid: str, limit: int = 30) -> dict[str, Any]:
    """Everything this session has sent, newest first, in the one state vocabulary. Idempotent and
    complete, so the desk can re-render from it on an event, a reconnect or a tab refocus — and can
    fall back to polling it if the channel is buffered by a proxy, which costs latency, never
    correctness."""
    await ensure_schema()
    try:
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select * from demo_media where sid=$1 order by created_at desc limit $2",
                sid, int(limit))
    except Exception:
        log.exception("demo_media: state read failed for %s", sid)
        rows = []
    return {"ok": True, "media": [_public(r) for r in rows]}


async def cursor(sid: str) -> str:
    """The newest `updated_at` for this session, as an opaque string — the ONE extra thing the
    demo's live channel watches beside the spine head. A cursor rather than a payload keeps §17.20's
    law intact: the frame is a hint, the state doc above is the truth."""
    try:
        async with db.get_pool().acquire() as con:
            v = await con.fetchval("select max(updated_at) from demo_media where sid=$1", sid)
        return v.isoformat() if v else ""
    except Exception:
        return ""


# ══ ④ REAPING — nothing here outlives its session ═════════════════════════════════════════════════

_last_reap = 0.0


async def reap(days: Optional[int] = None, limit: int = 5000) -> int:
    """Delete media rows older than the session TTL. Bounded, so it can never be the statement that
    locks the table; returns how many went."""
    d = int(days if days is not None else config.DEMO_SESSION_TTL_DAYS)
    try:
        await ensure_schema()
        async with db.get_pool().acquire() as con:
            status = await con.execute(
                "with dead as (select id from demo_media "
                "  where created_at < now() - ($1 || ' days')::interval limit $2) "
                "delete from demo_media m using dead d where m.id = d.id", str(d), limit)
        # asyncpg returns the command tag ("DELETE 12") — the only honest count for a bounded delete.
        return int(str(status or "").rsplit(" ", 1)[-1] or 0)
    except Exception:
        log.debug("demo_media reap fail-soft", exc_info=True)
        return 0


async def maybe_reap() -> None:
    """Throttled housekeeping, hung off the upload path rather than off a new timer.

    THE REASON IT IS NOT A CRON ROW: this table only grows when somebody uploads, so the upload path
    is exactly where the sweep belongs — no traffic, no growth, no need for a sweep. Once per process
    per hour, fail-soft, and `reap()` stays callable by hand or by cron for anyone who wants it on a
    clock instead."""
    global _last_reap
    now = time.time()
    if now - _last_reap < 3600:
        return
    _last_reap = now
    try:
        await reap()
    except Exception:
        log.debug("demo_media maybe_reap fail-soft", exc_info=True)
