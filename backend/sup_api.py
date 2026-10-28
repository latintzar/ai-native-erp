"""sup_api.py — the supplier web-app surface (`/api/sup/*`), ONE kernel organ (Wave-3).

Implements the contract defined FIRST in webapp/src/api/contract.ts (the wire is law there):
session login/me/logout · orders (list/detail/status/lines/excel/dispatch-now) · chats
(list/messages/send-as-Rocoto) · customers (list/detail/erp-code/csv) · catalogue · settings
(dispatch/e-commerce toggle/billing/team) · routes (day/optimize → vroom organ) · the demo world
(`/demo`, `/demo/reset` — the founder's own «reiniciar los datos de demostración»; the wire lives
in webapp/src/components/DemoResetCard.tsx until contract.ts is next opened, and is documented on
the two route docstrings, which are law for it in the meantime).

AUTH: sup_session (the tenant-scoped second session world — see sup_session.py). The machine key
is NEVER valid here; every mutating route needs the session + X-Sup-CSRF + a capability, and every
money/state action lands in the append-only sup_audit (the CR pattern).

TENANT ISOLATION IS ABSOLUTE:
  • tables carrying tenant_id (customer_profiles, catalogue_skus, tenants, team_members) are
    filtered by the SESSION's tenant_slug — the client never sends a tenant id;
  • the legacy runtime tables (orders, whatsapp_messages, wa.* scopes) belong to the ONE tenant this
    deployment's runtime serves (config.BRAIN_TENANT): any other tenant's session is refused LOUDLY
    (403 tenant_scope_unavailable) — never another tenant's rows, never silence dressed as data.

app.py-owned machinery (dispatch settings/run, the approve side-effects) is INJECTED via mount(…)
— the organ borrows through an explicit seam, it never reaches into app.py.

es-ES for user-facing copy; en for code + machine-readable error codes (LANGUAGE LAW §0.11).
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import re

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse

import actions
import business_day
import config
import db
import ops
import provisioning
import spine
import sup_session
import tenancy
import vroom
from brain import auth as brain_auth
from identity_phone import canon

log = logging.getLogger("rocoto.sup_api")

SUP_COOKIE = "sup_session"
SUP_COOKIE_PATH = "/"

router = APIRouter(prefix="/api/sup")

# app.py-owned callables, injected at mount() — see mount() docstring.
_hooks: dict = {}


# ── errors on the contract's wire shape: {error, detail?} ─────────────────────────────────────────
class SupApiError(Exception):
    def __init__(self, status: int, error: str, detail: str = ""):
        super().__init__(error)
        self.status, self.error, self.detail = status, error, detail


class SupAuthError(Exception):
    """Absent/expired/revoked session → a plain 401. IT CARRIES NO Set-Cookie, and that is the whole
    point of this docstring (2026-08-09, the bug that ate every /demo sign-in).

    IT USED TO DELETE THE COOKIE. `_sup_auth_handler` answered every 401 with
    `Set-Cookie: sup_session=""; Max-Age=0`, on the reasoning that a dead cookie should not wedge the
    SPA. The flaw is that a 401 knows only about the request it refused, while `Set-Cookie` writes
    the browser's WHOLE jar — so a refusal for one request could destroy a session minted by
    another. That is not hypothetical: it is the measured cause of «Tu sesión ha caducado» on a link
    the visitor clicked ten seconds earlier.

    THE SHAPE OF IT. `/demo/entrar` mounts three things in one commit, and all three fetch at once:
    `DemoLayout`'s boot `GET /api/demo/me`, the panel `AuthProvider`'s `GET /api/sup/session/me`,
    and `EntrarScreen`'s `POST /api/demo/auth/verify/{token}`. The first two are asked BEFORE anyone
    is signed in, correctly carry no cookie, and correctly answer 401. The third mints the session
    and sets the cookie. Whichever 401 happens to come back LAST then wiped it. Measured on the live
    stack: the sign-in landed at +0.545s, `/api/demo/me` answered 200 at +0.669s, the straggling
    probe's 401 landed at +2.8s and the jar went empty. In prod, both of Peter's sign-ins on
    2026-08-09 show `sup_session` rows that were touched exactly once, 0.17s after minting, then
    never again — never revoked, never expired. The browser simply stopped holding the cookie.
    And because every following 401 deleted it again, the session could never recover.

    A REQUEST THAT PRESENTED NO COOKIE HAS NOTHING TO CLEAR, and a request that presented a dead one
    does not need clearing either: a dead cookie is inert. `sup_session.verify` refuses it in one
    indexed lookup, the route 401s, the SPA shows the door, and the next real sign-in overwrites it.
    The clear was hygiene, never a control — revocation is server-side (`sup_session.revoke`), and
    the one place that MEANS «forget this browser» is `sup_logout`, which still clears explicitly.
    So the hygiene is gone and the race with it: nothing in the 401 path writes the cookie jar."""


def _err(status: int, error: str, detail: str = "") -> SupApiError:
    return SupApiError(status, error, detail)


# ── cookie + session deps ─────────────────────────────────────────────────────────────────────────
# The hops whose forwarding headers we believe. uvicorn binds 127.0.0.1:8092 and Caddy is the ONLY
# thing in front of it on this box, so the trusted set is loopback and nothing else. Overridable for
# a deployment that puts the proxy elsewhere; an EMPTY value means «trust nothing», which degrades to
# the socket peer rather than to a forgeable header.
TRUSTED_PROXY_IPS = frozenset(
    x.strip() for x in (config._env("ROCOTO_TRUSTED_PROXY_IPS", "127.0.0.1,::1") or "").split(",")
    if x.strip())


def _client_ip(request: Request) -> str:
    """The requester's address, as far as anything on this box can honestly know it.

    WHAT THIS USED TO BE, AND WHY IT CHANGED (2026-08-09 review, F7). It was
    `xff.split(",")[0]` — the LEFTMOST `X-Forwarded-For` entry, with no notion of a trusted hop.
    Leftmost is the one value in that header a client can write, so «the client's IP» was whatever
    the client said it was: one `curl -H 'X-Forwarded-For: 10.0.0.$RANDOM'` per request and every
    per-IP rate limit on this deployment became a no-op, while `consent_events.ip` — the row
    consent.py calls the proof of «from where» — recorded attacker-chosen text.

    MEASURED, NOT ASSUMED. I probed the prod Caddy (2.11.2) in isolation on 2026-08-09 with a
    byte-identical `reverse_proxy` block: with no `trusted_proxies` configured it REPLACES both
    `X-Forwarded-For` and `X-Real-IP` with the real peer and drops whatever the client sent. So the
    spoof does not currently reach this function — but that is a property of a proxy config nobody
    here owns, and it flips silently the day someone adds `trusted_proxies` to the Caddyfile. The
    code should not depend on it, so it no longer does.

    THE RULE. The socket peer decides whether we read a forwarded header at all. From an untrusted
    peer the peer IS the answer. From a trusted hop, the RIGHTMOST `X-Forwarded-For` entry is the
    address that hop saw — everything to its left is client-supplied and worthless — with `X-Real-IP`
    (which our Caddy blocks explicitly SET) as the fallback.

    KNOWN COARSENESS, stated because it changes what the limits mean: the /demo SPA reaches this
    backend through Vercel's `/api/:path*` rewrite, so for that traffic the address Caddy sees — and
    therefore the address here — is a VERCEL EDGE, shared by every visitor behind it. Per-IP buckets
    on this surface are a volume guard, not a per-visitor guard; the walls that actually hold are the
    per-address bucket and the absolute global ceiling."""
    peer = ((request.client.host if request.client else "") or "").strip()
    if peer not in TRUSTED_PROXY_IPS:
        return peer[:64]
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[-1].strip()[:64] or peer[:64]
    return (request.headers.get("x-real-ip", "").strip() or peer)[:64]


def _set_cookie(response: Response, raw: str, max_age: int | None = None) -> None:
    # HOST-ONLY on app.soyrocoto.com by construction: no Domain attribute is ever set — the landing
    # and the CR can never see the supplier cookie. SameSite=Lax per the contract (top-level nav OK,
    # cross-site POST blocked; CSRF double-submit is the second wall).
    response.set_cookie(SUP_COOKIE, raw,
                        max_age=(max_age if max_age and max_age > 0 else sup_session.SESSION_TTL_S),
                        httponly=True, secure=True, samesite="lax", path=SUP_COOKIE_PATH)


def _clear_cookie(response: Response) -> None:
    """The attrs MATCH `_set_cookie`'s. A delete is just a Set-Cookie with an expiry in the past, and
    a browser that is strict about Secure/SameSite on the way in is entitled to be strict about them
    on the way out. Logout is the one caller."""
    response.delete_cookie(SUP_COOKIE, path=SUP_COOKIE_PATH,
                           httponly=True, secure=True, samesite="lax")


async def require_sup(request: Request, response: Response) -> dict:
    """The supplier session gate. Verifies the sup_session cookie → tenant-scoped ctx; slides
    rotation only on the navigational /session/me; enforces CSRF (X-Sup-CSRF double-submit) on every
    unsafe method. 401 (cookie-clearing) when absent/expired/idle/revoked. NOT the machine key."""
    _is_me = request.url.path.endswith("/sup/session/me")
    ctx = await sup_session.verify(request.cookies.get(SUP_COOKIE), rotate=_is_me)
    if not ctx:
        raise SupAuthError()
    # Internal support sessions share identity storage but carry no customer authority. Refuse
    # before callers can substitute a default runtime tenant for an empty customer scope.
    if not ctx.get("tenant_slug") or ctx.get("role") not in sup_session.ROLE_CAPS:
        raise _err(403, "customer_scope_required", "Entra con una cuenta de este equipo.")
    if ctx.get("fresh_raw"):
        _set_cookie(response, ctx["fresh_raw"], max_age=ctx.get("remaining"))
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if not sup_session.check_csrf(ctx, request.headers.get("x-sup-csrf")):
            raise _err(403, "csrf_invalid", "Sesión caducada — recarga la página.")
    ctx["ip"] = _client_ip(request)
    return ctx


def require_cap(cap: str):
    """Dependency factory: a valid supplier session AND the given capability (read | act | admin)."""
    async def _dep(ctx: dict = Depends(require_sup)) -> dict:
        if not sup_session.can(ctx.get("role", ""), cap):
            raise _err(403, "cap_required", "Tu rol no permite esta acción.")
        return ctx
    return _dep


def _require_runtime(ctx: dict) -> None:
    """The runtime-tenant fence for the legacy (non-tenant_id) tables — see sup_session.owns_runtime.
    Cross-tenant reads FAIL LOUD here; they are never served empty-but-200."""
    if not sup_session.owns_runtime(ctx.get("tenant_slug", "")):
        raise _err(403, "tenant_scope_unavailable",
                   "Los datos de tu empresa no están en este servidor.")


async def _tenant_row(slug: str) -> dict | None:
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow("select * from tenants where slug = $1", slug)
    return dict(r) if r else None


def _wire_session(ctx: dict, tenant_name: str, tenant_status: str = "test",
                  onboarded: bool = True) -> dict:
    """The session as the panel reads it.

    `tenant_status` is here because §17.34.5 puts the live state on EVERY page — «EN DIRECTO ·
    WhatsApp» / «EN PRUEBAS» beside the tenant name, both territories, no exceptions. Carrying it on
    the session rather than fetching it per surface is what makes "no exceptions" true by
    construction: a new page cannot forget to ask, and cannot render a stale answer.
    """
    return {"ok": True, "email": ctx.get("actor_email") or ctx.get("email"),
            "tenant_slug": ctx["tenant_slug"], "tenant_name": tenant_name,
            "tenant_status": tenant_status, "onboarded": bool(onboarded),
            "role": ctx["role"], "caps": sorted(sup_session.ROLE_CAPS.get(ctx["role"], [])),
            "csrf": ctx["csrf"], "expires_in_s": int(ctx.get("remaining") or ctx.get("ttl") or 0)}


# ── session family ────────────────────────────────────────────────────────────────────────────────
@router.post("/session/login")
async def sup_login(request: Request, response: Response, payload: dict | None = None):
    """Exchange a verified Supabase bearer (Google OAuth, matching-email identity) for a server-side
    TENANT-SCOPED session. The token rides the JSON body ({access_token}) per the contract."""
    ip = _client_ip(request)
    if not sup_session.rate_ok(f"sup_login:{ip}", limit=12, window_s=300):
        raise _err(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    if not sup_session.rate_ok("sup_login:GLOBAL", limit=60, window_s=300):
        raise _err(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    token = ((payload or {}).get("access_token") or "").strip()
    user = await brain_auth.verify_token(token)
    if not user:
        raise _err(401, "unauthorized", "No hemos podido verificar tu sesión de Google.")
    s = await sup_session.session_for_user(user, ip, request.headers.get("user-agent", ""))
    if not s.get("ok"):
        # audit the refusal (no tenant resolved → tenant '', the forensic trail still exists)
        try:
            await sup_session.audit((user.get("email") or ""), "", ip, "login",
                                    result=s.get("error") or "forbidden")
        except Exception:
            log.exception("sup login refusal audit failed")
        if s.get("error") == "oauth_required":
            # THE HONEST HALF OF THE INVITE (§5.11.3). A member added by his Google address who then
            # signs up with a PASSWORD used to be told «no perteneces a ningún equipo» — which is
            # false: he does belong, he just came through the door the gate refuses. Saying it
            # plainly is what stops the next person from "fixing" the gate. The gate itself does not
            # move: with Supabase email-confirmation off, a password signup is auto-confirmed and
            # would elevate anyone who typed a member's address.
            raise _err(403, "oauth_required",
                       "Entra con Google, con el mismo correo con el que te dieron de alta. "
                       "Una contraseña no abre la empresa.")
        raise _err(403, "forbidden",
                   "Tu cuenta de Google no pertenece a ningún equipo de Rocoto.")
    _set_cookie(response, s["raw"])
    await sup_session.audit(s["email"], s["tenant_slug"], ip, "login", result="ok")
    _t = await _tenant_row(s["tenant_slug"])
    return _wire_session(s, s.get("tenant_name") or s["tenant_slug"],
                         (_t or {}).get("status") or "test",
                         onboarded=(_t or {}).get("onboarded_at") is not None)


@router.get("/session/me")
async def sup_me(ctx: dict = Depends(require_sup)):
    t = await _tenant_row(ctx["tenant_slug"])
    return _wire_session(ctx, (t or {}).get("name") or ctx["tenant_slug"],
                         (t or {}).get("status") or "test",
                         onboarded=(t or {}).get("onboarded_at") is not None)


@router.post("/session/logout", status_code=204)
async def sup_logout(request: Request, response: Response):
    """«Salir» — revoke server-side AND forget the browser. Now the ONLY route that clears the
    cookie, which is why it has to actually do it.

    IT DID NOT (found 2026-08-09 alongside the 401 defect, same family). `_clear_cookie(response)`
    wrote the Set-Cookie onto the INJECTED response, and then the handler returned a BRAND NEW
    `Response(204)` — FastAPI merges the injected headers only when the handler returns something
    that is not already a Response, so the delete was dropped on the floor every time. The session
    was revoked server-side (so nothing was insecure) and the dead cookie stayed in the browser.
    The clear now rides the object that is actually returned."""
    raw = request.cookies.get(SUP_COOKIE)
    if raw:
        ctx = await sup_session.verify(raw, rotate=False)
        if ctx and sup_session.check_csrf(ctx, request.headers.get("x-sup-csrf")):
            await sup_session.revoke(raw)
            await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], _client_ip(request),
                                    "logout", result="ok")
    out = Response(status_code=204)
    _clear_cookie(out)
    return out


# ── orders family (the EXISTING projection, re-served behind the session + tenant fence) ──────────
_ORDER_STATUSES = ("needs_review", "approved", "sent", "failed", "rejected")


# ── §17.42 · CANALES — the taps, honestly (WP-D7) ────────────────────────────────────────────
@router.get("/channels")
async def sup_channels(ctx: dict = Depends(require_cap("read"))):
    """The four channels with their REAL states — nothing on this wire is aspirational.

    WhatsApp `live` means exactly §17.42's sentence: the tenant is live AND a Meta number is bound
    to it. The email ALIAS is deterministic per tenant (`pedidos.<slug>@in.soyrocoto.com`) so it can
    be shown and copied today; whether the inbound rail processes it yet is carried as its state,
    never implied by the alias existing. Counts are the day's real orders.
    """
    slug = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        t = await con.fetchrow(
            "select status, coalesce(wa_phone_number_id,'') as wa_id from tenants where slug=$1", slug)
        today_wa = await con.fetchval(
            "select count(*) from orders where tenant_id=$1 and from_storefront=false "
            "and (delivery_date = current_date::text or created_at::date = current_date)", slug) or 0
        last = await con.fetchrow(
            "select customer_name, created_at from orders where tenant_id=$1 and from_storefront=false "
            "order by created_at desc limit 1", slug)
    # A CHANNEL IS A CHANNEL (Peter, 2026-08-07: «the whatsapp thing doesnt matter. that's a
    # channel. a channel is also the test chat channel»). The TENANT's live state is its own —
    # `status='live'` — and each channel reports its own arming separately. Conflating the two
    # made the whole desk wear «EN PRUEBAS» because Meta had not answered, which says the wrong
    # thing about a business already taking orders through another door.
    tenant_live = bool(t and t["status"] == "live")
    wa_live = bool(tenant_live and t["wa_id"])
    return {
        "tenant_live": tenant_live,
        "whatsapp": {
            "state": "live" if wa_live else "waiting_meta",
            "today": int(today_wa),
            "last_event": (f"{last['customer_name']} · {last['created_at'].strftime('%H:%M')}"
                           if last else ""),
        },
        "email": await _email_channel_state(slug),
        "order_links": {"state": "ready_behind"},
        "calls": {"state": "parked_twilio"},
    }


async def _email_channel_state(slug: str) -> dict:
    """The EMAIL channel, told truthfully instead of asserted.

    It said `state: "alias_ready"` as a literal, which was true the day it was written and has
    been an understatement ever since: MX for in.soyrocoto.com is live, Resend receives, the
    svix-signed webhook lands rows in `inbound_mail`, and BUILD-CONCERNS #17 («inbound mail is not
    wired») is stale. A channel that is actually receiving should not describe itself as waiting.

    `state` is now derived from whether anything has ever ARRIVED, which is the only honest
    definition of a live intake — and the counts give the page something to show instead of a
    promise. Peter, 2026-08-17: «an email that's for them on our domain, with an inbox that we
    can follow.» There is deliberately no mailbox (§17.47b: what arrives becomes rows on the
    surface it belongs to), so «following it» means seeing what landed and where it went.
    """
    import mail_inbound as _mail
    out = {"alias": f"pedidos.{slug}@in.soyrocoto.com",
           "aliases": [{"purpose": p, "address": f"{p}.{slug}@in.soyrocoto.com"}
                       for p in _mail.PURPOSES],
           "domain": _mail.INBOUND_DOMAIN,
           "state": "alias_ready", "today": 0, "total": 0, "last_event": ""}
    try:
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select count(*) filter (where received_at >= date_trunc('day', now())) as today, "
                "       count(*) as total, max(received_at) as last "
                "from inbound_mail where tenant_id = $1", slug)
        if row:
            out["today"] = int(row["today"] or 0)
            out["total"] = int(row["total"] or 0)
            if out["total"]:
                out["state"] = "live"
                out["last_event"] = row["last"].strftime("%H:%M") if row["last"] else ""
    except Exception:
        # Fail-soft to the alias-only shape: the ADDRESS is deterministic and always true, so a
        # counting hiccup must never make the channel look unavailable.
        log.debug("email channel state fail-soft for %s", slug, exc_info=True)
    return out


# ── §17.46/§17.51 · CÓMO ACTÚA — the behaviour settings (WP-D7, G2's UI wire) ────────────────
@router.get("/behaviour")
async def sup_behaviour_get(ctx: dict = Depends(require_cap("read"))):
    """The tenant's S — §17.51's frozen vocabulary, verbatim."""
    import behaviour
    return {"s": await behaviour.get(ctx["tenant_slug"])}


@router.post("/behaviour")
async def sup_behaviour_set(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Patch S. admin:rocoto — the OFFICE runs the employee's settings (§17.34); this is the first
    endpoint born on the split cap rather than retargeted onto it.

    The kernel returns (before, after) and the AUDIT HAPPENS HERE, where the actor exists —
    behaviour.py is kernel and may not import the desk's session module (vital_kernel_boundary).
    """
    import behaviour
    changes = {k: v for k, v in (payload or {}).items() if isinstance(v, str)}
    try:
        before, after = await behaviour.set_keys(ctx["tenant_slug"], **changes)
    except ValueError as e:
        raise _err(400, "bad_setting", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "behaviour.set",
                            detail={"before": before, "after": after, "changed": sorted(changes)})
    return {"s": after}


# ── §17.30b.4 · LO QUE SABE — the employee's memory, with provenance (WP-D7) ─────────────────
#
# The page's law is the board's footer: «every one carries where it came from — an order, a
# correction, an upload. Nothing here was invented.» So the wire only serves what a REAL store
# holds, each with its real source, and the counters are honest zeros on day one:
#
#   apodos       sku_aliases the runtime LEARNED (tap/correction) — never the shipped vocabulary
#                projection (`source in ('seed','golive','create')` is machinery, not memory)
#   costumbres   the habit engine's ARMED set — derived from orders, ≥0.8 confidence (§17.30g);
#                below the bar it does not exist, so it is not counted
#   notas        `fact` rows current for this tenant (invalid_at is null)
#   correcciones sup_audit rows where the boss TOLD it something — the teaching subset of the
#                audit trail, not the whole trail (order.status/approve is work, not teaching)
CORRECTION_ACTIONS = ("behaviour.set", "customer.price", "customer.window", "order.window",
                      "order.lines", "customer.erp_code", "customer.nota", "brain.forget")

# machinery vocabularies — the catalogue projection & import writers, not learned memory
_ALIAS_MACHINE_SOURCES = ("seed", "golive", "create")


def _scope_phone(scope: str) -> str:
    """`wa.34600111222` / `t.<slug>.wa.34600111222` → the digits, or '' for non-wa scopes."""
    parts = str(scope or "").split(".")
    return parts[-1] if len(parts) >= 2 and parts[-2] == "wa" and parts[-1].isdigit() else ""


@router.get("/brain")
async def sup_brain(ctx: dict = Depends(require_cap("read"))):
    from brain import habits as _habits
    slug = ctx["tenant_slug"]

    async with db.get_pool().acquire() as con:
        armed = [h for h in await _habits.habits(con, slug) if h.get("armed")]
        aliases = await con.fetch(
            "select a.id, a.alias, a.phone_number, a.source, a.created_at, s.name as sku_name "
            "from sku_aliases a left join catalogue_skus s "
            "  on s.tenant_id = a.tenant_id and s.id = a.sku_id "
            "where a.tenant_id = $1 and a.source <> all($2::text[]) "
            "order by a.created_at desc limit 24", slug, list(_ALIAS_MACHINE_SOURCES))
        apodos_total = await con.fetchval(
            "select count(*) from sku_aliases where tenant_id = $1 and source <> all($2::text[])",
            slug, list(_ALIAS_MACHINE_SOURCES)) or 0
        correcciones = await con.fetchval(
            "select count(*) from sup_audit where tenant_slug = $1 and action = any($2::text[]) "
            "and result = 'ok'", slug, list(CORRECTION_ACTIONS)) or 0
        inventory_on = bool(await con.fetchval(
            "select inventory_enabled from tenants where slug = $1", slug))

    async with db.control_pool().acquire() as con:
        facts = await con.fetch(
            "select f.id, f.kind, f.text, f.created_at, f.scope::text as scope from fact f "
            "join scope_node n on n.scope = f.scope "
            "where n.tenant_slug = $1 and f.invalid_at is null "
            "order by f.created_at desc limit 24", slug)
        notas_total = await con.fetchval(
            "select count(*) from fact f join scope_node n on n.scope = f.scope "
            "where n.tenant_slug = $1 and f.invalid_at is null", slug) or 0

    # party names for whatever the rows point at, one lookup
    phones = sorted({p for p in
                     ([r["phone_number"] for r in aliases] +
                      [_scope_phone(r["scope"]) for r in facts]) if p})
    names: dict = {}
    if phones:
        async with db.get_pool().acquire() as con:
            names = {r["phone_number"]: (r["display_name"] or "") for r in await con.fetch(
                "select phone_number, display_name from customer_profiles "
                "where tenant_id = $1 and phone_number = any($2::text[])", slug, phones)}

    _MES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")

    def _when(dt) -> str:
        # es-ES by hand — strftime('%b') answers in the box's C locale, and the wire speaks Spanish
        local = dt.astimezone()
        return f"{local.day} {_MES[local.month - 1]}" if dt else ""

    newest = []
    for a in aliases:
        who = names.get(a["phone_number"] or "", "")
        newest.append({
            "ref": f"alias:{a['id']}",
            "text": f"«{a['alias']}» es {a['sku_name'] or 'un artículo que ya no está en la lista'}",
            # provenance, the board's sentence: a tap answer carries the customer whose order
            # taught it; one learned in the rehearsal room says so instead
            "sub": (f"{who} · aprendido del pedido del {_when(a['created_at'])}" if who
                    else f"aprendido en el chat de pruebas · {_when(a['created_at'])}"),
            "when": a["created_at"].isoformat(),
            "forgettable": True,
        })
    KIND_ES = {"CONSTRAINT": "condición", "COMMERCIAL": "dato comercial", "RHYTHM": "ritmo",
               "PREFERENCE": "preferencia", "RELATION": "quién es quién", "EVENT_FACT": "hecho"}
    for f in facts:
        who = names.get(_scope_phone(f["scope"]), "")
        newest.append({
            "ref": f"fact:{f['id']}",
            "text": f["text"],
            "sub": " · ".join(x for x in (who, KIND_ES.get(f["kind"], f["kind"].lower()),
                                          _when(f["created_at"])) if x),
            "when": f["created_at"].isoformat(),
            "forgettable": True,
        })
    newest.sort(key=lambda r: r["when"], reverse=True)

    import sync as _sync
    return {
        "as_of": await _sync.head(slug),
        "counters": {"apodos": int(apodos_total), "costumbres": len(armed),
                     "notas": int(notas_total), "correcciones": int(correcciones)},
        "total": int(apodos_total) + len(armed) + int(notas_total),
        "newest": newest[:8],
        "inventory_on": inventory_on,
    }


