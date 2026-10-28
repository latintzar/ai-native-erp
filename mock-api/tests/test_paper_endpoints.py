"""THE THREE ENDPOINTS — what is accepted, what is refused by name, and what comes back (PAR-10).

The reader is STUBBED here, deliberately and completely. What is under test is the runtime's own
half: the contract as pydantic types, the manifest in custody, the photograph located against it,
and every reading arriving on the right `(sale, line, cell)`. What a model makes of a crop is a
separate question and it is asked in `test_paper_handwriting.py`.
"""
from __future__ import annotations

import copy
import json

import cv2
import numpy as np
import paper_page
import pytest

from app import config, handwriting, paper, register, store

WRITTEN = {
    ("s-101", 1, "finalWeight"): "11,8",
    ("s-101", 3, "finalWeight"): "8,2",
    ("s-102", 2, "finalWeight"): "6,4",
    ("s-102", 1, "qty"): "5",
}

WRITTEN_PAGE_TWO = {
    ("s-102", 101, "finalWeight"): "11,8",
    ("s-102", 103, "finalWeight"): "8,2",
}
"""The second sheet of a two-page run: its lines are numbered from 101, so a reading that arrived on
the first sheet's rows would be visible as itself rather than as a near-miss."""

STUB = {"s-101·1·finalWeight": "11.8", "s-101·3·finalWeight": "8.2",
        "s-102·2·finalWeight": "6.4", "s-102·1·qty": "5",
        "s-102·101·finalWeight": "11.8", "s-102·103·finalWeight": "8.2"}

STUB_CONFIDENCE = 0.93
"""What the stubbed reader says about every crop it is handed. The endpoint's own arithmetic — the
registration's confidence scale, the close-second-page penalty — is measured against this number, so
a test can state the exact confidence the answer has to carry."""


@pytest.fixture(scope="module")
def photo_bytes():
    book = paper_page.manifest()
    page, _ = paper_page.render(book, WRITTEN, px_per_mm=10.0)
    jpeg, _truth = paper_page.photograph(page, 10.0)
    return book, jpeg


@pytest.fixture(scope="module")
def two_sheets():
    """TWO SHEETS UNDER ONE TOKEN, and the photograph is of the second.

    One token is printed on every page of a run (QR-05), so the mark names the DOCUMENT. Which sheet
    is in the hand comes off the printed values, and this is the page that asks the endpoint to say
    so."""
    book = paper_page.manifest(token="m2k7d4x9pr3", pages=2)
    page, _ = paper_page.render(book, WRITTEN_PAGE_TWO, page_index=1, px_per_mm=10.0)
    jpeg, _truth = paper_page.photograph(page, 10.0)
    return book, jpeg


@pytest.fixture(scope="module")
def partial_photo():
    """A PHOTOGRAPH OF THE RIGHT-HAND HALF: the code is in the frame and the three squares are not.

    The page is still located — the mark's own four corners are four points on the same plane — and
    the answer has to carry that road's reduced confidence all the way into every reading."""
    book = paper_page.manifest(token="c5r2h9j4dk7")
    page, _ = paper_page.render(book, WRITTEN, px_per_mm=10.0)
    jpeg, _truth = paper_page.photograph(page, 10.0, lean=0.12, roll_deg=3.0)
    photo = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    height, width = photo.shape[:2]
    ok, buffer = cv2.imencode(".jpg", photo[0:int(height * 0.72), int(width * 0.45):width],
                              [int(cv2.IMWRITE_JPEG_QUALITY), 60])
    assert ok
    return book, buffer.tobytes()


@pytest.fixture(scope="module")
def unmarked_sheet():
    """A SHEET PRINTED WITHOUT ITS THREE SQUARES while its manifest still promises them. The code
    reads; the page does not stand up to its own description. That is `matched: null`."""
    book = paper_page.manifest(token="v9g5l2c7hz4")
    page, _ = paper_page.render(book, WRITTEN, px_per_mm=10.0, corners=False)
    jpeg, _truth = paper_page.photograph(page, 10.0)
    return book, jpeg


