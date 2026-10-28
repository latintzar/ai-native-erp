"""THE KIT RUNTIME — the calls the browser must not make (FEED-IA §196.5 · §196.6 · §196.9).

Peter, 2026-09-04: «maybe we need an api» · «that shit proved capability now we're doing it all for
real, every part of the process, nothing half assed» · «i don't want dependencies on the actual
hermes caller as that's a packed thing, i want it all self contained in here, same as twilio.»

The kit at kit.soyrocoto.com is a STATIC page. Five of the things it must do need a secret —
Parsewise extraction, Google Places identity, Deepgram transcription, Twilio, and the Copilot's own
mind (§196.2 · E198) — and a static page cannot hold one. This service holds them, on the box, behind the kit's own origin at `/api`, and it
implements exactly the contract the kit already reads: app/src/prototypes/cedar/runtime-client.ts. Nothing
here invents an endpoint the kit does not name, and nothing here answers with a shape the kit does
not type.

⚠ THE ONE LAW ABOVE ALL: **this service never fabricates a result.** A missing key is `missing` in
health and a 503 with a name on the endpoint. A provider that fails says so. There is no cached
answer, no plausible default, no «we'll try later» — because the kit's honest posture («Runtime ·
not reachable», «Extraction unavailable») is a better product than a made-up row (§PAR-05).
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import (
    artwork,
    cedar_access,
    cedar_documents,
    cedar_email,
    cedar_order_intake,
    cedar_whatsapp,
    copilot,
    deepgram,
    errors,
    logging_setup,
    paper,
    parsewise,
    phone_runtime,
    places,
    store,
    twilio_voice,
)
from .cedar_request_limits import CedarDocumentRequestLimit
from .config import ALLOWED_ORIGIN_PATTERN, VERSION, ensure_state_dirs, settings
from .errors import RuntimeError_

logging_setup.configure()
logger = logging.getLogger("rocoto.runtime")


def _code_digest() -> str:
    """Identify this process's Python modules through /api/health.

    CI compares this startup digest with the modules in its published payload, so a process that
    kept running older code fails deployment verification. The digest covers app/*.py contents;
    dependency versions and provider readiness have separate checks.
    """
    import hashlib
    import pathlib

    here = pathlib.Path(__file__).resolve().parent
    digest = hashlib.sha256()
    for path in sorted(here.glob("*.py")):
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


CODE = _code_digest()

async def _document_maintenance() -> None:
    while True:
        try:
            if (settings.state_dir / 'cedar-documents.sqlite').exists():
                await asyncio.to_thread(cedar_documents.purge_expired)
        except Exception:
            logger.exception("Cedar document retention check needs retry")
        await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_state_dirs()
    logger.info("runtime up", extra={"outcome": "|".join(f"{k}:{v}" for k, v in settings.providers.items())})
    await phone_runtime.start()
    await cedar_email.start()
    documents = asyncio.create_task(_document_maintenance())
    try:
        yield
    finally:
        documents.cancel()
        await asyncio.gather(documents, return_exceptions=True)
        await cedar_email.stop()
        await phone_runtime.stop()


app = FastAPI(title="Rocoto kit runtime", version=VERSION, lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
errors.install(app)
app.add_middleware(CedarDocumentRequestLimit)
app.include_router(cedar_access.router)
app.include_router(cedar_email.router)
app.include_router(cedar_order_intake.router)
app.include_router(cedar_documents.router)
app.include_router(phone_runtime.router)
app.include_router(cedar_whatsapp.router)
# The separately released Peru app retains its own Bodega routers and lifecycle.

# CORS is an ALLOW-LIST and the list is two entries long: the kit's own origin, and a developer's
# loopback (runtime-client.ts lets a local build pin `rocoto-runtime-base` at 127.0.0.1:8790). A
# wildcard here would let any page on the internet spend this box's four keys.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=ALLOWED_ORIGIN_PATTERN.pattern,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Authorization"],
    max_age=600,
)


@app.middleware("http")
async def observe(request: Request, call_next):
    """One structured line per request: what, how long, what came of it. No bodies, no secrets."""
    started = time.time()
    request_id = uuid.uuid4().hex[:12]
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request failed", extra={"request_id": request_id, "route": request.url.path})
        raise
    response.headers["X-Request-Id"] = request_id
    logger.info("%s %s", request.method, request.url.path, extra={
        "request_id": request_id, "route": request.url.path,
        "status": response.status_code, "ms": int((time.time() - started) * 1000),
    })
    return response


async def _read(upload: UploadFile, field: str) -> bytes:
    content = await upload.read()
    if not content:
        raise RuntimeError_("empty_upload", f"The {field} was empty.", 400)
    if len(content) > settings.max_upload_bytes:
        raise RuntimeError_("too_large", f"That {field} is larger than this runtime accepts.", 413)
    return content


# ── GET /api/health ─────────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> JSONResponse:
    """`RuntimeHealth` — providers `configured` or `missing` BY ENV PRESENCE (the contract's word).

    Presence is not reachability, and this endpoint does not pretend otherwise: it makes no provider
    call, so it stays instant and free, and each endpoint reports what actually happened when it
    ran. THE-RUNTIME-SPEC §RUN-03 states the distinction, and `/api/health?deep=twilio` is the one
    place an account can be asked about itself.

    `handwriting` is ADDITIVE and sits beside `providers` rather than inside it (PAR-10.5): the kit
    types `providers` as exactly four names, so a fifth entry there would be drift. It states which
    reader this process would use — `gemini` or `anthropic` — and whether that reader's key arrived.
    """
    return JSONResponse({"ok": True, "version": VERSION, "code": CODE, "providers": settings.providers,
                         "handwriting": settings.handwriting})


@app.get("/api/health/twilio")
async def health_twilio() -> JSONResponse:
    """The Twilio ACCOUNT's own answer — because a key in the env is not an account that works."""
    return JSONResponse({"twilio": await twilio_voice.account_state()})


# ── POST /api/parse ─────────────────────────────────────────────────────────────────────────
@app.post("/api/parse")
async def parse(file: UploadFile = File(...), kind: str = Form("albaran")) -> JSONResponse:
    """§196.5 — a table becomes rows, through Parsewise, configured for the format (THE-PARSING-SPEC).

    The wait is REAL: a one-page albarán measured about two and a half minutes end to end, and the
    kit's `reading` state is sized for it. Holding the request open is the honest shape — the client
    has one call and one answer, and a poll token would only move the wait somewhere else.
    """
    content = await _read(file, "file")
    result = await parsewise.parse_document(content, file.filename or "source",
                                            file.content_type or "application/octet-stream", kind)
    return JSONResponse(result)


# ── GET /api/identity ───────────────────────────────────────────────────────────────────────
@app.get("/api/identity")
async def identity(number: str = Query(..., min_length=3)) -> JSONResponse:
    """§196.6 — «the number->gmaps info was working flawlessly». Ported, phone-match gate and all."""
    return JSONResponse(await places.identity(number))


_ADDRESS_SPENT: deque[tuple[float, str]] = deque()


@app.post("/api/address-suggestions")
async def address_suggestions(
    request: Request, query: str = Body(..., min_length=3, max_length=200),
    sessionToken: str = Body(..., pattern=r"^[A-Za-z0-9_-]{1,36}$"),
    country: str = Body("PE", pattern=r"^(PE|ES)$"),
) -> JSONResponse:
    """Address search uses this runtime's origin policy and a bounded provider-call budget.
    The country is the workspace's Peru/Spain selection (§247.1)."""
    origin = request.headers.get("origin", "")
    own_origin = settings.public_base.rstrip("/")
    if not origin or not (ALLOWED_ORIGIN_PATTERN.fullmatch(origin) or (own_origin and origin == own_origin)):
        raise RuntimeError_("address_origin_required", "Open address search from this Rocoto workspace.", 403)
    current = time.monotonic()
    while _ADDRESS_SPENT and current - _ADDRESS_SPENT[0][0] >= 60:
        _ADDRESS_SPENT.popleft()
    caller = request.client.host if request.client else "unknown"
    if len(_ADDRESS_SPENT) >= 300 or sum(peer == caller for _, peer in _ADDRESS_SPENT) >= 30:
        raise RuntimeError_("address_search_limit", "Try the address search again in a minute.", 429)
    _ADDRESS_SPENT.append((current, caller))
    result = await places.address_suggestions(query, sessionToken, country)
    return JSONResponse(result, headers={"Cache-Control": "no-store"})


# ── POST /api/transcribe ────────────────────────────────────────────────────────────────────
@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = Form("es")) -> JSONResponse:
    """§196.6 · §196.7 — Deepgram nova-3, Spanish, diarised. The composer's mic ends here."""
    content = await _read(audio, "audio")
    suffix = "." + (audio.filename or "audio.webm").rsplit(".", 1)[-1] if "." in (audio.filename or "") else ""
    wav, content_type = deepgram.to_wav(content, suffix)
    result = await deepgram.transcribe(wav, language=language or "es", content_type=content_type)
    return JSONResponse(result)


# ── POST /api/artwork ───────────────────────────────────────────────────────────────────────
@app.post("/api/artwork")
async def make_artwork(request: Request, body: dict = Body(...)) -> JSONResponse:
    """§200.2 — «every product carries artwork, and the house makes it», through Ideogram.

    The road is THE-PRODUCT-SHEET-SPEC «Artwork» and `artwork.py` implements it literally: describe a
    family reference, take that description verbatim, swap ONE substring for the new subject,
    generate at the family's own square. Two shapes, because the method has two steps:

        {"reference": "gamba-roja", "describe_only": true}
            → {description, reference}                       — read it, then name the words to swap

        {"name": "…", "reference": "gamba-roja", "replace": "…", "subject": "…"}
            → {description, prompt, image{data,url}, provider{…}, file{…}}

    `description` may be passed back in to skip a second describe of the same reference — the same
    words, so the prompt is identical either way.

    THE DOOR COMES FIRST. Alone among these endpoints this one spends generation credit per call, so
    it reads the house secret off `X-Rocoto-Artwork-Key` before it reads the body — and a rolling
    hourly ceiling inside `artwork.py` bounds what any caller past that door can spend
    (THE-RUNTIME-SPEC RUN-12). The header is left OUT of the CORS allow-list above on purpose: a
    browser cannot send one, and the house's own tooling has no need of a browser.
    """
    artwork.authorize(request.headers.get(artwork.HOUSE_HEADER, ""))
    data = body or {}
    return JSONResponse(await artwork.paint(
        name=str(data.get("name") or ""),
        reference=str(data.get("reference") or ""),
        reference_url=str(data.get("reference_url") or ""),
        description=str(data.get("description") or ""),
        replace=str(data.get("replace") or ""),
        subject=str(data.get("subject") or ""),
        describe_only=bool(data.get("describe_only")),
    ))


# ── POST /api/copilot ───────────────────────────────────────────────────────────────────────
@app.post("/api/copilot")
async def copilot_ask(body: dict = Body(...)) -> JSONResponse:
    """§196.2 — the Copilot's MIND. The kit sends the session, the desk's own context and the ask.

    What comes back is the contract `runtime-client.ts` types: a reply, the proposals the kit's
    existing cards already render, and the evidence — which model answered, how long it took, what
    it cost. The journal carries the same three facts and never a word of what was said.
    """
    return JSONResponse(await copilot.ask(body or {}))


# ── /api/calls ──────────────────────────────────────────────────────────────────────────────
@app.get("/api/calls")
async def calls(number: str = Query(..., min_length=3)) -> JSONResponse:
    """The calls this runtime has custody of, for one counterpart. Empty is an answer."""
    return JSONResponse(store.by_number(number))


@app.post("/api/calls")
async def dial(body: dict = Body(...)) -> JSONResponse:
    """§196.6 — place the call. Refuses, by name, on any fact it does not have."""
    to = str((body or {}).get("to") or "").strip()
    if not to:
        raise RuntimeError_("bad_request", "A call needs a `to` number.", 400)
    return JSONResponse(await twilio_voice.place_call(to))


app.include_router(twilio_voice.router)
# OUR OWN PAPER (PAR-10) — the manifest a packing sheet records at print time, and the photograph
# read back against it. Its own module because it is its own idea: geometry, not extraction.
app.include_router(paper.router)
