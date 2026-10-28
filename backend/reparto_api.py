"""reparto_api.py — LA PUERTA DEL REPARTIDOR, y no hay otra (SPEC §5.11).

The delivery half of an order's life already has its organs: `delivery.py` owns the stop state
machine and the ledger, `avisos.py` owns the message that arrives at the right place, `brain/window`
owns the franja, `vroom.py` owns the only sequence anybody is allowed to compute. **This file adds no
machinery.** It is the door those organs are reached through by a man standing in the rain at six in
the morning, and its whole job is to make sure that man can reach EXACTLY the van and nothing else.

THE CAP IS THE FENCE, AND IT IS THE POINT (§5.11.3). `repartidor` holds one capability, `deliver`,
and holds nothing on the read/act/admin ladder — so a driver's session is refused by every
pre-existing route in `app.py` and `sup_api.py` WITHOUT a single handler having been edited (that is
`tests/vital_reparto_caps.py` C5). Every route in this file asks for `deliver` and only for
`deliver`. Least privilege is therefore a property of the cap set rather than an allowlist somebody
has to remember to update, and the day a tenth route is written here it is fenced by construction.

WHAT HE CAN SEE, AND WHY IT IS ENFORCED IN THE QUERY (Peter, 2026-07-27: *"today's route and
nothing else"*). Not other days, not other customers, not the chats, not the catalogue:
  · **not the catalogue, not the chats** — he cannot reach those routes at all (the cap).
  · **not other customers** — every read is bounded by the ORDERS ON HIS DAY. There is no route here
    that takes a customer and answers about them in general; `/cobro/{phone}` answers off the LEDGER,
    which only ever contains orders that were actually delivered to that customer by this tenant.
  · **not other days** — `_resolve_day` refuses a date that is not today for a session that holds
    ONLY `deliver`. It refuses OUT LOUD rather than quietly substituting today, because silently
    answering a different question from the one asked is how a driver ends up delivering yesterday's
    round convinced it is this morning's. A senior role (owner/founder/staff, who all carry `deliver`
    because the day-one case is the boss driving his own van) may name a day: he can already read
    every day of the year on the desk, and pretending otherwise here would be theatre.

THE AUTH RAIL IS THE PHONE'S, NOT THE DESK'S. The Android app carries a **Supabase bearer**
(`brain/auth.app_scope` — the desk's own membership resolver, so «who belongs to which tenant» keeps
having exactly one answer); the desk carries a cookie. This organ serves the phone, so there is no
cookie and therefore no CSRF double-submit here — CSRF is a cookie's problem and a bearer is not
ambiently attached by a browser. `require_driver` is written out in this file rather than imported
from `app.py` for one reason only: `app.py` imports THIS module, so importing it back would be a
cycle. The RULE is `brain/auth`'s in both places (this is `sup_api._require_app_founder`'s own
precedent, for the same reason).

THE CLIENT NEVER NAMES ITS TENANT. Not in a header, not in a body field, not in a query param.
`ctx["tenant_slug"]` is resolved server-side and is the only tenant any statement here may use; every
query filters on it, and a cross-tenant id misses the WHERE and 404s LOUDLY. Never an empty 200 that
reads as «no tienes nada» — that is the one failure mode that looks like data.

**THERE IS NO MONEY IN THIS FILE.** Not a sum, not a subtraction, not a division by 100, not a euro
sign. `delivery.py` owns every amount in this feature and there is no screen behind this door where a
human types what somebody owes. Two consequences, both deliberate:
  · the day carries COUNTS and no euro total. A «llevas 3.200 € en la furgoneta» line would mean this
    file decided what goes into that sum (settled orders? the ones with no snapshot? failed stops?)
    and that decision is exactly the drift the ledger exists to prevent. The euro figures a driver
    acts on are per customer, they come from `delivery.owed`/`delivery.breach`, and they live on the
    cobro screen where somebody is actually about to be asked for money.
  · a stop's `value_label` is `delivery.euros(orders.value_snapshot_cents)` — the ledger's own
    formatter over the ledger's own column — and an order with no snapshot reads «sin importe» and
    enters nothing. The order LINES travel without their prices on purpose: a stated per-line price
    is not a resolved value, and printing a column of them under a driver's thumb is an invitation to
    add them up, which is precisely the sum `delivery.py` refuses to let anybody make.

WHAT WAS REFUSED, SO NOBODY RE-OPENS IT:
  1. **A route per driver** (`rt_<tenant>_<date>_<op>`, which `delivery.route_id_for` will happily
     build). Nothing in this product ASSIGNS a driver to a route yet, so every driver opening the app
     would mint his own route carrying the same orders — two stops per order, and then
     `delivery.outstanding`'s join fans out and DOUBLES what a customer appears to have paid. A
     money bug hiding inside a convenience. One route per tenant-day until something assigns vans;
     `driver_operator_id` stays null, which db.py already calls the day-one case.
  2. **A second locations/windows query.** `sup_api._day_stops` is CALLED, not copied (§5.8a "two
     doors, one rule"): the desk and the phone must never disagree about where a stop is or what its
     customer was promised, and the cheapest way to guarantee that is to have one query.
  3. **Settling a card payment optimistically.** `/cobro` with `method='tarjeta'` mints a link and
     settles NOTHING. A settlement is a claim that money moved; the only thing that knows whether it
     did is Stripe, and it says so through `record_checkout_paid` at the bottom of this file.
  4. **An application fee on the reparto checkout.** The charge is DIRECT on the tenant's connected
     account — the money is the supplier's — and the platform's 0.3% is already metered off the GMV
     snapshot by `brain/billing`. Taking a second cut here would bill the same euro twice.
  5. **`order_events` for the stop verbs.** That log is folded back into the order's own projection
     (`brain/events._fold`), and a delivery is not a change to what was ordered. The events go where
     `avisos.py` puts its own: `runtime.emit_sense` on the CUSTOMER's scope, so the delivery becomes
     part of what the employee knows about that restaurant instead of something that happened outside
     the product. Who did what is `sup_audit`'s job, and every write below lands there.
  6. **Auditing a read with the write path's audit.** `sup_session.audit` RE-RAISES on failure, which
     is right for a money/state action and wrong for a list: an unwritable audit table would take
     down a driver's day. Reads audit through `_audit(..., soft=True)`; writes do not.

WHAT THIS FILE DOES NOT DO, AND SAYS SO: it computes no route (that is `vroom.py`, behind
`/api/sup/routes/optimize`; `position` is READ here and never written), it promises no arrival time,
it invents no window, and it never writes `delivery_stops.state` itself — `delivery.py` is the only
writer of that column and every verb below is one of its functions.

es-ES for everything a driver reads — every refusal is a sentence that names the FIX, never a code.
English for code, comments and logs (LANGUAGE LAW §0.11).
"""
from __future__ import annotations

import asyncio
import datetime as _dt
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse

import avisos
import config
import db
import delivery
import sup_api
import sup_session
from brain import auth as brain_auth
from brain import range as brain_range
from brain import window as brain_window
from identity_phone import canon
from sup_api import SupApiError, _err

log = logging.getLogger("rocoto.reparto_api")

router = APIRouter(prefix="/api/reparto")

# THE ONE CAPABILITY. Written once, used by every route below, so «what does a driver hold» has a
# single answer in this file too (`sup_session.ROLE_CAPS` / `brain_auth.APP_ROLE_CAPS` hold it for
# the product). The ladder is what a driver deliberately does NOT hold.
CAP = "deliver"
LADDER: Tuple[str, ...] = ("read", "act", "admin")

# The depot's clock. A driver opening the app at 00:30, or finishing a round at ten past midnight,
# must still see the round he is about to drive — «today» is Madrid's, never UTC's and never the
# phone's (`/api/reparto` in app.py made the same call, and the two must agree).
DEPOT_TZ = "Europe/Madrid"

# A stop note is DICTATED at a door and `delivery.attach` appends it to whatever is already there
# with a newline, so — unlike an aviso — the newlines are load-bearing here and are NOT collapsed.
# Only the length is bounded, and generously: a runaway transcript is clipped, never refused, because
# refusing a man his own words at a customer's door is worse than storing too many of them.
MAX_NOTE = 1000
# The proof photo. Same ceiling as `/api/send-media` (WhatsApp's), so one number governs how big a
# photograph this product accepts wherever it arrives.
MAX_PHOTO_BYTES = 16 * 1024 * 1024
_SAFE_EXT = re.compile(r"^[a-z0-9]{1,8}$")

# Stripe stores at most 500 characters per metadata value, and the order ids ARE the metadata (the
# webhook has nothing else to settle from). Twelve ids fit with room to spare; past that the link
# would silently lose the tail, and a payment that settles half of what it was for is worse than a
# refusal a driver can read.
MAX_LINK_ORDERS = 12
CHECKOUT_KIND = "rocoto_reparto_cobro"


# ══ the gate ═════════════════════════════════════════════════════════════════════════════════════
def _bearer(authorization: str) -> str:
    tok = (authorization or "").strip()
    return tok[7:].strip() if tok.lower().startswith("bearer ") else tok


