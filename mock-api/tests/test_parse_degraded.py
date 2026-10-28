"""THE TWO DEFECTS THE DEGRADATION HARNESS FOUND, held here so they stay found (§PAR-08.2 · §PAR-09).

`tools/parse-harness.py` read the same albarán eight ways through the LIVE runtime on 2026-09-04 and
two reads came back wrong in a way no field-by-field diff calls wrong:

  · **`jpeg-30`** — every value right, the four lines ALPHABETICAL. The «Line number» agent did not
    resolve, the sort had nothing to sort on, and the provider's own listing went out as if it were
    the paper's order. A person checking a delivery note reads DOWN the paper.
  · **`dirt-05`** — EIGHT rows for a four-line note. The dynamic dimension keyed its instances per
    agent — one agent by product name, the rest by the printed line — and the join emitted both sets.

WHAT THESE TESTS ARE MADE OF, AND WHY IT IS BUILT THIS WAY.

`fixtures/parsewise-jpeg-30-raw.json` and `fixtures/parsewise-dirt-05-raw.json` are Parsewise's own
results bodies for exactly those damaged pixels, recorded by `tests/record_degraded_reads.py` (the
PNGs are byte-identical to the ones the harness sent — it checks). ⚠ **Neither re-read reproduced its
defect**: the same image, the same day, the same configuration, and the «Line number» agent resolved
this time while every agent keyed alike. The provider is not deterministic, so a live call cannot be
the guard — which is the whole reason §PAR-09 asked for a recorded fixture.

So each defect is put back into its own recording by ONE stated change, and the change is not
invented: `fixtures/albaran-degraded-reads.json` carries what `/api/parse` actually answered for both
variants under the old shaping, and every test below measures the shaped result against THAT
recording, field for field. `raw` is deliberately left out of the comparison for the harness's own
reason — it is the provider's reconstruction of the printed line, and it moves with the OCR.
"""
from __future__ import annotations

import copy

from conftest import load

from app import parsewise

FIELDS = ("name", "qty", "unit", "price", "lot")
RECORDED = "albaran-degraded-reads.json"


def fields_of(rows: list[dict]) -> list[tuple]:
    """Every row as the five facts a goods line is, in the order the rows stand in."""
    return [tuple(row.get(field) for field in FIELDS) for row in rows]


def without_line_numbers(body: dict) -> dict:
    """The `jpeg-30` read as it came back at 15:46:51 — the «Line number» agent unresolved.

    One change to the recording, and it is the change the live read made: `No result` on that agent,
    which §PAR-03.4 turns into an EMPTY field. Everything else is the recording, untouched.
    """
    body = copy.deepcopy(body)
    for row in body["results"]:
        if row.get("agent_name") == parsewise.ORDER_AGENT[0]:
            row["resolution_status"] = "No result"
            row["resolution_result"]["resolution_status"] = "No result"
            row["resolution_result"]["value"] = None
    return body


def keyed_twice(body: dict) -> dict:
    """The `dirt-05` read as it came back at 15:48:43 — one agent keying its instances differently.

    In the live read the «Product name» agent labelled its instances by the printed line's position
    while every other agent labelled its own by the line itself, so the two sets never met. That is
    what is restored here: the recording's own values, one agent's labels swapped for the positions
    the «Line number» agent stated. Nothing is typed in — the labels come out of the recording.
    """
    body = copy.deepcopy(body)
    position: dict[str, str] = {}
    for row in body["results"]:
        instances = row.get("dimension_instances") or []
        if row.get("agent_name") == parsewise.ORDER_AGENT[0] and instances:
            value = (row.get("resolution_result") or {}).get("value")
            if value is not None:
                position[instances[0]["dimension_value"]] = str(int(value))
    for row in body["results"]:
        instances = row.get("dimension_instances") or []
        if row.get("agent_name") == "Product name" and instances:
            label = instances[0]["dimension_value"]
            instances[0]["dimension_value"] = position.get(label, label)
    return body


# ── DEFECT 1 · THE ORDER (§PAR-08.2 «jpeg-30» · §PAR-09) ────────────────────────────────────────

def test_the_recorded_jpeg_30_read_is_four_lines_in_the_printed_order():
    """The re-read: the position agent resolved, so the answer both carries the order and says so."""
    result = parsewise.shape(load("parsewise-jpeg-30-raw.json"), "albaran")
    assert [row["name"] for row in result["rows"]] == [
        "Merluza grande", "Pulpo cocido", "Gamba roja", "Almeja fina"]
    assert result["evidence"]["lineOrder"] == "numbered"


