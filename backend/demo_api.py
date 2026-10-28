"""Maintained product demo/account sandbox HTTP routes.

The historical /api/demo namespace owns authenticated test accounts and narrow phone handoffs.
Development prototypes use mock-api; these existing endpoints deploy with the maintained backend.
Business logic stays in demo_flow, demo_media, demo_phone and the intake services.
"""

from __future__ import annotations

import asyncio
import logging
import secrets

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

import config
import db as supa
import demo_auth
import demo_call
import demo_flow
from brain import onboarding as brain_onboarding
from brain import onboarding_ext as brain_ob_ext
from cr_auth import _client_ip
from http_serialization import json_safe as _jsonsafe

log = logging.getLogger("rocoto.demo_api")
router = APIRouter(prefix="/api/demo")


# ──────────────────────────── Landing "See it live" demo call ────────────────────────────
# Public, unauthenticated, feature-flagged (DEMO_CALL_ENABLED). Places a real Twilio call to a
# visitor and streams the live transcript to their browser. All logic lives in demo_call.py.
def _demo_guard() -> None:
    if not demo_call.configured():
        raise HTTPException(503, "demo unavailable")


@router.post("/call")
async def demo_api_call(payload: dict, request: Request) -> JSONResponse:
    _demo_guard()
    try:
        return JSONResponse(await demo_call.request_call(payload, request))
    except ValueError as e:
        code, msg = demo_call.http_status_for(str(e))
        if code == 200:
            return JSONResponse({"ok": True})  # honeypot → fake success
        raise HTTPException(code, msg) from None


