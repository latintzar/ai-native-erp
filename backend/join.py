"""join.py — the /join application: a fixed ladder, voice notes, and Peter's desk.

JOIN-PAGE-SPEC-2026-09-04.md §2. soyrocoto.com/join is the technical co-founder page, and the
application on it is a Rocoto-looking chat that asks eight things in a FIXED order. The model that
ran §1's conversation is retired from this path: «NO MODEL in the form. The questions are a fixed
ladder in the client; the backend validates, stores, transcribes and mails.» So this module is now
three doors and no reasoning — `POST /voice` takes a recording, `GET /audio/<id>` gives it back,
`POST /submit` writes the row, mails Peter and pushes Dover.

WHY THE LADDER LIVES IN THE CLIENT AND THE LABELS LIVE HERE. The page asks the questions; this file
keeps the same questions as LABELS, in both languages, so the row and the email read as a Q/A sheet
rather than a dict of keys. If the page's wording moves, these move with it — they are the record of
what the person was asked, and a record that has drifted is worse than no record.

A VOICE ANSWER IS THE AUDIO **AND** THE TRANSCRIPT, never one or the other. Peter's whole reason for
the mic is that he wants to hear the person; the transcript is how he skims and how Dover indexes.
So `/voice` stores the bytes under MEDIA_DIR/join, transcribes them with Deepgram nova-3 in `multi`
(a candidate may answer in either language, and often in both), and `/submit` carries voice_id, url,
duration and transcript together into the row, the email and Dover.

A DEEPGRAM FAILURE IS NOT AN APPLICATION FAILURE. The upload answers `ok: true` with an empty
transcript: the audio is already stored and served, Peter can still listen, and a candidate is never
shown a machine problem in the middle of applying. The transcript is a convenience; the recording is
the answer.

MEDIA OWNERSHIP IS A PROPERTY OF THE BOX, NOT OF THIS COMMIT (the 2026-08-13 incident, and
`tests/vital_media_writable.py` in full). `/opt/rocoto/media/intake` and `.../onboarding` were once
created root-owned by a deploy-time import running as root, and the service — which runs as
`founder` — could not write into them; every upload in a live demo failed with a sentence that named
none of it. So this module creates `MEDIA_DIR/join` lazily, on the first upload, IN THE SERVICE
PROCESS, and a PermissionError is logged with the exact chown that fixes it rather than swallowed.

FOUR WALLS on two unauthenticated public writes: a byte cap enforced on the STREAM (never on the
sender's Content-Length claim), a duration cap probed from the file itself, a per-IP sliding window
on each door, and the junk gate on the prose answers.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

import config

log = logging.getLogger("rocoto.join")

router = APIRouter(prefix="/api/join")

# ── the ladder, as the record keeps it ─────────────────────────────────────────────────────────────
FIELDS = ("name", "github", "linkedin", "other", "proud", "location", "email", "phone")
# Answered in words, always: these three are what Peter needs to reply and to call.
REQUIRED = ("name", "email", "phone")
# Answered in words OR in the person's own voice — the two Peter reads and listens to.
EITHER = ("proud", "location")
# The prose the junk gate judges. A URL is not prose, and a gate tuned for written sentences would
# call `https://github.com/ada` empty of content; those fields are shape-checked instead.
PROSE = ("name", "proud", "location")

QUESTIONS: dict[str, dict[str, str]] = {
    "en": {
        "name": "What's your name?",
        "github": "Your GitHub.",
        "linkedin": "Your LinkedIn.",
        "other": "Anything else you want me to see? A YC co-founder matching profile, a talk, a product.",
        "proud": "What have you shipped that you're proudest of, and what about it would interest Peter?",
        "location": "Where are you now, and would Barcelona or Madrid work for you?",
        "email": "Your email.",
        "phone": "The phone Peter should call.",
    },
    "es": {
        "name": "¿Cómo te llamas?",
        "github": "Tu GitHub.",
        "linkedin": "Tu LinkedIn.",
        "other": "¿Algo más que quieras que vea? Un perfil de YC co-founder matching, una charla, un producto.",
        "proud": "¿Qué has construido de lo que estés más orgulloso, y qué le interesaría a Peter de eso?",
        "location": "¿Dónde estás ahora, y te encajaría Barcelona o Madrid?",
        "email": "Tu email.",
        "phone": "El teléfono al que Peter te llama.",
    },
}

# ── caps ───────────────────────────────────────────────────────────────────────────────────────────
MAX_AUDIO_BYTES = int(os.environ.get("JOIN_MAX_AUDIO_BYTES", str(8 * 1024 * 1024)) or 8 * 1024 * 1024)
MAX_AUDIO_SECONDS = float(os.environ.get("JOIN_MAX_AUDIO_SECONDS", "180") or "180")
MAX_SUBMIT_BYTES = int(os.environ.get("JOIN_MAX_SUBMIT_BYTES", "65536") or "65536")
MAX_ANSWER_CHARS = 4000

VOICE_IP_LIMIT = int(os.environ.get("JOIN_VOICE_IP_LIMIT", "40") or "40")
VOICE_IP_WINDOW_S = float(os.environ.get("JOIN_VOICE_IP_WINDOW_S", "600") or "600")
SUBMIT_IP_LIMIT = int(os.environ.get("JOIN_SUBMIT_IP_LIMIT", "8") or "8")
SUBMIT_IP_WINDOW_S = float(os.environ.get("JOIN_SUBMIT_IP_WINDOW_S", "3600") or "3600")

# ── where the recordings live ──────────────────────────────────────────────────────────────────────
# Config-driven: `config.MEDIA_DIR` is the one media root the box already provisions and the one
# `vital_media_writable.py` probes. The env override exists so a rehearsal box can point somewhere
# harmless without a code change.
MEDIA_ROOT = Path(os.environ.get("ROCOTO_JOIN_MEDIA_DIR") or (Path(config.MEDIA_DIR) / "join"))

# What the door accepts. The DECLARED content-type is the client's claim; the magic bytes are the
# evidence, and the evidence wins (`demo_media.sniff_mime` takes the same position for the customer
# rail — this one is narrower on purpose: audio only, and no import of the demo spine on a public
# hiring endpoint).
EXT_BY_MIME = {
    "audio/webm": "webm",   # MediaRecorder's default on Chrome, Edge and Android
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",     # Safari's MediaRecorder fallback
    "audio/mpeg": "mp3",
}
MIME_BY_EXT = {v: k for k, v in EXT_BY_MIME.items()}


def _sniff_audio(data: bytes) -> str:
    """Canonical audio mime from magic bytes alone, or '' when nothing here recognises it."""
    b = data or b""
    if len(b) < 12:
        return ""
    if b[4:8] == b"ftyp":
        return "audio/mp4"
    if b[:4] == b"OggS":
        return "audio/ogg"
    if b[:4] == b"\x1a\x45\xdf\xa3":  # EBML — WebM and Matroska share it
        return "audio/webm"
    if b[:3] == b"ID3" or (b[0] == 0xFF and (b[1] & 0xE0) == 0xE0):
        return "audio/mpeg"
    return ""


def _ensure_media_dir() -> Path:
    """Created in the SERVICE process, on the first upload — see the module docstring."""
    root = MEDIA_ROOT
    try:
        root.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        log.error("join: cannot create %s — the service cannot write there. "
                  "Fix on the box: chown -R founder:founder %s", root, config.MEDIA_DIR)
        raise
    return root


def _ffprobe_seconds(path: Path) -> Optional[float]:
    """The file's own duration, or None when ffprobe is absent or the container will not say.

    ffprobe reads the written FILE rather than the client's claim, which is the only reading that
    cannot be forged. A MediaRecorder webm is written in streaming mode and often carries no
    duration in its header, so None is an ordinary answer here, not a failure."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=20)
    except (FileNotFoundError, subprocess.SubprocessError):
        return None
    txt = (out.stdout or "").strip()
    try:
        secs = float(txt)
    except (TypeError, ValueError):
        return None
    return secs if secs > 0 else None


