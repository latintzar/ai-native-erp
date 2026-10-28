"""vital_reparto.py — THE DELIVERY WINDOW IS WHAT THE CUSTOMER TOLD US, AND NOTHING ELSE (§5.8a/WP-5).

The window was a shipped feature with no data behind it: two surfaces render it, and `/api/reparto`
returned it blank for every stop forever because "this product stores no delivery windows; a
fabricated one is a promise nobody made". That instinct was right and it is the thing this vital
exists to protect while the blank is filled in. Each check is a product promise, not arithmetic:

  W1  ABSENT IS A REAL STATE     — nobody stated one → every field empty, the surfaces read
                                   «sin franja», and NOTHING defaults, rounds or infers one into
                                   existence. A provenance with no times is not a window either.
  W2  A STATED WINDOW IS CAPTURED WITH ITS PROVENANCE — «repárteme antes de las once» becomes a real
                                   bound carrying source `said`, because a window a driver acts on
                                   must be traceable to who promised it.
  W3  TODAY BEATS ALWAYS         — the per-ORDER override wins over the customer's standing hours,
                                   and clearing it restores them rather than freezing a copy.
  W4  NOTHING COMPUTES AN ARRIVAL— no ETA, no arrival, no travel time, no leg, no sequence anywhere
                                   in the module, the route or the wire. ROUTE OPTIMISATION IS OUT
                                   OF SCOPE and this is the file it would leak in through.
  W5  OPEN-ENDED IS A WINDOW     — «a partir de las 8» is a promise with one bound, not a broken row.
  W6  WORDS STAY WORDS           — «por la mañana» is kept verbatim and is NOT turned into 08:00.
                                   Digits when they gave digits; their words when they gave words.
  W7  A WINDOW THAT ISN'T ONE RAISES — the write refuses 25:00, 13:00→09:00 and garbage, in es-ES.
                                   Fail-soft on the read, never on the rule (brain/range's discipline).
  W8  THE SORT IS A SORT         — the day is ordered by the hours the CUSTOMERS named, un-timed
                                   stops last. It reads a promise; it computes nothing about the van.

W1–W8 are PURE — no database, no config, no network. The round-trip and the shaped Reparto list
need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_reparto.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_reparto.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from brain import window as win  # noqa: E402

R = []
SKIPPED = []
TENANT = "vitalreparto"        # invented; never a real company (LOCKED LAW)
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


# Invented customers, never a real company (LOCKED LAW).
BAR_LUMBRE = "+34900000101"
CAFE_SOTILLO = "+34900000102"
MESON_PERAL = "+34900000103"
TABERNA_RUANO = "+34900000104"


# ══ W1 · absent is a real state ══════════════════════════════════════════════════════════════════
b = win.blank()
ck("W1 the absent window has no times, no words and no source",
   b["from"] is None and b["to"] is None and b["said"] == "" and b["source"] == "" and not b["set"])
ck("W1 …and it labels as EMPTY, which is what makes the surface say «sin franja»",
   win.label(b) == "" and win.NO_WINDOW == "sin franja")
ck("W1 …and it claims nobody promised anything", win.source_label(b) == "")
ck("W1 a stored PROVENANCE with no times is not a window (a source alone promises nothing)",
   win.make(None, None, said="", source=win.SAID) == b)
ck("W1 the wire carries the absence as empty strings, never as an invented time",
   win.wire(b) == {"window_from": "", "window_to": "", "window_text": "",
                   "window_source": "", "window_scope": ""})
ck("W1 nothing timelike in a normal sentence becomes a window",
   all(not win.read_spoken(s)["set"] for s in
       ("ponme 20 kilos de patata", "hola qué tal", "mándame lo de siempre", "", "gracias")))
ck("W1 resolve with neither side set stays absent", win.resolve(b, b) == b)

# ══ W2 · a stated window is captured, with its provenance ════════════════════════════════════════
w = win.read_spoken("repárteme antes de las once")
ck("W2 «antes de las once» → a real upper bound",
   w["set"] and w["to"] == "11:00" and w["from"] is None, win.label(w))
ck("W2 …carrying the CUSTOMER as its source", w["source"] == win.SAID)
ck("W2 …and the provenance reads as who promised it, in es-ES",
   win.source_label(w) == "lo dijo el cliente")
ck("W2 the source set is CLOSED at three (said · set · habit)",
   win.SOURCES == ("said", "set", "habit"))
ck("W2 `habit` is DECLARED and UNWRITTEN — no code path produces it (the additive seam, like "
   "range_kind='zones')",
   all(win.read_spoken(s)["source"] != win.HABIT for s in
       ("antes de las 11", "de 8 a 11", "por la mañana", "siempre a la misma hora")))
for phrase, want in (("de 8 a 11", "08:00–11:00"),
                     ("que sea de 8:00 a 11:30", "08:00–11:30"),
                     ("entre las 9 y las 12", "09:00–12:00"),
                     ("hasta las 10 y media", "10:30"),
                     ("antes de las nueve y cuarto", "09:15"),
                     ("no más tarde de las 13:00", "13:00"),
                     ("de 8 y media a 11", "08:30–11:00"),
                     ("de 8 a 2 de la tarde", "08:00–14:00"),
                     ("de 1 a 3 de la tarde", "13:00–15:00")):
    got = win.read_spoken(phrase)
    ck(f"W2 «{phrase}» → {want}", got["set"] and win.label(got) == want, win.label(got))
ck("W2 a daypart binds to the hour it FOLLOWS, never to the whole sentence "
   "(«antes de las 11, y por la tarde te llamo» is still eleven in the morning)",
   win.label(win.read_spoken("antes de las 11, y por la tarde te llamo")) == "11:00")

# ══ W3 · today beats always ══════════════════════════════════════════════════════════════════════
default = win.make("08:00", "11:00", source=win.SET, scope=win.CUSTOMER)
today = win.make(None, "09:00", source=win.SAID, scope=win.ORDER)
r = win.resolve(default, today)
ck("W3 the ORDER's override beats the customer's standing hours",
   win.label(r) == "09:00" and r["scope"] == "order" and r["source"] == win.SAID)
ck("W3 …and it says so, so a driver knows it is only today",
   win.source_label(r) == "lo dijo el cliente")
ck("W3 with no override, their standing hours apply",
   win.resolve(default, win.blank())["scope"] == "customer"
   and win.label(win.resolve(default, win.blank())) == "08:00–11:00")
ck("W3 an override on a customer with NO default still applies",
   win.label(win.resolve(win.blank(), today)) == "09:00")
ck("W3 clearing the override falls back to the default — it is never frozen into a copy",
   win.resolve(default, win.blank()) == {**default, "scope": "customer"})

# ══ W4 · nothing computes an arrival ═════════════════════════════════════════════════════════════
# The words that would mean this had become route optimisation. The scan is over CODE, not prose:
# the docstrings SAY «no ETA, no arrival, route optimisation is out of scope», and they must stay
# free to say it — what must never appear is an executable line that computes one. So docstrings and
# comments are stripped and everything else (identifiers, wire keys, string literals used as data)
# is scanned. A leak here is the failure that matters most on this surface.
FORBIDDEN = ("eta", "arrival", "arrive", "llegada", "travel_time", "traveltime", "duration_s",
             "leg_", "polyline", "sequence_no", "stop_number", "optimi")


def _symbols(src: str) -> str:
    """Every NAME the source uses, plus every SHORT string literal (a wire key, a column, a status).
    Comments, docstrings and long prose strings are excluded on purpose: what a module SAYS about
    arrivals is documentation — often the very warning that they are forbidden — while what it NAMES
    is what it does. A `"eta"` key or an `arrival_at` variable is caught; the es-ES sentence in the
    mind's tool description, which tells the model NOT to promise an arrival, is not."""
    import io
    import tokenize
    out = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.NAME or tok.type == tokenize.STRING and len(tok.string) <= 42:
                out.append(tok.string)
    except (tokenize.TokenError, IndentationError):
        return src
    return " ".join(out).lower()


