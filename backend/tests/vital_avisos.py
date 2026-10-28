"""vital_avisos.py — THE MESSAGE ARRIVES AT THE RIGHT PLACE, AND NOTHING BLOCKS THE MAN AT THE DOOR
(SPEC §5.11.5).

An aviso is the boss and the driver having a conversation in which each message is delivered only in
the configuration where it matters — at that customer, on that doorstep, that morning. Each check
below is a product promise, not arithmetic:

  A1  TWO KINDS, ONE OBJECT      — `auto` is computed and CANNOT be dismissed by a person (it goes
                                   away when the money does); `nota` is written by a person and is
                                   resolved. «Dismissible» is what the KIND means, never a column.
  A2  THE DRIVER IS NEVER BLOCKED BY OUR LLM — no key · a dead model · a 529 · four seconds of
                                   silence · junk in the tool call → the aviso STILL RESOLVES,
                                   through the generic set (Hecho · No he podido · Hablamos). The
                                   model makes the question better; it never makes it possible.
  A3  THE QUESTIONNAIRE IS ABOUT *THIS* AVISO — «que me pague los dos albaranes de junio» yields
                                   options about THOSE albaranes, 3–4 of them, and «Otra cosa» is
                                   always the last one and always takes free text.
  A4  THE MODEL CANNOT MINT A NUMBER — an option carrying a figure nobody gave it is DROPPED. The
                                   ledger is the only source of any amount in this feature, and a
                                   made-up euro amount suggested to a driver is still a made-up euro
                                   amount. One bad option costs that option, never the questionnaire.
  A5  HIS WORDS, VERBATIM        — the counter-aviso quotes what the driver actually chose and typed
                                   over the note it answers. Nothing is summarised or interpreted.
  A6  THE LOOP TERMINATES        — driver answers → the boss's aviso; the boss writes back → the next
                                   nota at that customer's next stop; the boss closes → NOTHING is
                                   raised and the thread ends. An `auto` never enters the loop.
  A7  A NOTA THAT ISN'T ONE RAISES — empty, oversized, or addressed to nobody is refused in es-ES,
                                   BEFORE the database is touched. Fail soft on the read, never on
                                   the rule (brain/range's discipline).
  A8  EVERY RUNG WRITES AN EVENT — aviso.raised / aviso.resolved on the CUSTOMER's scope, carrying
                                   the chosen option verbatim, deduped by the aviso's own id.
  A9  THE ROUND-TRIP + TENANT ISOLATION — a customer's open avisos, money first; the boss's queue;
                                   the thread; and another tenant's aviso does not exist here.

A1–A8 are PURE — no database, no key, no network, no model. `runtime.emit_sense` is stubbed for the
whole file (the spine has its own vitals; this one is about avisos), and the resolve path is proved
against a small connection double so that a box with no Postgres still proves the LLM-down promise
end to end. A9 is the real round-trip and needs a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_avisos.py
Without REHEARSAL_DSN it SKIPS cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_avisos.py
"""
import asyncio
import os
import sys
import time
import types
from datetime import date as _date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── the clone's DSN goes into the environment FIRST, before any import ───────────────────────────
# `config` reads DATABASE_URL at IMPORT time and A2 below imports it (to prove the no-key path with
# the real model seam). Propagating the DSN after that import would leave the round-trip pointed at
# whatever this box's default is — which is the LIVE database. Order is the safety here; the
# `current_database() == 'rocoto'` refusal in A9 is only the second wall.
_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)

# ── the spine, stubbed before anything can import the real one ───────────────────────────────────
# `avisos._emit` does `import runtime` at call time, so this double is what it finds. It is here to
# make the EVENT CONTRACT assertable (scope · type · payload · dedupe key) without booting the
# runtime, not to test the spine — `vital_spine`/`vital_senses` own that.
EVENTS = []
_fake_runtime = types.ModuleType("runtime")


async def _fake_emit(*, phone="", scope="", type="", source="", payload=None, dedupe_key=None,
                     entity_key=None):
    EVENTS.append({"phone": phone, "type": type, "source": source,
                   "payload": dict(payload or {}), "dedupe_key": dedupe_key})
    return f"wa.{''.join(c for c in phone if c.isdigit())}"


