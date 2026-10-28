"""THE WAIT, AND WHAT IT COSTS THE PERSON HOLDING THE PHONE (§PAR-10 · E195.10 · E195.11).

THE DEFECT, off the live runtime's journal — the 67 reads between 14:01:27 and 20:17:13 on
2026-09-04, which is the whole retained journal up to the deploy restart at 20:21:50: fastest
40 433 ms, p50 111 000 ms, p90 162 587 ms, slowest 214 278 ms (percentiles nearest-rank). Every
value sat on one of the rungs 41 · 60 · 86 · 112 · 137 · 162 · 188 · 214 s — the old ladder's own
cumulative sleep (5 s growing ×1.4 to a 25 s cap) plus the setup.

Measured on the box with a 2 s probe (`tools/parse-floor-probe.py`, E195.10), live reads of the same
one-page albarán: the provider finished at **53.8 · 56.7 · 58.3 · 62.7 · 72.9 · 74.7 · 77.4 · 81.9 ·
105.0 · 119.8 s**. The floor is the provider's; the rest of the wait was the ladder asking too
rarely.

These tests hold the three halves of the fix and, above all, the thing the fix may not touch:
§PAR-03.3's done-definition. A wait that returns early is worse than a wait that is slow, because a
half-run project reads as a finished read. The gate added in the repair round is held to the same
rule from both sides — it may delay the question, and it may never answer it.

Nothing here calls a provider. The client is a fake with a stated script, and it counts every
request, so «the expensive endpoint is asked rarely», «the gate carries the frequent question» and
«the ten agent POSTs go together» are measurements rather than intentions.
"""
from __future__ import annotations

import asyncio
import time

import pytest
from conftest import load

from app import parsewise
from app.errors import RuntimeError_

BASE = "https://api.parsewise.ai/api/v1"


# ── THE LADDER, AS ARITHMETIC ────────────────────────────────────────────────────────────────────

def rungs(first: float, growth: float, cap: float, until: float) -> list[float]:
    """The elapsed times at which a ladder asks, up to `until` seconds."""
    out: list[float] = []
    clock, delay = 0.0, first
    while clock < until:
        clock += delay
        delay = min(delay * growth, cap)
        out.append(round(clock, 3))
    return out


def overshoot(first: float, growth: float, cap: float, finished_at: float) -> float:
    """How long a person waits AFTER the provider is done, because the ladder had not asked yet."""
    for rung in rungs(first, growth, cap, finished_at + cap * 4):
        if rung >= finished_at:
            return rung - finished_at
    raise AssertionError("the ladder never reached the finish")


def test_the_answer_lands_within_four_seconds_of_the_provider_finishing():
    """The five measured finishes, and what each one costs beyond the provider's own time.

    RED on the ladder this replaced: 5 s ×1.4 to a 25 s cap overshoots 81.9 s by 22.7 s.
    """
    for finished in (53.8, 56.7, 58.3, 62.7, 72.9, 74.7, 77.4, 81.9, 105.0, 119.8):
        waste = overshoot(parsewise.POLL_FIRST, parsewise.POLL_GROWTH, parsewise.POLL_CAP, finished)
        assert waste <= parsewise.POLL_CAP, f"{finished}s finish reported {waste}s late"
    assert parsewise.POLL_CAP <= 4.0
    assert parsewise.POLL_FIRST <= 2.0
    # And the ladder that WAS here, kept as the measurement it is: the same reads, 22.7 s late.
    assert overshoot(5.0, 1.4, 25.0, 81.9) > 20.0


def test_the_first_question_is_asked_inside_two_seconds():
    """A read that fails at the provider says so quickly; the old first rung was five seconds."""
    assert rungs(parsewise.POLL_FIRST, parsewise.POLL_GROWTH, parsewise.POLL_CAP, 10)[0] <= 2.0


# ── A FAKE PROVIDER, WITH A STATED SCRIPT ────────────────────────────────────────────────────────

class Answer:
    def __init__(self, payload, status: int = 200):
        self.payload = payload
        self.status_code = status

    def json(self):
        return self.payload