@router.get("/stream/{token}")
async def demo_api_stream(token: str, request: Request) -> StreamingResponse:
    _demo_guard()
    try:
        last = int(request.headers.get("last-event-id", "0") or "0")
    except ValueError:
        last = 0
    return StreamingResponse(
        demo_call.sse(token, last),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/hangup/{token}")
async def demo_api_hangup(token: str) -> JSONResponse:
    _demo_guard()
    return JSONResponse(await demo_call.hangup(token))


@router.get("/result/{token}")
async def demo_api_result(token: str) -> JSONResponse:
    _demo_guard()
    return JSONResponse(await demo_call.result(token))


@router.post("/whatsapp")
async def demo_api_whatsapp(payload: dict, request: Request) -> JSONResponse:
    if not demo_call.wa_configured():
        raise HTTPException(503, "demo unavailable")
    try:
        return JSONResponse(await demo_call.request_whatsapp(payload, request))
    except ValueError as e:
        code, msg = demo_call.http_status_for(str(e))
        if code == 200:
            return JSONResponse({"ok": True})
        raise HTTPException(code, msg) from None


# ──────────────────────── /demo — «Prueba Rocoto con tus productos» (§17.56) ────────────────────
# Authenticated test-account sessions. Logic lives in demo_flow.py (sessions, isolation, the 5
# persona knobs, the board, the seeds) and brain/onboarding (the catalogue intake) — these routes
# are HTTP shapes only, per this file's convention. The /api/demo/* prefix is shared with the
# demo-CALL family above by design (§17.56: it owns call/stream/hangup/result/whatsapp, this
# family owns session/…); the panel's Vercel rewrite proxies both.
_DEMO_404 = "Esta sesión ya no vale. Empieza la prueba otra vez."


def _demo_gate() -> None:
    if not config.DEMO_FLOW_ENABLED:
        raise HTTPException(503, "La prueba no está disponible ahora mismo.")


_DEMO_401 = "Inicia sesión para seguir con tu prueba."
_DEMO_403 = "Tu cuenta no tiene permiso para esto. Pídeselo a quien lleva la cuenta."
_DEMO_LIVE = (
    "Tu empresa ya está en marcha en Rocoto. La prueba solo trabaja sobre un espacio en "
    "pruebas — para tu cuenta de verdad, entra en el panel."
)

# The catalogue parse is the expensive act on this surface: up to 25 MB read off disk, an openpyxl
# walk, and up to 20 Sonnet calls at 8192 max_tokens. Three buckets, cheapest first (2026-08-09
# review, F5) — an absolute ceiling that no amount of new sessions or new IPs can argue around,
# then the tenant, then the address. Env-overridable so a demo day does not need a deploy.
_DEMO_INTAKE_GLOBAL = int(config._env("ROCOTO_DEMO_INTAKE_GLOBAL", "60") or "60")
_DEMO_INTAKE_PER_TENANT = int(config._env("ROCOTO_DEMO_INTAKE_PER_TENANT", "8") or "8")
_DEMO_INTAKE_PER_IP = int(config._env("ROCOTO_DEMO_INTAKE_PER_IP", "20") or "20")
# A PASTED LINK COSTS EVERYTHING AN UPLOAD COSTS, PLUS OUR OWN BANDWIDTH AND A SOCKET, and unlike an
# upload it is a request this box makes on a stranger's say-so. So it is metered on top of the
# buckets above and more tightly: three fetches an hour is «I mistyped it twice», and thirty is
# somebody using our server as a scanner. The refusal is a sentence, so a real prospect who hits it
# knows to upload the file instead.
_DEMO_URL_GLOBAL = int(config._env("ROCOTO_DEMO_URL_GLOBAL", "30") or "30")
_DEMO_URL_PER_TENANT = int(config._env("ROCOTO_DEMO_URL_PER_TENANT", "6") or "6")
_DEMO_URL_PER_IP = int(config._env("ROCOTO_DEMO_URL_PER_IP", "12") or "12")
# The polling reads (`/board`, `/seeds`). Per MINUTE, sized so a person cannot reach them and a
# script does: the four-quadrant screen refreshes the board on a chat reply and on a live-channel
# poke, which is single digits a minute even for someone typing fast.
_DEMO_POLL_PER_SESSION = int(config._env("ROCOTO_DEMO_POLL_PER_SESSION", "60") or "60")
_DEMO_POLL_PER_IP = int(config._env("ROCOTO_DEMO_POLL_PER_IP", "240") or "240")

# ── THE EXPENSIVE READS (2026-08-09, BUG 3) ──────────────────────────────────────────────────────
# `/board` and `/seeds` were metered and the rest of the family was not, which left FIVE routes
# unlimited on the SINGLE uvicorn worker that also serves paying customers' WhatsApp webhooks and
# Twilio callbacks. Not a data leak — every one of them is behind the full cookie/cap/row chain —
# but an authed operator, or a browser `<img>` stuck in a retry loop, can starve production:
#   /order-card  hundreds of ms of Pillow rasterisation per hit (now also cached, demo_flow)
#   /media       a state doc a live screen polls
#   /phone       the same, for the handoff pane
#   /qr          an SVG render; with `?rotate=1` also an HMAC mint AND a database write
#   /stream      an SSE connection held open — cheap per request, expensive per CONNECTION
# The numbers are what a human cannot reach and a loop can: a person opens a QR a handful of times
# in a demo and re-renders a card a few dozen. `?rotate=1` gets its own, tighter bucket because it
# is the only GET in the family that writes.
#
# HOW IT WAS MISSED, which is the part worth remembering: «the expensive routes are metered» was
# written as a COMMENT on `_demo_poll_ok` while the metering was applied BY HAND, route by route.
# Five routes were added afterwards and nobody re-read the comment. That is the same shape as the
# other two findings from the same review (a slug pattern deciding which tenants are demo tenants;
# a kwarg default deciding which events are test events) — a rule kept somewhere it can drift from
# what it describes, failing by absence with nothing raised. The full note is in `demo_flow.py`
# above `reap()`. Here the mitigation is a gate rather than a refactor: tests/vital_demo_doors.py ⑦
# drives these routes THROUGH THE APP and asserts each one walls, so a route that loses its bucket
# turns the regression red instead of turning up in an audit.
_DEMO_CARD_PER_SESSION = int(config._env("ROCOTO_DEMO_CARD_PER_SESSION", "40") or "40")
_DEMO_CARD_PER_IP = int(config._env("ROCOTO_DEMO_CARD_PER_IP", "160") or "160")
_DEMO_QR_PER_SESSION = int(config._env("ROCOTO_DEMO_QR_PER_SESSION", "20") or "20")
_DEMO_QR_PER_IP = int(config._env("ROCOTO_DEMO_QR_PER_IP", "80") or "80")
_DEMO_QR_ROTATE_PER_SESSION = int(config._env("ROCOTO_DEMO_QR_ROTATE_PER_SESSION", "6") or "6")
_DEMO_QR_ROTATE_PER_IP = int(config._env("ROCOTO_DEMO_QR_ROTATE_PER_IP", "24") or "24")
_DEMO_STREAM_PER_SESSION = int(config._env("ROCOTO_DEMO_STREAM_PER_SESSION", "20") or "20")
_DEMO_STREAM_PER_IP = int(config._env("ROCOTO_DEMO_STREAM_PER_IP", "80") or "80")

_DEMO_TOO_FAST = "Vas muy rápido — espera unos segundos y sigue."


def _demo_rate_ok(row: dict, request: Request, what: str, per_session: int, per_ip: int) -> None:
    """THE one ceiling helper for this family. `sup_session.rate_ok` is the sliding window the demo
    already meters its polls, its intakes and its media with — same window, same 60 s period, same
    es-ES sentence, so a visitor who trips any of them reads one message and not five.

    Keyed on the SESSION first (the unspoofable half, now that a session cannot be minted without a
    verified identity) and on the IP second (coarse: SPA traffic arrives through a shared Vercel
    edge — see sup_api._client_ip). Both are checked; either one refuses."""
    import sup_session as _ss

    if not _ss.rate_ok(f"demopoll:{what}:{row['sid']}", per_session, 60) or not _ss.rate_ok(
        f"demopoll:{what}:ip:{_client_ip(request)}", per_ip, 60
    ):
        raise HTTPException(429, _DEMO_TOO_FAST)


def _demo_poll_ok(row: dict, request: Request, what: str) -> None:
    """A ceiling on the POLLING reads (punch list P0#4). Generous — a human clicking about must
    never meet it — and keyed on the session first, because that is the unspoofable half now that
    a session cannot be minted for free. The per-IP bucket is the coarse companion (it is a Vercel
    edge for SPA traffic; see sup_api._client_ip)."""
    _demo_rate_ok(row, request, what, _DEMO_POLL_PER_SESSION, _DEMO_POLL_PER_IP)


async def _demo_audit(row: dict, action: str, *, target: str = "", detail: dict | None = None) -> None:
    """Leave a trail for the writes this family makes (2026-08-09 review, F4d).

    The panel audits its catalogue and behaviour writes; /demo made the SAME writes, against the
    SAME tables, and left nothing. Fail-soft on purpose, and that is a deliberate departure from
    `sup_session.audit`'s own «a lost audit on a money/state action is not acceptable — surface it»:
    everything here happens on a `status='test'` tenant by construction, so a lost line is a lost
    line, not a lost euro, and it must not be able to break a prospect's demo."""
    try:
        import sup_session as _ss

        await _ss.audit(
            row.get("_actor") or row.get("operator_email") or "",
            demo_flow.tenant_of_row(row),
            row.get("_ip") or "",
            action,
            target_id=target or None,
            detail=detail or {},
        )
    except Exception:
        log.warning("demo audit failed (fail-soft) action=%s", action, exc_info=True)


async def _demo_cookie(request: Request, cap: str) -> dict:
    """THE PANEL'S OWN SESSION, AND THE CAPABILITY IT CARRIES — before anything else happens.

    §17.56c said «identity comes from the operator, not from a token in the browser» and then left
    an anonymous branch that returned immediately, so for half the surface the token in the URL WAS
    the credential. Peter's 2026-08-09 instruction removes the other half of the sentence: «should
    be authed the whole thing yes». There is no anonymous stretch left to serve, so this runs FIRST
    and unconditionally — before the token is even resolved, so an unauthenticated prober cannot
    make this box touch the database on their behalf.

    THE CAPABILITY CHECK IS THE OTHER HALF, and it is what the review's F4 was about. This family
    checked WHO you are and never WHAT YOU MAY DO, while the panel's equivalents all do
    (`POST /api/sup/behaviour` needs `admin:rocoto`; the intake door refuses anyone but the founder).
    A `repartidor` at a live tenant — cap set `{'deliver'}` — could therefore retire that company's
    entire assortment through `/demo` and set `confirm:never` on its production agent. Every route
    below now names the cap it needs, and `sup_session.can` answers with the same table the panel
    uses. Nothing is granted here that the panel does not already grant."""
    import sup_api as _sa
    import sup_session as _ss

    ctx = await _ss.verify(request.cookies.get(_sa.SUP_COOKIE), rotate=False)
    if not ctx:
        # A clean 401 the SPA acts on (it re-runs the sign-in), never an HTML redirect it would have
        # to sniff. Same sentence whoever you are: «wrong operator» and «no session» are one answer.
        raise HTTPException(401, _DEMO_401)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not _ss.check_csrf(
        ctx, request.headers.get("x-sup-csrf")
    ):
        raise HTTPException(403, "Sesión caducada — recarga la página.")
    if not _ss.can(ctx.get("role") or "", cap):
        raise HTTPException(403, _DEMO_403)
    ctx["ip"] = _client_ip(request)  # `require_sup` does the same; the audit rows read it
    return ctx


async def _demo_test_world(row: dict) -> str:
    """THE TEST-TENANT FENCE (2026-08-09 review, F4b). /demo is BY DEFINITION the test rung — its
    whole promise is «nothing you do here reaches a customer». Nothing in this family checked that,
    so an operator of a LIVE paying workspace who wandered in «to try it» was driving production:
    `commit` runs `golive.seed_catalogue`, which retires every SKU absent from the file it was just
    handed, and `persona` writes `tenants.behaviour` + the house-style row with the runtime's style
    cache dropped, so it applies to the next real WhatsApp message.

    Fail-closed on a missing tenant row: «I cannot tell what world this is» must refuse, not pass."""
    slug = demo_flow.tenant_of_row(row)
    async with supa.get_pool().acquire() as con:
        status = await con.fetchval("select status from tenants where slug = $1", slug)
    if (status or "") != "test":
        raise HTTPException(409, _DEMO_LIVE)
    return slug


async def _demo_session(token: str, request: Request, cap: str = "read") -> dict:
    """The ONE gate every /demo session route passes: cookie → capability → CSRF → the row → the
    row belongs to THIS operator and THIS tenant → the tenant is in test mode.

    The token is a HANDLE, never a credential: it names WHICH of the caller's sessions, and the
    cookie says whose. Holding somebody else's token gets you the same 404 as holding a made-up one
    (portal.py's law — the sentence must not distinguish, or a probe learns which tokens existed).
    A LEGACY anonymous row (no operator_email) is refused here too: it can no longer be minted, and
    the ones still in the database are the reaper's, not a caller's."""
    ctx = await _demo_cookie(request, cap)
    row = await demo_flow.resolve(token)
    if row is None or not demo_flow.is_authed(row):
        raise HTTPException(404, _DEMO_404)
    if (ctx.get("actor_email") or "").strip().lower() != (
        row.get("operator_email") or ""
    ).strip().lower() or (ctx.get("tenant_slug") or "") != (row.get("tenant_slug") or ""):
        raise HTTPException(401, _DEMO_401)
    await _demo_test_world(row)
    # ONLY what the audit line needs. The whole ctx carries the session's CSRF token, and this row
    # is handed on to demo_media / demo_phone / demo_flow — a live credential riding into three
    # other organs is how one of them eventually logs or echoes it.
    row["_actor"] = ctx.get("actor_email") or ""
    row["_ip"] = ctx.get("ip") or ""
    await demo_flow.maybe_reap()  # housekeeping on the path that creates the work (F8)
    return row


def _demo_intake_of(row: dict, intake_id: str) -> str:
    """REACH LAW (intake_api's, verbatim in spirit): a session sees the intake IT uploaded, never
    more. The tenant fence alone would be right by construction here (one tenant per session) —
    this check is the belt to that suspender, and it keeps the two doors' laws identical."""
    if not intake_id or intake_id != (row.get("intake_id") or ""):
        raise HTTPException(404, _DEMO_404)
    return demo_flow.tenant_of_row(row)


# `POST /api/demo/session` (the anonymous mint) and `POST /api/demo/session/{token}/email` (the
# resume mail) WERE DELETED ON 2026-08-09. See demo_flow.py's note where `create_session` used to
# be: between them they let an unauthenticated stranger mint a permanent tenant and mail a WORKING
# bearer token for a session they kept to any address they named. There is no replacement and no
# flag — the demo begins at `POST /api/demo/auth/magic` or `/api/demo/auth/google`, and a session
# row now exists only behind a verified identity.


@router.get("/session/{token}")
async def demo_session_get(token: str, request: Request) -> JSONResponse:
    _demo_gate()
    await _demo_session(token, request, "read")  # 404 / ownership, before anything is echoed back
    out = await demo_flow.session_view(token)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(out)


@router.post("/session/{token}/catalog")
async def demo_catalog_upload(token: str, request: Request) -> JSONResponse:
    """The visitor's catalogue, in — multipart `file`, JSON `{text, name?}`, or JSON `{url}`. The
    first two are byte-for-byte the shapes every other intake door accepts; the THIRD is this
    door's own, because a Spanish distributor's tarifa is usually already a PDF on his own website
    and pasting that address is one gesture where «export it, find it, upload it» is five.

    THE URL IS FETCHED HERE AND BECOMES A FILE. `urlfetch.fetch` returns bytes plus a filename, and
    those go into the SAME `create_intake` the other two shapes use — one road into
    `catalogue_skus`, exactly as §17.20 requires. An HTML page comes back as text and enters as a
    paste. There is no third parser and no second writer.

    ⚠️ THE FETCH IS AWAITED INSIDE THE REQUEST, unlike the parse. That is deliberate: we need the
    bytes before an intake row can exist, and a fetch that fails must answer the visitor with a
    sentence he can act on rather than stranding a `failed` intake he has to go and discover. It is
    bounded on every axis — `urlfetch`'s own 25 s clock, its 20 MB cap, and a 2-at-a-time semaphore
    — and it is `async` throughout, so it holds a socket rather than the event loop. Every SSRF
    guard lives in `urlfetch`, next to the reasoning for it.

    Lands on brain/onboarding.create_intake for THIS session's tenant; the parse runs in the
    background (a real Excel takes tens of seconds and the browser must not hold a socket open for
    it — create_intake's own law).

    `admin:rocoto` — the catalogue is the EMPLOYEE's own settings, so this asks for the same cap
    `POST /api/sup/behaviour` and the panel's catalogue writes ask for. A driver cannot reach it
    (2026-08-09 review, F4).

    THE VOLUME GUARDS (F5, F11) run BEFORE a byte is read. A 25 MB xlsx is a zip that expands
    ~1000:1, the parse is CPU-bound, and prod is a SINGLE uvicorn worker also serving paying
    customers' WhatsApp webhooks and Twilio callbacks — so an unbounded upload rate on this door is
    a paying-customer outage, not a demo outage."""
    _demo_gate()
    row = await _demo_session(token, request, "admin:rocoto")
    tenant = demo_flow.tenant_of_row(row)
    import sup_session as _ss

    _ip = _client_ip(request)
    if (
        not _ss.rate_ok("demointake:GLOBAL", _DEMO_INTAKE_GLOBAL, 3600)
        or not _ss.rate_ok(f"demointake:t:{tenant}", _DEMO_INTAKE_PER_TENANT, 3600)
        or not _ss.rate_ok(f"demointake:ip:{_ip}", _DEMO_INTAKE_PER_IP, 3600)
    ):
        raise HTTPException(429, "Has subido muchas listas seguidas. Espera un rato y sigue.")
    if not demo_flow.spend_ok("llm"):
        raise HTTPException(429, demo_flow._SPEND_FULL)
    # THE SIZE IS REFUSED BEFORE THE BYTES ARE READ (intake_api's law: this door is reachable by
    # whoever holds a token, and pulling 500 MB through the box to say "too big" is the attack).
    import intake_api as _ia

    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > _ia.LINK_MAX_UPLOAD_BYTES:
        raise HTTPException(
            413, "Eso es demasiado grande. Sube la lista de artículos, no el catálogo entero en fotos."
        )
    text = None
    raw = None
    link = ""
    ctype = (request.headers.get("content-type") or "").lower()
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        up = form.get("file")
        if up is None or not hasattr(up, "read"):
            raise HTTPException(400, "Falta el archivo.")
        try:
            raw = await up.read()
        except Exception:
            raise HTTPException(400, "No he podido leer el archivo.") from None
        if not raw:
            raise HTTPException(400, "El archivo está vacío.")
        if len(raw) > _ia.LINK_MAX_UPLOAD_BYTES:
            raise HTTPException(
                413,
                "Ese archivo es demasiado grande. Sube la lista de "
                "artículos, no el catálogo entero en fotos.",
            )
        name = getattr(up, "filename", "") or "catálogo"
        kind = "file"
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        body = body if isinstance(body, dict) else {}
        link = str(body.get("url") or "").strip()
        if link:
            # ITS OWN CEILING, on top of the intake buckets already spent above. A fetch costs our
            # bandwidth and 25 s of a socket before a single model token is bought, so it is metered
            # harder than a paste — and the GLOBAL bucket is checked first, so a spoofed-IP flood
            # meets a wall that does not depend on the IP being real (sup_session.rate_ok's own law).
            if (
                not _ss.rate_ok("demourl:GLOBAL", _DEMO_URL_GLOBAL, 3600)
                or not _ss.rate_ok(f"demourl:t:{tenant}", _DEMO_URL_PER_TENANT, 3600)
                or not _ss.rate_ok(f"demourl:ip:{_ip}", _DEMO_URL_PER_IP, 3600)
            ):
                raise HTTPException(429, "Has abierto muchos enlaces seguidos. Espera un rato y sigue.")
            import urlfetch as _uf

            try:
                got = await _uf.fetch(link)
            except _uf.UrlRefused as e:
                # The refusal's own es-ES sentence, and its machine code for the SPA. The fetched
                # body is never in either (urlfetch's law) — an error that quotes what it fetched is
                # how an SSRF probe reads an internal page out loud.
                log.info("demo url intake refused (%s) for %s", e.code, tenant)
                await _demo_audit(row, "demo.catalog.url.refused", detail={"reason": e.code})
                return JSONResponse({"ok": False, "error": e.code, "detail": e.sentence}, status_code=400)
            except Exception:
                log.exception("demo url intake blew up for %s", tenant)
                raise HTTPException(
                    502, "No he podido abrir ese enlace. Prueba otra vez o súbeme el archivo."
                ) from None
            kind = got["kind"]
            name = got["filename"]
            raw = got["data"]
            text = got["text"]
        else:
            text = str(body.get("text") or "")
            if not text.strip():
                raise HTTPException(400, "No hay nada que leer.")
            from brain import skuparse as _sk

            if len(text) > _sk._MAX_TEXT_CHARS:
                raise HTTPException(
                    413,
                    f"El texto es demasiado largo ({len(text)} caracteres, el "
                    f"máximo es {_sk._MAX_TEXT_CHARS}). Súbelo como archivo.",
                )
            name = str(body.get("name") or "pegado")[:200]
            kind = "paste"
    res = await brain_onboarding.create_intake(
        tenant, "demo", source_kind=kind, source_name=name, raw_bytes=raw, text=text
    )
    if not res.get("ok"):
        raise HTTPException(500, "No he podido empezar a leerlo. Inténtalo otra vez.")
    # reach FIRST, then the parse starts (intake_api's ordering — a restart mid-parse must not
    # strand the intake where no token can name it).
    await demo_flow.note_intake(token, res["id"])
    demo_flow.spend_record("llm")
    asyncio.create_task(brain_onboarding.run_intake(res["id"]))
    await _demo_audit(
        row,
        "demo.catalog.upload",
        target=res["id"],
        detail={
            "kind": kind,
            "bytes": len(raw or b""),
            # the address the visitor typed, so «where did this catalogue come
            # from» stays answerable a week later. It is his own input, never a
            # fetched byte, and it never leaves this table.
            **({"url": link[:400]} if link else {}),
        },
    )
    return JSONResponse({"ok": True, "id": res["id"], "state": "parsing"})


@router.get("/session/{token}/catalog/{intake_id}")
async def demo_catalog_get(token: str, intake_id: str, request: Request) -> JSONResponse:
    _demo_gate()
    row = await _demo_session(token, request, "read")
    tenant = _demo_intake_of(row, intake_id)
    out = await brain_onboarding.get_intake(intake_id, tenant)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(_jsonsafe(out))


@router.patch("/session/{token}/catalog/{intake_id}")
async def demo_catalog_patch(token: str, intake_id: str, payload: dict, request: Request) -> JSONResponse:
    """Corrections: `{"ops": {"<row>": {...}|{"drop":true}|null}}` — or the §17.56 colmap remap,
    `{"remap": {"cols": {"code":i,"name":i,...}}}` (deterministic re-derive, no second LLM pass)."""
    _demo_gate()
    row = await _demo_session(token, request, "admin:rocoto")
    tenant = _demo_intake_of(row, intake_id)
    payload = payload if isinstance(payload, dict) else {}
    ops = payload.get("ops") if isinstance(payload.get("ops"), dict) else {}
    if isinstance(payload.get("remap"), dict):
        ops = {"remap": payload["remap"]}
    if not ops:
        raise HTTPException(400, "Faltan las correcciones.")
    out = await brain_onboarding.patch_intake(intake_id, tenant, ops)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    if out.get("ok") is False:
        raise HTTPException(
            409 if out.get("reason") == "not_ready" else 400,
            out.get("error") or "No he podido guardar esa corrección.",
        )
    return JSONResponse(_jsonsafe(out))


@router.post("/session/{token}/catalog/{intake_id}/commit")
async def demo_catalog_commit(
    token: str, intake_id: str, request: Request, payload: dict = Body(default=None)
) -> JSONResponse:  # type: ignore[assignment]
    """Install the reviewed rows through golive.seed_catalogue (the ONE writer) and open the chat:
    catalog_ready is what demo_flow.chat's gate reads. Idempotent like commit_intake itself.

    THE COUNT GUARD IS NOT THE CLIENT'S TO WAIVE (2026-08-09 review, F4c). This route used to pass
    `override_guard=bool(payload["override"])` — a §5.10.2 safety check whose off-switch was a JSON
    field the caller supplied, on the call that runs `golive.seed_catalogue`, which retires every
    row absent from the file it was just handed. `override_guard=False`, always: a genuine «sí,
    guárdalo igual» belongs on the panel's own intake door, where a founder is the one saying it."""
    _demo_gate()
    row = await _demo_session(token, request, "admin:rocoto")
    tenant = _demo_intake_of(row, intake_id)
    payload = payload if isinstance(payload, dict) else {}
    carry = [c for c in (payload.get("carry_over") or []) if isinstance(c, dict)]
    out = await brain_onboarding.commit_intake(intake_id, tenant, carry_over=carry, override_guard=False)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    if out.get("ok") is False:
        code = 409 if out.get("reason") in ("count_guard", "not_ready") else 422
        # `detail` is what the SPA's one fetch helper renders; without it the count guard —
        # which the demo can no longer waive — would surface as the generic «no he podido».
        body = dict(_jsonsafe(out))
        body.setdefault(
            "detail",
            str((out.get("warning") or {}).get("detail") or "")
            or "No he podido guardarlo. Revisa la lista y vuelve a intentarlo.",
        )
        return JSONResponse(body, status_code=code)
    await demo_flow.set_catalog_ready(token)
    await _demo_audit(
        row, "demo.catalog.commit", target=intake_id, detail={"count": int(out.get("count") or 0)}
    )
    return JSONResponse(_jsonsafe(out))


@router.post("/session/{token}/persona")
async def demo_persona(token: str, payload: dict, request: Request) -> JSONResponse:
    """The 5 questions. `admin:rocoto` because they land on `tenants.behaviour` and the house-style
    row — exactly what `POST /api/sup/behaviour` guards with the same cap."""
    _demo_gate()
    row = await _demo_session(token, request, "admin:rocoto")
    changes = (payload or {}).get("changes") or {}
    out = await demo_flow.persona_set(token, changes)
    if out.get("error") == "unknown_session":
        raise HTTPException(404, _DEMO_404)
    if not out.get("ok"):
        raise HTTPException(400, "Ese ajuste no existe — recarga la página e inténtalo otra vez.")
    await _demo_audit(row, "demo.persona", detail={"keys": sorted(str(k) for k in (changes or {}))[:8]})
    return JSONResponse(out)


@router.post("/session/{token}/chat")
async def demo_chat(token: str, payload: dict, request: Request) -> JSONResponse:
    _demo_gate()
    await _demo_session(token, request, "act")
    payload = payload or {}
    ip = _client_ip(request)
    out = await demo_flow.chat(
        token=token, text=str(payload.get("text") or ""), ip=ip, lang=str(payload.get("lang") or "es")
    )
    if out.get("error") == "unknown_session":
        raise HTTPException(404, _DEMO_404)
    if not out.get("ok") and out.get("error") == "rate_limited":
        # es-ES, like every other refusal on this surface. `too many requests` was English copy
        # reaching a Spanish screen: the SPA renders any `detail` containing a space, so the
        # machine phrase beat its own Spanish fallback (2026-08-08 punch list #16).
        raise HTTPException(429, "Vas muy rápido — espera unos segundos y sigue.")
    return JSONResponse(out)


@router.get("/session/{token}/board")
async def demo_board(token: str, request: Request) -> JSONResponse:
    """The left half of the four-quadrant screen.

    METERED (punch list P0#4): `board` runs `_enrich_unmatched`, which is up to six
    `matcher.match` calls — pgvector plus a bge cross-encoder — per poll, with no cache. A screen
    that polls is a screen that can be told to poll faster, and this box also answers paying
    customers' WhatsApp webhooks."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "board")
    out = await demo_flow.board(token)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(_jsonsafe(out))


@router.get("/session/{token}/order-card/{ref}")
async def demo_order_card(token: str, ref: str, request: Request) -> Response:
    """The order-card PNG for one drafted order — the SAME bytes `brain/order_card` renders for a
    real customer on WhatsApp (`pipeline.ask_order_confirm`). All of it is in
    `demo_flow.order_card_png`; this is the HTTP shape, per this file's convention.

    Gated like every other door in this family: `_demo_session` → the panel's `sup_session`
    cookie, the `read` cap, this operator, this tenant, and the tenant in test mode — then the one
    404 sentence for unknown or expired. It is a GET, so no CSRF applies — and a browser's own
    <img> carries the cookie same-origin, which is why this is a URL and not a fetch.

    `private, no-store`: an order card carries a named business and its prices. It must not sit in
    a shared cache — the PROCESS caches the bytes instead (demo_flow._CARD_CACHE), behind this
    route's whole authorisation chain and keyed on the scope, so a re-mounted `<img>` costs a dict
    lookup rather than another few hundred milliseconds of PIL on the worker that also answers
    WhatsApp. Metered too: deterministic output is no defence against being asked for it in a
    loop."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_rate_ok(row, request, "card", _DEMO_CARD_PER_SESSION, _DEMO_CARD_PER_IP)
    png = await demo_flow.order_card_png(token, ref)
    if not png:
        raise HTTPException(404, _DEMO_404)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, no-store"})


@router.get("/session/{token}/seeds")
async def demo_seeds(token: str, request: Request) -> JSONResponse:
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "seeds")
    out = await demo_flow.seeds(token)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(out)