_fake_runtime.emit_sense = _fake_emit
sys.modules["runtime"] = _fake_runtime

import avisos  # noqa: E402

R = []
SKIPPED = []
TENANT = "vitalavisos"          # invented; never a real company (LOCKED LAW)
OTHER = "vitalavisos2"          # the tenant next door, who must never see a thing
PHONE = "+34900000011"          # Casa Bermejo (invented; never a real number)


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


NOTA_BODY = "Dile a Manolo que me pague los dos albaranes de junio, que ya vale"


# ══ A1 · two kinds, one object ═══════════════════════════════════════════════════════════════════
_auto = avisos.shape({"id": 7, "phone_number": PHONE, "kind": "auto", "audience": "repartidor",
                      "band": "subrayado", "body": "2 entregas sin pagar · 480,20 €",
                      "state": "abierto", "auto_key": "pago_vencido"})
_nota = avisos.shape({"id": 8, "phone_number": PHONE, "kind": "nota", "audience": "repartidor",
                      "band": "nota", "body": NOTA_BODY, "state": "abierto"})
ck("A1 the money aviso is NOT dismissible — it goes away when the fact does",
   _auto["dismissible"] is False and _auto["kind"] == "auto")
ck("A1 a person's nota is", _nota["dismissible"] is True)
ck("A1 «dismissible» is computed from the KIND, never stored as a flag",
   "dismissible" not in avisos._FIELDS)
ck("A1 one object, two kinds — the same shape carries both",
   set(_auto) == set(_nota) and avisos.KINDS == ("auto", "nota"))
ck("A1 the only automatic generator is delivery's, and this module CALLS it",
   avisos._sync_auto.__doc__ and "delivery.sync_overdue_aviso" in avisos._sync_auto.__doc__
   and avisos.delivery.sync_overdue_aviso is not None)
ck("A1 there is no amount anywhere in this module (the ledger owns every euro)",
   not any(w in open(avisos.__file__).read().lower()
           for w in ("amount_cents", "value_snapshot", "cents:")))


# ══ A2 · the driver is NEVER blocked by our LLM ══════════════════════════════════════════════════
GENERIC = ["Hecho", "No he podido", "Hablamos", "Otra cosa"]


def _labels(opts):
    return [o["label"] for o in opts]


def _stub_model(result=None, boom=None, sleep=0.0):
    async def _call(body, ctx):
        if sleep:
            await asyncio.sleep(sleep)
        if boom:
            raise boom
        return result
    return _call


_orig_ask = avisos._ask_model
_orig_timeout = avisos.OPTIONS_TIMEOUT_S
try:
    # (a) the model raises — the 529/credit-outage shape
    avisos._ask_model = _stub_model(boom=RuntimeError("model down"))
    down = asyncio.run(avisos.generate_options(NOTA_BODY, {"customer": "Casa Bermejo"}))
    ck("A2 model DOWN → the generic set, and it still ends in «Otra cosa»", _labels(down) == GENERIC,
       str(_labels(down)))

    # (b) the model answers, but with junk — no key, a wrong shape, an empty list
    for label, junk in (("None", None), ("a bare string", "vale"), ("no «opciones» key", {"x": 1}),
                        ("an empty list", {"opciones": []}),
                        ("one usable option only", {"opciones": ["Hecho", "", "   "]})):
        avisos._ask_model = _stub_model(result=junk)
        out = asyncio.run(avisos.generate_options(NOTA_BODY, {}))
        ck(f"A2 model returns {label} → the generic set", _labels(out) == GENERIC, str(_labels(out)))

    # (c) the model is SLOW — the timeout is the promise, not the model's goodwill
    avisos.OPTIONS_TIMEOUT_S = 0.05
    avisos._ask_model = _stub_model(result={"opciones": ["tarde", "muy tarde"]}, sleep=3.0)
    t0 = time.monotonic()
    slow = asyncio.run(avisos.generate_options(NOTA_BODY, {}))
    dt = time.monotonic() - t0
    ck("A2 model SLOW → we stop waiting and hand him the generic set",
       _labels(slow) == GENERIC and dt < 1.0, f"{dt * 1000:.0f} ms")
finally:
    avisos._ask_model = _orig_ask
    avisos.OPTIONS_TIMEOUT_S = _orig_timeout