def _leaks(src: str) -> list:
    low = _symbols(src)
    return [wd for wd in FORBIDDEN if wd in low]


src_mod = open(os.path.join(HERE, "brain", "window.py"), encoding="utf-8").read()
ck("W4 the window module NAMES no arrival, no travel time and no sequence",
   not _leaks(src_mod), ", ".join(_leaks(src_mod)))
ck("W4 …and the check itself works — a planted `arrival_at` would be caught",
   _leaks("def f():\n    arrival_at = 1\n") == ["arrival"])
ck("W4 …while its prose is still free to say ROUTE OPTIMISATION IS OUT OF SCOPE",
   "OUT OF SCOPE" in src_mod and "arrival" in src_mod.lower())

app_src = open(os.path.join(HERE, "app.py"), encoding="utf-8").read()
_start = app_src.find("async def api_reparto")
_end = app_src.find("\n@app.", _start)
route_src = app_src[_start:_end if _end > 0 else _start + 6000]
ck("W4 /api/reparto was found and still exists", bool(route_src.strip()))
ck("W4 …and it names no arrival either", not _leaks(route_src), ", ".join(_leaks(route_src)))
ck("W4 …and it no longer ships the window blank (the shipped-with-no-data bug)",
   'brain_window.wire(' in route_src and '"window_from": ""' not in route_src)
