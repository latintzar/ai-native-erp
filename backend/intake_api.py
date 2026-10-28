"""intake_api.py — INGESTION EVERYWHERE (SPEC §5.10.5).

Peter, 2026-07-27, verbatim: *"the ingestion should work on desktop and mobile. Also if I ask to send
me an ingestion link to my email, it has to, just like the onboarding ingestion… it's basically that,
so we can upload as many SKUs as we want to. Only difference is that with me, it changes the whole
seeded state. Unless I've asked you to seed relevant 'other' orders, it wouldn't have any and in any
case my demo will involve live sending voice notes to show the orders come in."*

He has meetings booked with real prospects and wants to walk in showing THEIR catalogue. Everything
in this file exists to make that one morning work, and nothing here is a second copy of anything:

  ① A THIRD DOOR ONTO THE SAME ROAD. The §5.10.2 intake — paste or upload → SEE what was understood →
    correct it → commit — already lives behind the app's bearer and the desk's cookie. This adds a
    door that needs NEITHER: a mailed link that resolves to a row. Every route below lands on
    `brain/onboarding.create_intake / get_intake / patch_intake / commit_intake / discard_intake`,
    the very functions `app.py` calls. There is no second parser, no second diff, no second writer,
    so a catalogue read through the link and a catalogue read in the app can never disagree.

  ② THE LINK IS FOUNDER-ONLY, AND THAT IS ARCHITECTURAL, NOT A SETTING. What comes through it can
    become the seeded WORLD, and activating a world DESTROYS the one currently in the tables. So the
    mint demands a verified Supabase identity that `brain/auth.is_founder` recognises (deliberately
    NOT the machine key, which ships inside every APK), the token is 256 opaque bits, it expires on a
    FIXED clock, there is one active link at a time, and revoking is a status rather than a delete.
    The reasoning lives next to the table, in `brain/onboarding` §5.10.5.

  ③ A TOKEN'S REACH IS WHAT IT UPLOADED, NOT WHAT THE TENANT OWNS. `link_owns_intake` is checked on
    every read and every write of an intake. The tenant alone would have been the easy fence and the
    wrong one: it would hand a link sitting in an inbox every catalogue ever uploaded from the app.

  ④ THE WORLD IS MINTED WITHOUT A PAST. `seed.create_profile_from_intake` defaults to
    `history_weeks=0`, and this file does not override it. Peter's demo IS the live voice note
    landing in front of the room; a world pre-filled with invented orders would put fiction on the
    screen before the prospect's own products ever appeared. Orders arrive because he sends one.

  ⑤ ACTIVATION WEARS THE SAME ARMOUR AS THE DESK'S. The confirmation word, and `sup_api`'s OWN
    `_demo_reset_lock` — imported, never re-declared, because a founder with the link open on a
    laptop and the app open on a phone is exactly the double-fire a second lock would not catch.

es-ES on every operator- and founder-facing string (LOCKED LAW). Code, comments and logs stay English.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

import config
from brain import auth as brain_auth
from brain import onboarding as brain_onboarding
from brain import seed as brain_seed
from brain import skuparse as brain_skuparse

log = logging.getLogger("rocoto.intake_api")

router = APIRouter()

# A mailed door is a door onto a disk. A 4 000-line price list is a few hundred KB; 25 MB is a photo
# of a tariff taken by a modern phone with room to spare, and anything past it is not a catalogue.
LINK_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

def _confirm_word() -> str:
    """The word the desk already demands, READ rather than re-decided. Hard-coding «REINICIAR» here
    would mean two files deciding what a founder must type, and the day one of them changed the
    other would start refusing a word he had just been shown."""
    try:
        import sup_api
        return str(sup_api._DEMO_RESET_WORD)
    except Exception:                       # pragma: no cover — the import is app.py's own
        return "REINICIAR"


def _es(status: int, sentence: str) -> HTTPException:
    """Every refusal this file makes is a Spanish sentence a person can act on, never a code."""
    return HTTPException(status, sentence)


# ══ THE FOUNDER'S SIDE — minting, revoking, and turning an intake into a world ═════════════════════

async def _founder(request: Request, response: Response, authorization: str) -> dict:
    """A verified FOUNDER, through either door: the phone's Supabase bearer or the desk's
    `sup_session` cookie. → {tenant, email, door}.

    Both doors are the ones that already exist (`brain/auth` for the phone, `sup_api.require_sup` for
    the desk, CSRF check and all) so «who is Peter» keeps having exactly ONE answer per surface.
    Neither reads a tenant off the wire."""
    tok = (authorization or "").strip()
    if tok.lower().startswith("bearer "):
        tok = tok[7:].strip()
    if tok:
        user = await brain_auth.verify_token(tok)
        if not user:
            raise _es(401, "Inicia sesión para continuar.")
        if not brain_auth.is_founder(user):
            raise _es(403, "Sólo el fundador puede pedir un enlace de subida.")
        try:
            scope = await brain_auth.app_scope(user)
            tenant = scope.get("tenant_slug") or config.BRAIN_TENANT
        except Exception:
            tenant = config.BRAIN_TENANT
        return {"tenant": tenant, "email": (user.get("email") or "").strip().lower(), "door": "app"}
    import sup_api
    try:
        ctx = await sup_api.require_sup(request, response)  # verifies the cookie AND the CSRF token
    except sup_api.SupAuthError:
        # `SupAuthError` and `SupApiError` only become HTTP answers through handlers that
        # `sup_api.mount()` installs on the app object. This organ has to refuse the same way whether
        # or not that wiring happens to be present — a gate whose 401 depends on another module
        # having been mounted answers 500 the first time somebody composes the router differently
        # (measured: exactly that, the first time this router was served on its own). So the refusal
        # is said here, in the same words the bearer door uses ten lines up.
        raise _es(401, "Inicia sesión para continuar.")
    except sup_api.SupApiError as e:
        raise _es(int(getattr(e, "status", 403) or 403),
                  str(getattr(e, "detail", "") or "Tu sesión no permite esto."))
    if (ctx.get("role") or "") != "founder":
        raise _es(403, "Sólo el fundador puede pedir un enlace de subida.")
    return {"tenant": ctx.get("tenant_slug") or config.BRAIN_TENANT,
            "email": (ctx.get("actor_email") or ctx.get("email") or "").strip().lower(),
            "door": "desk"}


@router.get("/api/app/catalogue/link")
async def intake_link_get(request: Request, response: Response,
                          authorization: str = Header(default="")) -> JSONResponse:
    """«¿Tengo un enlace vivo?» → {ok, url, caduca, etiqueta} or {ok:true, url:""}.

    A founder with no live link gets an honest empty answer rather than a 404: there is nothing wrong
    with not having one, and a screen that shows an error where it simply has nothing reads broken."""
    who = await _founder(request, response, authorization)
    # A READ MUST NEVER MINT. `intake_link_for` deliberately mints when there is nothing live — that
    # is right for «mándamelo», wrong for «¿tengo uno?» — so this route asks the table directly
    # rather than reaching for the nearest function with a matching name.
    await brain_onboarding.ensure_intake_link_schema()
    import db as _db
    async with _db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select token, label, expires_at from intake_links where tenant_id=$1 and minted_by=$2 "
            "and status='active' and expires_at > now()", who["tenant"], who["email"])
    if row is None:
        return JSONResponse({"ok": True, "url": "", "caduca": "", "etiqueta": ""})
    return JSONResponse({"ok": True, "url": brain_onboarding.intake_link_url(row["token"]),
                         "caduca": brain_onboarding._iso(row["expires_at"]),
                         "etiqueta": row["label"] or ""})


@router.post("/api/app/catalogue/link")
async def intake_link_mint(request: Request, response: Response,
                           authorization: str = Header(default="")) -> JSONResponse:
    """«Mándame un enlace para subir un catálogo.»

    Body (all optional): `{"email": "…", "label": "Cárnicas Peral", "rotate": bool, "send": bool}`.
    Defaults: the founder's OWN verified address, no label, reuse the live link, and DO send the
    mail — because the whole ask was «send it to my email», so not sending would be answering a
    different question.

    `rotate` is the «lo he reenviado a alguien» button: it kills the old link and issues a new one in
    one commit. It is a separate flag precisely so it cannot happen by accident every time he asks."""
    who = await _founder(request, response, authorization)
    try:
        body = await request.json()
    except Exception:
        body = {}
    body = body if isinstance(body, dict) else {}
    to = str(body.get("email") or "").strip() or who["email"]
    label = str(body.get("label") or "").strip()[:120]
    if not to or "@" not in to:
        raise _es(400, "Dime a qué correo te lo mando.")

    if body.get("rotate"):
        link = await brain_onboarding.mint_intake_link(who["tenant"], who["email"],
                                                       label=label, sent_to=to)
    else:
        link = await brain_onboarding.intake_link_for(who["tenant"], who["email"], label=label)
    if not link.get("ok"):
        raise _es(500, "No he podido preparar el enlace. Inténtalo otra vez.")

    sent = {"ok": False}
    if body.get("send", True):
        sent = await brain_onboarding.send_intake_link(
            to, link["url"], label=label, expires_at=link.get("expires_at") or "")
    log.info("intake link handed to %s via the %s door (sent=%s, minted=%s)",
             who["email"], who["door"], sent.get("ok"), link.get("minted"))
    return JSONResponse({
        "ok": True, "url": link["url"], "caduca": link.get("expires_at") or "",
        "etiqueta": link.get("label") or "", "nuevo": bool(link.get("minted")),
        "enviado": bool(sent.get("ok")), "correo": to,
        # A mail that did not go must SAY so — «te lo he mandado» when nothing left is the one thing
        # a founder cannot recover from, because he will sit waiting for it.
        "aviso": ("" if sent.get("ok") or not body.get("send", True) else
                  "No he podido mandarte el correo. Aquí tienes el enlace igualmente."),
    })


@router.delete("/api/app/catalogue/link")
async def intake_link_revoke(request: Request, response: Response,
                             authorization: str = Header(default="")) -> JSONResponse:
    """Turn the live link off. The row survives (revocation is a status), so «who had a link, and
    when did it stop working» stays answerable."""
    who = await _founder(request, response, authorization)
    n = await brain_onboarding.revoke_intake_link(who["tenant"], who["email"])
    return JSONResponse({"ok": True, "revocados": n})


@router.post("/api/app/catalogue/intake/{intake_id}/perfil")
async def intake_to_profile_app(intake_id: str, request: Request, response: Response,
                                authorization: str = Header(default="")) -> JSONResponse:
    """«Guardar como perfil» from the phone or the desk — the reviewed catalogue becomes a demo world.

    Body: `{"name": "Cárnicas Peral", "activate": bool, "confirm": "REINICIAR", "history_weeks": 0}`.
    A NEW sub-path under the existing intake family, so app.py's five routes are untouched."""
    who = await _founder(request, response, authorization)
    try:
        body = await request.json()
    except Exception:
        body = {}
    return await _mint_world(who["tenant"], intake_id, body if isinstance(body, dict) else {},
                             actor=who["email"])