# ── rate limiting — the sliding window try_chat.py uses (no new dependency) ────────────────────────
_HITS: dict[str, list[float]] = {}


def _rate_ok(key: str, *, limit: int, window_s: float) -> bool:
    now = time.time()
    hits = [t for t in _HITS.get(key, ()) if now - t < window_s]
    if len(hits) >= limit:
        _HITS[key] = hits
        return False
    hits.append(now)
    _HITS[key] = hits
    if len(_HITS) > 5000:  # bound memory
        for k in list(_HITS)[:1000]:
            _HITS.pop(k, None)
    return True


# ── shapes ─────────────────────────────────────────────────────────────────────────────────────────
_EMAIL_RE = re.compile(r"^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$")
_VOICE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
_SESSION_RE = re.compile(r"[^0-9a-zA-Z_-]")
# The separators people actually type inside a phone number. They are stripped before the check, so
# «+34 600-000-000» and «+34600000000» are the same number, and anything else is refused.
_PHONE_STRIP = str.maketrans("", "", " -.() ")


def _lang(v: Any) -> str:
    return "en" if str(v or "en").lower().startswith("en") else "es"


def _email_ok(v: str) -> bool:
    return bool(_EMAIL_RE.match((v or "").strip())) and len(v.strip()) <= 200


def _phone_ok(v: str) -> bool:
    t = (v or "").strip().translate(_PHONE_STRIP)
    if not t or not re.fullmatch(r"\+?\d{7,20}", t):
        return False
    return True


