"""Maintained CRM HTTP routes and Control Room shell.

The router shares cr_auth's existing session, capability and CSRF dependencies. Control-room
services own business operations; static assets remain beside this module in cr/.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

import cr_session
import db as supa
import demo_call
from brain import onboarding as brain_onboarding
from cr_auth import _client_ip, require_cr_cap, require_cr_session
from cr_web_policy import _CR_SEC_HEADERS

log = logging.getLogger("rocoto")
router = APIRouter()
require_act = require_cr_cap("act")
require_admin = require_cr_cap("admin")


CR_DIR = Path(__file__).resolve().parent / "cr"


_CR_ASSETS = {
    "tokens.css": "text/css; charset=utf-8",
    "cr.css": "text/css; charset=utf-8",
    "cr.js": "application/javascript; charset=utf-8",
    "vendor/supabase.min.js": "application/javascript; charset=utf-8",
}


@router.get("/api/crm/leads")
async def api_crm_leads(test: int = 0, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """Control Room session: the CRM lead list with call counts and waitlist positions.
    Defaults to live leads; ?test=1 selects the test cohort."""
    return JSONResponse({"leads": await brain_onboarding.list_leads(mode=bool(test))})


@router.get("/api/crm/room")
async def api_crm_room() -> FileResponse:
    """The Control Room SPA shell (login-gated IN-APP via the cr_sid session; every data endpoint is
    require_cr_session). Reachable at soyrocoto.com/api/crm/room via the Vercel /api/crm proxy. Ships a
    strict CSP + anti-clickjacking + no-referrer headers."""
    return FileResponse(CR_DIR / "index.html", media_type="text/html; charset=utf-8", headers=_CR_SEC_HEADERS)


@router.get("/api/crm/room/asset/{fname:path}")
async def api_crm_room_asset(fname: str) -> FileResponse:
    """Serve the CR static bundle — a STRICT whitelist (only these keys resolve; no path traversal)."""
    ct = _CR_ASSETS.get(fname)
    if not ct:
        raise HTTPException(404, "not found")
    return FileResponse(CR_DIR / fname, media_type=ct)


@router.get("/api/crm/room/summary-sources")
async def api_crm_summary_sources(
    scope: str, id: int, ctx: dict = Depends(require_cr_session)
) -> JSONResponse:
    """§15.2 expand-to-raw: the events a summary distilled."""
    import control_room

    return JSONResponse(await control_room.summary_sources(scope, int(id)))


def _assert_human_session(ctx: dict) -> None:
    if ctx.get("via") != "session" or not ctx.get("actor_email"):
        raise HTTPException(403, "a signed-in operator session is required")


@router.get("/api/crm/room/account")
async def api_cr_account(scope: str, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """The tenant/customer account card (identity · numbers · plan/tier · stage · refundable payments)."""
    import cr_control

    return JSONResponse(await cr_control.account_data(scope))


@router.post("/api/crm/room/refund")
async def api_cr_refund(payload: dict, request: Request, ctx: dict = Depends(require_act)) -> JSONResponse:
    """Stripe refund of the scope's setup-fee charge. Session+act cap + a typed re-confirm; the server
    resolves the payment_intent (never the client); idempotent + write-ahead audited."""
    _assert_human_session(ctx)
    if (payload.get("confirm") or "") != "REFUND":
        raise HTTPException(400, "typed confirmation required")
    scope = (payload.get("scope") or "").strip()
    if not scope:
        raise HTTPException(400, "scope required")
    amount = payload.get("amount")
    import cr_control

    r = await cr_control.refund(
        scope,
        int(amount) if amount else None,
        (payload.get("reason") or "")[:200],
        ctx["actor_email"],
        _client_ip(request),
    )
    return JSONResponse(r, status_code=200 if r.get("ok") else 409)


@router.post("/api/crm/room/golive")
async def api_cr_golive(payload: dict, request: Request, ctx: dict = Depends(require_act)) -> JSONResponse:
    """WP-2 go-live (the CR «Activar» button): catalogue seed → number bind → tenant activation →
    welcome, one-shot via the golive_at atomic claim (a repeat is {ok, already_live}). Session+act cap
    only — NEVER the machine key (dx F1); write-ahead cr_audit inside cr_control.golive. Typed es-ES
    failure reasons ride back to the surface."""
    _assert_human_session(ctx)
    scope = (payload.get("scope") or "").strip()
    if not scope:
        raise HTTPException(400, "scope required")
    import cr_control

    r = await cr_control.golive(
        scope, (payload.get("number") or "").strip(), ctx["actor_email"], _client_ip(request)
    )
    return JSONResponse(r, status_code=200 if r.get("ok") else 409)


@router.get("/api/crm/room/data/export")
async def api_cr_data_export(scope: str, request: Request, ctx: dict = Depends(require_act)) -> JSONResponse:
    """GDPR data export — the subject's full data as JSON. Audited."""
    _assert_human_session(ctx)
    import cr_control

    await cr_session.audit(
        ctx["actor_email"], _client_ip(request), "data.export", target_scope=scope, result="ok"
    )
    return JSONResponse(await cr_control.export_data(scope))


