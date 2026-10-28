"""ai_disclosure.py — telling a caller they are talking to a machine, because the law now requires it.

**EU AI Act Article 50 has applied since 2 August 2026.** Not a proposal, not a deadline ahead of us
— in force, and this file exists because on 17 August 2026 an audit found Rocoto's live voice rail
never said it.

── WHAT THE LAW ACTUALLY DEMANDS ────────────────────────────────────────────────────────────────
Art. 50(1) (Reg. (UE) 2024/1689): providers shall ensure AI systems intended to interact directly
with natural persons are designed so that those persons **are informed that they are interacting
with an AI system**, unless that is obvious to a reasonably well-informed, observant and
circumspect person.

Art. 50(5): the information must be given **clearly and distinguishably, at the latest at the time
of the FIRST interaction**.

The Commission's Art. 50 guidelines (C(2026) 5054, 20 July 2026) leave no room to be clever:
  · the «obvious» exception «should be interpreted **restrictively**… limited to cases where there
    is almost no doubt left». General public awareness that chatbots exist does NOT count.
  · for telephony specifically: «**explicit spoken statements at the beginning of the interaction**
    (e.g. "This is an AI-powered assistant")». Distinct audio cues «are **not** considered
    sufficient by themselves».
  · expressly INSUFFICIENT: disclosure only in T&Cs or a URL; machine-readable marks a caller
    cannot perceive; and «unclear or ambiguous signals (e.g. **generic references to 'assistant'**)».

That last one is why «Soy Rocoto, el asistente de …» does not discharge the duty. «Asistente» is
precisely the ambiguous word the guidelines name.

── WHEN IT APPLIES AT ALL: ONLY WHEN ROCOTO SPEAKS ─────────────────────────────────────────────
Peter, 2026-08-17: «we're not answering with the Rocoto voice for now… that should be a setting if
they've enabled voice, and only work when it's answering out of hours and they set it to run,
otherwise it just listens and acts if they talk about the phone.»

That is the right product AND it narrows the legal surface, because Art. 50(1) is about systems
«intended to interact directly with natural persons». In LISTEN mode nobody interacts with an AI:
a human answers their own phone and Rocoto transcribes what was said. The AI disclosure would be a
FALSE statement about that call, not a cautious one.

The recording notice is the opposite: it applies in both modes, because the recording happens in
both. Two duties, two triggers, and `opening()` composes exactly the ones that are true.

── WHO OWES IT: US, NOT OUR CUSTOMERS ──────────────────────────────────────────────────────────
Art. 50(1) binds the **provider**. The guidelines are explicit that a company putting an
interactive AI system into service under its own name is the provider — so this duty is Rocoto's,
and it cannot be delegated to a distributor by putting a line in their terms. Our customers are
deployers, and their duties (50(3)/50(4)) are different ones.

Fines: up to €15M or 3 % of worldwide turnover (Art. 99(4)(g)); for SMEs, whichever is LOWER. The
Spanish bill (Proyecto de Ley Orgánica, exp. 121/000096) would make it an *infracción grave* at
€7.5M or 1 %, policed by **AESIA** rather than the AEPD.

── THE SECOND NOTICE, WHICH IS NOT THE SAME NOTICE ─────────────────────────────────────────────
Recording carries its OWN duty, under GDPR/LOPDGDD, and the two do not substitute for each other.
The data-protection line is built separately in `call_notice()` and rests on LEGITIMATE INTEREST,
not consent — the AEPD fined exactly the «by continuing you consent» pattern in PS/00342/2023,
holding it «no se compadece con la definición» of consent. Continuing a call is valid NOTICE under
legitimate interest; it is never valid CONSENT.

LOPDGDD art. 11.2 lets the first layer be short, but it must still carry: who is responsible, what
for, and that rights exist, plus where to find the rest. And under legitimate interest, art. 21(4)
GDPR requires the right to object to be presented «clearly and separately from any other
information» — which is why the objection line here is its own sentence and not a subclause.

WHAT THIS FILE DELIBERATELY DOES NOT CLAIM: it is not legal advice and the Spanish text below has
not been through counsel. It is written to be RIGHT rather than to be safe-sounding, and the
constants are here — in one module, in one language pair — precisely so a lawyer can redline one
file rather than hunt for sentences scattered through a voice stack.
"""
from __future__ import annotations

