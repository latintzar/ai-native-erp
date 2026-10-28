"""Transcription + OCR — Deepgram nova-3 (diarized) then Claude Sonnet 4.6.

Mirrors the proven call-recorder pipeline params; the Sonnet pass cleans the raw
ASR into a faithful, readable, diarized transcript without dropping any words/numbers.
"""
from __future__ import annotations

import base64
import logging
from typing import Any, Optional
from urllib.parse import quote as _urlquote

import httpx

import config

log = logging.getLogger("rocoto.transcribe")

try:
    from anthropic import Anthropic
    # Explicit timeout so a stalled call can't hang a worker thread indefinitely.
    _anthropic = Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=45.0, max_retries=2) if config.ANTHROPIC_API_KEY else None
except Exception:  # pragma: no cover
    _anthropic = None

DG_URL = "https://api.deepgram.com/v1/listen"

TIDY_MODEL = "claude-haiku-4-5-20251001"
TIDY_SYSTEM = (
    "You tidy a short spoken note from a delivery driver. Fix punctuation, drop filler and false "
    "starts, keep 1-2 plain sentences in the driver's meaning. Return ONLY the tidied note."
)

POLISH_SYSTEM = (
    "You turn raw speech-to-text into a faithful, readable transcript the speaker will "
    "recognise instantly. RULES: preserve EVERY word, number, quantity, unit, product name, "
    "date and proper noun exactly — never invent, summarise, translate or drop anything. Keep "
    "Spanish/English code-switching exactly as spoken. Only fix punctuation, capitalisation and "
    "obvious ASR word-splits. Keep speaker turns; if the input is labelled 'Speaker 0/1' keep the "
    "turns and you MAY rename to 'Cliente'/'Operador' only when context makes the role obvious. "
    "Output ONLY the cleaned transcript, nothing else."
)


async def catalogue_keyterms(tenant: str, limit: int = 100) -> list[str]:
    """The tenant's own article names, as the transcription's domain prior.

    This is the cheapest large accuracy win available on the audio rail: the words a customer says
    into a voice note are, overwhelmingly, the names in this supplier's catalogue. Fail-soft to []
    — a keyterm list is a nicety and the transcription is not."""
    try:
        import db
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select name from catalogue_skus where tenant_id=$1 and in_assortment "
                "order by length(name) limit $2", tenant, int(limit))
        out: list[str] = []
        for r in rows:
            # the head words carry the bias; a full «LUBINA SALVAJE ENTERA 1-1,5 KG» is a phrase
            # nobody utters, while «lubina» and «rodaballo» are said a hundred times a morning.
            for w in str(r["name"] or "").replace(",", " ").split():
                w = w.strip().lower()
                if len(w) >= 4 and not any(c.isdigit() for c in w) and w not in out:
                    out.append(w)
        return out[:limit]
    except Exception:
        log.debug("catalogue keyterms unavailable for %s (fail-soft)", tenant, exc_info=True)
        return []


