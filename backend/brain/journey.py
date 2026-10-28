"""brain/journey.py — the account's journey as a fold of the event spine (THE-JOURNEY-CANON §1).

THE ONE DESIGN DECISION, AND IT REMOVES A TABLE RATHER THAN ADDING ONE.
THE-WIRING-INDEX §7's first NEEDS-CONTRACT is that the journey's events «assert a shared ledger and
pure folds… but nothing states that the journey's events live in the same store», and it states its
own resolution: «**Resolve this by pointing `JourneyPorts` at F2's store rather than by writing a
second one.**» This runtime already HAS that store. `event` (schema_runtime.sql) is append-only,
scope-keyed by ltree so `t.<slug>` IS the house, with a jsonb payload, an `actor`, a `dedupe_key` for
idempotent append, `caused_by` for the §3 lineage chain, and `lineage ∈ live|test` — which is
§27.14's test taint already enforced at the row rather than inferred. So the journey's events are
`type='activation.<kind>'` on the spine at the tenant scope, appended through `spine.append_event`.

THE JOURNEY LEDGER ADDS NO TABLE. Nothing about the journey is a stored flag: `status_of` and
`step_of` are pure folds of the list, exactly as the canon requires («derived, never stored», §1.0),
and a test can put an account in any state by appending events.

THE VOCABULARY IS THE KIT'S TWELVE, NOT THE CANON'S TEN.
`app/src/prototypes/cedar/activation.ts` carries `ActivationKind` with `guided` and `tested` beside the
canon's ten — which is INDEX §7's «Steps 7, 8 and 9 have no exit events» already closed on the kit
side. The runtime matches the KIT, because the kit is the contract the fold has to agree with: two
lists would mean the card said one thing and the server another, and nobody would see it until a
person was stuck on a step the server thought they had finished.

WHAT IS DELIBERATELY ABSENT HERE:
  · `sector` — the kit's events carry one because the design build seeds THREE houses in one
    browser. The runtime's houses are tenants, and the scope already says which. A sector field
    server-side would be a second, weaker answer to a question the scope has already answered.
  · the grants — two of the ten steps (`organisation`, `month`) are done off the GRANTS store rather
    than the ledger, and that store is still browser-local (`BANK 702, 901–905`; the plan's W4 moves
    it). So `step_of` TAKES those counts rather than reaching for them, which is the kit's own law
    for the same fold: «Pure: it takes what it reads rather than reaching for it, so the same fold
    answers a render, a drive and — when the backend lands — a request.» Absent, those steps are
    folded off the `org` events instead, against §2.2's four named fields.
  · a status column. Adding one would make «what is this account» answerable two ways, and the
    canon's whole §1.0 exists to prevent exactly that.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Iterable, Optional

import asyncpg

import spine

log = logging.getLogger("rocoto.journey")

# ── THE TWELVE (canon §1.3, as the kit's `ActivationKind` extends it) ────────────────────────────
KINDS: tuple[str, ...] = (
    "invite",             # Peter mints a claim link for one address at one house
    "claim",              # the address is proven and a session exists
    "org",                # one organisation question, answered
    "whatsapp-connect",   # a number is bound and warming
    "share",              # the provider link was sent
    "upload",             # a file was accepted
    "processed",          # Peter's manual mark, after his own regression
    "open-return",        # they came back and read the reveal
    "guided",             # the first steps ran to their end
    "tested",             # a roleplay test was completed
    "turn-on",            # a named cohort went live
    "expand",             # the whole book went live (§82.7)
)

# THREE OF THE TWELVE ARE SOMEBODY ELSE'S ACT, AND THAT IS THE DESIGN (canon §1.1). `invite` and
# `processed` are Peter's; every other transition is the customer's own press. Stated as data so a
# route can refuse rather than trusting its caller to remember — «§91.4.5's manual mark is the
# load-bearing one: a status that could advance itself would be a claim the product cannot make.»
FOUNDER_KINDS: frozenset[str] = frozenset({"invite", "processed"})

# The provider link's own actor (canon §1.3: `upload` may be `by: 'provider'`).
ACTORS: frozenset[str] = frozenset({"founder", "customer", "provider"})

TYPE_PREFIX = "activation."

# The four fields `OrgPort.write` names, one per call (canon §2.2). They are the DENOMINATOR of the
# organisation step whenever the grants store has not answered for it.
ORG_FIELDS: tuple[str, ...] = ("legalName", "taxId", "fiscalAddress", "billingAddress")

# The kit's `CONSEQUENTIAL` (activation.ts) — four grants, and the month step's denominator. Read
# here so the two sides cannot drift; the fifth (tone) is absent on purpose in the kit and so here.
CONSEQUENTIAL_TOTAL = 4

# The cohort's ceiling (§91.4.10 · §82.2 · the kit's `COHORT_CAP`). Stated once so the surface, the
# metric and the guard cannot disagree.
COHORT_CAP = 10

# The seven statuses and the ten steps, in their canonical order.
STATUSES: tuple[str, ...] = (
    "invited", "claimed", "processing", "ready", "testing", "bounded", "whole")
STEPS: tuple[str, ...] = (
    "claim", "organisation", "whatsapp", "data", "processing",
    "return", "first-steps", "roleplay", "month", "live")

# The optional fields an event may carry, exactly the kit's `ActivationEvent`. `house` is the one
# addition, and only `invite` uses it: the canon's own `invite {address, house}` names the house on
# the link, and at invite time there is no tenant row to read it off.
PAYLOAD_FIELDS: tuple[str, ...] = (
    "field", "value", "customer", "ambiguity", "cold", "customers", "house")


def scope_of(tenant: str) -> str:
    """The house's own scope. One helper so no call site spells a scope (tenancy.py's law)."""
    return spine.scope_tenant(tenant)


async def append(
    con: asyncpg.Connection,
    tenant: str,
    kind: str,
    *,
    by: str = "customer",
    actor: str = "",
    at: Optional[datetime] = None,
    dedupe_key: Optional[str] = None,
    caused_by: Optional[int] = None,
    source: str = "app",
    **fields: Any,
) -> tuple[int, bool]:
    """Append one journey event to the house's ledger. Returns `(event_id, is_new)`.

    `at` OVERRIDES THE CLOCK and has exactly one legitimate caller in this rail: the claim, which
    mirrors the `invite` onto the house's own ledger carrying the hour Peter actually minted it. The
    invite happened before the house existed, so its row cannot have been written then — and
    stamping it «now» would tell the fold that Peter invited them at the same second they claimed,
    which is the one fact the claim page exists to display («Invited by Peter · 27 August»).

    `dedupe_key` makes an append idempotent, which matters most for the acts a person can double-
    press: `processed`, `turn-on`, `open-return`. A caller that passes one gets the existing row
    back with `is_new=False` rather than a second event the fold would count twice.
    """
    k = (kind or "").strip()
    if k not in KINDS:
        raise ValueError(f"journey: {k!r} is not one of the twelve kinds")
    who = (by or "customer").strip()
    if who not in ACTORS:
        raise ValueError(f"journey: {who!r} is not one of {sorted(ACTORS)}")
    if k in FOUNDER_KINDS and who != "founder":
        # NOT a style check. `invite` and `processed` are Peter's acts (canon §1.1), and an account
        # that could mark itself processed would advance its own status — the exact claim §91.4.5
        # says the product cannot make.
        raise ValueError(f"journey: {k!r} is the founder's act, never {who!r}'s")

    payload: dict[str, Any] = {"by": who}
    for f in PAYLOAD_FIELDS:
        v = fields.get(f)
        if v is None or v == "" or v is False:
            continue
        if f == "customers":
            # bounded at the ceiling on the way IN, so a fold never has to trust the caller.
            v = list(v)[:COHORT_CAP]
        payload[f] = v

    return await spine.append_event(
        con, scope_of(tenant), f"{TYPE_PREFIX}{k}", source=source, payload=payload,
        caused_by=caused_by, lane="world", dedupe_key=dedupe_key,
        actor=actor or who, ts=at)


async def events(con: asyncpg.Connection, tenant: str, *,
                 lineage: str = "live") -> list[dict[str, Any]]:
    """The house's journey ledger, oldest first, in the kit's `ActivationEvent` shape.

    `lineage='live'` by default because a test-lineage row must never move a real account's status —
    that is §27.14 read at the fold rather than at the writer. Pass `lineage=''` to read both, which
    is what a test harness wants and nothing else does.
    """
    sql = ("select id, ts, type, payload from event "
           "where scope = $1::ltree and type like $2 ")
    args: list[Any] = [scope_of(tenant), f"{TYPE_PREFIX}%"]
    if lineage:
        sql += "and lineage = $3 "
        args.append(lineage)
    sql += "order by id asc"
    rows = await con.fetch(sql, *args)
    out: list[dict[str, Any]] = []
    for r in rows:
        p = dict(r["payload"] or {})
        e: dict[str, Any] = {
            "id": str(r["id"]),
            "kind": (r["type"] or "")[len(TYPE_PREFIX):],
            "at": r["ts"].isoformat() if r["ts"] else "",
            "by": p.get("by") or "customer",
        }
        for f in PAYLOAD_FIELDS:
            if p.get(f) is not None:
                e[f] = p[f]
        out.append(e)
    return out


# ═══ THE FOLDS — pure, and the same shape the kit folds ═══════════════════════════════════════════

def _last(events_: Iterable[dict[str, Any]], kind: str) -> Optional[dict[str, Any]]:
    """The furthest event of a kind. Read backwards, because a status is «what is true now» and the
    last thing that happened is what makes it true."""
    found = None
    for e in events_:
        if e.get("kind") == kind:
            found = e
    return found


def _has(events_: Iterable[dict[str, Any]], kind: str) -> bool:
    return _last(events_, kind) is not None


def status_of(events_: list[dict[str, Any]]) -> str:
    """THE ACCOUNT'S STATUS, FOLDED (canon §1.1) — the coarse thing every other system reads.

    Byte-for-byte the kit's `statusOf` order, and the empty list answers `invited`: a house whose
    ledger holds nothing has a link minted and nobody has used it, which is precisely what `invited`
    means. That base case is why an unclaimed invite needs no row of its own to have a status.

    The kit also folds an IMPORT event as evidence of an upload, because `BringYourHistory` is the
    door a person actually drops a file into. Server-side there is no second door: the intake rail
    (the plan's W5) appends a real `upload`, so this fold reads one vocabulary.
    """
    if _has(events_, "expand"):
        return "whole"
    if _has(events_, "turn-on"):
        return "bounded"
    if _has(events_, "open-return"):
        return "testing"
    if _has(events_, "processed"):
        return "ready"
    if _has(events_, "upload"):
        return "processing"
    if _has(events_, "claim"):
        return "claimed"
    return "invited"


def steps_of(
    events_: list[dict[str, Any]],
    *,
    org_answered: Optional[int] = None,
    org_total: Optional[int] = None,
    consequential: Optional[int] = None,
) -> list[dict[str, Any]]:
    """The ten steps with their `done`, in order. `[{id, done, at, words?}]`.

    TWO OF THE TEN ARE NOT IN THIS LEDGER, and saying so is the honest part. `organisation` and
    `month` are done off the GRANTS store (`activation.ts`: `orgDone`, `consequential >=
    CONSEQUENTIAL.length`), which is still browser-local until the plan's W4 moves it. So both
    counts are ARGUMENTS. Given, they decide. Absent, `organisation` falls back to the `org` events
    against §2.2's four named fields — the writes ARE the record — and `month` reads not-done rather
    than guessing, because a step nothing can count is a step nobody should be told they finished.
    """
    claimed = _last(events_, "claim")
    whatsapp = _last(events_, "whatsapp-connect")
    uploaded = _last(events_, "upload")
    processed = _last(events_, "processed")
    returned = _last(events_, "open-return")
    guided = _last(events_, "guided")
    tested = _last(events_, "tested")
    cohort = _last(events_, "turn-on")

    if org_answered is None or org_total is None:
        answered_fields = {e.get("field") for e in events_
                           if e.get("kind") == "org" and e.get("field")}
        org_answered = len(answered_fields & set(ORG_FIELDS))
        org_total = len(ORG_FIELDS)
    org_done = org_total > 0 and org_answered >= org_total

    cons = consequential if consequential is not None else 0

    def row(sid: str, ev: Optional[dict[str, Any]], done: Optional[bool] = None,
            words: str = "") -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": sid,
            "done": bool(ev) if done is None else bool(done),
            "at": (ev or {}).get("at", ""),
        }
        if words:
            out["words"] = words
        return out

    return [
        row("claim", claimed),
        row("organisation", None, org_done, f"{org_answered} of {org_total} answered."),
        row("whatsapp", whatsapp),
        row("data", uploaded),
        row("processing", processed),
        row("return", returned),
        row("first-steps", guided),
        row("roleplay", tested),
        row("month", None, cons >= CONSEQUENTIAL_TOTAL,
            f"{cons} of {CONSEQUENTIAL_TOTAL} answered."),
        row("live", cohort,
            words=(f"{len(cohort.get('customers') or [])} of {COHORT_CAP} live."
                   if cohort else "")),
    ]


def step_of(events_: list[dict[str, Any]], **counts: Any) -> Optional[str]:
    """THE CARD'S POINTER (canon §1.0) — the first step whose exit event has yet to happen, or None
    when the journey is behind them. Nothing is stored; leaving halfway and coming back lands on the
    same step because the events say so (§1.4, the resume law)."""
    for s in steps_of(events_, **counts):
        if not s["done"]:
            return str(s["id"])
    return None


async def state_of(con: asyncpg.Connection, tenant: str, **counts: Any) -> dict[str, Any]:
    """The whole reading for one house — what a surface asks for in one call.

    `{status, step, steps[], events[]}`. The events ride along because the canon's own demonstration
    is that a client can fold them itself; handing the fold's INPUT with its OUTPUT is what makes
    «derived, never stored» checkable from outside rather than promised.
    """
    evs = await events(con, tenant)
    return {
        "tenant": tenant,
        "status": status_of(evs),
        "step": step_of(evs, **counts),
        "steps": steps_of(evs, **counts),
        "events": evs,
    }
