"""Rocoto onboarding — catalogue file → normalized SKU rows (brain/skuparse.py).

Step 1 of the wizard: the supplier drops a catalogue (CSV / Excel / PDF / photo of a
price list) and we turn it into structured SKU rows so the "real parsed count" replaces
the old "248" mock and feeds the understand/matching pass.

TWO public entry points (§5.10.2 — a catalogue arrives as a FILE or as a PASTE):

    async def parse_catalogue(file_path, filename) -> dict
    async def parse_paste(text, source_name='pegado') -> dict
        → {"ok", "skus": [{"code","name","family","unit","price"}], "count", "error",
           "source_kind", "source_rows", "warnings": [{"code","detail"}], "truncated"}

It does NOT touch the DB — the caller persists the result (wizard_state, or a
`catalogue_intake` row).

Pipeline (all fail-soft, NEVER raises to the caller):
  1. Read the file bytes (or take the pasted text as-is).
  2. Dispatch by extension:
       .csv               → text, csv module (sniff delimiter), header + rows.
       .xlsx / .xls       → LAZY openpyxl (try/except → error if missing), first sheet.
       .pdf               → transcribe.extract_pdf_text(bytes).
       image (.jpg/.jpeg/.png/.webp/.gif) → transcribe.ocr_image_sync(bytes, mime,
                            caption='catálogo de productos').
       unknown            → best-effort text decode.
     A PASTE has no extension, so it dispatches on CONTENT instead: a delimiter that repeats
     consistently down the lines makes it TABULAR (a copied spreadsheet block, TSV, or a `;`
     export dropped into the box); anything else is a LIST (the WhatsApp-shaped «Chorizo sarta
     — 9,80 €/kg» a supplier actually sends).
  3. Hand the extracted rows/text to Claude Sonnet (config.SKUPARSE_MODEL) via the
     forced-tool pattern (mirrors orders.extract_order_sync): asyncio.to_thread, SDK
     max_retries, fall back to config.ORDER_EXTRACT_FALLBACK_MODEL on overload/ratelimit/
     timeout.
  4. Best-effort fallback: if the model returns nothing but we deterministically parsed
     CSV/Excel columns heuristically, return those rows so onboarding never stalls.

count = len(skus).

⚠️ TRUNCATION IS NEVER SILENT (§5.10.2). `_MODEL_ROW_CAP` used to CUT the input at 400 rows and
say nothing: a 2 000-line list was model-read for 400 rows and heuristic (or lost) for the rest,
with no trace of it anywhere. Tier C and D catalogues (§5.10.1) cannot honestly exist under that.
So the rows are now BATCHED through the model — `_MODEL_ROW_CAP` rows per call, the header line
repeated on every batch so the columns stay meaningful, results concatenated — and every ceiling
that does bite comes back as a `warnings` entry naming exactly how many rows it read which way.
The caller renders those; nothing here decides for the operator what he is allowed to know.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
import re
from typing import Any, Optional

import anthropic

import config
import transcribe

log = logging.getLogger("rocoto.skuparse")

# Rows per MODEL CALL — a batch size, no longer a cliff. `_chunks_for_model` cuts the text into
# batches of this many rows and every batch is read; see the module docstring.
_MODEL_ROW_CAP = 400
# How many batches we are willing to spend on one upload. 20 × 400 = 8 000 model-read rows, which
# covers the biggest catalogue anyone in this trade has. Past it, a TABULAR source still returns
# every remaining row deterministically (the heuristic column map) and says so in `warnings`.
_MAX_CHUNKS = int(os.environ.get("ROCOTO_SKUPARSE_MAX_CHUNKS", "20"))
# The answer ceiling for ONE batch. 400 rows of `{code,name,family,unit,price}` measured at ~11 000
# output tokens on a real trade catalogue, so the old 8192 cut every full batch off mid-JSON and
# lost its tail with nothing to show for it. See `_extract_skus_sync`.
_MODEL_MAX_TOKENS = int(os.environ.get("ROCOTO_SKUPARSE_MAX_TOKENS", "16000") or "16000")
_MAX_CELL_CHARS = 200          # trim absurdly long cells before joining a row
_MAX_TEXT_CHARS = 60_000       # the PASTE ceiling — the route REFUSES above it, never clips silently
_MAX_FILE_TEXT_CHARS = 1_200_000   # a real 4 000-line price list is ~250 KB of text; this is headroom

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

# ──────────────────────────── model tool schema ────────────────────────────

_RECORD_CATALOGUE_TOOL = {
    "name": "record_catalogue",
    "description": (
        "Record every product row found in a Spanish food producer-distributor's catalogue / "
        "price list (embutidos, charcutería, fruta-verdura, quesos, panadería). Do NOT invent "
        "products, prices, families or units — extract only what is actually present, one entry "
        "per real product row. Skip section headers, totals, page numbers and blank lines."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "skus": {
                "type": "array",
                "description": "one entry per real product row in the catalogue",
                "items": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "the SKU / reference / código if the row has one, else empty string",
                        },
                        "name": {
                            "type": "string",
                            "description": "the product name / description as written (e.g. 'Chorizo ibérico de bellota')",
                        },
                        "family": {
                            "type": "string",
                            "description": "the category / familia if stated or clearly implied by a section (else empty string)",
                        },
                        "unit": {
                            "type": "string",
                            "description": "unit of sale as stated: kg, g, ud, caja, docena, litro, sarta, pieza… (empty if none)",
                        },
                        "price": {
                            "type": ["number", "null"],
                            "description": "the unit price as a number if the row states one, else null",
                        },
                    },
                    "required": ["name"],
                },
            },
        },
        "required": ["skus"],
    },
}

_SYSTEM = (
    "You read the catalogue / price list of a small Spanish family food producer-distributor "
    "(embutidos, charcutería, fruta-verdura, quesos, panadería). The input is the raw text of "
    "a spreadsheet, a PDF, or a photo of a price sheet — messy, with headers, merged cells and "
    "section titles. Your ONLY job is to extract EVERY real product row faithfully. NEVER invent "
    "products, prices, families or units — record only what is present. Leave a field empty ('' "
    "or null) when the row does not state it. Skip section headers, subtotals, page numbers and "
    "blank rows. Return every product; do not summarise or truncate."
)


# ──────────────────────────── public entry point ────────────────────────────

def _extract_file_sync(file_path: str, filename: str) -> dict:
    """READ + EXTRACT, SYNCHRONOUSLY AND OFF THE EVENT LOOP (2026-08-09 review, F5).

    Every line below used to run inside `parse_catalogue`'s coroutine body. `parse_catalogue` was
    `async def`, which reads like «this yields» and does not: `open().read()` on up to 25 MB, the
    openpyxl walk, `extract_pdf_text`, `ocr_image_sync` are all blocking CPU, and only `_finish`'s
    model call was ever handed to `asyncio.to_thread`. Prod runs ONE uvicorn worker (no `--workers`),
    and it is the same loop serving paying customers' WhatsApp webhooks and Twilio voice callbacks —
    so a 25 MB xlsx (a zip that expands ~1000:1) or a 25 MB CSV of 25M one-byte lines stalled the
    whole deployment, not the demo. Split out so the caller can `to_thread` the entire thing.

    Returns the extraction, or `{"fail": "<es-ES sentence>"}`. Never raises."""
    try:
        ext = _ext(filename) or _ext(file_path)
        try:
            with open(file_path, "rb") as fh:
                data = fh.read()
        except Exception as exc:  # pragma: no cover — the endpoint hands us a real path
            log.warning("skuparse: cannot read %s: %s", file_path, exc)
            return {"fail": f"No se pudo leer el archivo: {exc}"}
        if not data:
            return {"fail": "El archivo está vacío."}

        # extract to (text, heuristic_rows, source_rows). heuristic_rows + source_rows are only
        # populated for TABULAR formats (CSV/Excel/tabular paste), where the row count is a
        # deterministic fact rather than a guess — which is exactly what makes the §5.10.2 count
        # guard possible there and impossible on a PDF or a photograph.
        text = ""
        heuristic_rows: list[dict] = []
        source_rows: Optional[int] = None
        kind = "otro"
        warnings: list[dict] = []

        colmap: Optional[dict] = None
        if ext == ".csv":
            kind = "csv"
            text, heuristic_rows, source_rows, colmap = _from_csv(data)
        elif ext in (".xlsx", ".xls"):
            kind = "excel"
            xr = _from_excel(data, warnings)
            if xr is None:
                return {"fail": "No se pudo leer el Excel (falta la librería openpyxl en el "
                                "servidor)."}
            text, heuristic_rows, source_rows, colmap = xr
        elif ext == ".pdf":
            kind = "pdf"
            text = _clip_text(transcribe.extract_pdf_text(data), _MAX_FILE_TEXT_CHARS, warnings)
        elif ext in _IMAGE_EXTS:
            kind = "foto"
            mime = _IMAGE_MIME.get(ext, "image/jpeg")
            text = _clip_text(
                transcribe.ocr_image_sync(data, mime, caption="catálogo de productos"),
                _MAX_FILE_TEXT_CHARS, warnings)
        else:
            # No usable extension — decide on CONTENT, exactly as a paste does.
            kind, text, heuristic_rows, source_rows, colmap = _from_loose_text(
                _decode_text(data), warnings)

        if not text.strip() and not heuristic_rows:
            return {"fail": "No se pudo extraer contenido legible del archivo."}
        return {"text": text, "rows": heuristic_rows, "kind": kind,
                "source_rows": source_rows, "warnings": warnings, "colmap": colmap}
    except Exception:
        log.exception("skuparse: extraction failed for %s", filename)
        return {"fail": "Error inesperado al procesar el catálogo."}


async def parse_catalogue(file_path: str, filename: str) -> dict:
    """Parse a catalogue FILE into normalized SKU rows. NEVER raises.

    Returns {"ok", "skus", "count", "error", "source_kind", "source_rows", "warnings",
    "truncated"}. `skus` items are {"code","name","family","unit","price"} with empty-string /
    null defaults. The four trailing keys are additive — the wizard's older callers read the
    first four and are unaffected.

    The extraction runs in a worker thread (`_extract_file_sync`) and the model batch already did
    (`_finish` → `_extract_many_sync`), so nothing in this path blocks the loop that answers a
    paying customer's WhatsApp webhook."""
    try:
        got = await asyncio.to_thread(_extract_file_sync, file_path, filename)
        if got.get("fail"):
            return _fail(str(got["fail"]))
        return await _finish(got["text"], got["rows"], kind=got["kind"],
                             source_rows=got["source_rows"], warnings=got["warnings"],
                             colmap=got["colmap"])
    except Exception:
        # Absolute backstop — the onboarding endpoint must never see an exception.
        log.exception("skuparse: unexpected failure for %s", filename)
        return _fail("Error inesperado al procesar el catálogo.")


