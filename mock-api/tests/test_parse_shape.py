"""What this service makes of Parsewise's answer (THE-PARSING-SPEC §PAR-03 · §PAR-06.2).

`fixtures/parsewise-albaran-result.json` is a REAL response: 23 result rows from the live API for
the fixture albarán — four goods lines × six column agents, minus the one lot the paper does not
state. Every assertion here is about the shaping, which is the half that lives in this repo.
"""
from __future__ import annotations

from conftest import load

from app import parsewise


def shaped():
    return parsewise.shape(load("parsewise-albaran-result.json"), "albaran")


def test_four_printed_lines_become_four_rows():
    """§PAR-02.3's whole point: without the dimension this page came back as ONE row."""
    result = shaped()
    assert len(result["rows"]) == 4
    assert {row["name"] for row in result["rows"]} == {
        "Merluza grande", "Pulpo cocido", "Gamba roja", "Almeja fina"}


def test_a_comma_decimal_is_a_decimal():
    rows = {row["name"]: row for row in shaped()["rows"]}
    assert rows["Merluza grande"]["qty"] == 12.5
    assert rows["Almeja fina"]["qty"] == 4.25


def test_the_unit_that_is_not_kg_survives_beside_the_ones_that_are():
    rows = {row["name"]: row for row in shaped()["rows"]}
    assert rows["Gamba roja"]["unit"] == "caja"
    assert rows["Merluza grande"]["unit"] == "kg"


def test_the_absent_lot_is_absent_and_never_borrowed():
    """The single most important behaviour on the page: a borrowed lot is a traceability lie."""
    rows = {row["name"]: row for row in shaped()["rows"]}
    assert "lot" not in rows["Almeja fina"]
    assert rows["Pulpo cocido"]["lot"] == "L-250902"


def test_the_total_row_is_not_a_line():
    for row in shaped()["rows"]:
        assert "1.146,03" not in row["raw"]
        assert "TOTAL" not in row["raw"].upper()


def test_the_row_carries_the_printed_line_as_evidence():
    rows = {row["name"]: row for row in shaped()["rows"]}
    assert rows["Merluza grande"]["raw"].startswith("MER-001")


def test_confidence_is_the_share_of_stated_values_that_resolved():
    result = shaped()
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["confidence"] == 1.0  # every stated value on this page came back Resolved


def test_evidence_is_read_off_the_citations():
    """`pages` and `tables` come off the citations; `lineOrder`, `rowsMerged` and `rowsDropped` say
    what the shaping did to the provider's groups (§PAR-09).

    This recording is §PAR-06.2's SIX-agent probe — it predates the «Line number» agent — so no line
    in it states a position and every value cites page 1. `unknown` is the honest reading of that,
    and the live service, which declares the seventh agent, answers `numbered` (§PAR-09.1).
    """
    result = shaped()
    assert result["evidence"] == {"pages": 1, "tables": 1, "lineOrder": "unknown",
                                  "rowsMerged": 0, "rowsDropped": 0}
    assert result["provider"] == "parsewise"
    assert result["columns"][0] == "Product code"
    assert "Line number" not in result["columns"]  # where a line stands is not a column it states


def test_this_recording_carries_no_header_because_the_probe_declared_none():
    """The recording is the DIMENSIONED probe — six line agents, no header agents. So the header is
    empty here, and that is the honest reading of this file. The live service declares the header
    agents too, and the run through /api/parse on 2026-09-04 returned
    «2026/0418 · 2026-09-03 · Restaurant Can Sabate» (THE-RUNTIME-SPEC §RUN-05.1)."""
    assert shaped()["header"] == {}


def test_a_dimensionless_value_is_a_header_fact():
    body = {"results": [{
        "agent_name": "Document number", "extraction_status": "Processed",
        "resolution_result": {"value": "2026/0418", "resolution_status": "Resolved",
                              "references": {"1": ["albaran.png", 1]}},
        "dimension_instances": [],
    }]}
    assert parsewise.shape(body, "albaran")["header"] == {"Document number": "2026/0418"}


def test_an_unresolved_value_leaves_the_field_empty(monkeypatch):
    """§PAR-03.4 — «No result» never becomes a guess, and never borrows the row above."""
    body = load("parsewise-albaran-result.json")
    for row in body["results"]:
        if row.get("agent_name") == "Quantity":
            row["resolution_result"]["resolution_status"] = "No result"
    result = parsewise.shape(body, "albaran")
    assert result["rows"], "the lines survive; only the unread field goes"
    assert all("qty" not in row for row in result["rows"])


def test_a_line_with_neither_name_nor_code_is_not_a_line():
    body = load("parsewise-albaran-result.json")
    for row in body["results"]:
        if row.get("agent_name") in ("Product name", "Product code"):
            row["resolution_result"]["resolution_status"] = "No result"
    assert parsewise.shape(body, "albaran")["rows"] == []


def test_rows_are_ordered_by_the_page_when_the_page_states_it():
    """SYNTHETIC body (not a provider recording): three lines whose positions arrive shuffled."""
    def cell(agent, line, value, position=None):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved",
                                      "references": {"1": ["p.png", 1]}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [
        cell("Product name", "c", "Gamba"), cell("Line number", "c", 3),
        cell("Product name", "a", "Merluza"), cell("Line number", "a", 1),
        cell("Product name", "b", "Pulpo"), cell("Line number", "b", 2),
    ]}
    assert [row["name"] for row in parsewise.shape(body, "albaran")["rows"]] == ["Merluza", "Pulpo", "Gamba"]


def test_a_line_whose_position_went_unread_is_kept_behind_the_placed_ones():
    def cell(agent, line, value):
        return {"agent_name": agent, "extraction_status": "Processed",
                "resolution_result": {"value": value, "resolution_status": "Resolved", "references": {}},
                "dimension_instances": [{"name": "Line", "dimension_value": line}]}

    body = {"results": [
        cell("Product name", "x", "Sin sitio"),
        cell("Product name", "a", "Merluza"), cell("Line number", "a", 1),
    ]}
    names = [row["name"] for row in parsewise.shape(body, "albaran")["rows"]]
    assert names == ["Merluza", "Sin sitio"], "unplaced lines follow the placed ones — never dropped"


def test_the_three_standard_formats_are_declared_not_guessed():
    assert set(parsewise.LINE_AGENTS) == {"albaran", "catalogue", "stock"}
    for kind in parsewise.LINE_AGENTS:
        assert parsewise.LINE_DIMENSION[kind]["name"] == "Line"
        assert all(len(agent) == 4 for agent in parsewise.LINE_AGENTS[kind])
        assert parsewise.HEADER_AGENTS[kind], "header facts are extracted, never inferred"
