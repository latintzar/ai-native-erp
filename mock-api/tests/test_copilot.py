"""THE COPILOT'S MIND, HELD TO ITS CONTRACT (FEED-IA §196.2 · §199.3 · E198.10).

What this suite guards is the half that changes when someone edits this repo:

  · THE PROMPT is a SNAPSHOT. `build_prompt` reads no clock and no environment, so the same request
    builds the same two strings forever — and an edit to the Copilot's own words shows up here as a
    diff a person reads, rather than as a change in what the agent says on a Tuesday.
  · THE CAPS are enforced on this side. A client that sends two hundred orders gets forty.
  · THE JSON is validated and the retry is ONE, with the complaint fed back.
  · THE GROUNDING drops every proposal naming an order, a customer or a product the context does
    not hold. This is the test that makes «Open order» trustworthy.
  · THE SEAM speaks both providers, against recorded response envelopes.
  · THE LIVE LEG asks the real Gemini a real supply question over the six-order fixture and asserts
    a supply report naming only orders that are in it. It is guarded by the key and by Google's own
    free-tier day quota — anything else fails.
"""
from __future__ import annotations

import asyncio
import json
import os
import pathlib

import httpx
import pytest
from conftest import FIXTURES, load

from app import config, copilot
from app.errors import RuntimeError_

REQUEST = load("copilot-request.json")
SNAPSHOT = pathlib.Path(__file__).resolve().parent / "fixtures" / "copilot-prompt.txt"


def _run(coro):
    return asyncio.run(coro)


class _Transport(httpx.AsyncBaseTransport):
    """One recorded answer per call, in order, and the requests are kept for inspection."""

    def __init__(self, answers: list[tuple[int, dict]]):
        self.answers = list(answers)
        self.seen: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        status, body = self.answers.pop(0) if self.answers else (500, {})
        return httpx.Response(status, json=body, request=request)


def _with_transport(monkeypatch, transport: _Transport):
    real = httpx.AsyncClient

    def build(*args, **kwargs):
        kwargs["transport"] = transport
        return real(*args, **kwargs)

    monkeypatch.setattr(copilot.httpx, "AsyncClient", build)


def gemini_envelope(text: str, tokens: int = 321) -> dict:
    return {
        "candidates": [{"content": {"parts": [{"text": text}], "role": "model"}, "finishReason": "STOP"}],
        "usageMetadata": {"promptTokenCount": 250, "candidatesTokenCount": 71, "totalTokenCount": tokens},
    }


def anthropic_envelope(text: str) -> dict:
    return {
        "id": "msg_e198", "type": "message", "role": "assistant", "model": "claude-fable-5-1",
        "content": [{"type": "text", "text": text}], "stop_reason": "end_turn",
        "usage": {"input_tokens": 400, "output_tokens": 90},
    }


GOOD = json.dumps({
    "reply": {"text": "Pulpo cocido is 8 kg short against today's book. Three orders carry it."},
    "proposals": [
        {"kind": "supply-report", "product": "Pulpo cocido", "orderIds": ["s-101", "s-103", "s-106"]},
        {"kind": "open-order", "orderId": "s-103"},
    ],
})


# ── THE PROMPT ──────────────────────────────────────────────────────────────────────────────

def test_the_prompt_is_the_same_two_strings_every_time():
    system, user = copilot.build_prompt(copilot.shape(REQUEST))
    again = copilot.build_prompt(copilot.shape(REQUEST))
    assert (system, user) == again
    assert "The person: Morning. What is on the book?" in user
    assert "You: Six orders for Monday 25.08." in user
    assert "THE ASK\nWhat is short for tomorrow?" in user


def test_the_prompt_is_the_snapshot_on_disk():
    """The Copilot's own words, held in a file. Edit them and this test shows the diff.

    Refresh with:  python3 -c "import sys;sys.path.insert(0,'.');from app import copilot;\
from tests.conftest import load;..."  — or simply delete the file and run once.
    """
    system, user = copilot.build_prompt(copilot.shape(REQUEST))
    whole = f"{system}\n\n===== USER =====\n\n{user}\n"
    if not SNAPSHOT.exists():
        SNAPSHOT.write_text(whole)
    assert SNAPSHOT.read_text() == whole, "the prompt moved — read the diff before refreshing the snapshot"


def test_an_ask_with_no_words_is_refused_by_name():
    with pytest.raises(RuntimeError_) as caught:
        copilot.shape({"ask": "   "})
    assert caught.value.code == "bad_request" and caught.value.status == 400