ck("A2 the wait a driver can be asked to do is seconds, not a minute",
   0 < avisos.OPTIONS_TIMEOUT_S <= 5.0, f"{avisos.OPTIONS_TIMEOUT_S}s")

# (d) NO KEY AT ALL — the real `_ask_model`, no stub, no network. This is the honest version of the
# promise: on a box with no ANTHROPIC_API_KEY the questionnaire still appears, instantly.
try:
    import config as _config
    if getattr(_config, "ANTHROPIC_API_KEY", ""):
        skip("A2 no key configured → the generic set, with the REAL model path",
             "this box HAS a key (the stubbed failure paths above still ran)")
    else:
        t0 = time.monotonic()
        nokey = asyncio.run(avisos.generate_options(NOTA_BODY, {"customer": "Casa Bermejo"}))
        dt = time.monotonic() - t0
        ck("A2 NO KEY configured → the generic set, with the real model path and no network",
           _labels(nokey) == GENERIC and dt < 1.0, f"{dt * 1000:.0f} ms")
except Exception as e:                                # importing config must never break the vital
    skip("A2 no key configured", f"config unavailable ({type(e).__name__})")

ck("A2 generate_options can never raise — every failure is a `return`",
   asyncio.run(avisos.generate_options("", None)) == avisos.fallback_options())
ck("A2 …and the boss's generic set is HIS three moves, not the driver's",
   _labels(avisos.fallback_options("jefe"))
   == ["Cerrado", "Le escribo al repartidor", "Lo hablo yo con el cliente", "Otra cosa"])


# ══ A3 · the questionnaire is about THIS aviso ═══════════════════════════════════════════════════
_GOOD = {"opciones": ["Me ha pagado los dos albaranes", "Me ha pagado uno solo",
                      "Dice que la semana que viene", "No estaba Manolo", "Sobra, la quinta"]}
_orig_ask = avisos._ask_model
try:
    avisos._ask_model = _stub_model(result=_GOOD)
    gen = asyncio.run(avisos.generate_options(NOTA_BODY, {"customer": "Casa Bermejo"}))
finally:
    avisos._ask_model = _orig_ask
ck("A3 the generated options are about THOSE albaranes, not a fixed list",
   "Me ha pagado los dos albaranes" in _labels(gen) and _labels(gen) != GENERIC, str(_labels(gen)))
ck("A3 never more than four to choose from (a thumb, in the rain)",
   len(gen) == avisos.MAX_OPTIONS + 1 and "Sobra, la quinta" not in _labels(gen))
ck("A3 «Otra cosa» is always last and always takes free text",
   gen[-1]["label"] == "Otra cosa" and gen[-1]["free"] is True
   and all(o["free"] is False for o in gen[:-1]))
ck("A3 the LABEL is what gets stored, not our id (his words, not our word for them)",
   "verbatim" in avisos.resolve.__doc__ and "his" in avisos.option.__doc__)
ck("A3 a duplicate the model repeated is not offered twice",
   len({o["label"] for o in gen}) == len(gen))


# ══ A4 · the model cannot mint a number ══════════════════════════════════════════════════════════
_MINTED = ["Me ha pagado 480,20 €", "Le quedan 3 albaranes", "Me ha pagado los dos albaranes"]
kept = avisos._clean(_MINTED, NOTA_BODY)
ck("A4 an option that mints a EURO amount nobody gave it is DROPPED",
   "Me ha pagado 480,20 €" not in kept, str(kept))
ck("A4 …and so is an invented count", "Le quedan 3 albaranes" not in kept)
ck("A4 one bad option costs that option, never the questionnaire",
   kept == ["Me ha pagado los dos albaranes"])
_ctx = {"owed_label": "480,20 €", "age_label": "hace 34 días"}
kept2 = avisos._clean(["Me ha pagado los 480,20 €", "Lleva 34 días y sigue igual"],
                      avisos._source_text(NOTA_BODY, _ctx))
ck("A4 a figure WE handed it (from the ledger) may be repeated back", len(kept2) == 2, str(kept2))
ck("A4 the model is only ever shown the formatted label, never cents",
   all(k in ("customer", "owed_label", "age_label", "window_label", "answer")
       for k, _ in avisos._CTX_LABEL))