async def parse_paste(text: str, source_name: str = "pegado") -> dict:
    """Parse PASTED text into the same normalized SKU rows. NEVER raises.

    The paste is the likely case and it was the missing one: `parse_catalogue` dispatches on file
    EXTENSION and a paste has none. A supplier's list lives in an open Excel window, and Ctrl-C is
    one gesture where «export it, find the file, upload it» is five.

    Two shapes arrive here and both must work:
      · a copied spreadsheet BLOCK (tab-separated) or a `;`/`,` export dropped into the box — read
        as tabular, so it carries a deterministic row count and a heuristic column map;
      · the WhatsApp-shaped LIST a supplier actually types — «Chorizo sarta 9,80 €/kg», one per
        line, sometimes with a `-` or `•` in front and a section title in the middle.
    Neither is guessed at: `_looks_tabular` decides, and the decision comes back as `source_kind`
    so the operator is told which one we thought it was."""
    raw = text or ""
    if not raw.strip():
        return _fail("No hay nada que leer — el texto está vacío.")
    if len(raw) > _MAX_TEXT_CHARS:
        # REFUSE rather than keep the first 60 000 characters. A silently-clipped paste is a
        # catalogue with a hole in it that nobody can see (§5.10.2).
        return _fail(f"El texto es demasiado largo ({_miles(len(raw))} caracteres, el máximo es "
                     f"{_miles(_MAX_TEXT_CHARS)}). Súbelo como archivo y lo leo entero.")
    try:
        warnings: list[dict] = []
        kind, blob, heuristic_rows, source_rows, colmap = _from_loose_text(raw, warnings)
        if not blob.strip() and not heuristic_rows:
            return _fail("No se pudo extraer contenido legible del texto.")
        return await _finish(blob, heuristic_rows, kind=kind, source_rows=source_rows,
                             warnings=warnings, colmap=colmap)
    except Exception:
        log.exception("skuparse: unexpected failure for paste %s", source_name)
        return _fail("Error inesperado al procesar el texto.")