@router.post("/brain/forget")
async def sup_brain_forget(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """OLVIDAR (§17.51 glossary) — the one verb on the memory page.

    A fact is never deleted: `invalid_at = now()` keeps it as history (the schema's own law), so
    «it will not be relearned from old messages» is true — the row exists and is no longer current.
    A learned alias IS deleted: it has no validity interval, and the learner only writes a new row
    on a fresh tap, never by re-reading old messages. Both are audited as `brain.forget` — non-PII
    like every sup_audit row (the ref and the source, never the remembered text)."""
    ref = str((payload or {}).get("ref") or "")
    kind, _, sid = ref.partition(":")
    if kind not in ("alias", "fact") or not sid.isdigit():
        raise _err(400, "bad_ref", "Eso no es algo que pueda olvidar.")
    slug = ctx["tenant_slug"]
    if kind == "alias":
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "delete from sku_aliases where id = $1 and tenant_id = $2 "
                "and source <> all($3::text[]) returning sku_id, source",
                int(sid), slug, list(_ALIAS_MACHINE_SOURCES))
        if not row:
            raise _err(404, "gone", "Eso ya no está en su memoria.")
        detail = {"what": "alias", "sku_id": row["sku_id"], "source": row["source"]}
    else:
        async with db.control_pool().acquire() as con:
            row = await con.fetchrow(
                "update fact f set invalid_at = now() from scope_node n "
                "where f.id = $1 and n.scope = f.scope and n.tenant_slug = $2 "
                "and f.invalid_at is null returning f.kind", int(sid), slug)
        if not row:
            raise _err(404, "gone", "Eso ya no está en su memoria.")
        detail = {"what": "fact", "kind": row["kind"]}
    await sup_session.audit(ctx["actor_email"], slug, ctx.get("ip") or "",
                            "brain.forget", target_id=ref, detail=detail)
    return {"ok": True, "ref": ref}


# ── §17.38 · MÓDULOS — products as entitlement, never as apps (WP-D7) ────────────────────────
@router.get("/products")
async def sup_products(ctx: dict = Depends(require_cap("read"))):
    """The P map — every product's state in one call (`entitlement.all_states`)."""
    from brain import entitlement
    return {"products": await entitlement.all_states(ctx["tenant_slug"])}


@router.post("/products/{product}")
async def sup_product_toggle(product: str, payload: dict,
                             ctx: dict = Depends(require_cap("admin:negocio"))):
    """Flip a module. admin:negocio — «each has its own price, added to your subscription»: a
    switch that costs money belongs to the owner (§17.34), like billing and golive.

    ON asks for LIVE and lets the kernel apply §17.9's wall (a product cannot be live under a
    tenant that is not — it lands as TEST and arms itself the day the tenant goes live). The
    kernel writes the spine event; the audit here records the ACTOR, which the kernel cannot."""
    from brain import entitlement
    want_on = bool((payload or {}).get("on"))
    slug = ctx["tenant_slug"]
    before = await entitlement.state(product, slug)
    try:
        after = await entitlement.set_state(
            product, entitlement.LIVE if want_on else entitlement.OFF,
            slug, actor=f"web:{ctx['actor_email']}")
    except ValueError as e:
        raise _err(400, "bad_product", str(e))
    await sup_session.audit(ctx["actor_email"], slug, ctx.get("ip") or "",
                            "product.toggle", target_id=product,
                            detail={"before": before, "after": after})
    return {"product": product, "state": after}


# ── §17.48b · THE COPILOT — our agent loop over the ONE verb registry (WP-D10) ───────────────
COPILOT_SYSTEM = """Eres Rocoto, el copiloto del panel — el mismo empleado, en su mesa de configuración.
Hablas es-ES, de tú, frases cortas, sin jerga. El que te escribe dirige una distribuidora de
alimentación y este panel es su negocio.

LAS REGLAS:
· Para LEER el estado usas las herramientas read_* — nunca inventes un dato que puedes leer.
· Para CAMBIAR algo usas la herramienta del cambio — el cambio NO se aplica: queda como
  BORRADOR y el jefe lo acepta o lo rechaza en el panel. Después de proponerlo, dilo así:
  «te lo dejo como borrador — nada cambia hasta que lo aceptes».
· Si no hay verbo para lo que piden, dilo con honestidad y di dónde se hace a mano.
· Nunca prometas que algo «ya está hecho» — tú propones, él decide.
· TEXTO PLANO SIEMPRE: nada de markdown, ni asteriscos, ni tablas, ni almohadillas. El panel
  pinta tu texto tal cual. Una lista se hace con guiones y ya."""

COPILOT_MODEL = os.environ.get("COPILOT_MODEL", "claude-sonnet-4-6")


@router.post("/copilot")
async def sup_copilot(payload: dict, ctx: dict = Depends(require_cap("read"))):
    """One copilot turn. The loop runs READ verbs inline; every CHANGE verb becomes a
    config_draft row — §17.48b's mechanical «nothing changes until you accept it»."""
    import anthropic

    import sup_verbs
    slug = ctx["tenant_slug"]
    msgs = [{"role": str(m.get("role")), "content": str(m.get("content") or "")}
            for m in (payload or {}).get("messages", [])
            if m.get("role") in ("user", "assistant") and str(m.get("content") or "").strip()]
    if not msgs or msgs[-1]["role"] != "user":
        raise _err(400, "bad_messages", "Falta tu mensaje.")
    msgs = msgs[-16:]

    client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=2,
                                      timeout=45.0)
    drafts: list[dict] = []
    text = ""
    try:
        for _ in range(5):
            resp = await client.messages.create(
                model=COPILOT_MODEL, max_tokens=700, system=COPILOT_SYSTEM,
                tools=sup_verbs.anthropic_tools(), messages=msgs)
            turn_text = "".join(getattr(b, "text", "") for b in resp.content
                                if getattr(b, "type", None) == "text").strip()
            if turn_text:
                text = turn_text  # keep the last thing it actually said (agent_reply's lesson)
            tools_used = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
            if not tools_used:
                break
            msgs.append({"role": "assistant", "content": resp.content})
            results = []
            for tu in tools_used:
                verb = sup_verbs.REGISTRY.get(tu.name)
                args = dict(tu.input or {})
                if not verb:
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "is_error": True, "content": "Ese verbo no existe."})
                elif verb["kind"] == "read":
                    try:
                        r = await verb["read"](slug, args)
                        results.append({"type": "tool_result", "tool_use_id": tu.id,
                                        "content": json.dumps(r, ensure_ascii=False, default=str)})
                    except Exception as e:  # noqa: BLE001
                        results.append({"type": "tool_result", "tool_use_id": tu.id,
                                        "is_error": True, "content": f"No he podido leerlo: {e}"})
                else:
                    d = await sup_verbs.stage_draft(slug, tu.name, args,
                                                    f"copilot:{ctx['actor_email']}")
                    drafts.append(d)
                    results.append({"type": "tool_result", "tool_use_id": tu.id,
                                    "content": f"Borrador #{d['id']} creado: {d['summary']}. "
                                               "NO está aplicado — el jefe lo acepta en el panel."})
            msgs.append({"role": "user", "content": results})
    except anthropic.APIError as e:
        log.exception("copilot turn failed")
        raise _err(502, "copilot_down", "El copiloto no responde ahora mismo — inténtalo en un momento.") from e
    await _audit_read(ctx, "copilot.turn", detail={"chars_in": len(msgs[-1]["content"]) if isinstance(msgs[-1]["content"], str) else 0,
                                                   "drafts": [d["id"] for d in drafts]})
    return {"text": text, "drafts": drafts}


@router.get("/copilot/drafts")
async def sup_copilot_drafts(ctx: dict = Depends(require_cap("read"))):
    import sup_verbs
    return {"drafts": await sup_verbs.pending_drafts(ctx["tenant_slug"])}


@router.post("/copilot/drafts/{draft_id}")
async def sup_copilot_decide(draft_id: int, payload: dict,
                             ctx: dict = Depends(require_cap("read"))):
    """Accept or reject a draft. The VERB's own cap walls the accept (checked against the
    acceptor, §17.34) — the endpoint cap is read because rejecting needs no more than a seat."""
    import sup_verbs
    accept = bool((payload or {}).get("accept"))
    try:
        caps = list(sup_session.ROLE_CAPS.get(ctx["role"], frozenset()))
        out = await sup_verbs.decide_draft(ctx["tenant_slug"], int(draft_id), accept,
                                           ctx["actor_email"], ctx.get("ip") or "", caps)
    except LookupError as e:
        raise _err(404, "gone", str(e))
    except PermissionError as e:
        raise _err(403, "cap_missing", str(e))
    except ValueError as e:
        raise _err(400, "bad_draft", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "copilot.decide", target_id=str(draft_id),
                            detail={"accept": accept})
    return out


# ── §5.8a · THE REVIEW SHEET on the wire (Chats' unread join; the client contract's list) ────
@router.get("/review")
async def sup_review(ctx: dict = Depends(require_cap("read"))):
    """The parked matters, tenant-scoped — the SAME set Home's «Te esperan» counts (avisos
    excluded there and here: one number, never two truths — §17.52's unread law)."""
    import app as _app
    items = [it for it in await _app.review_sheet_for_tenant(ctx["tenant_slug"])
             if it.get("review_source") != "aviso"]
    return {"items": items}


# ── §17.23 · AVISOS — who gets told what, on which rail (WP-D7) ──────────────────────────────
#
# The law: an aviso is a PROJECTION of a spine event, never a second stream. So this wire has a
# routing table (who/where per MOMENT, defaults-first) and a read-time projection of the recent
# moments through that routing — the «would-have» chips §17.23 promises under the egress sandbox.
# Nothing here records avisos; ticking a rail visibly changes the projection, which is exactly
# the observable effect the surface needs while real dispatch waits for the go-live lane.
AVISO_DEFAULTS = {
    # §17.23's table, verbatim: the loudest default is the dead channel; a new order is silence.
    "revision": {"rail_app": True, "rail_wa": False, "rail_email": False},
    "duda": {"rail_app": True, "rail_wa": True, "rail_email": False},
    "canal_caido": {"rail_app": False, "rail_wa": True, "rail_email": True},
    "pedido_nuevo": {"rail_app": False, "rail_wa": False, "rail_email": False},
}


async def _aviso_routing(slug: str) -> dict:
    routing = {m: dict(d) for m, d in AVISO_DEFAULTS.items()}
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select moment, rail_app, rail_wa, rail_email from aviso_routing where tenant_id=$1",
            slug)
    for r in rows:
        if r["moment"] in routing:
            routing[r["moment"]] = {"rail_app": r["rail_app"], "rail_wa": r["rail_wa"],
                                    "rail_email": r["rail_email"]}
    return routing


@router.get("/avisos")
async def sup_aviso_routing(ctx: dict = Depends(require_cap("read"))):
    import app as _app
    slug = ctx["tenant_slug"]
    routing = await _aviso_routing(slug)

    # the projection: recent review moments through the routing — would-have chips, newest first
    held = await _app.review_sheet_for_tenant(slug)
    would = []
    for it in held[:6]:
        # a timed-out doubt IS «una duda es para ti» — the customer didn't answer, so it lands
        # on the boss (§17.6's routing); everything else on the sheet is a review moment
        moment = "duda" if it.get("review_source") in ("doubt", "timeout") else "revision"
        rails = routing[moment]
        on = [n for n, k in (("la app", "rail_app"), ("WhatsApp", "rail_wa"),
                             ("email", "rail_email")) if rails[k]]
        would.append({
            "moment": moment,
            "when": it.get("created_at"),
            "what": (it.get("why") or "")[:140],
            "sent": (f"aviso que se habría enviado: {' y '.join(on)} al propietario" if on
                     else "ningún aviso — este momento no tiene casilla marcada"),
        })
    return {"routing": routing, "would_have": would}


@router.post("/avisos/{moment}")
async def sup_avisos_set(moment: str, payload: dict,
                         ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Tick/untick rails for one moment. admin:rocoto — routing the employee's voice is running
    the employee (§17.34), same cap as Cómo actúa."""
    if moment not in AVISO_DEFAULTS:
        raise _err(400, "bad_moment", "Ese momento no existe.")
    rails = {k: bool((payload or {}).get(k)) for k in ("rail_app", "rail_wa", "rail_email")}
    slug = ctx["tenant_slug"]
    before = (await _aviso_routing(slug))[moment]
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into aviso_routing(tenant_id, moment, rail_app, rail_wa, rail_email, updated_by) "
            "values($1,$2,$3,$4,$5,$6) on conflict (tenant_id, moment) do update set "
            "rail_app=$3, rail_wa=$4, rail_email=$5, updated_at=now(), updated_by=$6",
            slug, moment, rails["rail_app"], rails["rail_wa"], rails["rail_email"],
            ctx["actor_email"])
    await sup_session.audit(ctx["actor_email"], slug, ctx.get("ip") or "",
                            "aviso.routing", target_id=moment,
                            detail={"before": before, "after": rails})
    return {"moment": moment, **rails}


# ── §17.19 · TEST CHAT — the rehearsal room (WP-D6) ──────────────────────────────────────────
@router.post("/testchat")
async def sup_testchat(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """One rehearsal turn: the persona's message → THE REAL runtime (mind, memory, tabs, gate all
    run for real) on a lineage=test scope with EGRESS STUBBED — nothing can reach a real person,
    and nothing lands in a real customer's memory. The same seam the Control Room's persona
    console uses (control_room.persona_send), scoped to the CALLER'S tenant.

    {session, text, persona?} → {reply, actions}. The scope is test.sup.<digits(session)>, so the
    §17.9 wall is the SHAPE of the scope, not a flag someone remembers.
    """
    import re as _re

    import runtime

    text = str(payload.get("text") or "").strip()
    if not text:
        raise _err(400, "text_required")
    sess = _re.sub(r"[^0-9a-f]", "", str(payload.get("session") or ""))[:24] or "0"
    persona = str(payload.get("persona") or "Bar Paco").strip()[:60]
    # a stable fake phone per session keeps the persona's memory coherent across the rehearsal
    digits = "9" + "".join(c for c in sess if c.isdigit())[:8].ljust(8, "0")
    # THE TENANT RIDES IN THE SCOPE. `test.sup.{digits}` had no rung in `tenancy.tenant_of`, so it
    # fell through to BRAIN_TENANT and every rehearsal on every account was grounded against the
    # founder's catalogue — see that function's note. Passing `tenant=` to `run_turn` was never
    # enough: the readers underneath it (the matcher, the behaviour lookups, the house style) each
    # resolve the tenant from the SCOPE STRING, and a string that cannot answer will always be
    # answered by the default.
    scope = f"test.sup.t.{ctx['tenant_slug']}.{digits}"

    async def _stub_call(phone, lang="es", name=""):
        return {"token": "test", "sid": "TEST-STUB", "status": "would_call"}

    async with db.scoped_tx(scope) as con:
        await con.execute(
            "insert into scope_node(scope,tier,tenant_slug,lineage) "
            "values($1::ltree,'customer',$2,'test') on conflict do nothing", scope, ctx["tenant_slug"])
        await con.execute(
            "insert into card(scope,body,version,lineage) values($1::ltree,$2,0,'test') "
            "on conflict do nothing", scope, f"FICHA — {persona} · inventado en el ensayo")
    out = await runtime.run_turn(digits, text, place_call_fn=_stub_call,
                                 scope_override=scope, egress_stub=True,
                                 tenant=ctx["tenant_slug"])
    return {"reply": out.get("text", ""), "actions": out.get("actions", []),
            "suppressed": out.get("suppressed", False)}


@router.get("/docs/prefs")
async def sup_doc_prefs_get(ctx: dict = Depends(require_cap("read"))):
    """R6 · the print modal's remembered options ({lot,tick,price,sig})."""
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow("select opts from doc_prefs where tenant_slug=$1", ctx["tenant_slug"])
    return {"opts": _jdict(r["opts"]) if r else {}}