ck("A4 an option too long to read at a glance is not offered",
   avisos._clean(["x" * (avisos.MAX_OPTION + 1)], NOTA_BODY) == [])


# ══ A5 · his words, verbatim ═════════════════════════════════════════════════════════════════════
body = avisos.counter_body(NOTA_BODY, "Me ha pagado uno solo", "el de junio, el otro dice el lunes")
ck("A5 the counter-aviso carries the driver's chosen option VERBATIM",
   "«Me ha pagado uno solo" in body, body)
ck("A5 …and his free text too, un-summarised", "el otro dice el lunes" in body)
ck("A5 …over the note it answers, so the boss reads the whole exchange",
   "sobre tu nota" in body and "albaranes de junio" in body)
ck("A5 nothing is raised out of an empty answer", avisos.counter_body(NOTA_BODY, "", "") == "")
ck("A5 a long note is clipped VISIBLY, never silently",
   avisos.counter_body("x" * 300, "Hecho", "").endswith("…»"))


# ══ A6 · the loop terminates ═════════════════════════════════════════════════════════════════════
_from_boss = {"kind": "nota", "audience": "repartidor", "body": NOTA_BODY}
_to_boss = {"kind": "nota", "audience": "jefe", "body": "«Hecho» — sobre tu nota: «…»"}
r1 = avisos.next_rung(_from_boss, "Me ha pagado los dos albaranes", "")
ck("A6 the driver answers → the boss gets an aviso back",
   r1["audience"] == "jefe" and "Me ha pagado los dos albaranes" in r1["body"])
r2 = avisos.next_rung(_to_boss, "Cerrado", "")
ck("A6 the boss closes it → NOTHING is raised. The thread ends.",
   r2["audience"] == "" and r2["body"] == "")
r3 = avisos.next_rung(_to_boss, "Le escribo al repartidor", "",
                      reply="Que no le deje nada más hasta que pague")
ck("A6 the boss writes back → the next nota, for the driver, at that customer's next stop",
   r3["audience"] == "repartidor" and r3["body"] == "Que no le deje nada más hasta que pague")
ck("A6 an `auto` is never part of a conversation",
   avisos.next_rung({"kind": "auto", "audience": "repartidor", "body": "480,20 €"}, "Hecho")
   == {"audience": "", "band": "nota", "body": ""})
ck("A6 the rule is PURE — the whole conversation is assertable with no database",
   avisos.next_rung.__doc__ and "pure" in avisos.next_rung.__doc__.lower())


# ══ A7 · a nota that isn't one RAISES (never fail-soft on the rule) ══════════════════════════════
async def _refuses(**kw):
    """con=None on purpose: if validation did NOT refuse, the call reaches the (absent) database and
    we see an AttributeError instead of the es-ES sentence. That is the tell."""
    try:
        await avisos.write_nota(None, TENANT, PHONE, **{"body": "vale", **kw})
    except ValueError as e:
        return str(e)
    except Exception as e:
        return f"__WRONG__{type(e).__name__}: {e}"
    return ""


async def _all_refusals():
    return [await _refuses(body=""), await _refuses(body="   \n  "),
            await _refuses(body="x" * (avisos.MAX_BODY + 1)),
            await _refuses(audience="cualquiera"), await _refuses(band="rojo")]


_bad = asyncio.run(_all_refusals())
ck("A7 empty · whitespace · oversized · nobody · a band that isn't one all RAISE, in es-ES",
   all(m and not m.startswith("__WRONG__") for m in _bad),
   " | ".join(m or "(accepted!)" for m in _bad)[:200])
ck("A7 the message names the FIX, never a code",
   all(any(w in m.lower() for w in ("escribe", "resúmela", "di para quién", "no existe"))
       for m in _bad), _bad[2][:90])


async def _resolve_refuses(**kw):
    try:
        await avisos.resolve(None, TENANT, 1, **kw)
    except ValueError as e:
        return str(e)
    except Exception as e:
        return f"__WRONG__{type(e).__name__}: {e}"
    return ""


ck("A7 a resolution with nothing chosen and nothing typed is not a resolution",
   (lambda m: m and not m.startswith("__WRONG__"))(asyncio.run(_resolve_refuses(choice="", note=""))),
   asyncio.run(_resolve_refuses(choice="", note="")))