# ── §17.57 · THE LEARNING LOOP ───────────────────────────────────────────────────────────────────
# HTTP shapes only, per this file's convention — the organs are `demo_flow.skus / correct_line /
# customer / reset_world`. Same gate as everything else in the family, and the caps are the panel's
# own for the same act: reading the price list is `read`, correcting a line and resetting the world
# are `act` (the cap `POST /api/sup/orders/{id}/lines` asks for).


@router.get("/session/{token}/skus")
async def demo_skus(token: str, request: Request) -> JSONResponse:
    """Their price list, for the order-line picker. Metered like the board: it is a list read by a
    human opening a control, not something a screen should be able to poll."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "skus")
    out = await demo_flow.skus(token)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(out)


@router.post("/session/{token}/order/{ref}/line")
async def demo_correct_line(token: str, ref: str, payload: dict, request: Request) -> JSONResponse:
    """`{index, sku_id?, qty?}` → the corrected sheet, and whether it TAUGHT anything.

    The answer's `learned` flag is what the screen shows «Guardado en la memoria» from, so it is the
    organ's own report of a write that happened — never this route's optimism."""
    _demo_gate()
    row = await _demo_session(token, request, "act")
    payload = payload or {}
    try:
        raw_index = payload.get("index")
        if raw_index is None:
            raise ValueError("line index is required")
        index = int(raw_index)
    except (TypeError, ValueError):
        raise HTTPException(400, _DEMO_404) from None
    qty = payload.get("qty")
    out = await demo_flow.correct_line(
        token,
        ref,
        index,
        sku_id=str(payload.get("sku_id") or ""),
        qty=(float(qty) if qty is not None and str(qty) != "" else None),
    )
    if not out.get("ok"):
        raise HTTPException(404, _DEMO_404)
    await _demo_audit(
        row,
        "demo.correct",
        detail={"ref": str(ref)[:24], "index": index, "learned": bool(out.get("learned"))},
    )
    return JSONResponse(_jsonsafe(out))


@router.get("/session/{token}/customer")
async def demo_customer(token: str, request: Request) -> JSONResponse:
    """The ficha for this session's customer — the panel's `GET /api/sup/customers/{phone}` wire, so
    the screen behind «Abrir perfil» is the panel's own dossier component and not a second one."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "customer")
    out = await demo_flow.customer(token)
    if out is None:
        raise HTTPException(404, _DEMO_404)
    return JSONResponse(_jsonsafe(out))