@router.post("/docs/prefs")
async def sup_doc_prefs_set(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """Persist the print options per tenant — only the four known keys, booleans only."""
    allowed = {k: bool(v) for k, v in (payload or {}).items() if k in ("lot", "tick", "price", "sig")}
    async with db.get_pool().acquire() as con:
        # the pool's jsonb codec encodes dicts itself — a pre-dumped string double-encodes
        # and the GET then 500s (R8, traceback-confirmed)
        await con.execute(
            "insert into doc_prefs(tenant_slug, opts, updated_at) values($1, $2::jsonb, now()) "
            "on conflict (tenant_slug) do update set opts = doc_prefs.opts || excluded.opts, updated_at = now()",
            ctx["tenant_slug"], allowed)
    await _audit_read(ctx, "docs.prefs", detail=allowed)
    return {"ok": True}


@router.get("/zones")
async def sup_zones(ctx: dict = Depends(require_cap("read"))):
    """§17.30d — DELIVERY AREAS. The rule as it stands (radius or zones), the depot the map opens
    on, and every located customer so the drawing can be judged against the people it decides for."""
    from brain import range as brain_range
    async with db.get_pool().acquire() as con:
        rng = await brain_range.get_range(con, ctx["tenant_slug"])
        sv = await brain_range.servable_customers(con, ctx["tenant_slug"])
    def _pin(c: dict, servable: bool) -> dict:
        return {"phone": c.get("phone_number"), "name": c.get("name"),
                "lat": c.get("lat"), "lon": c.get("lon"),
                "servable": servable, "zone": c.get("zone"),
                "distance_km": c.get("distance_km")}
    pins = ([_pin(c, True) for c in (sv.get("inside") or [])]
            + [_pin(c, False) for c in (sv.get("outside") or [])])
    return {"range": rng, "customers": pins,
            "counts": {"inside": len(sv.get("inside") or []),
                       "outside": len(sv.get("outside") or []),
                       "unplaced": len(sv.get("unplaced") or [])}}


@router.post("/zones")
async def sup_zones_set(payload: dict, ctx: dict = Depends(require_cap("admin:negocio"))):
    """Save the drawing (kind='zones') or go back to a radius (kind='radius'). Owner-only: where
    you deliver decides which orders hold, and §17.34 puts that with Mi negocio."""
    from brain import range as brain_range
    p = payload or {}
    kind = str(p.get("kind") or "zones")
    async with db.get_pool().acquire() as con:
        try:
            if kind == "radius":
                out = await brain_range.set_range(
                    con, ctx["tenant_slug"], p.get("range_km"),
                    depot_lat=p.get("depot_lat"), depot_lon=p.get("depot_lon"),
                    depot_label=str(p.get("depot_label") or ""))
            else:
                out = await brain_range.set_zones(
                    con, ctx["tenant_slug"], p.get("zones") or [],
                    depot_lat=p.get("depot_lat"), depot_lon=p.get("depot_lon"),
                    depot_label=str(p.get("depot_label") or ""))
        except ValueError as e:
            raise _err(400, "bad_range", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "range.set", detail={"kind": kind,
                                                 "zones": len(p.get("zones") or [])})
    return out


@router.get("/inbound")
async def sup_inbound(ctx: dict = Depends(require_cap("read"))):
    """§17.47b — the tenant's inbound ADDRESSES (built-in + the ones minted by describing them
    to the copilot) and the last rows that arrived. There is no inbox: a row is what an address
    produces, and it lives on the surface its purpose belongs to."""
    import sup_verbs
    return await sup_verbs.REGISTRY["read_inbound"]["read"](ctx["tenant_slug"], {})


@router.post("/voice/transcribe")
async def sup_voice_transcribe(request: Request, ctx: dict = Depends(require_cap("act"))):
    """R1 · the panel composer's voice rail: the recorded note (raw body, webm/ogg/mp4) → the SAME
    Deepgram nova-3 + polish pipeline WhatsApp audio rides (app.py's inbound rail, transcribe.py).
    Returns the words; the SURFACE decides what they are (dictation lands in the input for
    review-before-send; Test Chat treats them as the customer's voice note). Raw body on purpose —
    no multipart parser dependency, and the recorder's own content-type travels with the bytes."""
    import transcribe as tx

    audio = await request.body()
    if not audio:
        raise _err(400, "audio_required")
    if len(audio) > 15 * 1024 * 1024:
        raise _err(413, "audio_too_big", "La nota es demasiado larga — prueba con una más corta.")
    ct = (request.headers.get("content-type") or "audio/webm").split(";")[0].strip()
    try:
        dg = await tx.deepgram_diarize(audio, ct)
        raw, utts = tx.parse_utterances(dg)
        # a dictated note is ONE voice, always — the ASR sometimes hallucinates a second
        # speaker out of room noise, so the labels are dropped unconditionally (Peter: the
        # composer must never surface «Speaker 0»)
        raw = " ".join(u["text"] for u in utts if u["text"]) or raw
        polished = await asyncio.to_thread(tx.polish_sync, raw)
    except Exception as e:  # noqa: BLE001 — the composer needs ONE honest failure shape
        log.exception("voice transcribe failed")
        raise _err(502, "transcribe_failed",
                   "No he podido transcribir la nota — inténtalo otra vez.") from e
    text = (polished or raw or "").strip()
    await _audit_read(ctx, "voice.transcribe", detail={"bytes": len(audio), "chars": len(text)})
    return {"text": text}


# ── §17.30f · HOME IS TRIAGE (WP-D1) ─────────────────────────────────────────────────────────
@router.get("/home")
async def sup_home(ctx: dict = Depends(require_cap("read"))):
    """Home's four questions in ONE call, because §17.30h composes them as one grid and four
    round-trips would give four moments-in-time that disagree.

        day    — the masthead (§17.30i): today's €, confirmed count, the usual-by-now caption and
                 yesterday-at-close, from the SAME baseline that arms the ghost slots («one
                 baseline, two surfaces — never two models for one truth», §17.30g).
        held   — the dockets: the same review_sheet_for_tenant rows the PHONE renders, so the
                 desk and the app can never tell two different stories.
        quiet  — the population (§17.30g): aggregate first, top-K≤3 as evidence, ranked by
                 usual-€ × lateness; the worklist door is Clientes.
        brain  — the note's raw numbers. The first-person prose is D-lane UI; these are facts.

    A1 tail (2026-08-07): the fence is OFF — the orders half reads `db.order_list(tenant=)` and
    the habits/review/facts halves were tenant-scoped by construction. A fresh tenant's Home is
    an honest empty day, never a 403.
    """
    from datetime import datetime, timedelta, timezone

    import app as _app
    from brain import habits as _habits

    slug = ctx["tenant_slug"]
    now = datetime.now(timezone.utc)
    # HER «HOY», NOT UTC's. This masthead used to cut the day at UTC midnight, which is 02:00 in
    # Madrid in summer — so between midnight and two the count on Home was a DIFFERENT day from the
    # one the desk was printing, and from the one the brain files «mañana» against (business_day.py,
    # written for Raquel's 00:30 orders). Three definitions of «today» in one product is two too
    # many; this was the last one. Fail-soft inside `for_tenant`, so a settings hiccup shows the
    # right day rather than no day.
    try:
        _bd_cfg = business_day.parse_settings((await db.settings_get(slug) or {}).get(business_day.SETTING_KEY))
    except Exception:
        # fail-soft exactly as `business_day.for_tenant` does: a settings hiccup must not move
        # everybody's day by one
        log.debug("home: business_day settings unavailable for %s", slug, exc_info=True)
        _bd_cfg = business_day.parse_settings(None)
    bd = business_day.today(now, tz=_bd_cfg["tz"], rollover_hour=_bd_cfg["rollover_hour"])
    today = bd.isoformat()
    yesterday = (bd - timedelta(days=1)).isoformat()

    rows = await db.order_list(None, tenant=slug)
    def _day_of(o):
        return str(o.get("delivery_date") or str(o.get("created_at") or "")[:10])
    def _eur(o):
        """An order's €: the snapshot when it exists, else RE-SUMMED FROM ITS LINES — §17.30r's
        law («totals always re-sum from lines») doubling as the fallback, because the seeded world
        and any order priced per-line carry no snapshot. Never 0-because-unreadable without trying
        the lines first: a masthead that shows 0,00 € over a day of priced orders is a lie."""
        try:
            v = o.get("value_snapshot_cents")
            if v is not None:
                return int(v) / 100.0
        except Exception:
            pass
        total = 0.0
        for ln in (o.get("lines") or []):
            try:
                lt = ln.get("line_total")
                if lt is not None:
                    total += float(lt)
            except Exception:
                continue
        return round(total, 2)
    todays = [o for o in rows if _day_of(o) == today]
    yesterdays = [o for o in rows if _day_of(o) == yesterday]
    confirmed = [o for o in todays if o.get("status") in ("approved", "sent")]

    async with db.get_pool().acquire() as con:
        quiet = await _habits.quiet_now(con, slug, now)
        usual = await _habits.usual_by_now(con, slug, now)

    held = [it for it in await _app.review_sheet_for_tenant(slug) if it.get("review_source") != "aviso"]

    async with db.control_pool().acquire() as con:
        facts = await con.fetchval(
            "select count(*) from fact f join scope_node n on n.scope = f.scope "
            "where n.tenant_slug = $1 and f.invalid_at is null", slug) or 0
        facts_week = await con.fetchval(
            "select count(*) from fact f join scope_node n on n.scope = f.scope "
            "where n.tenant_slug = $1 and f.invalid_at is null "
            "and f.created_at > now() - interval '7 days'", slug) or 0

    import sync as _sync
    return {
        "as_of": await _sync.head(slug),
        "day": {
            "date": today,
            "in_count": len(todays),
            "confirmed_count": len(confirmed),
            "eur_today": round(sum(_eur(o) for o in confirmed), 2),
            "yesterday_close_eur": round(sum(_eur(o) for o in yesterdays
                                             if o.get("status") in ("approved", "sent")), 2),
            "usual_by_now": usual,
        },
        "held": held[:10],
        # «Te esperan 10» when 63 are waiting is a lie the desk cannot detect (2026-08-19 audit):
        # two surfaces counted the CAPPED array. The total travels beside it now.
        "held_total": len(held),
        "quiet": quiet,
        "brain": {"facts": int(facts), "facts_week": int(facts_week)},
        "setup": await _setup_state(ctx["tenant_slug"]),
        # THE DAY BOUNDARY TRAVELS WITH THE DAY. The desk used to cut «hoy» at the BROWSER's
        # midnight (lib/format.ts todayIso) while the brain cut it at the tenant's rollover — so
        # between midnight and six the day-locked desk and the filing rail disagreed, which is
        # exactly Raquel's 00:30 order landing on a sheet she is not printing. One definition,
        # computed here, read there.
        "business_day": {"today": today, "tz": _bd_cfg["tz"], "rollover_hour": _bd_cfg["rollover_hour"]},
    }


async def _setup_state(tenant: str) -> dict:
    """THE ONBOARDING CHECKLIST, derived from real rows (Peter, 2026-08-19: «do we also have an
    onboarding checklist that actually works just like Stripe's»).

    EVERY STEP IS A QUESTION ABOUT THE WORLD, never a stored flag. «Has this tenant a catalogue»
    is `does catalogue_skus hold rows`, not «did somebody press done» — because the second drifts
    the moment anyone uploads outside the wizard, deletes their list, or resumes on another
    machine. That is the same split-truth that made the chat refuse orders while the UI showed a
    green catalogue (demo_flow.workspace_ready), and it is the reason Stripe's own checklist feels
    trustworthy: it reflects the account, it does not remember a click.

    It is therefore RESUMABLE for free: leave halfway, come back on another laptop, and the list
    knows exactly where you are because it re-derives it.

    Fail-soft per step — a step that cannot be read reports itself undone rather than taking the
    whole panel down, and undone is the safe direction: it invites an action that is idempotent."""
    async def _has(sql: str, *args) -> bool:
        try:
            async with db.get_pool().acquire() as con:
                return bool(await con.fetchval(sql, *args))
        except Exception:
            log.debug("setup step read fail-soft (%s)", sql[:40], exc_info=True)
            return False

    catalogue = await _has("select exists(select 1 from catalogue_skus where tenant_id=$1)", tenant)
    customers = await _has("select exists(select 1 from contact where tenant_slug=$1)", tenant)
    orders_in = await _has("select exists(select 1 from orders where tenant_id=$1)", tenant)
    # A DEMO CANNOT PUT A ROW IN `orders`, so its own step may not ask for one. The only writers of
    # that table are the queue drainer (brain/pipeline), the portal reorder and the storefront —
    # all of them behind a live inbound rail, which is exactly what a demo is fenced from. The
    # rehearsal room parks an `action` instead (orders_tool.place_order never touches `orders`), so
    # the honest question for a demo is «did Rocoto act on something you said», and that is a row
    # it CAN produce. Asking for the other one shipped a step that could never be ticked, on a
    # checklist that only disappears at done >= total — a ring stuck at 2/3 for ever, which is the
    # same «asking for something they cannot do» this plan-aware ladder exists to stop.
    rehearsed = await _has(
        "select exists(select 1 from action a join scope_node n on n.scope = a.scope "
        "where n.tenant_slug=$1 and n.lineage='test')", tenant)
    channel = await _has(
        "select exists(select 1 from channel_number where tenant_id=$1 and status='live')", tenant)
    try:
        import behaviour
        b = await behaviour.get(tenant)
        # «answered» means they have been ASKED — the wizard writes every answer as it is given,
        # so a non-default on any of the three setup questions proves the walk happened.
        behaved = any(b.get(k) != d for k, d in
                      (("stock", "no"), ("approve", "review"), ("offsku", "review")))
    except Exception:
        behaved = False

    # ── WHAT «READY» MEANS DEPENDS ON THE PLAN (Peter, 2026-08-19) ────────────────────────────
    # A demo account is FENCED from connecting WhatsApp (webapp/src/shell/DemoMode.tsx). Listing
    # «Conecta tu WhatsApp» as an undone step for them is asking for something they cannot do —
    # the same species as a control that lies, and the exact opposite of Peter's own rule that a
    # thing «should only be revealed if they set it the best way they can in the settings».
    #
    # So the ladder differs, and the difference is the truth about each plan:
    #   DEMO — the list, how it acts, and an order they wrote themselves in Modo de prueba. That
    #          IS the whole demo: the desk working against their real catalogue.
    #   PAID — everything, because everything is now reachable: their customers, their number, and
    #          a real order arriving from one of them.
    #
    # `plan` is resolved the same way the panel resolves it, so the checklist and the fence can
    # never disagree about what this account is.
    # THE PANEL'S OWN RESOLVER, not a second read of a column I guessed at: `_pedidos_plan_for`
    # already answers shared contract 3's `plan` ('pedidos' | 'empresa' | null), checking the
    # explicitly-set `tenants.plan` first and falling back to an active S/M/L/XL subscription. Two
    # readings of «what plan is this» is how the checklist and the fence would come to disagree.
    paid = False
    try:
        paid = bool(await _hooks["pedidos_plan"](tenant))
    except Exception:
        log.debug("setup: plan read fail-soft for %s", tenant, exc_info=True)

    steps = [
        {"id": "catalogue", "done": catalogue},
        {"id": "behaviour", "done": behaved},
    ]
    if paid:
        steps += [
            {"id": "customers", "done": customers},
            {"id": "channel", "done": channel},
            {"id": "first_order", "done": orders_in},
        ]
    else:
        # a demo's «first order» is one they wrote as their own customer — the thing the demo is FOR
        steps += [{"id": "test_order", "done": rehearsed}]
    return {"steps": steps, "plan": "paid" if paid else "demo",
            "done": sum(1 for s in steps if s["done"]), "total": len(steps)}


# ── §17.39 · THE SYNC RAIL (WP-E2) ───────────────────────────────────────────────────────────
@router.get("/sync/head")
async def sup_sync_head(ctx: dict = Depends(require_cap("read"))):
    """The tenant's spine head. The panel compares its stores' `as_of` to this on reconnect,
    visibilitychange and online — «coming back is DETECTED, never assumed»."""
    import sync
    return {"seq": await sync.head(ctx["tenant_slug"]), "shelves": list(sync.SHELVES)}


@router.get("/sync/stream")
async def sup_sync_stream(request: Request, since: int = 0,
                          ctx: dict = Depends(require_cap("read"))):
    """One SSE connection per session: the head, then ticks with COARSE shelf hints, then beats.

    NOT fenced by `_require_runtime`: it reads `event` joined to `scope_node.tenant_slug`, which is
    tenant-scoped by construction, so it is one of the few surfaces that is already safe for a
    second tenant (audits/2026-08-06-a1-fence-sites.md is the list of the ones that are not).
    """
    from fastapi.responses import StreamingResponse

    import sync
    return StreamingResponse(
        sync.stream(ctx["tenant_slug"], since),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/orders")
async def sup_orders(status: str | None = None, day: str | None = None,
                     ctx: dict = Depends(require_cap("read"))):
    """`day=YYYY-MM-DD` narrows server-side — see db.order_list for why the browser could not."""
    if status and status not in _ORDER_STATUSES:
        raise _err(400, "bad_status")
    if day and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise _err(400, "bad_day")
    # tenant from the SESSION. `_require_runtime` above still refuses any tenant but the box's, so
    # this predicate changes nothing today — it is what makes lifting that fence (Embedded Signup)
    # safe instead of being the leak.
    # A DAY IS NOT A PAGE (2026-08-19 audit). Day-scoping MOVED the 200-row truncation, it did not
    # remove it: `order_list`'s default limit still applied after the day predicate, so Raquel's
    # 500-order morning showed 200 rows, a day total that summed 200, and a pager that said «/200»
    # — with nothing saying a page was missing. A day is a bounded, meaningful unit of her work and
    # she must get all of it; the cap stays only for the unscoped reads that genuinely want a tail.
    orders = await db.order_list(status, tenant=ctx["tenant_slug"], day=day,
                                 limit=2000 if day else 200)
    # §17.32/§17.30k: the payment column exists ONLY when Cobros is on — the wire itself gates
    # (no `payments` key ⇒ the sheet draws no column; never a greyed one).
    from brain import entitlement
    if await entitlement.is_on("cobros", ctx["tenant_slug"]):
        import credit
        states = await credit.payment_states(
            ctx["tenant_slug"], [str(o.get("id")) for o in orders if o.get("id")])
        for o in orders:
            o["payment"] = states.get(str(o.get("id")))
    return {"orders": orders}


@router.post("/chase")
async def sup_chase(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """RECLAMAR — always a draft (§17.32/§17.14.5). Stages a `draft_chase` in the ONE draft
    store; the supplier accepts it in the copilot column (or right where the sheet shows it).
    The amount inside comes from the ledger — this endpoint takes a phone, never a figure."""
    import credit
    import sup_verbs
    p = canon(str((payload or {}).get("phone") or ""))
    if not p:
        raise _err(400, "bad_phone")
    try:
        preview = await credit.chase_text(ctx["tenant_slug"], p)
    except ValueError as e:
        raise _err(400, "nothing_owed", str(e))
    d = await sup_verbs.stage_draft(ctx["tenant_slug"], "draft_chase",
                                    {"phone": p, "text": preview["text"],
                                     "cents": preview["cents"]},
                                    f"sheet:{ctx['actor_email']}")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "chase.draft", target_id=p[-4:],
                            detail={"draft_id": d["id"], "cents": preview["cents"]})
    return {"draft": d, "preview": preview}


@router.get("/orders/excel")
async def sup_orders_excel(date: str | None = None, format: str = "standard",
                           ctx: dict = Depends(require_cap("read"))):
    """On-demand Excel (WEB-ADDS; the daily email cadence stays untouched): the approved/sent orders
    for a delivery day, in the SAME build_excel formats + per-customer column maps the dispatch
    email uses (one column spec, two renderers)."""
    import orders as orders_mod
    if format not in orders_mod.EXCEL_FORMATS:
        format = "standard"
    async with db.get_pool().acquire() as con:
        if date:
            recs = await con.fetch(
                "select * from orders where status in ('approved','sent') and delivery_date = $1 "
                "and tenant_id = $2 order by customer_name, created_at", date, ctx["tenant_slug"])
        else:
            recs = await con.fetch(
                "select * from orders where status in ('approved','sent') and tenant_id = $1 "
                "and coalesce(delivery_date, to_char(created_at,'YYYY-MM-DD')) = to_char(now(),'YYYY-MM-DD') "
                "order by customer_name, created_at", ctx["tenant_slug"])
    rows = [db._ser(r) for r in recs]
    if not rows:
        raise _err(404, "no_orders", "No hay pedidos en firme para ese día.")
    try:
        # the SESSION's tenant: a customer shared with another supplier must yield no code
        # rather than that supplier's (A1 §7.2 — this was one of the two refuted "safe" reads)
        codes = await db.erp_codes_for([str(o.get("phone_number") or "") for o in rows],
                                       tenant=ctx["tenant_slug"])
        for o in rows:
            o["erp_client_code"] = codes.get(str(o.get("phone_number") or ""))
    except Exception:
        log.exception("sup excel: erp-code resolve failed (continuing without codigo_cliente)")
    st = await _hooks["dispatch_settings"]()
    blob = orders_mod.build_excel(rows, format, columns=st.get("default_columns") or None,
                                  per_customer=st.get("per_customer_columns") or None)
    fname = f"pedidos-{date or 'hoy'}.xlsx"
    return Response(content=blob,
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/orders/export-presets")
async def sup_orders_export_presets(ctx: dict = Depends(require_cap("read"))):
    """The curated export template list (PEDIDOS-PRICING-BUILD.md §9 item 5 — templates ship now,
    custom template building comes later), so the UI stops hardcoding a format list and reads the
    same `orders.EXPORT_PRESETS` that `sup_orders_excel`'s own `format` param validates against —
    one source, both surfaces can never drift apart. Same read auth as the excel route above."""
    import orders as orders_mod
    presets = [{"id": p["id"], "name": p["name"], "description": p["description"]}
              for p in orders_mod.EXPORT_PRESETS.values()]
    return {"presets": presets}


@router.get("/orders/{order_id}")
async def sup_order(order_id: str, ctx: dict = Depends(require_cap("read"))):
    o = await db.order_get(order_id, tenant=ctx["tenant_slug"])
    if not o:
        raise _err(404, "no_such_order")
    return o


@router.post("/orders/{order_id}/finish")
async def sup_order_finish(order_id: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE LAST STEP, for the suppliers whose trade has one (Peter, 2026-08-19).

    Body: {weighed_kg?: number, closed?: bool}. Both optional and independent — a fish wholesaler
    weighs and closes, a supplier who only wants an order off the desk just closes.

    WHY THE WEIGHT IS A FIELD AND NOT A GUESS: fish is ordered by the piece and billed by the
    kilo. Until the scale has spoken, every euro figure on that order is an estimate — which is why
    `variable_weight` lines already refuse to show a line total. This is where the estimate becomes
    a number, and closing without it on a `weigh` supplier is refused rather than silently billed.

    The endpoint exists for every tenant; the DESK only shows the controls when their `finish`
    setting asks for them. A supplier on `print` never sees a weight box."""
    o = await db.order_get(order_id, tenant=ctx["tenant_slug"])
    if not o:
        raise _err(404, "no_such_order")
    kg = (payload or {}).get("weighed_kg", None)
    close = bool((payload or {}).get("closed"))
    sets, args = [], []
    if kg is not None:
        try:
            kgf = float(kg)
        except (TypeError, ValueError):
            raise _err(400, "bad_weight", "El peso va en kilos, con coma o punto.")
        if kgf <= 0 or kgf > 100000:
            raise _err(400, "bad_weight", "Ese peso no cuadra — revísalo.")
        args.append(kgf)
        sets.append(f"weighed_kg = ${len(args)}")
    if close:
        import behaviour
        mode = (await behaviour.get(ctx["tenant_slug"])).get("finish", "print")
        if mode == "weigh" and kg is None and o.get("weighed_kg") is None:
            # closing a weigh-supplier's order with no weight would freeze an estimate as the final
            # number — the exact thing variable_weight lines refuse to do on screen
            raise _err(400, "weight_first", "Apunta el peso y lo cierro.")
        sets.append("closed_at = now()")
    if not sets:
        raise _err(400, "nothing_to_do")
    args.extend([order_id, ctx["tenant_slug"]])
    async with db.get_pool().acquire() as con:
        await con.execute(
            f"update orders set {', '.join(sets)} where id = ${len(args)-1} and tenant_id = ${len(args)}",
            *args)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "order.finish",
                            target_id=order_id, detail={"kg": kg, "closed": close})
    return await db.order_get(order_id, tenant=ctx["tenant_slug"])


@router.post("/orders/{order_id}/printed")
async def sup_order_printed(order_id: str, ctx: dict = Depends(require_cap("act"))):
    """Stamp `printed_at` — «show the status label of things printed» (Raquel, 2026-08-19).

    Called when the desk sends this order's sheet to the printer. It records that the sheet LEFT
    for the printer, which is the only thing a browser can honestly know — a print dialog gives no
    completion signal, and inventing one would be a label that lies. That is still the fact she
    needs: it separates «I have pulled this» from «I have not», and stops the same order being
    printed twice or missed at the van.

    Idempotent by nature — printing again is a real event and re-stamps the time."""
    if not await db.order_get(order_id, tenant=ctx["tenant_slug"]):
        raise _err(404, "no_such_order")
    async with db.get_pool().acquire() as con:
        await con.execute("update orders set printed_at = now() where id = $1 and tenant_id = $2",
                          order_id, ctx["tenant_slug"])
    o = await db.order_get(order_id, tenant=ctx["tenant_slug"])
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "order.printed",
                            target_id=order_id)
    return o


@router.post("/orders/{order_id}/status")
async def sup_order_status(order_id: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """'approved' = the hold-to-confirm commit (submit_order + the dispatch/profile side-effects,
    exactly like the app's path); anything else a status_changed event. Audited."""
    # A1 tail: ownership replaces the fence — the kernel verbs take a raw id, so the endpoint
    # proves the order is THIS tenant's first (404 for a foreign id, never a hint it exists).
    if not await db.order_get(order_id, tenant=ctx["tenant_slug"]):
        raise _err(404, "no_such_order")
    from brain import events as brain_events
    status = (payload.get("status") or "").strip()
    if status not in _ORDER_STATUSES:
        raise _err(400, "bad_status")
    actor = f"web:{ctx['actor_email']}"
    if status == "approved":
        o = await brain_events.submit_order(order_id, actor=actor)
    else:
        o = await brain_events.set_status(order_id, status, actor=actor)
    if not o:
        raise _err(404, "no_such_order")
    # Pedidos orders meter (PEDIDOS-PRICING-BUILD.md §3): this desk route is the real multi-tenant
    # seam — the actual Pedidos customers' status changes, both the submit_order ('approved') and
    # set_status ('sent', among others) branches above. Zero-latency count + immediate threshold
    # email; the 90s reconcile_loop is the safety net, so a hiccup here must never block the status
    # change that already succeeded.
    if o.get("status") in ("approved", "sent"):
        try:
            import pedidos_meter
            await pedidos_meter.record_order(o.get("tenant_id") or ctx["tenant_slug"], o["id"], o["status"])
        except Exception:
            log.exception("pedidos_meter record failed for order %s (reconcile_loop will catch it up)",
                          order_id)
    if status == "approved":
        await _hooks["dispatch_on_approve"]()
        _hooks["profile_after_submit"](o)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "order.status",
                            target_id=order_id, detail={"status": status})
    return o


@router.post("/orders/{order_id}/lines")
async def sup_order_lines(order_id: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """The square-Edit save — event-sourced line replace (edit_order learns aliases/habits)."""
    if not await db.order_get(order_id, tenant=ctx["tenant_slug"]):
        raise _err(404, "no_such_order")
    from brain import events as brain_events
    lines = payload.get("lines")
    if not isinstance(lines, list):
        raise _err(400, "bad_lines", "lines must be a list")
    o = await brain_events.edit_order(order_id, lines=lines, actor=f"web:{ctx['actor_email']}")
    if not o:
        raise _err(404, "no_such_order")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "order.lines",
                            target_id=order_id, detail={"line_count": len(lines)})
    return o


@router.post("/orders/dispatch-now")
async def sup_dispatch_now(ctx: dict = Depends(require_cap("act"))):
    _require_runtime(ctx)
    res = await _hooks["run_dispatch"]("manual")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "orders.dispatch_now",
                            detail={"count": int(res.get("count") or 0), "ok": bool(res.get("ok"))})
    return res


# ── chats family (WhatsApp-web-like — A1 tail 2026-08-07: message rows carry tenant_id, the
#    fill trigger covers every writer, so the reads filter by session tenant and the fence is off) ──
@router.get("/chats")
async def sup_chats(ctx: dict = Depends(require_cap("read"))):
    rows = await db.recent_messages(400, tenant=ctx["tenant_slug"])
    names = await db.profiles_map()
    convos: dict[str, dict] = {}
    for m in rows:  # desc by created_at → first seen per phone is the latest
        ph = m["phone_number"]
        if ph in convos:
            continue
        convos[ph] = {
            "phone_number": ph,
            "name": names.get(ph, ""),
            "last_text": (m.get("message_text") or "").strip(),
            "last_type": (m.get("message_type") or "text"),
            "last_at": m["created_at"],
            "last_role": m["role"],
        }
    return {"conversations": list(convos.values())}


@router.get("/chats/media/{fname}")
async def sup_chat_media(fname: str, ctx: dict = Depends(require_cap("read"))):
    """R8 · the desk plays voice notes through ITS OWN door: /media/{f} wants the app's per-user
    bearer (require_media_auth), which the panel doesn't hold — its identity is the sup_session
    cookie. Same files on disk, the desk's auth. Registered BEFORE /chats/{phone}/... so the
    literal segment wins the match."""
    import re as _re
    from pathlib import Path

    from fastapi.responses import FileResponse
    if not _re.fullmatch(r"[A-Za-z0-9._-]+", fname) or ".." in fname:
        raise _err(404, "no_such_media")
    p = Path(config.MEDIA_DIR) / fname
    if not p.exists():
        raise _err(404, "no_such_media")
    return FileResponse(p)


@router.get("/chats/{phone}/messages")
async def sup_chat_messages(phone: str, after: str | None = None,
                            ctx: dict = Depends(require_cap("read"))):
    return {"messages": await db.get_messages(canon(phone), after, tenant=ctx["tenant_slug"])}


@router.post("/chats/{phone}/send")
async def sup_chat_send(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """Enviar como Rocoto — override_send semantics (SPEC §15.4): the message SHIPS and lands as an
    `override.outbound` event so the mind knows the human spoke through it. `by` records the actual
    supplier actor (not 'peter' — this is the tenant's own override, audited)."""
    text = (payload.get("text") or "").strip()
    p = canon(phone)
    if not p or not text:
        raise _err(400, "bad_request", "phone and text required")
    scope = tenancy.scope_of(p, ctx["tenant_slug"])    # one spelling of the shape (WP-A1)
    # override=True (B6, SPEC §5.5): the supplier's own mouth. Sombra silences Rocoto, not the boss.
    sid = await actions.send_whatsapp_as_rocoto(scope, text, override=True)
    # THE ROW IS THE MESSAGE (R8 finding: the send returned ok and vanished on read — every
    # outbound rail writes its own whatsapp_messages row; this one never did). The sandbox SID
    # is not a wa_message_id (unique index would collide on the second send).
    try:
        import uuid as _uuid
        real_sid = sid if sid and sid != "SANDBOX-wa" else None
        await db.insert_message({
            "id": str(_uuid.uuid4()), "phone_number": p, "role": "assistant",
            "message_text": text, "message_type": "text",
            "wa_message_id": real_sid, "created_at": db.now_iso(),
            "tenant_id": ctx["tenant_slug"],
        })
    except Exception:
        log.exception("sup chat send: message row write failed (send already shipped)")
    try:
        async with db.scoped_tx(scope) as con:
            await con.execute(
                "insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'customer',$2) "
                "on conflict do nothing", scope, ctx["tenant_slug"])
            await spine.append_event(con, scope, "override.outbound", "override",
                                     {"text": text, "by": ctx["actor_email"], "via": "sup_web"})
            await con.execute("update pending_turn set state='cancelled' where scope=$1::ltree", scope)
    except Exception:
        log.exception("sup chat send: override.outbound append failed (message already shipped)")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "chat.send",
                            target_id=p[-4:], detail={"chars": len(text)})
    return {"ok": bool(sid)}


# ── customers family (customer_profiles is tenant_id-keyed → filtered ALWAYS) ─────────────────────
def _jdict(v) -> dict:
    """Lenient jsonb → dict: rows written before the asyncpg codec (or double-encoded) come back as
    strings; never let a legacy row crash a read."""
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            d = json.loads(v)
            return d if isinstance(d, dict) else {}
        except ValueError:
            return {}
    return {}


def _ltv_cents(stats: dict) -> int:
    try:
        return int(round(float((stats or {}).get("lifetime_value") or 0) * 100))
    except (TypeError, ValueError):
        return 0


async def _last_order_map(ctx: dict) -> dict[str, str]:
    """phone → last agreed-order date. Runtime-tenant only (orders is a legacy runtime table);
    other tenants honestly get null last_order_at rather than a cross-tenant join."""
    if not sup_session.owns_runtime(ctx.get("tenant_slug", "")):
        return {}
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select phone_number, max(created_at) as last_at from orders "
            "where status in ('approved','sent') and tenant_id = $1 group by phone_number",
            ctx["tenant_slug"])
    return {r["phone_number"]: r["last_at"].isoformat() for r in rows if r["last_at"]}


async def _customer_rows(ctx: dict) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select phone_number, display_name, cadence_days, erp_client_code, stats, "
            "       typical_basket, top_products "
            "from customer_profiles where tenant_id = $1 order by updated_at desc limit 500",
            ctx["tenant_slug"])
    last = await _last_order_map(ctx)
    out = []
    for r in rows:
        stats = _jdict(r["stats"])
        loc = _jdict(stats.get("location"))
        out.append({
            "phone_number": r["phone_number"],
            "name": r["display_name"] or r["phone_number"],
            "business": loc.get("business"),
            "last_order_at": last.get(r["phone_number"]),
            "cadence_days": float(r["cadence_days"]) if r["cadence_days"] is not None else None,
            "ltv_cents": _ltv_cents(stats),
            "erp_client_code": r["erp_client_code"],
            "typical_basket": r["typical_basket"] or [],
            "top_products": [p.get("name") for p in (r["top_products"] or []) if isinstance(p, dict) and p.get("name")],
        })
    return out


@router.get("/customers")
async def sup_customers(ctx: dict = Depends(require_cap("read"))):
    rows = await _customer_rows(ctx)
    keys = ("phone_number", "name", "business", "last_order_at", "cadence_days", "ltv_cents")
    return {"customers": [{k: c[k] for k in keys} for c in rows]}


@router.get("/customers.csv")
async def sup_customers_csv(ctx: dict = Depends(require_cap("read"))):
    rows = await _customer_rows(ctx)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["telefono", "nombre", "negocio", "ultimo_pedido", "cadencia_dias", "ltv_eur", "codigo_cliente"])
    for c in rows:
        w.writerow([c["phone_number"], c["name"], c["business"] or "", c["last_order_at"] or "",
                    c["cadence_days"] if c["cadence_days"] is not None else "",
                    f"{c['ltv_cents'] / 100:.2f}", c["erp_client_code"] or ""])
    return Response(content=buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="clientes.csv"'})


@router.get("/customers/{phone}")
async def sup_customer_detail(phone: str, ctx: dict = Depends(require_cap("read"))):
    """The ficha twin: profile row (tenant-filtered) + the kernel card/tabs/facts for the wa.* scope
    (runtime-tenant only — those scopes belong to the deployment's runtime world). NO event
    summaries (MVP rule)."""
    p = canon(phone)
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow(
            "select phone_number, display_name, cadence_days, erp_client_code, stats, "
            "       typical_basket, top_products "
            "from customer_profiles where tenant_id = $1 and phone_number = $2",
            ctx["tenant_slug"], p)
    if not r:
        raise _err(404, "no_such_customer")
    stats = _jdict(r["stats"])
    loc = _jdict(stats.get("location"))
    last = await _last_order_map(ctx)
    # Wave 2 (Peter: «where's the order history, the common days visual?») — the dossier gets
    # the customer's ORDERS and their WEEK RHYTHM, from the same rows every other surface reads.
    async with db.get_pool().acquire() as con:
        orows = await con.fetch(
            "select id, status, created_at, delivery_date, value_snapshot_cents, "
            "       jsonb_array_length(coalesce(lines,'[]'::jsonb)) as nlines, lines "
            "from orders where tenant_id = $1 and phone_number = $2 "
            "order by created_at desc limit 30", ctx["tenant_slug"], p)
    week = [0] * 7
    hist = []
    for o in orows:
        d = o["delivery_date"] or o["created_at"].date().isoformat()
        try:
            from datetime import date as _date
            week[_date.fromisoformat(str(d)[:10]).weekday()] += 1
        except Exception:
            pass
        cents = o["value_snapshot_cents"]
        if cents is None:
            try:
                ls = o["lines"] if isinstance(o["lines"], list) else json.loads(o["lines"] or "[]")
                cents = round(sum((l.get("price") or 0) * (l.get("qty") or 0) for l in ls) * 100) or None
            except Exception:
                cents = None
        hist.append({"id": o["id"], "status": o["status"], "date": str(d)[:10],
                     "lines": int(o["nlines"] or 0),
                     "eur": (cents or 0) / 100 if cents is not None else None})
    out = {
        "phone_number": r["phone_number"],
        "name": r["display_name"] or r["phone_number"],
        "business": loc.get("business"),
        "last_order_at": last.get(r["phone_number"]),
        "cadence_days": float(r["cadence_days"]) if r["cadence_days"] is not None else None,
        "ltv_cents": _ltv_cents(stats),
        "erp_client_code": r["erp_client_code"],
        "typical_basket": r["typical_basket"] or [],
        "top_products": [x.get("name") for x in (r["top_products"] or []) if isinstance(x, dict) and x.get("name")],
        "orders": hist,
        "week_rhythm": week,
        "card": "", "tabs": [], "facts": [],
    }
    if sup_session.owns_runtime(ctx["tenant_slug"]):
        scope = tenancy.scope_of(p)                # one spelling of the shape (WP-A1)
        try:
            async with db.scoped_tx(scope) as con:
                out["card"] = await con.fetchval(
                    "select body from card where scope = $1::ltree", scope) or ""
                tabs = await con.fetch(
                    "select id, kind, text, due_at from open_loop "
                    "where scope = $1::ltree and status = 'open' order by opened_at desc limit 20", scope)
                facts = await con.fetch(
                    # `valid_at` — WHEN THIS BECAME TRUE, not when we wrote it down. The two
                    # diverge the moment history is replayed: a fact distilled today from a
                    # conversation in March is true FROM MARCH, and «lo sabe desde marzo» is the
                    # sentence that makes six months of backfill legible instead of a wall.
                    "select kind, text, valid_at, (invalid_at is not null) as dead from fact "
                    "where scope = $1::ltree and invalid_at is null "
                    "order by valid_at desc nulls last, created_at desc limit 60", scope)
            out["tabs"] = [{"id": t["id"], "kind": t["kind"], "text": t["text"],
                            "due_at": t["due_at"].isoformat() if t["due_at"] else None,
                            "timer": None} for t in tabs]
            out["facts"] = [{"kind": f["kind"], "text": f["text"], "dead": bool(f["dead"]),
                             "since": f["valid_at"].isoformat() if f["valid_at"] else None}
                            for f in facts]
        except Exception:
            log.exception("sup customer detail: kernel read failed (profile still served)")
    return out


# ── §17.45 · PER-CUSTOMER PRICES — the his-list card's wire (WP-G1/D5) ───────────────────────
@router.get("/customers/{phone}/prices")
async def sup_customer_prices(phone: str, ctx: dict = Depends(require_cap("read"))):
    """This customer's arrangements with THIS supplier: [{sku_id, name, price, only_his_list}].
    Joined to the catalogue for names; a row whose sku vanished still shows, honestly, by id."""
    p = canon(phone)
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select c.sku_id, coalesce(k.name, c.sku_id) as name, c.price::float8 as price, "
            "       c.only_his_list, c.note, c.updated_at, c.updated_by "
            "from customer_sku_prices c "
            "left join catalogue_skus k on k.id = c.sku_id and k.tenant_id = c.tenant_id "
            "where c.tenant_id = $1 and c.phone_number = $2 order by name", ctx["tenant_slug"], p)
    return {"prices": [dict(r) for r in rows]}