# ══ THE LINK'S SIDE — no app, no login, one token ══════════════════════════════════════════════════

_LINK_404 = "Este enlace ya no vale. Pídeme otro."


async def _link(token: str) -> dict:
    """token → the link row, or ONE 404 for unknown / revoked / expired alike."""
    who = await brain_onboarding.resolve_intake_link(token)
    if not who:
        raise _es(404, _LINK_404)
    return who


async def _link_intake(token: str, intake_id: str) -> dict:
    """The link, having proved it owns THIS intake. Same 404 when it does not — a link must not be
    able to discover that an intake it did not create exists."""
    who = await _link(token)
    if not brain_onboarding.link_owns_intake(who, intake_id):
        raise _es(404, _LINK_404)
    return who


@router.get("/api/intake/{token}")
async def link_view(token: str) -> JSONResponse:
    """The page's first read: is this link alive, what is it for, and what has come through it."""
    who = await _link(token)
    ids = set(who.get("intakes") or [])
    recientes = []
    if ids:
        todas = await brain_onboarding.list_intakes(who["tenant_id"], limit=100)
        recientes = [i for i in todas if i["id"] in ids]
    # The page offers «guardar como perfil», so it must be able to name the worlds that exist and say
    # which one is live — «activar» is otherwise a button pressed blind. FAIL-SOFT on purpose: a
    # registry that cannot be read must not take down the upload page, which is the part he needs.
    try:
        mundos = await brain_seed.list_profiles()
    except Exception:
        log.exception("intake link: the world registry is unreadable (the page still works)")
        mundos = {"active": "", "profiles": []}
    return JSONResponse({
        "ok": True, "etiqueta": who.get("label") or "", "caduca": who.get("expires_at") or "",
        "importaciones": recientes,
        "mundos": mundos,
    })