def _is_junk(text: str, *, field: str) -> bool:
    """The brain's junk gate, with the one adjustment §1 already needed: it calls anything three
    characters or shorter with no digits «too short, no content», which is true of an order and
    false of a name. Ana and Bo are answers."""
    t = (text or "").strip()
    if not t:
        return True
    try:
        from brain import junkgate
    except Exception:  # pragma: no cover — the gate is a nicety, never a hard dependency
        return False
    junk, reason = junkgate.is_junk(t, has_media=False)
    if junk and field == "name" and reason == "too short, no content":
        return False
    return junk


def _ip_hash(ip: str) -> str:
    return hashlib.sha256(f"rocoto.join:{ip or ''}".encode()).hexdigest()[:32]


def _client_ip(request: Request) -> str:
    """The one derivation, borrowed rather than copied: sup_api._client_ip trusts a forwarding
    header only from a hop in ROCOTO_TRUSTED_PROXY_IPS and reads the rightmost entry."""
    try:
        import sup_api
        return sup_api._client_ip(request) or "unknown"
    except Exception:
        return (request.client.host if request.client else "") or "unknown"


# ── the URLs a recording answers on ────────────────────────────────────────────────────────────────
# RELATIVE for the page: the landing calls /api/join/* through the Vercel rewrite, so the browser
# only ever sees soyrocoto.com. ABSOLUTE for the email: Peter opens it in a mail client, where a
# relative path resolves to nothing.
PUBLIC_API_BASE = (os.environ.get("ROCOTO_PUBLIC_API_BASE") or "https://api.soyrocoto.com").rstrip("/")


def audio_path(voice_id: str) -> str:
    return f"/api/join/audio/{voice_id}"


def audio_url_absolute(voice_id: str) -> str:
    return f"{PUBLIC_API_BASE}{audio_path(voice_id)}"


def _stored_file(voice_id: str) -> Optional[Path]:
    if not _VOICE_ID_RE.match(voice_id or ""):
        return None
    for ext in MIME_BY_EXT:
        p = MEDIA_ROOT / f"{voice_id}.{ext}"
        if p.is_file():
            return p
    return None


def _sidecar_path(voice_id: str) -> Path:
    return MEDIA_ROOT / f"{voice_id}.json"


def _write_sidecar(voice_id: str, meta: dict[str, Any]) -> None:
    """The recording's own note, written beside it at upload time.

    WHY IT EXISTS RATHER THAN A SECOND ffprobe AT SUBMIT. A MediaRecorder webm is written in
    streaming mode and usually carries no duration in its header, so ffprobe answers N/A for exactly
    the container most candidates will send — and `/submit` receives only voice ids, never durations.
    Without this file the email would say 0:00 next to every real recording. It also keeps the
    transcript the upload produced, so an application still carries words even when the person
    cleared the editable text before sending.

    Fail-soft: a missing note costs a duration, never an answer."""
    try:
        _sidecar_path(voice_id).write_text(json.dumps(meta), encoding="utf-8")
    except Exception:
        log.warning("join: could not write the note beside %s", voice_id, exc_info=True)


def _read_sidecar(voice_id: str) -> dict[str, Any]:
    try:
        return json.loads(_sidecar_path(voice_id).read_text("utf-8")) or {}
    except Exception:
        return {}