@router.post("/customers/{phone}/prices")
async def sup_customer_price_set(phone: str, payload: dict,
                                 ctx: dict = Depends(require_cap("act"))):
    """Set / update / clear one arrangement. {sku_id, price?|null, only_his_list?, remove?}.

    price=null KEEPS the row as «his list, at my prices» (§17.45's other half); remove=true
    deletes the arrangement entirely. Audited (§17.34.6) with before+after, because a price
    change for one customer is exactly the kind of thing «¿quién cambió esto?» gets asked about.
    """
    p = canon(phone)
    sku = str(payload.get("sku_id") or "").strip()
    if not sku:
        raise _err(400, "sku_required")
    async with db.get_pool().acquire() as con:
        before = await con.fetchrow(
            "select price::float8 as price, only_his_list from customer_sku_prices "
            "where tenant_id=$1 and phone_number=$2 and sku_id=$3", ctx["tenant_slug"], p, sku)
        if payload.get("remove"):
            await con.execute(
                "delete from customer_sku_prices where tenant_id=$1 and phone_number=$2 and sku_id=$3",
                ctx["tenant_slug"], p, sku)
            after = None
        else:
            price = payload.get("price")
            if price is not None:
                try:
                    price = float(price)
                except (TypeError, ValueError):
                    raise _err(400, "bad_price")
                if price < 0:
                    raise _err(400, "bad_price")
            only = bool(payload.get("only_his_list", (before or {}).get("only_his_list") or False))
            await con.execute(
                "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price, "
                "  only_his_list, updated_by) values($1,$2,$3,$4,$5,$6) "
                "on conflict (tenant_id, phone_number, sku_id) do update set "
                "  price = excluded.price, only_his_list = excluded.only_his_list, "
                "  updated_at = now(), updated_by = excluded.updated_by",
                ctx["tenant_slug"], p, sku, price, only, ctx["actor_email"])
            after = {"price": price, "only_his_list": only}
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "customer.price", target_id=f"{p}:{sku}",
                            detail={"before": dict(before) if before else None, "after": after})
    return {"ok": True}


@router.post("/customers/{phone}/teach")
async def sup_customer_teach(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """TEACH ROCOTO ABOUT THIS CUSTOMER, from the ficha (Peter, 2026-08-19: «chatting with the AI
    of each customer so that it can learn stuff about them»). Raquel's case: a customer asks for
    rodaballo they have never bought — the sheet is where what-we-know-about-them lives, so the
    sheet is where she says «a Manolo la burrata SIEMPRE del reparto del viernes».

    It reuses `agent_reply._save_fact` — the SAME writer the mind's own `remember` tool uses — so a
    boss-taught fact and a conversation-learned fact are one species: same shelf, same card regen,
    same recall. A parallel «panel facts» store would be the split-truth disease (see
    demo_flow.workspace_ready for what that costs).

    The scope is built WITH the session's tenant, not from the bare phone: a customer shared by two
    distributors must land the fact on THIS distributor's relationship."""
    text = str((payload or {}).get("text") or "").strip()
    if not text:
        raise _err(400, "text_required")
    if len(text) > 500:
        raise _err(400, "too_long", "Un hecho es una frase, no una ficha entera.")
    import agent_reply
    import tenancy
    scope = tenancy.scope_of(phone, ctx["tenant_slug"])
    await agent_reply._save_fact(phone, text, scope=scope)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "customer.teach",
                            target_id=phone, detail={"chars": len(text)})
    return {"ok": True, "filed": text}


@router.post("/customers/{phone}/erp-code")
async def sup_customer_erp_code(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """Their CLIENT code in the supplier's ERP (Excel codigo_cliente). Blank clears. Tenant-filtered
    UPDATE — a wrong-tenant phone updates nothing and 404s honestly."""
    p = canon(phone)
    code = (payload.get("erp_client_code") or "").strip()[:64] or None
    async with db.get_pool().acquire() as con:
        hit = await con.fetchval(
            "update customer_profiles set erp_client_code = $3, updated_at = now() "
            "where tenant_id = $1 and phone_number = $2 returning phone_number",
            ctx["tenant_slug"], p, code)
    if not hit:
        raise _err(404, "no_such_customer")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "customer.erp_code",
                            target_id=p[-4:], detail={"set": bool(code)})
    return {"erp_client_code": code}


@router.post("/customers/{phone}/window")
async def sup_customer_window(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE COMERCIAL SETS THE CUSTOMER'S DELIVERY WINDOW — their standing receiving hours, source
    `set` (the desk twin of `PUT /api/customer/{phone}/window`; one module underneath).

    A window belongs to the CUSTOMER because it is a fact about them; `POST /orders/{id}/window`
    below is today's exception. EVERYTHING EMPTY CLEARS IT, and clearing is a real operation — the
    surfaces return to «sin franja» rather than to some default shift. Tenant-filtered UPDATE, so a
    wrong-tenant phone 404s honestly. Audited like every other act: a franja is a promise to a
    customer, and the log must be able to say who made it."""
    from brain import window as brain_window
    p = canon(phone)
    try:
        async with db.get_pool().acquire() as con:
            w = await brain_window.set_customer(
                con, ctx["tenant_slug"], p,
                window_from=payload.get("window_from"), window_to=payload.get("window_to"),
                said=str(payload.get("said") or ""), source=brain_window.SET)
    except LookupError:
        raise _err(404, "no_such_customer")
    except ValueError as e:
        raise _err(400, "bad_window", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "customer.window",
                            target_id=p[-4:], detail={"label": brain_window.label(w)})
    return {"phone_number": p, **brain_window.wire(w), "label": brain_window.label(w)}


@router.post("/orders/{order_id}/window")
async def sup_order_window(order_id: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """TODAY'S EXCEPTION — the per-order override, which beats the customer's default for THIS
    delivery only. Clearing restores the default (which may itself be absent); the default is never
    copied down onto the order, or a later change to their hours would silently miss it."""
    from brain import window as brain_window
    try:
        async with db.get_pool().acquire() as con:
            w = await brain_window.set_order(
                con, order_id,
                window_from=payload.get("window_from"), window_to=payload.get("window_to"),
                said=str(payload.get("said") or ""), source=brain_window.SET)
    except LookupError:
        raise _err(404, "no_such_order")
    except ValueError as e:
        raise _err(400, "bad_window", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "order.window",
                            target_id=order_id, detail={"label": brain_window.label(w)})
    return {"order_id": order_id, **brain_window.wire(w), "label": brain_window.label(w)}


# ── catalogue family (catalogue_skus is tenant_id-keyed → filtered ALWAYS) ────────────────────────
@router.get("/catalogue")
async def sup_catalogue(ctx: dict = Depends(require_cap("read"))):
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, code, name, family, base_unit, pack_factor, variable_weight, price, "
            "       in_assortment "
            "from catalogue_skus where tenant_id = $1 order by family, name", ctx["tenant_slug"])
    return {"skus": [{
        "id": r["id"], "code": r["code"], "name": r["name"], "family": r["family"] or "",
        "base_unit": r["base_unit"], "pack_factor": float(r["pack_factor"] or 1),
        "variable_weight": bool(r["variable_weight"]),
        "price": float(r["price"]) if r["price"] is not None else None,
        "in_assortment": bool(r["in_assortment"]),
    } for r in rows]}


# ── settings family ───────────────────────────────────────────────────────────────────────────────
@router.get("/settings")
async def sup_settings(ctx: dict = Depends(require_cap("read"))):
    t = await _tenant_row(ctx["tenant_slug"]) or {}
    dispatch = await _hooks["dispatch_settings"]() if sup_session.owns_runtime(ctx["tenant_slug"]) else {}
    return {"dispatch": dispatch, "ecommerce_enabled": bool(t.get("ecommerce_enabled"))}


@router.post("/settings/dispatch")
async def sup_settings_dispatch(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    _require_runtime(ctx)
    merged = await _hooks["save_dispatch"](payload or {})
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "settings.dispatch",
                            detail={"mode": merged.get("mode")})
    return merged


@router.post("/settings/call-hours")
async def sup_settings_call_hours(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """WRITE the receiving hours the `after_hours` call posture is resolved against.

    Until this existed, `ai_disclosure._within_hours` read a key nothing wrote, so the middle
    position of the calls switch — «Rocoto contesta fuera de mi horario» — could never fire: it
    resolved to «no hours configured, so a person answers», forever. Hours are per TENANT because a
    wholesaler who takes orders from 05:00 has a different night from one who starts at 09:00.

    Replaces rather than merges: an absent day is CLOSED, so a merge would make it impossible to
    stop taking calls on a Saturday."""
    import ai_disclosure as _disc
    try:
        hours = _disc.parse_hours((payload or {}).get("call_hours") or payload or {})
    except ValueError as e:
        raise _err(400, "bad_call_hours", str(e))
    cur = dict(await db.settings_get(ctx["tenant_slug"]) or {})
    cur[_disc.HOURS_SETTING_KEY] = hours
    await db.settings_set(ctx["tenant_slug"], cur)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "settings.call_hours",
                            detail={"days": sorted(hours["days"]), "tz": hours["tz"]})
    return {"ok": True, "call_hours": hours}


@router.post("/settings/ecommerce")
async def sup_settings_ecommerce(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """The per-supplier «Tienda online» toggle (capability tier 2 — SEPARATED, opt-in).
    Toggling ON does NOT provision anything: it records the intent (tenants.ecommerce_enabled +
    ecommerce_requested_at) and surfaces to Peter via ops.record_alert — the Medusa revival is
    the human-run ECOMMERCE-MOTHBALL-REVIVAL-RUNBOOK.md (~30 min). The es-ES copy says so plainly."""
    on = bool((payload or {}).get("enabled"))
    async with db.get_pool().acquire() as con:
        prev = await con.fetchval("select ecommerce_enabled from tenants where slug = $1",
                                  ctx["tenant_slug"])
        if prev is None:
            raise _err(404, "no_such_tenant")
        if on:
            await con.execute(
                "update tenants set ecommerce_enabled = true, "
                "  ecommerce_requested_at = coalesce(ecommerce_requested_at, now()), "
                "  updated_at = now() where slug = $1", ctx["tenant_slug"])
        else:
            await con.execute(
                "update tenants set ecommerce_enabled = false, updated_at = now() where slug = $1",
                ctx["tenant_slug"])
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "settings.ecommerce",
                            detail={"enabled": on, "was": bool(prev)})
    if on and not prev:
        # record the intent in the operator inbox. Fail-soft:
        # the toggle is already recorded; a surfacing hiccup must not fail the supplier's click.
        try:
            await ops.record_alert(
                "ecommerce",
                f"Tienda online solicitada: tenant '{ctx['tenant_slug']}' "
                f"(por {ctx['actor_email']}). Revival = ECOMMERCE-MOTHBALL-REVIVAL-RUNBOOK.md "
                f"(human-run, ~30 min).",
                ref_scope=f"t.{ctx['tenant_slug']}")
        except Exception:
            log.exception("ecommerce toggle: inbox recording failed (intent already recorded)")
    note = ("Solicitud registrada. La tienda online la activa nuestro equipo manualmente "
            "(≈30 min de preparación) — te avisaremos cuando esté lista. No se activa sola."
            if on else "Tienda online desactivada.")
    return {"ecommerce_enabled": on, "note": note}


# ── delivery range (§5.8a item 2 — the Settings screen owns it; brain/range.py owns the rule) ────
# ── §17.30b.5 · EMPRESA — my business, not Rocoto's behaviour (WP-D8) ────────────────────────
@router.get("/company")
async def sup_company(ctx: dict = Depends(require_cap("read"))):
    """The business card + the range rule + who it can actually reach — one read, because the
    Empresa page composes one answer («where you are, where you deliver»), not three."""
    from brain import range as brain_range
    slug = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        t = await con.fetchrow(
            "select name, address, city, region, lat, lng from tenants where slug = $1", slug)
        rng = await brain_range.get_range(con, slug)
        reach = {"inside": 0, "outside": 0, "unplaced": 0}
        if rng.get("set"):
            try:
                sv = await brain_range.servable_customers(con, slug)
                reach = {"inside": len(sv.get("inside") or []),
                         "outside": len(sv.get("outside") or []),
                         "unplaced": len(sv.get("unplaced") or [])}
            except Exception:
                log.exception("company: servable_customers fail-soft")
    return {
        "name": (t and t["name"]) or "",
        "address": (t and t["address"]) or "",
        "city": (t and t["city"]) or "",
        "region": (t and t["region"]) or "",
        "lat": t and (float(t["lat"]) if t["lat"] is not None else None),
        "lng": t and (float(t["lng"]) if t["lng"] is not None else None),
        "range": rng,
        "reach": reach,
    }


@router.post("/company")
async def sup_company_set(payload: dict, ctx: dict = Depends(require_cap("admin:negocio"))):
    """Edit the card's text — name, address, city. TEXT ONLY, deliberately: the depot the routes
    are timed from is the RANGE's depot (settings/range), and editing an address here must never
    silently move a routing point. admin:negocio — this is the business, not the employee."""
    slug = ctx["tenant_slug"]
    fields = {k: str(payload[k]).strip() for k in ("name", "address", "city")
              if isinstance((payload or {}).get(k), str)}
    if not fields:
        raise _err(400, "nothing_to_change", "No hay nada que cambiar.")
    if "name" in fields and not fields["name"]:
        raise _err(400, "bad_name", "Tu negocio necesita un nombre.")
    async with db.get_pool().acquire() as con:
        before = await con.fetchrow(
            "select name, address, city from tenants where slug = $1", slug)
        sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
        await con.execute(  # noqa: S608 — keys are the fixed whitelist above
            f"update tenants set {sets}, updated_at = now() where slug = $1",
            slug, *fields.values())
    await sup_session.audit(ctx["actor_email"], slug, ctx.get("ip") or "", "company.edit",
                            detail={"before": {k: before[k] for k in fields} if before else {},
                                    "after": fields})
    return await sup_company(ctx)


@router.get("/settings/range")
async def sup_settings_range_get(ctx: dict = Depends(require_cap("read"))):
    """THE WIRE (code against this, don't guess):

        GET /api/sup/settings/range → 200
        {
          "set":          bool,      // EVALUABLE: a kind we can run AND a depot to measure from.
                                     // false ⇒ no order is ever held for range (§5.8a state 1).
          "range_kind":   "radius",  // "radius" today; "zones" is the additive seam, not evaluable yet
          "range_km":     number|null,   // null = never set. NEVER defaulted, never guessed
          "depot_lat":    number|null,
          "depot_lon":    number|null,
          "depot_label":  string,    // «nave de Mercamadrid» — what the boss calls it. May be ""
          "zones":        []         // unused on 'radius'; present so the client can round-trip it
        }

    Read-only and total: a tenant who has never set a range gets the same shape with set=false and
    nulls, never a 404 — "not configured" is a state of the settings screen, not an error."""
    async with db.get_pool().acquire() as con:
        from brain import range as brain_range
        return await brain_range.get_range(con, ctx["tenant_slug"])


@router.put("/settings/range")
@router.post("/settings/range")
async def sup_settings_range_set(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """THE WIRE:

        PUT (or POST) /api/sup/settings/range   + X-Sup-CSRF
        body {"range_km": 25, "depot_lat": 40.39, "depot_lon": -3.66, "depot_label": "nave"}
          → 200  the SAME shape GET returns, freshly read back (so the client never guesses `set`)
          → 400 {"error":"bad_range","detail":"<es-ES, show it to the boss verbatim>"}

    `detail` is written by `brain/range.set_range` in es-ES, boss-facing, and is safe to render as-is:
    «El radio de reparto tiene que ser un número de kilómetros mayor que cero.» That is deliberate —
    a radius that silently failed to save would hold real orders for a reason nobody could explain,
    so the write RAISES and the surface says why (the read path never raises; see §5.8a).

    BOTH METHODS on one handler: PUT is the verb this settings resource deserves, POST is what every
    other mutation in this file uses and therefore what a client coding by analogy will reach for.
    One handler, so they can never drift. CSRF + the admin cap apply identically to both."""
    from brain import range as brain_range
    p = payload or {}
    async with db.get_pool().acquire() as con:
        try:
            out = await brain_range.set_range(
                con, ctx["tenant_slug"],
                range_km=p.get("range_km"), depot_lat=p.get("depot_lat"),
                depot_lon=p.get("depot_lon"), depot_label=p.get("depot_label") or "")
        except ValueError as e:
            raise _err(400, "bad_range", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "settings.range",
                            detail={"range_km": out.get("range_km"), "kind": out.get("range_kind")})
    return out


# ── stock family (§5.8a row 3 — «Inventario»: the levels, and the capture→correction→apply loop) ──
def _stock_wire(v: dict) -> dict:
    """ONE stock level, on the wire. Explicit field-by-field rather than `dict(row)` because a level
    row is joined against `catalogue_skus` and a passthrough would start leaking columns the day
    someone adds one. Numerics come back as floats and timestamps as ISO strings — a Compose or a
    React client must never have to parse Postgres' `Decimal` repr, and `null` means UNSET (no
    threshold, never counted), which is a state both clients have to render differently from zero."""
    return {
        "sku_id": str(v.get("sku_id") or ""),
        "name": v.get("name") or "",
        "qty": float(v["qty"]) if v.get("qty") is not None else None,
        "unit": v.get("unit") or "",
        "low_at": float(v["low_at"]) if v.get("low_at") is not None else None,
        "low": bool(v.get("low")),
        "source": v.get("source") or "",
        "captured_at": v["captured_at"].isoformat() if v.get("captured_at") else None,
        "note": v.get("note") or "",
    }



@router.post("/settings/inventory")
async def sup_settings_inventory(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """THE WIRE:  POST /api/sup/settings/inventory  {"enabled": true}  → {"inventory_enabled": bool}

    «Inventario» is OFF by default per tenant (`tenants.inventory_enabled`, the same opt-in-boolean
    pattern as `ecommerce_enabled` next door). This route exists because without it the feature can
    never be switched on from a surface — and until it is on, NO order can ever be held for
    «no hay stock» (§5.8a: silence, never a guess). Turning it on provisions nothing; it only lets
    the levels that are already being captured start speaking."""
    on = bool((payload or {}).get("enabled"))
    async with db.get_pool().acquire() as con:
        prev = await con.fetchval("select inventory_enabled from tenants where slug = $1",
                                  ctx["tenant_slug"])
        if prev is None:
            raise _err(404, "no_such_tenant")
        await con.execute("update tenants set inventory_enabled = $2, updated_at = now() "
                          "where slug = $1", ctx["tenant_slug"], on)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "settings.inventory",
                            detail={"enabled": on, "was": bool(prev)})
    return {"inventory_enabled": on}


@router.get("/stock")
async def sup_stock(ctx: dict = Depends(require_cap("read"))):
    """THE WIRE:

        GET /api/sup/stock → 200
        {
          "inventory_enabled": bool,     // false ⇒ `low` is [] and no order can be held for stock
          "levels": [{
             "sku_id": "F-1020", "name": "PALETA COCIDA",   // name may be "" (SKU since deleted)
             "qty": 4.0, "unit": "kg",
             "low_at": 1.0|null,          // the boss's «me queda poco» line for THIS sku
             "low": true,                 // qty <= low_at. A NUDGE, never a review reason
             "source": "capture",         // capture | voice | manual | import — who is responsible
             "captured_at": "2026-07-26T…"|null,
             "note": ""
          }],
          "low": [ …the same rows, only the low ones, thinnest first ]
        }

    `levels` is every counted SKU, alphabetical by name so the list is stable between renders.
    A SKU with NO row here has never been counted and therefore can never make an order short —
    absence is the honest state, not zero."""
    from brain import stock as brain_stock
    tenant = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        on = await brain_stock.inventory_on(con, tenant)
        levels = await brain_stock.get_levels(con, tenant)
        low = await brain_stock.low_levels(con, tenant)
    return {"inventory_enabled": bool(on),
            "levels": sorted((_stock_wire(v) for v in levels.values()),
                             key=lambda d: (d["name"] or d["sku_id"]).lower()),
            "low": [_stock_wire(v) for v in low]}


@router.post("/stock/capture")
async def sup_stock_capture(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE WIRE:

        POST /api/sup/stock/capture   + X-Sup-CSRF
        body {"image_url": "https://…/media/stock-ab12.jpg",     // one of OUR OWN media URLs
              "transcript": "de jamón cocido quedan dos cajas y media",
              "read": [ … ]}          // OMIT (or []) to have Rocoto read it — see below
          → 200 {"capture_id": 41,
                 "read": [{"sku_id":"sku-jamon-cocido-pieza","name":"JAMÓN COCIDO EXTRA PIEZA",
                           "qty":2.5,"unit":"cajas","confidence":"alta","source":"voz",
                           "state":"matched",
                           "said":"quedan dos cajas y media","heard":"jamón cocido"}],
                 "ambiguous": [{"name":"chorizo sarta","qty":3,"unit":"cajas","state":"ambiguous",
                                "candidates":[{"sku_id":"…","name":"CHORIZO SARTA EXTRA 500 G"},
                                              {"sku_id":"…","name":"CHORIZO SARTA EXTRA 1 KG"}],
                                "n_close":2,"why":"no sé cuál de estos es","can_create":true}],
                 "unmatched": [{"name":"…","qty":3,"unit":"cajas","source":"foto",
                                "state":"unmatched","why":"no lo encuentro en tu catálogo",
                                "candidates":[…],"can_create":true,
                                "suggested_code":"ROC-SAL-001"}],
                 "note": "",           // es-ES, and NON-EMPTY only when we could not read it
                 "read_source": "rocoto",      // "rocoto" = we read it | "client" = you sent it
                 "applied": false}

    THREE LISTS, AND THE MIDDLE ONE IS THE POINT (2026-07-27, second pass). `read` is countable;
    `ambiguous` is "your catalogue has it, I cannot tell WHICH row" and is deliberately OUT of `read`
    so /apply structurally cannot write a level from an unresolved line; `unmatched` is "not there at
    all", and carries the offer to create it. Same bands as the order brain (`brain/matcher` →
    `doubt.classify_line`); see `brain/stock.classify_stock_match`. `POST /api/sup/stock/match`
    re-grounds a name the operator corrects, `POST /api/sup/stock/sku` creates the row.

    **ROCOTO NOW ACTUALLY READS IT (2026-07-27).** This route used to take `read` as an INPUT and
    store it — the server looked at neither the photograph nor the note, so «lo que Rocoto ha leído»
    was whatever the client had already decided. The reading is `brain/stock.read_capture`, and it is
    in `brain/stock.py` rather than here because the app's `/api/stock/capture` calls the SAME
    function: one feature behind two doors, never two readings.

      · `read` ABSENT or EMPTY  → Rocoto reads the photo and the spoken note (`read_source:"rocoto"`).
      · `read` NON-EMPTY        → honoured VERBATIM, no model call (`read_source:"client"`) — that is
        the correction path, and re-reading a corrected list would be arguing with the boss.

    The photo is resolved from `image_url` ONLY when it points at this box's own `/media/…` (the same
    fence as the `/media/{fname}` route). A remote URL is not fetched — that would make the backend a
    proxy for whatever the client's network can reach — so it reads as NO PHOTO, and the spoken note
    alone is a complete capture.

    THIS MOVES NO LEVEL, ON PURPOSE. It records WHAT ROCOTO READ so the boss can correct it by
    talking; only `/stock/capture/{id}/apply` writes the levels. Applying first and asking later
    destroys the one signal that says whether the reading is any good (§5.8a / §5.8b — the correction
    loop IS the feature). `read` may come back [] with a `note` (a photo we could not read); the
    capture still exists, which is what lets the app show «no he sabido leerlo» against a real row."""
    from brain import stock as brain_stock
    p = payload or {}
    read = p.get("read")
    if read is not None and not isinstance(read, list):
        raise _err(400, "bad_read", "La lectura tiene que ser una lista de líneas.")
    image_url, transcript = str(p.get("image_url") or ""), str(p.get("transcript") or "")
    ambiguous, unmatched, note, source = [], [], "", "client"
    async with db.get_pool().acquire() as con:
        if not brain_stock.client_supplied(read):
            source = "rocoto"
            image_bytes, mime = brain_stock.media_bytes(image_url)
            out = await brain_stock.read_capture(con, ctx["tenant_slug"], image_bytes=image_bytes,
                                                 mime=mime, transcript=transcript)
            read, ambiguous = out["read"], out["ambiguous"]
            unmatched, note = out["unmatched"], out["note"]
        cid = await brain_stock.record_capture(con, ctx["tenant_slug"], image_url=image_url,
                                               transcript=transcript, read_json=read)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "stock.capture",
                            target_id=str(cid), detail={"lines": len(read or []),
                                                        "ambiguous": len(ambiguous),
                                                        "unmatched": len(unmatched),
                                                        "read_source": source})
    # Only `read` is recorded on the capture: it is the only list a level can be written from. The
    # other two travel to the desk, get resolved (pick · override · create), and come back inside
    # `read` on /apply.
    return {"capture_id": cid, "read": read or [], "ambiguous": ambiguous, "unmatched": unmatched,
            "note": note, "read_source": source, "applied": False}