async def _finish(text: str, heuristic_rows: list[dict], *, kind: str,
                  source_rows: Optional[int], warnings: list[dict],
                  colmap: Optional[dict] = None) -> dict:
    """The shared back half: batch the text through the model, fall back to the deterministic
    column map, and account for EVERY row that the ceilings kept the model from seeing."""
    header, chunks, n_lines = _chunks_for_model(text)
    capped = len(chunks) > _MAX_CHUNKS
    used = chunks[:_MAX_CHUNKS]
    skus, cut_batches = await asyncio.to_thread(_extract_many_sync, header, used)

    model_rows = len(skus)
    if not skus and heuristic_rows:
        # THE HEURISTIC IS NOT A PARSER AND MUST NEVER BE THE ANSWER (Peter, 2026-08-09, angry, and
        # right). It used to be the fallback when the model returned nothing, and it SHIPPED — which
        # is how Solobuey's real catalogue (columns «Artículo | Formato | Peso», no price column at
        # all) came back as `name="35", price=40.00` : the column reader had found the WEIGHT RANGE
        # «35-40 Kg» and served it as a name and a tariff. A distributor would have been shown
        # invented prices for his own goods, which is the one thing this product may never do
        # (`orders_tool` refuses to fabricate a SKU or a price; the parse layer was doing it two
        # steps earlier, before the runtime could refuse anything).
        #
        # The reading is the model's job. The column scan stays for what it is genuinely good at —
        # telling the model where the header is and what the columns mean — and for nothing else.
        # When the model cannot read it, we SAY SO and the visitor tries again. An honest refusal
        # costs one retry; a fabricated tariff costs their trust the first time they spot a price
        # that was never theirs.
        log.warning("skuparse: model returned no rows (%d heuristic rows discarded, never shipped)",
                    len(heuristic_rows))
        return _fail("Esto necesita otra pasada. Vuelve a mandármelo y lo leo entero.")
    elif capped:
        # Past the batch ceiling. A TABULAR source still knows every remaining row exactly, so it
        # gets them — deduped by name against what the model already produced. Either way the
        # operator is TOLD, with numbers.
        model_lines = len(used) * _MODEL_ROW_CAP
        if heuristic_rows:
            seen = {matcher_normalize(s.get("name", "")) for s in skus}
            tail = [r for r in heuristic_rows
                    if matcher_normalize(r.get("name", "")) not in seen]
            skus = list(skus) + tail
            warnings.append({"code": "partial_model_read", "detail":
                             f"Es muy largo: he leído {model_lines} líneas con toda la atención y "
                             f"las {max(n_lines - model_lines, 0)} restantes por columnas."})
        else:
            warnings.append({"code": "partial_model_read", "detail":
                             f"Es muy largo: he leído las primeras {model_lines} líneas de "
                             f"{n_lines}. Súbelo por partes para que las lea todas."})

    skus = [c for c in (_clean_sku(s) for s in (skus or [])) if c["name"]]

    if cut_batches:
        # A batch that ran out of answer room dropped its tail. §5.10.2's law is that a shortened
        # catalogue is never silent, so this is said with the number attached.
        warnings.append({"code": "partial_model_read", "n": cut_batches, "detail":
                         f"Una parte se me ha quedado a medias ({cut_batches} de {len(used)} "
                         f"bloques). Divídelo en dos y te lo leo entero."})

    # ⚠️ A CATALOGUE WITH NO PRICE COLUMN IS A NORMAL CATALOGUE — Solobuey's 21-page tarifa lists
    # «Artículo · Peso · Formato» and states a price nowhere; the prices travel by phone. Nothing is
    # said about it HERE on purpose: `brain/onboarding._row_warnings` already counts price-less rows
    # for every door and says it in one sentence. A second sentence about the same fact is a second
    # place for it to be wrong.

    return {"ok": True, "skus": skus, "count": len(skus), "error": "",
            "source_kind": kind, "source_rows": source_rows, "warnings": warnings,
            "model_rows": model_rows,
            # §17.56 — ADDITIVE key: the column-confirmation payload for tabular sources with a
            # recognised header, None everywhere else. Older callers read the keys above unchanged.
            "colmap": colmap,
            "truncated": any(w["code"] in ("clipped", "partial_model_read") for w in warnings)}


def matcher_normalize(s: str) -> str:
    """Local, dependency-free fold for de-duplicating a tail against a head. Deliberately NOT
    `brain.matcher.normalize`: this module is imported by the wizard before the matcher's own
    dependencies are guaranteed present, and the only thing needed here is case+space folding."""
    return " ".join((s or "").lower().split())


# ──────────────────────────── extraction (model) ────────────────────────────