def test_an_order_the_runtime_could_not_establish_is_never_presented_as_the_paper_s():
    """THE DEFECT: four right values, one wrong order, and nothing on the answer saying so.

    With no position stated anywhere, the rows still go out whole — they are the person's lines and
    dropping them would be worse — and `lineOrder` says `unknown`, which is the sentence §PAR-09
    demands: «the runtime must state an order it could not establish rather than present a silent one».
    """
    result = parsewise.shape(without_line_numbers(load("parsewise-jpeg-30-raw.json")), "albaran")
    assert len(result["rows"]) == 4
    assert result["evidence"]["lineOrder"] == "unknown"


def test_that_unestablished_order_is_the_one_the_live_read_returned():
    """And it is the LIVE defect, not a made-up one: the same four lines carrying the same values
    `/api/parse` answered with at 15:46:51 (`albaran-degraded-reads.json`), in an order that is not
    the paper's.

    ⚠ The ORDER ITSELF cannot be replayed, and that fact is the defect making its own case. With no
    position stated anywhere, the sequence falls to the order the provider happened to list its
    results in — alphabetical in the 15:46:51 read, a different order in this recording of the same
    pixels. A sequence that moves while the paper stands still is precisely what `unknown` now says
    out loud instead of shipping as a delivery note.
    """
    result = parsewise.shape(without_line_numbers(load("parsewise-jpeg-30-raw.json")), "albaran")
    recorded = load(RECORDED)["jpeg-30"]
    assert sorted(fields_of(result["rows"])) == sorted(fields_of(recorded["rows"]))
    assert fields_of(result["rows"]) != fields_of(load(RECORDED)["clean"]), "and it is not the printed order"
    assert result["evidence"]["lineOrder"] == "unknown"


def test_a_line_that_states_no_position_leaves_the_whole_order_unclaimed():
    """Half a numbering is not a numbering: three placed lines and one that stated nothing means the
    list as a whole was not established, and the answer says `unknown` rather than `numbered`."""
    body = load("parsewise-jpeg-30-raw.json")
    body = copy.deepcopy(body)
    for row in body["results"]:
        instances = row.get("dimension_instances") or []
        if (row.get("agent_name") == parsewise.ORDER_AGENT[0] and instances
                and instances[0]["dimension_value"].startswith("ALM-002")):
            row["resolution_result"]["resolution_status"] = "No result"
            row["resolution_result"]["value"] = None
    result = parsewise.shape(body, "albaran")
    assert len(result["rows"]) == 4
    assert result["evidence"]["lineOrder"] == "unknown"
    assert [row["name"] for row in result["rows"]][:3] == ["Merluza grande", "Pulpo cocido", "Gamba roja"], \
        "the placed lines keep their places; the unplaced one follows them (§RUN-04.2)"


def test_the_pages_are_the_reading_order_when_each_line_cites_its_own():
    """`read-order`, and the only evidence it is ever read off: a line per page, in page order. The
    provider carries no other position — no box, no line offset — so nothing else may claim to."""
    def cell(agent, line, value, page):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved",
                                      "references": {"1": ["note.pdf", page]}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [cell("Product name", "z", "Pulpo", 2), cell("Quantity", "z", 21, 2),
                        cell("Product name", "a", "Merluza", 1), cell("Quantity", "a", 12.5, 1)]}
    result = parsewise.shape(body, "albaran")
    assert [row["name"] for row in result["rows"]] == ["Merluza", "Pulpo"]
    assert result["evidence"]["lineOrder"] == "read-order"


# ── DEFECT 2 · THE SPLIT ROWS (§PAR-02.3a · §PAR-08.2 «dirt-05» · §PAR-09) ──────────────────────

def test_the_recorded_dirt_05_read_is_four_lines():
    result = parsewise.shape(load("parsewise-dirt-05-raw.json"), "albaran")
    assert len(result["rows"]) == 4
    assert result["evidence"]["rowsMerged"] == 0, "one keying, nothing to merge"