import config

# ── Art. 50(1) — the AI disclosure. Spoken, first, unambiguous. ────────────────────────────────
# «asistente» ALONE is the ambiguous word the guidelines reject, so «inteligencia artificial» is
# said in full. Short enough that it does not feel like a disclaimer being read at somebody.
AI_LINE_ES = "Le atiende un asistente con inteligencia artificial de {business}."
AI_LINE_EN = "You're speaking with an AI assistant from {business}."

# ── Art. 50(1) ON THE TEXT RAIL — the same duty, a different sentence ────────────────────────────
# The voice line above is spoken once per call. WhatsApp has no calls: the conversation is a thread
# that never ends, so the notice goes on the FIRST message Rocoto ever sends to a number and never
# again. Peter, 2026-08-19: «the first time it ever messages a specific number, the first message it
# always says something really short, like "Hey, I'm an AI helper", and then the salesperson's name.»
#
# WHY IT IS THIS SHORT. Raquel, the day before: «al cliente le voy a volver loco… no se van a parar a
# leer una biblia». A disclosure nobody reads discharges nothing, and a long one costs the
# distributor the relationship the product exists to protect.
#
# WHY IT NAMES THE BUSINESS. Commission guidelines C(2026) 5054 pt (31): an AI agent must disclose
# «both their artificial nature and the person on whose behalf they are acting». «de Julio Pérez» is
# that second half, and it is also what stops the message reading as a stranger.
#
# «IA» IS SAID, NOT IMPLIED. The guidelines reject «unclear or ambiguous signals (e.g. generic
# references to "assistant")» — so «asistente» never travels alone.
WA_LINE_ES = "Soy un asistente de IA de {business}."
WA_LINE_EN = "I'm an AI assistant from {business}."
# No business name resolved: the artificial nature still has to be stated. Half a notice beats none.
WA_LINE_BARE_ES = "Soy un asistente de IA."
WA_LINE_BARE_EN = "I'm an AI assistant."


def whatsapp_line(business: str = "", lang: str = "es") -> str:
    """The one-off text-channel notice. Pure — the caller owns the «said once» marker."""
    en = str(lang).lower().startswith("en")
    b = (business or "").strip()
    if not b:
        return WA_LINE_BARE_EN if en else WA_LINE_BARE_ES
    return (WA_LINE_EN if en else WA_LINE_ES).format(business=b)

# ── GDPR/LOPDGDD — the recording notice. A SEPARATE duty, on legitimate interest. ──────────────
# Carries the four things LOPDGDD art. 11.2 asks of a first layer — who, why, the basis, and where
# the rest lives — plus the Art. 21(4) objection right as its own sentence.
REC_LINE_ES = ("Grabamos y transcribimos la llamada para tomar su pedido y resolver incidencias, "
               "por interés legítimo de {business}. "
               "Puede oponerse diciendo «sin grabar». "
               "Toda la información en {privacy_url}.")
REC_LINE_EN = ("We record and transcribe this call to take your order and resolve any issues, on "
               "the legitimate interest of {business}. "
               "You can object by saying «don't record». "
               "Full information at {privacy_url}.")

# What a caller can say to refuse the recording. Checked against the FIRST turns only — a customer
# saying «sin grabar» twenty minutes in is a different (and rarer) conversation than a refusal, and
# conflating them would let an unrelated sentence silently kill a recording mid-order.
OBJECTION_ES = ("sin grabar", "no grabes", "no me grabes", "no quiero que me grabes",
                "no grabar", "sin grabación", "no me grabe")
OBJECTION_EN = ("don't record", "do not record", "stop recording", "no recording")