class FakeClient:
    """Answers the eight calls `read_raw` makes, counting each one and timing the overlaps.

    `agent_states` is a list of the per-poll answers to `GET /agents/`; `running` the matching
    answers to `GET /agents/status/`. Both hold their last value once exhausted.
    """

    def __init__(self, agent_states=None, running=None, results=None, slow: float = 0.0, gate=None):
        self.agent_states = agent_states or [["Processed"] * 10]
        self.running = running if running is not None else [False]
        # `gate` is the script for the compact `GET /projects/{id}/status/`. It defaults to «quiet»
        # so every test written before the gate existed still exercises the same rungs.
        self.gate = gate if gate is not None else [False]
        self.gate_polls = 0
        self.results = results if results is not None else {"results": []}
        self.slow = slow
        self.calls: list[str] = []
        self.poll = 0
        self.status_polls = 0
        self.inflight = 0
        self.peak_agent_posts = 0
        self.peak_any = 0
        self.deleted: list[str] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    def _tail(self, url: str) -> str:
        return url[len(BASE):] if url.startswith(BASE) else url

    async def _busy(self, tag: str):
        self.inflight += 1
        self.peak_any = max(self.peak_any, self.inflight)
        if tag == "agent-post":
            self.peak_agent_posts = max(self.peak_agent_posts, self.inflight)
        try:
            if self.slow:
                await asyncio.sleep(self.slow)
        finally:
            self.inflight -= 1

    async def post(self, url, **_kw):
        path = self._tail(url)
        self.calls.append("POST " + path)
        if path == "/projects/":
            await self._busy("project")
            return Answer({"id": "proj-1"})
        if path.endswith("/documents/"):
            await self._busy("setup")
            return Answer({"documents": [{"id": "doc-1"}]})
        if path.endswith("/dimensions/"):
            await self._busy("setup")
            return Answer({"id": "dim-1"})
        if path.endswith("/agents/launch/"):
            await self._busy("launch")
            return Answer({})
        if path.endswith("/agents/"):
            await self._busy("agent-post")
            return Answer({"id": "agent"})
        raise AssertionError("unscripted POST " + path)

    async def get(self, url, **_kw):
        path = self._tail(url)
        self.calls.append("GET " + path)
        if path.endswith("/agents/status/"):
            index = min(self.status_polls, len(self.running) - 1)
            self.status_polls += 1
            value = self.running[index]
            if isinstance(value, int) and value >= 400:
                return Answer({}, value)
            return Answer({"pipeline_running": value})
        if path.endswith("/agents/"):
            index = min(self.poll, len(self.agent_states) - 1)
            self.poll += 1
            states = self.agent_states[index]
            if isinstance(states, int) and states >= 400:
                return Answer({}, states)
            return Answer([{"extraction_status": s} for s in states])
        if path.endswith("/status/"):          # the project's own compact status — the GATE
            index = min(self.gate_polls, len(self.gate) - 1)
            self.gate_polls += 1
            value = self.gate[index]
            if isinstance(value, int) and value >= 400:
                return Answer({}, value)
            return Answer({"pipeline_running": value})
        if path.endswith("/results/"):
            return Answer(self.results)
        raise AssertionError("unscripted GET " + path)

    async def delete(self, url, **_kw):
        self.deleted.append(self._tail(url))
        return Answer(None, 204)


@pytest.fixture()
def fast(monkeypatch):
    """The ladder, shrunk so the suite does not sit through a real wait. The SHAPE is the same."""
    monkeypatch.setattr(parsewise, "POLL_FIRST", 0.001)
    monkeypatch.setattr(parsewise, "POLL_GROWTH", 1.0)
    monkeypatch.setattr(parsewise, "POLL_CAP", 0.001)
    monkeypatch.setattr(parsewise.settings, "parsewise_key", "pw_live_test_key_value", raising=False)


def wait_on(client: FakeClient) -> tuple[float, int]:
    return asyncio.run(parsewise._wait(client, "proj-1", time.time()))


# ── §PAR-03.3 · THE DONE-DEFINITION, WHICH DOES NOT MOVE ─────────────────────────────────────────

def test_done_is_both_halves_agreeing(fast):
    client = FakeClient(agent_states=[["Pending"] * 10, ["Processed"] * 10], running=[False])
    waited, polls = wait_on(client)
    assert polls == 2 and waited >= 0
    assert client.deleted == []  # the wait deletes nothing; §PAR-03.6's delete is the caller's


def test_a_pending_agent_is_never_done_however_quiet_the_pipeline_is(fast, monkeypatch):
    """`pipeline_running=false` alone also happens on a cancelled or failed run (§PAR-03.3).

    RED the moment anyone drops the per-agent half: this run would return instead of timing out.
    """
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(agent_states=[["Processed"] * 9 + ["Pending"]], running=[False])
    with pytest.raises(RuntimeError_) as raised:
        wait_on(client)
    assert raised.value.code == "parsewise_timeout"


