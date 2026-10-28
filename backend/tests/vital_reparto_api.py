"""vital_reparto_api.py — THE DRIVER'S DOOR OPENS ONTO THE VAN AND NOTHING ELSE (SPEC §5.11).

`reparto_api.py` is the only surface a `repartidor` can reach at all, and it is the surface where a
man is asked for money at somebody's door. Each check below is a product promise, not arithmetic:

  D1  THE CAP IS THE FENCE        — every route hangs off ONE dependency, and that dependency demands
                                    `deliver`. A driver holds `deliver` and nothing on the
                                    read/act/admin ladder, so least privilege is a property of the
                                    cap set, not an allowlist somebody must remember to update.
  D2  THE CLIENT NEVER NAMES ITS TENANT — no route takes a tenant, and every statement the day read
                                    issues is filtered by the SESSION's tenant. Proved by RUNNING the
                                    route against a recording connection and reading the SQL back:
                                    two different sessions produce two different tenants, and neither
                                    ever sees the other's string.
  D3  TODAY, AND NOTHING ELSE     — a pure repartidor asking for another day is REFUSED OUT LOUD, not
                                    quietly handed today's list. Answering a different question from
                                    the one asked is the most expensive lie a delivery app can tell.
  D4  THERE IS NO MONEY IN THIS FILE — no euro sign, no division by 100, no sum over cents. Every
                                    amount and every label comes out of `delivery.py`.
  D5  A TARJETA COBRO NEVER SETTLES — tapping «Tarjeta» in front of a customer mints a LINK. It does
                                    not write to the ledger, on any path, including the ones that
                                    fail. Only Stripe knows whether money moved.
  D6  AN UNCONFIGURED STRIPE IS A REFUSAL, NEVER A LINK — a typed es-ES sentence that names the fix
                                    and tells him to take cash. Never a fake url, never silence.
  D7  A HALF-CONNECTED ACCOUNT IS A REFUSAL TOO — no account, or an account Stripe has not enabled
                                    charges on, each get their OWN sentence, because they have
                                    different fixes and «no se puede cobrar» helps nobody.
  D8  A COBRO MEANS ONE THING     — an id that is not this tenant's, or two customers in one cobro,
                                    refuse the WHOLE call. A wizard that says «liquidado» having
                                    settled two of the three deliveries in front of it is worse than
                                    one that refused.
  D9  ABSENCE IS A REAL STATE     — an order with no resolved value reads «sin importe», carries no
                                    figure, and cannot be put in a payment link. Order lines travel
                                    with no price at all.
  D10 THE ORGAN STANDS ALONE      — it never imports `app.py` (which imports it), and it re-registers
                                    the refusal wire itself, so mounting it is one line.

ALL OF IT IS PURE — no database, no config, no network, no Stripe. The DB-shaped checks run against a
RECORDING CONNECTION that captures every statement the routes issue, which is what makes D2 a proof
about the SQL rather than a hope about the handler.
Run: PYTHONPATH=. python3 tests/vital_reparto_api.py
"""
import asyncio
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import avisos  # noqa: E402
import db  # noqa: E402
import delivery  # noqa: E402
import reparto_api  # noqa: E402
import sup_api  # noqa: E402
from brain import auth as brain_auth  # noqa: E402
from brain import stripe_connect  # noqa: E402

R = []
TENANT = "vitalreparto"           # invented; never a real company (LOCKED LAW)
OTHER = "vitalotra"
PHONE = "+34900000101"
ORDER = "ord_del_dia_1"
DAY = "2026-07-27"
SRC = open(os.path.join(ROOT, "reparto_api.py"), encoding="utf-8").read()


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def ctx_for(tenant, role="repartidor"):
    """A session as `require_driver` builds one. The role is the ONLY thing that varies; the tenant
    is server-side in both, which is the point of D2."""
    return {"email": "manolo@example.com", "tenant_slug": tenant, "tenant_name": tenant,
            "role": role, "caps": sorted(brain_auth.APP_ROLE_CAPS.get(role, frozenset())),
            "via": "membership", "is_founder": False, "ip": "10.0.0.1"}