# ══ A8 · every rung writes an event — and the resolve FLOW, with no Postgres on the box ══════════
class _Con:
    """A CONNECTION DOUBLE, and deliberately not a database. It answers the three statements the
    resolve path makes — the select, the conditional update, the insert — so the FLOW (an auto
    refused · a nota closed · the counter raised · the event emitted) is provable on a box with no
    Postgres. It stores nothing and asserts nothing about SQL; the real round-trip is A9's job."""

    def __init__(self, row):
        self.row, self.inserted = dict(row), []

    async def fetchrow(self, sql, *args):
        head = sql.strip().split()[0].lower()
        if head == "select":
            return self.row
        if head == "update":
            if self.row.get("state") != "abierto":
                return None                            # the conditional update, honestly modelled
            self.row = {**self.row, "state": "resuelto", "resolved_choice": args[4],
                        "resolved_note": args[5], "resolved_by": args[3]}
            return self.row
        if head == "insert":
            new = {"id": 900 + len(self.inserted), "tenant_id": args[0], "phone_number": args[1],
                   "kind": args[2], "audience": args[3], "band": args[4], "body": args[5],
                   "state": "abierto", "created_by": args[6], "parent_id": args[7]}
            self.inserted.append(new)
            return new
        raise AssertionError(f"unexpected statement: {sql[:40]}")


_OPEN = {"id": 41, "tenant_id": TENANT, "phone_number": PHONE, "kind": "nota",
         "audience": "repartidor", "band": "nota", "body": NOTA_BODY, "state": "abierto",
         "created_by": "op_jefe", "parent_id": None}

EVENTS.clear()
con = _Con(_OPEN)
# the LLM is DOWN for this whole exchange — the driver taps the generic «Hecho» and it resolves.
res = asyncio.run(avisos.resolve(con, TENANT, 41, choice="Hecho", note="me ha pagado en efectivo",
                                 by="op_repartidor"))
ck("A2/A8 with the model unavailable the aviso STILL RESOLVES, off the generic set",
   res["aviso"]["state"] == "resuelto" and res["aviso"]["resolved_choice"] == "Hecho")
ck("A8 …and the counter-aviso reached the boss, threaded by parent_id",
   res["raised"] and res["raised"]["audience"] == "jefe" and res["raised"]["parent_id"] == 41,
   str(res["raised"] and res["raised"]["body"]))
ck("A8 aviso.resolved carries the chosen option VERBATIM (§5.11.8)",
   any(e["type"] == "aviso.resolved" and e["payload"]["choice"] == "Hecho" for e in EVENTS))
ck("A8 aviso.raised is written for the new rung", any(e["type"] == "aviso.raised" for e in EVENTS))
ck("A8 every event lands on the CUSTOMER's scope, from this module",
   all(e["phone"] == PHONE and e["source"] == "avisos" for e in EVENTS), str(len(EVENTS)))
ck("A8 each event is deduped by the aviso's own id — a retry cannot double-write a timeline",
   sorted(e["dedupe_key"] for e in EVENTS) == ["aviso.raised:900", "aviso.resolved:41"],
   str([e["dedupe_key"] for e in EVENTS]))
ck("A8 the event text is es-ES and quotes the words",
   all(e["payload"]["text"] and "«" in e["payload"]["text"] for e in EVENTS))

EVENTS.clear()
again = asyncio.run(avisos.resolve(con, TENANT, 41, choice="Hecho", by="op_repartidor"))
ck("A8 a second tap in the rain is a double-tap, not a second answer",
   again["already"] is True and again["raised"] is None and EVENTS == [])

EVENTS.clear()
_auto_row = {**_OPEN, "id": 42, "kind": "auto", "band": "subrayado",
             "body": "2 entregas sin pagar · 480,20 €", "auto_key": "pago_vencido"}
try:
    asyncio.run(avisos.resolve(_Con(_auto_row), TENANT, 42, choice="Hecho"))
    _refused = ""
except ValueError as e:
    _refused = str(e)
ck("A1 the money aviso REFUSES to be closed by hand, and says what does close it",
   "liquide" in _refused and "no se cierra a mano" in _refused, _refused)
ck("A1 …and refusing it wrote nothing to the timeline", EVENTS == [])