def _extract_many_sync(header: str, chunks: list[str]) -> tuple[list[dict], int]:
    """Read EVERY batch and concatenate → (rows, batches that ran out of answer room).

    One client for the whole upload, one call per batch, the header line prepended to each so the
    columns keep meaning something after the first batch.

    A batch that fails contributes nothing and does not abort the rest: half a catalogue read is
    strictly better than none, and the caller's row accounting will show the shortfall against
    `source_rows` rather than pretending the file was that size."""
    if not chunks or not config.ANTHROPIC_API_KEY:
        return [], 0
    # Reliability mirrors orders.extract_order_sync: SDK backs off max_retries times, and if the
    # primary model stays overloaded we fall back to a second model with spare capacity.
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=8, timeout=180.0)
    out: list[dict] = []
    cut = 0
    for i, chunk in enumerate(chunks):
        body = (header + "\n" + chunk) if (header and i > 0) else chunk
        rows, truncated = _extract_skus_sync(body, client=client)
        out.extend(rows)
        cut += 1 if truncated else 0
    return out, cut


def _extract_skus_sync(text: str, client: Optional[Any] = None) -> tuple[list[dict], bool]:
    """Forced-tool extraction with Claude Sonnet; fallback model on overload. → (rows, ran out of
    answer room). Returns ([], False) on any failure (the caller then reports an honest failure).
    Never raises.

    ⚠️ `max_tokens` IS A ROW CEILING IN DISGUISE, and 8192 was below the real one (measured
    2026-08-09 on Solobuey's 21-page catalogue: 751 articles came back as ~11 000 output tokens per
    400-row batch, so every batch would have been cut off mid-answer). A forced tool call that hits
    the cap returns a HALF-WRITTEN JSON object — the rows that did fit are silently fewer than the
    rows that existed, with nothing anywhere to say so. 16 000 clears a full 400-row batch with
    headroom, and a batch that still runs out now comes back flagged so the caller can say it out
    loud rather than quietly shipping a shorter catalogue than the file had."""
    text = (text or "").strip()
    if not text or not config.ANTHROPIC_API_KEY:
        return [], False
    if client is None:
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=8, timeout=180.0)
    models = [config.SKUPARSE_MODEL]
    if config.ORDER_EXTRACT_FALLBACK_MODEL and config.ORDER_EXTRACT_FALLBACK_MODEL not in models:
        models.append(config.ORDER_EXTRACT_FALLBACK_MODEL)

    resp = None
    for model in models:
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=_MODEL_MAX_TOKENS,
                system=_SYSTEM,
                tools=[_RECORD_CATALOGUE_TOOL],
                tool_choice={"type": "tool", "name": "record_catalogue"},
                messages=[{
                    "role": "user",
                    "content": (
                        "Extract every product row from this catalogue / price list:\n\n" + text
                    ),
                }],
            )
            break
        except (anthropic.OverloadedError, anthropic.RateLimitError, anthropic.APITimeoutError):
            log.warning("skuparse extraction overloaded on %s; trying next model", model)
            continue
        except Exception:
            log.exception("skuparse extraction call failed on %s", model)
            return [], False
    if resp is None:
        log.warning("skuparse extraction unavailable (all models overloaded)")
        return [], False

    truncated = getattr(resp, "stop_reason", "") == "max_tokens"
    if truncated:
        log.warning("skuparse: a batch hit max_tokens (%d) — its tail is missing and the caller "
                    "is told", _MODEL_MAX_TOKENS)
    data: Optional[dict] = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "record_catalogue":
            data = block.input
            break
    if not data:
        return [], truncated
    return list(data.get("skus") or []), truncated


# ──────────────────────────── file readers ────────────────────────────

def _from_csv(data: bytes) -> tuple[str, list[dict], Optional[int], Optional[dict]]:
    """Parse CSV → (text-blob for the model, heuristic rows, deterministic row count, colmap)."""
    raw = _decode_text(data)
    if not raw.strip():
        return "", [], 0, None
    rows = _read_delimited(raw)
    if rows is None:
        return raw[:_MAX_FILE_TEXT_CHARS], [], None, None
    return _rows_to_text_and_heuristic(rows)


def _read_delimited(raw: str) -> Optional[list[list[str]]]:
    """Sniff the delimiter and read the text as a table. None when it will not parse at all."""
    sample = raw[:4096]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except Exception:
        # Sniffer is finicky; fall back to whichever common delimiter appears most in the sample.
        delimiter = max(",;\t|", key=lambda d: sample.count(d))
    try:
        return [r for r in csv.reader(io.StringIO(raw), delimiter=delimiter)]
    except Exception:
        log.exception("skuparse: delimited parse failed")
        return None


# A comma that is NOT a decimal separator (i.e. not sitting between two digits).
_COMMA_SEP_RE = re.compile(r"(?<!\d),|,(?!\d)")


def _looks_tabular(text: str) -> bool:
    """Does this pasted text have COLUMNS? True when one of the usual delimiters appears on most
    non-blank lines and roughly the same number of times per line.

    Deliberately strict about the SAME count: a prose price list («Chorizo sarta, 9,80 el kilo,
    muy bueno») is full of commas but they land wherever the sentence puts them, and reading that
    as a 3-column table would shred it. A real copied block is regular."""
    lines = [ln for ln in (text or "").splitlines() if ln.strip()][:200]
    if len(lines) < 2:
        return False
    for d in ("\t", ";", "|", ","):
        # ⚠️ THE COMMA IS A DECIMAL POINT IN SPAIN. «Chorizo sarta - 9,80 €/kg» has exactly one
        # comma on every line, so a naive count reads a typed WhatsApp list as a two-column table
        # and the heuristic parse then shreds it. Commas sitting BETWEEN TWO DIGITS are decimals
        # and are not evidence of a column, so they are not counted.
        counts = ([len(_COMMA_SEP_RE.findall(ln)) for ln in lines] if d == ","
                  else [ln.count(d) for ln in lines])
        withd = [c for c in counts if c > 0]
        if len(withd) < max(2, int(len(lines) * 0.6)):
            continue
        mode = max(set(withd), key=withd.count)
        if mode == 0:
            continue
        # ≥70 % of the delimited lines agree on the column count → it is a table.
        if sum(1 for c in withd if c == mode) >= len(withd) * 0.7:
            return True
    return False