# ── the transcription seam — one call, replaced wholesale in tests ─────────────────────────────────
async def _transcribe(audio: bytes, mime: str) -> str:
    """Deepgram nova-3, `language=multi`. Raises on any failure; the caller turns that into ''.

    It reaches for `transcribe.DG_URL` and `transcribe.parse_utterances` rather than
    `transcribe.deepgram_diarize` for ONE reason, and it is a real one: that function reads
    `config.DEEPGRAM_LANGUAGE`, which the customer rail deliberately pins to `en` (the catalogue and
    the app are English, 2026-08-19). A co-founder applicant answers in English, in Spanish, or in
    both inside one sentence, so this door asks for `multi`. Everything else — the endpoint, the
    parameters, the opt-out, the parser — is the module's.

    `mip_opt_out=true` rides on every call: Deepgram's ToS §3.3 makes the training opt-out
    per-REQUEST, and «tus mensajes no entrenan ningún modelo» is published on /terminos §17."""
    import httpx

    import transcribe as tx
    params = {
        "model": "nova-3",
        "language": "multi",
        "punctuate": "true",
        "utterances": "true",
        "smart_format": "true",
        "paragraphs": "true",
        "diarize": "true",
        "mip_opt_out": "true",
    }
    headers = {"Authorization": f"Token {config.DEEPGRAM_API_KEY}",
               "Content-Type": mime or "audio/ogg"}
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post(tx.DG_URL, params=params, headers=headers, content=audio)
        r.raise_for_status()
        dg = r.json()
    raw, _utts = tx.parse_utterances(dg)
    # One speaker: the diarization labels are noise on a voice note (onboarding_ext.voice_rule and
    # demo_media.voice both strip them the same way).
    return re.sub(r"(?m)^Speaker \d+:\s*", "", raw or "").strip()[:MAX_ANSWER_CHARS]


# ── the row ────────────────────────────────────────────────────────────────────────────────────────
# The explicit migration chain installs this application storage before requests are served.

_schema_ok = False


async def _ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    import db
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


async def _db_insert(row: dict[str, Any]) -> None:
    """Seam: the one write. Tests replace this."""
    await _ensure_schema()
    import db
    async with db.get_pool().acquire() as con:
        # THE JSONB PARAMETERS GO IN AS PYTHON OBJECTS, NOT AS JSON TEXT. db._init_conn registers a
        # jsonb codec (encoder=json.dumps) on every pooled connection, so handing a parameter a
        # string it has already serialised stores a jsonb STRING SCALAR — `jsonb_array_length` then
        # refuses it and every reader has to double-decode. Measured on prod 2026-09-04.
        await con.execute(
            "insert into join_applicants (id, lang, name, link, why, location, email, transcript, "
            "ip_hash, ua, github, linkedin, other, phone, voices) "
            "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
            row["id"], row["lang"], row["name"], row["link"], row["why"], row["location"],
            row["email"], row["transcript"], row["ip_hash"], row["ua"], row["github"],
            row["linkedin"], row["other"], row["phone"], row["voices"])


async def _db_set_dover(row_id: str, dover_id: str, dover_error: str) -> None:
    import db
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update join_applicants set dover_id=$2, dover_error=$3 where id=$1",
            row_id, dover_id or None, dover_error or None)


async def _mail_send(to: str, subject: str, html: str) -> dict:
    """Seam: Resend, through the mailer the rest of the backend already uses."""
    import orders
    return await orders.send_email_async(to, subject, html)


async def _http_post(url: str, headers: dict[str, str], payload: dict) -> tuple[int, str]:
    """Seam: the one outbound HTTP call (Dover). Tests replace this."""
    import httpx
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.post(url, headers=headers, json=payload)
    return r.status_code, r.text[:400]