@pytest.fixture()
def reader(monkeypatch):
    """A recorded reader. It answers only for the ids it is handed, so a reading that arrives on the
    wrong `(sale, line, cell)` comes back empty and the assertion below catches it."""
    seen: dict[str, list] = {"calls": []}

    async def read_cells(page_png, crops, *, house_units=()):
        seen["calls"].append([c["id"] for c in crops])
        seen["page_png"] = page_png
        return {c["id"]: {"value": STUB.get(c["id"]), "confidence": STUB_CONFIDENCE, "check": None}
                for c in crops}

    monkeypatch.setattr(handwriting, "read_cells", read_cells)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_READER_KEY_VALUE", raising=False)
    return seen


# ── the manifest ────────────────────────────────────────────────────────────────────────────

def test_a_manifest_is_recorded_and_read_back(client, photo_bytes):
    book, _ = photo_bytes
    posted = client.post("/api/paper/manifest", json=book)
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["ok"] is True and body["token"] == book["token"]
    assert body["locator"] == book["locator"]
    assert body["pages"] == 1 and body["cells"] == 18

    got = client.get(f"/api/paper/manifest/{book['token']}")
    assert got.status_code == 200
    assert got.json()["marks"] == book["marks"]


def test_a_token_this_runtime_never_saw_says_so_and_says_what_to_do(client):
    answer = client.get("/api/paper/manifest/zzzzz")
    assert answer.status_code == 404
    message = answer.json()["error"]["message"]
    assert answer.json()["error"]["code"] == "manifest_unknown"
    assert "printed through it" in message


@pytest.mark.parametrize("break_it,because", [
    (lambda m: m.update(locator="rocoto:document/packing/v1/somethingelse"), "the locator spells out its own token"),
    (lambda m: m.update(token="NOT A TOKEN"), "lower-case letters and digits"),
    (lambda m: m.update(day="the fourth"), "calendar day"),
    (lambda m: m.update(paper="A5"), "measures 148"),
    (lambda m: m["marks"].__setitem__("corners", m["marks"]["corners"][:2]), "three corner marks"),
    (lambda m: m["marks"]["corners"].__setitem__(1, {**m["marks"]["corners"][1], "id": m["marks"]["corners"][0]["id"]}),
     "its own corner"),
    (lambda m: m["pages"][0]["blocks"][0]["rows"][1].update(line=m["pages"][0]["blocks"][0]["rows"][0]["line"]),
     "is named twice"),
    (lambda m: m["pages"][0]["blocks"][0]["rows"][0]["cells"]["finalWeight"].update(x=400.0), "stands on the page"),
    (lambda m: m["pages"][0]["blocks"][0]["rows"][0]["cells"].pop("finalWeight"), "finalWeight"),
    (lambda m: m.update(version=2), "version"),
])
def test_a_manifest_that_breaks_the_contract_is_refused_by_name(client, photo_bytes, break_it, because):
    """Each of these is a way the geometry could arrive wrong, and each is refused with a sentence
    that names what a correct manifest looks like rather than what this one lacked."""
    book = copy.deepcopy(photo_bytes[0])
    break_it(book)
    answer = client.post("/api/paper/manifest", json=book)
    assert answer.status_code == 422, answer.text
    assert because in answer.text, answer.text


def test_extra_fields_are_carried_rather_than_refused(client, photo_bytes):
    """RUN-02's rule, one endpoint down: a producer may state more than a consumer reads."""
    book = copy.deepcopy(photo_bytes[0])
    book["printedAt"] = "2026-09-04T19:26:00Z"
    book["pages"][0]["blocks"][0]["rows"][0]["lot"] = "L-0091"
    assert client.post("/api/paper/manifest", json=book).status_code == 200


# ── the read ────────────────────────────────────────────────────────────────────────────────