@router.post("/api/intake/{token}/upload")
async def link_upload(token: str, request: Request) -> JSONResponse:
    """Start an ingestion through the link. `multipart` with a `file`, OR JSON `{"text": "…"}`.

    Byte-for-byte the same two shapes `POST /api/app/catalogue/intake` accepts, for the same reason
    it accepts both: a supplier's list lives in an open Excel window as often as in a file, and
    Ctrl-V is one gesture where «export it, find it, upload it» is five."""
    who = await _link(token)
    text: Optional[str] = None
    raw: Optional[bytes] = None
    ctype = (request.headers.get("content-type") or "").lower()
    # THE SIZE IS REFUSED BEFORE THE BYTES ARE READ. Checking after `await up.read()` means a
    # 500 MB body has already been pulled through the box to be told it was too big — and this door
    # is reachable by whoever holds the token, not only by a signed-in founder.
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > LINK_MAX_UPLOAD_BYTES:
        raise _es(413, "Eso es demasiado grande. Mándame la lista de artículos, no el catálogo "
                       "entero en fotos.")
    if ctype.startswith("multipart/form-data"):
        form = await request.form()
        up = form.get("file")
        if up is None or not hasattr(up, "read"):
            raise _es(400, "Falta el archivo.")
        try:
            raw = await up.read()
        except Exception:
            raise _es(400, "No he podido leer el archivo.")
        if not raw:
            raise _es(400, "El archivo está vacío.")
        if len(raw) > LINK_MAX_UPLOAD_BYTES:
            raise _es(413, "Ese archivo es demasiado grande. Mándame la lista de artículos, no el "
                           "catálogo entero en fotos.")
        name = getattr(up, "filename", "") or "catálogo"
        kind = "file"
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        text = str((body or {}).get("text") or "")
        if not text.strip():
            raise _es(400, "No hay nada que leer.")
        # REFUSE rather than keep the first N characters: a silently-clipped paste is a catalogue
        # with a hole in it that nobody can see.
        if len(text) > brain_skuparse._MAX_TEXT_CHARS:
            raise _es(413, f"El texto es demasiado largo ({len(text)} caracteres, el máximo es "
                           f"{brain_skuparse._MAX_TEXT_CHARS}). Súbelo como archivo y lo leo entero.")
        name = str((body or {}).get("name") or "pegado")[:200]
        kind = "paste"

    res = await brain_onboarding.create_intake(
        who["tenant_id"], f"enlace:{who['minted_by']}", source_kind=kind, source_name=name,
        raw_bytes=raw, text=text)
    if not res.get("ok"):
        raise _es(500, "No he podido empezar a leerlo. Inténtalo otra vez.")
    # THE LINK'S REACH GROWS FIRST, then the parse starts. The other order loses the intake to the
    # link the instant the process restarts mid-parse: the row would exist and no token could name it.
    await brain_onboarding.note_intake_on_link(token, res["id"])
    asyncio.create_task(brain_onboarding.run_intake(res["id"]))
    return JSONResponse({"ok": True, "id": res["id"], "state": "parsing"})