async def deepgram_diarize(audio: bytes, content_type: str,
                           keyterms: Optional[list[str]] = None) -> dict[str, Any]:
    """`keyterms` BIASES THE MODEL TOWARD WORDS THIS TRADE ACTUALLY SAYS (2026-08-19).

    Carlos, testing live: one voice note «se entendía bien y prácticamente sin fallos», another
    «más complicado de entender, no lo ha transcrito bien». That is the exact signature of a model
    with no domain prior — clean audio survives, anything harder collapses onto ordinary words.

    A fish wholesaler's vocabulary is almost entirely proper nouns and sizes: lubina, dorada,
    rodaballo, merluza del pincho, navaja, boquerón. Deepgram's own keyterm prompting exists for
    this, and our proven pipeline (peter-transcribe, which mirrors Hermes) has always used it —
    this organ never did. The catalogue IS the keyterm list, and every tenant already has one.

    Best-effort by construction: keyterm support varies by model and language, so a rejected
    parameter must not cost the customer their transcription. On any 4xx we retry once, clean."""
    params = {
        "model": "nova-3",
        # English-first (the app + catalogue are English). nova-3 still handles code-switched
        # Spanish words; set via DEEPGRAM_LANGUAGE if a tenant needs 'multi'.
        "language": config.DEEPGRAM_LANGUAGE,
        "punctuate": "true",
        "utterances": "true",
        "smart_format": "true",
        "paragraphs": "true",
        "diarize": "true",
        # OPTED OUT OF DEEPGRAM'S MODEL IMPROVEMENT PROGRAM. Their ToS §3.2 (Last Updated
        # 2026-08-06) grants them an "irrevocable, perpetual" licence to use Your Content
        # "including training and testing our Models", and §3.3 makes the opt-out per-REQUEST:
        # "Add mip_opt_out=true as a query parameter of all API requests that you want to be
        # excluded". Without it on every call, «tus mensajes no entrenan ningún modelo, ni
        # nuestro ni de un proveedor» — published on /terminos §17, /dpa §13, empresa.html and
        # datos-seguridad.html — is false. Deepgram also retains an opted-out request "only for
        # the duration necessary to process" it.
        "mip_opt_out": "true",
    }
    headers = {
        "Authorization": f"Token {config.DEEPGRAM_API_KEY}",
        "Content-Type": content_type or "audio/ogg",
    }
    # de-duped, trimmed, and capped — a keyterm list the length of a 300-SKU catalogue is a URL
    # nobody accepts, and the boost is carried by the words that actually recur.
    terms: list[str] = []
    for k in keyterms or []:
        k = (k or "").strip()
        if k and len(k) <= 40 and k.lower() not in {t.lower() for t in terms}:
            terms.append(k)
        if len(terms) >= 100:
            break

    async with httpx.AsyncClient(timeout=60) as c:
        url = DG_URL
        if terms:
            url += ("&" if "?" in DG_URL else "?") + "&".join(
                "keyterm=" + _urlquote(k) for k in terms)
        r = await c.post(url, params=params, headers=headers, content=audio)
        if terms and 400 <= r.status_code < 500:
            # the prior is a nicety; the transcription is not. Retry once without it.
            log.warning("deepgram: keyterm prompting rejected (%s) — retrying plain", r.status_code)
            r = await c.post(DG_URL, params=params, headers=headers, content=audio)
        r.raise_for_status()
        return r.json()


