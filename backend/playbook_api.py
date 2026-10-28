"""Sales playbook HTTP routes; Control Room auth and service-owned business logic."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from cr_auth import require_cr_cap, require_cr_session
from cr_web_policy import _CR_SEC_HEADERS

router = APIRouter()
require_act = require_cr_cap("act")
require_admin = require_cr_cap("admin")

# ── The Sales Playbook — Peter's own tool, four screens, reached at /internal/playbook ───────────
# It shares the Control Room's door: the same Supabase-OAuth → cr_sid server session, the same
# CSRF double-submit, the same owner/admin allowlist. What it does NOT share is how the bundle is
# served, and that difference is the whole security design of this surface:
#
#   cr.js  is public. Reading it tells you the shape of the Control Room and nothing more.
#   pb.js  is NOT. It carries the Spanish talk track, the objection answers, the pricing model and
#          the scope-fee floor — every line of which is Peter's negotiating position. A prospect
#          who can `curl` it walks into the call knowing the number he will settle for.
#
# So the SHELL is public and empty (a gate, a logo, a Google button — no playbook content, no
# comments about one) and EVERY asset behind it requires a live session. The shell injects the
# stylesheet and the script itself, after `/api/crm/me` answers. That is the reason for the
# split and it must survive any refactor: the moment pb.js is served unauthenticated, the tool's
# whole content is public.
PB_DIR = Path(__file__).resolve().parent / "pb"
_PB_ASSETS = {"pb.css": "text/css; charset=utf-8", "pb.js": "application/javascript; charset=utf-8"}


@router.get("/api/crm/playbook")
async def api_pb_shell() -> FileResponse:
    """The gate. Public by necessity (a login page cannot require a login) and empty by design."""
    return FileResponse(
        PB_DIR / "index.html",
        media_type="text/html; charset=utf-8",
        headers={**_CR_SEC_HEADERS, "Cache-Control": "no-store"},
    )


@router.get("/api/crm/playbook/asset/{fname:path}")
async def api_pb_asset(fname: str, ctx: dict = Depends(require_cr_session)) -> FileResponse:
    """SESSION-GATED, unlike the Control Room's assets — see the block comment above. Strict
    whitelist, so `fname` can never walk the filesystem."""
    ct = _PB_ASSETS.get(fname)
    if not ct:
        raise HTTPException(404, "not found")
    return FileResponse(PB_DIR / fname, media_type=ct, headers={"Cache-Control": "no-store"})


@router.get("/api/crm/playbook/accounts")
async def api_pb_accounts(archived: int = 0, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import playbook

    return JSONResponse(
        {
            "accounts": await playbook.list_accounts(include_archived=bool(archived)),
            "stages": list(playbook.STAGES),
        }
    )


@router.post("/api/crm/playbook/accounts")
async def api_pb_account_create(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    import playbook

    try:
        acct = await playbook.create_account(
            payload.get("name", ""), payload.get("contact", ""), payload.get("role", "")
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return JSONResponse({"account": acct})


@router.get("/api/crm/playbook/accounts/{acct_id}")
async def api_pb_account_get(acct_id: int, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import playbook

    acct = await playbook.get_account(acct_id)
    if not acct:
        raise HTTPException(404, "no such account")
    return JSONResponse({"account": acct})


@router.patch("/api/crm/playbook/accounts/{acct_id}")
async def api_pb_account_patch(acct_id: int, payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    import playbook

    acct = await playbook.patch_account(acct_id, payload or {})
    if not acct:
        raise HTTPException(404, "no such account")
    return JSONResponse({"account": acct})


@router.post("/api/crm/playbook/accounts/{acct_id}/touch")
async def api_pb_account_touch(acct_id: int, ctx: dict = Depends(require_act)) -> JSONResponse:
    import playbook

    await playbook.touch_account(acct_id)
    return JSONResponse({"ok": True})


@router.post("/api/crm/playbook/accounts/{acct_id}/notes")
async def api_pb_note_add(acct_id: int, payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    import playbook

    try:
        note = await playbook.add_note(acct_id, payload.get("body", ""), ctx.get("actor_email", ""))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if note is None:
        raise HTTPException(404, "no such account")
    return JSONResponse({"note": note})


@router.delete("/api/crm/playbook/accounts/{acct_id}")
async def api_pb_account_delete(acct_id: int, ctx: dict = Depends(require_admin)) -> JSONResponse:
    import playbook

    return JSONResponse({"ok": await playbook.delete_account(acct_id)})