async def require_driver(request: Request, authorization: str = Header(default="")) -> dict:
    """THE DRIVER'S GATE — a verified Supabase bearer → {email, tenant_slug, role, caps, …} that
    holds `deliver`, on a tenant this deployment's runtime actually serves.

    Four refusals, all typed, all es-ES, none of them a code the app has to translate:
      401 no token / a token Supabase does not recognise;
      403 the account belongs to no team (`AppScopeError`, whose own es-ES sentence is passed
          through verbatim — it already names the fix);
      403 the role does not carry `deliver` — every role that can drive carries it, so this is a
          real refusal and not a gap;
      403 the session's tenant is not the one whose runtime lives on this box. LOUD, never an empty
          200: `orders`, `whatsapp_messages` and the wa.* scopes carry no tenant_id, so silence
          there would be another tenant's data or a lie about your own.

    The machine key is NOT accepted — it ships inside every APK, and a key-gated delivery surface
    would be reachable by everyone holding a copy of the app (app.py's own 2026-07-27 note)."""
    user = await brain_auth.verify_token_cached(_bearer(authorization))
    if not user:
        raise _err(401, "unauthorized", "Inicia sesión para continuar.")
    try:
        ctx = await brain_auth.app_scope(user)
    except brain_auth.AppScopeError as e:
        raise _err(e.status, e.code, e.detail or "Tu cuenta todavía no puede entrar aquí.")
    if not brain_auth.app_can(ctx.get("role", ""), CAP):
        raise _err(403, "cap_required",
                   "Tu cuenta no está dada de alta para repartir. Pídeselo a tu jefe.")
    if not brain_auth.owns_runtime(ctx.get("tenant_slug", "")):
        raise _err(403, "tenant_scope_unavailable",
                   "Los datos de tu empresa no están en este servidor.")
    ctx["ip"] = sup_api._client_ip(request)
    return ctx


def _driver_only(ctx: dict) -> bool:
    """Is this a PURE repartidor — `deliver` and nothing on the read/act/admin ladder?

    Asked as a question about CAPS rather than about the role string on purpose: the day a second
    driving role exists it inherits this rule for free, and a role that quietly gained `read` would
    stop being fenced here at the same moment it stopped needing to be."""
    role = ctx.get("role") or ""
    return not any(brain_auth.app_can(role, c) for c in LADDER)


async def _operator_id(ctx: dict) -> str:
    """WHO IS DRIVING, as an `operators.id` — what `delivery_stops.delivered_by` and
    `delivery_settlements.recorded_by` point at.

    The app's session context carries an EMAIL and no operator id (`brain_auth.app_scope` returns a
    tenancy claim, not a row), so it is resolved through `brain/teams.operator_id_for` — the ONE
    lookup in the product, tenant-checked through `team_members` so an operator of another team can
    never be stamped on this tenant's stop. The desk's own door (`/api/sup/customers/{phone}/nota`)
    makes the same call for the same reason; two copies of it is how one of them ends up signing a
    delivery with somebody else's id.

    Fail-soft to "" — and the direction is chosen. `delivered_by` is nullable and "" means «we do not
    know which of your people it was», which is a gap in OUR data. Failing the delivery instead would
    mean a missing membership row could stop a van, and no product rule is worth that."""
    email = (ctx.get("email") or "").strip().lower()
    if not email:
        return ""
    try:
        from brain import teams as brain_teams
        async with db.get_pool().acquire() as con:
            return await brain_teams.operator_id_for(con, ctx["tenant_slug"], email)
    except Exception:
        log.debug("reparto: operator id lookup fail-soft for %s", email, exc_info=True)
        return ""


# ══ the day, and which day he is allowed to ask for ══════════════════════════════════════════════
def _today() -> str:
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(DEPOT_TZ)
    except Exception:                                    # no tzdata → UTC, and it says so in the log
        log.debug("reparto: no %s tzdata — falling back to UTC for «today»", DEPOT_TZ)
        tz = _dt.timezone.utc
    return _dt.datetime.now(tz).strftime("%Y-%m-%d")


def _resolve_day(ctx: dict, asked: str) -> str:
    """WHICH DAY THIS SESSION MAY SEE. Returns 'YYYY-MM-DD'.

    Empty → today. Today → today. Another day → today for anybody who can already read every day
    elsewhere (the boss in his own van), and a REFUSAL for a pure repartidor.

    **It refuses rather than clamping**, and that is the whole decision. Silently answering «today»
    to a request for the 3rd would put a list in front of a man that is not the list he asked for,
    and he would have no way to tell — the single most expensive kind of lie a delivery app can
    tell. A garbled date is refused too, for the same reason: it is not «today», it is a question we
    could not read."""
    want = (asked or "").strip()[:10]
    today = _today()
    if not want:
        return today
    try:
        _dt.date.fromisoformat(want)
    except ValueError:
        raise _err(400, "bad_date", "Esa fecha no la entiendo. Escríbela como 2026-07-27.")
    if want == today:
        return today
    if _driver_only(ctx):
        raise _err(403, "solo_hoy", "Solo puedes ver el reparto de hoy.")
    return want


# ══ audit + the spine (both existing; neither is rebuilt here) ═══════════════════════════════════
async def _audit(ctx: dict, action: str, *, target_id: str = "", detail: Optional[dict] = None,
                 result: str = "ok", soft: bool = False) -> None:
    """One line in the append-only `sup_audit`. `detail` stays NON-PII (ids, counts, the ledger's own
    already-formatted label) — the same contract `sup_session.audit` states.

    `soft=True` swallows a failed audit and is used ONLY on the read paths. `sup_session.audit`
    re-raises on purpose (a lost audit on a money/state action is not acceptable), and that is right
    for every write below — but a driver's LIST must never be taken down by the audit table, which is
    house law: fail soft on the read, never on the rule. Same shape as `sup_api._audit_soft`."""
    try:
        await sup_session.audit(ctx.get("email") or "", ctx.get("tenant_slug") or "",
                                ctx.get("ip") or "", action, target_id=target_id or None,
                                detail=detail, result=result)
    except Exception:
        if not soft:
            raise
        log.debug("reparto: soft audit failed action=%s", action, exc_info=True)


async def _emit(phone: str, etype: str, payload: Dict[str, Any], key: str) -> None:
    """One verb → one event on the CUSTOMER's scope, through `runtime.emit_sense` (which appends on
    wa.<digits>, bootstrapping the party if it must). This is how «se lo entregamos el martes y no
    había nadie» becomes something the employee KNOWS rather than something that happened in a van.

    `dedupe_key` is the stop (or settlement) it is about, so a retried write cannot double-write the
    timeline. Lazily imported and fail-soft, exactly like `avisos._emit`: the state is already
    written by the time we get here, and a spine hiccup must never turn a delivered stop into an
    error at a door."""
    if not phone:
        return
    try:
        import runtime
        await runtime.emit_sense(phone=phone, type=etype, source="reparto",
                                 payload=payload, dedupe_key=key)
    except Exception:
        log.debug("reparto._emit fail-soft (%s)", etype, exc_info=True)


# ══ small honest shapes ══════════════════════════════════════════════════════════════════════════
def _jlist(v: Any) -> List[str]:
    """A jsonb array of order ids → a list of strings, whatever the codec handed back. Never raises:
    an unreadable `unassigned` means «nothing came back unfitted», which is the harmless answer."""
    if isinstance(v, list):
        return [str(x) for x in v if x]
    if isinstance(v, str):
        try:
            d = json.loads(v or "[]")
        except ValueError:
            return []
        return [str(x) for x in d if x] if isinstance(d, list) else []
    return []


def _lines_wire(raw: Any) -> List[Dict[str, Any]]:
    """The order's lines as a DRIVER reads them: what it is, how much, and what was said about it.

    **NO PRICE CROSSES THIS FUNCTION.** A line's `price` is a STATED price — most are NULL and none
    of them is a resolved value (`delivery.py`'s opening note) — so a column of them on a delivery
    note is an invitation to add up a number this product refuses to compute. The one euro figure a
    stop carries is `value_label`, and it comes from the snapshot."""
    out: List[Dict[str, Any]] = []
    for line in (raw or []):
        if not isinstance(line, dict):
            continue
        name = str(line.get("name") or line.get("item") or line.get("raw_text") or "").strip()
        if not name:
            continue
        out.append({"name": name,
                    "qty": line.get("qty"),
                    "unit": str(line.get("unit") or ""),
                    "note": str(line.get("note") or "")})
    return out


def _iso(v: Any) -> Optional[str]:
    return v.isoformat() if isinstance(v, (_dt.datetime, _dt.date)) else None


def _fail_reasons() -> List[Dict[str, str]]:
    """The CLOSED list of why a delivery did not happen, on the wire — so the phone renders the four
    buttons `delivery.FAIL_REASONS` declares and cannot invent a fifth. A driver types nothing here."""
    return [{"id": k, "label": v} for k, v in delivery.FAIL_REASONS.items()]


def _methods() -> List[Dict[str, str]]:
    return [{"id": m, "label": delivery.METHOD_LABEL[m]} for m in delivery.METHODS]


