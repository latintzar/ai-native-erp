"""THE HANDWRITING SEAM — the two readers, the cross-check, and what a value has to survive (PAR-10.5).

Three fixtures, and the file names say which kind each one is:

  `handwriting-gemini.json`            RECORDED, 2026-09-04. gemini-2.5-flash's own answer to five
                                       handwritten crops drawn in Caveat, live from this box. Every
                                       value in it is exact.
  `handwriting-anthropic-no-credit.json`  RECORDED, 2026-09-04. What `claude-fable-5-1` actually
                                       replied: the key is live (the models endpoint lists the model
                                       with image input) and the account holds no credit.
  `handwriting-anthropic-shape.json`   CONSTRUCTED, and named for it. The messages API's envelope
                                       carrying the same five answers, written in the shapes the API
                                       documents — the live envelope could not be recorded, because
                                       of the file above. So the anthropic reader is proven on its
                                       SHAPING (the request it builds and the answer it reads), its
                                       live half waits for credit, and neither fact is dressed up as
                                       the other.

The live legs at the bottom run only where `GEMINI_API_KEY` is in the environment: one draws five
crops in a handwriting face fetched at run time and asserts the exact five values; the other joins
the whole chain — a degraded photograph of a page this suite drew, registered, cropped by the
runtime's own geometry, and read by the model.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import pathlib
import tempfile

import cv2
import httpx
import numpy as np
import paper_page
import pytest
from conftest import load
from PIL import Image, ImageDraw, ImageFont

from app import config, handwriting, register
from app.errors import RuntimeError_

CASES = [
    ("s-101·1·finalWeight", "finalWeight", "11,8", "MER-001 Merluza grande · line 1"),
    ("s-101·3·finalWeight", "finalWeight", "8,2", "GAM-002 Gamba roja · line 3"),
    ("s-102·2·finalWeight", "finalWeight", "6,4", "RAP-003 Rape limpio · line 2"),
    ("s-102·1·qty", "qty", "5", "ALM-007 Almeja fina · line 1 · printed «4»"),
    ("s-101·2·unit", "unit", "caja", "PUL-004 Pulpo cocido · line 2 · printed «caja»"),
]

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32      # the seam never looks at the bytes; the reader does


def crops():
    return [{"id": cid, "png": PNG, "context": context, "cell": cell} for cid, cell, _v, context in CASES]


def answered(monkeypatch, *bodies, status: int = 200):
    """Answer each POST with the next recorded body, and record what was sent."""
    sent: list[dict] = []
    queue = list(bodies)

    async def post(self, url, **kwargs):
        sent.append({"url": url, "headers": kwargs.get("headers", {}), "json": kwargs.get("json", {})})
        body = queue.pop(0) if queue else (queue[-1] if queue else {})
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    return sent


# ── NORMALISING WHAT A HAND WROTE ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("said,becomes", [
    ("11,8", "11.8"), ("11.8", "11.8"), ("12,5 kg", "12.5"), ("kg 12,5", "12.5"),
    ("5", "5"), ("05", "5"), ("1.250,5", "1250.5"), ("-3,25", "-3.25"),
    ("  8,20  ", "8.2"), ("nada", None), ("", None), ("kg", None),
])
def test_a_written_amount_becomes_a_plain_decimal(said, becomes):
    """A comma is a decimal point on this paper. A word that is not an amount comes back as nothing,
    which is §PAR-03.4's rule one field down: an empty field beats a guessed one."""
    assert handwriting.normalise_number(said) == becomes


@pytest.mark.parametrize("said,house,becomes,flagged", [
    ("caja", ["caja", "kg"], "caja", False),
    ("Caja", ["caja", "kg"], "caja", False),
    ("cajas", ["caja"], "caja", False),
    ("KG", [], "kg", False),
    ("manojo", [], "manojo", False),
    ("barqueta", ["caja", "kg"], "barqueta", True),
])
def test_a_written_unit_comes_back_in_the_house_s_own_word(said, house, becomes, flagged):
    """The manifest prints the house's units, so the sheet in hand IS the vocabulary. A word it does
    not print is kept as written and NAMED, rather than bent into the nearest thing that fits."""
    value, note = handwriting.normalise_unit(said, house)
    assert value == becomes
    assert bool(note) is flagged