@router.post("/stock/capture/{capture_id}/apply")
async def sup_stock_apply(capture_id: int, payload: dict | None = None,
                          ctx: dict = Depends(require_cap("act"))):
    """THE WIRE:

        POST /api/sup/stock/capture/41/apply   + X-Sup-CSRF
        body {"read": [ …the reading AS THE BOSS LEFT IT… ]}   // omit/null ⇒ apply what we read
          → 200 {"capture_id":41,"written":3,"skipped":0,"corrected":true,"already_applied":false}
          → 404 {"error":"no_such_capture"}   // not this tenant's, or no such id

    `corrected` is the product signal, not a status: it says the boss had to fix the read before it
    could become state, and it is recorded because it is the only measure of whether the reading is
    any good. `written` counts levels actually set; `skipped` counts lines we could not ground (no
    sku_id, no qty) — those write NOTHING rather than a guessed level.

    Idempotent: a second Guardar returns already_applied=true and writes nothing.

    NOT WRAPPED IN A TRANSACTION, deliberately: `apply_capture` tolerates a per-line failure (a SKU
    that has since left the catalogue) by skipping that line, and inside a transaction the first such
    failure would abort every good level with it."""
    from brain import stock as brain_stock
    read = (payload or {}).get("read")
    if read is not None and not isinstance(read, list):
        raise _err(400, "bad_read", "La lectura tiene que ser una lista de líneas.")
    async with db.get_pool().acquire() as con:
        try:
            out = await brain_stock.apply_capture(con, ctx["tenant_slug"], int(capture_id),
                                                  read_json=read)
        except ValueError:
            # the tenant fence + "no such capture" are the same refusal from the client's side, and
            # they must LOOK the same: telling one tenant that another's capture id exists is a leak.
            raise _err(404, "no_such_capture")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "stock.apply",
                            target_id=str(capture_id),
                            detail={"written": out.get("written"), "corrected": out.get("corrected")})
    return out


@router.post("/stock/match")
async def sup_stock_match(payload: dict, ctx: dict = Depends(require_cap("read"))):
    """THE WIRE:  POST /api/sup/stock/match  + X-Sup-CSRF
        body {"q": "paleta cocida en pieza", "unit": "kg", "qty": 40}
          → 200 {"state":"matched"|"ambiguous"|"unmatched", "sku_id","name","confidence",
                 "candidates":[…], "alternatives":[…], "unit_note","n_close","heard",
                 "can_create":bool, "suggested_code":"", "why":"…"}

    THE OVERRIDE PATH, and the desk half of `/api/stock/match`. One function behind both doors
    (`brain/stock.match_one`), so a name grounds identically whether it is typed at a desk or said to
    a phone. A stock count is silent — nobody reads it back — so the ability to overrule a match is
    not an escape hatch from the correction loop, it IS the loop. Writes nothing ('read' cap)."""
    from brain import stock as brain_stock
    p = payload or {}
    try:
        qty = float(p["qty"]) if p.get("qty") is not None else None
    except (TypeError, ValueError):
        qty = None
    async with db.get_pool().acquire() as con:
        return await brain_stock.match_one(con, ctx["tenant_slug"], str(p.get("q") or ""),
                                           unit=str(p.get("unit") or ""), qty=qty)


@router.post("/stock/sku")
async def sup_stock_sku_create(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE WIRE:  POST /api/sup/stock/sku  + X-Sup-CSRF
        body {"name":"SALSA BRAVA GARRAFA", "code":"35T" | "generate_code":true,
              "family":"salsas", "unit":"barquetas", "price":null,
              "capture_id":41, "image_url":"…/media/stock-ab12.jpg", "heard":"salsa brava"}
          → 200 {"ok":true,"sku":{…},"code":"ROC-SAL-001","code_generated":true,
                 "embedded":true,"aliases":2,"note":""}
          → 409 {"ok":false,"reason":"code_taken"|"name_taken","detail":"…","sku":{…}}
          → 400 {"ok":false,"reason":"no_name"|"no_code","detail":"…"}

    «¿Tienes código para esto, o te lo genero yo?», answered — the inventory tool GROWING the
    catalogue, which is the whole reason UNMATCHED is a state and not a dead end. Supplying neither a
    code nor `generate_code` is a 400, deliberately: a code is an identity and we do not mint one
    unasked. A created row is embedded, FTS-indexed and aliased inside the same transaction, so the
    very next order naming that product grounds — see `brain/catalogue.create_sku`.

    Audited (`stock.sku_created`) because a catalogue row nobody can explain is a liability; the row
    itself also carries `attrs.created_from` with the capture and the photograph it came from."""
    from brain import catalogue as brain_catalogue
    from brain import skuparse as brain_skuparse
    p = payload or {}
    row = brain_skuparse.sku_from_line(p.get("line"), name=str(p.get("name") or ""),
                                       code=str(p.get("code") or ""),
                                       family=str(p.get("family") or ""),
                                       unit=str(p.get("unit") or ""), price=p.get("price"))
    prov = {k: p.get(k) for k in ("capture_id", "image_url", "heard", "said", "transcript")
            if p.get(k) not in (None, "")}
    prov["by"] = ctx.get("actor_email") or "desk"
    async with db.get_pool().acquire() as con:
        out = await brain_catalogue.create_sku(
            con, ctx["tenant_slug"], name=row["name"], code=row["code"],
            generate_code=bool(p.get("generate_code")), family=row["family"], unit=row["unit"],
            pack_factor=p.get("pack_factor"), variable_weight=p.get("variable_weight"),
            price=row["price"], created_from=prov)
    if not out.get("ok"):
        raise _err(409 if out.get("reason") in ("code_taken", "name_taken") else 400,
                   out.get("reason") or "failed", out.get("detail") or "")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "stock.sku_created",
                            target_id=str((out.get("sku") or {}).get("id") or ""),
                            detail={"code": out.get("code"), "generated": out.get("code_generated"),
                                    "embedded": out.get("embedded"),
                                    "capture_id": prov.get("capture_id")})
    return out


@router.get("/stock/sku/code")
async def sup_stock_sku_code(name: str = "", family: str = "",
                             ctx: dict = Depends(require_cap("read"))):
    """THE WIRE:  GET /api/sup/stock/sku/code?name=…&family=…  → {"suggested_code":"ROC-SAL-001"}

    The code «te lo genero yo» would actually mint, shown BEFORE he agrees to it — nobody should
    accept an identifier sight-unseen. Reserves nothing."""
    from brain import catalogue as brain_catalogue
    async with db.get_pool().acquire() as con:
        try:
            c = await brain_catalogue.suggest_code(con, ctx["tenant_slug"], name=name, family=family)
        except Exception:
            c = ""
    return {"suggested_code": c}


@router.get("/billing")
async def sup_billing(ctx: dict = Depends(require_cap("admin"))):
    from brain import billing as brain_billing
    return await brain_billing.billing_summary(ctx["tenant_slug"])


# ── §17.41 · THE INVITE DOOR — what the link opens (WP-D11's invite half) ────────────────────
# PUBLIC routes, deliberately: an invitee has NO membership, so they cannot hold a sup_session —
# session_for_user refuses exactly that. Authorization to SEE an invitation is knowledge of its
# unguessable token; authorization to ACCEPT it is a VERIFIED Supabase identity whose email matches
# the row. Rate-limited like login, because a public door is a public door.

@router.get("/invite/{token}")
async def sup_invite_peek(token: str, request: Request):
    """What the page shows before anyone accepts: the INVITER is the subject (§17.41), the role is
    pre-set with its scope in one line, and a dead link says WHICH way it is dead — expired and
    revoked «say so plainly and offer nothing», never a 404 shrug."""
    ip = _client_ip(request)
    if not sup_session.rate_ok(f"invpeek:{ip}", limit=30, window_s=300):
        raise _err(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    from brain import invitations
    row = await invitations.peek(token)
    if not row:
        return {"state": "unknown"}
    return {"state": row["state"], "tenant_name": row.get("tenant_name") or row["tenant_slug"],
            "invited_by": row["invited_by"], "role": row["role"], "email": row["email"]}


@router.post("/invite/accept")
async def sup_invite_accept(request: Request, response: Response, payload: dict | None = None):
    """{token, access_token} → membership + a minted sup session, landing INSIDE the org.

    The Supabase bearer is verified EXACTLY like login (matching-email OAuth identity); the email
    on the invitation must match the identity's — a link is an invitation to one person, never a
    bearer credential for an org. On success the cookie is set and the wire session returns, so
    the browser goes straight from «Aceptar» to the panel with no second login."""
    ip = _client_ip(request)
    if not sup_session.rate_ok(f"invaccept:{ip}", limit=12, window_s=300):
        raise _err(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    token = str((payload or {}).get("token") or "").strip()
    bearer = str((payload or {}).get("access_token") or "").strip()
    if not token or not bearer:
        raise _err(400, "token_required")
    user = await brain_auth.verify_token(bearer)
    if not user:
        raise _err(401, "unauthorized", "No hemos podido verificar tu sesión de Google.")
    if not brain_auth.has_matching_oauth(user):
        raise _err(403, "oauth_required",
                   "Entra con Google, con el mismo correo al que llegó la invitación.")
    email = (user.get("email") or "").strip().lower()
    from brain import invitations
    res = await invitations.accept(token, email)
    if not res.get("ok"):
        reasons = {
            "unknown": "Este enlace no existe.",
            "expired": "Esta invitación caducó (duran 7 días). Pide que te la reenvíen.",
            "revoked": "Esta invitación fue revocada.",
            "accepted": "Esta invitación ya se usó.",
            "wrong_email": "La invitación es para otro correo. Entra con el correo al que llegó.",
        }
        raise _err(403, res.get("error") or "forbidden",
                   reasons.get(res.get("error") or "", "No se ha podido aceptar."))
    s = await sup_session.mint(email, res["tenant_slug"], res["role"], ip,
                               request.headers.get("user-agent", ""))
    _set_cookie(response, s["raw"])
    await sup_session.audit(email, res["tenant_slug"], ip, "invitation.accept", result="ok")
    t = await _tenant_row(res["tenant_slug"])
    return _wire_session({**s, "actor_email": email}, (t or {}).get("name") or res["tenant_slug"],
                         (t or {}).get("status") or "test",
                         onboarded=(t or {}).get("onboarded_at") is not None)


# ── §17.21 · EL HISTORIAL — a customer's past, as proposals (WP-D5b) ─────────────────────────
@router.post("/customers/import/csv")
async def sup_hist_csv(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """Door 3: the customer-list CSV → record proposals. NO writes here — §17.21's law."""
    import historial
    try:
        return await historial.csv_propose(ctx["tenant_slug"], str((payload or {}).get("text") or ""))
    except ValueError as e:
        raise _err(400, "bad_csv", str(e))


@router.post("/customers/import/csv/accept")
async def sup_hist_csv_accept(payload: dict, ctx: dict = Depends(require_cap("act"))):
    import historial
    rows = [r for r in (payload or {}).get("rows", []) if isinstance(r, dict)]
    if not rows:
        raise _err(400, "nothing_accepted", "No has marcado ninguna fila.")
    out = await historial.csv_accept(ctx["tenant_slug"], rows, ctx["actor_email"])
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "historial.csv", detail=out)
    return out


@router.post("/customers/{phone}/history/chat")
async def sup_hist_chat(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """Door 2: WhatsApp's own «Exportar chat» (.txt) → thread stats + candidate vocabulary.
    Media lines are counted out loud, never silently dropped (S4's rule)."""
    import historial
    try:
        return await historial.chat_propose(
            ctx["tenant_slug"], canon(phone), str((payload or {}).get("text") or ""),
            customer_sender=str((payload or {}).get("customer_sender") or ""))
    except ValueError as e:
        raise _err(400, "bad_chat", str(e))


@router.post("/customers/{phone}/history/chat/accept")
async def sup_hist_chat_accept(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    import historial
    links = [l for l in (payload or {}).get("links", []) if isinstance(l, dict)]
    if not links:
        raise _err(400, "nothing_accepted", "No has vinculado ninguna palabra.")
    out = await historial.chat_accept(ctx["tenant_slug"], canon(phone), links, ctx["actor_email"])
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "historial.chat", target_id=canon(phone)[-4:],
                            detail={"linked": len(out["linked"]), "refused": out["refused"]})
    return out


# ── §17.36 · ENVÍOS — the named dispatch schedules (WP-D6b) ──────────────────────────────────
@router.get("/sends")
async def sup_sends(ctx: dict = Depends(require_cap("read"))):
    import dispatch_sched
    return {"schedules": await dispatch_sched.list_for(ctx["tenant_slug"])}


@router.post("/sends")
async def sup_sends_create(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Create a scheduled send. §17.36's permission split: the office runs everything INTERNAL;
    only the owner ticks external consent — so an external recipient needs admin:negocio, and
    the consent is recorded as the acting owner's email (the CHECK constraint refuses the row
    without it, from every path)."""
    import dispatch_sched
    p = payload or {}
    external = bool(p.get("external"))
    if external:
        role_caps = sup_session.ROLE_CAPS.get(ctx["role"], frozenset())
        if "admin:negocio" not in role_caps:
            raise _err(403, "owner_only",
                       "Un envío fuera de tu equipo lo autoriza el propietario.")
    try:
        out = await dispatch_sched.create(
            ctx["tenant_slug"], name=str(p.get("name") or ""),
            purpose=str(p.get("purpose") or "otro"),
            format_id=str(p.get("format_id") or "standard"),
            cadence={"at": str(p.get("at") or ""), "days": p.get("days")},
            categories=[str(c) for c in (p.get("categories") or [])],
            recipients=[str(r) for r in (p.get("recipients") or [])],
            external=external, consent_by=ctx["actor_email"] if external else None,
            created_by=ctx["actor_email"])
    except ValueError as e:
        raise _err(400, "bad_schedule", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "sends.create", target_id=str(out["id"]),
                            detail={"name": p.get("name"), "external": external})
    return out


@router.post("/sends/{sched_id}")
async def sup_sends_toggle(sched_id: int, payload: dict,
                           ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Pause/resume — §17.36: the operator can always PAUSE anything."""
    import dispatch_sched
    enabled = bool((payload or {}).get("enabled"))
    ok = await dispatch_sched.set_enabled(ctx["tenant_slug"], int(sched_id), enabled)
    if not ok:
        raise _err(404, "gone", "Ese envío ya no existe.")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "sends.toggle", target_id=str(sched_id), detail={"enabled": enabled})
    return {"id": int(sched_id), "enabled": enabled}


@router.delete("/sends/{sched_id}")
async def sup_sends_delete(sched_id: int, ctx: dict = Depends(require_cap("admin:rocoto"))):
    import dispatch_sched
    ok = await dispatch_sched.delete(ctx["tenant_slug"], int(sched_id))
    if not ok:
        raise _err(404, "gone", "Ese envío ya no existe.")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "sends.delete", target_id=str(sched_id))
    return {"ok": True}


# ── §17.47 · FACTURAS DE PROVEEDORES — the module's read (WP-G3's surface half) ──────────────
@router.get("/facturas")
async def sup_facturas(ctx: dict = Depends(require_cap("read"))):
    """The tenant's forwarding address + what has arrived on it this month. The address exists
    the moment the module is ON — §17.42's forwarding pattern (never inbox access: the customer
    forwards their own alias here). The RECONCILER (month-end list vs received, drafted chases)
    is the next rung and is not pretended here."""
    import mail_inbound
    from brain import entitlement
    slug = ctx["tenant_slug"]
    on = await entitlement.is_on("facturas", slug)
    out = {"on": on, "address": f"facturas.{slug}@{mail_inbound.INBOUND_DOMAIN}"}
    if on:
        out["received"] = await mail_inbound.rows_for(slug, "facturas")
    return out


# ── §17.13 · EL ALTA — signup provisions the tenant (WP-D11) ─────────────────────────────────
#
# S0 is Supabase Google (same bearer discipline as login/invite). The FORK is the one question:
# both doors provision the SAME thing — a tenants row (status test), the owner seat, a minted
# session — because §17.13's principle is that the alta configures P1 minimally and everything
# else has a home in the panel. The light path's remaining questions (WhatsApp number, list,
# doubts) run INSIDE the fresh session through wires that already exist (/alta/whatsapp below,
# /catup's intake, /behaviour). The card (S7) is D4's lane and is not asked yet — the tenant
# stays `test`, which is exactly what «en pruebas» renders everywhere.
#
# Gated by ROCOTO_SELF_SERVE (default OFF): until Peter flips it, the door answers honestly.
SELF_SERVE = os.environ.get("ROCOTO_SELF_SERVE", "") == "1"


# The slug derivation and the three-row provisioning transaction moved to provisioning.py when
# §17.56c gave them a SECOND caller (/demo's sign-in mints a real tenant too). One writer, two
# doors: a divergent copy of this block would silently produce a workspace whose assumptions the
# other door does not hold. `_alta_slug` stays as the local name every reader of this file expects.
_alta_slug = provisioning.alta_slug