def test_a_photograph_is_read_against_the_sheet_it_names(client, photo_bytes, reader):
    book, jpeg = photo_bytes
    assert client.post("/api/paper/manifest", json=book).status_code == 200

    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["locator"] == book["locator"] and body["token"] == book["token"]
    assert body["matched"] == {"day": book["day"], "sales": ["s-101", "s-102"]}
    assert body["evidence"]["reader"] == "gemini-2.5-flash"
    assert body["evidence"]["marksFound"] == 4
    assert body["evidence"]["ms"] >= 0

    assert len(body["pages"]) == 1
    page = body["pages"][0]
    assert page["index"] == 0
    assert set(page["quality"]) == {"tiltDeg", "blurScore", "lightScore"}

    readings = {(r["sale"], r["line"], r["cell"]): r for r in page["readings"]}
    assert len(readings) == 18
    for key, reading in readings.items():
        assert reading["written"] is (key in WRITTEN)
        assert reading["value"] == (STUB[f"{key[0]}·{key[1]}·{key[2]}"] if key in WRITTEN else None)
        assert 0.0 <= reading["confidence"] <= 1.0
        assert reading["crop"].startswith("data:image/png;base64,")


def test_the_reader_is_asked_about_the_written_boxes_and_the_whole_page(client, photo_bytes, reader):
    book, jpeg = photo_bytes
    client.post("/api/paper/manifest", json=book)
    client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})

    assert reader["calls"] == [["s-101·1·finalWeight", "s-101·3·finalWeight",
                               "s-102·1·qty", "s-102·2·finalWeight"]]
    assert reader["page_png"].startswith(b"\x89PNG")


@pytest.mark.parametrize("configured,word", [("gemini", "gemini-2.5-flash"), ("anthropic", "claude")])
def test_the_answer_names_the_reader_in_the_contract_s_own_word(client, photo_bytes, reader,
                                                                monkeypatch, configured, word):
    """`evidence.reader` is one of the contract's two words and it says which reader actually ran.

    The words are minted in exactly one place (`handwriting.MODEL_WORD`), and this asserts the whole
    path from the configuration down to the answer — so a model name written into the evidence in
    place of the contract's word is a red test rather than a surprise for the kit."""
    book, jpeg = photo_bytes
    monkeypatch.setattr(config.settings, "handwriting_reader", configured, raising=False)
    client.post("/api/paper/manifest", json=book)
    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    assert answer.json()["evidence"]["reader"] == word


def test_a_sheet_that_will_not_lie_flat_names_the_document_and_reads_nothing(client, unmarked_sheet, reader):
    """`matched: null` — the branch the contract names, and the honest answer when the mark says
    WHICH sheet this is and the page itself will not settle.

    Nothing is invented to fill the gap: no page, no readings, and the evidence says one mark was
    found. A person gets «this is your sheet, photograph it again» rather than numbers off a page
    the maths only thought it had located."""
    book, jpeg = unmarked_sheet
    assert client.post("/api/paper/manifest", json=book).status_code == 200

    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["locator"] == book["locator"] and body["token"] == book["token"]
    assert body["matched"] is None
    assert body["pages"] == []
    assert body["evidence"]["marksFound"] == 1
    assert body["evidence"]["reader"] == "gemini-2.5-flash"


def test_the_sheet_in_the_photograph_is_the_sheet_that_is_read(client, two_sheets, reader):
    """Two sheets, one token: the second one is in the hand and the second one is what comes back.

    `evidence.page {index, score, margin}` is additive (RUN-02 makes the same move for `code` and
    `header`) and it is the fact a person needs when a run is several pages long: which sheet was
    read, and how clear the choice was."""
    book, jpeg = two_sheets
    assert client.post("/api/paper/manifest", json=book).status_code == 200

    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["pages"][0]["index"] == 1
    assert body["matched"] == {"day": book["day"], "sales": ["s-102"]}
    chosen = body["evidence"]["page"]
    assert set(chosen) == {"index", "score", "margin"}
    assert chosen["index"] == 1
    assert chosen["margin"] > 0.05, "the two sheets print different values; the choice is not close"

    readings = {(r["sale"], r["line"], r["cell"]): r for r in body["pages"][0]["readings"]}
    assert {line for _sale, line, _cell in readings} == {101, 102, 103}
    for key, reading in readings.items():
        assert reading["written"] is (key in WRITTEN_PAGE_TWO)
        assert reading["check"] is None
    assert readings[("s-102", 101, "finalWeight")]["value"] == "11.8"
    assert readings[("s-102", 101, "finalWeight")]["confidence"] == STUB_CONFIDENCE


