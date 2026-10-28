"""PARSEWISE, PORTED WHOLE — a table becomes rows (FEED-IA §196.5).

Peter: «maybe use parsewise so its solid cos like im not sure that for the tabular data if claude
ocr will be best. how do u set it to recognise standard formats and stuff?»

THE-PARSING-SPEC §PAR-02 answers that question and §PAR-06 proves the answer against the live API.
This module is that proof turned into a service, step for step:

    project → upload → DIMENSION → one agent per column → launch → wait → results → DELETE

§PAR-02.3 is the whole trick and the reason this file is not four lines of `POST /extract/`: a
Parsewise agent produces ONE value per project unless it carries a dimension. The convenience
endpoint with `auto_map` folded a four-line albarán into a single row whose every column was four
values concatenated — a reader built on it would have silently dropped three quarters of a delivery
note. A dynamic `Line` dimension on the six column agents returns four lines instead, each value
citing its page. That difference is the entire configuration.

Nothing here retains anything: §PAR-03.6 · SRC-PRIV-07 — the project is deleted once the rows are
shaped, and the deletion is REPORTED, never assumed. The document goes with it: a project holds one
read's document, so deleting the project deletes the customer's paper from the provider.

THE READ REPORTS THE PROVIDER'S OWN TIME (§PAR-10, E195.11). The steps that do not depend on each
other are issued together, and the wait asks often enough that the answer lands within seconds of
the provider finishing. §PAR-03.3's done-definition is untouched — `pipeline_running=false` AND
every agent `Processed` or `No Result`.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

import httpx

from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.parsewise")

# ── THE THREE STANDARD FORMATS ──────────────────────────────────────────────────────────────
# `PARSE_FIELDS` in the kit's parsing.ts names the same columns. Both halves read one list so a
# column cannot exist on one side only. Every instruction below is load-bearing: Parsewise's own
# guidance is «describe the value first, then where to find it», «specify the output format
# explicitly», «call out what NOT to extract» — hence the comma-decimal rule and «ignore totals».

LINE_DIMENSION = {
    "albaran": {
        "name": "Line",
        "description": (
            "One instance per goods line in the delivery-note table. Each printed table row is one "
            "line; totals, taxes and carriage rows are not lines."
        ),
        "example_values": "Merluza grande, Pulpo cocido, Gamba roja",
        "value_type": "string",
    },
    "catalogue": {
        "name": "Line",
        "description": (
            "One instance per product row in the price list. Each printed row is one line; section "
            "headings, page footers and totals are not lines."
        ),
        "example_values": "Merluza grande, Pulpo cocido, Gamba roja",
        "value_type": "string",
    },
    "stock": {
        "name": "Line",
        "description": (
            "One instance per counted row in the stock sheet. Each printed row is one line; totals "
            "and summary rows are not lines."
        ),
        "example_values": "Merluza grande, Pulpo cocido, Gamba roja",
        "value_type": "string",
    },
}

# THE ORDER OF THE LINES IS A FACT ON THE PAGE, AND IT IS EXTRACTED LIKE ANY OTHER FACT.
# Parsewise returns its result rows in no particular order and offers no reading order —
# `all_dimension_values.Line` comes back ALPHABETICAL (measured, THE-RUNTIME-SPEC §RUN-04.2). A
# person checking a delivery note reads down the paper, so a proposal that reorders their lines is
# a proposal they have to re-sort by hand. So the position is asked for: one more agent, on the same
# dimension, and the rows are sorted by what it says. It is deliberately NOT one of the document's
# `columns` — it is where the line stands, not something the line states.
ORDER_AGENT = ("Line number", "number", None,
               "The position of this goods line in the printed table, counting the first goods line "
               "under the column headings as 1 and going down. Header rows, totals, taxes and "
               "carriage rows are not counted.")

# (agent name, value_type, unit, extraction_instructions) — the column agents, which CARRY the
# dimension. Order is the order the kit shows in `columns`.
LINE_AGENTS: dict[str, list[tuple[str, str, str | None, str]]] = {
    "albaran": [
        ("Product code", "string", None,
         "The product code or SKU printed at the start of this goods line, exactly as printed. Return an empty value when the line has no code. Ignore totals, tax and carriage rows."),
        ("Product name", "string", None,
         "The product name printed on this goods line, exactly as printed, without the code and without the quantity."),
        ("Quantity", "number", None,
         'The quantity on this goods line as a number. A comma decimal separator means a decimal point: "12,5" is 12.5. Return the number alone, without the unit.'),
        ("Unit", "string", None,
         "The unit the quantity on this goods line is stated in, exactly as printed (for example kg, caja, ud, manojo). Return the unit alone."),
        ("Unit price (EUR)", "number", "EUR",
         "The price of ONE unit on this goods line as a number, without a currency symbol and without thousands separators. A comma decimal separator means a decimal point. Do not return the line total."),
        ("Lot", "string", None,
         "The lot or batch identifier printed on this goods line, exactly as printed. Return an empty value when the line states none."),
    ],
    "catalogue": [
        ("SKU", "string", None,
         "The product code or SKU printed on this product row, exactly as printed. Return an empty value when the row has no code."),
        ("Product name", "string", None,
         "The product name printed on this product row, exactly as printed, without the code and without the price."),
        ("Unit", "string", None,
         "The unit this product is priced by, exactly as printed (for example kg, caja, ud, manojo). Return the unit alone."),
        ("Unit price (EUR)", "number", "EUR",
         "The price of ONE unit of this product as a number, without a currency symbol. A comma decimal separator means a decimal point."),
    ],
    "stock": [
        ("Product name", "string", None,
         "The product name printed on this stock row, exactly as printed, without the quantity."),
        ("Quantity", "number", None,
         'The counted quantity on this stock row as a number. A comma decimal separator means a decimal point: "12,5" is 12.5. Return the number alone, without the unit.'),
        ("Unit", "string", None,
         "The unit the quantity on this stock row is stated in, exactly as printed (for example kg, caja, ud, manojo)."),
        ("Lot", "string", None,
         "The lot or batch identifier printed on this stock row, exactly as printed. Return an empty value when the row states none."),
        ("Date", "string", None,
         "The date printed on this stock row, as ISO 8601 YYYY-MM-DD. Return an empty value when the row states none."),
    ],
}

# The header facts. These carry NO dimension: they are one value for the whole page (§PAR-02.3).
HEADER_AGENTS: dict[str, list[tuple[str, str, str | None, str]]] = {
    "albaran": [
        ("Document number", "string", None, "The delivery-note number printed on the page, exactly as printed."),
        ("Document date", "string", None, "The delivery date printed on the page, as ISO 8601 YYYY-MM-DD."),
        ("Counterparty", "string", None, "The customer or supplier the document is addressed to."),
    ],
    "catalogue": [
        ("Document date", "string", None, "The date the price list is valid from, as ISO 8601 YYYY-MM-DD."),
        ("Counterparty", "string", None, "The supplier whose price list this is."),
    ],
    "stock": [
        ("Document date", "string", None, "The date of the stock count, as ISO 8601 YYYY-MM-DD."),
    ],
}

# The names the kit's ParsedRow fields are filled from, per kind.
NAME_AGENT = {"albaran": "Product name", "catalogue": "Product name", "stock": "Product name"}
CODE_AGENT = {"albaran": "Product code", "catalogue": "SKU", "stock": None}
QTY_AGENT = {"albaran": "Quantity", "catalogue": None, "stock": "Quantity"}
PRICE_AGENT = {"albaran": "Unit price (EUR)", "catalogue": "Unit price (EUR)", "stock": None}

# §PAR-03.4 — the resolution ladder. `Resolved` stands; «requires attention» stands and is counted
# against confidence; everything else leaves the field EMPTY. A guessed field is worse than none.
# A DATE IS A DAY OR IT IS NOTHING (§PAR-02.1 · E200.08). The agent is instructed to answer
# ISO 8601; anything else is left unstated rather than reshaped by this file.
ISO_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")

STANDING = {"resolved", "requires attention"}
CONFIDENT = {"resolved"}

# ── HOW OFTEN THE WAIT ASKS, AND WHAT IT ASKS (§PAR-10 · E195.11) ───────────────────────────────
# The done-definition below does not move; what moved is how often it is ASKED and which endpoint
# carries the frequent question. Measured on the box on 2026-09-04, live reads polled every 2 s: the
# provider finished at 56.7 … 119.8 s. The ladder that used to ask — 5 s growing ×1.4 to a 25 s cap
# — put its rungs at 5, 12, 22, 36, 55, 80, 105, 130, 155 s, so a read that finished at 82 s was
# reported at 105 s and the day's journal reads landed on exactly those rungs (67 reads, p50
# 111.0 s, max 214.3 s). The distance was the ladder. At a 4 s cap the answer stands within 4 s of
# the provider's own finish.
POLL_FIRST = 1.5
POLL_GROWTH = 1.25
POLL_CAP = 4.0

# THE FREQUENT QUESTION GOES TO THE ENDPOINT BUILT FOR IT. Parsewise's schema describes
# `GET /projects/{id}/status/` as «Compact processing status for a project, intended for frequent
# polling (for example, every 5 seconds)» and `GET /projects/{id}/agents/status/` as «More expensive
# than GET /projects/{project_id}/status/; we recommend polling this endpoint only while
# `pipeline_running` is true». So the compact one is asked every rung as a GATE, and the two calls
# that carry §PAR-03.3's predicate are asked when it says the pipeline has gone quiet.
#
# THE GATE MAY DELAY THE QUESTION, NEVER ANSWER IT. Every GATE_EVERY-th rung asks the full pair
# whatever the gate said, so a gate that lagged or stuck could cost a read at most GATE_EVERY rungs
# (~20 s) and could never hold one open. Measured over 439 paired polls on the box — both GETs in
# one `asyncio.gather`, the order alternating per poll — the two endpoints agreed on
# `pipeline_running` every single time, and the compact one answered in 85 ms against 135 ms and in
# 116 bytes against 4 803 (§PAR-10.3).
GATE_EVERY = 5


def _headers(json_body: bool = False) -> dict[str, str]:
    if not settings.parsewise_key:
        raise RuntimeError_("parsewise_missing", "Parsewise is not configured on this runtime.", 503)
    head = {"X-API-Key": settings.parsewise_key}
    if json_body:
        head["Content-Type"] = "application/json"
    return head


async def _post(client: httpx.AsyncClient, path: str, **kwargs: Any) -> httpx.Response:
    response = await client.post(f"{settings.parsewise_base}{path}", **kwargs)
    if response.status_code >= 400:
        raise RuntimeError_("parsewise_failed", f"Parsewise answered {response.status_code} on {path}.", 502)
    return response


async def parse_document(content: bytes, filename: str, content_type: str, kind: str) -> dict[str, Any]:
    """Read one document and return the kit's `ParseResult`. Deletes the project on the way out."""
    started = time.time()
    shaped = shape(await read_raw(content, filename, content_type, kind), kind)
    logger.info("parsewise read", extra={"provider": "parsewise", "kind": kind,
                                         "ms": int((time.time() - started) * 1000),
                                         "outcome": f"{len(shaped['rows'])} rows"})
    return shaped