@router.post("/session/{token}/reset")
async def demo_reset(token: str, payload: dict, request: Request) -> JSONResponse:
    """Two depths, one door — `{"what": "orders"}` empties the board and keeps what was learned;
    anything else is «Reiniciar chat y memoria», which takes the conversation and its memory and
    keeps the price list. One route because they are the same act at two radii, and a screen that
    can only offer the deep one has a dead end where the shallow one belonged."""
    _demo_gate()
    row = await _demo_session(token, request, "act")
    what = str((payload or {}).get("what") or "all")
    counts = await demo_flow.clear_orders(token) if what == "orders" else await demo_flow.reset_world(token)
    if counts is None:
        raise HTTPException(404, _DEMO_404)
    await _demo_audit(
        row, "demo.reset", detail={"what": what, "rows": sum(int(v or 0) for v in counts.values())}
    )
    return JSONResponse({"ok": True, "what": what, "counts": counts})


# ── §17.56 build-order ⑤ · VOICE NOTES · PHOTOS · THE QR PHONE HANDOFF ──────────────────────────
# HTTP shapes only, per this file's convention: the hearing and the seeing live in demo_media.py,
# the credential and the two clocks in demo_phone.py. TWO route families on purpose —
# `/api/demo/session/{t}/…` is the DESK (session token, plus the sup_session cookie once authed) and
# `/api/demo/phone/{p}/…` is the PHONE (a narrower, signed, expiring credential). They are separate
# paths because they are separate credentials: nothing here can confuse one for the other, since
# `demo_flow.resolve` only ever matches a `demo_sessions` row and `demo_phone.claim_and_resolve` only
# ever matches an HMAC. A phone token presented to a session route is simply not found.
import demo_media  # noqa: E402
import demo_phone  # noqa: E402