@router.post("/alta")
async def sup_alta(request: Request, response: Response, payload: dict | None = None):
    """{access_token, fork: explore|start} → a provisioned tenant + a session cookie.

    Refusals, honestly: SELF_SERVE off says the door opens soon; an email that already holds a
    membership is sent to log in instead (their org exists — a second one from a mis-click would
    strand them, §17.33's one-identity rule)."""
    ip = _client_ip(request)
    if not sup_session.rate_ok(f"alta:{ip}", limit=8, window_s=600):
        raise _err(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    if not SELF_SERVE:
        raise _err(403, "alta_closed",
                   "El alta por tu cuenta abre muy pronto. Escríbenos y te damos paso ya.")
    bearer = str((payload or {}).get("access_token") or "").strip()
    fork = str((payload or {}).get("fork") or "explore")
    if fork not in ("explore", "start"):
        raise _err(400, "bad_fork")
    user = await brain_auth.verify_token(bearer)
    if not user:
        raise _err(401, "unauthorized", "No hemos podido verificar tu sesión de Google.")
    if not brain_auth.has_matching_oauth(user):
        raise _err(403, "oauth_required", "Entra con Google — sin contraseñas.")
    email = (user.get("email") or "").strip().lower()

    async with db.get_pool().acquire() as con:
        existing = await provisioning.membership_of(con, email)
        if existing:
            raise _err(409, "already_member",
                       "Tu correo ya tiene una empresa en Rocoto — entra directamente.")
        # The unique slug + the three-row transaction, now provisioning.provision(). Behaviour is
        # unchanged: same email-derived slug, same -2/-3 suffixing, same «El negocio de X» name,
        # same op_id shape, same columns, same single transaction. No `company` is passed because
        # this door has never collected one — §17.56d③'s field is /demo's, and giving the alta a
        # different name derivation from here would be a change nobody asked for.
        # `via=VIA_ALTA` marks the DOOR on the tenant row (2026-08-09). A world minted here is
        # never reapable — `demo_flow.reap`'s new rung matches `provisioned_via='demo'` only — and
        # saying so explicitly is what keeps «the reaper reaches what the demo makes» from ever
        # becoming «the reaper reaches what the alta makes».
        out = await provisioning.provision(con, email, via=provisioning.VIA_ALTA)
        slug, name = out["slug"], out["name"]
    s = await sup_session.mint(email, slug, "owner", ip, request.headers.get("user-agent", ""))
    _set_cookie(response, s["raw"])
    await sup_session.audit(email, slug, ip, "alta.provision", detail={"fork": fork})
    return _wire_session({**s, "actor_email": email}, name, "test", onboarded=False)


@router.post("/onboarded")
async def sup_onboarded(payload: dict, ctx: dict = Depends(require_cap("read"))):
    """The first-sign-in wizard's last word (Peter, 2026-08-07): mark the tenant onboarded so
    the typeform never nags twice. `skipped` is recorded honestly — «lo relleno luego» is a
    first-class answer, and Empresa is where the holes get filled."""
    slug = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update tenants set onboarded_at = coalesce(onboarded_at, now()), "
            "updated_at = now() where slug = $1", slug)
    await sup_session.audit(ctx["actor_email"], slug, ctx.get("ip") or "", "alta.onboarded",
                            detail={"skipped": bool((payload or {}).get("skipped"))})
    return {"ok": True}


@router.post("/alta/whatsapp")
async def sup_alta_whatsapp(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """S3.1's honest half TODAY: record the number the business answers on. The Meta Embedded
    Signup (§17.3) is what ARMS it — until then Canales says `waiting_meta`, which is true."""
    number = re.sub(r"[^\d+]", "", str((payload or {}).get("number") or ""))
    if len(re.sub(r"\D", "", number)) < 9:
        raise _err(400, "bad_number", "Ese número no lo entiendo — pon el WhatsApp del negocio.")
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set number = $2, updated_at = now() where slug = $1",
                          ctx["tenant_slug"], number)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "alta.whatsapp", target_id=number[-4:])
    return {"ok": True, "number": number}


# ── §17.41/§17.33 · INVITATIONS — the roster's amber half (WP-D8/A3) ─────────────────────────
@router.get("/invitations")
async def sup_invitations(ctx: dict = Depends(require_cap("admin:negocio"))):
    """Outstanding invitations, states computed — pending/expired stay listed (expired is the row
    that wants Reenviar); accepted and revoked leave. Owner-only per §17.34."""
    from brain import invitations
    rows = await invitations.roster(ctx["tenant_slug"])
    for r in rows:
        for k in ("created_at", "expires_at", "opened_at", "accepted_at", "revoked_at", "updated_at"):
            if r.get(k) is not None and hasattr(r[k], "isoformat"):
                r[k] = r[k].isoformat()
    return {"invitations": rows}


@router.post("/invitations")
async def sup_invitation_create(payload: dict, ctx: dict = Depends(require_cap("admin:negocio"))):
    """Invite (or RE-invite — a resend supersedes the old link, §17.33). Returns the LINK, because
    the token IS the link (§17.41) and today the owner sends it themselves; the mailer rail joins
    later without changing this contract."""
    from brain import invitations
    email_in = str(payload.get("email") or "").strip().lower()
    # an ACTIVE member is not an invitee — a silent success here taught the owner nothing (R8)
    async with db.get_pool().acquire() as con:
        already = await con.fetchval(
            "select 1 from team_members tm join operators o on o.id = tm.operator_id "
            "where tm.tenant_slug=$1 and lower(o.email)=$2",
            ctx["tenant_slug"], email_in)
    if already:
        raise _err(409, "already_member", "Esa persona ya está en tu equipo — no necesita invitación.")
    try:
        inv = await invitations.create(ctx["tenant_slug"], str(payload.get("email") or ""),
                                       str(payload.get("role") or "staff"),
                                       invited_by=ctx["actor_email"])
    except ValueError as e:
        raise _err(400, "bad_invitation", str(e))
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "invitation.create", target_id=inv["email"],
                            detail={"role": inv["role"]})
    return {"ok": True, "email": inv["email"], "role": inv["role"],
            "link": f"https://app.soyrocoto.com/invite/{inv['token']}",
            "expires_at": inv["expires_at"].isoformat()}


@router.post("/invitations/revoke")
async def sup_invitation_revoke(payload: dict, ctx: dict = Depends(require_cap("admin:negocio"))):
    """Kill a live link THIS INSTANT (§17.33). Keyed by email — the roster never carries tokens."""
    from brain import invitations
    email = str(payload.get("email") or "").strip().lower()
    async with db.get_pool().acquire() as con:
        tok = await con.fetchval(
            "select token from invitation where tenant_slug=$1 and lower(email)=$2 "
            "and accepted_at is null and revoked_at is null", ctx["tenant_slug"], email)
    ok = bool(tok) and await invitations.revoke(tok)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "invitation.revoke", target_id=email, result="ok" if ok else "no_live_link")
    return {"ok": ok}


@router.get("/team")
async def sup_team(ctx: dict = Depends(require_cap("read"))):
    """The people who can enter this company. `operator_id` is ADDITIVE (the decoder ignores unknown
    fields) and load-bearing: without it a member is not addressable, and PATCH/DELETE below would
    have nothing to name. It is an internal id, never an email in a URL — see the routes."""
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select o.id, o.name, o.email, o.is_founder, tm.role from team_members tm "
            "join operators o on o.id = tm.operator_id "
            "where tm.tenant_slug = $1 order by tm.created_at", ctx["tenant_slug"])
    me = (ctx.get("actor_email") or "").lower()
    return {"members": [{
        "operator_id": r["id"], "name": r["name"] or "", "email": r["email"] or "",
        "role": ("founder" if r["is_founder"] else (r["role"] or "staff")),
        "you": (r["email"] or "").lower() == me,
    } for r in rows]}


# ── el equipo: adding a person (§5.11.3) ──────────────────────────────────────────────────────────
# THE GAP THIS CLOSES (audited 2026-07-27): `/api/sup/team` was GET-only. Nothing in the product —
# no route, no screen, no CLI — could create a second team member; `brain/teams.ensure_seed` writes
# the founder and nobody else. So the `repartidor` role shipped ungrantable: a driver's login meant
# two hand-run INSERTs on prod, with no invite, no revocation, and NO AUDIT ROW FOR THE ACT OF
# GRANTING SOMEBODY ACCESS TO A COMPANY'S DATA. That last one is why all three verbs are cap:admin
# and all three audit: granting access is the single most consequential thing anybody does on this
# surface, and it was the one thing leaving no trace.
#
# THE CONSTRAINT THAT SHAPES THE UX — READ `brain/auth.has_matching_oauth` BEFORE TOUCHING THIS.
# Elevation into a tenant is GOOGLE-OAUTH-ONLY: Supabase email-confirmation is OFF on this project,
# so a password signup is AUTO-confirmed and `email_confirmed_at` proves nothing. A driver is
# therefore added BY THE GOOGLE ACCOUNT ALREADY ON HIS PHONE, and there is no second door — not an
# invite code (bearer authority: whoever holds it is the driver), not an admin-API signup (it mints
# the password identity the gate refuses). The honest half is that we cannot verify the address is a
# Google one — a Workspace domain looks like any other — so we say so: `GOOGLE_NOTE` rides the
# response in, and `/session/login` answers a typed `oauth_required` when he later tries a password.
#
# TENANT ISOLATION: the tenant comes from the SESSION and never from the wire (there is no tenant
# field on any of these bodies to forge), and `brain/teams._member` filters every lookup by it, so an
# operator_id belonging to another company simply does not resolve → 404, never an edit.
def _you(member: dict, ctx: dict) -> dict:
    """The member wire the desk already decodes, with `you` resolved from the SESSION's actor."""
    return {**member,
            "you": (member.get("email") or "").lower() == (ctx.get("actor_email") or "").lower()}


async def _close_sessions(email: str) -> bool:
    """Kill every live session of a member whose access just changed. The role is stamped into the
    session row AT LOGIN, so a demotion or a removal that is not followed by this leaves the old caps
    alive for up to 12 h (sup_session.SESSION_TTL_S) — «le he quitado el acceso» has to be true the
    moment it is said. Fail-soft and REPORTED rather than raised: the membership write has already
    landed, and turning a completed removal into a 500 would tell the boss it did not happen. The
    caller says so out loud instead (`sessions_closed` + an es-ES note)."""
    try:
        await sup_session.revoke_all(email)
        return True
    except Exception:
        log.exception("sup team: session revoke failed for %s", email)
        return False


@router.post("/team")
async def sup_team_add(payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """THE WIRE:  POST /api/sup/team  + X-Sup-CSRF
        body {"email":"juan@gmail.com", "name":"Juan", "role":"repartidor"}
          → 200 {"ok":true,"created":true,
                 "member":{"operator_id","name","email","role","you"},"note":"<es-ES>"}
          → 400 {"error":"bad_member","detail":"<es-ES>"}  — unknown role · not an address · the
                 last owner re-added as something that cannot open Ajustes
          → 404 {"error":"no_such_tenant","detail":"<es-ES>"}
    `detail` is written for the boss and is rendered VERBATIM (the `bad_range` convention).

    «Ajustes → Equipo → + Repartidor». `role` defaults to `repartidor` because that is what this door
    was built for and it is the least privilege on offer; `owner` and `staff` are the other two, and
    `founder` is refused (it is Rocoto's own seeded identity, not a rank a company hands out).

    An address ALREADY on the team is a role change, not a second row — the response says
    `created:false` so the desk can word it as one. Nothing is sent to the person from here: the
    invitation IS the Google address, and `note` is the sentence the boss has to pass on."""
    from brain import teams as brain_teams
    p = payload or {}
    try:
        async with db.get_pool().acquire() as con:
            out = await brain_teams.add(con, ctx["tenant_slug"],
                                        str(p.get("email") or ""),
                                        name=str(p.get("name") or ""),
                                        role=str(p.get("role") or brain_teams.REPARTIDOR))
    except LookupError:
        raise _err(404, "no_such_tenant", "Tu empresa no está en este servidor.")
    except ValueError as e:
        raise _err(400, "bad_member", str(e))
    member = out.get("member") or {}
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "team.add",
                            target_id=member.get("operator_id") or "",
                            detail={"role": member.get("role"), "created": bool(out.get("created"))})
    return {"ok": True, "created": bool(out.get("created")), "member": _you(member, ctx),
            "note": out.get("note") or ""}


@router.patch("/team/{operator_id}")
async def sup_team_role(operator_id: str, payload: dict, ctx: dict = Depends(require_cap("admin"))):
    """THE WIRE:  PATCH /api/sup/team/{operator_id}  + X-Sup-CSRF
        body {"role":"staff"}
          → 200 {"ok":true,"member":{…},"was":"repartidor","sessions_closed":true,"note":"<es-ES>"}
          → 400 {"error":"bad_member","detail":"<es-ES>"}   → 404 {"error":"no_such_member"}

    The LAST owner cannot be demoted: a company with nobody holding `admin` can never open Ajustes
    again, and there is no way back that is not a hand-run INSERT on prod. The refusal names the fix.

    His live sessions are closed here, because the role travels in the session row from the moment it
    was minted — a demotion alone would leave the old caps alive for up to 12 h."""
    from brain import teams as brain_teams
    try:
        async with db.get_pool().acquire() as con:
            out = await brain_teams.set_role(con, ctx["tenant_slug"], operator_id,
                                             str((payload or {}).get("role") or ""))
    except LookupError:
        raise _err(404, "no_such_member", "Esa persona no está en tu equipo.")
    except ValueError as e:
        raise _err(400, "bad_member", str(e))
    member = out.get("member") or {}
    closed = await _close_sessions(out.get("email") or "")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "team.role",
                            target_id=operator_id,
                            detail={"was": out.get("was"), "now": member.get("role"),
                                    "sessions_closed": closed})
    return {"ok": True, "member": _you(member, ctx), "was": out.get("was") or "",
            "sessions_closed": closed,
            "note": "" if closed else "Le he cambiado el rol, pero puede que su sesión siga abierta "
                                      "un rato. Si corre prisa, avísame."}


@router.delete("/team/{operator_id}")
async def sup_team_remove(operator_id: str, ctx: dict = Depends(require_cap("admin"))):
    """THE WIRE:  DELETE /api/sup/team/{operator_id}  + X-Sup-CSRF
          → 200 {"ok":true,"removed":{…},"sessions_closed":true,"note":"<es-ES>"}
          → 400 {"error":"bad_member","detail":"<es-ES>"}   → 404 {"error":"no_such_member"}

    The MEMBERSHIP goes; the operator row stays. `delivery_stops.delivered_by` and
    `delivery_settlements.recorded_by` carry `operators.id`, so deleting the person would orphan the
    signature on deliveries that happened and money somebody actually took. Losing the membership is
    losing the access, which is what was asked for.

    Same two refusals as PATCH (the Rocoto account, the last admin), and the same revocation — an
    access we say we removed must be removed the moment we say it."""
    from brain import teams as brain_teams
    try:
        async with db.get_pool().acquire() as con:
            out = await brain_teams.remove(con, ctx["tenant_slug"], operator_id)
    except LookupError:
        raise _err(404, "no_such_member", "Esa persona no está en tu equipo.")
    except ValueError as e:
        raise _err(400, "bad_member", str(e))
    closed = await _close_sessions(out.get("email") or "")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "team.remove",
                            target_id=operator_id,
                            detail={"role": (out.get("removed") or {}).get("role"),
                                    "sessions_closed": closed})
    return {"ok": True, "removed": _you(out.get("removed") or {}, ctx), "sessions_closed": closed,
            "note": "" if closed else "Le he quitado del equipo, pero puede que su sesión siga "
                                      "abierta un rato. Si corre prisa, avísame."}


# ══ EL AVISO — LA PUERTA DEL JEFE (§5.11.5) ══════════════════════════════════════════════════════
# THE GAP THIS CLOSES (audited 2026-07-27). `avisos.py` shipped whole and only ONE of its two authors
# could reach it: `delivery.sync_overdue_aviso` writes the money aviso, the driver's door resolves it,
# and everything the BOSS is supposed to do had no route at all. `write_nota`, `list_for_jefe`,
# `thread` and `generate_options` had no caller outside their own vital — so «Nota para el
# repartidor» could not be written, «LO QUE TE TOCA» could not be read, and the loop that is the
# entire feature (a driver answers → the boss is briefed → he writes back → it lands at that
# customer's next stop) terminated at the first rung with nobody to receive it. This block is that
# door, and it adds no machinery: every function below is `avisos.py`'s, called.
#
# THE FENCE IS THE BOSS'S QUEUE ITSELF. There is no «get one aviso by id» here and there deliberately
# is not one: an aviso this session may act on is BY DEFINITION one that `avisos.list_for_jefe`
# already returns — this tenant's, addressed to the JEFE, still open. Resolving anything through that
# set means a driver's own avisos, another company's rows and an already-closed thread are all the
# same refusal, and none of them is confirmed to exist. `avisos.resolve(audience=JEFE)` applies the
# same narrowing in SQL underneath, so the fence is doubled rather than trusted once.
#
# THE COMERCIAL DECIDES; THE AI BRIEFS. `generate_options` proposes phrases and nothing else. It
# takes no action, it never messages a customer, and — the part that is a rule and not a preference —
# whether the boss is CLOSING the thread or WRITING BACK is never read out of the phrase he tapped.
# See `_responder()`.

# How far down his own queue a boss may reach. It bounds BOTH doors from one number, so «tu cola» is
# one set: a row the list did not show him is a row he cannot resolve, and the two can never disagree
# about which those are.
JEFE_QUEUE_MAX = 200


def _responder() -> dict:
    """THE WRITE-BACK DOOR, DECLARED BY THE SERVER — the one control on the boss's questionnaire that
    is not a generated phrase, and the reason the loop cannot continue or end by accident.

    `avisos.py` refused, by name, «reading "write back" out of the boss's chosen phrase»: the options
    are model-written text, and a generated string is not a control signal — a re-worded option would
    otherwise silently change what happens to a conversation. So writing back is its own ARGUMENT
    (`reply=`), and this is what tells the client which argument its text belongs in: `campo` is the
    body key, literally. Tapping any option — including one that happens to READ like «le escribo al
    repartidor» — carries no reply and therefore CLOSES the thread, which is `avisos.next_rung`'s
    rule and not this file's.

    Two free-text doors on that screen, and they mean different things on purpose: «Otra cosa» is
    `note` (he types what happened; the thread still ends) and this one is `reply` (he types to his
    driver; it lands at that customer's next stop). One label could not carry both."""
    return {"id": "responder", "campo": "reply", "label": "Le escribo al repartidor",
            "ayuda": "Lo que escribas aquí le llega al repartidor en la próxima parada de este "
                     "cliente."}


async def _audit_read(ctx: dict, action: str, *, target_id: str = "",
                      detail: dict | None = None) -> None:
    """Audit a READ without letting the audit become the answer.

    `sup_session.audit` re-raises on purpose — a lost audit on a money/state action is not acceptable
    — and every write below keeps that. But «LO QUE TE TOCA» is a list, and an unwritable audit table
    turning the boss's queue into a 500 would hide the very thing he opened it to see. Fail soft on
    the read, never on the rule (`reparto_api._audit(soft=True)`'s reasoning, and `_audit_soft`'s
    below)."""
    try:
        await sup_session.audit(ctx.get("actor_email") or "", ctx.get("tenant_slug") or "",
                                ctx.get("ip") or "", action, target_id=target_id or None,
                                detail=detail)
    except Exception:
        log.exception("sup avisos: read audit failed action=%s", action)


async def _aviso_context(con, tenant: str, phone: str, customer: str, audience: str) -> dict:
    """What the questionnaire's model is allowed to know about this customer — and NOTHING numeric of
    its own.

    Every figure here is `delivery.owed`'s, already formatted by `delivery.euros`, because the ledger
    owns every euro in this feature and `avisos._clean` drops any option carrying a figure that was
    not in this dict. Two absences are kept as absences rather than filled: a customer who owes
    nothing contributes NO «LO QUE DEBE» line (not «0,00 €», which is a claim), and one whose
    deliveries were never valued contributes none either — `delivery.euros(None)` is «sin importe»,
    which is the truth on a screen and would be noise in a prompt.

    Fail-soft, and it costs only sharpness: an unreadable ledger yields a DULLER question, never a
    wrong one, because the generic set is underneath every path (`avisos.generate_options`)."""
    ctx: dict = {"audience": audience, "customer": customer or ""}
    try:
        import delivery
        pos = await delivery.owed(con, tenant, phone)
    except Exception:
        log.debug("sup avisos: ledger context fail-soft for the questionnaire", exc_info=True)
        return ctx
    if not pos["count"]:
        return ctx
    if pos["label"] != delivery.euros(None):        # a real sum, not «sin importe»
        ctx["owed_label"] = pos["label"]
    ctx["age_label"] = delivery.age_label(int(pos["oldest_days"] or 0))
    return ctx