# ── what Peter receives ────────────────────────────────────────────────────────────────────────────
def _esc(s: Any) -> str:
    return (str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _mmss(ms: int) -> str:
    s = max(0, int(ms or 0)) // 1000
    return f"{s // 60}:{s % 60:02d}"


def _sheet(answers: dict[str, str], voices: dict[str, dict], lang: str) -> list[dict[str, Any]]:
    """The ordered Q/A list: what was asked, what came back, and how it came back."""
    out: list[dict[str, Any]] = []
    qs = QUESTIONS[lang]
    for f in FIELDS:
        v = voices.get(f) or {}
        text = (answers.get(f) or "").strip()
        if not text and not v:
            continue
        item: dict[str, Any] = {"field": f, "question": qs[f],
                                "kind": "voice" if v else "text",
                                "answer": (v.get("transcript") or "").strip() if v else text}
        if v:
            item.update({"voice_id": v.get("voice_id", ""), "url": v.get("url", ""),
                         "duration_ms": int(v.get("duration_ms") or 0)})
            if text:
                # the person edited the transcript before sending, so both readings are kept
                item["typed"] = text
        out.append(item)
    return out


def _email_html(sheet: list[dict[str, Any]], lang: str) -> str:
    blocks = []
    for item in sheet:
        body = _esc(item["answer"]) or "<i>(no words)</i>"
        if item["kind"] == "voice":
            href = audio_url_absolute(item["voice_id"])
            body += (f"<br><a href='{_esc(href)}' style='font-size:13px'>Listen "
                     f"({_mmss(item.get('duration_ms', 0))})</a>")
            if item.get("typed") and item["typed"] != item["answer"]:
                body += f"<br><span style='font-size:13px'>Typed: {_esc(item['typed'])}</span>"
        blocks.append(
            f"<p style='margin:14px 0 0'><b>{_esc(item['question'])}</b><br>{body}</p>")
    return (f"<p>A technical co-founder application came in through /join ({_esc(lang)}).</p>"
            + "".join(blocks))


DOVER_URL = "https://app.dover.com/api/v1/external/add-candidate"


def _split_name(name: str) -> tuple[str, str]:
    parts = [p for p in re.split(r"\s+", (name or "").strip()) if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0][:80], ""
    return parts[0][:80], " ".join(parts[1:])[:80]


def _linkedin_url(answers: dict[str, str]) -> str:
    for key in ("linkedin", "other", "github"):
        v = (answers.get(key) or "").strip()
        if "linkedin.com" in v.lower():
            return v[:400]
    return ""


async def _dover_push(row_id: str, answers: dict[str, str], sheet: list[dict[str, Any]]) -> None:
    """Fire-and-log. A failure lands in `dover_error` on the row and never reaches the candidate."""
    key = config.DOVER_API_KEY
    job_id = config.DOVER_JOB_ID
    if not key or not job_id:
        log.info("join: DOVER_API_KEY/DOVER_JOB_ID unset — skipping the Dover push for %s", row_id)
        return
    first, last = _split_name(answers.get("name", ""))
    lines = []
    for item in sheet:
        lines.append(f"{item['question']}\n{item['answer'] or '(no words)'}")
        if item["kind"] == "voice":
            lines.append(f"Audio ({_mmss(item.get('duration_ms', 0))}): "
                         f"{audio_url_absolute(item['voice_id'])}")
        lines.append("")
    payload: dict[str, Any] = {
        "job_id": job_id,
        "candidate_first_name": first,
        "candidate_last_name": last,
        "candidate_email": answers.get("email", ""),
        "additional_comments": "\n".join(lines)[:5000],
    }
    li = _linkedin_url(answers)
    if li:
        payload["candidate_linkedin_url"] = li
    dover_id, dover_error = "", ""
    try:
        status, body = await _http_post(
            DOVER_URL, {"Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"}, payload)
        if status >= 300:
            dover_error = f"{status}: {body}"[:400]
        else:
            try:
                dover_id = str((json.loads(body) or {}).get("id") or "")[:120]
            except Exception:
                dover_id = ""
            if not dover_id:
                dover_id = f"ok:{status}"
    except Exception as e:  # noqa: BLE001
        dover_error = str(e)[:400]
    if dover_error:
        log.warning("join: Dover push failed for %s: %s", row_id, dover_error)
    try:
        await _db_set_dover(row_id, dover_id, dover_error)
    except Exception:
        log.exception("join: could not record the Dover result on %s", row_id)


async def finish(*, answers: dict[str, str], voices: dict[str, dict], lang: str,
                 session_id: str = "", ip: str = "", ua: str = "") -> str:
    """The row, then the email, then Dover. Each rail is fail-soft on its own so one broken one
    never takes the application with it. Returns the row id."""
    row_id = f"join_{uuid.uuid4().hex[:16]}"
    sheet = _sheet(answers, voices, lang)
    row = {
        "id": row_id, "lang": lang,
        "name": answers.get("name", "")[:200],
        # `link` and `why` are §1's columns, kept filled from §2's answers so anything already
        # reading the old shape (a query, an export) still sees the application rather than blanks.
        "link": (answers.get("github") or answers.get("other") or "")[:600],
        "why": (answers.get("proud") or (voices.get("proud") or {}).get("transcript") or "")[:4000],
        "location": (answers.get("location")
                     or (voices.get("location") or {}).get("transcript") or "")[:400],
        "email": answers.get("email", "")[:200],
        "transcript": sheet,
        "ip_hash": _ip_hash(ip), "ua": (ua or "")[:300],
        "github": answers.get("github", "")[:600],
        "linkedin": answers.get("linkedin", "")[:600],
        "other": answers.get("other", "")[:600],
        "phone": answers.get("phone", "")[:60],
        "voices": voices,
    }
    try:
        await _db_insert(row)
    except Exception:
        log.exception("join: could not store the application row %s (session %s)", row_id, session_id)

    try:
        await _mail_send(
            config.NOTIFY_EMAIL,
            f"Technical co-founder application: {row['name'] or 'no name'}",
            _email_html(sheet, lang))
    except Exception:
        log.exception("join: could not email the application %s", row_id)

    try:
        await _dover_push(row_id, answers, sheet)
    except Exception:
        log.exception("join: Dover push raised for %s", row_id)
    return row_id


# ── HTTP ───────────────────────────────────────────────────────────────────────────────────────────
async def _read_capped(request: Request, cap: int) -> bytes:
    """Refused the moment it passes `cap`, on the stream — a cap checked against Content-Length is a
    cap the sender sets (app.py's `_read_capped`, same reasoning)."""
    buf = bytearray()
    async for chunk in request.stream():
        buf += chunk
        if len(buf) > cap:
            raise HTTPException(413, "payload too large")
    return bytes(buf)


async def _read_upload_capped(upload: UploadFile, cap: int) -> bytes:
    buf = bytearray()
    while True:
        chunk = await upload.read(64 * 1024)
        if not chunk:
            break
        buf += chunk
        if len(buf) > cap:
            raise HTTPException(413, "audio too large")
    return bytes(buf)



# ── the GitHub read-back — «Ada Lovelace, 14 repos, mostly TypeScript. That you?» ──────────────────
# Peter, 2026-09-04: «When it gets their GitHub, can it read it and confirm the info back to them?»
# The public API answers from prod without a key (checked). LinkedIn is walled (HTTP 999) and has
# no read-back until a logged-in provider exists; see the spec.
GITHUB_IP_LIMIT = int(os.environ.get("JOIN_GITHUB_IP_LIMIT", "30") or "30")
GITHUB_IP_WINDOW_S = float(os.environ.get("JOIN_GITHUB_IP_WINDOW_S", "600") or "600")
_GITHUB_LOGIN_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
_GH_CACHE: dict[str, tuple[float, dict]] = {}
_GH_TTL_S = 3600.0


def github_login(raw: str) -> Optional[str]:
    """`ada`, `@ada`, `github.com/ada`, `https://github.com/ada/engine` → `ada`; else None."""
    t = (raw or "").strip()
    m = re.search(r"github\.com/([^/?#\s]+)", t, re.I)
    if m:
        t = m.group(1)
    t = t.lstrip("@").strip().rstrip("/")
    return t if _GITHUB_LOGIN_RE.match(t) else None


async def _github_get(url: str) -> tuple[int, Any]:
    import httpx
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "rocoto-join"}
    tok = os.environ.get("GITHUB_TOKEN", "")
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.get(url, headers=headers)
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, None