@router.post("/api/crm/room/data/erase")
async def api_cr_data_erase(
    payload: dict, request: Request, ctx: dict = Depends(require_admin)
) -> JSONResponse:
    """GDPR hard-erase — OWNER only (admin cap). Leaf scope, typed re-confirm, write-ahead audited."""
    _assert_human_session(ctx)
    if (payload.get("confirm") or "") != "ERASE":
        raise HTTPException(400, "typed confirmation required")
    scope = (payload.get("scope") or "").strip()
    if not scope:
        raise HTTPException(400, "scope required")
    import cr_control

    r = await cr_control.erase(scope, ctx["actor_email"], _client_ip(request), mode="erase")
    return JSONResponse(r, status_code=200 if r.get("ok") else 409)


@router.post("/api/crm/room/data/anonymize")
async def api_cr_data_anonymize(
    payload: dict, request: Request, ctx: dict = Depends(require_act)
) -> JSONResponse:
    """GDPR anonymise-in-place — session+act cap, typed re-confirm, write-ahead audited."""
    _assert_human_session(ctx)
    if (payload.get("confirm") or "") != "ANONYMIZE":
        raise HTTPException(400, "typed confirmation required")
    scope = (payload.get("scope") or "").strip()
    if not scope:
        raise HTTPException(400, "scope required")
    import cr_control

    r = await cr_control.erase(scope, ctx["actor_email"], _client_ip(request), mode="anonymize")
    return JSONResponse(r, status_code=200 if r.get("ok") else 409)