def test_two_sheets_that_print_alike_say_the_choice_was_close_and_charge_for_it(client, two_sheets, reader):
    """THE THIN MARGIN. Both sheets of this run print the same quantities in the same boxes, so the
    printed values cannot separate them — and an answer that hid that would be the dangerous one.

    So the margin comes back thin, every reading says the second sheet scored close, and every
    confidence is charged for it. The reading still stands; it stands with its uncertainty stated."""
    book, jpeg = two_sheets
    twins = copy.deepcopy(book)
    for seat, row in enumerate(twins["pages"][0]["blocks"][0]["rows"]):
        row["printed"] = copy.deepcopy(twins["pages"][1]["blocks"][0]["rows"][seat]["printed"])
    assert client.post("/api/paper/manifest", json=twins).status_code == 200

    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["evidence"]["page"]["margin"] < 0.05
    written = [r for r in body["pages"][0]["readings"] if r["written"]]
    assert written, "the pen is on this photograph whichever sheet the score chose"
    for reading in written:
        assert "a second page scored close" in reading["check"]
        assert reading["confidence"] == round(STUB_CONFIDENCE * 0.85, 3)


def test_the_code_only_road_carries_its_confidence_into_every_reading(client, partial_photo, reader):
    """THE SCALE TRAVELS. A page located from the mark alone is located to millimetres a row is
    taller than, so `register` cuts its confidence and says which road it came down — and the
    endpoint has to carry that scale into the answer rather than reporting the reader's own
    certainty about a crop from a page we are less sure of."""
    book, jpeg = partial_photo
    photo = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    found = register.register(photo, book)
    assert found is not None and found.marks_found == 1
    # ⚠ THE NUMBER IS PINNED, NOT INFERRED (E196.2's verifier). `< 1.0` stays green when the
    # constant moves from 0.4 to 0.9, so the board row's «carries 0.4 into every reading» was a
    # claim nothing was holding. The value itself is asserted here and the arithmetic below is
    # asserted against it.
    assert found.confidence_scale == 0.4
    assert found.confidence_scale < 1.0

    assert client.post("/api/paper/manifest", json=book).status_code == 200
    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["evidence"]["marksFound"] == 1
    written = [r for r in body["pages"][0]["readings"] if r["written"]]
    assert written, "the pen is on this photograph"
    for reading in written:
        assert reading["confidence"] == round(STUB_CONFIDENCE * found.confidence_scale, 3)
        assert "read from the code alone" in reading["check"]


def test_a_photograph_whose_sheet_this_runtime_never_printed_says_what_to_do(client, photo_bytes, reader):
    _book, jpeg = photo_bytes            # …and no manifest recorded
    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "manifest_unknown"
    assert "printed through it" in error["message"]


def test_a_photograph_with_no_code_in_it_names_the_road_that_does_work(client):
    plain = np.full((900, 700, 3), 240, dtype=np.uint8)
    ok, buffer = cv2.imencode(".jpg", plain)
    assert ok
    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", buffer.tobytes(), "image/jpeg")})
    assert answer.status_code == 422
    error = answer.json()["error"]
    assert error["code"] == "paper_unknown"
    assert "document reader" in error["message"]      # §196.5 — Parsewise is the other road


def test_something_that_is_not_a_photograph_is_refused(client):
    answer = client.post("/api/paper/read", files={"file": ("notes.txt", b"not an image at all", "text/plain")})
    assert answer.status_code == 400
    assert answer.json()["error"]["code"] == "bad_image"


def test_an_empty_upload_is_refused_before_anything_is_decoded(client):
    answer = client.post("/api/paper/read", files={"file": ("sheet.jpg", b"", "image/jpeg")})
    assert answer.status_code == 400
    assert answer.json()["error"]["code"] == "empty_upload"