async def github_profile(login: str) -> Optional[dict[str, Any]]:
    """The few facts the confirm bubble needs, cached an hour. None when the user does not exist
    or GitHub is unreachable — the door never depends on it."""
    key = login.lower()
    hit = _GH_CACHE.get(key)
    if hit and time.time() - hit[0] < _GH_TTL_S:
        return hit[1]
    try:
        code, u = await _github_get(f"https://api.github.com/users/{login}")
        if code != 200 or not isinstance(u, dict):
            return None
        _, repos = await _github_get(
            f"https://api.github.com/users/{login}/repos?per_page=100&sort=updated&type=owner")
        repos = [r for r in (repos or []) if isinstance(r, dict) and not r.get("fork")]
        top = sorted(repos, key=lambda r: -(r.get("stargazers_count") or 0))[:3]
        langs: dict[str, int] = {}
        for r in repos:
            if r.get("language"):
                langs[r["language"]] = langs.get(r["language"], 0) + 1
        out = {
            "login": u.get("login") or login,
            "name": u.get("name") or "",
            "bio": (u.get("bio") or "")[:200],
            "company": (u.get("company") or "")[:80],
            "location": (u.get("location") or "")[:80],
            "public_repos": int(u.get("public_repos") or 0),
            "followers": int(u.get("followers") or 0),
            "languages": [k for k, _ in sorted(langs.items(), key=lambda kv: -kv[1])[:3]],
            "top": [{"name": r.get("name"), "language": r.get("language") or "",
                     "stars": int(r.get("stargazers_count") or 0),
                     "url": r.get("html_url") or ""} for r in top],
            "url": u.get("html_url") or f"https://github.com/{login}",
        }
    except Exception:
        log.exception("join: github lookup failed for %s", login)
        return None
    _GH_CACHE[key] = (time.time(), out)
    if len(_GH_CACHE) > 2000:
        for k in list(_GH_CACHE)[:500]:
            _GH_CACHE.pop(k, None)
    return out