def opening(business: str, *, privacy_url: str, speaking: bool, recording: bool,
            lang: str = "es") -> str:
    """The first thing a caller hears, before anything else is said or recorded.

    TWO INDEPENDENT DUTIES, AND THE PRODUCT DECIDES WHICH APPLY.

    · `speaking` — is the AI actually going to hold this conversation? Art. 50(1) governs systems
      «intended to interact directly with natural persons». In LISTEN mode Rocoto says nothing and
      answers nobody: a human picks up and Rocoto transcribes. **There is no AI interaction to
      disclose, and claiming one would be a false statement about the call.** Announcing an AI
      that never speaks is not extra caution — it is inaccurate, and it would make a distributor's
      own greeting sound like a robot's.
    · `recording` — GDPR/LOPDGDD. This one applies WHETHER OR NOT the AI speaks, because the
      processing happens either way.

    So listen-mode calls carry the recording notice alone, and answer-mode calls carry both, in
    that order: Art. 50(5) requires the AI disclosure «at the latest at the time of the first
    interaction», and a person who has just learned they are talking to a machine hears the next
    sentence differently.

    Both false → empty string, and the caller hears nothing extra. A deployment that neither
    speaks nor records owes neither notice, and inventing one would describe processing that is
    not happening (Art. 5(1)(a))."""
    en = str(lang).lower().startswith("en")
    parts: list[str] = []
    if speaking:
        parts.append((AI_LINE_EN if en else AI_LINE_ES).format(business=business))
    if recording:
        parts.append((REC_LINE_EN if en else REC_LINE_ES).format(
            business=business, privacy_url=privacy_url))
    return " ".join(parts)


def objects_to_recording(text: str, lang: str = "es") -> bool:
    """Did the caller refuse the recording? PURE, so the rail can check it without a database.

    Deliberately narrow. A wide matcher here would stop recordings on sentences that were never a
    refusal, and the failure mode of a false positive (an order with no record of what was agreed)
    is worse for the customer than the failure mode of a false negative (they say it again, and a
    human hears it)."""
    t = " " + (text or "").strip().lower() + " "
    words = OBJECTION_EN if str(lang).lower().startswith("en") else OBJECTION_ES
    return any(w in t for w in words)


def marks_synthetic_audio() -> dict[str, str]:
    """Art. 50(2) — synthetic AUDIO must be machine-readable-marked as artificially generated.

    NOT YET IMPLEMENTED, and stated as a gap rather than stubbed into looking done. The obligation
    is real (the Commission's guidelines put speech squarely in scope: «Audio… may cover speech»),
    and the transitional Art. 111(4) inserted by Reg. (UE) 2026/1744 gives systems on the market
    before 2 Aug 2026 until **2 December 2026** to comply. Art. 50(1) — the spoken disclosure above
    — got no such window, which is why that half ships today and this half is dated.

    Transcription is exempt: the guidelines list «transcriptions of conversations» among the
    standard-editing carve-outs. So the STT half of the product carries no marking duty at all.
    """
    return {"status": "not_implemented", "due": "2026-12-02",
            "scope": "TTS output only — transcription is exempt"}


async def call_posture(tenant: str, *, now=None) -> dict:
    """Does Rocoto SPEAK on this call, and what must the caller be told?

    ONE RESOLVER, so the answer cannot differ between the rail that decides and the rail that
    announces. Returns {speaking, recording, mode, reason} — `reason` exists because «why did a
    machine answer my phone at 21:40» is a question a supplier will eventually ask, and the honest
    answer must be reconstructable from a log rather than re-derived by hand.

    `after_hours` is resolved against the tenant's OWN receiving hours (`window`), not a constant:
    a wholesaler who takes orders from 05:00 has a different night from a restaurant supplier who
    starts at 09:00, and a hardcoded «after 18:00» would have Rocoto answering calls the owner is
    sitting right next to.

    Fail-soft to LISTENING. Every failure mode here — no settings row, no hours configured, a
    database hiccup — resolves to «a human answers», because the wrong direction of this error is
    a machine speaking to somebody's customer without the supplier having chosen it."""
    import behaviour
    mode = "listen"
    try:
        mode = (await behaviour.get(tenant)).get("calls", "listen")
    except Exception:
        pass

    speaking = False
    reason = "listen: a person answers, Rocoto only listens"
    if mode == "always":
        speaking, reason = True, "always: the supplier has Rocoto answering every call"
    elif mode == "after_hours":
        open_now = await _within_hours(tenant, now=now)
        if open_now is None:
            # HOURS NOT SET is not «night». A supplier who chose after_hours without telling us
            # when their hours are has not chosen for a machine to answer at 11:00 on a Tuesday,
            # and guessing would put a robot in front of a customer the owner is standing next to.
            speaking, reason = False, "after_hours: no hours configured, so a person answers"
        else:
            speaking = not open_now
            reason = ("after_hours: outside their hours, so nobody is there to pick up"
                      if speaking else "after_hours: inside their hours, so a person answers")

    return {"speaking": speaking, "recording": bool(config.CALL_RECORDING_ENABLED),
            "mode": mode, "reason": reason}