def _from_loose_text(raw: str, warnings: list[dict]) -> tuple[str, str, list[dict], Optional[int], Optional[dict]]:
    """Text with no extension to trust → (kind, text-blob, heuristic rows, deterministic count,
    colmap — None unless the text turned out to be a table with a recognisable header).

    `kind` is 'tabla' when it has columns and 'lista' when it is the line-per-product shape a
    supplier types into WhatsApp. The caller shows it, so a wrong guess is visible rather than
    quietly changing what got read."""
    text = _clip_text(raw, _MAX_FILE_TEXT_CHARS, warnings)
    if _looks_tabular(text):
        rows = _read_delimited(text)
        if rows is not None:
            blob, heur, n, colmap = _rows_to_text_and_heuristic(rows)
            return "tabla", blob, heur, n, colmap
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # ⚠️ NO ROW COUNT FOR A LIST, deliberately. A typed list's LINES are not its PRODUCTS — a
    # greeting, two section titles and a «pedido mínimo» footer are lines and none of them is an
    # article. Handing that number to the §5.10.2 count guard makes it compare products against
    # prose: on the very first real WhatsApp list it landed on 6/10, one hundredth from accusing a
    # perfectly-read list of having lost half of itself. `None` is the honest answer, and it is what
    # makes the preview say «no puedo contar, míralo tú» instead of inventing a denominator.
    return "lista", text, _list_heuristic_rows(lines), None, None


# A pasted list line: an optional bullet, the name, a SEPARATOR, then a price and maybe a unit.
# «- Chorizo sarta extra 500 g — 9,80 €/kg» · «Fuet extra 170 g  2,55» · «Queso tetilla 5,70 ud»
#
# The separator is the whole difficulty. A single space between the name and the number is not
# enough evidence on its own — «ACEITUNA GORDAL CUBO 5 KG» is a FORMAT, not a five-euro olive —
# so a bare space only counts when the number carries cents AND something follows it that reads
# like money or a unit. A price list in Spain writes 9,80; a pack size writes 5.
_LIST_LINE_RE = re.compile(
    r"^\s*(?:[-*•·–—]\s*)?(?P<name>\S.*?)"
    r"(?:\s*[-–—:]\s*"                                                   # an explicit dash / colon
    r"|\s{2,}"                                                           # a column-ish gap
    r"|\s+(?=\d{1,4}[.,]\d{1,2}\s*(?:€|EUR|eur|[/A-Za-z])))"             # cents + money/unit after
    r"(?P<price>\d{1,4}(?:[.,]\d{1,2})?)\s*"
    r"(?:€|EUR|eur)?\s*"
    r"(?:[/x×]\s*)?(?P<unit>[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,10})?\.?\s*$"
)
# Section titles a supplier types between blocks: «*** EMBUTIDOS ***», «QUESOS:», «— FRUTA —».
_SECTION_RE = re.compile(r"^\s*[*\-–—=•\s]*([A-ZÁÉÍÓÚÜÑ][^a-z]{2,40}?)[*\-–—=:•\s]*$")
# Lines a price list ends with. They parse beautifully as products and are not products.
_FOOTER_RE = re.compile(
    r"^(pedido|total|subtotal|portes|transporte|iva|base imponible|forma de pago|vigente|"
    r"tarifa|precios|descuento|nota|observaciones)\b", re.I)


def _list_heuristic_rows(lines: list[str]) -> list[dict]:
    """Deterministic read of the WhatsApp-shaped list, so this format has a fallback and a count
    like every other one. A line that is plainly a SECTION TITLE becomes the `family` of the lines
    beneath it rather than a product — which is the single most common way a pasted list is
    mis-read, and the reason a bare `family=''` is not good enough here."""
    out: list[dict] = []
    family = ""
    for ln in lines:
        m = _LIST_LINE_RE.match(ln)
        if not m:
            sec = _SECTION_RE.match(ln)
            if sec and not any(ch.isdigit() for ch in sec.group(1)):
                family = sec.group(1).strip(" *-–—=:•").lower()
            continue
        name = m.group("name").strip(" .-–—:·")
        if not name or len(name) < 2 or _FOOTER_RE.match(name):
            continue
        out.append(_clean_sku({
            "code": "", "name": name, "family": family,
            "unit": (m.group("unit") or "").strip(" ."),
            "price": _parse_price(m.group("price")),
        }))
    return out


# THE EXCEL WALK IS BOUNDED (2026-08-09 review, F5). `iter_rows` over `read_only` openpyxl streams
# the sheet, so a 25 MB xlsx — which is a zip, and sheet XML compresses roughly 1000:1 — could
# materialise hundreds of millions of cells into a Python list of lists before anything downstream
# got a say. A real supplier catalogue is thousands of rows, not millions; these ceilings are two
# orders of magnitude above the largest plausible one and are a memory bound, not a product limit.
# Clipping is ANNOUNCED (`excel_clipped` rides the warnings the operator sees) because §5.10.2's
# whole point is that a silently-shortened catalogue is a catalogue with an invisible hole in it.
_EXCEL_MAX_ROWS = int(os.getenv("ROCOTO_EXCEL_MAX_ROWS", "50000") or "50000")
_EXCEL_MAX_CELLS = int(os.getenv("ROCOTO_EXCEL_MAX_CELLS", "1000000") or "1000000")
_EXCEL_MAX_CELL_CHARS = 2000