@router.get("/github")
async def join_github(request: Request, login: str = "") -> JSONResponse:
    if not _rate_ok(f"gh:{_client_ip(request)}", limit=GITHUB_IP_LIMIT, window_s=GITHUB_IP_WINDOW_S):
        return JSONResponse({"ok": False, "error": "rate_limited"}, status_code=429)
    handle = github_login(login)
    if not handle:
        return JSONResponse({"ok": False, "error": "bad_login"})
    prof = await github_profile(handle)
    if prof is None:
        return JSONResponse({"ok": False, "error": "not_found", "login": handle})
    return JSONResponse({"ok": True, **prof})

@router.get("/health")
async def join_health() -> JSONResponse:
    return JSONResponse({"ok": True})


@router.post("/voice")
async def join_voice(request: Request,
                     audio: UploadFile = File(...),
                     session_id: str = Form(""),
                     field: str = Form(""),
                     lang: str = Form("en"),
                     duration_ms: str = Form("0")) -> JSONResponse:
    """PUBLIC, unauthenticated. One recording in, a stored + transcribed answer out."""
    ip = _client_ip(request)
    if not _rate_ok(f"voice:{ip}", limit=VOICE_IP_LIMIT, window_s=VOICE_IP_WINDOW_S):
        raise HTTPException(429, "too many requests")

    fld = (field or "").strip().lower()
    if fld not in FIELDS:
        return JSONResponse({"ok": False, "error": "field"}, status_code=400)

    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_AUDIO_BYTES + 65536:  # the multipart envelope, generously
        raise HTTPException(413, "audio too large")

    data = await _read_upload_capped(audio, MAX_AUDIO_BYTES)
    if not data:
        return JSONResponse({"ok": False, "error": "empty"}, status_code=400)

    mime = _sniff_audio(data)
    if mime not in EXT_BY_MIME:
        log.info("join: refusing audio sniffed=%r declared=%r (%d bytes)",
                 mime, audio.content_type, len(data))
        return JSONResponse({"ok": False, "error": "audio_type"}, status_code=415)

    try:
        claimed_ms = max(0, int(float(duration_ms or 0)))
    except (TypeError, ValueError):
        claimed_ms = 0

    voice_id = secrets.token_hex(16)
    ext = EXT_BY_MIME[mime]
    try:
        root = _ensure_media_dir()
        path = root / f"{voice_id}.{ext}"
        await asyncio.to_thread(path.write_bytes, data)
    except Exception:
        log.exception("join: could not store the recording for session %s", session_id[:40])
        return JSONResponse({"ok": False, "error": "storage"}, status_code=500)

    # THE FILE'S OWN DURATION FIRST, the client's claim only when the container will not say.
    probed = await asyncio.to_thread(_ffprobe_seconds, path)
    seconds = probed if probed is not None else (claimed_ms / 1000.0)
    if seconds > MAX_AUDIO_SECONDS:
        try:
            path.unlink()
        except OSError:
            pass
        return JSONResponse({"ok": False, "error": "audio_long"}, status_code=413)

    transcript = ""
    try:
        transcript = await _transcribe(data, mime)
    except Exception:
        # The recording is stored and servable; Peter can listen to it. A transcription outage is
        # never allowed to cost a candidate their answer.
        log.exception("join: transcription failed for %s (the audio is stored)", voice_id)

    out_ms = int(round(seconds * 1000)) if probed is not None else claimed_ms
    _write_sidecar(voice_id, {"voice_id": voice_id, "field": fld, "lang": _lang(lang),
                              "mime": mime, "bytes": len(data), "duration_ms": out_ms,
                              "transcript": transcript, "created": int(time.time()),
                              "session_id": _SESSION_RE.sub("", session_id or "")[:64]})
    return JSONResponse({"ok": True, "voice_id": voice_id, "transcript": transcript,
                         "duration_ms": out_ms, "url": audio_path(voice_id)})