# ══ the recording connection ═════════════════════════════════════════════════════════════════════
# It answers by PATTERN, so the routes run their real code (delivery.py's own statements included)
# and every string they issue is kept for inspection. Nothing here fakes a route's decision — only
# the rows a database would have handed back.
STOP_ROW = {"id": 41, "order_id": ORDER, "position": None, "state": "pendiente",
            "failed_reason": "", "delivered_at": None, "proof_url": "", "note": ""}
ORDER_ROW = {"id": ORDER, "value_snapshot_cents": 48020,
             "lines": [{"item": "PALETA COCIDA", "qty": 4, "unit": "kg", "price": 12.5, "note": ""}]}
PROFILE_ROW = {"phone_number": PHONE, "display_name": "Casa Bermejo", "address": "C/ Mayor 1",
               "lat": 40.41, "lon": -3.70, "stats": {}}
ROUTE_ROW = {"id": f"rt_{TENANT}_{DAY}", "tenant_id": TENANT, "route_date": DAY,
             "driver_operator_id": None, "state": "planificada", "optimised_at": None,
             "total_distance_m": None, "total_duration_s": None, "unassigned": []}


class RecCon:
    def __init__(self, tenant):
        self.tenant = tenant
        self.sql = []                         # [(query, args)] — every statement, in order

    def _log(self, q, args):
        self.sql.append((" ".join(str(q).split()), tuple(args)))

    async def execute(self, q, *a):
        self._log(q, a)
        return "OK"

    async def executemany(self, q, rows):
        self._log(q, tuple(rows))
        return None

    async def fetch(self, q, *a):
        self._log(q, a)
        t = " ".join(str(q).split())
        if "as paid" in t:                    # delivery.payable / delivery.settle
            return [{"id": ORDER, "value_snapshot_cents": 48020, "paid": 0}]
        if "from delivery_stops" in t:
            return [dict(STOP_ROW, tenant_id=self.tenant)]
        if "from customer_profiles" in t:
            return [dict(PROFILE_ROW)]
        if "from avisos" in t:
            return []
        if "from orders" in t:
            return [dict(ORDER_ROW, phone_number=PHONE)]
        return []

    async def fetchrow(self, q, *a):
        self._log(q, a)
        t = " ".join(str(q).split())
        if "from delivery_routes" in t:
            return dict(ROUTE_ROW, id=f"rt_{self.tenant}_{DAY}", tenant_id=self.tenant)
        if "from customer_profiles" in t:
            return dict(PROFILE_ROW)
        return None

    async def fetchval(self, q, *a):
        self._log(q, a)
        t = " ".join(str(q).split())
        if "phone_number from orders" in t:
            return PHONE
        return None


class _Acq:
    def __init__(self, con):
        self.con = con

    async def __aenter__(self):
        return self.con

    async def __aexit__(self, *exc):
        return False


class RecPool:
    def __init__(self, con):
        self.con = con

    def acquire(self):
        return _Acq(self.con)


def install_pool(con):
    db.get_pool = lambda: RecPool(con)         # noqa: E731 — the whole point is the seam


# ══ D1 · the cap is the fence ════════════════════════════════════════════════════════════════════
_DEPENDS = set(re.findall(r"Depends\(([A-Za-z_][A-Za-z_0-9]*)\)", SRC))
ck("D1 every route hangs off ONE dependency, and it is the driver's",
   {"require_driver"} == _DEPENDS, str(sorted(_DEPENDS)))
ck("D1 …and that dependency demands `deliver`, by name",
   'brain_auth.app_can(ctx.get("role", ""), CAP)' in SRC and 'CAP = "deliver"' in SRC)
ck("D1 a repartidor holds `deliver` and NOTHING on the read/act/admin ladder",
   brain_auth.app_can("repartidor", "deliver")
   and not any(brain_auth.app_can("repartidor", c) for c in ("read", "act", "admin")))