EVENTS.clear()
_boss_row = {**_OPEN, "id": 43, "audience": "jefe", "body": "«Hecho» — sobre tu nota: «…»"}
closed = asyncio.run(avisos.resolve(_Con(_boss_row), TENANT, 43, choice="Cerrado", by="op_jefe"))
ck("A6 the boss closing the thread raises NOTHING — it terminates",
   closed["raised"] is None and closed["aviso"]["state"] == "resuelto")
back = asyncio.run(avisos.resolve(_Con({**_boss_row, "id": 44}), TENANT, 44,
                                  choice="Le escribo al repartidor", by="op_jefe",
                                  reply="Que no le deje nada más hasta que pague"))
ck("A6 …and writing back lands the next nota on the driver, threaded to the boss's aviso",
   back["raised"]["audience"] == "repartidor" and back["raised"]["parent_id"] == 44
   and back["raised"]["body"] == "Que no le deje nada más hasta que pague")
ck("A6 the next rung is a `nota` — a person wrote it (the driver did, by choosing)",
   back["raised"]["kind"] == "nota" and back["raised"]["dismissible"] is True)


# ══ A9 · the round-trip, the queue and tenant isolation (needs a clone) ══════════════════════════
ORDER_ID = "ord_vitalavisos_1"
DAY_TEXT = "2026-06-20"                 # orders.delivery_date is TEXT
# …and `delivery.ensure_route` needs a real `date`: its insert casts $3::date, so asyncpg types the
# parameter as a date and refuses the 'YYYY-MM-DD' string the route id is built from. Noted here
# because it is a trap for the next caller, not a fact about avisos.
DAY = _date(2026, 6, 20)


async def _clean_db(con):
    for t in (TENANT, OTHER):
        await con.execute("delete from avisos where tenant_id=$1", t)
        await con.execute("delete from delivery_settlements where tenant_id=$1", t)
        await con.execute("delete from delivery_stops where tenant_id=$1", t)
        await con.execute("delete from delivery_routes where tenant_id=$1", t)
        await con.execute("delete from orders where tenant_id=$1", t)
        await con.execute("delete from customer_profiles where tenant_id=$1", t)


async def _owe_us(con):
    """A REAL debt, built through delivery.py's own machinery — an order with a resolved value, on a
    stop, delivered 40 days ago and never settled. Nothing here fabricates an aviso: the money aviso
    has to be EARNED off the ledger, exactly as it is in the van, or the check is theatre."""
    await con.execute(
        "insert into orders (id, tenant_id, phone_number, status, delivery_date, "
        "value_snapshot_cents) values ($1,$2,$3,'sent',$4,48020) on conflict (id) do nothing",
        ORDER_ID, TENANT, PHONE, DAY_TEXT)
    route = await avisos.delivery.ensure_route(con, TENANT, DAY)
    await avisos.delivery.sync_stops(con, TENANT, route["id"], [ORDER_ID])
    stop_id = await con.fetchval(
        "select id from delivery_stops where route_id=$1 and order_id=$2", route["id"], ORDER_ID)
    await avisos.delivery.mark_delivered(con, TENANT, int(stop_id), by="op_repartidor")
    # backdated on purpose: `credit_days` defaults to 30, so 40 days is genuinely past his terms.
    await con.execute("update delivery_stops set delivered_at = now() - interval '40 days' "
                      "where id=$1", int(stop_id))