# The supplier's own opening hours, which decide what «after hours» means for THEM. A wholesaler
# who takes orders from 05:00 has a different night from one who starts at 09:00, and this is the
# whole reason `after_hours` cannot be a constant.
#
# Stored on the tenant's settings row rather than as a new table: it is one small, per-tenant
# preference read on a cold path, which is exactly what `settings` is for.
#   {"tz": "Europe/Madrid", "days": {"mon": ["08:00","18:00"], …}}   — a missing day is CLOSED.
HOURS_SETTING_KEY = "call_hours"

_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def parse_hours(raw: dict) -> dict:
    """Validate + normalise a `call_hours` value. THE WRITER'S HALF OF THE READER BELOW.

    `_within_hours` has read this key since it was written and nothing ever wrote it, so
    `after_hours` resolved to «no hours configured, so a person answers» on every call and the
    middle position of the switch could never fire. A setting with a reader and no writer is a
    setting that does not exist.

    Shape: {"tz": "Europe/Madrid", "days": {"mon": ["08:00", "18:00"], …}}. A day that is ABSENT is
    closed — that is a real answer, and it is why this cannot merge silently into whatever was
    there before: dropping a day must be able to CLOSE it.

    Raises ValueError with a specific message; the endpoint turns that into a 400. Times are
    half-open [open, close) — closing time is closed — matching `_within_hours`."""
    if not isinstance(raw, dict):
        raise ValueError("call_hours must be an object")
    tz = str(raw.get("tz") or "Europe/Madrid").strip()
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz)
    except Exception:
        raise ValueError(f"unknown timezone {tz!r}")
    days_in = raw.get("days")
    if not isinstance(days_in, dict) or not days_in:
        raise ValueError("call_hours.days must name at least one day")
    days: dict = {}
    for k, v in days_in.items():
        d = str(k).strip().lower()[:3]
        if d not in _DAYS:
            raise ValueError(f"unknown day {k!r}")
        if not (isinstance(v, (list, tuple)) and len(v) == 2):
            raise ValueError(f"{d}: expected [open, close]")
        pair = []
        for t in v:
            t = str(t).strip()
            try:
                hh, mm = t.split(":")
                hh, mm = int(hh), int(mm)
                assert 0 <= hh <= 23 and 0 <= mm <= 59
            except Exception:
                raise ValueError(f"{d}: {t!r} is not HH:MM")
            pair.append(f"{hh:02d}:{mm:02d}")
        if pair[0] >= pair[1]:
            # An overnight span would need two windows and nobody in this trade takes orders
            # across midnight; saying so beats silently accepting a range that is always closed.
            raise ValueError(f"{d}: opening {pair[0]} is not before closing {pair[1]}")
        days[d] = pair
    return {"tz": tz, "days": days}
_DOW = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


async def _within_hours(tenant: str, *, now=None) -> "bool | None":
    """True inside their hours, False outside, **None when they have not told us** — and that third
    state is the point. Collapsing «unknown» into either answer is what would make a machine speak
    at the wrong moment or stay silent at the right one."""
    from datetime import datetime, timezone

    import db
    try:
        st = await db.settings_get(f"orders:{tenant}") or {}
    except Exception:
        return None
    hours = st.get(HOURS_SETTING_KEY) or {}
    days = hours.get("days") or {}
    if not days:
        return None

    when = now or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        when = when.astimezone(ZoneInfo(hours.get("tz") or "Europe/Madrid"))
    except Exception:
        pass                      # UTC is wrong by an hour or two, never wrong by a day

    span = days.get(_DOW[when.weekday()])
    if not span or len(span) != 2:
        return False              # a day with no hours is CLOSED, which is a real answer
    try:
        o_h, o_m = (int(x) for x in str(span[0]).split(":"))
        c_h, c_m = (int(x) for x in str(span[1]).split(":"))
    except (ValueError, AttributeError):
        return None
    mins = when.hour * 60 + when.minute
    return (o_h * 60 + o_m) <= mins < (c_h * 60 + c_m)