ck("D1 the seniors carry it too — the day-one case is the boss driving his own van",
   all(brain_auth.app_can(r, "deliver") for r in ("owner", "founder", "staff")))
ck("D1 an unrecognised role reaches nothing here either",
   not brain_auth.app_can("desconocido", "deliver"))
ck("D1 the runtime fence is on the gate, so a foreign tenant is refused LOUD and never served empty",
   'raise _err(403, "tenant_scope_unavailable"' in SRC)

# ══ D10 · the organ stands alone ═════════════════════════════════════════════════════════════════
ck("D10 it never imports app.py (which imports IT — that would be the cycle)",
   not re.search(r"^\s*(import app\b|from app import)", SRC, re.M))
ck("D10 it registers the refusal wire itself, so mounting is one line",
   "app.add_exception_handler(SupApiError, _api_error)" in SRC
   and "app.include_router(router)" in SRC)
ck("D10 it borrows no hooks from app.py — mount takes the app and nothing else",
   re.search(r"^def mount\(app\) -> None:", SRC, re.M) is not None)

# ══ D4 · there is no money in this file ══════════════════════════════════════════════════════════
_CODE = "\n".join(ln for ln in SRC.splitlines()
                  if not ln.lstrip().startswith("#"))     # comments may DISCUSS money; code may not
ck("D4 no euro sign is ever formatted here — `delivery.euros` is the one place cents become words",
   "delivery.euros(" in SRC)
ck("D4 nothing divides by 100 (the cents→euros conversion lives in delivery.py)",
   "/ 100" not in _CODE and "/100" not in _CODE)
_SUMS = re.findall(r"sum\([^\n]*", _CODE)
ck("D4 every sum in this file COUNTS stops — none of them adds up euros",
   all(x.startswith("sum(1 for ") for x in _SUMS)
   and not re.search(r"cents[^\n]*[+\-*]=", _CODE), " | ".join(_SUMS)[:120])
ck("D4 the only euro figures on the wire are the ledger's own",
   'delivery.payable(' in SRC and '"label": pay["label"]' in SRC and '"cents": pay["cents"]' in SRC)
ck("D9 an order line crosses to the driver with NO price",
   '"price"' not in re.search(r"def _lines_wire.*?\n    return out", SRC, re.S).group(0))
ck("D9 «sin importe» is a real state, and it is delivery.py's word for it",
   delivery.euros(None) == "sin importe")


# ══ D3 · today, and nothing else ═════════════════════════════════════════════════════════════════
def _refused(fn, *a, **kw):
    """Run something that must refuse → (error_code, es-ES detail). '' means it did NOT refuse."""
    try:
        out = fn(*a, **kw)
        if asyncio.iscoroutine(out):
            out = asyncio.get_event_loop().run_until_complete(out)
    except sup_api.SupApiError as e:
        return e.error, e.detail, e.status
    return "", f"__ACCEPTED__ {out!r}", 0


_today = reparto_api._today()
ck("D3 no date at all is today — the depot's today, not UTC's and not the phone's",
   reparto_api._resolve_day(ctx_for(TENANT), "") == _today, _today)
ck("D3 asking for today is today", reparto_api._resolve_day(ctx_for(TENANT), _today) == _today)
_e, _d, _s = _refused(reparto_api._resolve_day, ctx_for(TENANT), "2026-01-03")
ck("D3 a pure repartidor asking for ANOTHER day is REFUSED — never quietly handed today's list",
   _e == "solo_hoy" and _s == 403 and "hoy" in _d.lower(), f"{_e}: {_d}")
ck("D3 the boss in his own van may name a day — he already reads every day on the desk",
   reparto_api._resolve_day(ctx_for(TENANT, "owner"), "2026-01-03") == "2026-01-03")
_e, _d, _s = _refused(reparto_api._resolve_day, ctx_for(TENANT), "el martes")
ck("D3 a date we cannot read is refused too, in es-ES — it is not «today», it is unreadable",
   _e == "bad_date" and _s == 400 and "2026-07-27" in _d, f"{_e}: {_d}")