ck("W4 …and it carries the PROVENANCE, not just the times",
   "window_source" in win.wire(win.blank()))
ck("W4 the wire shape has exactly the five window keys and no sixth",
   set(win.wire(default)) == {"window_from", "window_to", "window_text", "window_source",
                              "window_scope"})

# ══ W5 · open-ended is a real window ═════════════════════════════════════════════════════════════
lo = win.read_spoken("a partir de las 8")
hi = win.read_spoken("antes de las 11")
ck("W5 «a partir de las 8» is a window with one bound, not a broken row",
   lo["set"] and lo["from"] == "08:00" and lo["to"] is None and win.label(lo) == "08:00")
ck("W5 «antes de las 11» is a window with one bound",
   hi["set"] and hi["to"] == "11:00" and hi["from"] is None and win.label(hi) == "11:00")
ck("W5 …and both survive the wire without gaining a bound they never had",
   win.wire(lo)["window_to"] == "" and win.wire(hi)["window_from"] == "")
ck("W5 «desde las 7» and «después de las 16:00» are the same shape",
   win.label(win.read_spoken("desde las 7")) == "07:00"
   and win.label(win.read_spoken("después de las 16:00")) == "16:00")

# ══ W6 · words stay words ════════════════════════════════════════════════════════════════════════
v = win.read_spoken("mejor por la mañana")
ck("W6 «por la mañana» is a REAL window and is kept",
   v["set"] and v["said"] == "por la mañana" and v["source"] == win.SAID)
ck("W6 …and it is NOT turned into 08:00 (that would be a promise nobody made)",
   v["from"] is None and v["to"] is None)
ck("W6 …and it shows as their own words", win.label(v) == "por la mañana"
   and win.wire(v)["window_text"] == "por la mañana")
ck("W6 «a primera hora» too", win.label(win.read_spoken("a primera hora")) == "a primera hora")
amb = win.read_spoken("de 8 a 2")
ck("W6 a range nobody disambiguated keeps THEIR WORDS and no digits "
   "(«de 8 a 2» — which 2? we do not pick)",
   amb["set"] and amb["from"] is None and amb["to"] is None and "8" in amb["said"], win.label(amb))

# ══ W7 · a window that isn't one raises ══════════════════════════════════════════════════════════
_refusals = []
for bad_from, bad_to, why in (("25:00", "", "an hour that does not exist"),
                              ("", "8:75", "a minute that does not exist"),
                              ("mañana", "", "a word where an hour goes"),
                              ("13:00", "09:00", "a window that ends before it starts"),
                              ("11:00", "11:00", "a window with no width")):
    try:
        win.validate(bad_from, bad_to)
        ok, msg = False, "(accepted!)"
    except ValueError as e:
        ok, msg = True, str(e)
        _refusals.append(msg)
    ck(f"W7 REFUSED: {why}", ok, msg[:70])
ck("W7 every refusal is written in es-ES FOR THE BOSS — he is the one who sees it",
   len(_refusals) == 5 and all(any(t in m for t in ("hora", "franja", "Escríbela", "Revisa"))
                               for m in _refusals),
   " | ".join(_refusals)[:120])
ck("W7 CLEARING is legal and is how a window is removed (all empty → absent, no error)",
   win.validate("", "", "") == win.blank())