@router.post("/customers/{phone}/nota")
async def sup_customer_nota(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE WIRE:  POST /api/sup/customers/+34600000001/nota  + X-Sup-CSRF
        body {"body":"Que me pague los dos albaranes de junio, que ya vale", "band":"nota"}
          → 200 {"ok":true, "aviso":{…avisos.shape…}}
          → 400 {"error":"bad_nota","detail":"<es-ES, render it verbatim>"}
          → 404 {"error":"no_such_customer","detail":"<es-ES>"}

    **«NOTA PARA EL REPARTIDOR»** — the boss writing from the customer ficha, typed or dictated, and
    the second of the two authors an aviso can have. It surfaces on the NEXT STOP FOR THAT CUSTOMER
    and nowhere else, which is the whole design: a note nobody has to remember to go and look for.

    A NOTA BELONGS TO THE CUSTOMER, NOT TO A DRIVER, so there is no driver on this wire and no way to
    address one. He is not writing to Manolo-who-drives-on-Tuesdays; he is writing something true
    about Casa Bermejo, and whoever stands at that door next is the one who needs to read it.

    DICTATION IS ALREADY TEXT by the time it arrives — a voice note nobody plays is not a record
    (`delivery.attach` and `avisos.py` say the same thing).

    THE CUSTOMER IS CHECKED FIRST, tenant-filtered, and a phone that is not on this tenant's books
    404s. `avisos.write_nota` would happily accept any string: it is a store, and refusing to invent
    a customer is the door's job. It is also the tenant fence — another company's restaurant is not
    a customer here, and saying so is the same sentence as not knowing him at all.

    `subrayado` is REFUSED here and only here. The band is not a colour, it is the attention rank, and
    `avisos.py` reserves the underlined one for the money aviso: if every note is underlined, nothing
    is, and the one that means «this man is owed 480,20 €» stops being visible. The field is still
    accepted rather than ignored, because a silently dropped band is a setting the boss thinks he
    made."""
    import avisos
    from brain import teams as brain_teams
    p = canon(phone)
    if not p:
        raise _err(400, "bad_phone", "Ese número no lo entiendo.")
    body = str((payload or {}).get("body") or "")
    band = str((payload or {}).get("band") or avisos.BANDA_NOTA).strip()
    if band == avisos.BANDA_SUBRAYADO:
        raise _err(400, "banda_reservada",
                   "La banda subrayada es solo para lo que el cliente debe. Tu nota va en la banda "
                   "normal y se lee igual de bien en la puerta.")
    async with db.get_pool().acquire() as con:
        known = await con.fetchval(
            "select display_name from customer_profiles where tenant_id = $1 and phone_number = $2",
            ctx["tenant_slug"], p)
        if known is None:
            raise _err(404, "no_such_customer",
                       "Ese cliente no está en tu lista. Compruébalo antes de dejarle una nota.")
        by = await brain_teams.operator_id_for(con, ctx["tenant_slug"], ctx.get("actor_email") or "")
        try:
            # `write_nota` validates BEFORE it touches the connection and refuses in es-ES, naming
            # the fix — passed through verbatim rather than re-worded, so one module owns the
            # sentence a supplier reads after losing what he typed.
            aviso = await avisos.write_nota(con, ctx["tenant_slug"], p, body,
                                            audience=avisos.REPARTIDOR, band=band, by=by)
        except ValueError as e:
            raise _err(400, "bad_nota", str(e))
    # NON-PII, like every other row in `sup_audit`: how long it was and which band, never the note. A
    # nota is a business fact about a named restaurant, and the audit trail is not where it belongs.
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "customer.nota",
                            target_id=p[-4:],
                            detail={"aviso_id": aviso["id"], "chars": len(aviso["body"]),
                                    "band": aviso["band"]})
    return {"ok": True, "aviso": aviso}


@router.get("/delivery/avisos")
async def sup_avisos(ctx: dict = Depends(require_cap("read"))):
    """THE WIRE:  GET /api/sup/delivery/avisos
        → 200 {"avisos":[{…avisos.shape…, "customer":"Casa Bermejo"}], "count":1}

    **«LO QUE TE TOCA», the delivery half** — every open aviso addressed to the boss, across all his
    customers, oldest first, each carrying the customer's name off the ficha so his queue reads as a
    person and not a phone number. `avisos.list_for_jefe` is the query; this route adds nothing to it.

    These are the rungs a DRIVER raised: he answered a note at somebody's door and the counter-aviso
    carries his own words, verbatim. They are also the only avisos this door can reach — the money
    aviso is addressed to the repartidor (it is for the man who is about to be paid, at the door
    where he is about to be paid) and never appears here.

    Fail-soft underneath: an unreadable table is an EMPTY queue, not a broken screen. That is the
    module's rule and it is right for a list — but it means an empty response says «nothing is
    waiting», so the write paths below deliberately do not share it."""
    async with db.get_pool().acquire() as con:
        import avisos
        queue = await avisos.list_for_jefe(con, ctx["tenant_slug"], limit=JEFE_QUEUE_MAX)
    await _audit_read(ctx, "avisos.queue", detail={"open": len(queue)})
    return {"avisos": queue, "count": len(queue)}


@router.get("/aviso/{aviso_id}/opciones")
async def sup_aviso_opciones(aviso_id: int, ctx: dict = Depends(require_cap("read"))):
    """THE WIRE:  GET /api/sup/aviso/17/opciones
        → 200 {"aviso":{…}, "hilo":[…], "opciones":[{"id":"o1","label":"…","free":false}, …],
               "responder":{"id":"responder","campo":"reply","label":"…","ayuda":"…"}}
        → 404 {"error":"no_such_aviso","detail":"<es-ES>"}

    **THE BOSS'S OWN QUESTIONNAIRE** — the full-screen, one-question, 3–4-big-options shape, generated
    for THIS aviso, whose options are the moves actually available to a man at a desk: close it ·
    write back to the driver · chase the customer himself. Not a fixed list: a rung that says «me ha
    pagado uno solo · el de junio» yields outcomes about that albarán.

    GENERATED AT THE DOOR AND NEVER CACHED, deliberately (`avisos.py`'s refusal #4): the options
    depend on the customer's state right now, and a set generated when the aviso was raised can be
    about a debt that has since been paid. A stale question is worse than a duller one.

    **AND NOTHING BLOCKS HIM EITHER.** `generate_options` cannot raise and cannot hang — no key, a
    dead model, four seconds of silence, junk in the tool call all land on the generic set, and the
    aviso resolves identically because `resolve()` takes the option's TEXT and has no idea where it
    came from. The model is on this path to make the question better, never to make it possible.

    `hilo` is the whole conversation this rung belongs to, oldest first — what the note originally
    said, what the driver answered, and anything already written back. He is deciding about an
    exchange, not about a sentence.

    `responder` is the write-back door and it is the one control the model did not write. See
    `_responder()`: tapping an option closes the thread; only text in `reply` continues it."""
    import avisos
    async with db.get_pool().acquire() as con:
        tenant = ctx["tenant_slug"]
        # HIS OWN QUEUE IS THE FENCE — see the block header. An aviso addressed to a driver, one that
        # is already resolved and one belonging to another company are the SAME refusal, and none of
        # them is confirmed to exist by a different sentence.
        queue = await avisos.list_for_jefe(con, tenant, limit=JEFE_QUEUE_MAX)
        current = next((a for a in queue if a["id"] == int(aviso_id)), None)
        if not current:
            raise _err(404, "no_such_aviso", "Ese aviso ya no está en tu lista. Vuelve a abrirla.")
        hilo = await avisos.thread(con, tenant, int(aviso_id))
        qctx = await _aviso_context(con, tenant, current["phone_number"],
                                    current.get("customer") or "", avisos.JEFE)
    opciones = await avisos.generate_options(current["body"], qctx)
    await _audit_read(ctx, "aviso.opciones", target_id=str(aviso_id),
                      detail={"opciones": len(opciones),
                              "generico": opciones == avisos.fallback_options(avisos.JEFE)})
    return {"aviso": current, "hilo": hilo, "opciones": opciones, "responder": _responder()}


@router.post("/aviso/{aviso_id}/resolver")
async def sup_aviso_resolver(aviso_id: int, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE WIRE:  POST /api/sup/aviso/17/resolver  + X-Sup-CSRF
        body {"choice":"Lo hablo yo con el cliente", "note":"", "reply":""}
          → 200 {"aviso":{…},"raised":{…}|null,"already":false}
        body {"choice":"Le escribo al repartidor", "reply":"Que no le deje nada hasta que pague"}
          → 200 {"aviso":{…},"raised":{…un `nota` para el repartidor…},"already":false}
          → 400 {"error":"bad_resolution","detail":"<es-ES, verbatim>"}
          → 404 {"error":"no_such_aviso","detail":"<es-ES>"}

    **`reply` IS THE BRANCH, AND IT IS AN ARGUMENT — NEVER A PHRASE.** Whether this closes the thread
    or sends the next nota to the driver is decided by `avisos.next_rung` on whether `reply` carries
    text, and by nothing else. The option he tapped is stored verbatim as WHAT HE SAID and is never
    read as WHAT TO DO: those options are model-written, and a re-worded one must not be able to
    quietly change what happens to a conversation between two people. The client puts its text in
    `reply` because `_responder()` told it to, in a field named `campo`.

    So the three endings are all reachable and all deliberate:
      · a tapped outcome, no reply → the thread ENDS. The common ending, and the honest one.
      · `reply` with text          → the next `nota`, at that customer's next stop, threaded by
                                     `parent_id`. The loop has gone round once more because a human
                                     chose to; each rung costs a tap, so it cannot run away.
      · a second tap in the rain   → `already:true`, nothing written, nothing raised. His driver never
                                     gets the same message twice.

    `audience=avisos.JEFE` narrows the SELECT, so this door cannot reach the DRIVER'S avisos whatever
    integer arrives — including the money aviso, which is not an opinion and does not close by hand.

    No event is emitted here: `avisos.resolve` writes `aviso.resolved` (and `aviso.raised` for the
    next rung) on the same spine, and a second copy from the router would double the timeline."""
    import avisos
    from brain import teams as brain_teams
    p = payload or {}
    tenant = ctx["tenant_slug"]
    try:
        async with db.get_pool().acquire() as con:
            by = await brain_teams.operator_id_for(con, tenant, ctx.get("actor_email") or "")
            out = await avisos.resolve(con, tenant, int(aviso_id),
                                       choice=str(p.get("choice") or ""),
                                       note=str(p.get("note") or ""),
                                       reply=str(p.get("reply") or ""),
                                       by=by, audience=avisos.JEFE)
    except ValueError as e:
        raise _err(400, "bad_resolution", str(e))
    except LookupError:
        raise _err(404, "no_such_aviso", "Ese aviso ya no está en tu lista. Vuelve a abrirla.")
    raised = out.get("raised") or None
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "aviso.resuelto",
                            target_id=str(aviso_id),
                            detail={"already": out["already"], "respondido": bool(raised),
                                    "raised_id": (raised or {}).get("id")})
    return out


# ── el mundo de prueba (Ajustes → «Reiniciar los datos de demostración») ──────────────────────────
# Peter's ask, verbatim: "my account with seeded data that i can even reset once i showed it to
# someone". He shows the desk to a prospect, the world gets dirty, and he needs it pristine again in
# ONE PRESS — without an agent, an ssh session, or a script only the builder can run. This is that
# door, and nothing here re-implements the reset: `brain/seed.reset_demo_seed` already owns it and is
# safe by construction (it deletes only rows carrying its own mark, refuses a tenant that is not the
# demo tenant, and refuses outright on a seed mark it did not mint). All this adds is a way in.
#
# THE FENCE, and it is the whole reason this route exists rather than a curl:
#   · the tenant is read from the SERVER-SIDE SESSION and is never accepted from the client — there
#     is no tenant parameter on this wire to forge;
#   · `_require_runtime` refuses a session belonging to a tenant this deployment does not serve;
#   · the session's tenant must BE `seed.DEMO_TENANT`, or 403 — the second wall, checked here so the
#     desk gets a typed refusal instead of a ValueError from three layers down;
#   · cap:admin, plus the CSRF double-submit `require_sup` already enforces on every POST;
#   · a literal confirmation word in the body. A reset is not an undo, and a button that fires on a
#     stray POST is a button that will one day fire on a stray click.
# Every press lands in the append-only `sup_audit`, refusals included.
_DEMO_RESET_WORD = "REINICIAR"

# One press at a time. A double-click (or the phone and the desk at once) would otherwise run two
# teardowns over each other; the second would see the first's half-built world and could call it
# foreign. NOTE: this serialises THIS door only — app.py's founder route calls the same function and
# is not covered, which is acceptable while the two are never pressed together, and is the reason the
# lock is documented here rather than hidden.
_demo_reset_lock = asyncio.Lock()


def _seed_module():
    """Imported lazily and BY NAME: `brain.seed` pulls in the embedder and the matcher, and the desk
    must not pay that at import time — nor fail to start if the seed module is mid-edit."""
    from brain import seed as brain_seed
    return brain_seed


# The audit's `{table: n}` verdict, in the boss's own words. LANGUAGE LAW §0.11: the seeder's
# exception text is English (it is written for whoever reads the log), and pasting it into `detail`
# put an English sentence on an es-ES screen. So the tables are named here, and anything this map
# does not know is COUNTED but not named — never transliterated into a guess.
_FOREIGN_ES = {
    "orders": ("pedido", "pedidos"),
    "whatsapp_messages": ("mensaje", "mensajes"),
    "catalogue_skus": ("artículo del catálogo", "artículos del catálogo"),
    "customer_profiles": ("ficha de cliente", "fichas de cliente"),
    "calls": ("llamada", "llamadas"),
    "action_other_world": ("acción de otro mundo de prueba", "acciones de otro mundo de prueba"),
    "event_other_world": ("apunte de otro mundo de prueba", "apuntes de otro mundo de prueba"),
}


async def _audit_soft(ctx: dict, slug: str, result: str, detail: dict | None = None) -> None:
    """Audit a REFUSAL without letting the audit become the answer.

    `sup_session.audit` re-raises on a failed write on purpose — a lost audit on a money/state action
    is not acceptable. But on the refusal paths the write has already been prevented, and letting a
    dead audit table turn a clean, legible 403/409 into an opaque 500 would hide the very refusal the
    founder needs to read. Same call the login-refusal path makes, for the same reason."""
    try:
        await sup_session.audit(ctx.get("actor_email") or "", slug, ctx.get("ip") or "",
                                "demo.reset", detail=detail, result=result)
    except Exception:
        log.exception("sup demo reset: refusal audit failed (result=%s)", result)


def _refusal_es(e: Exception) -> str:
    """A refusal a founder can act on: WHAT was found, WHERE, and that nothing was deleted."""
    foreign = getattr(e, "foreign", None)
    named, other = [], 0
    for table, n in (foreign or {}).items():
        try:
            n = int(n)
        except (TypeError, ValueError):
            continue
        if n <= 0:
            continue
        words = _FOREIGN_ES.get(table)
        if words:
            named.append(f"{n} {words[0] if n == 1 else words[1]}")
        else:
            other += n
    if other:
        named.append(f"{other} más")
    if not named:
        return ("El reinicio se ha parado sin borrar nada. Avísanos antes de volver a intentarlo.")
    return ("El reinicio se ha parado y no se ha borrado nada: hay filas marcadas como datos de "
            f"prueba que no ha creado este cargador ({' · '.join(named)}). Míralas antes de "
            "reiniciar.")


async def _heal_seed_tenants() -> None:
    """`brain/seed.py` writes several of its orders with raw `insert into orders (...)` and is owned
    elsewhere, so those rows carry no `tenant_id` — and a NULL tenant is invisible to every
    tenant-filtered read, i.e. the demo's Pedidos tab would come back EMPTY from a reset. Heal the
    holes at the door that triggered the reset rather than leaving them until the next restart."""
    try:
        await db.heal_order_tenants()
    except Exception:
        log.debug("post-seed tenant heal fail-soft", exc_info=True)


def _demo_receipt(res: dict) -> dict:
    """The reset's own receipt, narrowed to what the desk renders. `created` carries heavy diagnostic
    structures (`brain_intake` and friends) that have no business on a UI wire, so only the scalar
    counts cross — dropping them here rather than letting a nested datetime decide the response is
    serialisable at 3 a.m. in front of a prospect."""
    created = res.get("created") if isinstance(res.get("created"), dict) else {}
    removed = res.get("removed") if isinstance(res.get("removed"), dict) else {}

    def _scalars(d: dict) -> dict:
        return {k: v for k, v in d.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}

    # A COUNT OF SKIPS IS NOT A COUNT OF CREATIONS. `load_demo_seed` returns both on one dict
    # (`contacts` beside `contacts_skipped`, `skipped_real`, `silenced`), and summing them into one
    # «se han creado N filas» would be the surface inventing a number. They cross as their own
    # bucket, so nothing is dropped either — the skips are the collision law working, and hiding
    # them would be the opposite of what this receipt is for.
    def _is_skip(k: str) -> bool:
        return "skipped" in k or k == "silenced"

    made = _scalars(created)
    return {
        "removed": _scalars(removed),
        "created": {k: v for k, v in made.items() if not _is_skip(k)},
        "skipped": {k: v for k, v in made.items() if _is_skip(k)},
        "collisions": [{"table": str(c.get("table") or ""), "key": str(c.get("key") or ""),
                        "kept": str(c.get("kept") or ""), "why": str(c.get("why") or "")}
                       for c in (res.get("collisions") or []) if isinstance(c, dict)][:60],
        "preserved": [str(p) for p in (res.get("preserved") or [])],
        "foreign": _scalars(res.get("foreign") if isinstance(res.get("foreign"), dict) else {}),
    }


@router.get("/demo")
async def sup_demo(ctx: dict = Depends(require_cap("read"))):
    """«¿Está el mundo de prueba, cuándo se cargó, qué hay dentro, y qué NO se tocaría?»

    A session whose tenant is not the demo tenant gets an honest 200 saying so — `resettable:false`
    and no counts — rather than a 403: a desk that shows an error where it simply has no demo world
    reads as broken. The refusal that matters is on the POST."""
    seed = _seed_module()
    slug = ctx.get("tenant_slug") or ""
    if not sup_session.owns_runtime(slug) or slug != seed.DEMO_TENANT:
        return {"seeded": False, "resettable": False, "tenant": slug,
                "reason": "not_demo_tenant", "counts": {}, "collisions": []}
    return await seed.world_state(slug)


@router.post("/demo/reset")
async def sup_demo_reset(payload: dict | None = None, ctx: dict = Depends(require_cap("admin"))):
    """«Reiniciar los datos de demostración» — tear the seeded world down and build it back, so the
    next demo starts from the same Tuesday. Body: {"confirm": "REINICIAR"}.

    WHAT IT DESTROYS is stated by `/api/sup/demo` before the press and again in the receipt: only
    rows carrying the seed's own mark. Anything real on this box — a live order, a live message, a
    customer profile somebody typed, an operator-edited catalogue row, a delivery radius — survives,
    and every place the rebuild met one is named in `collisions`.

    THREE REFUSALS, and each stops the reset BEFORE anything is deleted:
      403 not_demo_tenant — this session's tenant is not the demo tenant.
      400 confirm_required — the confirmation word is missing (nothing was even read).
      409 reset_refused    — `_audit_foreign` found a row wearing a seed mark this seeder could not
                             have minted. That is the safety story working, not a bug: say what it
                             found, because a founder who reads «no se pudo» presses again."""
    seed = _seed_module()
    slug = ctx.get("tenant_slug") or ""
    # The demo-tenant fence FIRST, because it is the specific and legible refusal: on every normal
    # deployment `DEMO_TENANT == config.BRAIN_TENANT`, so a foreign session fails both walls and
    # «esta cuenta no es la de demostración» is the sentence that actually explains why. The runtime
    # fence stays behind it for the exotic case where the two are configured apart.
    if slug != seed.DEMO_TENANT:
        await _audit_soft(ctx, slug, "not_demo_tenant")
        raise _err(403, "not_demo_tenant",
                   "Esta cuenta no es la cuenta de demostración, así que aquí no hay nada que "
                   "reiniciar.")
    _require_runtime(ctx)
    if str((payload or {}).get("confirm") or "").strip().upper() != _DEMO_RESET_WORD:
        raise _err(400, "confirm_required",
                   f"Escribe {_DEMO_RESET_WORD} para confirmar. Esto no se puede deshacer.")
    if _demo_reset_lock.locked():
        raise _err(409, "reset_running", "Ya se está reiniciando. Espera a que termine.")
    async with _demo_reset_lock:
        try:
            res = await seed.reset_demo_seed(slug)
        except (RuntimeError, ValueError) as e:
            log.warning("sup demo reset REFUSED tenant=%s: %s", slug, e)
            await _audit_soft(ctx, slug, "refused", {"refused": type(e).__name__})
            raise _err(409, "reset_refused", _refusal_es(e))
        except Exception:
            log.exception("sup demo reset failed tenant=%s", slug)
            await _audit_soft(ctx, slug, "error")
            raise _err(500, "reset_failed", "No se ha podido reiniciar el mundo de prueba.")
    await _heal_seed_tenants()
    receipt = _demo_receipt(res if isinstance(res, dict) else {})
    state = await seed.world_state(slug)
    await sup_session.audit(ctx["actor_email"], slug, ctx["ip"], "demo.reset",
                            detail={"removed": receipt["removed"], "created": receipt["created"],
                                    "collisions": len(receipt["collisions"])}, result="ok")
    return {"ok": True, **receipt, **state}


# ── LOS MUNDOS DE PRUEBA — perfiles con nombre, uno activo (PRODUCT-SPEC §5.10.3) ─────────────────
# Peter, verbatim: *"can we make another seed profile, and it lets me switch for company? … in the
# founder settings, I wanted to let me choose which seed data profile it is. And I can, like, name
# them and stuff."*
#
# THE FENCE IS THE FOUNDER'S, not merely an admin's. `require_cap('admin')` is every owner of every
# tenant; activating a profile DESTROYS the world currently in the tables, so this door additionally
# demands the founder role AND the demo tenant. Both are read from the SERVER-SIDE SESSION — there is
# no tenant and no role on this wire to forge — and every press lands in the append-only `sup_audit`.
#
# WHAT «ACTIVAR» DOES, said before it is pressed and again afterwards: `GET …/profiles/{id}/preview`
# is two numbers per table (what goes, what stays); the POST returns `reset_demo_seed`'s own receipt
# plus `from_profile`/`to_profile`. Nothing here re-implements any of it — `brain/seed` owns the
# registry, the validator and the teardown, and this is a way in.

def _require_founder(ctx: dict) -> str:
    """Founder + demo tenant, or a typed refusal. Returns the slug."""
    slug = ctx.get("tenant_slug") or ""
    if (ctx.get("role") or "") != "founder":
        raise _err(403, "founder_only", "Sólo el fundador puede cambiar el mundo de prueba.")
    if slug != _seed_module().DEMO_TENANT:
        raise _err(403, "not_demo_tenant",
                   "Esta cuenta no es la cuenta de demostración, así que aquí no hay mundos de "
                   "prueba que cambiar.")
    return slug


def _profile_error(e: Exception) -> SupApiError:
    """A `ProfileRejected` already carries the Spanish sentence and a machine code — the route's job
    is to hand both across, never to re-word one or flatten the other into a 500."""
    return _err(400, getattr(e, "reason", "profile_rejected") or "profile_rejected", str(e))


@router.get("/demo/profiles")
async def sup_demo_profiles(ctx: dict = Depends(require_cap("read"))):
    """«¿Qué mundos hay, cuál está puesto, y qué hay dentro de cada uno?»

    Read-only, so a non-founder session gets an honest empty list rather than a 403: a screen that
    shows an error where it simply has nothing to offer reads as broken. The refusals that matter are
    on the writes."""
    seed = _seed_module()
    slug = ctx.get("tenant_slug") or ""
    if (ctx.get("role") or "") != "founder" or slug != seed.DEMO_TENANT:
        return {"active": "", "profiles": [], "reason": "not_founder"}
    return await seed.list_profiles()


@router.get("/demo/profiles/{profile_id}/preview")
async def sup_demo_profile_preview(profile_id: str, ctx: dict = Depends(require_cap("admin"))):
    """What activating THIS world would do — before anything is deleted. Two numbers per table."""
    seed = _seed_module()
    slug = _require_founder(ctx)
    try:
        return await seed.switch_preview(profile_id, slug)
    except ValueError as e:
        raise _profile_error(e)


@router.post("/demo/profiles")
async def sup_demo_profile_create(payload: dict | None = None,
                                  ctx: dict = Depends(require_cap("admin"))):
    """Mint one of the founder's OWN worlds: {name, from_profile_id?, body?}. Validated before it is
    stored — a profile that could not seed must never be listed as one that can."""
    seed = _seed_module()
    slug = _require_founder(ctx)
    p = payload or {}
    try:
        res = await seed.create_profile(
            str(p.get("name") or "").strip(),
            from_profile_id=str(p.get("from_profile_id") or "").strip(),
            body=p.get("body") if isinstance(p.get("body"), dict) else None)
    except ValueError as e:
        await _audit_soft(ctx, slug, "profile_rejected", {"reason": getattr(e, "reason", "")})
        raise _profile_error(e)
    await sup_session.audit(ctx["actor_email"], slug, ctx["ip"], "demo.profile.create",
                            detail=res, result="ok")
    return {"ok": True, **res, **(await seed.list_profiles())}


# Both verbs, ONE handler. PATCH is the honest verb for a partial edit and is what the phone uses;
# the desk's shared `http` helper carries get/post/put/del and this pass does not own that file, so
# the POST alias exists rather than a second implementation of the rule (or an edit to a shared
# module for the sake of one verb).
@router.patch("/demo/profiles/{profile_id}")
@router.post("/demo/profiles/{profile_id}/rename")
async def sup_demo_profile_update(profile_id: str, payload: dict | None = None,
                                  ctx: dict = Depends(require_cap("admin"))):
    """Rename (or re-body) one of the founder's own worlds. A de-fábrica profile is refused — it is
    reviewed like code, which is the whole difference between the two origins."""
    seed = _seed_module()
    slug = _require_founder(ctx)
    p = payload or {}
    try:
        res = await seed.update_profile(
            profile_id, name=str(p.get("name") or "").strip(),
            body=p.get("body") if isinstance(p.get("body"), dict) else None)
    except ValueError as e:
        raise _profile_error(e)
    await sup_session.audit(ctx["actor_email"], slug, ctx["ip"], "demo.profile.update",
                            detail=res, result="ok")
    return {"ok": True, **res, **(await seed.list_profiles())}


@router.delete("/demo/profiles/{profile_id}")
async def sup_demo_profile_delete(profile_id: str, ctx: dict = Depends(require_cap("admin"))):
    """Delete one of the founder's own worlds. The ACTIVE one is refused: its rows are still in the
    tables, and deleting the spec would leave a mark nothing in the registry can name — i.e. it would
    manufacture the exact FOREIGN state the reset exists to refuse."""
    seed = _seed_module()
    slug = _require_founder(ctx)
    try:
        res = await seed.delete_profile(profile_id)
    except ValueError as e:
        raise _profile_error(e)
    await sup_session.audit(ctx["actor_email"], slug, ctx["ip"], "demo.profile.delete",
                            detail=res, result="ok")
    return {"ok": True, **res, **(await seed.list_profiles())}


@router.post("/demo/activate")
async def sup_demo_activate(payload: dict | None = None, ctx: dict = Depends(require_cap("admin"))):
    """SWITCH THE WORLD. Body: {"profile_id": "...", "confirm": "REINICIAR"}.

    It is the reset with a name beside it, so it wears the SAME armour: the confirmation word (a
    switch is not an undo either), the one-press lock, and the three refusals — a foreign seed mark
    still stops it BEFORE anything is deleted. The receipt is the reset's, plus who went and who
    came."""
    seed = _seed_module()
    slug = _require_founder(ctx)
    _require_runtime(ctx)
    p = payload or {}
    pid = str(p.get("profile_id") or "").strip()
    if not pid:
        raise _err(400, "profile_required", "Dime qué mundo quieres activar.")
    if str(p.get("confirm") or "").strip().upper() != _DEMO_RESET_WORD:
        raise _err(400, "confirm_required",
                   f"Escribe {_DEMO_RESET_WORD} para confirmar. Esto no se puede deshacer.")
    if _demo_reset_lock.locked():
        raise _err(409, "reset_running", "Ya se está reiniciando. Espera a que termine.")
    async with _demo_reset_lock:
        try:
            res = await seed.activate_profile(pid, slug)
        except (RuntimeError, ValueError) as e:
            log.warning("sup demo activate REFUSED tenant=%s profile=%s: %s", slug, pid, e)
            await _audit_soft(ctx, slug, "refused",
                              {"profile": pid, "refused": type(e).__name__})
            if getattr(e, "reason", ""):          # ProfileRejected — a spec problem, not a seed mark
                raise _profile_error(e)
            raise _err(409, "reset_refused", _refusal_es(e))
        except Exception:
            log.exception("sup demo activate failed tenant=%s profile=%s", slug, pid)
            await _audit_soft(ctx, slug, "error", {"profile": pid})
            raise _err(500, "reset_failed", "No se ha podido activar ese mundo de prueba.")
    await _heal_seed_tenants()
    receipt = _demo_receipt(res if isinstance(res, dict) else {})
    state = await seed.world_state(slug)
    await sup_session.audit(ctx["actor_email"], slug, ctx["ip"], "demo.activate",
                            detail={"from": res.get("from_profile"), "to": res.get("to_profile"),
                                    "removed": receipt["removed"], "created": receipt["created"]},
                            result="ok")
    return {"ok": True, "from_profile": res.get("from_profile"),
            "to_profile": res.get("to_profile"),
            "to_profile_name": res.get("to_profile_name") or "",
            **receipt, **state, **(await seed.list_profiles())}


# ══════════════ THE SAME WORLDS, FROM THE PHONE (/api/app/seed/*) ════════════════════════════════
# Ajustes → controles del fundador → «Mundo de prueba» is on BOTH surfaces, and it is one feature, so
# it is one implementation: this router serves the Android app the same `brain/seed` registry the
# desk routes above serve, and neither owns a second copy of any rule.
#
# WHY IT LIVES IN THIS FILE AND NOT IN app.py: app.py is another builder's this run. `mount()` is
# handed the FastAPI app, which is all a router needs — so the app-surface block is registered from
# here, at the one seam that already exists, instead of reaching into a file this pass does not own.
# It adds only NEW paths (`/api/app/seed/profiles…`, `/api/app/seed/activate`); app.py's own
# `/api/app/seed` and `/api/app/seed/reset` are untouched and, being registered first, still win any
# match. Nothing is shadowed.
#
# THE GATE IS THE PHONE'S OWN, and it is deliberately NOT the machine key: that key ships inside
# every copy of the APK, so a key-gated switch would be reachable by every customer holding it. It is
# a verified Supabase bearer whose identity is a founder — the same rule `app.py:require_app_founder`
# states, read from the same `brain/auth`, so «who is Peter» keeps having exactly one answer.
app_router = APIRouter(prefix="/api/app/seed")


async def _require_app_founder(authorization: str = Header(default="")) -> dict:
    tok = (authorization or "").strip()
    if tok.lower().startswith("bearer "):
        tok = tok[7:].strip()
    user = await brain_auth.verify_token(tok)
    if not user:
        raise _err(401, "unauthorized", "Inicia sesión para continuar.")
    if not brain_auth.is_founder(user):
        raise _err(403, "founder_only", "Sólo el fundador puede cambiar el mundo de prueba.")
    return {"user": user, "email": (user.get("email") or "").strip()}


@app_router.get("/profiles")
async def app_seed_profiles(_: dict = Depends(_require_app_founder)):
    return await _seed_module().list_profiles()


@app_router.get("/profiles/{profile_id}/preview")
async def app_seed_profile_preview(profile_id: str, _: dict = Depends(_require_app_founder)):
    try:
        return await _seed_module().switch_preview(profile_id)
    except ValueError as e:
        raise _profile_error(e)


@app_router.post("/profiles")
async def app_seed_profile_create(payload: dict | None = None,
                                  ctx: dict = Depends(_require_app_founder)):
    p = payload or {}
    try:
        res = await _seed_module().create_profile(
            str(p.get("name") or "").strip(),
            from_profile_id=str(p.get("from_profile_id") or "").strip(),
            body=p.get("body") if isinstance(p.get("body"), dict) else None)
    except ValueError as e:
        raise _profile_error(e)
    log.info("seed profile created from the app by %s: %s", ctx.get("email"), res)
    return {"ok": True, **res, **(await _seed_module().list_profiles())}


# Both verbs here too, and for a plainer reason than on the desk: the Android client is one file with
# a three-verb helper (GET/POST/DELETE). PATCH stays because it is the honest verb for a partial edit
# and because the desk's twin has it; the POST alias is what the phone actually calls.
@app_router.patch("/profiles/{profile_id}")
@app_router.post("/profiles/{profile_id}/rename")
async def app_seed_profile_update(profile_id: str, payload: dict | None = None,
                                  ctx: dict = Depends(_require_app_founder)):
    p = payload or {}
    try:
        res = await _seed_module().update_profile(profile_id,
                                                  name=str(p.get("name") or "").strip())
    except ValueError as e:
        raise _profile_error(e)
    log.info("seed profile renamed from the app by %s: %s", ctx.get("email"), res)
    return {"ok": True, **res, **(await _seed_module().list_profiles())}


@app_router.delete("/profiles/{profile_id}")
async def app_seed_profile_delete(profile_id: str, ctx: dict = Depends(_require_app_founder)):
    try:
        res = await _seed_module().delete_profile(profile_id)
    except ValueError as e:
        raise _profile_error(e)
    log.info("seed profile deleted from the app by %s: %s", ctx.get("email"), res)
    return {"ok": True, **res, **(await _seed_module().list_profiles())}


@app_router.post("/activate")
async def app_seed_activate(payload: dict | None = None,
                            ctx: dict = Depends(_require_app_founder)):
    """Switch the world from the phone. Same lock as the desk's door — a founder holding both open is
    exactly the double-fire the lock exists for, and this time they ARE covered by the same one,
    because both live in this file."""
    seed = _seed_module()
    pid = str((payload or {}).get("profile_id") or "").strip()
    if not pid:
        raise _err(400, "profile_required", "Dime qué mundo quieres activar.")
    if _demo_reset_lock.locked():
        raise _err(409, "reset_running", "Ya se está reiniciando. Espera a que termine.")
    async with _demo_reset_lock:
        try:
            res = await seed.activate_profile(pid, seed.DEMO_TENANT)
        except (RuntimeError, ValueError) as e:
            log.warning("app demo activate REFUSED profile=%s: %s", pid, e)
            if getattr(e, "reason", ""):
                raise _profile_error(e)
            raise _err(409, "reset_refused", _refusal_es(e))
        except Exception:
            log.exception("app demo activate failed profile=%s", pid)
            raise _err(500, "reset_failed", "No se ha podido activar ese mundo de prueba.")
    log.info("world switched from the app by %s: %s → %s", ctx.get("email"),
             res.get("from_profile"), res.get("to_profile"))
    await _heal_seed_tenants()
    receipt = _demo_receipt(res if isinstance(res, dict) else {})
    state = await seed.world_state(seed.DEMO_TENANT)
    return {"ok": True, "from_profile": res.get("from_profile"),
            "to_profile": res.get("to_profile"),
            "to_profile_name": res.get("to_profile_name") or "",
            **receipt, **state, **(await seed.list_profiles())}


# ── routes family (Rutas — day gather + VROOM optimize via the vroom organ) ───────────────────────
async def _day_stops(ctx: dict, date: str) -> dict:
    """The day's deliverable stops: approved/sent orders for `date`, located via
    customer_profiles.stats.location (tenant-filtered), falling back to the latest calls.location
    for that phone; depot = the tenant's own lat/lng. lat/lng null = «sin dirección» (shown inline,
    excluded from optimisation).

    THE DELIVERY WINDOW rides here in exactly the shape `/api/reparto` emits (`brain/window.wire`),
    because §5.8a's "two doors, one rule" applies to a franja as much as to a radius: the desk and
    the phone must never disagree about what a customer was promised, or about who promised it. The
    order's override beats the customer's standing hours; `window_source` carries the provenance;
    ABSENT stays absent («sin franja»), and the desk's old fallback onto the order's `delivery_note`
    is GONE — a delivery note is free text written at dispatch, not a window, and showing it in the
    window slot was the fabricated promise the blank existed to prevent."""
    t = await _tenant_row(ctx["tenant_slug"]) or {}
    depot = None
    if t.get("lat") is not None and t.get("lng") is not None:
        depot = {"lat": float(t["lat"]), "lng": float(t["lng"]), "address": t.get("address") or None}
    async with db.get_pool().acquire() as con:
        orders = await con.fetch(
            "select id, phone_number, customer_name, "
            "       window_from, window_to, window_source, window_said from orders "
            "where status in ('approved','sent') and delivery_date = $1 and tenant_id = $2 "
            "order by customer_name, created_at", date, ctx["tenant_slug"])
        phones = sorted({r["phone_number"] for r in orders})
        profs = {r["phone_number"]: r for r in await con.fetch(
            "select phone_number, display_name, stats, delivery_window_from, delivery_window_to, "
            "       delivery_window_source, delivery_window_said from customer_profiles "
            "where tenant_id = $1 and phone_number = any($2::text[])", ctx["tenant_slug"], phones)}
        call_locs: dict[str, dict] = {}
        if phones:
            for r in await con.fetch(
                    "select distinct on (phone_number) phone_number, location from calls "
                    "where phone_number = any($1::text[]) and location <> '{}'::jsonb "
                    "order by phone_number, started_at desc", phones):
                call_locs[r["phone_number"]] = r["location"] or {}
        from brain import window as brain_window
        # §5.11.1 · THE WEEKDAY LAYER. Without this the round reads a customer's standing hours on a
        # day they explicitly overrode — «los sábados hasta la una» rendered as 08:00–11:00 and, far
        # worse, still labelled «lo dijo el cliente». Showing a franja the customer contradicted, over
        # their own name, is the fabricated promise this whole module exists to refuse. Narrowed to
        # THIS weekday: a Thursday round has no business reading anybody's Saturday.
        _dow = brain_window.dow_of(date)
        dows = await brain_window.dows_for(con, ctx["tenant_slug"], phones, _dow)
    from brain import window as brain_window
    stops = []
    for o in orders:
        prof = profs.get(o["phone_number"])
        loc = (_jdict(prof["stats"]).get("location") if prof else None) or call_locs.get(o["phone_number"]) or {}
        loc = _jdict(loc)
        lat, lng = loc.get("lat"), loc.get("lng")
        win = brain_window.resolve(brain_window._cust(prof), brain_window._order(o),
                                   (dows.get(o["phone_number"]) or {}).get(_dow))
        stops.append({
            "order_id": o["id"],
            "phone_number": o["phone_number"],
            "customer_name": o["customer_name"] or o["phone_number"],
            "business": loc.get("business"),
            "address": loc.get("address"),
            "lat": float(lat) if lat is not None else None,
            "lng": float(lng) if lng is not None else None,
            **brain_window.wire(win),
            "_k": (brain_window.sort_key(win), (o["customer_name"] or "").lower()),
        })
    # By the window the CUSTOMER stated, then by name — the same ordering /api/reparto returns, so
    # the desk and the phone read the day identically. A SORT, never a route: no sequence, no ETA.
    stops.sort(key=lambda s: s.pop("_k"))
    return {"depot": depot, "stops": stops}


@router.get("/routes/day")
async def sup_routes_day(date: str, ctx: dict = Depends(require_cap("read"))):
    if not date:
        raise _err(400, "bad_date")
    return await _day_stops(ctx, date)


async def _service_windows(ctx: dict, order_ids: list[str]) -> dict[str, dict]:
    """order_id → {start,end} for VROOM, resolved SERVER-SIDE from the same rule every other surface
    reads (`window.resolve`: the order's exception beats the customer's standing hours).

    Resolved here and never taken from the request body ON PURPOSE. A franja is a PROMISE — «lo dijo
    el cliente» — and a client that could post its own time windows could quietly widen one to make a
    route solve. The desk sends geometry; the server owns what was promised.

    Only CLOSED windows become constraints. «a partir de las 8» (open at the top) and «por la mañana»
    (their words, no digits) are real windows and are deliberately NOT half-constraints here: VROOM
    would need an invented other bound, and inventing the bound is inventing the promise. They still
    sort the day (`window.sort_key`) — they just do not bind the solver."""
    if not order_ids:
        return {}
    from brain import window as brain_window
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, phone_number, delivery_date, window_from, window_to, window_source, "
            "window_said from orders where id = any($1::text[]) and tenant_id = $2",
            sorted(set(order_ids)), ctx["tenant_slug"])
        phones = [r["phone_number"] for r in rows]
        custs = await brain_window.customers_for(con, ctx["tenant_slug"], phones)
        # The weekday layer binds the SOLVER too, not just the display. If the desk shows «los
        # sábados hasta la una» and VROOM solved against the weekday hours, the route is wrong at
        # that stop in the one way nobody would catch — it looks fine on screen.
        dows = await brain_window.dows_for(con, ctx["tenant_slug"], phones)
    out: dict[str, dict] = {}
    for r in rows:
        d = brain_window.dow_of(r["delivery_date"])
        w = brain_window.resolve(custs.get(r["phone_number"]), brain_window._order(r),
                                 (dows.get(r["phone_number"]) or {}).get(d))
        if w.get("from") and w.get("to"):
            out[r["id"]] = {"start": w["from"], "end": w["to"]}
    return out