@router.get("/api/intake/{token}/i/{intake_id}")
async def link_get(token: str, intake_id: str) -> JSONResponse:
    """The preview — rows (parsed ⊕ edits), warnings, and the diff computed at READ time."""
    who = await _link_intake(token, intake_id)
    out = await brain_onboarding.get_intake(intake_id, who["tenant_id"])
    if out is None:
        raise _es(404, _LINK_404)
    return JSONResponse(_safe(out))


@router.patch("/api/intake/{token}/i/{intake_id}")
async def link_patch(token: str, intake_id: str, request: Request) -> JSONResponse:
    """The corrections: `{"ops": {"<row>": {"name": …} | {"drop": true} | null}}`."""
    who = await _link_intake(token, intake_id)
    try:
        body = await request.json()
    except Exception:
        body = {}
    ops = (body or {}).get("ops")
    if not isinstance(ops, dict):
        raise _es(400, "Faltan las correcciones.")
    out = await brain_onboarding.patch_intake(intake_id, who["tenant_id"], ops)
    if out is None:
        raise _es(404, _LINK_404)
    if out.get("ok") is False:
        raise _es(409 if out.get("reason") == "not_ready" else 400,
                  "No he podido guardar esa corrección.")
    return JSONResponse(_safe(out))


@router.post("/api/intake/{token}/i/{intake_id}/commit")
async def link_commit(token: str, intake_id: str, request: Request) -> JSONResponse:
    """Install it into the LIVE catalogue, through `golive.seed_catalogue` and nothing else."""
    who = await _link_intake(token, intake_id)
    try:
        body = await request.json()
    except Exception:
        body = {}
    body = body if isinstance(body, dict) else {}
    carry = [c for c in (body.get("carry_over") or []) if isinstance(c, dict)]
    out = await brain_onboarding.commit_intake(intake_id, who["tenant_id"], carry_over=carry,
                                               override_guard=bool(body.get("override")))
    if out is None:
        raise _es(404, _LINK_404)
    if out.get("ok") is False:
        code = 409 if out.get("reason") in ("count_guard", "not_ready") else 422
        return JSONResponse(_safe(out), status_code=code)
    log.info("intake %s committed through a link minted by %s", intake_id, who["minted_by"])
    return JSONResponse(_safe(out))


