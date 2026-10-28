"""brain/window.py — THE DELIVERY WINDOW, AND WHO PROMISED IT (SPEC §5.8a · WP-5 «Reparto»).

The delivery window was a SHIPPED FEATURE WITH NO DATA BEHIND IT: `RepartoScreen.kt` renders it,
`rutas.tsx` sorts by it, and `/api/reparto` returned `window_from=""` / `window_to=""` for every stop
forever, with an honest comment saying a fabricated window is a promise nobody made. That comment was
right. The fix is not to invent one — it is to LEARN it and to CAPTURE it. This module is the store,
the parse and the provenance; it is the twin of `brain/range.py` (a RULE, three honest states, fail
soft on the read and never on the write).

WHERE A WINDOW CAN HONESTLY COME FROM — audited in the code, 2026-07-27, not guessed at:
  1. **THE CUSTOMER SAYS IT** («repárteme antes de las once»). Supported TODAY, but only as PROSE:
     `sweep.py`'s nightly extractor already emits kind RHYTHM ("cadencia/horario") into the `fact`
     store, and the `remember` tool writes an unkeyed RELATION fact. So the MEMORY of it exists —
     the card can already say «Reparto: martes por la mañana». The DATUM does not: prose has no
     from/to, cannot order a list, cannot be shown to a driver as a promise, and the sweep is a
     NIGHTLY batch, so a window stated this morning would miss today's van. → source `said`, and it
     needs a structured capture. This module writes BOTH: the columns (the datum) and a keyed RHYTHM
     fact (the memory), so the mind never re-asks something it already knows.
  2. **THEIR HABIT.** `customer_habits` carries `delivery_dow` / `conditional_timing` in its column
     comment — and the table has NEVER had a reader or a writer anywhere in the backend (nor has
     `learned_patterns.pattern_type='delivery_dow'`). More decisively: this product records no
     ARRIVAL TIME at all. `orders.delivery_date` is a day; `orders.dispatched_at` is when WE
     dispatched. There is no observed delivery-time signal to derive a habit from, and deriving one
     from arrivals would BE an arrival prediction — out of scope. → source `habit` is DECLARED and
     UNWRITTEN, exactly as `tenant_range.range_kind='zones'` is: the seam is present, it claims
     nothing, and adding it later is a write and not a migration.
  3. **THE TENANT'S OWN ROUTINE.** The prep cutoff (`review.prep_cutoff_iso`) and the dispatch
     schedule (`app._cutoff_today`) both exist. They say when the boss STOPS TAKING ORDERS and when
     the van LEAVES. Turning "the van leaves at 05:40" into "your window is 06:00–08:00" is a
     computed arrival wearing a promise's clothes. → REFUSED. Not a source.
  4. **THE COMERCIAL SETS IT.** Nowhere in the backend, the app, the desk or onboarding today.
     → source `set`, and it is the honest primary door: he is the one who can actually promise it.

REJECTED, AND WORTH NAMING: `rutas.tsx` fell back to the order's `delivery_note` when no window was
on the wire. A delivery note is not a window — it is free text, and `brain/events.mark_dispatched`
writes it AFTER the delivery. Showing it in the window slot is precisely the fabricated promise the
blank existed to prevent. That fallback is cut.

**ROUTE OPTIMISATION IS OUT OF SCOPE AND THIS MODULE IS WHERE IT WOULD START.** A window is what the
CUSTOMER TOLD US, never what we predict. There is deliberately no ETA here, no arrival, no travel
time, no leg, no sequence and no service duration — `sort_key()` is a SORT (the day read in the order
the customer's own stated hours imply) and must never be mistaken for a route. If a future reader
finds themselves wanting `arrival_at`, that is the line: stop. `vroom.py` already owns the only thing
in this product allowed to order stops, behind `/api/sup/routes/optimize`.

═══════════════════════════════════════════════════════════════════════════════════════════════════
§5.11.1 · THE SAME CUSTOMER, A DIFFERENT DAY. Receiving hours are not ONE number. «Entre semana de 8
a 11, pero los sábados hasta las 13» is how a restaurant actually talks, and a store that can only
hold one pair of times turns that sentence into a promise broken every Saturday. `customer_window_dow`
is that layer, and with it the precedence is still ONE line because it is still one rule:

    order override › day-of-week override › standing window › «sin franja»

A row exists ONLY for a day the customer said DIFFERS. **There are never seven rows by default**, and
that is the entire design: absence here means "the same as always", which is the TRUTH about that day
and not a gap in it. Two shapes were refused to keep it that way, and both look harmless:
  · **SEVEN ROWS ON CAPTURE** («de 8 a 11 todos los días» → one row per weekday). Seven identical
    rows claim seven separate promises were made: a later change to their standing hours would
    silently miss all seven, and the desk would show a per-day franja nobody ever stated. «Todos los
    días» IS the standing window — `handle_tool` writes it there and REMOVES the day exceptions,
    because that sentence says, in so many words, that no day differs.
  · **A ROW MEANING "SAME AS ALWAYS"** (an all-NULL row planted to record that we asked). A window
    with no bound and no words is not a window — `make()` says so — so that row would be a flag
    wearing a window's clothes inside the one table every reader of this feature trusts. What we
    asked and what they answered is MEMORY, and it rides the keyed fact the mind already reads
    (`_mirror`, key `delivery_window_dow`), never a fake datum.

THE FOLLOW-UP QUESTION is a state, not a schedule. Once a window lands, the employee should ask ONCE
«¿y el resto de días te viene igual, o algún día cambia?» — so `followup()` exposes what it takes to
decide (do they have standing hours worth asking about · which days we already know differ · has an
answer ever been recorded) and NOTHING ELSE. No timer, no duty row, no queue item: those exist in
this codebase, they are for work that must not be forgotten, and a courtesy question is not that. **A
non-answer is a fine answer** — it stays standing, which is what they told us in the first place.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

log = logging.getLogger("rocoto.brain.window")

# ── the provenance, as a closed set ──────────────────────────────────────────────────────────────
# A window a van driver acts on must be traceable to who promised it, so the source is stored beside
# the times and travels on the wire. Absence is the empty string and is a REAL state, never a null
# dressed as a default.
SAID = "said"     # the customer stated it, in a conversation. Their words are kept verbatim.
SET = "set"       # the comercial set it on the customer. The only source that can PROMISE anything.
HABIT = "habit"   # RESERVED. Nothing writes this — see the module docstring, reason 2.
SOURCES: Tuple[str, ...] = (SAID, SET, HABIT)
NONE = ""

# es-ES, boss/driver-facing, one short phrase. Never a sentence — it sits under a time on a list row.
SOURCE_LABEL = {
    SAID: "lo dijo el cliente",
    SET: "lo pusiste tú",
    HABIT: "por su costumbre",
    NONE: "",
}
# The one string every surface shows when nobody ever stated a window. Kept here so the phone, the
# desk and the vital cannot drift apart on it (Compose owns its own copy in strings.xml/rep_no_window).
NO_WINDOW = "sin franja"

# The scope of the window that won: today's ORDER exception, the customer's rule for THIS WEEKDAY, or
# their standing hours. Three scopes, one precedence line (`resolve`), and the surfaces need the
# distinction: «solo hoy» and «los sábados» are different promises and a driver must be able to tell
# them apart. An older client that only knows `order` and `customer` simply shows no badge for a dow
# window — it still shows the TIMES, which is the part he acts on.
ORDER = "order"
DOW = "dow"
CUSTOMER = "customer"

_MAX_SAID = 120           # their words, verbatim — a sentence, never a paragraph
_DAY_MIN = 24 * 60


# ══ pure clock arithmetic (no DB, no config, no I/O — the vital runs this with nothing installed) ══
_WORD_HOUR = {
    "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8,
    "nueve": 9, "diez": 10, "once": 11, "doce": 12, "mediodia": 12, "mediodía": 12,
}
# «y media» / «y cuarto» / «menos cuarto» — the only fractions these conversations actually use.
_WORD_FRACTION = {"media": 30, "cuarto": 15}


def clock(v: Any) -> Optional[str]:
    """Anything a human or a client might send for one bound → canonical local 'HH:MM', or None.

    Accepts '8', '8:00', '8.30', '08h', '8 h', '20:00', 8, and the already-canonical form. Returns
    None — never a guess — for '25:00', '8:75', 'mañana', '' and every other non-clock. A bare hour
    is that hour on the hour; a bare hour is NOT rebased to the afternoon on a hunch (see
    `_from_words` for how «de la tarde» does that explicitly)."""
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        h, m = int(v), 0
    else:
        s = str(v).strip().lower().replace(" ", "")
        if not s:
            return None
        m_ = re.fullmatch(r"(\d{1,2})(?:[:.h](\d{1,2}))?h?", s)
        if not m_:
            return None
        h, m = int(m_.group(1)), int(m_.group(2) or 0)
    if not (0 <= h <= 24 and 0 <= m <= 59):
        return None
    if h == 24:
        h, m = (0, 0) if m == 0 else (h, m)
        if h == 24:
            return None
    return f"{h:02d}:{m:02d}"


def minutes(hhmm: Optional[str]) -> Optional[int]:
    """'HH:MM' → minutes since local midnight. None stays None (absence is not zero)."""
    c = clock(hhmm)
    if c is None:
        return None
    return int(c[:2]) * 60 + int(c[3:])


# ══ the window as a value ════════════════════════════════════════════════════════════════════════
def blank() -> Dict[str, Any]:
    """The ABSENT window — the honest state, and the one the surfaces render as «sin franja». Every
    reader gets this shape rather than a None, so no caller can accidentally coalesce it into a
    default shift."""
    return {"from": None, "to": None, "said": "", "source": NONE, "scope": "", "set": False}


def make(window_from: Any = None, window_to: Any = None, said: str = "",
         source: str = SET, scope: str = CUSTOMER) -> Dict[str, Any]:
    """Build a window value from parts, WITHOUT raising — the read path's normaliser. Unparseable
    bounds simply do not become bounds; garbage in the store can never crash a driver's list.

    A window EXISTS iff at least one bound survived, or the customer's own words did. Two blanks and
    no words is `blank()` no matter what source was stored beside them — a provenance without a
    window is not a window."""
    f, t = clock(window_from), clock(window_to)
    words = (said or "").strip()[:_MAX_SAID]
    src = source if source in SOURCES else NONE
    if f is not None and t is not None and minutes(f) > minutes(t):  # incoherent pair → keep neither
        log.debug("window.make: dropping incoherent pair %s→%s (keeping the words)", f, t)
        f = t = None
    if f is None and t is None and not words:
        return blank()
    if not src:
        src = SET  # a stored window with a lost source is still a window; SET is the honest floor.
    return {"from": f, "to": t, "said": words, "source": src,
            "scope": scope if scope in (ORDER, DOW, CUSTOMER) else CUSTOMER, "set": True}


def validate(window_from: Any = None, window_to: Any = None, said: str = "") -> Dict[str, Any]:
    """The WRITE path's normaliser: same shape as `make`, but it RAISES in es-ES on anything that is
    not a window. Fail-soft on the read, never on the rule — `brain/range.set_range`'s discipline.

    Clearing IS legal and is how a window is removed: all three parts empty → `blank()`, and the
    caller writes NULLs. That is not an error; it is the boss saying "there is no window", and the
    surface goes back to «sin franja»."""
    raw_f = "" if window_from is None else str(window_from).strip()
    raw_t = "" if window_to is None else str(window_to).strip()
    words = (said or "").strip()[:_MAX_SAID]
    if not raw_f and not raw_t and not words:
        return blank()
    f = clock(raw_f) if raw_f else None
    t = clock(raw_t) if raw_t else None
    if raw_f and f is None:
        raise ValueError(f"«{raw_f}» no es una hora. Escríbela como 8:00.")
    if raw_t and t is None:
        raise ValueError(f"«{raw_t}» no es una hora. Escríbela como 11:00.")
    if f is not None and t is not None and minutes(f) >= minutes(t):
        raise ValueError("La franja empieza después de terminar. Revisa las horas.")
    return {"from": f, "to": t, "said": words, "source": SET, "scope": CUSTOMER, "set": True}


def label(w: Dict[str, Any]) -> str:
    """The window as ONE string for a list row. Digits when they gave digits; their own words when
    they gave words; '' when there is nothing — and '' is what makes the surface say «sin franja».

    The bare digits only: any wrapping copy («antes de», «a partir de») is the CLIENT's, because the
    phone renders the words in Spanish from strings.xml and the desk renders its own. This mirrors
    `RepartoStopDto.windowLabel` exactly, on purpose — one label, two clients, no drift."""
    if not w or not w.get("set"):
        return ""
    f, t = w.get("from"), w.get("to")
    if f and t:
        return f"{f}–{t}"
    if f or t:
        return f or t
    return w.get("said") or ""


def source_label(w: Dict[str, Any]) -> str:
    """WHO PROMISED IT, in four words of es-ES. A window with no provenance shows nothing rather
    than «desconocido» — an unattributed window is one we should not be showing as a promise."""
    return SOURCE_LABEL.get(w.get("source") or NONE, "") if w and w.get("set") else ""


_FIRST_CLOCK = re.compile(r"(\d{1,2})\s*[:.h]\s*(\d{2})|(\b\d{1,2}\b)")


def sort_key(w: Dict[str, Any]) -> int:
    """Where this stop sits when the day is read in the order the customers' OWN stated hours imply.

    **THIS IS A SORT, NOT A SEQUENCE AND NOT AN ETA.** It computes nothing about the van: it reads
    the earliest time the customer themselves named, and puts the stops nobody timed at the end. If
    the only thing we have is their words, the first clock inside those words is used — a sort key,
    never a time we would show or promise. Windowless stops sort last (and then by name, at the call
    site) so a driver's list opens with the ones somebody actually committed to."""
    if not w or not w.get("set"):
        return _DAY_MIN + 1
    m = minutes(w.get("from")) if w.get("from") else None
    if m is None and w.get("to"):
        m = minutes(w.get("to"))
    if m is None:
        hit = _FIRST_CLOCK.search(w.get("said") or "")
        if hit:
            h = int(hit.group(1) or hit.group(3) or 0)
            mm = int(hit.group(2) or 0)
            if 0 <= h < 24 and 0 <= mm < 60:
                m = h * 60 + mm
    return _DAY_MIN if m is None else m