@router.post("/routes/optimize")
async def sup_routes_optimize(payload: dict, ctx: dict = Depends(require_cap("act"))):
    """«Optimizar ruta» → the vroom organ (VROOM on loopback, OSRM matrix under it). Two entry
    shapes: the contract's explicit {depot, stops[…]} (the UI sends only LOCATED stops), or a bare
    {date} — then the server gathers the day itself (approved/sent orders + profile/call locations
    + the tenant depot) and optimises the locatable ones. Typed es-ES errors when VROOM is unset or
    down — never a fabricated route.

    §5.11.2 · THE FRANJA IS THE CONSTRAINT. `vroom.build_problem` has accepted `service_window` since
    it was written and nothing ever passed one, so the optimiser solved a pure travelling-salesman
    problem while the product knew, in another column, exactly when each customer could receive. The
    windows are attached here, for BOTH entry shapes, and a stop the solver cannot fit inside its own
    franja comes back in `unassigned_order_ids` — named, never silently reordered into a promise we
    would break."""
    payload = payload or {}
    depot = payload.get("depot")
    stops = payload.get("stops")
    if not isinstance(stops, list) or not stops:
        date = (payload.get("date") or "").strip()
        if not date:
            raise _err(400, "bad_request", "Faltan las paradas (o la fecha) para optimizar.")
        day = await _day_stops(ctx, date)
        depot = depot or day["depot"]
        stops = [{"order_id": s["order_id"], "lat": s["lat"], "lng": s["lng"]}
                 for s in day["stops"] if s["lat"] is not None and s["lng"] is not None]
    if not stops:
        raise _err(400, "no_located_stops",
                   "Ninguna parada tiene dirección — añade ubicaciones antes de optimizar.")
    wins = await _service_windows(ctx, [str(s.get("order_id") or "") for s in stops])
    if wins:
        stops = [{**s, "service_window": wins[str(s.get("order_id") or "")]}
                 if str(s.get("order_id") or "") in wins else s for s in stops]
    try:
        result = await vroom.optimize(depot or {}, stops)
    except vroom.RoutingError as e:
        raise _err(e.status, e.code, e.message)
    # §5.11.0 · PERSIST THE SEQUENCE. A driver FOLLOWS this order, so it cannot live only in the
    # response that produced it: without this the desk optimises, the phone re-reads the day and
    # gets the franja sort instead, and the two disagree about which stop is next. Persisting also
    # makes «la ruta» a real noun — `position`, the totals, and the stops VROOM could not fit inside
    # their own franja, kept by name so nobody has to re-solve to find out what was dropped.
    # Fail-soft: the route the operator just asked for is in `result` either way, and a bookkeeping
    # write must not turn a solved route into an error on his screen.
    day_for_route = (payload.get("date") or "").strip()
    if day_for_route:
        try:
            import datetime as _dt

            import delivery
            # A `date`, not the string: `ensure_route` casts $3::date, so asyncpg types the
            # parameter as a date and a str raises DataError on prepare.
            async with db.get_pool().acquire() as con:
                route = await delivery.ensure_route(
                    con, ctx["tenant_slug"], _dt.date.fromisoformat(day_for_route))
                rid = route.get("id") or ""
                if rid:
                    await delivery.sync_stops(
                        con, ctx["tenant_slug"], rid,
                        [str(s.get("order_id") or "") for s in stops if s.get("order_id")])
                    await delivery.save_sequence(con, ctx["tenant_slug"], rid, result)
        except Exception:
            log.debug("routes.optimize: sequence not persisted (fail-soft)", exc_info=True)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "routes.optimize",
                            detail={"stops": len(stops),
                                    "total_km": round(result["total_distance_m"] / 1000, 1),
                                    "unassigned": len(result.get("unassigned_order_ids") or [])})
    return result


# ── mount ─────────────────────────────────────────────────────────────────────────────────────────
def mount(app, *, dispatch_settings, save_dispatch, run_dispatch, dispatch_on_approve,
          profile_after_submit, pedidos_plan) -> None:
    """Wire the organ into the FastAPI app. The app.py-owned machinery crosses this ONE seam:
      dispatch_settings()            → the merged dispatch settings dict
      save_dispatch(payload)         → validate+merge+persist, returns the merged dict
      run_dispatch(reason)           → compile+email the approved orders now
      dispatch_on_approve()          → the each_order/every_n cadence hook after an approve
      profile_after_submit(order)    → the background profile refresh after an approve
      pedidos_plan(slug)             → shared contract 3's plan ('pedidos'|'empresa'|None), the
                                       SAME resolver /plan and the fence read, so the setup
                                       checklist can never disagree with them about what an
                                       account is
    """
    _hooks.update(dispatch_settings=dispatch_settings, save_dispatch=save_dispatch,
                  run_dispatch=run_dispatch, dispatch_on_approve=dispatch_on_approve,
                  profile_after_submit=profile_after_submit,
                  pedidos_plan=pedidos_plan)

    @app.exception_handler(SupAuthError)
    async def _sup_auth_handler(request: Request, exc: SupAuthError) -> JSONResponse:
        # NO Set-Cookie HERE, EVER. See SupAuthError's docstring: this handler used to delete
        # sup_session on every 401, and a 401 for a request sent before the sign-in would land
        # after it and delete the session the sign-in had just minted.
        return JSONResponse({"error": "session_required",
                             "detail": "Inicia sesión para continuar."}, status_code=401)

    @app.exception_handler(SupApiError)
    async def _sup_api_handler(request: Request, exc: SupApiError) -> JSONResponse:
        body = {"error": exc.error}
        if exc.detail:
            body["detail"] = exc.detail
        return JSONResponse(body, status_code=exc.status)

    app.include_router(router)
    # The founder's seed-profile block on the APP surface (/api/app/seed/profiles…). Registered here,
    # after app.py's own /api/app/seed routes, so those still win every match they already had — this
    # adds paths, it never shadows one. See the header comment above `app_router` for why it lives in
    # this file rather than in app.py.
    app.include_router(app_router)


# ── §CHANNELS · CONNECT → ADD NUMBER → ROUTE (2026-08-17) ────────────────────────────────────────
# Peter: «WhatsApp is just one of the channels. They click Connect, and then it'll take them through
# a flow… and then after that it would be add number.» Five endpoints, and the shape of the set is
# the shape of that sentence.
#
# CAPS: reading channels is `read` (an operator needs to see which number a customer talks to);
# everything that CONNECTS or ROUTES is `admin:rocoto` — attaching a phone number to a business, or
# changing which number a customer hears from, is running the employee, not using it (§17.34).
@router.get("/channels/state")
async def sup_channels_state(ctx: dict = Depends(require_cap("read"))):
    """Everything the Canales page needs, and nothing a token could be read from.

    `can_connect` is answered by the BOX, not guessed by the browser: if the app secret or the
    signup config is missing, «Conectar» must say so instead of opening Meta's dialog and stranding
    somebody halfway through it. `missing` carries the NAMES only."""
    import channels
    import wa_onboard
    state = await channels.describe(ctx["tenant_slug"])
    state["can_connect"] = wa_onboard.configured()
    state["missing"] = wa_onboard.missing()
    state["app_id"] = config.WA_CLOUD_APP_ID
    state["config_id"] = config.WA_ES_CONFIG_ID
    state["coexistence_feature"] = config.WA_ES_COEXISTENCE_FEATURE
    return state


@router.post("/channels/whatsapp/session")
async def sup_channels_session(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """SESSION LOGGING — a requirement of coexistence eligibility, not telemetry.

    Meta's own eligibility list says «Embedded Signup with session logging». It also happens to be
    the only record of WHERE somebody gave up, which is the one thing we could not answer about
    /demo. Audited rather than stored in a new table: `sup_audit` is already append-only and
    DB-enforced immutable, and a second log would be a second thing to keep honest."""
    ev = str((payload or {}).get("event") or "")[:80]
    data = (payload or {}).get("data")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "channel.signup_session",
                            detail={"event": ev, "data": data if isinstance(data, dict) else {}})
    return {"ok": True}


@router.post("/channels/whatsapp/finish")
async def sup_channels_finish(payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """The customer closed Meta's dialog. Everything real happens server-side from here."""
    import wa_onboard
    code = str((payload or {}).get("code") or "")
    waba_id = str((payload or {}).get("waba_id") or "")
    event = str((payload or {}).get("event") or "")
    if not code:
        raise _err(400, "no_code", "Meta no ha devuelto el código de conexión.")
    try:
        out = await wa_onboard.finish(ctx["tenant_slug"], code=code, waba_id=waba_id, event=event,
                                      connected_by=ctx["actor_email"])
    except wa_onboard.OnboardError as e:
        # The customer sees a sentence; the log keeps Meta's own code for a support thread.
        await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                                "channel.connect_failed", detail={"detail": e.detail[:400]})
        raise _err(502, "connect_failed", e.human)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "channel.connected",
                            detail={"waba_id": waba_id, "coexistence": out["coexistence"],
                                    "numbers": len(out.get("numbers") or [])})
    return out


@router.post("/channels/numbers/{number_id}/owner")
async def sup_number_owner(number_id: int, payload: dict, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Allocate a number to a comercial, or hand it back to the house (Peter, 2026-08-19).

    Body: {owner_email: "" | "ana@…"}. Empty IS the answer for the house — most suppliers are one
    person with one number and must never be made to invent an owner.

    Admin-capped rather than act-capped on purpose: who answers a customer is an org decision, and
    a comercial reassigning their own line would change who a restaurant talks to without the boss
    knowing."""
    email = str((payload or {}).get("owner_email") or "").strip().lower()
    if email and "@" not in email:
        raise _err(400, "bad_email")
    import channels
    row = await channels.set_number_owner(ctx["tenant_slug"], int(number_id), email)
    if not row:
        raise _err(404, "no_such_number")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "channels.number_owner",
                            target_id=str(number_id), detail={"owner": email or "casa"})
    return row


@router.get("/customers/{phone}/routing")
async def sup_customer_routing_get(phone: str, ctx: dict = Depends(require_cap("read"))):
    """«¿Con quién habla este cliente, y desde qué número?» — both optional, both independent."""
    import channels
    return await channels.routing_for(ctx["tenant_slug"], phone)


@router.post("/customers/{phone}/routing")
async def sup_customer_routing_set(phone: str, payload: dict, ctx: dict = Depends(require_cap("act"))):
    """THE SUB-SPECIFICATION Peter named: «certain customers get routed to them, even if they have
    another number — because the customer is used to that».

    Two independent questions, and passing neither leaves both alone:
      · `channel_number_id` — which of our numbers this customer talks to
      · `assigned_to`       — which comercial owns the relationship

    ⚠️ THE LAW THIS MUST NOT BREAK. A restaurant that has written to «Frutas Sitjar» for two years
    must never receive a reply from a number they have never seen — that is indistinguishable from
    a scam. `channels.sender_for` already answers in the order that respects them (this routing →
    the tenant's primary → the box default). So a routing row is the supplier saying «answer them
    from HERE», never a silent reassignment: clearing it returns them to the primary, which is the
    number they already know.

    Explicit nulls clear; absent keys leave alone. `null` and «not mentioned» are different answers
    and the wire keeps them apart."""
    import channels
    body = payload or {}
    num = body.get("channel_number_id", "__absent__")
    who = body.get("assigned_to", "__absent__")
    if num == "__absent__" and who == "__absent__":
        raise _err(400, "nothing_to_do")
    if num not in ("__absent__", None):
        # a number id from another distributor must not be attachable to this customer
        owned = [n["id"] for n in await channels.numbers_for(ctx["tenant_slug"])]
        if int(num) not in owned:
            raise _err(404, "no_such_number")
    row = await channels.set_routing(
        ctx["tenant_slug"], phone,
        channel_number_id=channels.KEEP if num == "__absent__" else num,
        assigned_to=channels.KEEP if who == "__absent__" else (who or None),
        updated_by=ctx["actor_email"])
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx["ip"], "customer.routing",
                            target_id=phone, detail={"number": num, "assigned_to": who})
    return row


@router.post("/channels/numbers/{number_id}/primary")
async def sup_channels_primary(number_id: int, ctx: dict = Depends(require_cap("admin:rocoto"))):
    """Which number answers when a conversation does not say. One per tenant, enforced by the DB."""
    import channels
    import db as _db
    async with _db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select id, connection_id, external_id, e164, label, mode, status from channel_number "
            "where id=$1 and tenant_id=$2 and status <> 'removed'", int(number_id), ctx["tenant_slug"])
    if not row:
        raise _err(404, "no_number", "Ese número no es tuyo.")
    out = await channels.upsert_number(
        ctx["tenant_slug"], int(row["connection_id"]), external_id=row["external_id"],
        e164=row["e164"] or "", label=row["label"] or "", mode=row["mode"],
        status=row["status"], make_primary=True)
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "channel.primary_set", target_id=str(number_id),
                            detail={"e164": row["e164"]})
    return out