async def read_raw(content: bytes, filename: str, content_type: str, kind: str) -> dict[str, Any]:
    """The provider half on its own: the results body EXACTLY as Parsewise returned it.

    Split out so a read can be RECORDED as it arrived (§PAR-08 · §PAR-09). `/api/parse` answers the
    shaped `ParseResult`, so a degraded read that broke the shaping cannot be replayed from the
    endpoint's own answer; `tests/record_degraded_reads.py` calls this, writes the body into
    `tests/fixtures/`, and the suite then holds both fixes with no live call and no key.
    """
    if kind not in LINE_AGENTS:
        raise RuntimeError_("bad_kind", f"«{kind}» is not one of albaran, catalogue, stock.", 400)
    started = time.time()
    project_id = ""
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, read=300.0)) as client:
        try:
            project = await _post(client, "/projects/", headers=_headers(True),
                                  json={"name": f"Rocoto kit · {kind} · {int(started)}"})
            project_id = project.json()["id"]
            logger.info("parsewise project opened", extra={"provider": "parsewise", "kind": kind})

            # The document and the dimension know nothing about each other, so they go together.
            # Measured on the box: the whole setup falls from 2.93 s to 1.60 s (E195.11).
            _, dimension = await asyncio.gather(
                _post(client, f"/projects/{project_id}/documents/", headers=_headers(),
                      files=[("files", (filename or "source", content, content_type or "application/octet-stream"))]),
                _post(client, f"/projects/{project_id}/dimensions/", headers=_headers(True),
                      json=LINE_DIMENSION[kind]),
            )
            dimension_id = dimension.json()["id"]

            bodies: list[dict[str, Any]] = []
            for name, value_type, unit, task in [*LINE_AGENTS[kind], ORDER_AGENT]:
                body: dict[str, Any] = {
                    "name": name, "value_type": value_type, "extraction_instructions": task,
                    "dimensions": [{"dimension_id": dimension_id, "are_values_dynamic": True}],
                }
                if unit:
                    body["unit"] = unit
                bodies.append(body)
            for name, value_type, unit, task in HEADER_AGENTS[kind]:
                body = {"name": name, "value_type": value_type, "extraction_instructions": task}
                if unit:
                    body["unit"] = unit
                bodies.append(body)
            # Ten POSTs that each stand alone. The provider offers no bulk create (its own schema
            # documents `POST /agents/` as one agent per call), so they go at once instead of in a
            # queue. Creation order carries nothing: the shaping keys on the agent's NAME and
            # `columns` is read off this file, never off the provider's listing.
            await asyncio.gather(*[
                _post(client, f"/projects/{project_id}/agents/", headers=_headers(True), json=body)
                for body in bodies
            ])

            await _post(client, f"/projects/{project_id}/agents/launch/", headers=_headers(True))
            waited, polls = await _wait(client, project_id, started)
            logger.info("parsewise waited", extra={"provider": "parsewise", "kind": kind,
                                                   "ms": int(waited * 1000),
                                                   "outcome": f"{polls} polls"})

            results = await client.get(f"{settings.parsewise_base}/projects/{project_id}/results/",
                                       headers=_headers(), params={"page_size": 500})
            if results.status_code >= 400:
                raise RuntimeError_("parsewise_failed", f"Parsewise answered {results.status_code} for the results.", 502)
            body = results.json()
        finally:
            deleted = await _delete(client, project_id)
    if not deleted:
        # The project outlived the read. Say so in the journal; the kit is told nothing it
        # cannot act on, and an id that may vanish is not evidence (§PAR-03.5).
        logger.warning("parsewise project retained", extra={"provider": "parsewise", "outcome": "retained"})
    return body