@router.post("/api/intake/{token}/i/{intake_id}/discard")
async def link_discard(token: str, intake_id: str) -> JSONResponse:
    """Throw it away. The row survives as the record that somebody looked and said no; the bytes go."""
    who = await _link_intake(token, intake_id)
    out = await brain_onboarding.discard_intake(intake_id, who["tenant_id"])
    if out is None:
        raise _es(404, _LINK_404)
    if out.get("ok") is False:
        raise _es(409, "Eso ya está guardado, no se puede descartar.")
    return JSONResponse(_safe(out))


@router.post("/api/intake/{token}/i/{intake_id}/perfil")
async def link_to_profile(token: str, intake_id: str, request: Request) -> JSONResponse:
    """«Guardar como perfil» from the mailed page — a prospect's catalogue becomes a demo world."""
    who = await _link_intake(token, intake_id)
    try:
        body = await request.json()
    except Exception:
        body = {}
    return await _mint_world(who["tenant_id"], intake_id, body if isinstance(body, dict) else {},
                             actor=f"enlace:{who['minted_by']}")


@router.post("/api/intake/{token}/activar")
async def link_activate(token: str, request: Request) -> JSONResponse:
    """Switch the world from the mailed page: `{"profile_id": "…", "confirm": "REINICIAR"}`."""
    await _link(token)
    try:
        body = await request.json()
    except Exception:
        body = {}
    body = body if isinstance(body, dict) else {}
    pid = str(body.get("profile_id") or "").strip()
    if not pid:
        raise _es(400, "Dime qué mundo quieres activar.")
    return JSONResponse(await _activate(pid, str(body.get("confirm") or "")))