def _demo_media_gate() -> None:
    if not config.DEMO_MEDIA_ENABLED:
        raise HTTPException(503, demo_media.ES["off"])


def _demo_media_error(out: dict) -> JSONResponse:
    """demo_media's dicts → HTTP. It never raises, so this is the one place the mapping lives:
    429 for volume, 413 for size, 409 for an upload still in flight, 422 for «I could not read it»
    (the bytes arrived and were understood as a request — what failed is the reading), and always
    an es-ES sentence the visitor can act on rather than a code."""
    err = str(out.get("error") or "")
    code = {
        "rate_limited": 429,
        "off": 503,
        "runtime_error": 503,
        "too_big_voice": 413,
        "too_big_photo": 413,
        "too_long": 413,
        "in_flight": 409,
    }.get(err, 422)
    if not (out.get("reply") or "").strip():
        # a turn-side failure (runtime_error) carries no sentence of its own — never ship a body a
        # surface would render as an empty bubble.
        out["reply"] = (
            "Se me ha atragantado. Vuelve a intentarlo en un momento."
            if code == 503
            else demo_media.ES["rate"]
        )
    return JSONResponse(out, status_code=code)


async def _demo_upload(request: Request, field: str, max_bytes: int, too_big: str) -> tuple:
    """(bytes, declared content-type, form) for one multipart file.

    THE SIZE IS REFUSED BEFORE THE BYTES ARE READ (intake_api.py's law, and this door is wider than
    that one: whoever scanned a QR can reach it). Pulling a 500 MB body through the box in order to
    answer «too big» IS the attack, so `content-length` is checked first and the post-read length
    check below is only the belt for a chunked upload that declared nothing."""
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > max_bytes:
        raise HTTPException(413, too_big)
    ctype = (request.headers.get("content-type") or "").lower()
    if not ctype.startswith("multipart/form-data"):
        raise HTTPException(400, "Falta el archivo.")
    form = await request.form()
    up = form.get(field)
    if up is None or not hasattr(up, "read"):
        raise HTTPException(400, "Falta el archivo.")
    try:
        raw = await up.read()
    except Exception:
        raise HTTPException(400, "No he podido leer el archivo.") from None
    if not raw:
        raise HTTPException(400, "El archivo está vacío.")
    if len(raw) > max_bytes:
        raise HTTPException(413, too_big)
    return raw, (getattr(up, "content_type", "") or ""), form