# ── THE CAPS ────────────────────────────────────────────────────────────────────────────────

def test_the_caps_are_this_service_s_own():
    fat = {
        "ask": "x" * 9000,
        "session": {"id": "s", "messages": [{"role": "person", "text": f"turn {i}"} for i in range(80)]},
        "context": {
            "day": "2025-08-25", "area": "sales", "document": None, "customer": None,
            "orders": [{"id": f"s-{i}", "number": f"A-{i}", "customer": "Bar", "state": "confirmed",
                        "flags": [], "lines": [{"product": "Merluza", "qty": 1, "unit": "kg"}] * 90}
                       for i in range(200)],
            "stock": [{"product": f"P{i}", "available": i, "unit": "kg"} for i in range(200)],
        },
    }
    shaped = copilot.shape(fat)
    assert len(shaped["ask"]) == copilot.MAX_ASK
    assert len(shaped["messages"]) == copilot.MAX_MESSAGES
    assert len(shaped["context"]["orders"]) == copilot.MAX_ORDERS
    assert len(shaped["context"]["stock"]) == copilot.MAX_STOCK
    assert len(shaped["context"]["orders"][0]["lines"]) == copilot.MAX_LINES
    # the LAST twenty turns, because a conversation's newest words are the ones that matter
    assert shaped["messages"][-1]["text"] == "turn 79"


def test_a_field_nobody_documented_never_reaches_a_provider():
    shaped = copilot.shape({"ask": "hi", "context": {"orders": [
        {"id": "s-1", "number": "A-1", "customer": "Bar", "state": "confirmed", "flags": [],
         "lines": [], "secret": "do not forward me"}]}})
    assert "secret" not in json.dumps(shaped)


# ── THE JSON, THE RETRY, THE GROUNDING ──────────────────────────────────────────────────────

def test_prose_around_the_object_is_still_read():
    answer = copilot.read("Here you go:\n```json\n" + GOOD + "\n```", copilot.shape(REQUEST)["context"])
    assert answer["reply"]["text"].startswith("Pulpo cocido is 8 kg short")


def test_an_answer_with_no_reply_text_is_refused_with_the_complaint_to_feed_back():
    with pytest.raises(copilot.Invalid) as caught:
        copilot.read(json.dumps({"proposals": []}), copilot.shape(REQUEST)["context"])
    assert "reply.text" in str(caught.value) or "`reply.text`" in str(caught.value)


def test_a_proposal_naming_an_order_that_is_not_here_is_dropped():
    context = copilot.shape(REQUEST)["context"]
    answer = copilot.read(json.dumps({
        "reply": {"text": "Two orders."},
        "proposals": [
            {"kind": "open-order", "orderId": "s-999"},
            {"kind": "open-order", "orderId": "s-103"},
            {"kind": "open-chat", "customerId": "c-nobody"},
            {"kind": "stock-note", "product": "Caviar", "text": "invented"},
            {"kind": "drafts", "drafts": [{"orderId": "s-999", "customer": "Nobody", "text": "hello"},
                                          {"orderId": "s-101", "customer": "Bar Nàutic", "text": "hello"}]},
        ],
    }), context)
    kinds = [proposal["kind"] for proposal in answer["proposals"]]
    assert kinds == ["open-order", "drafts"]
    assert answer["proposals"][0]["orderId"] == "s-103"
    assert [draft["orderId"] for draft in answer["proposals"][1]["drafts"]] == ["s-101"]


def test_an_order_named_by_its_number_lands_on_its_id():
    context = copilot.shape(REQUEST)["context"]
    answer = copilot.read(json.dumps({"reply": {"text": "There."},
                                      "proposals": [{"kind": "open-order", "orderId": "A-2453"}]}), context)
    assert answer["proposals"] == [{"kind": "open-order", "orderId": "s-103"}]


def test_a_kind_nobody_defined_is_dropped():
    context = copilot.shape(REQUEST)["context"]
    answer = copilot.read(json.dumps({"reply": {"text": "x"},
                                      "proposals": [{"kind": "delete-everything", "orderId": "s-101"}]}), context)
    assert answer["proposals"] == []