@router.get("/audio/{voice_id}")
async def join_audio(voice_id: str) -> FileResponse:
    """By token only: 32 unguessable hex characters name the file, and nothing else opens it."""
    p = _stored_file((voice_id or "").strip().lower())
    if p is None:
        raise HTTPException(404, "not found")
    return FileResponse(p, media_type=MIME_BY_EXT.get(p.suffix.lstrip("."), "application/octet-stream"),
                        headers={"Cache-Control": "private, no-store"})


@router.post("/submit")
async def join_submit(request: Request) -> JSONResponse:
    """PUBLIC, unauthenticated. The finished application: validated, stored, mailed, pushed."""
    ip = _client_ip(request)
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_SUBMIT_BYTES:
        raise HTTPException(413, "payload too large")
    raw = await _read_capped(request, MAX_SUBMIT_BYTES)
    if not _rate_ok(f"submit:{ip}", limit=SUBMIT_IP_LIMIT, window_s=SUBMIT_IP_WINDOW_S):
        raise HTTPException(429, "too many requests")
    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        raise HTTPException(400, "bad json")
    if not isinstance(payload, dict):
        raise HTTPException(400, "bad payload")

    lang = _lang(payload.get("lang"))
    session_id = _SESSION_RE.sub("", str(payload.get("session_id") or ""))[:64]
    raw_answers = payload.get("answers")
    raw_voices = payload.get("voices")
    raw_transcripts = payload.get("transcripts")
    answers = {f: str((raw_answers or {}).get(f) or "").strip()[:MAX_ANSWER_CHARS] for f in FIELDS}

    # The voices, checked against the disk rather than believed: a voice_id is only an answer if the
    # bytes it names are actually here.
    voices: dict[str, dict[str, Any]] = {}
    for f in FIELDS:
        vid = str((raw_voices or {}).get(f) or "").strip().lower()
        if not vid:
            continue
        p = _stored_file(vid)
        if p is None:
            log.info("join: submit named a recording that is not on disk (%s, field %s)", vid[:8], f)
            continue
        note = _read_sidecar(vid)
        duration_ms = int(note.get("duration_ms") or 0)
        if not duration_ms:
            probed = await asyncio.to_thread(_ffprobe_seconds, p)
            duration_ms = int(round((probed or 0.0) * 1000))
        # The person may edit the transcript before sending; that reading wins, and the one the
        # upload produced stands in when they cleared it.
        said = str((raw_transcripts or {}).get(f) or "").strip()[:MAX_ANSWER_CHARS]
        voices[f] = {
            "voice_id": vid,
            "url": audio_path(vid),
            "duration_ms": duration_ms,
            "transcript": said or str(note.get("transcript") or "")[:MAX_ANSWER_CHARS],
        }

    for f in REQUIRED:
        if not answers.get(f):
            return JSONResponse({"ok": False, "error": f"missing_{f}"}, status_code=400)
    if not _email_ok(answers["email"]):
        return JSONResponse({"ok": False, "error": "email"}, status_code=400)
    if not _phone_ok(answers["phone"]):
        return JSONResponse({"ok": False, "error": "phone"}, status_code=400)
    for f in EITHER:
        if not answers.get(f) and f not in voices:
            return JSONResponse({"ok": False, "error": f"missing_{f}"}, status_code=400)
    for f in PROSE:
        text = answers.get(f, "")
        if text and _is_junk(text, field=f):
            return JSONResponse({"ok": False, "error": f"junk_{f}"}, status_code=400)

    row_id = await finish(answers=answers, voices=voices, lang=lang, session_id=session_id,
                          ip=ip, ua=(request.headers.get("user-agent") or "")[:300])
    return JSONResponse({"ok": True, "id": row_id})