def resolve(customer: Optional[Dict[str, Any]], order: Optional[Dict[str, Any]],
            dow_window: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """THE PRECEDENCE, and it is one line because it is one rule — **the more specific promise
    wins**:

        order override › day-of-week override › standing window › «sin franja»

    «Hoy antes de las nueve» is a fact about today; «los sábados hasta la una» is a fact about their
    Saturdays; their receiving hours are a fact about them. Each beats the one behind it because each
    is narrower, and nothing behind is ever copied forward — a customer who changes their standing
    hours changes every day they never singled out, which is what they meant by not singling it out.

    `dow_window` is the window for THE WEEKDAY OF THIS DELIVERY (a value, not a number — the caller
    has already looked it up with `dow_for`/`dows_for` and `dow_of`). Passing nothing is the common
    case and means "no day exception", never "we did not check": absence resolves to the standing
    window, which is the truth about that day.

    Pure: all three arguments are window values (from `make`), so the rule stays assertable with no
    DB in sight — the day list, the desk, the solver and the vital all evaluate the same three
    lines."""
    if order and order.get("set"):
        return {**order, "scope": ORDER}
    if dow_window and dow_window.get("set"):
        return {**dow_window, "scope": DOW}
    if customer and customer.get("set"):
        return {**customer, "scope": CUSTOMER}
    return blank()


def wire(w: Dict[str, Any]) -> Dict[str, Any]:
    """The window as BOTH clients read it — one wire shape for `/api/reparto` (the phone, machine
    key) and `/api/sup/routes/day` (the desk, session cookie), so a franja can never mean one thing
    on the phone and another on the desk (§5.8a: "two doors, one rule").

    `window_from`/`window_to` stay '' rather than null because `RepartoStopDto` already declares them
    as non-null defaulted Strings — the existing contract is honoured, and '' has always meant open
    at that end there. NOTE what is NOT here: no eta, no arrival, no duration, no position."""
    return {
        "window_from": w.get("from") or "",
        "window_to": w.get("to") or "",
        "window_text": w.get("said") or "",       # their own words, when they gave words not digits
        "window_source": w.get("source") or "",   # said | set | habit | '' (= nobody stated one)
        # order (today's exception) | dow (their rule for this weekday) | customer (standing) | ''
        "window_scope": w.get("scope") or "",
    }


# ══ what the customer SAID → a window (the `said` capture) ═══════════════════════════════════════
_AFTERNOON = re.compile(r"de la (tarde|noche)|por la (tarde|noche)|p\.?m\.?")
_MORNING = re.compile(r"de la ma[ñn]ana|por la ma[ñn]ana|a\.?m\.?")
# Vague daypart phrases: REAL things a customer says, and deliberately NOT turned into digits. 08:00
# for «por la mañana» would be a promise nobody made — the exact failure this module exists to end.
_VAGUE = re.compile(r"\b(por la ma[ñn]ana|por la tarde|por la noche|a primera hora|"
                    r"a [úu]ltima hora|al mediod[íi]a|temprano|entre horas)\b")

_HOUR = r"(?:las?\s+)?(\d{1,2}(?:[:.h]\d{2})?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)"
# The separator of a range tolerates the FIRST bound's own trailing qualifier — «de 8 y media a 11»,
# «de 8 de la mañana a 2 de la tarde» — which is otherwise how a perfectly ordinary sentence fails to
# parse at all and silently becomes «sin franja».
_SEP = (r"\s+(?:y\s+(?:media|cuarto)|menos\s+cuarto)?\s*"
        r"(?:de\s+la\s+(?:ma[ñn]ana|tarde|noche)\s+)?(?:a|y|hasta)\s+")
_RANGE = re.compile(rf"\b(?:de|entre)\s+{_HOUR}{_SEP}{_HOUR}", re.I)
_UPPER = re.compile(rf"\b(?:antes de|hasta|no m[áa]s tarde de|como (?:muy )?tarde a)\s+{_HOUR}", re.I)
_LOWER = re.compile(rf"\b(?:a partir de|desde|despu[ée]s de|no antes de)\s+{_HOUR}", re.I)
_FRACTION = re.compile(r"\b(?:y\s+(media|cuarto)|menos\s+(cuarto))\b", re.I)


_TAIL = 26   # how far after an hour token a «y media» / «de la tarde» is still ITS qualifier


def _qualifier(tail: str) -> str:
    """'am' · 'pm' · '' — and ONLY when the daypart is ADJACENT to the hour it modifies. «antes de
    las 11, y por la tarde te llamo» does not make eleven o'clock an evening delivery; a `search`
    over the sentence would have said it did."""
    near = (tail or "").lstrip()[:_TAIL]
    if _MORNING.match(near):
        return "am"
    if _AFTERNOON.match(near):
        return "pm"
    return ""


def _read_hour(token: str, tail: str) -> Optional[Tuple[int, int, str]]:
    """One captured hour token → (hour, minute, qualifier), with the qualifier NOT yet applied — the
    range branch needs to see it un-applied to read «de 1 a 3 de la tarde» correctly. Digits pass
    through `clock`; Spanish number words map through `_WORD_HOUR`; «y media» / «y cuarto» / «menos
    cuarto» count only when adjacent."""
    tok = (token or "").strip().lower()
    if not tok:
        return None
    base = clock(tok)
    if base is None:
        h = _WORD_HOUR.get(tok)
        if h is None:
            return None
        base = f"{h:02d}:00"
    hh, mm = int(base[:2]), int(base[3:])
    rest = (tail or "").lstrip()
    fr = _FRACTION.match(rest)
    if fr and mm == 0:
        if fr.group(1):
            mm = _WORD_FRACTION[fr.group(1).lower()]
        else:
            hh, mm = (hh - 1) % 24, 60 - _WORD_FRACTION[fr.group(2).lower()]
        rest = rest[fr.end():]
    return hh, mm, _qualifier(rest)


def _apply(h: Tuple[int, int, str]) -> str:
    """(hour, minute, qualifier) → 'HH:MM'. A bare hour with NO qualifier is taken at face value:
    these are fresh rounds that run in the morning, and silently reinterpreting an hour nobody
    qualified is exactly the invention this module exists to refuse."""
    hh, mm, qual = h
    if qual == "pm" and 1 <= hh <= 11:
        hh += 12
    return f"{hh:02d}:{mm:02d}"


# The hours a Spaniard says without ever meaning the small ones: «la una», «las dos», «las tres».
_TWO_READINGS = (1, 2, 3)


def _two_readings(token: str, h: Tuple[int, int, str]) -> bool:
    """«hasta la una» — one o'clock, but WHICH one? This is the SAME refusal the range branch already
    makes for «de 8 a 2» («which 2? we do not pick»), applied to the lone bound, and it exists
    because the honest alternative is worse than either reading: taking it at face value stores
    **01:00**, which then sorts that customer first in the driver's day and shows him a franja that
    ends before the round begins. Rebasing it to 13:00 would be the invention this module refuses.

    So: no digits, keep THEIR WORDS. «hasta la una» is a real window a driver can read and act on,
    and it says exactly as much as the customer did.

    Only 1–3 and only unqualified: «las cuatro»…«las once» read as the morning round (that is the
    face-value rule above and it is unchanged), 13+ is already a 24-hour clock, «la una de la tarde»
    said which one, and a written «01:00» is a 24-hour clock too — the leading zero IS the answer.

    It is the hour they SPOKE that is ambiguous, not the one the arithmetic landed on: «las cuatro
    menos cuarto» is 03:45 and stays 03:45, because the four is what they said and four is not one of
    the ambiguous ones. Hence the raw token rather than `h[0]`."""
    if h[2]:
        return False
    tok = str(token or "").strip().lower()
    base = clock(tok)
    spoken = int(base[:2]) if base else _WORD_HOUR.get(tok)
    if spoken not in _TWO_READINGS:
        return False
    return not tok.startswith("0")


def _said_span(t: str, m: "re.Match") -> str:
    """THEIR WORDS for a bound we refused to digitise — the match plus the «y media» / «menos cuarto»
    that trails it. «Hasta la una» when the customer said «hasta la una y media» would be us quietly
    editing them, and the whole point of keeping words is that they are theirs."""
    tail = t[m.end():]
    fr = _FRACTION.match(tail.lstrip())
    if not fr:
        return m.group(0)
    pad = len(tail) - len(tail.lstrip())
    return (m.group(0) + tail[:pad + fr.end()]).strip()


def read_spoken(text: str) -> Dict[str, Any]:
    """A sentence the customer said → a window with source `said`, or `blank()`.

    THE RULE THAT KEEPS THIS HONEST: **digits only when they gave digits.** «de 8 a 11» and «antes de
    las once» become bounds. «por la mañana» becomes their WORDS and no clock at all — it is a real
    window and a real promise, and it is not 08:00–14:00 unless somebody says so. A range we cannot
    read coherently («de 8 a 2», with nobody saying which 2) keeps THEIR WORDS and no digits rather
    than picking the reading we like — and so does a lone bound that has two readings («hasta la
    una»; see `_two_readings`). Anything with none of that is `blank()`, which is the common case and
    must stay cheap and silent.

    WHAT IT DOES NOT READ: THE DAY. «Los sábados hasta la una» carries two facts and they are parsed
    by two functions — `read_dow` reads the day, this reads the hours, and neither ever fills in the
    other's half."""
    t = " ".join((text or "").lower().split())
    if not t:
        return blank()
    m = _RANGE.search(t)
    if m:
        a = _read_hour(m.group(1), t[m.end(1):m.start(2)])
        b = _read_hour(m.group(2), t[m.end(2):])
        if a and b:
            # «de 1 a 3 de la tarde» — the qualifier trails the SECOND bound but governs the whole
            # range; «de 8 a 2 de la tarde» plainly crosses midday and the first bound is morning.
            # The tell is whether the two RAW hours ascend, and it is the reading a Spanish speaker
            # gives both sentences without thinking about it.
            if b[2] == "pm" and not a[2] and 1 <= a[0] <= 11 and a[0] < b[0]:
                a = (a[0], a[1], "pm")
            f, to = _apply(a), _apply(b)
            if minutes(f) < minutes(to):
                return make(f, to, source=SAID)
            return make(None, None, said=m.group(0), source=SAID)   # unreadable → keep their words
    m = _UPPER.search(t)
    if m:
        h = _read_hour(m.group(1), t[m.end(1):])
        if h:
            if _two_readings(m.group(1), h):
                return make(None, None, said=_said_span(t, m), source=SAID)   # → the words
            return make(None, _apply(h), source=SAID)
    m = _LOWER.search(t)
    if m:
        h = _read_hour(m.group(1), t[m.end(1):])
        if h:
            if _two_readings(m.group(1), h):
                return make(None, None, said=_said_span(t, m), source=SAID)
            return make(_apply(h), None, source=SAID)
    vague = _VAGUE.search(t)
    if vague:
        return make(None, None, said=vague.group(0), source=SAID)
    return blank()


# ══ what the customer SAID → a DAY OF THE WEEK (§5.11.1) ═════════════════════════════════════════
# 0 = Monday, ISO — the numbering `customer_profiles.typical_days` and `customer_window_dow.dow`
# already use. ONE numbering for the whole product, because a second one would be discovered by a
# customer being told «los domingos» about a Saturday.
DOW_NAME: Tuple[str, ...] = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
# «los sábados» — how a person names a RECURRING day, which is exactly what a dow row is. Written out
# rather than pluralised in code: the -es days do not take an s and «sábado»/«domingo» do, and a rule
# that guesses that will one day print «los lunESs» on a driver's screen.
DOW_PLURAL: Tuple[str, ...] = ("los lunes", "los martes", "los miércoles", "los jueves",
                               "los viernes", "los sábados", "los domingos")
WEEK: Tuple[int, ...] = (0, 1, 2, 3, 4)              # «entre semana»
WEEKEND: Tuple[int, ...] = (5, 6)                    # «el finde»
EVERY_DAY: Tuple[int, ...] = (0, 1, 2, 3, 4, 5, 6)   # «todos los días» — see `read_dow`'s docstring

# The tokens a customer actually types. ABBREVIATIONS ARE INCLUDED because people write «sáb» and
# «vie» in a chat — but «mar» IS NOT: it is the sea, a name, a street («paseo del mar»), and turning
# it into Tuesday would invent a day nobody named. Martes has to be written «mart» or «martes» here,
# and the cost of that (one re-ask) is the right cost.
_DOW_TOKEN: Dict[str, int] = {
    "lunes": 0, "lun": 0,
    "martes": 1, "mart": 1,
    "miércoles": 2, "miercoles": 2, "miér": 2, "mier": 2, "mié": 2, "mie": 2,
    "jueves": 3, "jue": 3,
    "viernes": 4, "vier": 4, "vie": 4,
    "sábado": 5, "sábados": 5, "sabado": 5, "sabados": 5, "sáb": 5, "sab": 5,
    "domingo": 6, "domingos": 6, "dom": 6,
}
# Built FROM the map (longest first) so the two can never drift apart — a token in the map that the
# regex could not match would be a day the product claims to understand and silently does not.
_DOW_ALT = "|".join(sorted(_DOW_TOKEN, key=len, reverse=True))
_DOW_WORD = re.compile(rf"\b({_DOW_ALT})\b")
_DOW_RANGE = re.compile(rf"\bde\s+(?:l[oa]s\s+)?({_DOW_ALT})\s+a\s+(?:l[oa]s\s+)?({_DOW_ALT})\b")
_EVERY_DAY_PH = re.compile(r"\b(todos los d[íi]as|cada d[íi]a|a diario)\b")
_WEEK_PH = re.compile(r"\b(entre ?semana|d[íi]as laborables|laborables)\b")
_WEEKEND_PH = re.compile(r"\b(fin(?:es)? de semana|findes?)\b")
# «todos los días menos los sábados» is a sentence this function REFUSES rather than half-reads: the
# tokens it can see would make it answer "every day" or "Saturday", and both are the opposite of what
# was said. An exclusion the mind must ask about is better than a day we made up.
_EXCEPT = re.compile(r"\b(menos|excepto|salvo|quitando|no los|ni los)\b")


def _dow(v: Any) -> Optional[int]:
    """Anything a caller or a client might hand for one weekday → 0–6, or None. Strict on purpose: a
    day is an index into a person's week, and 7 or '' is not one."""
    if isinstance(v, bool) or v is None:
        return None
    try:
        d = int(v)
    except (TypeError, ValueError):
        return None
    return d if 0 <= d <= 6 else None


def dow_of(day: Any) -> Optional[int]:
    """A calendar day ('2026-08-01', a date, a datetime) → its weekday, Monday=0. None for anything
    that is not a day — the day list reads a string off a query param and a garbled one must produce
    "no day exception", never Monday's."""
    if isinstance(day, datetime):
        return day.weekday()
    if isinstance(day, date):
        return day.weekday()
    try:
        return date.fromisoformat(str(day or "").strip()[:10]).weekday()
    except ValueError:
        return None


def dow_label(dow: Any) -> str:
    """«los sábados» — one weekday, named the way a recurring day is named. '' for anything that is
    not a weekday, because a day we cannot name is a day we must not print."""
    d = _dow(dow)
    return DOW_PLURAL[d] if d is not None else ""


def dows_label(dows: Iterable[Any]) -> str:
    """A set of weekdays as ONE es-ES phrase, the way the customer would say it back: «entre semana»,
    «el fin de semana», «todos los días», «los lunes y los jueves». It exists so the tool result the
    mind reads out and the fact on the card use the SAME words the customer used — the employee
    repeating «los días 0 y 3» would be the machine showing through."""
    days = sorted({d for d in (_dow(x) for x in dows or ()) if d is not None})
    if not days:
        return ""
    if tuple(days) == EVERY_DAY:
        return "todos los días"
    if tuple(days) == WEEK:
        return "entre semana"
    if tuple(days) == WEEKEND:
        return "el fin de semana"
    parts = [DOW_PLURAL[d] for d in days]
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " y " + parts[-1]


def read_dow(text: str) -> Optional[List[int]]:
    """A phrase the customer said → the weekdays it names, or None.

    THE SAME DISCIPLINE AS THE CLOCK PARSE: read what they SAID, refuse to guess. «Los sábados» → [5].
    «Entre semana» → [0–4]. «El finde» → [5,6]. «De lunes a viernes» → [0–4] (the span they drew, not
    the two ends). «Todos los días» → all seven. Anything that is not a weekday — «mañana», «cuando
    puedas», «igual», a bare hour, silence — is **None**, and None is not a failure: it is the module
    saying it does not know which day, which is the only thing that stops «los sábados» quietly
    becoming a promise for every day of the week.

    None also for an EXCLUSION («todos los días menos los sábados»): the tokens present would make
    this answer "all seven" or "Saturday", and both are the opposite of what was said. The employee
    asks again; nothing is invented in the meantime.

    ALL SEVEN IS NOT SEVEN ROWS. `read_dow` reports what the sentence names; `handle_tool` is what
    knows that «todos los días» means the STANDING window and no day exceptions at all (module
    docstring, §5.11.1). Keeping those two apart is what lets this stay a parse."""
    t = " ".join((text or "").lower().split())
    if not t:
        return None
    if _EXCEPT.search(t):
        return None
    if _EVERY_DAY_PH.search(t):
        return list(EVERY_DAY)
    out: set = set()
    span = _DOW_RANGE.search(t)
    if span:
        a, b = _DOW_TOKEN[span.group(1)], _DOW_TOKEN[span.group(2)]
        # Walked forward from a to b inclusive, wrapping through Sunday — «de viernes a lunes» is a
        # weekend span and not an empty one. Seven steps maximum: the week is a circle, not a line.
        d = a
        for _ in range(7):
            out.add(d)
            if d == b:
                break
            d = (d + 1) % 7
    if _WEEK_PH.search(t):
        out.update(WEEK)
    if _WEEKEND_PH.search(t):
        out.update(WEEKEND)
    for hit in _DOW_WORD.finditer(t):
        out.add(_DOW_TOKEN[hit.group(1)])
    return sorted(out) or None


# ══ the store ════════════════════════════════════════════════════════════════════════════════════
_CUST_COLS = ("delivery_window_from", "delivery_window_to", "delivery_window_source",
              "delivery_window_said")


def _cust(row: Any) -> Dict[str, Any]:
    """A `customer_profiles` row (or its absence) → a window value. Fail-soft by construction."""
    if not row:
        return blank()
    d = dict(row)
    return make(d.get("delivery_window_from"), d.get("delivery_window_to"),
                said=d.get("delivery_window_said") or "",
                source=d.get("delivery_window_source") or "", scope=CUSTOMER)


def _order(row: Any) -> Dict[str, Any]:
    """An `orders` row (or its absence) → the per-order OVERRIDE window value."""
    if not row:
        return blank()
    d = dict(row)
    return make(d.get("window_from"), d.get("window_to"), said=d.get("window_said") or "",
                source=d.get("window_source") or "", scope=ORDER)


async def get_customer(con, tenant: str, phone: str) -> Dict[str, Any]:
    """One customer's standing receiving hours. Never raises: an unreadable profile row means "we
    do not know", which is `blank()` — a delivery list is not taken down by a settings read."""
    try:
        row = await con.fetchrow(
            "select delivery_window_from, delivery_window_to, delivery_window_source, "
            "delivery_window_said from customer_profiles where tenant_id=$1 and phone_number=$2",
            tenant, phone)
    except Exception:
        log.debug("window.get_customer fail-soft for %s", phone, exc_info=True)
        return blank()
    return _cust(row)


async def customers_for(con, tenant: str, phones: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch read for a day's list — one query, phone → window. Missing phones are simply absent."""
    if not phones:
        return {}
    try:
        rows = await con.fetch(
            "select phone_number, delivery_window_from, delivery_window_to, "
            "delivery_window_source, delivery_window_said from customer_profiles "
            "where tenant_id=$1 and phone_number = any($2::text[])", tenant, sorted(set(phones)))
    except Exception:
        log.debug("window.customers_for fail-soft", exc_info=True)
        return {}
    return {r["phone_number"]: _cust(r) for r in rows}


async def set_customer(con, tenant: str, phone: str, *, window_from: Any = None,
                       window_to: Any = None, said: str = "", source: str = SET) -> Dict[str, Any]:
    """THE COMERCIAL'S DOOR (and the mind's, with `source=SAID`). RAISES in es-ES on a window that is
    not one; clearing (everything empty) is legal and writes NULLs back.

    Tenant-filtered UPDATE, like `sup_customer_erp_code`: a wrong-tenant phone updates nothing and
    the caller 404s honestly rather than minting a profile row from a typo."""
    w = validate(window_from, window_to, said)
    if w["set"]:
        w["source"] = source if source in SOURCES else SET
    hit = await con.fetchval(
        "update customer_profiles set delivery_window_from=$3::text, delivery_window_to=$4::text, "
        "delivery_window_source=$5::text, delivery_window_said=$6::text, "
        # The cast is load-bearing: without it Postgres cannot infer $5's type inside the CASE and
        # asyncpg raises AmbiguousParameterError on prepare.
        "delivery_window_at = case when $5::text is null then null else now() end, updated_at=now() "
        "where tenant_id=$1 and phone_number=$2 returning phone_number",
        tenant, phone, w["from"], w["to"], (w["source"] or None), (w["said"] or None))
    if not hit:
        raise LookupError("no_such_customer")
    return {**w, "scope": CUSTOMER}


async def set_order(con, order_id: str, *, window_from: Any = None, window_to: Any = None,
                    said: str = "", source: str = SET) -> Dict[str, Any]:
    """THE PER-ORDER OVERRIDE — today's exception, which beats the customer's default for this
    delivery only. Clearing it restores the default (which may itself be absent); that is why
    clearing writes NULLs and never writes the default down onto the order."""
    w = validate(window_from, window_to, said)
    if w["set"]:
        w["source"] = source if source in SOURCES else SET
    hit = await con.fetchval(
        "update orders set window_from=$2::text, window_to=$3::text, window_source=$4::text, "
        "window_said=$5::text, updated_at=now() where id=$1 returning id",
        order_id, w["from"], w["to"], (w["source"] or None), (w["said"] or None))
    if not hit:
        raise LookupError("no_such_order")
    return {**w, "scope": ORDER}


async def orders_for(con, order_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch read of the per-order overrides for a day's list. Absent id → no override."""
    if not order_ids:
        return {}
    try:
        rows = await con.fetch(
            "select id, window_from, window_to, window_source, window_said from orders "
            "where id = any($1::text[])", sorted(set(order_ids)))
    except Exception:
        log.debug("window.orders_for fail-soft", exc_info=True)
        return {}
    return {r["id"]: _order(r) for r in rows}


# ── the DAY-OF-WEEK layer (§5.11.1) ──────────────────────────────────────────────────────────────
_DOW_COLS = "dow, window_from, window_to, window_source, window_said"


def _dow_w(row: Any) -> Dict[str, Any]:
    """A `customer_window_dow` row → a window value, scoped DOW. Fail-soft by construction, exactly
    like `_cust`: garbage in one day's row can never take down the whole week."""
    if not row:
        return blank()
    d = dict(row)
    return make(d.get("window_from"), d.get("window_to"), said=d.get("window_said") or "",
                source=d.get("window_source") or "", scope=DOW)


async def dow_for(con, tenant: str, phone: str) -> Dict[int, Dict[str, Any]]:
    """The days this customer told us DIFFER → {dow: window}. Usually `{}`, and `{}` is the answer,
    not a miss: it means every day is their standing window, which is what they said by not saying
    otherwise.

    A row whose window no longer holds anything (all cleared by a race, or garbage) is DROPPED here
    rather than returned as a set-less value — a day is in this map iff there is a real promise for
    it, so no caller can iterate the map and show a franja that is not one. Never raises."""
    try:
        rows = await con.fetch(
            f"select {_DOW_COLS} from customer_window_dow "
            "where tenant_id=$1 and phone_number=$2 order by dow", tenant, phone)
    except Exception:
        log.debug("window.dow_for fail-soft for %s", phone, exc_info=True)
        return {}
    out: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        w = _dow_w(r)
        d = _dow(r["dow"])
        if w["set"] and d is not None:
            out[d] = w
    return out


async def dows_for(con, tenant: str, phones: List[str],
                   dow: Any = None) -> Dict[str, Dict[int, Dict[str, Any]]]:
    """Batch read for a DAY'S LIST — one query, {phone: {dow: window}}. Phones with no exception are
    simply absent, and the caller's `.get(phone) or {}` is the honest empty week.

    `dow` narrows it to the one weekday the list is actually about (`dow_of(day)`), which is what the
    reparto surface wants: a Thursday round has no business reading anybody's Saturday. Omit it and
    you get the whole week, which is what a customer card wants. Never raises."""
    if not phones:
        return {}
    d = _dow(dow)
    try:
        rows = await con.fetch(
            f"select phone_number, {_DOW_COLS} from customer_window_dow "
            "where tenant_id=$1 and phone_number = any($2::text[]) "
            "and ($3::int is null or dow = $3::int) order by phone_number, dow",
            tenant, sorted(set(phones)), d)
    except Exception:
        log.debug("window.dows_for fail-soft", exc_info=True)
        return {}
    out: Dict[str, Dict[int, Dict[str, Any]]] = {}
    for r in rows:
        w = _dow_w(r)
        dd = _dow(r["dow"])
        if w["set"] and dd is not None:
            out.setdefault(r["phone_number"], {})[dd] = w
    return out


async def set_dow(con, tenant: str, phone: str, dow: Any, *, window_from: Any = None,
                  window_to: Any = None, said: str = "", source: str = SET) -> Dict[str, Any]:
    """«Los sábados hasta la una» — ONE weekday's exception to their standing hours.

    Same rule discipline as `set_customer`: `validate` RAISES in es-ES on a window that is not one,
    and an unnamed day raises too rather than defaulting to Monday. **CLEARING WRITES THE ROW AWAY**
    (a DELETE, not an all-NULL row): the absence of a row is what "the same as always" means in this
    table, so a cleared exception must leave nothing behind — an empty row would still say «this day
    is special» to every reader, which is precisely the thing that stopped being true.

    The customer is checked against THIS TENANT first, like `set_customer`'s tenant-filtered UPDATE:
    `customer_window_dow` has no foreign key, so without this a typo'd phone would happily mint an
    orphan row that no profile, no list and no card would ever show again."""
    d = _dow(dow)
    if d is None:
        raise ValueError("No sé de qué día me hablas. Dime el día de la semana: «los sábados».")
    w = validate(window_from, window_to, said)
    if w["set"]:
        w["source"] = source if source in SOURCES else SET
    known = await con.fetchval(
        "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, phone)
    if not known:
        raise LookupError("no_such_customer")
    if not w["set"]:
        await con.execute("delete from customer_window_dow "
                          "where tenant_id=$1 and phone_number=$2 and dow=$3", tenant, phone, d)
        return blank()
    await con.execute(
        "insert into customer_window_dow (tenant_id, phone_number, dow, window_from, window_to, "
        "window_source, window_said, updated_at) "
        "values ($1,$2,$3,$4::text,$5::text,$6::text,$7::text,now()) "
        "on conflict (tenant_id, phone_number, dow) do update set window_from=excluded.window_from, "
        "window_to=excluded.window_to, window_source=excluded.window_source, "
        "window_said=excluded.window_said, updated_at=now()",
        tenant, phone, d, w["from"], w["to"], (w["source"] or None), (w["said"] or None))
    return {**w, "scope": DOW}


async def clear_dows(con, tenant: str, phone: str) -> List[int]:
    """Every day exception, removed — and it returns WHICH ones, because this is the one destructive
    act in the layer and a caller that cannot say what it dropped cannot tell the boss either.

    The one sentence that legitimately triggers it is «me viene igual todos los días»: that is the
    customer saying no day differs, and leaving a contradictory Saturday row behind would keep two
    promises alive with nothing to say which is current. Tenant-filtered, like every write here."""
    try:
        rows = await con.fetch("delete from customer_window_dow where tenant_id=$1 and "
                               "phone_number=$2 returning dow", tenant, phone)
    except Exception:
        log.debug("window.clear_dows fail-soft for %s", phone, exc_info=True)
        return []
    return sorted(d for d in (_dow(r["dow"]) for r in rows) if d is not None)


# ══ the mind's door ══════════════════════════════════════════════════════════════════════════════
# WHY A TOOL AND NOT AN EXISTING PATH — the audit, so nobody re-opens it:
#   · `brain/keepinmind.py` is the ATTENTION BAND (clean/note/underline). It is not a store at all
#     and cannot carry a datum; putting a window in it would be a category error.
#   · `install.py` writes manifest_duty rows and standing instructions. A window is neither a
#     SITUATION nor a rule about how the employee must BEHAVE — it is a fact about the customer.
#   · The `fact` store IS the right memory and is REUSED below (a keyed RHYTHM fact, so a restated
#     window VERSIONS the old one instead of piling up) — but a fact is prose. `/api/reparto` cannot
#     sort a list by a sentence, and a driver cannot be handed one as a promise.
# So: the memory rides the existing keyed write; the DATUM needs its own small hand. The tool is
# deliberately one verb with three optional fields, in the `_tools` idiom (es-ES description written
# for the mind, not for us).
TOOL: Dict[str, Any] = {
    "name": "set_delivery_window",
    "description": (
        "Apunta la FRANJA DE ENTREGA de este cliente — la hora a la que puede recibir la mercancía "
        "(«repárteme antes de las once», «a partir de las 8», «de 8 a 11», «por la mañana»). Úsalo "
        "EN CUANTO te lo diga, con sus palabras. Si es solo para el pedido de hoy, dilo en «solo_hoy». "
        "Si te dice que UN DÍA CONCRETO es distinto («los sábados hasta la una», «entre semana de 8 "
        "a 11»), ponlo en «dia» y el resto de días se queda como estaba. Cuando te dé una franja por "
        "primera vez, pregúntale UNA vez si el resto de días le viene igual o si algún día cambia; "
        "si no te contesta a eso, lo dejas como está y no insistes. "
        "NO lo uses para adivinar una hora que no te han dado, ni para prometer cuándo llegará el "
        "repartidor: la franja es lo que el cliente dice que le viene bien, no una hora de llegada."),
    "input_schema": {"type": "object", "properties": {
        "frase": {"type": "string", "description": "lo que te ha dicho, tal cual («antes de las once»)"},
        "desde": {"type": "string", "description": "hora de inicio si te la ha dado (8:00). Vacío si no."},
        "hasta": {"type": "string", "description": "hora límite si te la ha dado (11:00). Vacío si no."},
        "dia": {"type": "string",
                "description": ("el día SOLO si ha dicho que ese día es distinto: «los sábados», "
                                "«entre semana», «el finde», «de lunes a viernes». Vacío si esa "
                                "franja le vale todos los días.")},
        "solo_hoy": {"type": "boolean", "description": "true si vale solo para este pedido, no siempre"}},
        "required": ["frase"]},
}


async def capture_said(con, tenant: str, phone: str, text: str, *, order_id: str = "",
                       dows: Sequence[int] = (), window_from: Any = None,
                       window_to: Any = None) -> Dict[str, Any]:
    """THE MIND'S CAPTURE: what the customer just said → the structured window (source `said`).

    The mind may hand explicit bounds when it heard them; otherwise the sentence is parsed here, so
    the SAME parse runs whether the words arrived through a tool call, a re-read of the thread or a
    test. Returns `blank()` when nothing timelike was said — silence is the common case.

    THE THREE DOORS ARE MUTUALLY EXCLUSIVE and the caller picks exactly one, because they are three
    different promises: `order_id` = only this delivery, `dows` = these weekdays from now on, neither
    = their standing hours. `handle_tool` refuses the contradictory combinations out loud rather than
    quietly ranking them — a customer who says «solo hoy» and «los sábados» in one breath has said
    two things and the employee should ask which."""
    w = make(window_from, window_to, source=SAID) if (window_from or window_to) else blank()
    if not w["set"]:
        w = read_spoken(text)
    if not w["set"]:
        return blank()
    if order_id:
        return await set_order(con, order_id, window_from=w["from"], window_to=w["to"],
                               said=w["said"], source=SAID)
    if dows:
        # One row per day, and each row is its own promise — so a failure part-way through leaves the
        # days that were written, which are true, rather than rolling back a fact the customer stated.
        out = blank()
        for d in dows:
            out = await set_dow(con, tenant, phone, d, window_from=w["from"], window_to=w["to"],
                                said=w["said"], source=SAID)
        return out          # the same window, now standing on each of those days
    return await set_customer(con, tenant, phone, window_from=w["from"], window_to=w["to"],
                              said=w["said"], source=SAID)


# The two keys this module owns in the fact store. Keyed, so a restated window VERSIONS the previous
# one (memory.write_fact's contradiction path) instead of stacking contradictions in one card.
FACT_KEY = "delivery_window"
DOW_FACT_KEY = "delivery_window_dow"
# What the card says when they answered the follow-up with «me viene igual todos los días». It is a
# REAL answer and it is recorded as one — in memory, where answers live, and not as a fake row in
# `customer_window_dow` (module docstring, §5.11.1).
SAME_EVERY_DAY = "Franja de reparto: la misma todos los días."


async def _mirror(scope: str, line: str, key: str) -> None:
    """One keyed RHYTHM fact on a customer's scope, plus the card regen. Fail-soft: the datum is
    already stored by the time this runs, and a memory hiccup must never fail a capture."""
    try:
        import db
        import memory
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug) "
                              "values($1::ltree,'customer',null) on conflict do nothing", scope)
            await con.execute("insert into card(scope,body,version) values($1::ltree,'',0) "
                              "on conflict do nothing", scope)
            await memory.write_fact(con, scope, "RHYTHM", line, key=key)
            await memory.regen_card(con, scope, display_name="", tier="customer")
    except Exception:
        log.debug("window._mirror(%s) fail-soft for %s", key, scope, exc_info=True)


async def mirror_fact(scope: str, w: Dict[str, Any]) -> None:
    """Write the STANDING window into the MIND's memory too, through the existing keyed writer — so
    the card already says it and the employee never asks a customer twice for something he has
    already told it. kind RHYTHM is `sweep.py`'s own word for cadencia/horario."""
    text = label(w)
    await _mirror(scope, f"Franja de reparto: {text}" if text else "Sin franja de reparto acordada.",
                  FACT_KEY)


async def mirror_dow_fact(scope: str, dows: Dict[int, Dict[str, Any]]) -> None:
    """The same, for the DAYS THAT DIFFER — and for the answer «todos los días igual», which is what
    an EMPTY map means here and why this function accepts one instead of refusing it.

    ONE fact under ONE key for the whole week, deliberately: seven facts would be seven lines of card
    for a thing a person says in half a sentence, and versioning them independently would let a stale
    Saturday outlive the sentence that replaced it. This is also the mark that says the follow-up was
    ANSWERED — see `followup`, which is why an empty map still writes."""
    if not dows:
        await _mirror(scope, SAME_EVERY_DAY, DOW_FACT_KEY)
        return
    parts = [f"{dow_label(d)} {label(w)}".strip() for d, w in sorted(dows.items()) if w.get("set")]
    line = "Franja de reparto por días: " + " · ".join(parts) if parts else SAME_EVERY_DAY
    await _mirror(scope, line, DOW_FACT_KEY)


# ══ the ONE follow-up question (§5.11.1) ═════════════════════════════════════════════════════════
# Asked ONCE, right after a window first lands, and never again. It is the question that turns one
# number into their real week, and it is worth exactly one turn of the employee's attention.
FOLLOWUP = "¿Y el resto de días te viene igual, o algún día cambia?"


async def dow_answered(scope: str) -> bool:
    """Has this customer ever ANSWERED the follow-up? Reads the keyed fact this module writes —
    `mirror_dow_fact` — so the answer lives where every other thing they have told us lives, and
    there is no second ledger of what we asked to drift from the first.

    Fail-soft to **False**, and the direction is chosen: False means "we cannot show they answered",
    so the employee may ask. Asking a polite question twice costs a sentence; never asking it is the
    gap this whole layer exists to close."""
    try:
        import db
        async with db.scoped_tx(scope) as con:
            return bool(await con.fetchval(
                "select 1 from fact where scope=$1::ltree and key=$2 and invalid_at is null limit 1",
                scope, DOW_FACT_KEY))
    except Exception:
        log.debug("window.dow_answered fail-soft for %s", scope, exc_info=True)
        return False


async def followup(con, tenant: str, phone: str) -> Dict[str, Any]:
    """WHETHER TO ASK «¿y el resto de días te viene igual, o algún día cambia?» — as STATE, never as a
    schedule. Returns {standing, days, answered, ask, question}.

    `ask` is True only when there is something to ask ABOUT (they gave us a standing window) and no
    answer on record (no day exception, no «igual todos los días» fact). Everything else is False,
    including the case that matters most: **a customer who said nothing keeps their standing hours**,
    because a non-answer is a real answer here — it says what they already said. Nothing re-raises
    the question either; the only thing that brings it back is a NEW window landing, which is a fresh
    reason to ask and not the same question repeated at somebody.

    WHAT WAS REFUSED, so nobody rebuilds it: an `asked_at` column (a new datum whose only job is to
    remember a question — the memory already does that), a `manifest_duty` row (duties exist for work
    that must not be forgotten, and this is not that: it is a nicety, and one the mind will get
    naturally on the next window anyway), and a nightly sweep (nothing here is time-sensitive; a week
    is not urgent and a scheduler would make it look urgent). This function READS and returns; the
    mind decides, in the conversation it is already having.

    Fail-soft throughout — it is a read, and a courtesy question can never take down a turn."""
    w = await get_customer(con, tenant, phone)
    days = await dow_for(con, tenant, phone)
    answered = bool(days)
    if not answered:
        try:
            import runtime
            answered = await dow_answered(runtime.scope_of(phone))
        except Exception:
            log.debug("window.followup: memory probe skipped for %s", phone, exc_info=True)
    return {"standing": bool(w.get("set")), "days": sorted(days), "answered": answered,
            "ask": bool(w.get("set")) and not answered, "question": FOLLOWUP}


async def live_order_id(con, phone: str) -> str:
    """The order «solo para este pedido» actually MEANS, resolved from the phone alone.

    The mind is in a CONVERSATION, not on an order — `agent_reply` has no order in scope — so when
    the customer says a window applies only to this one, something has to say which one that is. It
    is their most recent order that is still in play: `needs_review` (nobody has decided it yet),
    `approved` or `sent`. An order already `delivered`, `cancelled` or `rejected` cannot take a
    window; hanging one on it would silently write a promise onto a closed thing.

    Returns "" when they have no live order — and that emptiness is LOAD-BEARING. See `handle_tool`:
    it must NOT quietly fall back to their standing hours, because «solo hoy» and «siempre» are
    opposite promises and guessing between them is exactly the class of error this module exists to
    prevent."""
    try:
        return await con.fetchval(
            "select id from orders where phone_number = $1 "
            "and status in ('needs_review','approved','sent') "
            "order by created_at desc limit 1", phone) or ""
    except Exception:
        log.debug("window.live_order_id fail-soft for %s", phone, exc_info=True)
        return ""


async def handle_tool(phone: str, inp: Dict[str, Any], *, tenant: str = "",
                      order_id: str = "") -> Dict[str, Any]:
    """The `set_delivery_window` dispatch — everything the mind's tool loop needs, kept HERE so the
    splice into `agent_reply._tools` is two lines and this module owns the behaviour.

    Returns {ok, label, tool_result} where `tool_result` is the es-ES sentence handed back to the
    mind — phrased so it can read it out to the customer without promising an arrival.

    THREE SCOPES, AND THE CONTRADICTIONS ARE REFUSED OUT LOUD (never ranked silently): «solo_hoy» is
    this delivery, «dia» is those weekdays from now on, neither is their standing hours. Both at once
    is two different promises in one sentence and the employee is told to ask which."""
    import config
    tenant = tenant or config.BRAIN_TENANT
    said = str(inp.get("frase") or "")
    only_today = bool(inp.get("solo_hoy"))
    dia = str(inp.get("dia") or "").strip()
    days = read_dow(dia) if dia else None
    if dia and days is None:
        # They named something that is not a day of the week. Writing the standing window instead
        # would widen «los sábados» into every day — the same widening the «solo hoy» branch below
        # refuses, one layer up.
        return {"ok": False, "label": "",
                "tool_result": (f"«{dia}» no me dice qué día de la semana es. Dímelo con el día "
                                "(«los sábados», «entre semana», «de lunes a viernes») o déjalo "
                                "vacío si esa franja le vale todos los días.")}
    if days and only_today:
        return {"ok": False, "label": "",
                "tool_result": (f"Me dices a la vez que es solo para este pedido y que es "
                                f"{dows_label(days)} — son dos promesas distintas. Pregúntale cuál "
                                "de las dos es.")}
    # «Todos los días» is the STANDING window and no day exceptions at all — never seven rows
    # (§5.11.1). It is also the customer answering the follow-up, so it clears what it contradicts.
    every_day = days is not None and tuple(days) == EVERY_DAY
    if every_day:
        days = None
    week: Dict[int, Dict[str, Any]] = {}
    dropped: List[int] = []
    cue: Dict[str, Any] = {}
    try:
        async with __import__("db").get_pool().acquire() as con:
            oid = order_id
            if only_today and not oid:
                # The chat rail has no order in scope; find the one they must be talking about.
                oid = await live_order_id(con, phone)
            if only_today and not oid:
                # REFUSE rather than widen. They said «solo este pedido» and there is no pedido —
                # writing their standing hours instead would turn a one-off into a promise they
                # never made, and nothing downstream could ever tell the two apart again.
                return {"ok": False, "label": "",
                        "tool_result": ("Dice que es solo para este pedido, pero ahora mismo no le "
                                        "veo ningún pedido en marcha. Pregúntale si esa franja le "
                                        "vale siempre o solo para un pedido concreto.")}
            w = await capture_said(con, tenant, phone, said,
                                   order_id=oid if only_today else "", dows=days or (),
                                   window_from=inp.get("desde"), window_to=inp.get("hasta"))
            if w.get("set") and days:
                week = await dow_for(con, tenant, phone)      # the whole week, for the card
            elif w.get("set") and every_day:
                dropped = await clear_dows(con, tenant, phone)
            elif w.get("set") and not only_today:
                cue = await followup(con, tenant, phone)
    except LookupError:
        return {"ok": False, "label": "", "tool_result": "No tengo aún la ficha de este cliente."}
    except ValueError as e:
        return {"ok": False, "label": "", "tool_result": str(e)}
    except Exception:
        log.exception("window.handle_tool failed for %s", phone)
        return {"ok": False, "label": "", "tool_result": "No he podido guardar la franja ahora mismo."}
    if not w.get("set"):
        return {"ok": False, "label": "",
                "tool_result": "No me ha quedado clara la hora — pregúntasela con naturalidad."}
    txt = label(w)
    try:
        import runtime
        scope = runtime.scope_of(phone)
        if days:
            await mirror_dow_fact(scope, week)
        else:
            await mirror_fact(scope, w)
            if every_day:
                await mirror_dow_fact(scope, {})     # they answered: no day differs. A real answer.
    except Exception:
        log.debug("window.handle_tool: fact mirror skipped", exc_info=True)
    if only_today:
        where = "para este pedido"
    elif days:
        where = dows_label(days)
    else:
        where = "para siempre, hasta que la cambie"
    tail = ""
    if days:
        tail = " El resto de días se queda como estaba."
    elif every_day and dropped:
        tail = f" Y quito lo que tenía apuntado para {dows_label(dropped)}."
    elif cue.get("ask"):
        # The ONE follow-up, handed to the mind at the only moment it is natural: it has just been
        # told an hour. Not a reminder, not a task — a cue in the tool result it is already reading.
        tail = f" Pregúntale UNA vez: «{FOLLOWUP}»"
    return {"ok": True, "label": f"{txt} {dows_label(days)}".strip() if days else txt,
            "tool_result": f"Franja apuntada ({txt}) {where}.{tail}"}