def _from_excel(data: bytes,
                warnings: Optional[list[dict]] = None
                ) -> Optional[tuple[str, list[dict], Optional[int], Optional[dict]]]:
    """Parse the first sheet of an .xlsx/.xls → (text-blob, heuristic rows, deterministic count,
    colmap).

    openpyxl is LAZY-imported: if it isn't installed we return None so the caller reports a
    clean error rather than crashing the onboarding endpoint."""
    rows = _excel_matrix(data, warnings)
    if rows is None:
        return None
    if not rows:
        return "", [], None, None
    return _rows_to_text_and_heuristic(rows)


def _excel_matrix(data: bytes,
                  warnings: Optional[list[dict]] = None) -> Optional[list[list[str]]]:
    """The raw first-sheet cell matrix, or None when openpyxl is missing / [] when unreadable.
    Split out of `_from_excel` so `extract_rows` (the §17.56 remap path) re-derives the SAME
    matrix the original parse saw — one extraction, two callers, indices that cannot drift.

    `warnings` is optional so the remap caller (which re-derives indices and shows no preview) can
    keep passing nothing; the ceilings apply either way, so the two derivations still agree."""
    try:
        import openpyxl  # noqa: F401  (lazy — optional dep)
    except Exception:
        log.warning("skuparse: openpyxl not installed; cannot read Excel")
        return None
    clipped = ""
    try:
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.active  # first / active sheet
        rows: list[list[Any]] = []
        cells = 0
        for row in ws.iter_rows(values_only=True):
            r = ["" if c is None else c for c in row]
            cells += len(r)
            rows.append(r)
            if len(rows) >= _EXCEL_MAX_ROWS:
                clipped = f"{_EXCEL_MAX_ROWS} filas"
                break
            if cells >= _EXCEL_MAX_CELLS:
                clipped = f"{_EXCEL_MAX_CELLS} celdas"
                break
        try:
            wb.close()
        except Exception:
            pass
    except Exception:
        log.exception("skuparse: excel parse failed")
        return []
    if clipped:
        log.warning("skuparse: excel clipped at %s (%d rows read)", clipped, len(rows))
        if warnings is not None:
            warnings.append({"code": "excel_clipped", "n": len(rows), "detail":
                             f"Ese Excel es enorme: he leído las primeras {len(rows)} filas y he "
                             f"parado ahí ({clipped}). Si tu tarifa es más larga, mándanosla y la "
                             f"cargamos nosotros."})
    # each cell is bounded too: one abusive cell holding megabytes of text is the same attack in
    # a different shape, and no real product name is 2 000 characters long.
    return [[str(c)[:_EXCEL_MAX_CELL_CHARS] for c in r] for r in rows]


def _decode_text(data: bytes) -> str:
    """Best-effort text decode of arbitrary bytes (unknown/text files, CSV)."""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="replace")


# ──────────────────────────── row helpers ────────────────────────────

def _clean_matrix(rows: list[list]) -> list[list[str]]:
    """Trim cells and drop fully-empty rows — the ONE normalisation every tabular consumer shares.
    The §17.56 colmap carries ROW INDICES into this cleaned matrix (`header_row`, the sample), and
    the remap path re-derives the matrix from the stored bytes later; both must clean identically
    or a confirmed column assignment would silently point one row off."""
    return [
        [(_trim_cell(c)) for c in r]
        for r in rows
        if any(str(c).strip() for c in r)
    ]


def _rows_to_text_and_heuristic(rows: list[list]) -> tuple[str, list[dict], Optional[int], Optional[dict]]:
    """Turn a matrix of cells into (a text blob for the model, heuristic SKU rows, row count,
    colmap — the §17.56 column-confirmation payload, None when no header was recognised).

    Heuristic parse: find the header row, map likely columns (código/nombre/familia/unidad/
    precio) by name, and pull rows deterministically so onboarding still gets rows if the model
    call fails. This is best-effort — the model is the primary path.

    The COUNT is the honest one: non-empty lines minus the header, minus the banner and section
    lines a real ERP export is full of (a line with only ONE non-empty cell in a multi-column
    sheet is a title, not a product). Counting them would make the §5.10.2 count guard cry wolf on
    every well-formed file, and a guard that always fires is a guard nobody reads.

    THE COLMAP says what the heuristic decided, so a human can overrule it: which row was taken as
    the header, what it said, which column landed on which field (None = not found), and the first
    10 data rows verbatim so the confirm screen can show the assignment against real cells. It is
    only emitted when a header was FOUND — with no header there is no assignment to confirm, and a
    fabricated one would invite corrections against columns that were never used."""
    clean_rows = _clean_matrix(rows)
    if not clean_rows:
        return "", [], 0, None

    text = _clip_text("\n".join("\t".join(r) for r in clean_rows), _MAX_FILE_TEXT_CHARS)
    h_idx = _find_header(clean_rows)
    heuristic = _heuristic_rows(clean_rows, h_idx)
    colmap: Optional[dict] = None
    if h_idx is not None:
        header_cells = [str(c).strip() for c in clean_rows[h_idx]]
        lower = [h.lower() for h in header_cells]
        colmap = {
            "header_row": h_idx,
            "header": header_cells,
            "cols": {"code": _col(lower, _H_CODE), "name": _col(lower, _H_NAME),
                     "family": _col(lower, _H_FAMILY), "unit": _col(lower, _H_UNIT),
                     "price": _col(lower, _H_PRICE)},
            "sample": [list(r) for r in clean_rows[h_idx + 1:h_idx + 11]],
        }
    body = clean_rows[(h_idx + 1) if h_idx is not None else 0:]
    width = max((sum(1 for c in r if str(c).strip()) for r in clean_rows), default=1)
    data_rows = ([r for r in body if sum(1 for c in r if str(c).strip()) > 1]
                 if width > 1 else body)
    return text, heuristic, len(data_rows), colmap