ck("W7 a lone bound is accepted — open-ended is not an error",
   win.validate("08:00", "")["from"] == "08:00" and win.validate("", "11:00")["to"] == "11:00")
ck("W7 the READ path never raises on garbage in the store (fail-soft, never a broken list)",
   win.make("nonsense", "also nonsense") == win.blank()
   and win.make("13:00", "09:00", said="lo que sea")["from"] is None)
ck("W7 an unknown source is not shown as an attribution we cannot vouch for",
   win.make("08:00", None, source="rumour")["source"] == win.SET)

# ══ W8 · the sort is a sort ══════════════════════════════════════════════════════════════════════
ck("W8 an earlier window sorts before a later one",
   win.sort_key(win.make("08:00", "11:00")) < win.sort_key(win.make("10:00", "12:00")))
ck("W8 an un-timed stop sorts LAST, and is never dropped from the day",
   win.sort_key(win.blank()) > win.sort_key(win.make("23:30", None)))
ck("W8 a words-only window sorts after every timed one but before the un-timed",
   win.sort_key(win.make("23:30", None))
   < win.sort_key(win.read_spoken("por la mañana"))
   < win.sort_key(win.blank()))
ck("W8 an upper-bound-only window sorts on the bound it has",
   win.sort_key(win.make(None, "09:00")) == 9 * 60)
ck("W8 the key is minutes-of-a-local-clock and nothing else — no distance, no duration",
   win.sort_key(win.make("07:30", "09:00")) == 7 * 60 + 30)


