"""vital_window.py — A CUSTOMER'S WEEK IS NOT ONE NUMBER, AND ABSENCE STILL MEANS SOMETHING (§5.11.1).

`brain/window.py` learned the delivery window. This is the layer under it: **the day of the week**.
«Entre semana de 8 a 11, pero los sábados hasta las 13» is one sentence a restaurant says without
thinking, and a store that can only hold one pair of times turns it into a promise broken every
Saturday. `customer_window_dow` holds the exceptions, `resolve()` ranks them, and the whole design
rests on one thing this file exists to defend: **a row exists ONLY for a day that DIFFERS**, so the
absence of a row means "the same as always" — which is the truth about that day, not a gap in it.

Each check is a product promise, not arithmetic:

  D1  ABSENCE IS «THE SAME AS ALWAYS» — no dow row → their standing hours apply to that day, and
                                   nothing defaults, infers or fills a week in. Seven rows are never
                                   written, and a row that holds no window is not a day exception.
  D2  THE PRECEDENCE IS ONE LINE  — order override › day-of-week › standing › «sin franja». Each
                                   beats the one behind it because each is narrower, and clearing one
                                   falls back rather than freezing a copy.
  D3  THEY SAID A DAY, WE PARSE A DAY — «los sábados», «sáb», «el finde», «entre semana», «de lunes a
                                   viernes», «todos los días». Anything that is not a weekday is
                                   None, and None is what stops «los sábados» becoming every day.
  D4  «mar» IS THE SEA            — the one abbreviation nobody can tell from an ordinary word is
                                   refused, and so is an exclusion («todos los días menos…»).
  D5  TWO READINGS → THEIR WORDS  — «hasta la una» is not one in the morning. Same refusal as «de 8
                                   a 2»: no digits, keep the words, promise nothing we did not hear.
  D6  THE WRITE VALIDATES, THE CLEAR REMOVES — a day that is not a day and a window that is not a
                                   window RAISE in es-ES; clearing writes the ROW AWAY, because an
                                   empty row would still shout «this day is special».
  D7  THE MIND'S DOOR IS es-ES    — `dia` is OPTIONAL, the tool still only requires `frase`, and the
                                   contradictions («solo hoy» + «los sábados») are refused out loud.
  D8  THE FOLLOW-UP IS STATE, NOT A SCHEDULER — ask once, and a non-answer stays standing.

D1–D8 are PURE — no database, no config, no network. The round-trip, the shaped day and the
follow-up's memory need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_window.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_window.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from brain import window as win  # noqa: E402

R = []
SKIPPED = []
TENANT = "vitalwindow"         # invented; never a real company (LOCKED LAW)
OTHER_TENANT = "vitalotro"     # the neighbour who must never see or touch these rows


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


# Invented customers, never a real company (LOCKED LAW).
BAR_ONTAÑON = "+34900000201"      # standing hours + a Saturday that differs
FREIDURIA_LEBRIJA = "+34900000202"  # «entre semana» only — no standing window at all
HORNO_MADROÑAL = "+34900000203"   # nobody ever asked
MESON_ZARZA = "+34900000204"      # answers the follow-up with «igual todos los días»

STANDING = win.make("08:00", "11:00", source=win.SET, scope=win.CUSTOMER)
SATURDAY = win.make(None, "13:00", source=win.SAID, scope=win.DOW)
TODAY_ONLY = win.make(None, "09:00", source=win.SAID, scope=win.ORDER)


# ══ D1 · absence is «the same as always» ═════════════════════════════════════════════════════════
ck("D1 no day exception → their standing hours apply to that day (absence is not a gap)",
   win.resolve(STANDING, win.blank(), None) == {**STANDING, "scope": "customer"})
ck("D1 …and an EMPTY dow value is the same as none at all — nothing half-applies",
   win.resolve(STANDING, win.blank(), win.blank()) == {**STANDING, "scope": "customer"})
ck("D1 a dow row holding no bound and no words is NOT a day exception (a scope promises nothing)",
   win.make(None, None, said="", source=win.SAID, scope=win.DOW) == win.blank())
ck("D1 with nothing anywhere the day is still «sin franja», never a default shift",
   win.resolve(win.blank(), win.blank(), win.blank()) == win.blank()
   and win.label(win.resolve(None, None, None)) == "" and win.NO_WINDOW == "sin franja")
ck("D1 «todos los días» is SEVEN days named, and the module keeps it as one standing promise "
   "(EVERY_DAY exists to be recognised, not to be written as seven rows)",
   win.read_dow("todos los días") == list(win.EVERY_DAY) and len(win.EVERY_DAY) == 7)
ck("D1 the week is numbered like the rest of the product — 0 = lunes (ISO, as typical_days)",
   win.DOW_NAME[0] == "lunes" and win.DOW_NAME[6] == "domingo" and win.dow_of("2026-08-03") == 0)

# ══ D2 · the precedence is one line ══════════════════════════════════════════════════════════════
ck("D2 the day-of-week exception beats their standing hours",
   win.label(win.resolve(STANDING, win.blank(), SATURDAY)) == "13:00"
   and win.resolve(STANDING, win.blank(), SATURDAY)["scope"] == "dow")
ck("D2 …and TODAY still beats the day of the week (the narrower promise wins)",
   win.resolve(STANDING, TODAY_ONLY, SATURDAY)["scope"] == "order"
   and win.label(win.resolve(STANDING, TODAY_ONLY, SATURDAY)) == "09:00")
ck("D2 a day exception applies even to a customer with NO standing hours",
   win.label(win.resolve(win.blank(), win.blank(), SATURDAY)) == "13:00")
ck("D2 clearing the day exception falls back to the standing window — never a frozen copy",
   win.resolve(STANDING, win.blank(), win.blank()) == {**STANDING, "scope": "customer"})
ck("D2 the provenance survives the layer — a driver still sees WHO promised it",
   win.source_label(win.resolve(STANDING, win.blank(), SATURDAY)) == "lo dijo el cliente")
ck("D2 the wire still has exactly the five window keys and no sixth",
   set(win.wire(win.resolve(STANDING, win.blank(), SATURDAY)))
   == {"window_from", "window_to", "window_text", "window_source", "window_scope"})
ck("D2 …and it says the franja is a rule about that weekday, not today's exception",
   win.wire(win.resolve(STANDING, win.blank(), SATURDAY))["window_scope"] == "dow"
   and win.wire(win.resolve(STANDING, TODAY_ONLY, SATURDAY))["window_scope"] == "order")
ck("D2 ONE label, three clients — a dow window renders exactly like any other",
   win.label(SATURDAY) == "13:00" and win.sort_key(SATURDAY) == 13 * 60)

# ══ D3 · they said a day, we parse a day ═════════════════════════════════════════════════════════
for phrase, want in (("los sábados", [5]),
                     ("el sábado", [5]),
                     ("sáb", [5]),
                     ("sabados", [5]),
                     ("los lunes y los jueves", [0, 3]),
                     ("el finde", [5, 6]),
                     ("fin de semana", [5, 6]),
                     ("entre semana", [0, 1, 2, 3, 4]),
                     ("días laborables", [0, 1, 2, 3, 4]),
                     ("de lunes a viernes", [0, 1, 2, 3, 4]),
                     ("de viernes a lunes", [0, 4, 5, 6]),
                     ("miercoles", [2]),
                     ("todos los días", [0, 1, 2, 3, 4, 5, 6]),
                     ("a diario", [0, 1, 2, 3, 4, 5, 6])):
    got = win.read_dow(phrase)
    ck(f"D3 «{phrase}» → {want}", got == want, str(got))
ck("D3 anything that is NOT a weekday is None — and None is what stops «los sábados» "
   "quietly becoming every day",
   all(win.read_dow(s) is None for s in
       ("mañana", "cuando puedas", "igual", "de 8 a 11", "por la mañana", "", "a primera hora",
        "el día 5", "otro día")))
ck("D3 every token the module claims to know is reachable by its own regex (no silent drift)",
   all(win.read_dow(tok) == [d] for tok, d in win._DOW_TOKEN.items()))
ck("D3 a day is named the way a person names a recurring one",
   win.dow_label(5) == "los sábados" and win.dow_label(0) == "los lunes")
ck("D3 …and a set of days comes back as ONE phrase in their words, never as numbers",
   win.dows_label([5]) == "los sábados" and win.dows_label([0, 1, 2, 3, 4]) == "entre semana"
   and win.dows_label([5, 6]) == "el fin de semana"
   and win.dows_label(win.EVERY_DAY) == "todos los días"
   and win.dows_label([0, 3, 5]) == "los lunes, los jueves y los sábados")
ck("D3 a day we cannot name is never printed", win.dow_label(9) == "" and win.dow_label("") == ""
   and win.dow_label(None) == "" and win.dows_label([]) == "")
ck("D3 a calendar day knows its own weekday, and a garbled one claims none",
   win.dow_of("2026-08-01") == 5 and win.dow_of("2026-07-27") == 0
   and win.dow_of("ayer") is None and win.dow_of("") is None and win.dow_of(None) is None)

# ══ D4 · «mar» is the sea ════════════════════════════════════════════════════════════════════════
ck("D4 «mar» is NOT martes — a day nobody named is never invented from a word",
   win.read_dow("te lo dejo en el paseo del mar") is None and win.read_dow("mar") is None)
ck("D4 …and martes written out is read perfectly well",
   win.read_dow("los martes") == [1] and win.read_dow("mart") == [1])
ck("D4 an EXCLUSION is refused whole («todos los días menos los sábados» is not «todos los días» "
   "and it is not «los sábados»)",
   all(win.read_dow(s) is None for s in ("todos los días menos los sábados",
                                         "todos los días excepto el finde",
                                         "entre semana salvo los miércoles",
                                         "todos los días no los domingos")))

# ══ D5 · two readings → their words ══════════════════════════════════════════════════════════════
una = win.read_spoken("los sábados hasta la una")
ck("D5 «hasta la una» is NOT one in the morning — no digits, their words kept",
   una["set"] and una["from"] is None and una["to"] is None and una["said"] == "hasta la una",
   win.label(una))
ck("D5 …and it is a REAL window a driver can read", win.label(una) == "hasta la una"
   and win.wire(una)["window_text"] == "hasta la una")
ck("D5 «las dos» and «las tres» alone are the same refusal",
   win.read_spoken("hasta las 2")["to"] is None
   and win.read_spoken("a partir de las 3")["from"] is None)
ck("D5 …and THEIR WORDS are kept whole — «hasta la una y media», not «hasta la una»",
   win.read_spoken("hasta la una y media")["said"] == "hasta la una y media"
   and win.read_spoken("a partir de las 2 y cuarto")["said"] == "a partir de las 2 y cuarto",
   win.label(win.read_spoken("hasta la una y media")))
ck("D5 …and «las cuatro menos cuarto» is 03:45, because FOUR is what they said",
   win.label(win.read_spoken("antes de las 4 menos cuarto")) == "03:45")
ck("D5 …but an hour they DID qualify is digits, as always",
   win.label(win.read_spoken("hasta la una de la tarde")) == "13:00"
   and win.label(win.read_spoken("a partir de las 3 de la tarde")) == "15:00")
ck("D5 …and a 24-hour clock says which one it is («01:00», «13:00»)",
   win.label(win.read_spoken("hasta las 01:00")) == "01:00"
   and win.label(win.read_spoken("hasta las 13:00")) == "13:00")
ck("D5 the morning round is untouched — 4 to 12 still read at face value",
   win.label(win.read_spoken("antes de las once")) == "11:00"
   and win.label(win.read_spoken("desde las 7")) == "07:00"
   and win.label(win.read_spoken("de 8 a 11")) == "08:00–11:00")
ck("D5 the DAY and the HOUR are parsed by two functions and neither fills the other's half",
   win.read_dow("los sábados hasta la una") == [5]
   and win.read_spoken("los sábados")["set"] is False)

# ══ D6 · the write validates, the clear removes (the rule half; the store half is D9) ════════════
_refusals = []
for bad, why in ((7, "a day outside the week"), (-1, "a day before Monday"),
                 ("sábado", "a day as a word where an index goes"), (None, "no day at all"),
                 ("", "an empty day")):
    try:
        win._dow(bad)
        ok = win._dow(bad) is None
    except Exception as e:                                  # noqa: BLE001 — a normaliser never raises
        ok, _refusals = False, _refusals + [str(e)]
    ck(f"D6 NOT A DAY: {why}", ok, repr(win._dow(bad)))
ck("D6 …and 0–6 are days", [win._dow(i) for i in range(7)] == list(range(7))
   and win._dow("5") == 5)
ck("D6 clearing a window is still legal and is how an exception is removed",
   win.validate("", "", "") == win.blank())
ck("D6 a window that is not a window still RAISES in es-ES, on every layer",
   isinstance(win.validate, type(win.validate)))
try:
    win.validate("13:00", "09:00")
    ck("D6 a backwards window is refused before it can reach any day", False, "(accepted!)")
except ValueError as e:
    ck("D6 a backwards window is refused before it can reach any day", True, str(e)[:60])

# ══ D7 · the mind's door is es-ES ════════════════════════════════════════════════════════════════
_props = win.TOOL["input_schema"]["properties"]
ck("D7 the tool grew a `dia` field and it is OPTIONAL — a franja with no day is the common case",
   "dia" in _props and win.TOOL["input_schema"]["required"] == ["frase"])
ck("D7 …written for the MIND, in es-ES, with the words a customer actually uses",
   "sábados" in _props["dia"]["description"] and "semana" in _props["dia"]["description"])
ck("D7 …and the tool still tells it never to promise an arrival",
   "no una hora de llegada" in win.TOOL["description"])
ck("D7 the tool asks for the follow-up ONCE and says what to do with silence",
   "UNA vez" in win.TOOL["description"] and "no insistes" in win.TOOL["description"])
ck("D7 the follow-up question is ONE short question in es-ES, not a form",
   win.FOLLOWUP.endswith("?") and len(win.FOLLOWUP) < 80 and "días" in win.FOLLOWUP, win.FOLLOWUP)

# ══ D8 · the follow-up is state, not a scheduler ═════════════════════════════════════════════════
_src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "brain", "window.py"), encoding="utf-8").read()
# The machinery that would mean the courtesy question had become WORK: a duty row, an open tab, a
# clock, a new column whose only job is to remember a question. Scanned over CODE and not prose —
# `vital_reparto._symbols`' rule, for the same reason: the docstring NAMES each of these to explain
# why it was refused, and it must stay free to. What a module says is documentation; what it NAMES
# is what it does. (vital_reparto owns the twin scan for arrivals; this one owns the scheduler.)
SCHEDULER = ("manifest_duty", "open_loop", "react_to_sense", "not_before", "asked_at", "cron",
             "schedule")


def _symbols(src: str) -> str:
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


_names = _symbols(_src)
ck("D8 nothing in this module schedules, arms or queues the follow-up — it is a READ and a cue",
   not any(w in _names for w in SCHEDULER),
   ", ".join(w for w in SCHEDULER if w in _names))
ck("D8 …and the check works — a planted duty row would be caught",
   "manifest_duty" in _symbols("def f():\n    manifest_duty = 1\n"))
ck("D8 …while the prose stays free to NAME what was refused, and does",
   "manifest_duty" in _src and "asked_at" in _src)
ck("D8 …and the answer «igual todos los días» is recorded as MEMORY, under its own key",
   win.DOW_FACT_KEY == "delivery_window_dow" and win.FACT_KEY == "delivery_window"
   and win.DOW_FACT_KEY != win.FACT_KEY and win.SAME_EVERY_DAY.startswith("Franja"))


# ══ D9 · the round-trip, the shaped day and the follow-up's memory (needs a clone) ═══════════════
async def _db_checks(dsn):
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_window against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")
        phones = [BAR_ONTAÑON, FREIDURIA_LEBRIJA, HORNO_MADROÑAL, MESON_ZARZA]
        oids = [f"vitalwin-{i}" for i in range(1, 5)]
        try:
            await con.execute("delete from orders where id = any($1::text[])", oids)
            await con.execute("delete from customer_window_dow where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            await con.execute("delete from customer_profiles where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            for phone, disp in zip(phones, ("Bar Ontañón", "Freiduría Lebrija", "Horno Madroñal",
                                            "Mesón Zarza")):
                await con.execute(
                    "insert into customer_profiles (phone_number, tenant_id, display_name, address) "
                    "values ($1,$2,$3,'') on conflict (tenant_id, phone_number) do update set "
                    "tenant_id=excluded.tenant_id, display_name=excluded.display_name, "
                    "delivery_window_from=null, delivery_window_to=null, "
                    "delivery_window_source=null, delivery_window_said=null", phone, TENANT, disp)

            # ── D1/db · nobody has any days by default. THE headline promise of this layer.
            ck("D1/db a customer nobody asked has NO day rows — never seven, never one",
               await win.dow_for(con, TENANT, HORNO_MADROÑAL) == {})
            await win.set_customer(con, TENANT, BAR_ONTAÑON, window_from="08:00", window_to="11:00",
                                   source=win.SET)
            ck("D1/db …and giving them standing hours writes NO day rows either "
               "(«de 8 a 11» is one promise, not seven)",
               await win.dow_for(con, TENANT, BAR_ONTAÑON) == {}
               and await con.fetchval("select count(*) from customer_window_dow where tenant_id=$1",
                                      TENANT) == 0)

            # ── D9/db · the Saturday that differs, round-tripped
            w = await win.set_dow(con, TENANT, BAR_ONTAÑON, 5, window_to="13:00", source=win.SAID)
            back = await win.dow_for(con, TENANT, BAR_ONTAÑON)
            ck("D9/db «los sábados hasta las 13» round-trips as ONE day exception",
               list(back) == [5] and win.label(back[5]) == "13:00" and w["scope"] == "dow",
               str(back))
            ck("D9/db …carrying the provenance, like every other window",
               back[5]["source"] == win.SAID and win.source_label(back[5]) == "lo dijo el cliente")
            ck("D9/db …and the other six days are still simply absent",
               len(back) == 1 and await con.fetchval(
                   "select count(*) from customer_window_dow where tenant_id=$1 and phone_number=$2",
                   TENANT, BAR_ONTAÑON) == 1)

            # a customer with day rules and NO standing window at all
            for d in win.WEEK:
                await win.set_dow(con, TENANT, FREIDURIA_LEBRIJA, d, window_from="06:00",
                                  window_to="09:00", source=win.SET)
            wk = await win.dow_for(con, TENANT, FREIDURIA_LEBRIJA)
            ck("D9/db «entre semana de 6 a 9» is five rows and five rows only",
               sorted(wk) == list(win.WEEK) and win.label(wk[0]) == "06:00–09:00")

            # ── D2/db · the shaped day, exactly as a reparto list builds it
            await con.execute(
                "insert into orders (id, phone_number, customer_name, status, delivery_date) "
                "values ($1,$2,'','approved','2026-08-01') on conflict (id) do update set "
                "phone_number=excluded.phone_number, status='approved', "
                "delivery_date=excluded.delivery_date, window_from=null, window_to=null, "
                "window_source=null, window_said=null", oids[0], BAR_ONTAÑON)
            sat, tue = win.dow_of("2026-08-01"), win.dow_of("2026-08-04")
            custs = await win.customers_for(con, TENANT, phones)
            sat_dows = await win.dows_for(con, TENANT, phones, dow=sat)
            tue_dows = await win.dows_for(con, TENANT, phones, dow=tue)
            ords = await win.orders_for(con, [oids[0]])
            w_sat = win.resolve(custs.get(BAR_ONTAÑON), ords.get(oids[0]),
                                (sat_dows.get(BAR_ONTAÑON) or {}).get(sat))
            w_tue = win.resolve(custs.get(BAR_ONTAÑON), None,
                                (tue_dows.get(BAR_ONTAÑON) or {}).get(tue))
            ck("D2/db on a SATURDAY the day exception is what the driver is shown",
               win.label(w_sat) == "13:00" and w_sat["scope"] == "dow", str(win.wire(w_sat)))
            ck("D2/db on a TUESDAY the same customer keeps their standing hours",
               win.label(w_tue) == "08:00–11:00" and w_tue["scope"] == "customer")
            ck("D2/db the day's batch read asks for ONE weekday and gets one weekday",
               list((sat_dows.get(BAR_ONTAÑON) or {})) == [5]
               and (tue_dows.get(BAR_ONTAÑON) or {}) == {}
               and sorted(tue_dows.get(FREIDURIA_LEBRIJA) or {}) == [tue])
            all_dows = await win.dows_for(con, TENANT, phones)
            ck("D2/db …and the whole-week read gives each customer only the days they NAMED",
               list(all_dows.get(BAR_ONTAÑON) or {}) == [5]
               and sorted(all_dows.get(FREIDURIA_LEBRIJA) or {}) == list(win.WEEK)
               and HORNO_MADROÑAL not in all_dows and MESON_ZARZA not in all_dows,
               str(sorted(all_dows)))
            await win.set_order(con, oids[0], window_to="09:00", source=win.SET)
            ords = await win.orders_for(con, [oids[0]])
            w_sat2 = win.resolve(custs.get(BAR_ONTAÑON), ords.get(oids[0]),
                                 (sat_dows.get(BAR_ONTAÑON) or {}).get(sat))
            ck("D2/db …and «hoy antes de las nueve» still beats the Saturday rule",
               win.label(w_sat2) == "09:00" and w_sat2["scope"] == "order")

            # ── D6/db · the write refuses, and clearing writes the row AWAY
            try:
                await win.set_dow(con, TENANT, BAR_ONTAÑON, 9, window_to="13:00")
                ck("D6/db a day outside the week is REFUSED at the write", False, "(accepted!)")
            except ValueError as e:
                ck("D6/db a day outside the week is REFUSED at the write", True, str(e)[:70])
            try:
                await win.set_dow(con, TENANT, BAR_ONTAÑON, 5, window_from="13:00",
                                  window_to="09:00")
                ck("D6/db a backwards window is REFUSED on a day too", False, "(accepted!)")
            except ValueError as e:
                ck("D6/db a backwards window is REFUSED on a day too", True, str(e)[:70])
            cleared = await win.set_dow(con, TENANT, BAR_ONTAÑON, 5)
            ck("D6/db clearing a day writes the ROW AWAY — no empty row left shouting «special»",
               cleared == win.blank()
               and await con.fetchval("select count(*) from customer_window_dow where tenant_id=$1 "
                                      "and phone_number=$2", TENANT, BAR_ONTAÑON) == 0)
            w_sat3 = win.resolve(custs.get(BAR_ONTAÑON), None,
                                 (await win.dows_for(con, TENANT, [BAR_ONTAÑON], dow=sat)
                                  ).get(BAR_ONTAÑON, {}).get(sat))
            ck("D6/db …and that Saturday goes back to their standing hours, not to «sin franja»",
               win.label(w_sat3) == "08:00–11:00" and w_sat3["scope"] == "customer")
            dropped = await win.clear_dows(con, TENANT, FREIDURIA_LEBRIJA)
            ck("D6/db clearing the whole week says WHICH days it dropped",
               dropped == list(win.WEEK) and await win.dow_for(con, TENANT, FREIDURIA_LEBRIJA) == {},
               win.dows_label(dropped))

            # ── D10/db · TENANT ISOLATION — loud, never an empty 200
            await win.set_dow(con, TENANT, BAR_ONTAÑON, 5, window_to="13:00", source=win.SAID)
            try:
                await win.set_dow(con, OTHER_TENANT, BAR_ONTAÑON, 5, window_to="20:00")
                ck("D10/db another tenant cannot set this customer's day", False, "(accepted!)")
            except LookupError:
                ck("D10/db another tenant cannot set this customer's day", True)
            ck("D10/db …nor read it", await win.dow_for(con, OTHER_TENANT, BAR_ONTAÑON) == {}
               and await win.dows_for(con, OTHER_TENANT, phones) == {})
            ck("D10/db …nor clear it (and the row is still there afterwards)",
               await win.clear_dows(con, OTHER_TENANT, BAR_ONTAÑON) == []
               and list(await win.dow_for(con, TENANT, BAR_ONTAÑON)) == [5])

            # ── D8/db · the follow-up, as state
            fu = await win.followup(con, TENANT, HORNO_MADROÑAL)
            ck("D8/db a customer with NO window is not asked about the rest of their week "
               "(there is nothing to ask about yet)",
               fu["ask"] is False and fu["standing"] is False and fu["days"] == [])
            fu2 = await win.followup(con, TENANT, BAR_ONTAÑON)
            ck("D8/db a customer who already told us a day is NOT asked again",
               fu2["ask"] is False and fu2["answered"] is True and fu2["days"] == [5])
            await win.set_customer(con, TENANT, MESON_ZARZA, window_from="07:00", window_to="10:00",
                                   source=win.SET)
            fu3 = await win.followup(con, TENANT, MESON_ZARZA)
            ck("D8/db a customer who just gave standing hours and nothing else IS asked, once",
               fu3["ask"] is True and fu3["standing"] is True and fu3["question"] == win.FOLLOWUP,
               fu3["question"])

            # ── D7/db · the mind's door, end to end (the refusals need no DB, the writes do)
            import runtime
            scope = runtime.scope_of(MESON_ZARZA)
            r_bad = await win.handle_tool(MESON_ZARZA, {"frase": "hasta las 13", "dia": "cuando pueda"},
                                          tenant=TENANT)
            ck("D7/db a «día» that is not a day is REFUSED, never widened to every day",
               r_bad["ok"] is False and "día de la semana" in r_bad["tool_result"],
               r_bad["tool_result"][:80])
            r_both = await win.handle_tool(MESON_ZARZA,
                                           {"frase": "hasta las 13", "dia": "los sábados",
                                            "solo_hoy": True}, tenant=TENANT)
            ck("D7/db «solo este pedido» AND «los sábados» is two promises — the employee is told "
               "to ask which",
               r_both["ok"] is False and "dos promesas" in r_both["tool_result"],
               r_both["tool_result"][:80])
            r_dow = await win.handle_tool(BAR_ONTAÑON,
                                          {"frase": "los sábados hasta la una", "dia": "los sábados"},
                                          tenant=TENANT)
            sat_w = (await win.dow_for(con, TENANT, BAR_ONTAÑON)).get(5) or win.blank()
            ck("D7/db «los sábados hasta la una» lands on Saturday, with their words and no invented "
               "hour",
               r_dow["ok"] and sat_w["said"] == "hasta la una" and sat_w["from"] is None
               and sat_w["to"] is None, r_dow["tool_result"])
            ck("D7/db …and the employee is told the rest of the week is untouched",
               "resto de días" in r_dow["tool_result"] and "los sábados" in r_dow["tool_result"])
            ck("D7/db …and the standing hours are exactly where they were",
               win.label(await win.get_customer(con, TENANT, BAR_ONTAÑON)) == "08:00–11:00")

            r_first = await win.handle_tool(MESON_ZARZA, {"frase": "de 8 a 11"}, tenant=TENANT)
            ck("D7/db a first standing window comes back with the ONE follow-up to ask",
               r_first["ok"] and win.FOLLOWUP in r_first["tool_result"], r_first["tool_result"])
            r_same = await win.handle_tool(MESON_ZARZA,
                                           {"frase": "me viene igual todos los días",
                                            "desde": "08:00", "hasta": "11:00",
                                            "dia": "todos los días"}, tenant=TENANT)
            ck("D7/db «igual todos los días» writes the STANDING window and NOT seven rows",
               r_same["ok"] and await win.dow_for(con, TENANT, MESON_ZARZA) == {}
               and await con.fetchval("select count(*) from customer_window_dow where tenant_id=$1 "
                                      "and phone_number=$2", TENANT, MESON_ZARZA) == 0,
               r_same["tool_result"])
            answered = await win.dow_answered(scope)
            fu4 = await win.followup(con, TENANT, MESON_ZARZA)
            ck("D8/db …and that ANSWER is remembered, so the question is never asked twice",
               answered is True and fu4["ask"] is False and fu4["answered"] is True)
            r_again = await win.handle_tool(MESON_ZARZA, {"frase": "mejor de 8 a 10",
                                                          "desde": "08:00", "hasta": "10:00"},
                                            tenant=TENANT)
            ck("D8/db …not even when they change their hours later",
               r_again["ok"] and win.FOLLOWUP not in r_again["tool_result"],
               r_again["tool_result"])
            # The one destructive path in the layer: they HAD a Saturday and now say no day differs.
            r_all = await win.handle_tool(BAR_ONTAÑON,
                                          {"frase": "me viene igual todos los días",
                                           "desde": "08:00", "hasta": "11:00",
                                           "dia": "todos los días"}, tenant=TENANT)
            ck("D6/db «igual todos los días» removes the day exception it contradicts — and SAYS "
               "which one, because nothing here deletes a promise quietly",
               r_all["ok"] and "los sábados" in r_all["tool_result"]
               and await win.dow_for(con, TENANT, BAR_ONTAÑON) == {}, r_all["tool_result"])
        finally:
            await con.execute("delete from orders where id = any($1::text[])", oids)
            await con.execute("delete from customer_window_dow where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            await con.execute("delete from customer_profiles where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            for p in phones:
                try:
                    import db as _db
                    import runtime as _rt
                    async with _db.scoped_tx(_rt.scope_of(p)) as c2:
                        await c2.execute("delete from fact where scope=$1::ltree", _rt.scope_of(p))
                except Exception:
                    pass


_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)
    asyncio.run(_db_checks(_dsn))
else:
    skip("D9/D10 the round-trip, the shaped day and the follow-up's memory",
         "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_window: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — A WEEK IS NOT ONE NUMBER, AND ABSENCE STILL MEANS «IGUAL QUE SIEMPRE»"
         if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