# What a header cell is called in the Spanish ERP exports this trade actually uses.
_H_CODE = ("código", "codigo", "ref", "sku", "cod")
_H_NAME = ("nombre", "producto", "descrip", "artículo", "articulo", "concepto", "name", "item")
_H_FAMILY = ("familia", "categoría", "categoria", "grupo", "family")
_H_UNIT = ("unidad", "ud.", "ud", "formato", "medida", "unit", "envase")
_H_PRICE = ("precio", "pvp", "importe", "€", "eur", "price", "tarifa")


def _col(header: list[str], keys: tuple[str, ...]) -> Optional[int]:
    for i, h in enumerate(header):
        for k in keys:
            if k in h:
                return i
    return None


def _find_header(rows: list[list[str]]) -> Optional[int]:
    """WHERE the header row actually is. Not row 0 — a real ERP export opens with the company
    banner, its address and a «Vigente desde…» line, and only then names the columns.

    Assuming row 0 was a silent bug: on `cold_tenant_precios.csv` the "header" was
    «TARIFA DE PRECIOS - EMBUTIDOS…», no name column matched, and the deterministic fallback
    returned NOTHING — so on the exact messy file this product is built for, the model had no
    safety net at all. Scan the first 15 rows for one that names both a product column and either
    a price or a code column; that is a header and nothing else looks like it."""
    for i, r in enumerate(rows[:15]):
        header = [str(c).strip().lower() for c in r]
        if _col(header, _H_NAME) is None:
            continue
        if _col(header, _H_PRICE) is not None or _col(header, _H_CODE) is not None:
            return i
    return None


def _heuristic_rows(rows: list[list[str]], h_idx: Optional[int] = None) -> list[dict]:
    """Deterministic column-mapped parse. Returns [] if we can't confidently find a name column."""
    if not rows:
        return []
    if h_idx is None:
        h_idx = _find_header(rows)
    if h_idx is None:
        return []
    header = [str(c).strip().lower() for c in rows[h_idx]]

    def _find(*keys) -> Optional[int]:
        return _col(header, tuple(keys))

    i_code = _find(*_H_CODE)
    i_name = _find(*_H_NAME)
    i_family = _find(*_H_FAMILY)
    i_unit = _find(*_H_UNIT)
    i_price = _find(*_H_PRICE)

    # If there's no recognisable header, we can't safely column-map → let the model handle it.
    if i_name is None:
        return []

    out: list[dict] = []
    for r in rows[h_idx + 1:]:
        def _cell(idx: Optional[int]) -> str:
            if idx is None or idx >= len(r):
                return ""
            return str(r[idx]).strip()

        name = _cell(i_name)
        if not name:
            continue
        out.append(_clean_sku({
            "code": _cell(i_code),
            "name": name,
            "family": _cell(i_family),
            "unit": _cell(i_unit),
            "price": _parse_price(_cell(i_price)),
        }))
    return out


def _clean_sku(s: Any) -> dict:
    """Normalize one SKU dict to the frozen shape with safe defaults."""
    if not isinstance(s, dict):
        return {"code": "", "name": "", "family": "", "unit": "", "price": None}
    return {
        "code": _str(s.get("code")),
        "name": _str(s.get("name")),
        "family": _str(s.get("family")),
        "unit": _str(s.get("unit")),
        "price": _parse_price(s.get("price")),
    }