async def _db_checks():
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_avisos against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")
        try:
            await _clean_db(con)
            await con.execute(
                "insert into customer_profiles (phone_number, tenant_id, display_name, address) "
                "values ($1,$2,'Casa Bermejo','') on conflict (tenant_id, phone_number) do update set "
                "tenant_id=excluded.tenant_id, display_name=excluded.display_name", PHONE, TENANT)

            n = await avisos.write_nota(con, TENANT, PHONE, NOTA_BODY, by="op_jefe")
            ck("A9/db a nota round-trips as an open `nota` for the repartidor",
               n["kind"] == "nota" and n["audience"] == "repartidor" and n["state"] == "abierto")

            openers = await avisos.open_for(con, TENANT, PHONE)
            ck("A9/db it surfaces on that customer's stop", [o["id"] for o in openers] == [n["id"]])
            ck("A9/db …and nowhere else — another customer's stop is clean",
               await avisos.open_for(con, TENANT, "+34900000099") == [])

            ck("A1/db an `auto` aviso NOBODY IS OWED does not survive a read — the generator "
               "closes it, because it goes away when the fact does",
               all(o["kind"] != "auto" for o in openers))

            # now a real debt: the money aviso is EARNED off the ledger by delivery.py's generator
            await _owe_us(con)
            ordered = await avisos.open_for(con, TENANT, PHONE)
            ck("A9/db the money aviso reads first, then the oldest note",
               [o["kind"] for o in ordered] == ["auto", "nota"], str([o["kind"] for o in ordered]))
            ck("A9/db it is the LEDGER's sentence, with the ledger's own figure",
               "480,20 €" in ordered[0]["body"] and "40 días" in ordered[0]["body"],
               ordered[0]["body"])
            ck("A9/db the money aviso is not dismissible on the wire either",
               ordered[0]["dismissible"] is False)
            try:
                await avisos.resolve(con, TENANT, ordered[0]["id"], choice="Hecho")
                hand = "__CLOSED IT BY HAND__"
            except ValueError as e:
                hand = str(e)
            ck("A9/db …and no tap can close it: only the money can",
               "no se cierra a mano" in hand, hand[:70])

            r = await avisos.resolve(con, TENANT, n["id"], choice="Me ha pagado uno solo",
                                     note="el de junio", by="op_repartidor")
            ck("A9/db resolving the driver's nota closes it and raises the boss's",
               r["aviso"]["state"] == "resuelto" and r["raised"]["audience"] == "jefe")
            ck("A9/db the driver's nota has left his stop (the money aviso has not)",
               [o["kind"] for o in await avisos.open_for(con, TENANT, PHONE)] == ["auto"])

            queue = await avisos.list_for_jefe(con, TENANT)
            ck("A9/db it is waiting in the boss's queue, with his customer's name resolved",
               [q["id"] for q in queue] == [r["raised"]["id"]] and "customer" in queue[0])

            back = await avisos.resolve(con, TENANT, r["raised"]["id"],
                                        choice="Le escribo al repartidor", by="op_jefe",
                                        reply="Que no le deje nada más hasta que pague")
            ck("A9/db the boss writes back and the nota is at the customer's next stop",
               [o["id"] for o in await avisos.open_for(con, TENANT, PHONE)
                if o["kind"] == "nota"] == [back["raised"]["id"]])

            chain = await avisos.thread(con, TENANT, back["raised"]["id"])
            ck("A9/db parent_id is a REAL thread — the whole exchange reads back in order",
               [c["id"] for c in chain] == [n["id"], r["raised"]["id"], back["raised"]["id"]],
               str([c["audience"] for c in chain]))

            ck("A9/db another tenant sees NOTHING of it",
               await avisos.open_for(con, OTHER, PHONE) == []
               and await avisos.list_for_jefe(con, OTHER) == []
               and await avisos.thread(con, OTHER, n["id"]) == [])
            try:
                await avisos.resolve(con, OTHER, back["raised"]["id"], choice="Hecho")
                cross = "__RESOLVED IT__"
            except LookupError as e:
                cross = str(e)
            except Exception as e:
                cross = f"__WRONG__{type(e).__name__}"
            ck("A9/db …and cannot resolve it: it does not exist here, LOUDLY (never an empty 200)",
               cross == "no_such_aviso", cross)

            # the whole reason the money aviso is not dismissible: it dismisses itself.
            await avisos.delivery.settle(con, TENANT, [ORDER_ID], "efectivo", by="op_repartidor")
            ck("A1/db the customer pays → the money aviso closes ITSELF on the next read. Nobody "
               "ever dismissed it; the fact went away.",
               all(o["kind"] != "auto" for o in await avisos.open_for(con, TENANT, PHONE)))
        finally:
            await _clean_db(con)


if _dsn:                                              # propagated into the environment at the top
    asyncio.run(_db_checks())
else:
    skip("A9 the round-trip, the queue and tenant isolation",
         "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_avisos: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — IT ARRIVES WHERE IT MATTERS, AND NOTHING BLOCKS THE MAN AT THE DOOR"
         if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