@router.post("/session/{token}/voice")
async def demo_voice(token: str, request: Request) -> JSONResponse:
    """A voice note from the DESK composer's RecPhase gesture (§17.56). Multipart `audio`.

    ⚠️ Q2 (`behaviour.voice`) does NOT gate this. It governs how Rocoto REPLIES, not whether a
    customer may SEND audio — a customer can always send a voice note, that is what WhatsApp is."""
    _demo_gate()
    _demo_media_gate()
    row = await _demo_session(token, request, "act")
    if not demo_flow.spend_ok("media"):
        raise HTTPException(429, demo_flow._SPEND_FULL)
    raw, ctype, form = await _demo_upload(
        request, "audio", config.DEMO_VOICE_MAX_BYTES, demo_media.ES["too_big_voice"]
    )
    ip = _client_ip(request)
    out = await demo_media.voice(
        row=row,
        audio=raw,
        content_type=ctype,
        ip=ip,
        origin="desk",
        client_id=str(form.get("client_id") or ""),
        lang=str(form.get("lang") or "es"),
    )
    await demo_media.maybe_reap()
    return JSONResponse(_jsonsafe(out)) if out.get("ok") else _demo_media_error(_jsonsafe(out))


@router.post("/session/{token}/photo")
async def demo_photo(token: str, request: Request) -> JSONResponse:
    """A photo of a handwritten note or a price sheet, from the desk (§17.20's highest-value input).
    Multipart `image` + optional `caption`. The bytes are never stored and never served back out."""
    _demo_gate()
    _demo_media_gate()
    row = await _demo_session(token, request, "act")
    if not demo_flow.spend_ok("media"):
        raise HTTPException(429, demo_flow._SPEND_FULL)
    raw, ctype, form = await _demo_upload(
        request, "image", config.DEMO_PHOTO_MAX_BYTES, demo_media.ES["too_big_photo"]
    )
    ip = _client_ip(request)
    out = await demo_media.photo(
        row=row,
        image=raw,
        content_type=ctype,
        ip=ip,
        origin="desk",
        caption=str(form.get("caption") or ""),
        client_id=str(form.get("client_id") or ""),
        lang=str(form.get("lang") or "es"),
    )
    await demo_media.maybe_reap()
    return JSONResponse(_jsonsafe(out)) if out.get("ok") else _demo_media_error(_jsonsafe(out))