async def _wait(client: httpx.AsyncClient, project_id: str, started: float) -> tuple[float, int]:
    """§PAR-03.3 — «done» is `pipeline_running=false` AND every agent Processed or No Result.

    Parsewise's own FAQ is explicit that `pipeline_running=false` alone also happens on a cancelled
    or failed run, so the flag alone would report a silent failure as a finished read.

    THREE CALLS, AND ONLY ONE OF THEM IS ASKED OFTEN.

      1 · THE GATE — `GET /projects/{id}/status/`, the compact endpoint Parsewise documents as
          «intended for frequent polling (for example, every 5 seconds)». It carries
          `pipeline_running` and it is asked EVERY rung. It decides nothing: it only says whether
          the other two are worth asking yet. Every GATE_EVERY-th rung asks them anyway, so a gate
          that lagged, stuck or started answering 500 costs a read rungs, never the read itself.
      2 · `GET /agents/` — the first half of the predicate. Each agent carries its own
          `extraction_status`, the provider's words: «so you do not need an additional request to
          know whether it has finished extracting». A fresh agent is `Pending` (the enum is
          Pending · Processed · No Result), so an agent cannot read done before it has run.
      3 · `GET /agents/status/` — the second half, and the one the provider calls «more expensive…
          we recommend polling this endpoint only while `pipeline_running` is true».

    THE PREDICATE THAT RETURNS IS THE SAME PREDICATE. Both halves are read fresh, in this order,
    and both must agree before the wait ends. A read finishes on the rung after the provider does,
    which at a 4 s cap is within 4 s of its finish.

    Returns the seconds waited and the number of polls, so the journal can state both.
    """
    budget = settings.parsewise_budget_seconds
    delay = POLL_FIRST
    polls = 0
    while time.time() - started < budget:
        await asyncio.sleep(delay)
        delay = min(delay * POLL_GROWTH, POLL_CAP)
        polls += 1
        gate = await client.get(f"{settings.parsewise_base}/projects/{project_id}/status/", headers=_headers())
        if gate.status_code < 400 and gate.json().get("pipeline_running") and polls % GATE_EVERY:
            continue
        agents = await client.get(f"{settings.parsewise_base}/projects/{project_id}/agents/", headers=_headers())
        if agents.status_code >= 400:
            continue
        rows = agents.json()
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        states = [r.get("extraction_status") for r in rows] if isinstance(rows, list) else []
        if not states or not all(s in ("Processed", "No Result") for s in states):
            continue
        status = await client.get(f"{settings.parsewise_base}/projects/{project_id}/agents/status/", headers=_headers())
        if status.status_code >= 400:
            continue
        if not status.json().get("pipeline_running"):
            return time.time() - started, polls
    raise RuntimeError_("parsewise_timeout", f"Parsewise did not finish within {int(budget)}s.", 504)