ck("D3 «driver-only» is asked as a question about CAPS, so a future driving role inherits the fence",
   reparto_api._driver_only(ctx_for(TENANT, "repartidor"))
   and not reparto_api._driver_only(ctx_for(TENANT, "staff")))


# ══ D2 · the client never names its tenant, and the SQL proves it ════════════════════════════════
# Tables whose rows belong to a company. Every statement touching one must carry a tenant predicate
# AND the session's own tenant among its arguments.
SCOPED = ("orders", "customer_profiles", "delivery_routes", "delivery_stops",
          "delivery_settlements", "avisos", "tenant_credit", "tenant_range", "sup_audit",
          "team_members")


def _day_stops_stub(ctx, day):
    """`sup_api._day_stops` is the DESK's query and has its own vital; here it is stood in for so the
    statements under test are the ones this file issues."""
    async def _run():
        return {"depot": None,
                "stops": [{"order_id": ORDER, "phone_number": PHONE, "customer_name": "Casa Bermejo",
                           "business": "", "address": "C/ Mayor 1", "lat": 40.41, "lng": -3.70,
                           "window_from": "08:00", "window_to": "11:00", "window_text": "",
                           "window_source": "said", "window_scope": "customer"}]}
    return _run()


async def _run_day(tenant):
    con = RecCon(tenant)
    install_pool(con)
    sup_api._day_stops = _day_stops_stub
    out = await reparto_api.reparto_day(date="", ctx=ctx_for(tenant))
    return out, con.sql


def _flat(args):
    """Every value a statement carried, executemany's rows-of-rows flattened out — a tenant hiding
    one level down inside a batch insert is still the tenant that statement wrote."""
    out = []
    for x in args:
        out.extend(str(y) for y in x) if isinstance(x, (list, tuple)) else out.append(str(x))
    return out


def _fenced(q, args, tenant):
    """Can this statement reach ANOTHER company's rows? Two fences count, and only two:
      · a tenant predicate carrying THIS session's tenant — the ordinary case;
      · a `route_id` argument, because `delivery.route_id_for` builds it as `rt_<tenant>_<date>`,
        so the id IS the tenant. That is why the route id is built that way, and it is the fence on
        `sync_stops`'s «this order left the day» update, which carries no tenant_id column."""
    vals = _flat(args)
    if ("tenant_id" in q or "tenant_slug" in q) and tenant in vals:
        return True
    return "route_id" in q and any(v.startswith(f"rt_{tenant}_") for v in vals)


day, sql = asyncio.run(_run_day(TENANT))
_scoped = [(q, a) for q, a in sql if any(re.search(rf"\b{t}\b", q) for t in SCOPED)]
_unfenced = [q for q, a in _scoped if not _fenced(q, a, TENANT)]
ck("D2 EVERY statement the day read issues is fenced to the session's own company",
   _scoped and not _unfenced, f"{len(_scoped)} statements, {len(_unfenced)} unfenced"
   + (f" — first: {_unfenced[0][:90]}" if _unfenced else ""))
ck("D2 …and no other company's id appears anywhere in them",
   not any(OTHER in str(a) for _, a in sql))

day2, sql2 = asyncio.run(_run_day(OTHER))
ck("D2 a different session produces a different tenant — it is read from the SESSION, never sent",
   all(TENANT not in str(a) for _, a in sql2) and any(OTHER in str(a) for _, a in sql2))
ck("D2 no route accepts a tenant from the client — there is no such parameter to forge",
   not re.search(r'(payload|p|body)\.get\(\s*[\'"]tenant', SRC)
   and not re.search(r"def reparto_\w+\([^)]*tenant", SRC))

# …and the day it returns is still a day: honest shapes, counts, no euro total.
_stop = (day["stops"] or [{}])[0]
ck("D2/shape the stop carries the ledger's own label for its value, and the ledger's own column",
   _stop.get("value_cents") == 48020 and _stop.get("value_label") == delivery.euros(48020),
   str(_stop.get("value_label")))