@router.get("/session/{token}/media")
async def demo_media_state(token: str, request: Request) -> JSONResponse:
    """§17.20's STATE DOC — idempotent, complete, and the truth both screens re-render from when the
    live channel pokes them, on reconnect, or on a tab refocus."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "mediastate")
    return JSONResponse(_jsonsafe(await demo_media.state(row["sid"])))


@router.get("/session/{token}/qr")
async def demo_qr(token: str, request: Request, rotate: int = 0) -> Response:
    """«Escanea para seguir en tu móvil» — an SVG QR of a SIGNED, SHORT-LIVED link to this session's
    phone view. `?rotate=1` cuts a new one (and kills the old); without it a healthy link is
    redrawn as-is, so re-rendering the desk never invalidates a code mid-scan.

    `act` rather than `read`: this MINTS a credential that reaches this tenant’s world from a
    device we have never seen. It is a GET only because a browser draws it with <img>.

    TWO BUCKETS (BUG 3): `?rotate=1` is an HMAC mint plus a database write per call, so it gets a
    much tighter one than the plain redraw. Nobody rotates a QR six times a minute on purpose."""
    _demo_gate()
    row = await _demo_session(token, request, "act")
    if rotate:
        _demo_rate_ok(row, request, "qrrotate", _DEMO_QR_ROTATE_PER_SESSION, _DEMO_QR_ROTATE_PER_IP)
    else:
        _demo_rate_ok(row, request, "qr", _DEMO_QR_PER_SESSION, _DEMO_QR_PER_IP)
    svg, _link = await demo_phone.qr(row["sid"], rotate=bool(rotate))
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


@router.get("/session/{token}/wa-qr")
async def demo_wa_qr(token: str, request: Request, url: str = "") -> Response:
    """«Hablar con ventas» — the SVG QR of a wa.me deep link, so a prospect sitting at a desktop can
    carry the conversation onto the phone in their pocket and it arrives with their business name
    already in the message (§17.56, Peter 2026-08-09: «that way it's direct to me from their phone
    … but attaches their business name etc»).

    IT DRAWS; IT DOES NOT DECIDE. The client sends the link it is about to open and this renders
    it, which is what makes «the QR encodes the same URL as the button» a fact about the code
    rather than a claim: there is ONE builder (`demo/api.ts salesWaUrl`) and this is a renderer.
    The alternative — rebuilding the link here — puts the sales COPY (an es/en pair that lives
    beside every other string on this surface, in the SPA) in two places, and two builders drift on
    the first punctuation change.

    WHY NOT `/qr`: that route MINTS a signed, short-lived phone credential for this session and
    encodes THAT. Same renderer, different job, different blast radius, tighter bucket. Reusing it
    would mean teaching a credential mint to draw arbitrary links, which is exactly the coupling
    worth refusing.

    THE ALLOWLIST IS STRUCTURAL. Only `https://wa.me/…` is drawable, so this can never become
    «render me a QR to anywhere» served off our own origin — a QR is a link somebody scans without
    reading it, which makes an open renderer a phishing aid. Bounded length, no whitespace, and
    `read` capability with the ordinary QR bucket: it writes nothing."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_rate_ok(row, request, "qr", _DEMO_QR_PER_SESSION, _DEMO_QR_PER_IP)
    link = (url or "").strip()
    if not link.startswith("https://wa.me/") or len(link) > 900 or any(c.isspace() for c in link):
        raise HTTPException(400, "Ese enlace no se puede dibujar aquí.")
    return Response(
        content=brain_ob_ext.qr_svg(link), media_type="image/svg+xml", headers={"Cache-Control": "no-store"}
    )


@router.get("/session/{token}/phone")
async def demo_phone_state(token: str, request: Request) -> JSONResponse:
    """The handoff as the DESK needs it: is a link live, has a phone claimed it, when does it die,
    and the one es-ES sentence for the state it is in."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_poll_ok(row, request, "phonestate")
    return JSONResponse(_jsonsafe(await demo_phone.link_state(row["sid"])))


@router.post("/session/{token}/phone/revoke")
async def demo_phone_revoke(token: str, request: Request) -> JSONResponse:
    """«I put that QR on a projector.» Every outstanding link for this session dies now. POST rather
    than DELETE deliberately — the demo CORS lane allows GET/POST/PATCH and nothing else.

    `read`, not `act`, and that is on purpose: this is WITHDRAWAL-ONLY. It can destroy a credential
    and can create nothing. Anyone allowed to see the demo must be able to kill a QR they just put
    on a projector, without going to find whoever holds the office cap."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    return JSONResponse(await demo_phone.revoke(row["sid"]))