async def _delete(client: httpx.AsyncClient, project_id: str) -> bool:
    """§PAR-03.6 — the source does not live at the provider. Reported, never assumed."""
    if not project_id:
        return False
    try:
        response = await client.delete(f"{settings.parsewise_base}/projects/{project_id}/", headers=_headers())
        ok = response.status_code < 400
    except Exception as exc:  # a failed deletion is a fact to log, never a failed read
        logger.warning("parsewise project NOT deleted: %s", exc, extra={"provider": "parsewise", "outcome": "retained"})
        return False
    logger.info("parsewise project deleted" if ok else "parsewise project NOT deleted",
                extra={"provider": "parsewise", "outcome": "deleted" if ok else f"retained_{response.status_code}"})
    return ok


# ── ONE PRINTED LINE, HOWEVER MANY WAYS THE PROVIDER LABELLED IT (§PAR-02.3a · §PAR-09) ─────────
# A dynamic dimension discovers its instance labels PER AGENT. The same four-line albarán can come
# back keyed twice — one agent by product code, another by product name — and a join on the label
# alone then hands a person EIGHT rows for a four-line note: four carrying the goods and four
# carrying a label. Measured live on `dirt-05` (§PAR-08.2), and it breaks the one promise §PAR-00
# makes, that a parse is a proposal a person can check against the source at a glance.
#
# ⚠ PAR-02.3a NAMED TWO DEFENCES AND THE FIRST ONE IS NOT AVAILABLE. «Join on the instance's id»
# assumes one id per line; the provider mints a FRESH `dimension_instances[0].id` per result row —
# the recorded clean read carries 23 ids for four lines — so an id join splits every line into six.
# The label is the only key the payload offers. The belt is therefore the merge below, and §PAR-09
# is where that correction is written down.