ck("D9/shape the order lines reach the driver with no price on them",
   _stop.get("lines") == [{"name": "PALETA COCIDA", "qty": 4, "unit": "kg", "note": ""}],
   str(_stop.get("lines")))
ck("D4/shape the day carries COUNTS and no euro total — what goes in that sum is not this file's call",
   set(day["totals"]) == {"stops", "pendientes", "entregadas", "no_entregadas", "descartadas",
                          "sin_importe", "sin_direccion"}, str(sorted(day["totals"])))
ck("D3/shape the day says WHICH day it is, so the phone can never render the wrong one silently",
   day["day"] == _today)
ck("D1/shape the closed lists ride the wire, so the phone cannot invent a fifth failure reason",
   [m["id"] for m in day["motivos_fallo"]] == list(delivery.FAIL_REASONS))
ck("D1/shape a driver can always resolve an aviso — the generic questionnaire needs no model",
   [o["label"] for o in day["opciones_aviso"]][:3] == list(avisos.GENERIC[avisos.REPARTIDOR]))
ck("D2/shape nothing computed a sequence — `position` is READ, never written here",
   _stop.get("position") is None and day["route"]["sequenced"] is False
   and "save_sequence" not in SRC)


# ══ D5–D7 · the card rail: a link, never a settlement ════════════════════════════════════════════
SETTLED = []


async def _no_settle(*a, **kw):
    SETTLED.append((a, kw))
    return {"orders": 1, "cents": 48020, "label": "480,20 €", "method": "tarjeta", "credit_kind": ""}


async def _cobro(method, *, configured=True, status=None):
    """Run the real `/cobro` handler with Stripe stood in for. `delivery.settle` is REPLACED by a
    recorder: if the ledger is written on a tarjeta path, this test knows."""
    con = RecCon(TENANT)
    install_pool(con)
    delivery.settle = _no_settle
    stripe_connect.configured = lambda: configured                       # noqa: E731
    async def _status(t=None):
        return status or {}
    stripe_connect.status = _status
    # This block is about the CARD RAIL's refusals, so the round fence (proved in D8b) and the
    # settling-webhook handshake (proved in D6b) are both stood in for — otherwise every case here
    # would stop at the first gate and never reach the Stripe question it exists to ask.
    _real_round, _real_wired = reparto_api._on_my_round, reparto_api._settling_wired
    async def _on_round(*a, **kw):
        return True
    reparto_api._on_my_round = _on_round
    reparto_api._settling_wired = lambda: True                           # noqa: E731
    try:
        out = await reparto_api.reparto_cobro(
            {"order_ids": [ORDER], "method": method}, ctx_for(TENANT))
        return "", str(out), 0
    except sup_api.SupApiError as e:
        return e.error, e.detail, e.status
    finally:
        reparto_api._on_my_round, reparto_api._settling_wired = _real_round, _real_wired


_real_settle = delivery.settle
SETTLED.clear()

# ── D6b · A LINK THAT NOTHING CAN SETTLE MUST NOT BE MINTABLE ───────────────────────────────────
# `record_checkout_paid` is the only thing that writes a card payment into the ledger. If the link
# exists and the webhook does not, the customer pays, the ledger never hears, and the undismissible
# money aviso goes on shouting the amount he has already paid — so the next driver asks again. The
# guard makes that state impossible instead of documenting it, and it must refuse BEFORE Stripe is
# touched, so no payable session can be left behind.
async def _cobro_unwired():
    con = RecCon(TENANT); install_pool(con)
    delivery.settle = _no_settle
    _real_round, _real_wired = reparto_api._on_my_round, reparto_api._settling_wired
    async def _on_round(*a, **kw):
        return True
    touched = []
    reparto_api._on_my_round = _on_round
    reparto_api._settling_wired = lambda: False                          # noqa: E731
    stripe_connect.configured = lambda: (touched.append("stripe"), True)[1]   # noqa: E731
    try:
        await reparto_api.reparto_cobro({"order_ids": [ORDER], "method": "tarjeta"}, ctx_for(TENANT))
        return "", 0, touched
    except sup_api.SupApiError as e:
        return e.error, e.status, touched
    finally:
        reparto_api._on_my_round, reparto_api._settling_wired = _real_round, _real_wired