@router.get("/api/crm/room/board")
async def api_crm_room_board(ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import control_room

    return JSONResponse(await control_room.board_data())


@router.get("/api/crm/room/drill")
async def api_crm_room_drill(scope: str, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import control_room

    return JSONResponse(await control_room.drill_data(scope))


@router.post("/api/crm/room/override")
async def api_crm_room_override(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    import control_room

    return JSONResponse(
        await control_room.override_send((payload.get("scope") or "").strip(), payload.get("text", ""))
    )


@router.get("/api/crm/hoy")
async def api_crm_hoy(ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """WP-11 the «HOY» digest — the boss's daily what-needs-me, cross-scope."""
    import runtime

    return JSONResponse(await runtime.hoy_digest())


@router.get("/api/crm/room/trackers")
async def api_crm_room_trackers(scope: str, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """The CR's Vigilancias pane — the SAME registry read, behind the CR session (SPEC §5.6: "one
    registry, both windows")."""
    import trackers

    return JSONResponse(await trackers.registry(scope))


@router.post("/api/crm/room/persona")
async def api_crm_room_persona(payload: dict, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """The persona console — roleplay a fake customer INTO the real agentic runtime (lineage=test)."""
    import control_room

    return JSONResponse(
        await control_room.persona_send(payload.get("phone", "+34699000001"), payload.get("text", ""))
    )


@router.get("/api/crm/room/tab")
async def api_crm_tab(scope: str, tab_id: int, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """WP-9 the Sherlock dossier for one tab (scenarios · trigger · close · timers · case tree)."""
    import control_room

    return JSONResponse(await control_room.tab_dossier(scope, int(tab_id)))


@router.post("/api/crm/room/clone")
async def api_crm_clone(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    """SPEC §13.5 anonymous clone: a real customer's world → a safe anonymized test subject."""
    import control_room

    return JSONResponse(await control_room.clone_anonymize((payload.get("scope") or "").strip()))


@router.post("/api/crm/room/test-world")
async def api_crm_room_testworld(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    import control_room

    return JSONResponse(await control_room.create_test_world(payload.get("sentence", "")))


@router.get("/api/crm/room/alerts")
async def api_crm_alerts(ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import control_room

    return JSONResponse(await control_room.alerts_data())


@router.post("/api/crm/room/alerts/resolve")
async def api_crm_alerts_resolve(payload: dict, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    import control_room

    return JSONResponse(await control_room.resolve_alert(int(payload.get("id") or 0)))


@router.post("/api/crm/room/onboard")
async def api_crm_room_onboard(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    """Send the personalised onboarding link — reuses the CRM mark-done flow."""
    lead_id = (payload.get("lead_id") or "").strip()
    if not lead_id:
        raise HTTPException(400, "lead_id required")
    return await api_crm_mark_done(lead_id, ctx)


@router.post("/api/crm/room/call")
async def api_crm_room_call(payload: dict, ctx: dict = Depends(require_act)) -> JSONResponse:
    """Place a call to a prospect from the room (Rocoto calls them now)."""
    phone = (payload.get("phone") or "").strip()
    if not phone:
        raise HTTPException(400, "phone required")
    try:
        r = await demo_call.place_call_to(phone, payload.get("locale", "es"), payload.get("name", ""))
        return JSONResponse({"ok": True, "sid": r.get("sid")})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=502)


@router.get("/api/crm/lead/{lead_id}")
async def api_crm_lead(lead_id: str, ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """Control Room session: one lead, its ingested calls and transcript facts."""
    lead = await brain_onboarding.get_lead(lead_id)
    if lead is None:
        raise HTTPException(404, "not found")
    pool = supa.get_pool()
    async with pool.acquire() as con:
        calls = await con.fetch(
            "select id, phone, note_path, transcript, raw_transcript, duration_sec, kind, created_at "
            "from calls_onboard where lead_id = $1 order by created_at desc",
            lead_id,
        )
        facts = await con.fetch(
            "select id, call_id, field, value, confidence, mentions, created_at "
            "from transcript_facts where lead_id = $1 order by created_at desc",
            lead_id,
        )
    return JSONResponse(
        {
            "lead": lead,
            "calls": [supa._ser(r) for r in calls],
            "transcript_facts": [supa._ser(r) for r in facts],
        }
    )


@router.post("/api/crm/lead/{lead_id}/attach-transcript")
async def api_crm_attach_transcript(lead_id: str, ctx: dict = Depends(require_act)) -> JSONResponse:
    """Act capability: run one call-note ingest pass, then return this lead's calls."""
    lead = await brain_onboarding.get_lead(lead_id)
    if lead is None:
        raise HTTPException(404, "not found")
    try:
        await brain_onboarding.ingest_calls_once()
    except Exception:
        log.exception("manual ingest failed")
    pool = supa.get_pool()
    async with pool.acquire() as con:
        calls = await con.fetch(
            "select id, phone, note_path, transcript, raw_transcript, duration_sec, kind, created_at "
            "from calls_onboard where lead_id = $1 order by created_at desc",
            lead_id,
        )
    return JSONResponse({"ok": True, "calls": [supa._ser(r) for r in calls]})


@router.post("/api/crm/lead/{lead_id}/mark-done")
async def api_crm_mark_done(lead_id: str, ctx: dict = Depends(require_act)) -> JSONResponse:
    """Act capability: mark the lead done, mint a wizard token, email the personalized link, and flip
    the lead to wizard_sent. Returns {token, url}."""
    lead = await brain_onboarding.get_lead(lead_id)
    if lead is None:
        raise HTTPException(404, "not found")
    await brain_onboarding.set_status(lead_id, "done", actor="peter")
    token = await brain_onboarding.mint_token(lead_id, tenant_slug=None)
    try:
        await brain_onboarding.send_wizard_link(lead, token)
    except Exception:
        log.exception("wizard link email failed")
    await brain_onboarding.set_status(lead_id, "wizard_sent", actor="peter")
    url = f"{brain_onboarding.PUBLIC_BASE_URL}/onboarding/{token}"
    return JSONResponse({"ok": True, "token": token, "url": url})