def _position(value: Any) -> float | None:
    """A stated position, or nothing at all. «1» and 1 are the same seat; «MER-001» is not a seat."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value or "").strip().replace(",", "."))
    except ValueError:
        return None


def _seat_label(seat: float) -> str:
    return str(int(seat)) if float(seat).is_integer() else f"{seat:g}"


def _flat(text: str) -> str:
    return " ".join(str(text or "").split()).casefold()


def _substantive_agents(kind: str) -> list[str]:
    """The columns that say something ABOUT the line, as opposed to naming it. A group carrying only
    its own label is the per-agent keying artefact of §PAR-02.3a, never a goods line of the note."""
    identity = {NAME_AGENT[kind], CODE_AGENT[kind], ORDER_AGENT[0]}
    return [name for name, *_ in LINE_AGENTS[kind] if name not in identity]


def _describe(group: dict[str, Any], kind: str) -> dict[str, Any]:
    """What this group says about itself: its name, its code, its seat, and whether it carries goods."""
    cells = group["cells"]
    code_agent = CODE_AGENT[kind]
    group["name"] = str(cells.get(NAME_AGENT[kind]) or "").strip()
    group["code"] = str(cells.get(code_agent) or "").strip() if code_agent else ""
    group["seat"] = _position(cells.get(ORDER_AGENT[0]))
    group["thin"] = not any(agent in cells for agent in _substantive_agents(kind))
    return group


def _same_line(one: dict[str, Any], two: dict[str, Any]) -> bool:
    """Are these two groups the same printed line? Yes on a FACT the page states, never on a likeness."""
    # A position holds one line, so two groups stating the same position are one line (§PAR-09).
    if one["seat"] is not None and two["seat"] is not None:
        return one["seat"] == two["seat"]
    # Two groups that both carry a quantity, a price or a lot are two lines. A delivery note may
    # print the same product twice, and collapsing those would delete a line off a person's paper.
    if not one["thin"] and not two["thin"]:
        return False
    for near, far in ((one, two), (two, one)):
        label, code, name = _flat(near["label"]), _flat(near["code"]), _flat(near["name"])
        far_label, far_code, far_name = _flat(far["label"]), _flat(far["code"]), _flat(far["name"])
        # The thin group's whole label IS the other's printed position — «1» beside Line number 1.
        if far["seat"] is not None and label and label == _seat_label(far["seat"]):
            return True
        if label and (label == far_code or label == far_name):
            return True
        if code and code == far_code:
            return True
        if name and name == far_name:
            return True
        # «Merluza grande» inside «MER-001 Merluza grande»: one group's label spells out the
        # code/name pair of the other. Four characters at least, so a bare «1» matches no one.
        for token in (label, code, name):
            if len(token) >= 4 and token in far_label:
                return True
    return False


def _absorb(keeper: dict[str, Any], other: dict[str, Any], kind: str) -> dict[str, Any]:
    """Fill the keeper's EMPTY cells from the other. A stated value is never overwritten by a second
    one: choosing between two answers on a person's behalf is the guessing §PAR-03.4 forbids."""
    for agent, value in other["cells"].items():
        keeper["cells"].setdefault(agent, value)
    keeper["seen"] = min(keeper["seen"], other["seen"])
    if other["page"] is not None:
        keeper["page"] = other["page"] if keeper["page"] is None else min(keeper["page"], other["page"])
    return _describe(keeper, kind)