def test_a_running_pipeline_is_never_done_however_finished_the_agents_look(fast, monkeypatch):
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(agent_states=[["Processed"] * 10], running=[True])
    with pytest.raises(RuntimeError_) as raised:
        wait_on(client)
    assert raised.value.code == "parsewise_timeout"


def test_no_result_is_a_finished_agent_and_not_a_failure(fast):
    client = FakeClient(agent_states=[["Processed"] * 9 + ["No Result"]], running=[False])
    _, polls = wait_on(client)
    assert polls == 1


def test_an_empty_agent_list_is_not_a_finished_read(fast, monkeypatch):
    """Zero agents would satisfy `all(...)` vacuously — and a project with no agents read nothing."""
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(agent_states=[[]], running=[False])
    with pytest.raises(RuntimeError_):
        wait_on(client)


def test_a_provider_hiccup_is_retried_rather_than_believed(fast):
    client = FakeClient(agent_states=[503, ["Processed"] * 10], running=[502, False])
    _, polls = wait_on(client)
    assert polls == 3, "one bad agents/ answer and one bad status answer, then the truth"


# ── WHAT THE LOOP COSTS THE PROVIDER ─────────────────────────────────────────────────────────────

def test_the_expensive_endpoint_is_left_alone_while_the_agents_are_pending(fast):
    """Parsewise's own guidance on `/agents/status/`: «more expensive… we recommend polling this
    endpoint only while `pipeline_running` is true».

    RED on the loop this replaced, which asked it on every rung: ten rungs, ten calls.
    """
    client = FakeClient(agent_states=[["Pending"] * 10] * 9 + [["Processed"] * 10], running=[False])
    _, polls = wait_on(client)
    assert polls == 10
    assert client.calls.count("GET /projects/proj-1/agents/status/") == 1
    assert client.calls.count("GET /projects/proj-1/agents/") == 10


# ── THE GATE: IT MAY DELAY THE QUESTION, AND IT MAY NEVER ANSWER IT ──────────────────────────────

def test_the_gate_carries_the_frequent_question(fast):
    """Parsewise's schema on `GET /projects/{id}/status/`: «Compact processing status for a project,
    intended for frequent polling (for example, every 5 seconds)». So that is the endpoint asked
    every rung, and the two calls carrying §PAR-03.3's predicate are asked when it opens.

    Ten rungs, the pipeline running for nine of them: ten gate calls, and the agents list is read
    twice — once on the fifth rung, which asks anyway, and once when the gate opens.

    RED on the loop this replaced, which read the agents list on every rung: ten agent reads.
    """
    # `agent_states` is scripted per CALL, and the gate only lets two through.
    client = FakeClient(gate=[True] * 9 + [False],
                        agent_states=[["Pending"] * 10, ["Processed"] * 10],
                        running=[False])
    _, polls = wait_on(client)
    assert polls == 10
    assert client.calls.count("GET /projects/proj-1/status/") == 10
    assert client.calls.count("GET /projects/proj-1/agents/") == 2
    assert client.calls.count("GET /projects/proj-1/agents/status/") == 1


def test_the_gate_cannot_finish_a_read_by_itself(fast, monkeypatch):
    """A quiet gate is permission to ask, never an answer. Agents still Pending → still waiting.

    RED the moment anyone returns on the gate's own flag: this read would come back finished with
    ten agents that had not run.
    """
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(gate=[False], agent_states=[["Pending"] * 10], running=[False])
    with pytest.raises(RuntimeError_) as raised:
        wait_on(client)
    assert raised.value.code == "parsewise_timeout"
    assert client.calls.count("GET /projects/proj-1/agents/") >= 1, "it asked the real question"


def test_a_gate_that_never_opens_cannot_hold_a_read_open(fast, monkeypatch):
    """Every GATE_EVERY-th rung asks the full pair whatever the gate said.

    So a gate that lagged for ever, or stuck at `true`, costs a finished read GATE_EVERY rungs —
    about twenty seconds — and never the read. RED without the belt: this run times out (the budget
    is shortened here so that red arrives in milliseconds rather than minutes).
    """
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(gate=[True], agent_states=[["Processed"] * 10], running=[False])
    _, polls = wait_on(client)
    assert polls == parsewise.GATE_EVERY
    assert client.calls.count("GET /projects/proj-1/agents/") == 1


def test_a_gate_answering_500_does_not_slow_the_read(fast):
    """A gate that is not answering is not permission to wait: the loop asks the real question."""
    client = FakeClient(gate=[503], agent_states=[["Processed"] * 10], running=[False])
    _, polls = wait_on(client)
    assert polls == 1