_e, _s, _touched = asyncio.run(_cobro_unwired())
ck("D6b with no settling webhook the card rail is SHUT — a typed 503, not a link",
   _e == "cobro_sin_conciliar" and _s == 503, f"{_s} {_e}")
ck("D6b …and it refuses BEFORE Stripe is touched — no session can be left payable",
   not _touched, f"stripe touched: {_touched}")
ck("D6b …and nothing was written to the ledger", not SETTLED, str(SETTLED))
SETTLED.clear()

e, d, s = asyncio.run(_cobro("tarjeta", configured=False))
ck("D6 an UNCONFIGURED Stripe refuses, with a typed code and a status of its own",
   e == "stripe_no_configurado" and s == 503, f"{s} {e}")
ck("D6 …and the refusal is an es-ES sentence that names the fix — never a code, never a fake link",
   "efectivo" in d.lower() and "bizum" in d.lower() and "http" not in d, d)
ck("D5 …and NOTHING was settled on the way out", SETTLED == [], str(SETTLED))

SETTLED.clear()
e, d, s = asyncio.run(_cobro("tarjeta", status={"configured": True, "connected": False}))
ck("D7 a tenant with NO connected account gets its own sentence — the fix is his, and it says so",
   e == "sin_cuenta_stripe" and s == 409 and "Ajustes" in d, f"{s} {e}: {d[:70]}")
ck("D5 …and still nothing was settled", SETTLED == [])

SETTLED.clear()
e, d, s = asyncio.run(_cobro("tarjeta", status={"configured": True, "connected": True,
                                                "account_id": "acct_x", "charges_enabled": False}))
ck("D7 an account Stripe has not enabled charges on is a DIFFERENT refusal — different fix",
   e == "cobros_no_activos" and s == 409, f"{s} {e}")
ck("D5 …and still nothing was settled", SETTLED == [])

ck("D5 the tarjeta branch structurally returns before the ledger is ever touched",
   re.search(r"if method == delivery\.TARJETA:.*?return out", SRC, re.S) is not None
   and SRC.index("if method == delivery.TARJETA:") < SRC.index("res = await delivery.settle("))
ck("D5 the minted link says so on the wire — `pagado` is False, and there is a sentence about it",
   '"pagado": False,' in SRC and "no lo des por cobrado antes" in SRC)
ck("D5 the ONLY thing that settles a card is the webhook, and it is idempotent on the session id",
   "async def record_checkout_paid" in SRC
   and "where tenant_id = $1 and external_ref = $2" in SRC)
ck("D5 the webhook refuses a session Stripe has not marked paid",
   'if (s.get("payment_status") or "") not in ("paid", "no_payment_required")' in SRC)
ck("D4 the charge is DIRECT on the supplier's account, with no second cut taken here",
   "stripe_account=acct" in SRC and "application_fee_amount=" not in SRC)
ck("D5 a double tap in the rain cannot mint two links a customer could both pay",
   "idempotency_key=idem" in SRC)
ck("D5 the ledger read and the Stripe call are two functions, and the second holds NO connection — "
   "eight drivers pressing «cobrar» at once must not deadlock a pool of eight",
   re.search(r"async def _mint_link\(tenant: str, pay: Dict\[str, Any\], \*, phone", SRC) is not None
   and "con" not in re.search(r"async def _mint_link\(([^)]*)\)", SRC).group(1))

delivery.settle = _real_settle


# ══ D8 · a cobro means one thing ═════════════════════════════════════════════════════════════════
class _OwnCon(RecCon):
    """The orders table, answering with exactly what the WHERE would really have matched."""
    def __init__(self, tenant, rows):
        super().__init__(tenant)
        self.rows = rows

    async def fetch(self, q, *a):
        self._log(q, a)
        if "phone_number from orders" in " ".join(str(q).split()):
            return self.rows
        return await super().fetch(q, *a)