def _parse_price(v: Any) -> Optional[float]:
    """Coerce a price cell to a float, or None. Handles '3,50 €', '1.234,56', '4.20'."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        try:
            return float(v)
        except Exception:
            return None
    s = str(v).strip()
    if not s:
        return None
    # strip currency + spaces
    s = s.replace("€", "").replace("EUR", "").replace("eur", "").replace(" ", "").strip()
    if not s:
        return None
    # Normalize decimal/thousands separators. If both present, the LAST one is the decimal.
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


# ──────────────────────────── small utils ────────────────────────────

def _miles(n: int) -> str:
    """114000 → «114.000». es-ES groups with a dot, and a blanket `.replace(",", ".")` over a
    finished sentence turns «60.000 caracteres, el máximo» into «…caracteres. el máximo» — which is
    how a number formatter quietly becomes a punctuation bug in the one sentence a supplier reads
    when something has gone wrong."""
    return f"{int(n):,}".replace(",", ".")


def _ext(name: str) -> str:
    return os.path.splitext((name or "").strip())[1].lower()


def _str(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()


def _trim_cell(c: Any) -> str:
    s = str(c).strip()
    return s[:_MAX_CELL_CHARS] if len(s) > _MAX_CELL_CHARS else s


def _clip_text(text: str, limit: int = _MAX_FILE_TEXT_CHARS,
               warnings: Optional[list[dict]] = None) -> str:
    """Clip to `limit` — and SAY SO when it bites. A clip nobody is told about is a catalogue
    missing rows that nobody can name."""
    text = text or ""
    if len(text) <= limit:
        return text
    if warnings is not None:
        warnings.append({"code": "clipped", "detail":
                         f"El contenido es enorme ({_miles(len(text))} caracteres); he leído los "
                         f"primeros {_miles(limit)}. Divídelo y súbelo por partes."})
    return text[:limit]


def _chunks_for_model(text: str) -> tuple[str, list[str], int]:
    """Split the extracted text into model-sized BATCHES → (header line, batches, total lines).

    The header line is returned separately so `_extract_many_sync` can repeat it on every batch
    after the first: without it, batch 2 of a `;`-delimited export is a wall of anonymous columns
    and the model has to guess which one is the price. It is only treated as a header when it
    looks like one (`_find_header` over the first lines), so a batched PDF or a pasted list — which
    have no header — never gets a random product line stapled to the top of every batch."""
    text = text or ""
    lines = text.splitlines()
    if not lines:
        return "", [], 0
    header = ""
    start = 0
    h_idx = _find_header([ln.split("\t") for ln in lines[:15]])
    if h_idx is not None:
        header = lines[h_idx]
        start = h_idx + 1
    body = lines[start:]
    if not body:
        return "", [text], len(lines)
    batches = ["\n".join(body[i:i + _MODEL_ROW_CAP])
               for i in range(0, len(body), _MODEL_ROW_CAP)]
    if header:
        batches[0] = header + "\n" + batches[0]
    return header, batches, len(lines)


def _fail(error: str) -> dict:
    return {"ok": False, "skus": [], "count": 0, "error": error,
            "source_kind": "", "source_rows": None, "warnings": [], "model_rows": 0,
            "colmap": None, "truncated": False}


# ══ §17.56 · THE DETERMINISTIC REMAP — a human overrules the column guess, no second LLM pass ═════
# The colmap above is a GUESS said out loud; this is the correction it invites. When the operator
# reassigns «esa columna es el precio», the rows are RE-DERIVED from the raw matrix with the explicit
# assignment — pure column plumbing through the same `_parse_price`/`_clean_sku` every other row
# passes through. Running the model again instead would be asking it to re-guess the exact thing a
# human just stated, and could come back different a third way.

_COLMAP_FIELDS = ("code", "name", "family", "unit", "price")


def remap_rows(rows: list[list[str]], header_row: int, cols: dict) -> list[dict]:
    """Re-derive `{code,name,family,unit,price}` SKU dicts from a cleaned cell matrix and an
    EXPLICIT column assignment. Deterministic, pure, no LLM, never raises.

    `rows` is the `_clean_matrix` shape (the matrix the colmap's indices were minted against),
    `header_row` the confirmed header index, `cols` a {field: column-index|None} map. A row with an
    empty name cell yields nothing — same rule as `_heuristic_rows`, because a nameless product is
    not a product. Returns [] when no name column is assigned: without one there is nothing honest
    to build, and the caller refuses rather than guessing."""
    idx: dict[str, Optional[int]] = {}
    for f in _COLMAP_FIELDS:
        v = (cols or {}).get(f)
        try:
            idx[f] = int(v) if v is not None and int(v) >= 0 else None
        except (TypeError, ValueError):
            idx[f] = None
    if idx["name"] is None:
        return []
    try:
        start = max(0, int(header_row) + 1)
    except (TypeError, ValueError):
        return []

    out: list[dict] = []
    for r in rows[start:]:
        def _cell(i: Optional[int]) -> str:
            if i is None or i >= len(r):
                return ""
            return str(r[i]).strip()

        name = _cell(idx["name"])
        if not name:
            continue
        out.append(_clean_sku({
            "code": _cell(idx["code"]),
            "name": name,
            "family": _cell(idx["family"]),
            "unit": _cell(idx["unit"]),
            "price": _parse_price(_cell(idx["price"])),
        }))
    return out


def extract_rows(data: bytes, filename: str) -> Optional[list[list[str]]]:
    """The cleaned cell matrix a TABULAR source parses against — re-derived from the stored bytes,
    for the remap path. None when the source has no columns (PDF, photo, a typed list): there is
    nothing to remap there and the caller says so in Spanish rather than shredding prose into cells.

    Goes through the SAME readers and the SAME `_clean_matrix` as the original parse, so the row
    indices the stored colmap carries land on the same cells they were minted against."""
    ext = _ext(filename)
    try:
        if ext == ".csv":
            rows = _read_delimited(_decode_text(data))
            return _clean_matrix(rows) if rows is not None else None
        if ext in (".xlsx", ".xls"):
            m = _excel_matrix(data)
            return _clean_matrix(m) if m else None
        # a paste or an extensionless file: tabular only if the content says so — the same
        # `_looks_tabular` decision the original parse took, for the same reason. The clip mirrors
        # `_from_loose_text` exactly, or a giant file's indices would drift against its colmap.
        text = _clip_text(_decode_text(data), _MAX_FILE_TEXT_CHARS)
        if _looks_tabular(text):
            rows = _read_delimited(text)
            return _clean_matrix(rows) if rows is not None else None
        return None
    except Exception:
        log.exception("skuparse: extract_rows failed for %s (fail-soft None)", filename)
        return None


# ══ §5.8b · THE OTHER SOURCE OF A SKU ROW: A THING, NOT A FILE (2026-07-27) ═══════════════════════
# This module's whole subject is "a NAME that has to become a catalogue row", and until today it only
# knew one source for that name: a spreadsheet, a PDF, a photograph of a price list. The inventory
# tool produces the same thing from a different place — a photographed pallet and a spoken note — and
# it must land in the SAME shape, because the shape is what `brain/golive` and `brain/catalogue` both
# consume. Two shapes would mean two definitions of what a product is.
#
# So the row a stock capture proposes is normalised HERE, through the same `_clean_sku`/`_parse_price`
# the file parser uses, and not in the route. A price typed «3,50 €» on a phone at six in the morning
# is parsed by the identical function that parses it out of an Excel cell.

def sku_from_line(line: Any, *, name: str = "", code: str = "", family: str = "",
                  unit: str = "", price: Any = None) -> dict:
    """An UNMATCHED stock-capture line (+ whatever the operator answered) → the canonical
    `{code,name,family,unit,price}` row this module already speaks.

    The line supplies what was actually read — the words heard and the unit they were said in — and
    the operator's answers OVERRIDE it field by field, because he is standing in front of the product
    and the reading is not. Pure: no DB, no model, never raises. `name` empty in the result means
    there is nothing to create, and the caller must refuse rather than invent one.
    """
    ln = line if isinstance(line, dict) else {}
    return _clean_sku({
        "code": code or ln.get("code") or "",
        # `name` first, then what the read HEARD — never the matcher's idea of what it might be. The
        # whole reason this line is unmatched is that that idea was rejected.
        "name": name or ln.get("heard") or ln.get("name") or ln.get("item") or "",
        "family": family or ln.get("family") or "",
        "unit": unit or ln.get("unit") or "",
        "price": price if price is not None else ln.get("price"),
    })