# ══ the two shared moves, written once ════════════════════════════════════════════════════════════

async def _mint_world(tenant: str, intake_id: str, body: dict, *, actor: str) -> JSONResponse:
    """intake → a named world, optionally switched into. ONE implementation, three doors.

    `history_weeks` DEFAULTS TO 0 and this is where that default is protected: the demo is the live
    voice note landing (Peter's own words), so a minted world starts with the prospect's articles,
    the customers who buy them, and NOTHING ordered yet. He can ask for traffic explicitly."""
    name = str(body.get("name") or "").strip()
    if not name:
        raise _es(400, "Ponle un nombre al perfil — el del cliente al que se lo vas a enseñar.")
    try:
        weeks = max(0, min(12, int(body.get("history_weeks") or 0)))
    except (TypeError, ValueError):
        weeks = 0
    # REFUSE BEFORE DOING ANYTHING. «Guardar y activar» with the wrong word used to mint the profile
    # first and fail on the switch, so the operator read «escribe REINICIAR» while a world he could
    # not see had already been created — and typing the word again then hit the duplicate-name path.
    # A refusal that has already had a side effect is not a refusal.
    if body.get("activate") and (str(body.get("confirm") or "").strip().upper() != _confirm_word()):
        raise _es(400, f"Escribe {_confirm_word()} para confirmar. Esto no se puede deshacer.")
    try:
        res = await brain_seed.create_profile_from_intake(intake_id, name, tenant=tenant,
                                                          history_weeks=weeks)
    except ValueError as e:
        # ProfileRejected already carries the Spanish sentence AND a machine code — hand both across,
        # never re-word one or flatten it into a 500.
        raise _es(400, str(e))
    log.info("world %s minted from intake %s by %s (history_weeks=%d)",
             res.get("id"), intake_id, actor, weeks)
    out: dict[str, Any] = {"ok": True, "perfil": res, "historial_semanas": weeks,
                           **(await brain_seed.list_profiles())}
    if body.get("activate"):
        out["activado"] = await _activate(str(res["id"]), str(body.get("confirm") or ""))
    return JSONResponse(_safe(out))


async def _activate(profile_id: str, confirm: str) -> dict:
    """The switch, wearing the desk's armour rather than a second copy of it.

    `sup_api._demo_reset_lock` is IMPORTED, not re-declared: a founder with the link open on a laptop
    and the app open on a phone is exactly the double-fire a private lock would fail to catch, and a
    half-torn-down world is the one state `reset_demo_seed` has no receipt for."""
    word = _confirm_word()
    if (confirm or "").strip().upper() != word:
        raise _es(400, f"Escribe {word} para confirmar. Esto no se puede deshacer.")
    import sup_api
    if sup_api._demo_reset_lock.locked():
        raise _es(409, "Ya se está reiniciando. Espera a que termine.")
    async with sup_api._demo_reset_lock:
        try:
            res = await brain_seed.activate_profile(profile_id, brain_seed.DEMO_TENANT)
        except (RuntimeError, ValueError) as e:
            log.warning("link activate REFUSED profile=%s: %s", profile_id, e)
            raise _es(409, str(e) or "No he podido activar ese mundo.")
        except Exception:
            log.exception("link activate failed profile=%s", profile_id)
            raise _es(500, "No he podido activar ese mundo de prueba.")
    return {"ok": True, "de": res.get("from_profile"), "a": res.get("to_profile"),
            "nombre": res.get("to_profile_name") or "",
            "creado": (res.get("created") or {}), "borrado": (res.get("removed") or {})}


def _safe(v: Any) -> Any:
    """datetimes / Decimals / UUIDs → JSON, the same way `app.py._jsonsafe` does. Local so this organ
    imports nothing from the file another builder owns today."""
    import datetime as _dt
    import decimal
    import uuid as _uuid
    if isinstance(v, dict):
        return {k: _safe(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_safe(x) for x in v]
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, _uuid.UUID):
        return str(v)
    return v