# ══ W9 · the round-trip + the shaped Reparto list (needs a clone) ════════════════════════════════
async def _db_checks(dsn):
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_reparto against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")
        phones = [BAR_LUMBRE, CAFE_SOTILLO, MESON_PERAL, TABERNA_RUANO]
        oids = [f"vitalrep-{i}" for i in range(1, 5)]
        try:
            await con.execute("delete from orders where id = any($1::text[])", oids)
            await con.execute("delete from customer_profiles where tenant_id=$1", TENANT)
            for phone, disp in zip(phones, ("Bar Lumbre", "Café Sotillo", "Mesón Peral",
                                            "Taberna Ruano")):
                await con.execute(
                    "insert into customer_profiles (phone_number, tenant_id, display_name, address) "
                    "values ($1,$2,$3,'') on conflict (tenant_id, phone_number) do update set "
                    "tenant_id=excluded.tenant_id, display_name=excluded.display_name, "
                    "delivery_window_from=null, delivery_window_to=null, "
                    "delivery_window_source=null, delivery_window_said=null",
                    phone, TENANT, disp)
            for oid, phone in zip(oids, phones):
                await con.execute(
                    "insert into orders (id, phone_number, customer_name, status, delivery_date) "
                    "values ($1,$2,'','approved','2026-07-30') on conflict (id) do update set "
                    "phone_number=excluded.phone_number, status='approved', "
                    "delivery_date=excluded.delivery_date, window_from=null, window_to=null, "
                    "window_source=null, window_said=null", oid, phone)

            # W1/db — a customer nobody ever asked
            ck("W1/db a customer nobody asked has NO window and reads «sin franja»",
               win.label(await win.get_customer(con, TENANT, MESON_PERAL)) == "")

            # W2/db — the mind's capture path, end to end
            got = await win.capture_said(con, TENANT, BAR_LUMBRE, "repárteme antes de las once")
            back = await win.get_customer(con, TENANT, BAR_LUMBRE)
            ck("W2/db the customer's own sentence round-trips as a window with source `said`",
               got["set"] and back["to"] == "11:00" and back["source"] == win.SAID
               and win.label(back) == "11:00", str(back))
            ck("W2/db …and the provenance survives the store, not just the parse",
               win.source_label(back) == "lo dijo el cliente")

            # the comercial's door — a DIFFERENT provenance for a different promise
            await win.set_customer(con, TENANT, CAFE_SOTILLO, window_from="08:00",
                                   window_to="10:00", source=win.SET)
            c2 = await win.get_customer(con, TENANT, CAFE_SOTILLO)
            ck("W2/db the comercial's window is stored as `set`, never as the customer's word",
               c2["source"] == win.SET and win.source_label(c2) == "lo pusiste tú")

            # W6/db — words survive the store as words
            await win.capture_said(con, TENANT, TABERNA_RUANO, "mejor por la mañana")
            c4 = await win.get_customer(con, TENANT, TABERNA_RUANO)
            ck("W6/db «por la mañana» is stored verbatim and gained no digits",
               c4["said"] == "por la mañana" and c4["from"] is None and c4["to"] is None)

            # W3/db — the override
            await win.set_order(con, oids[0], window_to="09:00", source=win.SET)
            cw = await win.customers_for(con, TENANT, phones)
            ow = await win.orders_for(con, oids)
            r0 = win.resolve(cw.get(BAR_LUMBRE), ow.get(oids[0]))
            ck("W3/db the order override beats the customer default on a real row",
               win.label(r0) == "09:00" and r0["scope"] == "order", str(r0))
            await win.set_order(con, oids[0], window_from="", window_to="")
            ow = await win.orders_for(con, oids)
            r0b = win.resolve(cw.get(BAR_LUMBRE), ow.get(oids[0]))
            ck("W3/db clearing the override restores their standing hours (never a frozen copy)",
               win.label(r0b) == "11:00" and r0b["scope"] == "customer")

            # W7/db — the write refuses, and a wrong-tenant phone 404s honestly
            try:
                await win.set_customer(con, TENANT, CAFE_SOTILLO, window_from="13:00",
                                       window_to="09:00")
                ck("W7/db a backwards window is REFUSED at the write", False, "(accepted!)")
            except ValueError as e:
                ck("W7/db a backwards window is REFUSED at the write", True, str(e)[:60])
            try:
                await win.set_customer(con, "someoneelse", CAFE_SOTILLO, window_from="08:00")
                ck("W7/db another tenant cannot set this customer's window", False, "(accepted!)")
            except LookupError:
                ck("W7/db another tenant cannot set this customer's window", True)

            # W8/db + W4/db — the SHAPED list, exactly as /api/reparto builds it
            rows = await con.fetch(
                "select id, phone_number, customer_name, window_from, window_to, window_source, "
                "window_said from orders where id = any($1::text[])", oids)
            profs = {r["phone_number"]: dict(r) for r in await con.fetch(
                "select phone_number, display_name, delivery_window_from, delivery_window_to, "
                "delivery_window_source, delivery_window_said from customer_profiles "
                "where tenant_id=$1 and phone_number = any($2::text[])", TENANT, phones)}
            stops = []
            for o in rows:
                prof = profs.get(o["phone_number"]) or {}
                wv = win.resolve(win._cust(prof), win._order(o))
                stops.append({"name": prof.get("display_name") or "", **win.wire(wv),
                              "_k": (win.sort_key(wv), (prof.get("display_name") or "").lower())})
            stops.sort(key=lambda s: s.pop("_k"))
            order_names = [s["name"] for s in stops]
            ck("W8/db the day is ordered by the hours the CUSTOMERS named, un-timed last",
               order_names == ["Café Sotillo", "Bar Lumbre", "Taberna Ruano", "Mesón Peral"],
               " → ".join(order_names))
            ck("W1/db the un-timed stop is KEPT in the day, reading «sin franja»",
               stops[-1]["name"] == "Mesón Peral" and stops[-1]["window_from"] == ""
               and stops[-1]["window_to"] == "" and stops[-1]["window_text"] == ""
               and stops[-1]["window_source"] == "")
            ck("W4/db every stop carries a provenance or an honest blank — never an unattributed time",
               all((s["window_source"] in win.SOURCES) == bool(
                   s["window_from"] or s["window_to"] or s["window_text"]) for s in stops))
            ck("W4/db no stop carries anything an arrival could be read out of",
               all(not any(k.startswith(("eta", "arriv", "llegada", "leg", "duration"))
                           for k in s) for s in stops))
        finally:
            await con.execute("delete from orders where id = any($1::text[])", oids)
            await con.execute("delete from customer_profiles where tenant_id=$1", TENANT)


_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)
    asyncio.run(_db_checks(_dsn))
else:
    skip("W9 the round-trip + the shaped Reparto list", "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_reparto: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — THE WINDOW IS WHAT THE CUSTOMER TOLD US" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