def test_eight_rows_for_a_four_line_note_become_four_lines():
    """THE DEFECT: two keyings of one table, joined into four complete rows and four labels.

    §PAR-02.3a's belt is buckled here — the groups that are one printed line are merged, and the
    count of the folds is on the answer, because a runtime that quietly halves a row count is the
    same kind of silent as the one that quietly re-sorts it.
    """
    result = parsewise.shape(keyed_twice(load("parsewise-dirt-05-raw.json")), "albaran")
    assert len(load(RECORDED)["dirt-05"]["rows"]) == 8, "what the live read handed a person"
    assert len(result["rows"]) == 4
    assert result["evidence"]["rowsMerged"] == 4
    assert result["evidence"]["rowsDropped"] == 0, "every split row found its line — none was thrown away"


def test_the_merged_lines_are_the_clean_read_s_lines():
    """And the four are the RIGHT four: the clean read's names, quantities, units, prices and lots,
    in the printed order — measured against the recorded clean read, which is §PAR-08.0's key."""
    result = parsewise.shape(keyed_twice(load("parsewise-dirt-05-raw.json")), "albaran")
    assert fields_of(result["rows"]) == fields_of(load(RECORDED)["clean"])
    assert result["evidence"]["lineOrder"] == "numbered"


def test_a_split_row_gives_its_line_the_name_the_other_half_lacked():
    """The person's row reads «Merluza grande», never «MER-001» — the live defect's own symptom, and
    the reason a merge beats a drop: the name lives on one half and the goods on the other."""
    result = parsewise.shape(keyed_twice(load("parsewise-dirt-05-raw.json")), "albaran")
    first = result["rows"][0]
    assert first["name"] == "Merluza grande"
    assert (first["qty"], first["unit"], first["price"], first["lot"]) == (12.5, "kg", 13.5, "L-250903")
    assert [row["name"] for row in load(RECORDED)["dirt-05"]["rows"]][:1] == ["MER-001"], \
        "what the live read called that line before the merge"


def test_two_lines_of_the_same_product_stay_two_lines():
    """The merge may never eat a repeat. A note that lists the same product twice is two deliveries,
    and both carry goods — so nothing but a stated position could ever join them."""
    def cell(agent, line, value):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved",
                                      "references": {"1": ["albaran.png", 1]}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [
        cell("Product name", "one", "Merluza grande"), cell("Quantity", "one", 12.5), cell("Line number", "one", 1),
        cell("Product name", "two", "Merluza grande"), cell("Quantity", "two", 3.0), cell("Line number", "two", 2),
    ]}
    result = parsewise.shape(body, "albaran")
    assert [(row["name"], row["qty"]) for row in result["rows"]] == [
        ("Merluza grande", 12.5), ("Merluza grande", 3.0)]
    assert result["evidence"]["rowsMerged"] == 0


def test_a_row_carrying_nothing_but_a_label_is_dropped_and_counted():
    """§PAR-02.3a's second defence where the merge finds no line to fold into: the row goes, and the
    count goes on the answer so the drop is never silent."""
    def cell(agent, line, value):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved", "references": {}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [
        cell("Product name", "MER-001 Merluza grande", "Merluza grande"),
        cell("Quantity", "MER-001 Merluza grande", 12.5),
        cell("Product name", "una etiqueta suelta", "Sardina"),
    ]}
    result = parsewise.shape(body, "albaran")
    assert [row["name"] for row in result["rows"]] == ["Merluza grande"]
    assert result["evidence"]["rowsDropped"] == 1


def test_a_read_that_is_thin_all_through_keeps_every_line():
    """The guard fires beside goods, and only there. Where NOTHING came back but names, the names are
    what the page gave: §PAR-05 keeps the line and empties the field, and reporting an empty page for
    a page with a table on it would be the invention this runtime never makes."""
    def cell(agent, line, value):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved", "references": {}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [cell("Product name", "a", "Merluza"), cell("Product name", "b", "Pulpo")]}
    result = parsewise.shape(body, "albaran")
    assert [row["name"] for row in result["rows"]] == ["Merluza", "Pulpo"]
    assert result["evidence"]["rowsDropped"] == 0


def test_the_clean_recording_still_shapes_to_the_four_lines_it_always_did():
    """The belt may not cost the buckle: the read that was always right is untouched by both fixes."""
    result = parsewise.shape(load("parsewise-albaran-result.json"), "albaran")
    assert len(result["rows"]) == 4
    assert result["evidence"]["rowsMerged"] == 0
    assert result["evidence"]["rowsDropped"] == 0