# ── what is kept, and what is not ───────────────────────────────────────────────────────────

def test_the_photograph_is_never_written_to_this_disk(client, photo_bytes, reader, tmp_path):
    """SRC-PRIV-01. The crops travel in the answer; the photograph exists for one request and goes.
    What survives on the box is geometry and the printed values that geometry describes."""
    book, jpeg = photo_bytes
    client.post("/api/paper/manifest", json=book)
    client.post("/api/paper/read", files={"file": ("sheet.jpg", jpeg, "image/jpeg")})

    kept = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*") if p.is_file())
    # `calls/.lock` is the store's own cross-process write lock (`store.hold()`), zero bytes and
    # named for what it is — a manifest write takes it like every other writer. It is listed here
    # rather than filtered silently, so a file that appears beside it is a failure and not a
    # loosened assertion.
    assert kept == ["calls/.lock", f"manifests/{book['token']}.json"]
    assert (tmp_path / "calls" / ".lock").stat().st_size == 0
    stored = json.loads((tmp_path / "manifests" / f"{book['token']}.json").read_text())
    assert stored["manifest"]["token"] == book["token"]
    # AND THE PHOTOGRAPH ITSELF IS NOWHERE: not the bytes, in any file this request left behind.
    for path in (p for p in tmp_path.rglob("*") if p.is_file()):
        assert jpeg[:64] not in path.read_bytes()


def test_a_manifest_older_than_its_retention_is_swept(client, photo_bytes, tmp_path, monkeypatch):
    book, _ = photo_bytes
    client.post("/api/paper/manifest", json=book)
    path = tmp_path / "manifests" / f"{book['token']}.json"
    assert path.exists()

    import os
    old = path.stat().st_mtime - (config.settings.paper_manifest_days + 1) * 86400
    os.utime(path, (old, old))
    assert store.sweep_manifests() == 1
    assert not path.exists()
    assert store.get_manifest(book["token"]) is None


def test_health_states_which_handwriting_reader_this_process_would_use(client):
    """RUN-02, and the shape the kit types.

    ⚠ `providers` GREW TO SIX AT RELEASE-195, and this test says so rather than being loosened.
    E196 wrote it as exactly four names because `runtime-client.ts`'s `RuntimeProvider` was four;
    E197 added the ARTWORK road, whose state has its own third word — «awaiting key», the honest
    answer for a road that is built and holds no credit yet — and E198 added the COPILOT, which
    names the MIND that is standing rather than merely that some key exists. The kit types both as
    optional keys beside the four (`Record<RuntimeProvider, …> & {artwork?; copilot?}`), so an
    older kit reading this body still finds every name it knows. `handwriting` stays OUTSIDE
    `providers` for the same reason it was put there: it names a reader, not a key.
    """
    body = client.get("/api/health").json()
    assert set(body["providers"]) == {"parsewise", "deepgram", "places", "twilio", "artwork", "copilot"}
    assert body["providers"]["artwork"] in ("configured", "awaiting key")
    assert body["providers"]["copilot"] in ("gemini", "anthropic", "awaiting key")
    for four in ("parsewise", "deepgram", "places", "twilio"):
        assert body["providers"][four] in ("configured", "missing")
    assert body["handwriting"]["reader"] in ("gemini", "anthropic")
    assert body["handwriting"]["key"] in ("configured", "missing")


def test_the_grammar_the_paper_prints_is_the_grammar_this_endpoint_accepts():
    """QR-05.4, on this side of the wire. Space and case are forgiven; content is never invented."""
    assert paper._locator_of("  ROCOTO:DOCUMENT/PACKING/V1/K3M9X2P7QA1 ") == paper.SCHEME + "k3m9x2p7qa1"
    assert paper._locator_of("k3m9x2p7qa1") == paper.SCHEME + "k3m9x2p7qa1"
    assert paper._locator_of("https://example.com/") is None
    assert paper._locator_of("k3m9x2p7qa1toolongforthis") is None
    assert paper._locator_of("") is None