# ══ ① EL DÍA ═════════════════════════════════════════════════════════════════════════════════════
@router.get("/day")
async def reparto_day(date: str = "", ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE (code against this, don't guess):

        GET /api/reparto/day?date=2026-07-27        Authorization: Bearer <supabase>
        → 200 {
          "day": "2026-07-27",
          "route": {"id":"rt_rocoto_2026-07-27","state":"planificada","optimised_at":null,
                    "total_distance_m":null,"total_duration_s":null,"sequenced":false},
          "depot": {"lat":…|null,"lon":…|null,"label":""},
          "stops": [{
             "stop_id": 41, "order_id":"ord_…", "position": null,   // null ⇒ nobody optimised it
             "state":"pendiente",                                   // pendiente|entregada|no_entregada|descartada
             "failed_reason":"", "failed_label":"",
             "delivered_at":null, "proof_url":"", "note":"",
             "customer_name":"Casa Bermejo", "business":"", "address":"…", "phone_number":"+34…",
             "lat":…|null, "lon":…|null,                            // null ⇒ «sin dirección», STILL in the day
             "window_from":"08:00","window_to":"11:00","window_text":"","window_source":"said",
             "window_scope":"dow", "window_label":"08:00–11:00",    // "" ⇒ «sin franja»
             "lines":[{"name":"PALETA COCIDA","qty":4,"unit":"kg","note":""}],
             "value_cents": 48020|null, "value_label":"480,20 €",   // null ⇒ «sin importe»
             "unfitted": false,                                     // VROOM could not fit its franja
             "avisos":[ …avisos.shape… ]
          }],
          "totals": {"stops":12,"pendientes":9,"entregadas":2,"no_entregadas":1,"descartadas":0,
                     "sin_importe":1,"sin_direccion":0},
          "unassigned": ["ord_…"],
          "motivos_fallo": [{"id":"cerrado","label":"Estaba cerrado"}, …],
          "opciones_aviso": [{"id":"g1","label":"Hecho","free":false}, …]
        }

    **THE READ MATERIALISES THE ROUTE**, deliberately: a driver opening his app is the first thing
    that happens on a delivery day and nothing else in this product creates one. `ensure_route` is
    idempotent and `sync_stops` never touches state anybody has already set — a stop already
    delivered stays exactly as it is, because it happened; an order that has left the day becomes
    `descartada` rather than vanishing.

    **THE ORDER OF THE STOPS.** `position` when VROOM has run (a driver is FOLLOWING a sequence and
    one that re-shuffles under him is worse than none); otherwise the franja sort — the day read in
    the order the customers' own stated hours imply, un-timed stops last. That is a SORT, not a
    route: nothing here computes an arrival, a leg or an ETA, and nothing here writes `position`.

    **THE LOCATIONS AND THE WINDOWS ARE THE DESK'S OWN QUERY** (`sup_api._day_stops`, called and not
    copied) so the phone and the desk can never disagree about where a stop is or what its customer
    was promised. The first-class `customer_profiles.address/lat/lon` columns §5.8a made fill only
    the gaps that query leaves blank — they never override it, so both doors show the same thing.

    **NO EURO TOTAL, ON PURPOSE** — see the module docstring. The totals are counts, and `sin_importe`
    is one of them: how many of today's deliveries carry no known value is a fact the boss should see,
    not a hole to hide.

    Never optimises, never sends, never promises a time to anybody."""
    tenant = ctx["tenant_slug"]
    day = _resolve_day(ctx, date)
    day_d = _dt.date.fromisoformat(day)

    # ONE shape for locations + windows + the franja order (§5.8a "two doors, one rule"). Its `lng`
    # is the desk's key; this is the phone's door and the phone has always said `lon` — mapped once,
    # here, rather than teaching one of the two clients the other's vocabulary.
    desk = await sup_api._day_stops(ctx, day)
    ordered = list(desk.get("stops") or [])
    order_ids = [str(s.get("order_id") or "") for s in ordered if s.get("order_id")]
    phones = sorted({str(s.get("phone_number") or "") for s in ordered if s.get("phone_number")})

    async with db.get_pool().acquire() as con:
        route = await delivery.ensure_route(con, tenant, day_d)
        await delivery.sync_stops(con, tenant, route.get("id") or "", order_ids)
        stop_rows = {r["order_id"]: dict(r) for r in await con.fetch(
            "select id, order_id, position, state, failed_reason, delivered_at, proof_url, note "
            "from delivery_stops where tenant_id = $1 and route_id = $2",
            tenant, route.get("id") or "")}
        order_rows = {r["id"]: dict(r) for r in await con.fetch(
            "select id, value_snapshot_cents, lines from orders "
            "where tenant_id = $1 and id = any($2::text[])", tenant, order_ids)}
        prof_rows = {r["phone_number"]: dict(r) for r in await con.fetch(
            "select phone_number, display_name, address, lat, lon, stats from customer_profiles "
            "where tenant_id = $1 and phone_number = any($2::text[])", tenant, phones)}
        rng = await brain_range.get_range(con, tenant)
        # One read per stop, which is what `avisos.open_for` is built for — it also re-derives the
        # money aviso off the ledger, because an aviso that is only refreshed when somebody happens
        # to write is a stale claim about a restaurant's money.
        open_avisos = {ph: await avisos.open_for(con, tenant, ph, avisos.REPARTIDOR) for ph in phones}

    unassigned = _jlist(route.get("unassigned"))
    stops: List[Dict[str, Any]] = []
    for idx, s in enumerate(ordered):
        oid = str(s.get("order_id") or "")
        phone = str(s.get("phone_number") or "")
        st = stop_rows.get(oid) or {}
        o = order_rows.get(oid) or {}
        prof = prof_rows.get(phone) or {}
        here = brain_range._profile_geo(prof) if prof else None
        lat, lon = s.get("lat"), s.get("lng")
        if lat is None or lon is None:
            lat, lon = (here[0], here[1]) if here else (None, None)
        val = o.get("value_snapshot_cents")
        win = {k: s.get(k, "") for k in ("window_from", "window_to", "window_text",
                                         "window_source", "window_scope")}
        reason = str(st.get("failed_reason") or "")
        stops.append({
            "stop_id": int(st["id"]) if st.get("id") is not None else 0,
            "order_id": oid,
            "position": st.get("position"),
            "state": st.get("state") or delivery.PENDIENTE,
            "failed_reason": reason,
            "failed_label": delivery.FAIL_REASONS.get(reason, ""),
            "delivered_at": _iso(st.get("delivered_at")),
            "proof_url": str(st.get("proof_url") or ""),
            "note": str(st.get("note") or ""),
            "customer_name": s.get("customer_name") or prof.get("display_name") or phone,
            "business": s.get("business") or "",
            "address": s.get("address") or prof.get("address") or "",
            "phone_number": phone,
            "lat": lat, "lon": lon,
            **win,
            # The label the two clients render from ONE rule — digits when they gave digits, their
            # own words when they gave words, "" when nobody ever stated a franja («sin franja»).
            "window_label": brain_window.label(brain_window.make(
                win["window_from"], win["window_to"], said=win["window_text"],
                source=win["window_source"] or brain_window.SET,
                scope=win["window_scope"] or brain_window.CUSTOMER)),
            "lines": _lines_wire(o.get("lines")),
            "value_cents": int(val) if val is not None else None,
            "value_label": delivery.euros(int(val) if val is not None else None),
            "unfitted": oid in unassigned,
            "avisos": open_avisos.get(phone) or [],
            "_k": (st.get("position") is None, st.get("position") or 0, idx),
        })
    stops.sort(key=lambda x: x.pop("_k"))

    states = [s["state"] for s in stops]
    totals = {
        "stops": len(stops),
        "pendientes": states.count(delivery.PENDIENTE),
        "entregadas": states.count(delivery.ENTREGADA),
        "no_entregadas": states.count(delivery.NO_ENTREGADA),
        "descartadas": states.count(delivery.DESCARTADA),
        "sin_importe": sum(1 for s in stops if s["value_cents"] is None),
        "sin_direccion": sum(1 for s in stops if s["lat"] is None or s["lon"] is None),
    }
    await _audit(ctx, "reparto.day", target_id=str(route.get("id") or ""),
                 detail={"day": day, "stops": totals["stops"]}, soft=True)
    return {
        "day": day,
        "route": {"id": route.get("id") or "", "state": route.get("state") or "planificada",
                  "optimised_at": _iso(route.get("optimised_at")),
                  "total_distance_m": route.get("total_distance_m"),
                  "total_duration_s": route.get("total_duration_s"),
                  "sequenced": any(s["position"] is not None for s in stops)},
        # The depot the RULE measures from (`brain/range`), which is the one `/api/reparto` already
        # hands this app. The desk's `tenants.lat/lng` is the older one and is deliberately not the
        # answer here: a driver's two screens must not point at two warehouses.
        "depot": {"lat": rng["depot_lat"], "lon": rng["depot_lon"], "label": rng["depot_label"]},
        "stops": stops,
        "totals": totals,
        "unassigned": unassigned,
        "motivos_fallo": _fail_reasons(),
        # The questionnaire that is ALWAYS available, with no model, no key and no network — the
        # guarantee `avisos.generate_options` is built around («a driver is never blocked by our
        # LLM»). It is sent ONCE for the whole day because it is identical for every aviso. The
        # TAILORED set is a model call per aviso and therefore needs its own door; it is not on this
        # read, because generating it here would put a dozen LLM calls behind a list.
        "opciones_aviso": avisos.fallback_options(avisos.REPARTIDOR),
    }


# ══ ② LA PARADA — the four verbs at a door ═══════════════════════════════════════════════════════
def _stop_wire(row: Dict[str, Any]) -> Dict[str, Any]:
    """One `delivery_stops` row → what the phone needs back after a verb. Explicit field by field
    rather than `dict(row)`: a passthrough would start leaking columns the day somebody adds one."""
    reason = str(row.get("failed_reason") or "")
    return {"stop_id": int(row["id"]), "order_id": row.get("order_id") or "",
            "state": row.get("state") or delivery.PENDIENTE,
            "failed_reason": reason, "failed_label": delivery.FAIL_REASONS.get(reason, ""),
            "delivered_at": _iso(row.get("delivered_at")),
            "proof_url": str(row.get("proof_url") or ""), "note": str(row.get("note") or ""),
            "position": row.get("position")}


async def _phone_of_stop(con, tenant: str, stop_id: int) -> str:
    """The customer a stop belongs to — for the event, never for a fence (the fence is the tenant
    filter `delivery.py` already applies). Fail-soft: no phone means no event, not a failed verb."""
    try:
        return await con.fetchval(
            "select o.phone_number from delivery_stops s join orders o "
            "  on o.id = s.order_id and o.tenant_id = s.tenant_id "
            "where s.id = $1 and s.tenant_id = $2", int(stop_id), tenant) or ""
    except Exception:
        log.debug("reparto: phone-of-stop fail-soft for %s", stop_id, exc_info=True)
        return ""


def _no_such_stop() -> SupApiError:
    """A stop that is not this tenant's and a stop that does not exist are the SAME refusal from the
    client's side, and they must LOOK the same: telling one company that another's stop id exists is
    a leak (`sup_api`'s own «no_such_capture» reasoning). A stop on somebody ELSE'S round joins the
    same refusal, for the same reason — see `_my_stop`."""
    return _err(404, "no_such_stop", "Esa parada ya no está en tu reparto. Vuelve a abrir el día.")


async def _my_stop(con, ctx: dict, stop_id: int) -> None:
    """A pure repartidor may only act on a stop ON HIS OWN ROUND, TODAY. Raises the shared 404.

    `delivery_stops.id` is a bigserial — the most guessable id in the schema — and the verbs behind
    it are not cosmetic: `entregado` is what turns an order into a DEBT (the ledger ages from
    `delivered_at`), and `fallo` records a customer as absent. Fenced on tenant alone, one driver
    could walk the integers and deliver another van's round from a bar, and the money aviso would
    start chasing customers who never received anything.

    Senior roles are not fenced: the boss may already act on any of his company's stops from the
    desk, and a fence he can trivially route around is a comment, not a control."""
    if not _driver_only(ctx):
        return
    ok = await con.fetchval(
        "select 1 from delivery_stops s "
        "  join delivery_routes r on r.id = s.route_id and r.tenant_id = s.tenant_id "
        " where s.id = $1 and s.tenant_id = $2 and r.route_date = $3::date limit 1",
        int(stop_id), ctx["tenant_slug"], _resolve_day(ctx, ""))
    if not ok:
        raise _no_such_stop()


@router.post("/stop/{stop_id}/entregado")
async def reparto_entregado(stop_id: int, payload: Optional[dict] = None,
                            ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/stop/41/entregado   body {"lat":40.41,"lon":-3.70}  (both optional)
        → 200 {"stop": {…}, "state": "entregada"}
        → 404 {"error":"no_such_stop","detail":"…"}

    The hold-to-confirm at the door. Position is recorded ONCE, at the tap, as proof of PRESENCE —
    this product has no live trail and does not track a driver between stops, and the absence of one
    is a promise to the man driving, not an omission.

    Idempotent by construction (`delivery.mark_delivered`): a second tap in the rain is a double-tap,
    not a second delivery, and it does not move the timestamp.

    IT DOES NOT SETTLE ANYTHING. Delivering is what makes an order a DEBT (`delivery.outstanding`
    gates on delivered); whether money changed hands is the cobro wizard's own answer, and collapsing
    the two would mean every delivery silently claimed to have been paid for."""
    tenant = ctx["tenant_slug"]
    p = payload or {}
    by = await _operator_id(ctx)
    try:
        async with db.get_pool().acquire() as con:
            phone = await _phone_of_stop(con, tenant, stop_id)
            await _my_stop(con, ctx, int(stop_id))
            row = await delivery.mark_delivered(con, tenant, int(stop_id), by=by,
                                                lat=p.get("lat"), lon=p.get("lon"))
    except LookupError:
        raise _no_such_stop()
    await _audit(ctx, "reparto.entregado", target_id=str(stop_id),
                 detail={"order_id": row.get("order_id"), "geo": p.get("lat") is not None})
    await _emit(phone, "reparto.entregada",
                {"text": "Entregado.", "stop_id": int(stop_id), "order_id": row.get("order_id")},
                f"reparto.entregada:{stop_id}")
    return {"stop": _stop_wire(row), "state": row.get("state")}


@router.post("/stop/{stop_id}/fallo")
async def reparto_fallo(stop_id: int, payload: dict, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/stop/41/fallo   body {"reason":"cerrado"}
        → 200 {"stop": {…}, "state":"no_entregada"}
        → 400 {"error":"bad_reason","detail":"Elige por qué no has podido entregarlo."}

    «No he podido entregar» is a REAL OUTCOME and is recorded as easily as a success — the reason is
    a CLOSED list of four (`delivery.FAIL_REASONS`, shipped on the day read) and the driver types
    nothing. It must never be harder to record a failure than a success, or the app gets lied to."""
    tenant = ctx["tenant_slug"]
    reason = str((payload or {}).get("reason") or "").strip()
    by = await _operator_id(ctx)
    try:
        async with db.get_pool().acquire() as con:
            phone = await _phone_of_stop(con, tenant, stop_id)
            await _my_stop(con, ctx, int(stop_id))
            row = await delivery.mark_failed(con, tenant, int(stop_id), reason, by=by)
    except ValueError as e:
        # `delivery.mark_failed` already refuses in es-ES and names what to do — passed through
        # verbatim rather than re-worded, so one module owns the sentence.
        raise _err(400, "bad_reason", str(e))
    except LookupError:
        raise _no_such_stop()
    await _audit(ctx, "reparto.fallo", target_id=str(stop_id),
                 detail={"order_id": row.get("order_id"), "reason": reason})
    await _emit(phone, "reparto.no_entregada",
                {"text": f"No se ha podido entregar: {delivery.FAIL_REASONS[reason].lower()}.",
                 "stop_id": int(stop_id), "order_id": row.get("order_id"), "reason": reason},
                f"reparto.no_entregada:{stop_id}")
    return {"stop": _stop_wire(row), "state": row.get("state")}


@router.post("/stop/{stop_id}/nota")
async def reparto_nota(stop_id: int, payload: dict, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/stop/41/nota   body {"note":"me lo ha cogido el cocinero"}
        → 200 {"stop": {…}}
        → 400 {"error":"bad_note","detail":"Escribe o dicta la nota antes de guardarla."}

    What was said at the door. It APPENDS (`delivery.attach`): a driver adding a second thought must
    not silently erase the first. Dictation is already TEXT by the time it arrives here — a voice
    note nobody plays is not a record.

    An empty note RAISES rather than being swallowed: he pressed save, and a save that saved nothing
    while looking like it worked is the kind of silence this whole feature exists to end."""
    tenant = ctx["tenant_slug"]
    note = str((payload or {}).get("note") or "").strip()[:MAX_NOTE]
    if not note:
        raise _err(400, "bad_note", "Escribe o dicta la nota antes de guardarla.")
    try:
        async with db.get_pool().acquire() as con:
            phone = await _phone_of_stop(con, tenant, stop_id)
            await _my_stop(con, ctx, int(stop_id))
            row = await delivery.attach(con, tenant, int(stop_id), note=note)
    except LookupError:
        raise _no_such_stop()
    await _audit(ctx, "reparto.nota", target_id=str(stop_id), detail={"chars": len(note)})
    await _emit(phone, "reparto.nota",
                {"text": f"El repartidor apunta: «{note[:160]}»", "stop_id": int(stop_id),
                 "order_id": row.get("order_id")},
                # the note appends, so the key carries its length — a second note on the same stop is
                # a second event, and only a RETRY of the same one is deduped.
                f"reparto.nota:{stop_id}:{len(row.get('note') or '')}")
    return {"stop": _stop_wire(row)}


@router.post("/stop/{stop_id}/foto")
async def reparto_foto(stop_id: int, file: UploadFile = File(...),
                       ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/stop/41/foto   multipart:  file=<jpeg>
        → 200 {"stop": {…}, "proof_url":"https://…/media/reparto-<uuid>.jpg"}
        → 400 {"error":"empty_file"|"file_too_large","detail":"…"}

    THE PROOF PHOTO, ON THE RAIL THAT ALREADY EXISTS. Bytes land under `config.MEDIA_DIR` under a
    random uuid and are served by `/media/{fname}` — the same store, the same naming and the same
    16 MB ceiling `/api/stock/capture` and `/api/send-media` use. No new bucket, no second URL shape,
    no proxying of a URL the client hands us.

    That route is gated PER USER (`app.py:require_media_auth`), so the photograph is behind the same
    identity as the rest of the app rail; the filename is a uuid, and the extension is refused unless
    it is plain alphanumerics — the name on a phone is not to be trusted with a path.

    The write goes off the event loop: a 16 MB blocking write on the shared loop would stall every
    other request in flight (`/api/send-media`'s own F9 note)."""
    tenant = ctx["tenant_slug"]
    data = await file.read()
    if not data:
        raise _err(400, "empty_file", "No me ha llegado la foto. Vuelve a hacerla.")
    if len(data) > MAX_PHOTO_BYTES:
        raise _err(413, "file_too_large", "Esa foto pesa demasiado. Hazla otra vez con menos calidad.")
    ext = (Path(str(file.filename or "")).suffix.lstrip(".").lower())[:8]
    if not _SAFE_EXT.fullmatch(ext or ""):
        ext = "jpg"
    fname = f"reparto-{uuid.uuid4().hex}.{ext}"
    media_dir = Path(config.MEDIA_DIR)
    try:
        media_dir.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread((media_dir / fname).write_bytes, data)
    except Exception:
        log.exception("reparto: proof photo write failed for stop %s", stop_id)
        raise _err(500, "photo_failed", "No he podido guardar la foto. Inténtalo otra vez.")
    url = f"{config.PUBLIC_BASE_URL.rstrip('/')}/media/{fname}"
    try:
        async with db.get_pool().acquire() as con:
            phone = await _phone_of_stop(con, tenant, stop_id)
            await _my_stop(con, ctx, int(stop_id))
            row = await delivery.attach(con, tenant, int(stop_id), proof_url=url)
    except LookupError:
        raise _no_such_stop()
    await _audit(ctx, "reparto.foto", target_id=str(stop_id), detail={"bytes": len(data)})
    await _emit(phone, "reparto.foto",
                {"text": "Foto de la entrega.", "stop_id": int(stop_id),
                 "order_id": row.get("order_id"), "proof_url": url},
                f"reparto.foto:{stop_id}")
    return {"stop": _stop_wire(row), "proof_url": url}


# ══ ③ EL COBRO — step 0, the ledger's own answer ═════════════════════════════════════════════════
async def _on_my_round(con, ctx: dict, phone: str) -> bool:
    """Is this customer ACTUALLY ON THIS DRIVER'S ROUND TODAY?

    THE FENCE THE TENANT FILTER IS NOT. `tenant_id` proves the customer belongs to the company; it
    proves nothing about whether this man is standing at their door. Without this, a `deliver`-only
    account — the least-privileged account in the product — could name any phone in the company and
    read that customer's entire ledger, then settle it in cash. The ledger is append-only, so there
    is no way back from that: the receivables would be recorded as legitimately collected.

    A senior role (the boss in his own van) is not fenced here — he can already read every customer
    from the desk, and pretending otherwise would be theatre rather than security."""
    row = await con.fetchval(
        "select 1 from delivery_stops s "
        "  join delivery_routes r on r.id = s.route_id and r.tenant_id = s.tenant_id "
        "  join orders o on o.id = s.order_id and o.tenant_id = s.tenant_id "
        " where s.tenant_id = $1 and o.phone_number = $2 and r.route_date = $3::date "
        "   and s.state <> $4 limit 1",
        ctx["tenant_slug"], phone, _resolve_day(ctx, ""), "descartada")
    return bool(row)


async def _known_customer(con, ctx: dict, phone: str) -> str:
    """This tenant's customer AND — for a pure repartidor — one on his round today. Returns the
    display name (which may be the number — that is the name we honestly have).

    The client names a PHONE here, which is the one place it names anything, so this is the fence:
    another tenant's customer must 404 rather than come back as an empty ledger. An empty ledger
    reads as «no te debe nada», and that is a claim about somebody else's customer. A customer this
    driver is not visiting today gets the SAME 404, deliberately — a distinct «no está en tu ruta»
    would confirm to a driver probing ids that the customer exists."""
    tenant = ctx["tenant_slug"]
    row = await con.fetchrow(
        "select display_name from customer_profiles where tenant_id = $1 and phone_number = $2",
        tenant, phone)
    if not row:
        raise _err(404, "no_such_customer",
                   "Ese cliente no está en tu lista. Compruébalo con la oficina.")
    if _driver_only(ctx) and not await _on_my_round(con, ctx, phone):
        raise _err(404, "no_such_customer",
                   "Ese cliente no está en tu reparto de hoy. Compruébalo con la oficina.")
    return str(row["display_name"] or phone)


@router.get("/cobro/{phone}")
async def reparto_cobro_get(phone: str, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  GET /api/reparto/cobro/+34600000001
        → 200 {
          "phone_number":"+34600000001", "customer":"Casa Bermejo",
          "count":2, "cents":48020, "label":"480,20 €", "oldest_days":40,
          "age_label":"hace 40 días", "unvalued":1,
          "items":[{"order_id":"ord_…","known":true,"amount_cents":48020,
                    "amount_label":"480,20 €","delivered_at":"…","days":40,
                    "age_label":"hace 40 días"}],
          "breached":true, "by_time":true, "by_amount":false,
          "reason":"lleva 40 días sin liquidar (el plazo son 30)",
          "terms":{"credit_days":30,"credit_limit_cents":null,"on_breach":"avisar","offer_terms":false},
          "methods":[{"id":"efectivo","label":"Efectivo"}, …],
          "credit_kinds":[{"id":"billie","label":"…"},{"id":"confianza","label":"…"}]}
        → 404 {"error":"no_such_customer", …}

    STEP 0 OF THE SETTLE WIZARD, and every figure on it is `delivery.breach`'s — which is
    `delivery.owed` (the ledger) plus the tenant's terms and, when they are breached, WHY. The reason
    matters more than the flag: it is what the driver says out loud, and «llevas mucho» is not a
    reason.

    Only DELIVERED orders are here. An order still in the van is not a debt, and asking a restaurant
    for money for goods they have not received is the worst thing this feature could do. Orders whose
    value was never resolved come back too, marked `known:false` with «sin importe» — he can see they
    exist, they carry no figure and they enter no total.

    `on_breach` is the tenant's own rule and it defaults to «avisar»: the employee briefs the boss
    rather than chasing the customer. This route REPORTS it; it never acts on it."""
    tenant = ctx["tenant_slug"]
    p = canon(phone)
    if not p:
        raise _err(400, "bad_phone", "Ese número no lo entiendo.")
    async with db.get_pool().acquire() as con:
        name = await _known_customer(con, ctx, p)
        b = await delivery.breach(con, tenant, p)
    terms = b.get("terms") or {}
    await _audit(ctx, "reparto.cobro_view", target_id=p[-4:],
                 detail={"count": b["count"], "label": b["label"]}, soft=True)
    return {
        "phone_number": p, "customer": name,
        "count": b["count"], "cents": b["cents"], "label": b["label"],
        "oldest_days": b["oldest_days"], "age_label": delivery.age_label(b["oldest_days"]),
        "unvalued": b["unvalued"], "items": b["items"],
        "breached": b["breached"], "by_time": b["by_time"], "by_amount": b["by_amount"],
        "reason": b["reason"],
        # Field by field: `terms` is a DB row and a passthrough would start shipping whatever column
        # somebody adds to `tenant_credit` next.
        "terms": {"credit_days": terms.get("credit_days"),
                  "credit_limit_cents": terms.get("credit_limit_cents"),
                  "on_breach": terms.get("on_breach") or delivery.AVISAR,
                  "offer_terms": bool(terms.get("offer_terms"))},
        "methods": _methods(),
        "credit_kinds": [{"id": delivery.BILLIE, "label": "Lo financia Billie"},
                         {"id": delivery.CONFIANZA, "label": "Se lo fías tú"}],
    }


# ══ ④ EL COBRO — the settle, and the one method that does not settle ═════════════════════════════
async def _own_orders(con, ctx: dict, order_ids: Any) -> Tuple[List[str], str]:
    """The order ids this session is allowed to talk about, plus WHOSE they are — both resolved in
    the query, against THIS tenant, before a single euro is read. Returns (ids, phone).

    TWO REFUSALS, and both are about a cobro meaning one thing:
      · A MIXED-TENANT LIST IS REFUSED WHOLE. `delivery.settle` would happily settle the ids that
        matched and ignore the rest, and a wizard that says «liquidado» having settled two of the
        three deliveries in front of it is the worst possible outcome of a leak.
      · TWO CUSTOMERS IN ONE COBRO IS REFUSED. The amount would be arithmetically right and the
        receipt would be a lie about who paid it — and the aviso, the event and the audit line all
        belong to ONE restaurant."""
    tenant = ctx["tenant_slug"]
    ids = [str(x).strip() for x in (order_ids or []) if str(x or "").strip()]
    if not ids:
        raise _err(400, "no_orders", "No has elegido ninguna entrega.")
    ids = sorted(set(ids))
    rows = await con.fetch(
        "select id, phone_number from orders where tenant_id = $1 and id = any($2::text[])",
        tenant, ids)
    if {r["id"] for r in rows} != set(ids):
        raise _err(404, "no_such_order",
                   "Alguna de esas entregas ya no está en tu reparto. Vuelve a abrir el día.")
    phones = {str(r["phone_number"] or "") for r in rows}
    if len(phones) > 1:
        raise _err(400, "varios_clientes",
                   "Esas entregas son de clientes distintos. Haz un cobro para cada uno.")
    phone = next(iter(phones), "") or ""
    # THE THIRD REFUSAL, and it is the one that matters most. The two above are about a cobro
    # meaning one thing; this one is about WHOSE cobro it may be. `tenant_id` says the orders belong
    # to the company — it says nothing about this driver being at that door. Settling is an
    # append-only write against real money, so an unfenced id list here lets the least-privileged
    # account in the product wipe the company's receivables and have the ledger call it collected.
    # The customer's OLD deliveries are settleable (that is the whole wizard); the customer is not.
    if _driver_only(ctx) and not await _on_my_round(con, ctx, phone):
        raise _err(404, "no_such_order",
                   "Esas entregas no son de un cliente de tu reparto de hoy.")
    return ids, phone


async def _payable(con, tenant: str, order_ids: List[str]) -> Dict[str, Any]:
    """WHAT A PAYMENT LINK FOR THESE DELIVERIES MUST BE FOR — `delivery.payable`'s number, and no
    other. That function refuses an unvalued order outright rather than guessing at it (we do not put
    a made-up euro amount in front of a restaurant) and it is the only function in this product
    allowed to produce the figure a customer is asked to pay. Nothing here adds, subtracts or scales
    it; this wrapper exists to turn its es-ES refusal into a typed one, and to hold the one limit
    Stripe's own metadata imposes.

    It is SEPARATE from `_mint_link` so that the pooled connection can be given back before anybody
    talks to Stripe — see that function."""
    if len(order_ids) > MAX_LINK_ORDERS:
        raise _err(400, "demasiadas_entregas",
                   f"Son demasiadas entregas para un solo cobro (el máximo son {MAX_LINK_ORDERS}). "
                   "Haz dos cobros.")
    try:
        return await delivery.payable(con, tenant, order_ids)
    except ValueError as e:
        # «Hay entregas sin importe — no puedo cobrar una cantidad que no tengo.» The ledger's own
        # es-ES sentence, passed through verbatim.
        raise _err(400, "sin_importe", str(e))


# ── the settling seam, and the guard that makes a half-landed wiring impossible ──────────────────
# `record_checkout_paid` is the ONLY thing that writes a card payment into the ledger. app.py's
# Stripe webhook must call it; until it does, minting a link would take a customer's money with
# nothing on the other side to record it. Rather than trust a comment, the webhook REGISTERS itself
# here and `_mint_link` refuses while the registration is missing.
_SETTLING_WIRED = False


def settling_is_wired() -> None:
    """Called by app.py's Stripe webhook at import time — the proof that a paid session reaches
    `record_checkout_paid`. Without this call the card rail stays shut and says so in es-ES."""
    global _SETTLING_WIRED
    _SETTLING_WIRED = True


def _settling_wired() -> bool:
    return _SETTLING_WIRED


async def _mint_link(tenant: str, pay: Dict[str, Any], *, phone: str = "") -> Dict[str, Any]:
    """THE CARD RAIL — a Stripe Checkout link for what the LEDGER already said (`pay`), charged
    DIRECTLY on the tenant's own connected account. Shared by `POST /link` and by the `tarjeta`
    branch of `POST /cobro`, so the two can never mint different links.

    **IT REFUSES TO MINT WHEN NOTHING CAN SETTLE IT** (`_settling_wired`). A Checkout link is the one
    thing in this module that moves a customer's real money, and `record_checkout_paid` is the only
    thing that writes that money into the ledger. If the link exists and the webhook does not, the
    customer pays, the ledger never hears, the debt stays open, and the undismissible money aviso
    goes on shouting the amount he has already paid — so the next driver asks him for it again. That
    is a worse failure than the feature being switched off, and it is the exact state a half-landed
    wiring change produces. The guard makes that state impossible rather than documenting it.

    **IT TAKES NO DATABASE CONNECTION, ON PURPOSE.** Everything here is network — Stripe's account
    read, Stripe's session create, the portal's own pool use — and holding a pooled connection across
    a third party's round-trip is how a pool of eight dies on the morning eight drivers press «cobrar»
    at once (each holding one connection and waiting for a second is a deadlock, not a slowdown). The
    ledger read happens first, in `_payable`, and the connection is handed back before we get here.

    **THE MONEY IS THE SUPPLIER'S.** `stripe_account=<acct>` makes this a DIRECT charge on his
    connected account; there is deliberately no application fee, because the platform's 0.3% is
    already metered off the GMV snapshot by `brain/billing` and a second cut here would bill the same
    euro twice.

    **IT SETTLES NOTHING.** A settlement is a claim that money moved. Only Stripe knows whether it
    did, and it says so through `record_checkout_paid` below.

    THREE TYPED REFUSALS, and each names a fix the person reading it can actually carry out — never a
    fake link, never a silent fallback to cash:
      503 stripe_no_configurado  — WE have not configured Stripe on this box.
      409 sin_cuenta_stripe      — the TENANT has not finished connecting his payout account.
      409 cobros_no_activos      — Stripe has the account but has not enabled charges on it yet.

    Idempotent on a double tap: the Stripe idempotency key is built from the tenant, the exact set of
    orders and the exact amount, so a second press in the rain returns the SAME session instead of a
    second link the customer could pay twice."""
    from brain import stripe_connect

    if not _settling_wired():
        # Checked BEFORE Stripe is touched: no account read, no session created, nothing that could
        # leave a payable link behind. See the guard's note above for why this is a refusal and not
        # a warning.
        raise _err(503, "cobro_sin_conciliar",
                   "El cobro con tarjeta aún no está activado en este servidor. "
                   "Cóbralo en efectivo o por Bizum y avisa a la oficina.")
    if not stripe_connect.configured():
        raise _err(503, "stripe_no_configurado",
                   "Ahora mismo no puedo cobrar con tarjeta: el cobro por tarjeta no está "
                   "configurado en el servidor. Cóbralo en efectivo o por Bizum y avisa a la oficina.")
    st = await stripe_connect.status(tenant)
    acct = str(st.get("account_id") or "")
    if not st.get("connected") or not acct:
        raise _err(409, "sin_cuenta_stripe",
                   "Tu empresa todavía no ha conectado su cuenta de Stripe. En la app: Ajustes → "
                   "Cobros, y terminad el alta. Mientras tanto, cobra en efectivo o por Bizum.")
    if not st.get("charges_enabled"):
        raise _err(409, "cobros_no_activos",
                   "Stripe todavía no ha activado los cobros en la cuenta de tu empresa. En la app: "
                   "Ajustes → Cobros, y completad lo que os pida. Mientras tanto, cobra en efectivo "
                   "o por Bizum.")

    # Where the customer lands afterwards: THEIR OWN portal page — their order history with this
    # supplier, which is the only page in this product that is actually about them. `portal.link_for`
    # is idempotent (the same customer always gets the same URL, so it stays bookmarkable) and it
    # MINTS one if they have none — a real door opened as a side effect of a payment, deliberately:
    # the alternative is sending somebody to a page that does not exist.
    # Fail-soft to the public site: a return page we could not mint must never stop a payment, and
    # soyrocoto.com is a real page rather than an invented path.
    ok_url = no_url = (config.ONBOARD_PUBLIC_BASE_URL or "https://soyrocoto.com").rstrip("/")
    if phone:
        try:
            import portal
            pl = await portal.link_for(phone, tenant=tenant)
            no_url = str(pl.get("url") or no_url)
            ok_url = f"{no_url}?pagado=1"
        except Exception:
            log.debug("reparto: portal return link fail-soft for %s", phone, exc_info=True)

    n = len(pay["order_ids"])
    label_goods = f"{n} entrega{'s' if n != 1 else ''}"
    idem = f"reparto:{tenant}:{','.join(pay['order_ids'])}:{pay['cents']}"

    def _mint():
        # `stripe_connect._stripe()` is the ONE place this codebase sets the API key and the retry
        # policy. Re-doing `stripe.api_key = …` here would be a second place it is set, and the day
        # the key moves one of them would keep the old one.
        stripe = stripe_connect._stripe()
        return stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{"price_data": {"currency": "eur", "unit_amount": int(pay["cents"]),
                                        "product_data": {"name": label_goods}}, "quantity": 1}],
            locale="es",
            success_url=ok_url,
            cancel_url=no_url,
            # The webhook needs exactly three things to settle this: that it is ours, whose it is,
            # and which deliveries. The customer's PHONE is deliberately NOT among them — it is not
            # needed (`record_checkout_paid` reads it off the order) and shipping a restaurant's
            # number to a third party we do not have to is the same instinct that keeps `sup_audit`
            # non-PII.
            metadata={"kind": CHECKOUT_KIND, "tenant": tenant,
                      "order_ids": ",".join(pay["order_ids"])},
            stripe_account=acct,
            idempotency_key=idem,
        )

    try:
        session = await asyncio.to_thread(_mint)
    except Exception as e:                                    # noqa: BLE001 — Stripe's own failures
        log.warning("reparto: checkout mint failed tenant=%s: %s", tenant, e)
        raise _err(502, "cobro_no_disponible",
                   "Stripe no me ha dado el enlace de pago ahora mismo. Cóbralo en efectivo o por "
                   "Bizum, o inténtalo otra vez en un momento.")
    url = str(getattr(session, "url", "") or "")
    if not url:
        raise _err(502, "cobro_no_disponible",
                   "Stripe no me ha dado el enlace de pago ahora mismo. Cóbralo en efectivo o por "
                   "Bizum, o inténtalo otra vez en un momento.")
    return {
        "pagado": False,                 # nothing is settled by minting a link. See the docstring.
        "method": delivery.TARJETA,
        "url": url,
        # THE QR PAYLOAD IS THE URL. There is no deep link, no scheme and no encoded amount hiding in
        # it — the client draws a QR of exactly this string, the customer's camera opens exactly this
        # page, and there is nothing in between for either of us to get wrong.
        "qr": url,
        "cents": pay["cents"],
        "label": pay["label"],
        "order_ids": pay["order_ids"],
        "session_id": str(getattr(session, "id", "") or ""),
        "nota": ("Enséñale el QR o mándale el enlace. Se marca como pagado en cuanto Stripe nos lo "
                 "confirme — no lo des por cobrado antes."),
    }


@router.post("/cobro")
async def reparto_cobro(payload: dict, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:

        POST /api/reparto/cobro
        body {"order_ids":["ord_a","ord_b"], "method":"efectivo",
              "credit_kind":"confianza",       // only when method='credito'
              "stop_id": 41,                   // optional — the stop he is standing at
              "note": ""}
          → 200 {"pagado":true,"orders":2,"cents":48020,"label":"480,20 €","method":"efectivo",
                 "credit_kind":"","aviso_abierto":false}
          → 200 {"pagado":false,"method":"tarjeta","url":"https://checkout.stripe.com/…","qr":"…",
                 "cents":48020,"label":"480,20 €","session_id":"cs_…","nota":"…"}
          → 400 {"error":"bad_method"|"no_orders"|"sin_importe", "detail":"<es-ES, verbatim>"}
          → 404 {"error":"no_such_order", …}

    **THE AMOUNT IS NEVER PASSED IN.** `delivery.settle` reads it from the ledger for each order,
    which is what makes it impossible for any screen in this product to settle a debt for a figure
    somebody typed. `credito` writes rows of amount ZERO on purpose: it records that the money was
    NOT taken and who agreed to that, which is a fact worth keeping and not the absence of one — and
    the wizard must say WHO carries it (`billie` = a third party, `confianza` = the supplier
    himself), because a supplier must always know whether he is the one out of pocket.

    **`method='tarjeta'` MINTS A LINK AND SETTLES NOTHING.** That is the one branch of this route
    that does not write to the ledger, and it is the whole reason the branch exists: a card payment
    is settled when Stripe says it happened (`record_checkout_paid`), never when a driver taps
    «Tarjeta» in front of a customer who has not paid yet.

    After a real settlement, `delivery.sync_overdue_aviso` runs: money settled → the money aviso
    closes itself. It is not dismissible anywhere in the UI because it is not an opinion — it goes
    away when the fact does, and that function is the only thing that decides."""
    tenant = ctx["tenant_slug"]
    p = payload or {}
    method = str(p.get("method") or "").strip()
    if method not in delivery.METHODS:
        raise _err(400, "bad_method", "Dime cómo te lo ha pagado: efectivo, Bizum, tarjeta o crédito.")
    stop_id = p.get("stop_id")
    try:
        stop_id = int(stop_id) if stop_id is not None else None
    except (TypeError, ValueError):
        stop_id = None
    by = await _operator_id(ctx)

    if method == delivery.TARJETA:
        # THE LEDGER FIRST, THEN STRIPE — and the connection is given back in between (`_mint_link`).
        async with db.get_pool().acquire() as con:
            ids, phone = await _own_orders(con, ctx, p.get("order_ids"))
            pay = await _payable(con, tenant, ids)
        out = await _mint_link(tenant, pay, phone=phone)
        await _audit(ctx, "reparto.cobro_link", target_id=out.get("session_id") or "",
                     detail={"orders": len(ids), "label": out["label"], "settled": False})
        await _emit(phone, "reparto.cobro_enviado",
                    {"text": f"Enlace de pago enviado por {out['label']}.",
                     "order_ids": ids, "label": out["label"]},
                    f"reparto.cobro_enviado:{out.get('session_id') or ','.join(ids)}")
        return out

    async with db.get_pool().acquire() as con:
        ids, phone = await _own_orders(con, ctx, p.get("order_ids"))
        try:
            res = await delivery.settle(con, tenant, ids, method,
                                        credit_kind=str(p.get("credit_kind") or ""), by=by,
                                        stop_id=stop_id, note=str(p.get("note") or "")[:MAX_NOTE])
        except ValueError as e:
            raise _err(400, "bad_settlement", str(e))
        except LookupError:
            raise _err(404, "no_such_order",
                       "Alguna de esas entregas ya no está en tu reparto. Vuelve a abrir el día.")
        open_aviso = await delivery.sync_overdue_aviso(con, tenant, phone)

    await _audit(ctx, "reparto.cobro", target_id=(phone[-4:] if phone else ""),
                 detail={"orders": res["orders"], "label": res["label"], "method": method,
                         "credit_kind": res["credit_kind"]})
    await _emit(phone, "reparto.liquidada",
                {"text": f"Liquidado {res['label']} ({delivery.METHOD_LABEL[method]}).",
                 "order_ids": ids, "label": res["label"], "method": method,
                 "credit_kind": res["credit_kind"]},
                f"reparto.liquidada:{','.join(ids)}:{method}")
    return {"pagado": True, **res, "aviso_abierto": open_aviso is not None}


@router.post("/link")
async def reparto_link(payload: dict, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/link   body {"order_ids":["ord_a"]}
        → 200 {"pagado":false,"method":"tarjeta","url":"https://checkout.stripe.com/…","qr":"…",
               "cents":48020,"label":"480,20 €","order_ids":[…],"session_id":"cs_…","nota":"…"}
        → 400/409/502/503 {"error":"…","detail":"<es-ES, show it to the driver verbatim>"}

    The card rail on its own, for the driver who wants the QR before he has decided how the customer
    is paying. The same two functions as the `tarjeta` branch of `/cobro` (`_payable` → `_mint_link`),
    so the two doors can never mint different links for the same deliveries — and, like it, it
    SETTLES NOTHING.

    ALL THE DELIVERIES MUST BE ONE CUSTOMER'S — `_own_orders` refuses a mixed list, for both doors
    at once. A payment link spanning two restaurants is not a thing: the amount would be
    arithmetically right and the receipt would be a lie about who paid it."""
    tenant = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        ids, phone = await _own_orders(con, ctx, (payload or {}).get("order_ids"))
        pay = await _payable(con, tenant, ids)
    out = await _mint_link(tenant, pay, phone=phone)
    await _audit(ctx, "reparto.link", target_id=out.get("session_id") or "",
                 detail={"orders": len(ids), "label": out["label"], "settled": False})
    return out


# ══ ⑤ EL AVISO — the question that met him at the door, and his answer ═══════════════════════════
async def _my_aviso(con, ctx: dict, aviso_id: int) -> Dict[str, Any]:
    """THE AVISO THIS DRIVER MAY BE ASKED A QUESTION ABOUT — his own audience, still open, and at a
    customer he is actually standing in front of TODAY. Raises the typed refusals; never returns a
    row he has no business reading.

    READ THROUGH `avisos.thread`, which is the module's own tenant-filtered read: it returns the
    whole conversation this id belongs to and the rung we want is in it. That is deliberate rather
    than convenient — there is no «get one aviso» in `avisos.py` and adding a second SELECT over that
    table here would be exactly the copy this file exists not to make. What he gets back is ONE rung;
    the thread stays at the desk, because a man at a door is answering a question, not reviewing a
    correspondence.

    THREE FENCES, and two of them are not the tenant:
      · **audience.** A `jefe` aviso does not exist on this door — same 404 as one that never was.
        Without it a `deliver`-only account could read the counter-avisos carrying other drivers'
        words, and the boss's queue would be readable by the least-privileged account in the product.
      · **his round.** `_known_customer` is CALLED, not re-derived, so «this tenant's customer AND on
        my reparto today» keeps having one answer (the cobro screen's). `delivery_stops` ids and
        `avisos` ids are both bigserials; fenced on tenant alone, a driver could walk the integers
        and read what the boss wrote about a restaurant he is nowhere near.
      · **still open.** A resolved aviso has no question left. It is the same 404, because «that one
        is already answered» and «that one is not yours» must look identical from outside.

    An `auto` aviso is refused SEPARATELY and in its own words: it is not a mistake to have asked, it
    simply has no outcomes — it is what the customer owes, and it goes away when the money moves.
    `avisos.resolve` owns the refusal for CLOSING one; this is the refusal for QUESTIONING one."""
    rung = next((a for a in await avisos.thread(con, ctx["tenant_slug"], int(aviso_id))
                 if a["id"] == int(aviso_id)), None)
    if not rung or rung["audience"] != avisos.REPARTIDOR or rung["state"] != avisos.ABIERTO:
        raise _err(404, "no_such_aviso", "Ese aviso ya no está. Vuelve a abrir la parada.")
    if rung["kind"] == avisos.AUTO:
        raise _err(400, "aviso_automatico",
                   "Ese aviso no tiene preguntas: es lo que el cliente debe, y se quita solo cuando "
                   "lo liquide.")
    rung["customer"] = await _known_customer(con, ctx, rung["phone_number"])
    return rung


@router.get("/aviso/{aviso_id}/opciones")
async def reparto_aviso_opciones(aviso_id: int, ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  GET /api/reparto/aviso/17/opciones
        → 200 {"aviso":{…avisos.shape…, "customer":"Casa Bermejo"},
               "opciones":[{"id":"o1","label":"Me ha pagado los dos","free":false}, …,
                           {"id":"otra","label":"Otra cosa","free":true}]}
        → 400 {"error":"aviso_automatico","detail":"<es-ES>"}
        → 404 {"error":"no_such_aviso"|"no_such_customer", …}

    **EL CUESTIONARIO, AT THE DOOR** — full-screen, one question, 3–4 big numbered options and «Otra
    cosa» at the bottom, which also takes dictation. The options are generated FOR THIS AVISO and
    this customer's state right now: a note that says «que me pague los dos albaranes de junio»
    yields outcomes about those albaranes, not a menu.

    **AND HE IS NEVER BLOCKED BY OUR LLM.** `avisos.generate_options` cannot raise and cannot hang —
    no key, a dead model, a 529, four seconds of silence, junk in the tool call all land on the same
    three (Hecho · No he podido · Hablamos), which the day read already ships as `opciones_aviso` so
    the phone has them before it asks. This route makes the question better; it never makes it
    possible, and a van with no signal resolves avisos exactly the same way.

    **THERE IS NO `responder` HERE, and the absence is the design.** Writing back is the BOSS's move
    (`/api/sup/aviso/{id}/opciones` declares that door); the driver answers, he does not brief
    himself — which is why `reply` is not accepted on his resolver either.

    NO EURO FIGURE IS INVENTED FOR THE QUESTION. The model is handed the ledger's already-formatted
    label and nothing numeric of its own, and any option that mints a figure we did not give it is
    dropped before it reaches a thumb (`avisos._clean`). A made-up amount suggested to a driver is
    still a made-up amount spoken at a restaurant's door."""
    tenant = ctx["tenant_slug"]
    async with db.get_pool().acquire() as con:
        rung = await _my_aviso(con, ctx, int(aviso_id))
        # The ledger's own words, and only when there is something to say. A customer who owes
        # nothing contributes NO «LO QUE DEBE» line — never «0,00 €», which would be a claim about
        # money made by a read. Fail-soft: an unreadable ledger costs sharpness, never the question.
        qctx: Dict[str, Any] = {"audience": avisos.REPARTIDOR, "customer": rung["customer"]}
        try:
            pos = await delivery.owed(con, tenant, rung["phone_number"])
            if pos["count"]:
                if pos["label"] != delivery.euros(None):
                    qctx["owed_label"] = pos["label"]
                qctx["age_label"] = delivery.age_label(int(pos["oldest_days"] or 0))
        except Exception:
            log.debug("reparto: ledger context fail-soft for the questionnaire", exc_info=True)
    opciones = await avisos.generate_options(rung["body"], qctx)
    await _audit(ctx, "reparto.aviso_opciones", target_id=str(aviso_id),
                 detail={"opciones": len(opciones),
                         "generico": opciones == avisos.fallback_options(avisos.REPARTIDOR)},
                 soft=True)
    return {"aviso": rung, "opciones": opciones}


@router.post("/aviso/{aviso_id}/resolver")
async def reparto_aviso_resolver(aviso_id: int, payload: dict,
                                 ctx: dict = Depends(require_driver)) -> dict:
    """THE WIRE:  POST /api/reparto/aviso/17/resolver
        body {"choice":"Me ha pagado uno solo", "note":"el de junio"}
          → 200 {"aviso":{…},"raised":{…}|null,"already":false}
          → 400 {"error":"bad_resolution","detail":"Elige una opción o escribe qué ha pasado…"}
          → 400 {"error":"bad_resolution","detail":"Ese aviso no se cierra a mano: desaparece solo
                 cuando se liquide lo que el cliente debe."}
          → 404 {"error":"no_such_aviso", …}

    `avisos.resolve` is CALLED, never re-implemented — including its three refusals, whose es-ES
    sentences are passed through verbatim: an `auto` (money) aviso cannot be closed by a person, a
    resolution with neither a choice nor free text is not a resolution, and another tenant's aviso
    does not exist here (LookupError → 404, never an empty 200 that reads as «nada que hacer»).

    `raised` is the LOOP: resolving a driver's nota raises the counter-aviso to the JEFE carrying the
    driver's own words verbatim. `reply` is deliberately NOT accepted on this door — that argument is
    how the BOSS writes back, and this is the driver's door. He answers; he does not brief himself.

    No event is emitted here: `avisos.resolve` writes `aviso.resolved` (and `aviso.raised` for the
    next rung) on the same spine, and a second copy from the router would double the timeline."""
    tenant = ctx["tenant_slug"]
    p = payload or {}
    by = await _operator_id(ctx)
    try:
        async with db.get_pool().acquire() as con:
            # audience=REPARTIDOR is the fence: this door resolves the DRIVER'S avisos and cannot
            # reach the boss's queue, whatever integer the client sends.
            out = await avisos.resolve(con, tenant, int(aviso_id),
                                       choice=str(p.get("choice") or ""),
                                       note=str(p.get("note") or ""), by=by,
                                       audience=avisos.REPARTIDOR)
    except ValueError as e:
        raise _err(400, "bad_resolution", str(e))
    except LookupError:
        raise _err(404, "no_such_aviso", "Ese aviso ya no está. Vuelve a abrir la parada.")
    await _audit(ctx, "reparto.aviso_resuelto", target_id=str(aviso_id),
                 detail={"already": out["already"], "raised": bool(out["raised"])})
    return out


# ══ THE WEBHOOK'S DOOR — where a card payment actually becomes a settlement ══════════════════════
async def record_checkout_paid(session: Dict[str, Any]) -> Dict[str, Any]:
    """A `checkout.session.completed` object → the settlement, IF it is one of ours and IF Stripe
    says it was paid. Returns {"ok":bool, "reason":str, …}; never invents an amount.

    **THIS IS THE ONLY THING THAT SETTLES A CARD PAYMENT.** `/cobro` and `/link` mint links and write
    nothing, on purpose: a driver tapping «Tarjeta» in front of a customer is a plan, not a payment,
    and the ledger holds facts.

    Idempotent on `external_ref`: the session id is stored on every row it writes, and a redelivered
    webhook (Stripe retries for days) finds it and does nothing. `delivery.settle` still reads the
    amount from the ledger — the figure Stripe reports is deliberately not used, because the ledger's
    own number is the one the customer was asked for and the two agreeing is something to CHECK, not
    something to assume.

    It does NOT swallow database failures: a lost settlement is money, so an exception propagates and
    Stripe redelivers. Only «not ours» and «already recorded» come back as a skip."""
    s = session or {}
    meta = s.get("metadata") or {}
    if (meta.get("kind") or "") != CHECKOUT_KIND:
        return {"ok": False, "reason": "not_ours"}
    if (s.get("payment_status") or "") not in ("paid", "no_payment_required"):
        return {"ok": False, "reason": "not_paid"}
    tenant = str(meta.get("tenant") or "")
    ids = [x for x in str(meta.get("order_ids") or "").split(",") if x]
    sid = str(s.get("id") or "")
    if not tenant or not ids or not sid:
        log.warning("reparto webhook: a reparto session with nothing to settle (%s)", sid)
        return {"ok": False, "reason": "incomplete"}
    async with db.get_pool().acquire() as con:
        seen = await con.fetchval(
            "select 1 from delivery_settlements where tenant_id = $1 and external_ref = $2 limit 1",
            tenant, sid)
        if seen:
            return {"ok": True, "reason": "already", "session_id": sid}
        try:
            res = await delivery.settle(con, tenant, ids, delivery.TARJETA, by="stripe",
                                        external_ref=sid, note="Cobro con tarjeta (Stripe)")
        except LookupError:
            # The orders this session was for are gone. Raising would make Stripe redeliver for days
            # against something that can never succeed, so it is LOGGED LOUDLY and closed — a
            # customer has paid for deliveries we can no longer find, and that is a person's problem,
            # not a retry's.
            log.error("reparto webhook: PAID session %s names orders that are not %s's: %s",
                      sid, tenant, ids)
            return {"ok": False, "reason": "no_such_order", "session_id": sid, "order_ids": ids}
        phone = await con.fetchval(
            "select phone_number from orders where tenant_id = $1 and id = $2", tenant, ids[0]) or ""
        await delivery.sync_overdue_aviso(con, tenant, phone)
    await _emit(phone, "reparto.liquidada",
                {"text": f"Pagado con tarjeta: {res['label']}.", "order_ids": ids,
                 "label": res["label"], "method": delivery.TARJETA, "external_ref": sid},
                f"reparto.liquidada:stripe:{sid}")
    log.info("reparto: card settlement recorded tenant=%s orders=%d %s", tenant, res["orders"], sid)
    return {"ok": True, "reason": "settled", "session_id": sid, **res}


# ══ mount ════════════════════════════════════════════════════════════════════════════════════════
async def _api_error(request: Request, exc: SupApiError) -> JSONResponse:
    """The contract's wire for a refusal: {error, detail?} — a machine-readable code the client
    branches on, and an es-ES sentence it may render verbatim.

    `sup_api.mount` registers a handler for the same exception with the same two fields; whichever of
    the two mounts last wins, and they cannot disagree because `SupApiError` has exactly those
    fields. Registered here anyway so this organ is correct on its own — a router whose refusals turn
    into 500s because another module happened not to be mounted is not a door, it is a trap."""
    body: Dict[str, Any] = {"error": exc.error}
    if exc.detail:
        body["detail"] = exc.detail
    return JSONResponse(body, status_code=exc.status)


def mount(app) -> None:
    """Wire the driver's door into the FastAPI app. ONE line in app.py:

        import reparto_api; reparto_api.mount(app)

    No hooks and no seam: unlike `sup_api.mount`, this organ borrows nothing from `app.py` — every
    rule it needs already lives in a module both files import (`delivery`, `avisos`, `brain/auth`,
    `brain/window`, `brain/range`, `sup_session`). That is why it can be mounted with one line and
    why `app.py` did not have to be opened to add a feature.

    It adds only NEW paths under `/api/reparto/…`; app.py's own bare `GET /api/reparto` is untouched
    and, being registered first, still wins every match it already had. Nothing is shadowed."""
    app.add_exception_handler(SupApiError, _api_error)
    app.include_router(router)