@router.get("/session/{token}/stream")
async def demo_stream(token: str, request: Request, since: int = 0) -> StreamingResponse:
    """The desk's live channel — §17.39's rail (sync.head + sync.shelves_since) with one extra
    cursor for this session's capture state, so what the phone sends appears WITHOUT a refresh.

    ⚠️ BUILD-CONCERNS #10: this connection stays open by design, so `networkidle` never fires.
    Anything driving /demo in a browser waits on `domcontentloaded` + an explicit settle.

    METERED ON OPENS (BUG 3). One held connection is cheap; a client reconnecting in a tight loop is
    an unbounded number of live generators on a single-worker box. The limit is on how often a
    session may OPEN one, which is the thing a loop does and a person does not."""
    _demo_gate()
    row = await _demo_session(token, request, "read")
    _demo_rate_ok(row, request, "stream", _DEMO_STREAM_PER_SESSION, _DEMO_STREAM_PER_IP)
    tenant = demo_flow.tenant_of_row(row)
    return StreamingResponse(
        demo_phone.desk_stream(row["sid"], tenant, since),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ── the PHONE's own family. Narrower credential, narrower surface (demo_phone.PHONE_CAPS). ────────
_DEMO_DEVICE_COOKIE = "rk_demo_dev"


def _demo_device(request: Request) -> str:
    """The claiming device. §17.20's «device cookie», with a header fallback for a client whose
    cookies are blocked. Absent → '' , which `claim_and_resolve` treats as «does not claim» rather
    than as a new device, so a cookie-less browser is not locked out of its own session."""
    return (request.cookies.get(_DEMO_DEVICE_COOKIE) or request.headers.get("x-demo-device") or "")[:120]


async def _demo_phone_session(ptoken: str, cap: str, request: Request) -> tuple[dict, str]:
    """(session row, device) or the honest refusal. The ONLY reader of a phone token.

    `cap` is checked against `demo_phone.PHONE_CAPS` even though every route below passes a member
    of it — because the check is what makes the capability set REAL rather than a comment, and the
    day somebody wires the persona modal into the phone view they will hit a 403 here instead of
    discovering later that the narrow credential was never narrow.

    WHY THE PHONE STILL HAS ITS OWN CREDENTIAL, when «the whole thing is authed». Because it IS
    authed — one rung up. The QR is minted only behind the desk's `sup_session` cookie by an
    operator holding `act` on a tenant already proved to be in test mode, and what it hands the
    phone is signed, device-claimed, capability-narrowed and expiring on two clocks. The phone in
    the room cannot be asked to carry the desk's cookie; requiring it would delete the handoff, not
    secure it.

    THE TWO FENCES ADDED 2026-08-09 (F6 · F4b). `demo_phone.py`'s docstring claimed the phone token
    was «narrower than the session token»: true in VERBS, false in whose world it reaches. So (a) a
    LEGACY anonymous session is refused outright — its links were minted before the anonymous rung
    was deleted and must not outlive it; and (b) the same `status='test'` fence the desk passes is
    applied here, so a phone link can never be the way into a live paying workspace."""
    if not demo_phone.has_cap(cap):
        raise HTTPException(403, "Eso se ajusta en el ordenador, no en el móvil.")
    dev = _demo_device(request)
    row, err = await demo_phone.claim_and_resolve(ptoken, dev)
    if err == "claimed":
        raise HTTPException(409, demo_phone.LINK_CLAIMED)
    if row is None:
        # unknown ≡ forged ≡ expired ≡ revoked ≡ the session died under the open phone: ONE answer.
        raise HTTPException(404, demo_phone.LINK_DEAD)
    if not demo_flow.is_authed(row):
        raise HTTPException(404, demo_phone.LINK_DEAD)
    await _demo_test_world(row)
    return row, dev


@router.get("/phone/{ptoken}")
async def demo_phone_open(ptoken: str, request: Request) -> JSONResponse:
    """What the phone needs to draw its pane (demo_phone.phone_view). Also where the device cookie
    is minted: a phone arriving with none gets one, and CLAIMS with it, so the next request is
    recognisably the same device and a second phone in the room is refused."""
    _demo_gate()
    row, dev = await _demo_phone_session(ptoken, "view", request)
    minted = ""
    if not dev:
        minted = secrets.token_urlsafe(12)
        await demo_phone.claim_and_resolve(ptoken, minted)  # claim as the device we just minted
    out = await demo_phone.phone_view(row)
    resp = JSONResponse(_jsonsafe(out))
    if minted:
        # httponly (no script needs it) · samesite=lax (the phone arrives by following a link) ·
        # secure only when the base URL is https, so a local http box can still be driven.
        resp.set_cookie(
            _DEMO_DEVICE_COOKIE,
            minted,
            max_age=int(config.DEMO_PHONE_HARD_CAP_S),
            httponly=True,
            samesite="lax",
            secure=str(config.DEMO_PUBLIC_BASE_URL or "").startswith("https"),
        )
    return resp


@router.post("/phone/{ptoken}/chat")
async def demo_phone_chat(ptoken: str, payload: dict, request: Request) -> JSONResponse:
    _demo_gate()
    row, _dev = await _demo_phone_session(ptoken, "chat", request)
    ip = _client_ip(request)
    out = await demo_flow.chat(
        token=row["token"],
        text=str((payload or {}).get("text") or ""),
        ip=ip,
        lang=str((payload or {}).get("lang") or "es"),
    )
    if out.get("error") == "unknown_session":
        raise HTTPException(404, demo_phone.LINK_DEAD)
    if not out.get("ok") and out.get("error") == "rate_limited":
        raise HTTPException(429, "too many requests")
    return JSONResponse(_jsonsafe(out))


@router.post("/phone/{ptoken}/voice")
async def demo_phone_voice(ptoken: str, request: Request) -> JSONResponse:
    """The reason the handoff exists, half of it: the phone has the microphone in the room."""
    _demo_gate()
    _demo_media_gate()
    row, _dev = await _demo_phone_session(ptoken, "voice", request)
    if not demo_flow.spend_ok("media"):
        raise HTTPException(429, demo_flow._SPEND_FULL)
    raw, ctype, form = await _demo_upload(
        request, "audio", config.DEMO_VOICE_MAX_BYTES, demo_media.ES["too_big_voice"]
    )
    ip = _client_ip(request)
    out = await demo_media.voice(
        row=row,
        audio=raw,
        content_type=ctype,
        ip=ip,
        origin="phone",
        client_id=str(form.get("client_id") or ""),
        lang=str(form.get("lang") or "es"),
    )
    return JSONResponse(_jsonsafe(out)) if out.get("ok") else _demo_media_error(_jsonsafe(out))


@router.post("/phone/{ptoken}/photo")
async def demo_phone_photo(ptoken: str, request: Request) -> JSONResponse:
    """The other half, and the one that lands: the phone has the CAMERA, and the handwritten note is
    on the desk beside the laptop that cannot photograph it."""
    _demo_gate()
    _demo_media_gate()
    row, _dev = await _demo_phone_session(ptoken, "photo", request)
    if not demo_flow.spend_ok("media"):
        raise HTTPException(429, demo_flow._SPEND_FULL)
    raw, ctype, form = await _demo_upload(
        request, "image", config.DEMO_PHOTO_MAX_BYTES, demo_media.ES["too_big_photo"]
    )
    ip = _client_ip(request)
    out = await demo_media.photo(
        row=row,
        image=raw,
        content_type=ctype,
        ip=ip,
        origin="phone",
        caption=str(form.get("caption") or ""),
        client_id=str(form.get("client_id") or ""),
        lang=str(form.get("lang") or "es"),
    )
    return JSONResponse(_jsonsafe(out)) if out.get("ok") else _demo_media_error(_jsonsafe(out))


# The phone's reads carry the SAME buckets as the desk's, keyed on the same `sid` — deliberately
# shared rather than parallel (BUG 3). The two rails are two credentials onto ONE session, and a
# ceiling a visitor can double by opening the QR is not a ceiling.
@router.get("/phone/{ptoken}/board")
async def demo_phone_board(ptoken: str, request: Request) -> JSONResponse:
    _demo_gate()
    row, _dev = await _demo_phone_session(ptoken, "board", request)
    _demo_poll_ok(row, request, "board")
    out = await demo_flow.board(row["token"])
    if out is None:
        raise HTTPException(404, demo_phone.LINK_DEAD)
    return JSONResponse(_jsonsafe(out))


@router.get("/phone/{ptoken}/seeds")
async def demo_phone_seeds(ptoken: str, request: Request) -> JSONResponse:
    _demo_gate()
    row, _dev = await _demo_phone_session(ptoken, "seeds", request)
    _demo_poll_ok(row, request, "seeds")
    out = await demo_flow.seeds(row["token"])
    if out is None:
        raise HTTPException(404, demo_phone.LINK_DEAD)
    return JSONResponse(out)


@router.get("/phone/{ptoken}/media")
async def demo_phone_media(ptoken: str, request: Request) -> JSONResponse:
    """The phone's own capture list — the same state doc the desk reads, so «reopening the same URL
    re-renders the list from GET state» (§17.20) is one query, not two implementations."""
    _demo_gate()
    row, _dev = await _demo_phone_session(ptoken, "media", request)
    _demo_poll_ok(row, request, "mediastate")
    return JSONResponse(_jsonsafe(await demo_media.state(row["sid"])))


def mount(application) -> None:
    """Install after sup_api: authentication shares the product's session/error handlers."""
    application.include_router(router)
    demo_auth.mount(application)