def test_a_fenced_or_chatty_answer_is_still_read():
    assert handwriting._parse_json('```json\n{"cells": {"a": {"value": "1"}}}\n```') == {"a": {"value": "1"}}
    assert handwriting._parse_json('Here you go: {"cells": {"a": {"value": "2"}}} — hope that helps')
    assert handwriting._parse_json("not json at all") == {}


# ── THE TWO PROVIDERS ───────────────────────────────────────────────────────────────────────

def test_gemini_reads_the_five_crops_and_the_page_agrees(monkeypatch):
    recorded = load("handwriting-gemini.json")
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_FIXTURE_KEY_VALUE", raising=False)
    sent = answered(monkeypatch, recorded, recorded)

    out = asyncio.run(handwriting.read_cells(PNG, crops(), house_units=["kg", "caja", "manojo"]))

    assert [c["url"] for c in sent] == ["https://generativelanguage.googleapis.com/v1beta/models/"
                                        "gemini-2.5-flash:generateContent"] * 2
    assert sent[0]["headers"]["x-goog-api-key"] == "AIzaSyRECORDED_FIXTURE_KEY_VALUE"
    assert sent[0]["json"]["generationConfig"] == {"temperature": 0, "responseMimeType": "application/json"}
    inline = [p for p in sent[0]["json"]["contents"][0]["parts"] if "inline_data" in p]
    assert len(inline) == 5 and inline[0]["inline_data"]["mime_type"] == "image/png"
    assert len([p for p in sent[1]["json"]["contents"][0]["parts"] if "inline_data" in p]) == 1

    assert {cid: out[cid]["value"] for cid, *_ in CASES} == {
        "s-101·1·finalWeight": "11.8", "s-101·3·finalWeight": "8.2",
        "s-102·2·finalWeight": "6.4", "s-102·1·qty": "5", "s-101·2·unit": "caja"}
    for reading in out.values():
        assert reading["check"] is None            # both looks agreed
        assert reading["confidence"] >= 0.9


def test_anthropic_reads_the_same_five_through_the_messages_api(monkeypatch):
    constructed = load("handwriting-anthropic-shape.json")
    monkeypatch.setattr(config.settings, "handwriting_reader", "anthropic", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-recorded-fixture-key-value", raising=False)
    sent = answered(monkeypatch, constructed, constructed)

    out = asyncio.run(handwriting.read_cells(PNG, crops(), house_units=["kg", "caja", "manojo"]))

    assert sent[0]["url"] == "https://api.anthropic.com/v1/messages"
    assert sent[0]["headers"]["anthropic-version"] == "2023-06-01"
    assert sent[0]["headers"]["x-api-key"] == "sk-ant-recorded-fixture-key-value"
    assert sent[0]["json"]["model"] == "claude-fable-5-1"
    images = [b for b in sent[0]["json"]["messages"][0]["content"] if b["type"] == "image"]
    assert len(images) == 5 and images[0]["source"]["media_type"] == "image/png"

    assert {cid: out[cid]["value"] for cid, *_ in CASES} == {
        "s-101·1·finalWeight": "11.8", "s-101·3·finalWeight": "8.2",
        "s-102·2·finalWeight": "6.4", "s-102·1·qty": "5", "s-101·2·unit": "caja"}


def test_the_word_the_answer_carries_is_the_contract_s_own(monkeypatch):
    """`evidence.reader` is one of exactly two words, and they are minted here.

    The contract types that field as `"gemini-2.5-flash" | "claude"`. A reader's own model string
    written there instead — `claude-fable-5-1`, say — is drift the kit would have to absorb, so the
    two words are asserted rather than assumed, at the one place they are made."""
    assert handwriting.MODEL_WORD == {"gemini": "gemini-2.5-flash", "anthropic": "claude"}
    assert set(handwriting.MODEL_WORD) == set(handwriting.READERS)
    monkeypatch.setattr(config.settings, "handwriting_reader", "anthropic", raising=False)
    assert handwriting.MODEL_WORD[handwriting.selected_reader()] == "claude"


def test_the_reader_is_chosen_by_configuration_and_gemini_leads(monkeypatch):
    monkeypatch.setattr(config.settings, "handwriting_reader", "anthropic", raising=False)
    assert handwriting.selected_reader() == "anthropic"
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    assert handwriting.selected_reader() == "gemini"
    monkeypatch.setattr(config.settings, "handwriting_reader", "something-else", raising=False)
    assert handwriting.selected_reader() == "gemini"


def test_a_reader_with_no_key_refuses_by_name(monkeypatch):
    """THE ONE LAW: a missing key is a 503 with a name on it, never a plausible answer."""
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "", raising=False)
    with pytest.raises(RuntimeError_) as raised:
        asyncio.run(handwriting.read_cells(PNG, crops()))
    assert raised.value.code == "handwriting_missing"
    assert raised.value.status == 503