def test_the_gate_is_asked_before_the_expensive_endpoint_every_time(fast):
    """The order on the wire, stated: gate, then the agents list, then the expensive status."""
    client = FakeClient(gate=[True, False], agent_states=[["Processed"] * 10], running=[False])
    wait_on(client)
    polls = [call for call in client.calls if call.startswith("GET")]
    assert polls == [
        "GET /projects/proj-1/status/",
        "GET /projects/proj-1/status/",
        "GET /projects/proj-1/agents/",
        "GET /projects/proj-1/agents/status/",
    ]


# ── THE SETUP, WHICH NO LONGER QUEUES ────────────────────────────────────────────────────────────

def read_raw_with(client: FakeClient, kind: str = "albaran"):
    return asyncio.run(parsewise.read_raw(b"bytes", "albaran.png", "image/png", kind))


@pytest.fixture()
def fake_httpx(monkeypatch):
    holder: dict[str, FakeClient] = {}

    class Shim:
        Timeout = parsewise.httpx.Timeout

        @staticmethod
        def AsyncClient(**_kw):  # noqa: N802 — it stands in for httpx's own name
            return holder["client"]

    monkeypatch.setattr(parsewise, "httpx", Shim)
    return holder


def test_the_ten_agent_posts_are_in_flight_together(fast, fake_httpx):
    """RED on the loop this replaced, which awaited each POST before writing the next: peak 1.

    Measured on the box, this is the difference between a 2.93 s and a 1.60 s setup.
    """
    client = FakeClient(agent_states=[["Processed"] * 10], running=[False], slow=0.02)
    fake_httpx["client"] = client
    read_raw_with(client)
    assert client.peak_agent_posts == 10
    assert client.calls.count("POST /projects/proj-1/agents/") == 10


def test_the_document_and_the_dimension_go_together(fast, fake_httpx):
    """Neither knows about the other, so neither waits for the other. RED on the old shape: peak 1."""
    class Watch(FakeClient):
        def __init__(self, **kw):
            super().__init__(**kw)
            self.setup_peak = 0

        async def _busy(self, tag):
            if tag == "setup":
                self.inflight += 1
                self.setup_peak = max(self.setup_peak, self.inflight)
                try:
                    await asyncio.sleep(0.02)
                finally:
                    self.inflight -= 1
                return
            await super()._busy(tag)

    client = Watch(agent_states=[["Processed"] * 10], running=[False])
    fake_httpx["client"] = client
    read_raw_with(client)
    assert client.setup_peak == 2


def test_the_read_hands_back_the_provider_body_untouched(fast, fake_httpx):
    """The contract does not move: `read_raw` returns exactly what Parsewise answered (§PAR-08)."""
    recorded = load("parsewise-albaran-result.json")
    client = FakeClient(agent_states=[["Processed"] * 10], running=[False], results=recorded)
    fake_httpx["client"] = client
    assert read_raw_with(client) == recorded


def test_the_project_is_deleted_and_the_document_dies_with_it(fast, fake_httpx):
    """§PAR-03.6 · SRC-PRIV-07 — the customer's paper lives at the provider for one read only."""
    client = FakeClient(agent_states=[["Processed"] * 10], running=[False])
    fake_httpx["client"] = client
    read_raw_with(client)
    assert client.deleted == ["/projects/proj-1/"]


def test_a_read_that_fails_still_deletes_the_project(fast, fake_httpx, monkeypatch):
    monkeypatch.setattr(parsewise.settings, "parsewise_budget_seconds", 0.05, raising=False)
    client = FakeClient(agent_states=[["Pending"] * 10], running=[True])
    fake_httpx["client"] = client
    with pytest.raises(RuntimeError_):
        read_raw_with(client)
    assert client.deleted == ["/projects/proj-1/"], "a timed-out read leaves nothing behind either"


def test_the_order_of_the_calls_is_the_pipeline_the_spec_states(fast, fake_httpx):
    client = FakeClient(agent_states=[["Processed"] * 10], running=[False])
    fake_httpx["client"] = client
    read_raw_with(client)
    order = [call for call in client.calls if call.startswith("POST")]
    assert order[0] == "POST /projects/"
    assert set(order[1:3]) == {"POST /projects/proj-1/documents/", "POST /projects/proj-1/dimensions/"}
    assert order[3:13] == ["POST /projects/proj-1/agents/"] * 10
    assert order[13] == "POST /projects/proj-1/agents/launch/"