def test_the_retry_is_one_and_it_carries_the_complaint(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    transport = _Transport([(200, gemini_envelope("not json at all")), (200, gemini_envelope(GOOD))])
    _with_transport(monkeypatch, transport)
    answer = _run(copilot.ask(REQUEST))
    assert len(transport.seen) == 2, "one retry, never two"
    second = json.loads(transport.seen[1].content)
    assert [turn["role"] for turn in second["contents"]] == ["user", "model", "user"]
    assert "not valid JSON" in second["contents"][2]["parts"][0]["text"]
    assert answer["reply"]["text"].startswith("Pulpo cocido is 8 kg short")
    assert answer["evidence"]["tokens"] == 642, "both attempts are counted — the retry was not free"


def test_two_unreadable_answers_end_in_an_honest_sentence(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    _with_transport(monkeypatch, _Transport([(200, gemini_envelope("nope")), (200, gemini_envelope("still nope"))]))
    answer = _run(copilot.ask(REQUEST))
    assert answer["reply"]["text"] == copilot.RETRY_SENTENCE
    assert answer["proposals"] == [{"kind": "answer"}]
    assert answer["evidence"]["model"] == config.settings.gemini_model


def test_the_honest_sentence_says_what_is_rather_than_what_failed():
    """The copy law: a sentence about the failure is a sentence about the wrong subject."""
    said = copilot.RETRY_SENTENCE.lower()
    for negative in (" not ", " no ", "n't", "unable", "could not", "failed", "sorry"):
        assert negative not in said, f"«{negative.strip()}» spends the reader's attention on the wrong thing"


# ── THE SEAM ────────────────────────────────────────────────────────────────────────────────

def test_the_gemini_road_is_the_documented_one(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    monkeypatch.setattr(config.settings, "gemini_model", "gemini-2.5-flash", raising=False)
    transport = _Transport([(200, gemini_envelope(GOOD, tokens=321))])
    _with_transport(monkeypatch, transport)
    answer = _run(copilot.ask(REQUEST))
    request = transport.seen[0]
    assert request.url.path.endswith("/models/gemini-2.5-flash:generateContent")
    assert request.headers["x-goog-api-key"] == "a-key"
    body = json.loads(request.content)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["systemInstruction"]["parts"][0]["text"].startswith("You are the Copilot in Rocoto")
    assert answer["evidence"] == {"model": "gemini-2.5-flash", "ms": answer["evidence"]["ms"], "tokens": 321}


def test_the_anthropic_road_is_the_documented_one(monkeypatch):
    """§199.3 — «Claude is the first choice the moment the API credit exists.» The road is built
    and proven; what it is waiting on is credit, never code (§199.6)."""
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "anthropic", raising=False)
    transport = _Transport([(200, anthropic_envelope(GOOD))])
    _with_transport(monkeypatch, transport)
    answer = _run(copilot.ask(REQUEST))
    request = transport.seen[0]
    assert request.url.path == "/v1/messages"
    assert request.headers["anthropic-version"] == "2023-06-01"
    assert request.headers["x-api-key"] == "sk-ant-a-key"
    body = json.loads(request.content)
    assert body["model"] == "claude-fable-5-1"
    assert "thinking" not in body, "thinking is always on for this model and takes no parameter"
    assert answer["evidence"]["model"] == "claude-fable-5-1"
    assert answer["evidence"]["tokens"] == 490


def test_a_real_recorded_gemini_envelope_is_read_the_way_the_seam_reads_it(monkeypatch):
    """`copilot-gemini-answer.json` is a REAL v1beta `generateContent` answer to the prompt this
    module builds — recorded 2026-09-05, envelope and all (it even carries a `thoughtSignature`
    the seam ignores). What is asserted is what the seam MAKES of it: the JSON inside `parts`,
    the total token count, and every order id held inside the six-order fixture."""
    recorded = load("copilot-gemini-answer.json")
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    _with_transport(monkeypatch, _Transport([(200, recorded)]))
    answer = _run(copilot.ask(REQUEST))
    assert answer["reply"]["text"], "the recorded reply survives the envelope"
    assert answer["evidence"]["tokens"] == recorded["usageMetadata"]["totalTokenCount"]
    known = {order["id"] for order in copilot.shape(REQUEST)["context"]["orders"]}
    named = [one for proposal in answer["proposals"] for one in proposal.get("orderIds", [])]
    assert named and set(named) <= known, "a recorded live answer names only the day's own orders"

def test_the_anthropic_road_reaches_anthropic_and_says_what_it_waits_on(monkeypatch):
    """`copilot-anthropic-refusal.json` is what api.anthropic.com ACTUALLY answered this key on
    2026-09-05, replayed through the seam: the road is built and the account holds no credit
    (§199.6). The moment the credit exists, `COPILOT_MODEL=anthropic` is the whole change."""
    recorded = load("copilot-anthropic-refusal.json")
    assert recorded["status"] == 400
    assert "credit balance is too low" in recorded["body"]["error"]["message"].lower()
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "anthropic", raising=False)
    _with_transport(monkeypatch, _Transport([(recorded["status"], recorded["body"])]))
    with pytest.raises(RuntimeError_) as caught:
        _run(copilot.ask(REQUEST))
    assert caught.value.code == "copilot_failed"
    assert "400" in caught.value.message and "credit" not in caught.value.message.lower(), \
        "the kit is told a provider failed, never the account's billing state"


def test_a_provider_that_refuses_is_a_named_failure_the_kit_can_stand_on(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    _with_transport(monkeypatch, _Transport([(429, {"error": {"code": 429}})]))
    with pytest.raises(RuntimeError_) as caught:
        _run(copilot.ask(REQUEST))
    assert caught.value.code == "copilot_failed" and caught.value.status == 502


def test_a_missing_key_refuses_rather_than_proceeding(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    with pytest.raises(RuntimeError_) as caught:
        _run(copilot.ask(REQUEST))
    assert caught.value.code == "copilot_unconfigured" and caught.value.status == 503


# ── HEALTH SAYS WHICH MIND ANSWERS ──────────────────────────────────────────────────────────

def test_health_names_the_mind_rather_than_a_key(monkeypatch, client):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    assert client.get("/api/health").json()["providers"]["copilot"] == "gemini"
    monkeypatch.setattr(config.settings, "copilot_model", "anthropic", raising=False)
    assert client.get("/api/health").json()["providers"]["copilot"] == "awaiting key"
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-a-key", raising=False)
    assert client.get("/api/health").json()["providers"]["copilot"] == "anthropic"
    monkeypatch.setattr(config.settings, "gemini_key", "", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    assert client.get("/api/health").json()["providers"]["copilot"] == "awaiting key"


def test_neither_key_survives_a_log_line(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_key", "AIzaSyE198_THIS_IS_A_SECRET", raising=False)
    monkeypatch.setattr(config.settings, "anthropic_key", "sk-ant-api03-E198-SECRET-VALUE", raising=False)
    line = "gemini said key=AIzaSyE198_THIS_IS_A_SECRET and anthropic said sk-ant-api03-E198-SECRET-VALUE"
    assert "AIzaSyE198_THIS_IS_A_SECRET" not in config.redact(line)
    assert "sk-ant-api03-E198-SECRET-VALUE" not in config.redact(line)


def test_the_endpoint_answers_the_kit_s_own_shape(monkeypatch, client):
    monkeypatch.setattr(config.settings, "gemini_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "copilot_model", "gemini", raising=False)
    _with_transport(monkeypatch, _Transport([(200, gemini_envelope(GOOD))]))
    body = client.post("/api/copilot", json=REQUEST).json()
    assert set(body) == {"reply", "proposals", "evidence"}
    assert set(body["evidence"]) == {"model", "ms", "tokens"}
    assert body["proposals"][0]["kind"] == "supply-report"


# ── THE LIVE LEG ────────────────────────────────────────────────────────────────────────────

def test_the_real_mind_answers_the_six_order_day():
    """A REAL call to Google, over the six-order fixture, asserting a grounded supply report.

    Skips without a key, and skips on Google's free-tier day quota — twenty requests per model per
    project per day, which is a fact about the account rather than about this code. Every other
    outcome fails: a wrong shape, an unreadable answer, an order the day does not hold.
    """
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        pytest.skip("GEMINI_API_KEY is unset — the live leg needs the house's own key")
    config.settings.gemini_key = key
    config.settings.copilot_model = "gemini"
    try:
        answer = _run(copilot.ask(REQUEST))
    except RuntimeError_ as error:
        if "429" in error.message:
            pytest.skip(f"the free-tier day quota is spent for {config.settings.gemini_model}")
        raise
    assert answer["reply"]["text"].strip(), "the mind said something"
    assert answer["evidence"]["model"] == config.settings.gemini_model
    assert answer["evidence"]["tokens"] > 0
    reports = [one for one in answer["proposals"] if one["kind"] == "supply-report"]
    assert reports, f"a supply question earns a supply report — got {answer['proposals']}"
    known = {order["id"] for order in copilot.shape(REQUEST)["context"]["orders"]}
    for report in reports:
        assert report["orderIds"], "a supply report names the orders it touches"
        assert set(report["orderIds"]) <= known, "and every one of them is on this day's book"
    if os.getenv("ROCOTO_RECORD") == "1":
        (FIXTURES / "copilot-live-answer.json").write_text(json.dumps(answer, ensure_ascii=False, indent=2) + "\n")