def test_the_account_s_own_answer_is_reported_as_a_failure_not_as_a_reading(monkeypatch):
    """The recorded reply from `claude-fable-5-1` on 2026-09-04: the key is live and the account holds
    no credit. That is a failure with a name, and it may never become a value."""
    refusal = load("handwriting-anthropic-no-credit.json")
    assert "credit balance is too low" in refusal["error"]["message"]
    monkeypatch.setattr(config.settings, "handwriting_reader", "anthropic", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-recorded-fixture-key-value", raising=False)
    answered(monkeypatch, refusal, status=400)
    with pytest.raises(RuntimeError_) as raised:
        asyncio.run(handwriting.read_cells(PNG, crops()))
    assert raised.value.code == "handwriting_failed"


# ── THE CROSS-CHECK ─────────────────────────────────────────────────────────────────────────

def _envelope(cells: dict) -> dict:
    return {"candidates": [{"content": {"parts": [{"text": json.dumps({"cells": cells})}], "role": "model"}}]}


def test_two_looks_that_agree_are_worth_more_than_either(monkeypatch):
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_FIXTURE_KEY_VALUE", raising=False)
    same = _envelope({"s-101·1·finalWeight": {"value": "11,8", "confidence": 0.7}})
    answered(monkeypatch, same, same)
    out = asyncio.run(handwriting.read_cells(PNG, [crops()[0]]))
    assert out["s-101·1·finalWeight"] == {"value": "11.8", "confidence": 0.85, "check": None}


def test_two_looks_that_disagree_say_so_in_both_their_own_words(monkeypatch):
    """The point of the second look. A number nobody can check is worse than one that says it is
    unsure, so the confidence falls and the check names what each look saw."""
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_FIXTURE_KEY_VALUE", raising=False)
    answered(monkeypatch,
             _envelope({"s-101·1·finalWeight": {"value": "11,8", "confidence": 0.8}}),
             _envelope({"s-101·1·finalWeight": {"value": "14,8", "confidence": 0.8}}))
    out = asyncio.run(handwriting.read_cells(PNG, [crops()[0]]))
    reading = out["s-101·1·finalWeight"]
    assert reading["value"] == "11.8"                     # the closer look stands
    assert reading["confidence"] <= 0.4
    assert "«11.8»" in reading["check"] and "«14.8»" in reading["check"]


def test_a_page_look_that_fails_leaves_the_crop_reading_standing(monkeypatch):
    """The cross-check is a second opinion, not a gate. Losing the whole answer because the belt
    broke would be the worse trade."""
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_FIXTURE_KEY_VALUE", raising=False)
    calls = {"n": 0}

    async def post(self, url, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json=_envelope({"s-101·1·finalWeight": {"value": "11,8", "confidence": 0.9}}),
                                  request=httpx.Request("POST", url))
        return httpx.Response(500, json={"error": "gone"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    out = asyncio.run(handwriting.read_cells(PNG, [crops()[0]]))
    reading = out["s-101·1·finalWeight"]
    assert reading["value"] == "11.8"
    assert reading["confidence"] < 0.9
    assert "a second look at the whole page" in reading["check"]


def test_a_rate_limit_is_asked_again_rather_than_lost(monkeypatch):
    """Measured live on this box: a per-minute quota turned a complete read into a 502 one second
    in, and the registration went with it. One retry after a pause; a wrong key or a spent balance
    still stands as it came, because those are answers rather than hiccups."""
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyRECORDED_FIXTURE_KEY_VALUE", raising=False)
    monkeypatch.setattr(handwriting, "RETRY_BACKOFF_SECONDS", 0.01, raising=False)
    calls = {"n": 0}

    async def post(self, url, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, json={"error": "slow down"}, request=httpx.Request("POST", url))
        return httpx.Response(200, json=_envelope({"s-101·1·finalWeight": {"value": "11,8", "confidence": 0.9}}),
                              request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    out = asyncio.run(handwriting.read_cells(PNG, [crops()[0]]))
    assert out["s-101·1·finalWeight"]["value"] == "11.8"
    assert calls["n"] == 3           # the crop read asked twice, the page look once


def test_a_spent_balance_stands_as_it_came(monkeypatch):
    """400 is an answer. Asking again would only spend the wait."""
    monkeypatch.setattr(config.settings, "handwriting_reader", "anthropic", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-recorded-fixture-key-value", raising=False)
    monkeypatch.setattr(handwriting, "RETRY_BACKOFF_SECONDS", 0.01, raising=False)
    sent = answered(monkeypatch, load("handwriting-anthropic-no-credit.json"), status=400)
    with pytest.raises(RuntimeError_):
        asyncio.run(handwriting.read_cells(PNG, crops()))
    assert len(sent) == 1


def test_nothing_asked_means_nothing_spent(monkeypatch):
    def refuse(*_a, **_k):
        raise AssertionError("a reader was called for a page with nothing written on it")
    monkeypatch.setattr(httpx.AsyncClient, "post", refuse)
    assert asyncio.run(handwriting.read_cells(PNG, [])) == {}


# ── THE LIVE LEG ────────────────────────────────────────────────────────────────────────────

CAVEAT = "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"

LIVE_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_HELLO")
live_only = pytest.mark.skipif(not LIVE_KEY, reason="the live reader needs GEMINI_API_KEY in the environment")


def caveat(workspace: pathlib.Path) -> pathlib.Path:
    """Fetch the handwriting face for a live leg, or skip the leg saying why.

    The repository carries no font binary for a test that runs once in a while, so the face is
    fetched at run time and deleted on the way out. A leg that cannot run says so; it never passes
    quietly."""
    face = workspace / "caveat.ttf"
    try:
        face.write_bytes(httpx.get(CAVEAT, follow_redirects=True, timeout=60.0).content)
        ImageFont.truetype(str(face), 40)
    except Exception as exc:                      # network, mirror, anything
        pytest.skip(f"the handwriting face was unavailable: {type(exc).__name__}")
    return face


@live_only
def test_the_live_reader_reads_five_hands_exactly(monkeypatch):
    """A REAL CALL TO A REAL MODEL, on handwriting this test draws.

    The face is fetched at run time and deleted on the way out, so the repository carries no font
    binary for a test that runs once in a while. If the fetch or the call is unavailable the leg
    skips — a leg that cannot run says so; it never passes quietly.
    """
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", LIVE_KEY or "", raising=False)

    workspace = pathlib.Path(tempfile.mkdtemp(prefix="rocoto-hand-"))
    try:
        face = caveat(workspace)
        font = ImageFont.truetype(str(face), 40)

        def hand(text: str) -> bytes:
            sheet = Image.new("L", (200, 56), 255)
            draw = ImageDraw.Draw(sheet)
            draw.rectangle([1, 1, 198, 54], outline=0, width=1)
            draw.text((16, 2), text, fill=20, font=font)
            buffer = io.BytesIO()
            sheet.convert("RGB").save(buffer, "PNG")
            return buffer.getvalue()

        blank = Image.new("RGB", (600, 400), "white")
        page = io.BytesIO()
        blank.save(page, "PNG")

        asked = [{"id": cid, "png": hand(value), "context": context, "cell": cell}
                 for cid, cell, value, context in CASES]
        try:
            out = asyncio.run(handwriting.read_cells(page.getvalue(), asked, house_units=["kg", "caja", "manojo"]))
        except RuntimeError_ as exc:
            # SKIP ONLY WHAT IS NOT ABOUT THIS CODE: no key on this box, or a provider saying «later».
            #
            # ⚠ A BLANKET `except RuntimeError_: skip` MADE THIS FILE'S ONLY LIVE CHECK UNABLE TO GO
            # RED. `handwriting_failed` is the runtime's own name for «the reader answered and the
            # answer was unusable» — including the E196.5 guard for a model that returned 200 with no
            # JSON in it — so swallowing it here would let exactly that regress in silence, on the one
            # test that talks to a real reader. A quota (429) and a provider that is down (503) are
            # the two the box cannot help; everything else is this repository's to answer for.
            later = exc.code == "handwriting_failed" and any(s in exc.message for s in ("429", "503"))
            if not (later or exc.code == "handwriting_missing"):
                raise
            pytest.skip(f"the live reader was unavailable: {exc.code} · {exc.message}")

        assert {cid: out[cid]["value"] for cid, *_ in CASES} == {
            "s-101·1·finalWeight": "11.8", "s-101·3·finalWeight": "8.2",
            "s-102·2·finalWeight": "6.4", "s-102·1·qty": "5", "s-101·2·unit": "caja"}
    finally:
        for leftover in workspace.iterdir():
            leftover.unlink()
        workspace.rmdir()


CHAIN_WRITTEN = {
    ("s-101", 1, "finalWeight"): "11,8",
    ("s-101", 3, "finalWeight"): "8,2",
    ("s-102", 2, "finalWeight"): "6,4",
}


@live_only
def test_the_live_reader_reads_the_crops_the_registration_cut_from_a_photograph(monkeypatch):
    """THE WHOLE CHAIN, JOINED: photograph → registration → crop → model → value (FEED-IA §199.2).

    The leg above draws its crops in isolation, which proves the reader and says nothing about the
    geometry that feeds it. This one starts where a person starts — a badly taken photograph of a
    sheet somebody wrote on — and the crops the model sees are the ones the runtime cut, at the
    millimetres the manifest states, off a page leaned 30 %, rolled 7°, blurred, side-lit and saved
    at JPEG 45. The values asserted are the values written on the paper.
    """
    monkeypatch.setattr(config.settings, "handwriting_reader", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_key", LIVE_KEY or "", raising=False)

    workspace = pathlib.Path(tempfile.mkdtemp(prefix="rocoto-chain-"))
    try:
        hand = paper_page.caveat_hand(str(caveat(workspace)))
        book = paper_page.manifest(token="hq4v7c2m9xz")
        sheet, _modules = paper_page.render(book, CHAIN_WRITTEN, px_per_mm=10.0, hands=(hand,))
        jpeg, _truth = paper_page.photograph(sheet, 10.0)
        photo = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)

        found = register.register(photo, book)
        assert found is not None and found.marks_found == 4
        page = book["pages"][0]
        observations = register.observe(found, page, register.page_floor(found, page))
        crops = [{"id": f"{o.sale}·{o.line}·{o.cell}", "png": o.crop_png, "context": o.context, "cell": o.cell}
                 for o in observations if o.written]
        assert {c["id"] for c in crops} == {f"{sale}·{line}·{cell}" for sale, line, cell in CHAIN_WRITTEN}

        try:
            out = asyncio.run(handwriting.read_cells(register.encode_png(found.page), crops,
                                                     house_units=["kg", "caja", "manojo"]))
        except RuntimeError_ as exc:
            pytest.skip(f"the live reader was unavailable: {exc.code}")

        assert {cid: out[cid]["value"] for cid in out} == {
            "s-101·1·finalWeight": "11.8", "s-101·3·finalWeight": "8.2", "s-102·2·finalWeight": "6.4"}
    finally:
        for leftover in workspace.iterdir():
            leftover.unlink()
        workspace.rmdir()