async def _own(rows, ids, *, driver=False, on_round=True):
    """`_own_orders` takes the SESSION now, not a tenant string: for a pure repartidor it must also
    prove the customer is on HIS round today (the tenant filter says the orders belong to the
    company; it says nothing about this man being at that door). `on_round` stubs that lookup."""
    ctx = ctx_for(TENANT, "repartidor" if driver else "owner")
    real = reparto_api._on_my_round
    async def _stub(con, c, phone):
        return on_round
    reparto_api._on_my_round = _stub
    try:
        return "", await reparto_api._own_orders(_OwnCon(TENANT, rows), ctx, ids)
    except sup_api.SupApiError as e:
        return e.error, (e.status, e.detail)
    finally:
        reparto_api._on_my_round = real


e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE}], [ORDER]))
ck("D8 one customer's own deliveries pass, and the phone comes back with them",
   e == "" and out == ([ORDER], PHONE), str(out))
e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE}], [ORDER, "ord_de_otra_empresa"]))
ck("D8 an id that is not this tenant's refuses the WHOLE call — never a partial «liquidado»",
   e == "no_such_order" and out[0] == 404, f"{e} {out}")

# ── D8b · THE FENCE THE TENANT FILTER IS NOT ────────────────────────────────────────────────────
# `tenant_id` proves the orders belong to the company. It proves nothing about this driver standing
# at that door. Settling is an append-only write against real money, so without this a `deliver`-only
# account — the least-privileged in the product — could name any customer's orders and have the
# ledger record them as legitimately collected, with no way back.
e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE}], [ORDER],
                          driver=True, on_round=True))
ck("D8b a driver CAN settle a customer who is on his round today",
   e == "" and out == ([ORDER], PHONE), f"{e} {out}")
e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE}], [ORDER],
                          driver=True, on_round=False))
ck("D8b a driver CANNOT settle a customer who is NOT on his round — 404, not an empty 200",
   e == "no_such_order" and out[0] == 404, f"{e} {out}")
e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE}], [ORDER],
                          driver=False, on_round=False))
ck("D8b the boss in his own van is NOT fenced by the round (he already reads every customer)",
   e == "" and out == ([ORDER], PHONE), f"{e} {out}")
e, out = asyncio.run(_own([{"id": ORDER, "phone_number": PHONE},
                           {"id": "ord_2", "phone_number": "+34900000202"}], [ORDER, "ord_2"]))
ck("D8 two customers in one cobro refuses — the amount would be right and the receipt a lie",
   e == "varios_clientes" and out[0] == 400, f"{e} {out}")
e, out = asyncio.run(_own([], []))
ck("D8 no deliveries chosen is a refusal, in es-ES", e == "no_orders" and "entrega" in out[1], str(out))

_e, _d, _s = asyncio.run(_cobro("efectivo_o_lo_que_sea"))[0:3]
ck("D8 a payment method that is not one of the four is refused before anything is read",
   _e == "bad_method" and _s == 400 and "Bizum" in _d, f"{_e}: {_d}")

# ══ D9 · absence stays absent ════════════════════════════════════════════════════════════════════
ck("D9 an unvalued order can never enter a payment link — delivery.py refuses it, we pass it on",
   "no puedo cobrar una cantidad que no tengo" in open(
       os.path.join(ROOT, "delivery.py"), encoding="utf-8").read()
   and 'raise _err(400, "sin_importe", str(e))' in SRC)
ck("D9 an unlocated stop stays in the day — «sin dirección» inline, never a customer dropped",
   '"sin_direccion"' in SRC and "lat, lon = (here[0], here[1]) if here else (None, None)" in SRC)
ck("D9 a stop with no franja carries an empty label, which is what «sin franja» is rendered from",
   reparto_api.brain_window.label(reparto_api.brain_window.blank()) == "")

passed = sum(R)
print(f"vital_reparto_api: {passed}/{len(R)}"
      + (" — THE VAN, AND NOTHING ELSE" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