def _collapse(groups: list[dict[str, Any]], kind: str) -> tuple[list[dict[str, Any]], int]:
    """Fold every group that is another group's same printed line into it, and COUNT the folds."""
    kept: list[dict[str, Any]] = []
    merged = 0
    for group in groups:
        hits = [index for index, other in enumerate(kept) if _same_line(group, other)]
        if len(hits) != 1:
            # No match, or more than one. An ambiguous merge would pick a line for a person, so the
            # group stands here and the label-only guard below decides what becomes of it.
            kept.append(group)
            continue
        index = hits[0]
        if kept[index]["thin"] and not group["thin"]:
            kept[index] = _absorb(group, kept[index], kind)  # the one carrying the goods stands
        else:
            kept[index] = _absorb(kept[index], group, kind)
        merged += 1
    return kept, merged


def _drop_label_only(groups: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """§PAR-02.3a's second defence, actually buckled (§PAR-09): a group carrying nothing but its own
    label, beside groups that carry the goods, is the split artefact and never a line of the note.

    It fires only where substantive lines stand beside it. A read where nothing came back but names
    is a THIN READ and it is returned thin — §PAR-05 keeps the line and empties the field, and
    dropping everything there would report an empty page for a page that has a table on it.
    """
    if all(group["thin"] for group in groups):
        return groups, 0
    kept = [group for group in groups if not group["thin"]]
    return kept, len(groups) - len(kept)


def _order_lines(groups: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    """The order of the lines is a fact on the page, and the answer now SAYS where that order came
    from (§PAR-09's order defect).

    Under JPEG 30 the «Line number» agent did not resolve, the sort had nothing to sort on, and the
    provider's own listing went out as if it were the paper's order — alphabetical, and silently so.
    `evidence.lineOrder` is the other half of the fix, and it says one of three things:

      · `numbered`   — every line stated its position and the rows stand in it;
      · `read-order` — the order came off the page's own evidence: every line cites a page and no
                       two lines share one, so the pages ARE the reading order;
      · `unknown`    — neither. The rows still go out, whole, and the answer says the order behind
                       them was not established.

    ⚠ WHY «the order they arrived in» IS NOT AN ANSWER, measured on three recorded reads: the
    provider lists its results grouped by agent, and the order of the labels inside an agent moves
    from read to read — the recorded clean read's first-appearance order is exactly its alphabetical
    listing (§RUN-04.2), the two recorded degraded reads' are two other orders. Arrival is the
    provider's bookkeeping, so a row order taken from it would be a claim about the paper made out of
    something that is not about the paper. The only position the payload carries beyond the «Line
    number» agent is the PAGE each value cites, and that is what `read-order` is read off.
    """
    ordered = sorted(groups, key=lambda group: (
        group["seat"] is None,
        group["seat"] if group["seat"] is not None else 0.0,
        group["page"] if group["page"] is not None else 1 << 30,
        group["seen"],
    ))
    if not ordered:
        return ordered, "unknown"
    if all(group["seat"] is not None for group in ordered):
        return ordered, "numbered"
    seen_pages = [group["page"] for group in ordered]
    if all(page is not None for page in seen_pages) and len(set(seen_pages)) == len(seen_pages):
        return ordered, "read-order"
    return ordered, "unknown"


def shape(body: dict[str, Any], kind: str) -> dict[str, Any]:
    """Turn Parsewise's per-agent-per-dimension results into the kit's `ParseResult`.

    One result row is ONE agent's value for ONE line. The `Line` dimension's own value is the line
    as Parsewise saw it printed — which is exactly the row's `raw` evidence in the kit.

    Three things happen to those groups before they are rows, and each one is stated in `evidence`
    rather than done quietly (§PAR-09): the groups that are one printed line are MERGED, the groups
    that carry nothing but a label are DROPPED, and the order the rows go out in is NAMED.
    """
    rows = body.get("results", body) if isinstance(body, dict) else body
    if not isinstance(rows, list):
        rows = []

    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    header: dict[str, Any] = {}
    stated = 0
    resolved = 0
    pages: set[tuple[str, int]] = set()
    line_pages: set[tuple[str, int]] = set()

    for row in rows:
        result = row.get("resolution_result") or {}
        agent = row.get("agent_name") or result.get("agent_name") or ""
        status = (result.get("resolution_status") or "").strip().lower()
        value = result.get("value")
        instances = row.get("dimension_instances") or []
        cites = [(str(v[0]), int(v[1])) for v in (result.get("references") or {}).values()
                 if isinstance(v, (list, tuple)) and len(v) >= 2]

        if status in STANDING and value not in (None, ""):
            stated += 1
            if status in CONFIDENT:
                resolved += 1
            pages.update(cites)
        else:
            value = None  # §PAR-03.4: never guessed, never borrowed from the row above

        if not instances:
            if value is not None:
                header[agent] = value
            continue

        key = str(instances[0].get("dimension_value") or "")
        group = groups.get(key)
        if group is None:
            group = groups[key] = {"label": key, "cells": {}, "seen": len(order), "page": None,
                                   "seat": None, "name": "", "code": "", "thin": True}
            order.append(key)
        if value is not None:
            group["cells"][agent] = value
            line_pages.update(cites)
            for _, page in cites:
                group["page"] = page if group["page"] is None else min(group["page"], page)

    lines = [_describe(groups[key], kind) for key in order]
    lines, merged = _collapse(lines, kind)
    lines, dropped = _drop_label_only(lines)
    lines, line_order = _order_lines(lines)

    qty_agent = QTY_AGENT[kind]
    price_agent = PRICE_AGENT[kind]

    ordered_rows = []
    for group in lines:
        cells = group["cells"]
        # The kit resolves a row by `name` against product NAME or CODE, so a nameless line still
        # has a road home through its code. A line with neither is not a line.
        said = group["name"] or group["code"]
        if not said:
            continue
        row_out: dict[str, Any] = {"name": said, "raw": group["label"]}
        # E200.08 · THE LITERAL CODE TRAVELS BESIDE THE NAME. `said` falls back to the code so a
        # nameless line still has a road home, but a catalogue row that printed BOTH was losing its
        # SKU on the way out — and a supplier's price list is a list of SKUs. The kit reads it as
        # the row's code and leaves it empty where the page printed none.
        if group["code"] and group["code"] != said:
            row_out["code"] = group["code"]
        qty = cells.get(qty_agent) if qty_agent else None
        if isinstance(qty, (int, float)):
            row_out["qty"] = float(qty)
        unit = str(cells.get("Unit") or "").strip()
        if unit:
            row_out["unit"] = unit
        price = cells.get(price_agent) if price_agent else None
        if isinstance(price, (int, float)):
            row_out["price"] = float(price)
        lot = str(cells.get("Lot") or "").strip()
        if lot:
            row_out["lot"] = lot
        # E200.08 · AND THE ROW'S OWN DATE TRAVELS WITH IT. §PAR-02.1 declares `date` on the stock
        # kind and the `Date` agent has always read it; it had no seat in the answer, so a goods-in
        # sheet's own dates were read and dropped. Only an ISO 8601 day travels: a date the agent
        # could not put in that shape is not a date this contract can state.
        said_date = str(cells.get("Date") or "").strip()
        if ISO_DAY.fullmatch(said_date):
            row_out["date"] = said_date
        ordered_rows.append(row_out)

    columns = [name for name, *_ in LINE_AGENTS[kind]]
    # §PAR-03.5 — the evidence is READ off the citations, never asserted. `pages` counts the distinct
    # pages any stated value cited; `tables` counts the pages that produced LINE rows, because a
    # repeating table is what a page of lines is. `lineOrder`, `rowsMerged` and `rowsDropped` are
    # §PAR-09's half: what the runtime did to the provider's groups, said out loud.
    return {
        "rows": ordered_rows,
        "columns": columns,
        "confidence": round(resolved / stated, 4) if stated else 0.0,
        "provider": "parsewise",
        "evidence": {
            "pages": len({page for _, page in pages}) or (1 if ordered_rows else 0),
            "tables": len({page for _, page in line_pages}) or (1 if ordered_rows else 0),
            "lineOrder": line_order,
            "rowsMerged": merged,
            "rowsDropped": dropped,
        },
        "header": header,
    }