def parse_utterances(dg: dict) -> tuple[str, list[dict]]:
    """Return (speaker-labelled raw text, utterances[])."""
    utts: list[dict] = []
    try:
        for u in dg.get("results", {}).get("utterances", []) or []:
            _words = u.get("words") or []
            _wc = [w.get("confidence") for w in _words if isinstance(w.get("confidence"), (int, float))]
            utts.append({
                "speaker": int(u.get("speaker", 0)),
                "text": (u.get("transcript") or "").strip(),
                "start": u.get("start"),
                "end": u.get("end"),
                "confidence": u.get("confidence"),            # per-utterance confidence (Deepgram)
                "min_word_confidence": (min(_wc) if _wc else None),
                "low_word_frac": (sum(1 for c in _wc if c < 0.5) / len(_wc)) if _wc else None,
            })
    except Exception:
        pass
    if utts:
        raw = "\n".join(f"Speaker {u['speaker']}: {u['text']}" for u in utts if u["text"])
    else:
        raw = ""
        try:
            raw = dg["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
        except Exception:
            pass
    return raw, utts


def polish_sync(raw: str) -> str:
    """Clean a raw transcript with Claude Sonnet 4.6. Returns raw on any failure."""
    if not raw or not _anthropic:
        return raw
    try:
        msg = _anthropic.messages.create(
            model=config.POLISH_MODEL,
            max_tokens=4096,
            system=POLISH_SYSTEM,
            messages=[{
                "role": "user",
                "content": f"Raw transcript (Deepgram nova-3):\n\n{raw}\n\nReturn the cleaned transcript.",
            }],
        )
        out = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        return out or raw
    except Exception:
        log.exception("polish failed; returning raw")
        return raw


def haiku_tidy(raw: str) -> str:
    """Quick Claude Haiku tidy of a short spoken driver note. Returns raw on any failure."""
    if not raw or not _anthropic:
        return raw
    try:
        msg = _anthropic.messages.create(
            model=TIDY_MODEL,
            max_tokens=256,
            system=TIDY_SYSTEM,
            messages=[{"role": "user", "content": raw}],
        )
        out = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        return out or raw
    except Exception:
        log.exception("haiku tidy failed; returning raw")
        return raw


def extract_pdf_text(data: bytes) -> str:
    """Pull selectable text out of a PDF. Returns '' when there's none (scanned/empty).

    ⚠️ PDFIUM FIRST, pypdf SECOND (2026-08-09) — and this is the ROOT CAUSE of the fabricated tariff,
    not a tidy-up. A trade catalogue embeds its display fonts with a CUSTOM encoding and often no
    ToUnicode map; pypdf then hands back the glyph indices as if they were letters. Measured on
    Solobuey's real 21-page catalogue, pypdf returned

        «·omoKbajoKdeshuesadogXiK–gbKunidad»          for   «Lomo bajo deshuesado 8-9 Kg 1 unidad»

    — a substitution cipher in which only the DIGITS survive legibly. That is exactly the input on
    which the column heuristic found «35-40 Kg» and shipped `name="35", price=40.00`: the model had
    nothing readable to read, so the one thing that could still be pattern-matched was a weight
    range. pdfium (Chrome's PDF engine, a self-contained wheel — no system binary) resolves the same
    fonts correctly and returns clean product lines, which the model then reads faithfully with no
    price invented anywhere.

    pypdf stays as the fallback, so a box that has not installed `pypdfium2` yet degrades to the old
    behaviour instead of losing PDF intake entirely."""
    text = _pdf_text_pdfium(data)
    if text:
        return text
    try:
        import io

        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        out = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if out:
            log.info("pdf extract: pdfium found nothing; pypdf read %d chars", len(out))
        return out
    except Exception:
        log.exception("pdf extract failed")
        return ""


def _pdf_text_pdfium(data: bytes) -> str:
    """The pdfium read. '' when the library is absent or the document has no text layer, so the
    caller falls through — a missing optional dependency must never take PDF intake down."""
    try:
        import pypdfium2 as pdfium
    except Exception:
        log.warning("pdf extract: pypdfium2 is not installed; falling back to pypdf "
                    "(custom-encoded catalogue fonts will come back scrambled)")
        return ""
    doc = None
    try:
        doc = pdfium.PdfDocument(data)
        pages = []
        for page in doc:
            tp = page.get_textpage()
            try:
                pages.append(tp.get_text_range() or "")
            finally:
                tp.close()
                page.close()
        return "\n".join(pages).strip()
    except Exception:
        log.exception("pdf extract: pdfium failed (falling back to pypdf)")
        return ""
    finally:
        try:
            if doc is not None:
                doc.close()
        except Exception:
            pass


def polish_document_sync(raw: str) -> str:
    """Tidy extracted PDF text the same faithful way we polish ASR. Returns raw on failure."""
    return polish_sync(raw) if raw else raw


def ocr_image_sync(image_bytes: bytes, mime: str, caption: str = "") -> str:
    """Extract text from an image with Claude Sonnet 4.6 vision. Returns '' on failure."""
    if not _anthropic:
        return ""
    media_type = (mime or "image/jpeg").split(";")[0].strip()
    if media_type not in {"image/jpeg", "image/png", "image/gif", "image/webp"}:
        media_type = "image/jpeg"
    try:
        b64 = base64.standard_b64encode(image_bytes).decode()
        prompt = (
            "Transcribe ALL text in this image verbatim. Preserve every number, quantity, unit, "
            "product name, and line break. Transcribe handwriting faithfully. If it is an order or "
            "list, keep the line structure. If there is no text, describe the image in one short line."
        )
        if caption:
            prompt += f"\n\n(Message caption: {caption})"
        msg = _anthropic.messages.create(
            model=config.OCR_MODEL,
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
    except Exception:
        log.exception("ocr failed")
        return ""
