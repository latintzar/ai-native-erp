"""The artwork road, against the recorded provider answers (FEED-IA §200.2).

What this suite guards is the half that changes when someone edits this repo: the SUBJECT SWAP —
one substring and nothing else — the reading of the provider's two answers, and the refusals. The
live call itself is owed a key (THE-RUNTIME-SPEC RUN-12), and a suite that pretended otherwise would
be the one thing the runtime's own law forbids: a fabricated result.
"""
from __future__ import annotations

import json

import pytest
from conftest import load

from app import artwork
from app.errors import RuntimeError_

HOUSE_SECRET = "house-artwork-secret-0123456789"  # 30 characters, past the floor


@pytest.fixture(autouse=True)
def empty_hour():
    """The ceiling counts across a whole process, so each test is handed an empty hour.

    Without this the suite would be order-dependent in the one way that matters: a test that
    reached the wire would leave a spend behind and a later ceiling test would read it.
    """
    artwork._SPENT.clear()
    yield
    artwork._SPENT.clear()


DESCRIBED = load("ideogram-describe.json")["descriptions"][0]["text"]
GENERATION = load("ideogram-generation.json")

FRESH = "a single raw red prawn, a deep scarlet shell with long fine antennae and a curled tail"
FROZEN = ("a single frozen raw red prawn, its deep scarlet shell dulled under a bloom of white frost "
          "and fine ice crystals, long fine antennae and a curled tail")


def test_the_swap_changes_the_subject_and_nothing_else():
    """The whole discipline: the medium, the light, the ground and the framing survive verbatim."""
    prompt = artwork.swap_subject(DESCRIBED, FRESH, FROZEN)
    assert FROZEN in prompt
    assert FRESH not in prompt
    # every word of the description that is not the subject is still there, in order
    head, tail = DESCRIBED.split(FRESH)
    assert prompt == head + FROZEN + tail
    for phrase in ("Studio Ghibli", "Claude Monet's impressionism", "plain pure white background",
                   "three quarters of the frame", "soft ground-contact shadow"):
        assert phrase in prompt


def test_words_absent_from_the_description_are_refused_by_name():
    """Fail closed. «Which words were the subject» is not a question this service may guess."""
    with pytest.raises(RuntimeError_) as raised:
        artwork.swap_subject(DESCRIBED, "a single langoustine", FROZEN)
    assert raised.value.code == "subject_not_found"
    assert raised.value.status == 422


def test_words_that_occur_twice_are_refused_by_name():
    """A second occurrence makes «replace the subject» ambiguous, so it names a longer phrase."""
    doubled = DESCRIBED + " " + DESCRIBED
    with pytest.raises(RuntimeError_) as raised:
        artwork.swap_subject(doubled, FRESH, FROZEN)
    assert raised.value.code == "subject_ambiguous"


def test_an_empty_swap_is_a_bad_request():
    with pytest.raises(RuntimeError_) as raised:
        artwork.swap_subject(DESCRIBED, "", FROZEN)
    assert raised.value.code == "bad_request"


def test_the_description_is_read_verbatim_out_of_the_provider_s_answer():
    assert artwork.read_description(load("ideogram-describe.json")) == DESCRIBED
    assert artwork.read_description({"description": "plain shape"}) == "plain shape"
    assert artwork.read_description({"descriptions": ["a bare string"]}) == "a bare string"


def test_a_description_with_no_text_is_a_named_failure():
    """An unreadable description must never become an empty prompt that still generates something."""
    with pytest.raises(RuntimeError_) as raised:
        artwork.read_description({"descriptions": [{}]})
    assert raised.value.code == "describe_unreadable"


def test_a_generation_is_running_done_or_failed_and_says_which():
    running = artwork.read_generation(GENERATION["running"])
    assert running["state"] == "running" and running["generation_id"]

    done = artwork.read_generation(GENERATION["completed"])
    assert done["state"] == "done"
    assert done["url"].endswith(".png")
    assert done["cost_usd_micros"] == 80000
    assert done["safety"] == "safe"

    failed = artwork.read_generation(GENERATION["failed"])
    assert failed["state"] == "failed" and failed["failure"] == "content policy"


def test_a_word_this_service_has_never_seen_keeps_polling():
    """The poll has a ceiling; treating an unknown status as failure would throw away a live job."""
    assert artwork.read_generation({"status": "SOMETHING_NEW", "generation_id": "g"})["state"] == "running"


def test_a_completed_generation_with_no_image_is_a_failure_not_a_success():
    assert artwork.read_generation({"status": "COMPLETED", "data": []})["state"] == "failed"


def test_the_slug_is_the_library_s_own_file_name():
    assert artwork.slug_for("Gamba roja · congelado") == "gamba-roja-congelado"
    assert artwork.slug_for("Jamón al corte") == "jamon-al-corte"
    assert artwork.slug_for("Patata monalisa") == "patata-monalisa"


def test_without_a_key_the_road_refuses_by_name(monkeypatch):
    """«awaiting key» is a state, never a fake painting."""
    import asyncio

    from app import config

    monkeypatch.setattr(config.settings, "ideogram_key", "", raising=False)
    with pytest.raises(RuntimeError_) as raised:
        asyncio.run(artwork.paint(name="Gamba roja · congelado", reference="gamba-roja",
                                  description=DESCRIBED, replace=FRESH, subject=FROZEN))
    assert raised.value.code == "artwork_awaiting_key"
    assert raised.value.status == 503


def test_health_says_artwork_is_configured_or_awaiting_key(client, monkeypatch):
    """Both halves, the way Twilio needs both: credit to spend, and a secret naming who spends it."""
    from app import config

    monkeypatch.setattr(config.settings, "ideogram_key", "", raising=False)
    monkeypatch.setattr(config.settings, "artwork_secret", "", raising=False)
    assert config.settings.providers["artwork"] == "awaiting key"

    monkeypatch.setattr(config.settings, "ideogram_key", "a-key", raising=False)
    assert config.settings.providers["artwork"] == "awaiting key", "credit with no door is not open"

    monkeypatch.setattr(config.settings, "artwork_secret", HOUSE_SECRET, raising=False)
    assert config.settings.providers["artwork"] == "configured"

    monkeypatch.setattr(config.settings, "artwork_secret", "short", raising=False)
    assert config.settings.providers["artwork"] == "awaiting key", "a placeholder is not a secret"
    assert "artwork" in client.get("/api/health").json()["providers"]


def test_the_endpoint_refuses_a_call_with_no_reference(client, monkeypatch):
    """Past the door, the body is read as before — and a malformed request costs nothing."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", HOUSE_SECRET, raising=False)
    answer = client.post("/api/artwork", json={"name": "Gamba roja · congelado"},
                         headers={artwork.HOUSE_HEADER: HOUSE_SECRET})
    assert answer.json()["error"]["code"] == "bad_request"
    assert not artwork._SPENT, "a request that never reached Ideogram spent nothing"


# ── THE DOOR · this road spends generation credit, so reaching the box is not permission ──────

def test_the_road_waits_for_a_house_secret_before_it_spends_anything(client, monkeypatch):
    """With no ARTWORK_SHARED_SECRET the door is shut and says which configuration opens it."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", "", raising=False)
    answer = client.post("/api/artwork", json={"reference": "gamba-roja", "describe_only": True})
    assert answer.status_code == 503
    assert answer.json()["error"]["code"] == "artwork_awaiting_secret"
    assert "ARTWORK_SHARED_SECRET" in answer.json()["error"]["message"]


def test_a_placeholder_is_not_a_secret(client, monkeypatch):
    """`ARTWORK_SHARED_SECRET=changeme` would be a door that looks locked. The floor is 24."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", "changeme", raising=False)
    answer = client.post("/api/artwork", json={"reference": "gamba-roja", "describe_only": True},
                         headers={artwork.HOUSE_HEADER: "changeme"})
    assert answer.status_code == 503
    assert answer.json()["error"]["code"] == "artwork_awaiting_secret"


def test_a_caller_without_the_house_secret_is_refused_by_name(client, monkeypatch):
    """The whole point: anyone can reach kit.soyrocoto.com/api, and only the house may spend it."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", HOUSE_SECRET, raising=False)
    monkeypatch.setattr(config.settings, "ideogram_key", "a-key", raising=False)

    bare = client.post("/api/artwork", json={"reference": "gamba-roja", "describe_only": True})
    assert bare.status_code == 401 and bare.json()["error"]["code"] == "artwork_unauthorized"

    wrong = client.post("/api/artwork", json={"reference": "gamba-roja", "describe_only": True},
                        headers={artwork.HOUSE_HEADER: "house-artwork-secret-999999999"})
    assert wrong.status_code == 401 and wrong.json()["error"]["code"] == "artwork_unauthorized"
    assert not artwork._SPENT, "a refused caller never reached the provider"


def test_the_door_is_read_before_the_provider_key(client, monkeypatch):
    """Order matters: the house key opens the door, and THEN the runtime says what it still owes."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", HOUSE_SECRET, raising=False)
    monkeypatch.setattr(config.settings, "ideogram_key", "", raising=False)
    answer = client.post("/api/artwork", json={"reference": "gamba-roja", "describe_only": True},
                         headers={artwork.HOUSE_HEADER: HOUSE_SECRET})
    assert answer.status_code == 503
    assert answer.json()["error"]["code"] == "artwork_awaiting_key"


def test_the_house_key_travels_on_a_header_no_browser_can_send(client):
    """`X-Rocoto-Artwork-Key` is deliberately outside the CORS allow-list, so a page cannot try.

    The preflight is the proof: a browser asking to send that header is refused before the request
    is ever made, which makes this a road for the house's own tooling over the wire and nothing else.
    """
    asked = client.options("/api/artwork", headers={
        "Origin": "https://kit.soyrocoto.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": artwork.HOUSE_HEADER.lower(),
    })
    assert asked.status_code == 400
    assert artwork.HOUSE_HEADER.lower() not in (asked.headers.get("access-control-allow-headers") or "").lower()

    plain = client.options("/api/artwork", headers={
        "Origin": "https://kit.soyrocoto.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert plain.status_code == 200, "the allow-list itself is unchanged"


def test_the_hourly_ceiling_bounds_what_a_leaked_secret_could_spend(monkeypatch):
    """A count, not a hope: the loss from a leaked secret is this many provider calls an hour."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_hourly_ceiling", 2, raising=False)
    artwork.take_a_slot()
    artwork.take_a_slot()
    with pytest.raises(RuntimeError_) as raised:
        artwork.take_a_slot()
    assert raised.value.code == "artwork_ceiling_reached"
    assert raised.value.status == 429
    assert "2 times an hour" in raised.value.message
    assert "opens in" in raised.value.message


def test_a_ceiling_of_zero_paints_nothing_and_says_so(monkeypatch):
    """An operator who sets the ceiling to zero has closed the road, and the road agrees."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_hourly_ceiling", 0, raising=False)
    with pytest.raises(RuntimeError_) as raised:
        artwork.take_a_slot()
    assert raised.value.code == "artwork_ceiling_reached"


def test_the_hour_rolls(monkeypatch):
    """The window is rolling, so an hour-old call is not still counted against the next one."""
    from app import config

    monkeypatch.setattr(config.settings, "artwork_hourly_ceiling", 1, raising=False)
    artwork.take_a_slot()
    artwork._SPENT[0] -= artwork.CEILING_WINDOW + 1
    artwork.take_a_slot()
    assert len(artwork._SPENT) == 1


def test_the_house_secret_never_survives_a_log_line(monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "artwork_secret", HOUSE_SECRET, raising=False)
    line = f"POST /api/artwork {artwork.HOUSE_HEADER}: {HOUSE_SECRET}"
    assert HOUSE_SECRET not in config.redact(line)
    assert "[redacted]" in config.redact(line)


def test_a_secret_never_survives_the_artwork_road(monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "ideogram_key", "ideogram-SECRET-VALUE-0123456789", raising=False)
    line = "POST https://api.ideogram.ai/v1/ideogram-v4/async/generate Api-Key ideogram-SECRET-VALUE-0123456789"
    assert "ideogram-SECRET-VALUE-0123456789" not in config.redact(line)


def test_the_file_contract_is_the_library_s_own(client):
    """A painting that ships at another size or on another ground is not in the family."""
    assert artwork.FILE_CONTRACT["format"] == "webp"
    assert artwork.FILE_CONTRACT["canvas"] == 1024
    assert artwork.FILE_CONTRACT["alpha"] is False
    assert json.dumps(artwork.FILE_CONTRACT)  # it travels in a JSON response


# ── THE WIRE ──────────────────────────────────────────────────────────────────────────────────
# The tests above prove what this service MAKES of a provider's answer. These prove it can hold a
# conversation: multipart submit, the poll from running to done, the render URL that 404s for a
# moment and then answers. The server below speaks the pinned `ideogram-v4-async@1` adapter and
# nothing else — it proves this client's behaviour, and the live receipt stays owed with the key
# (THE-RUNTIME-SPEC RUN-11.8).

import base64
import http.server
import json as jsonlib
import socketserver
import threading

PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


class Ideogram(http.server.BaseHTTPRequestHandler):
    """The provider, as the adapter describes it — and it counts what it was asked."""

    polls = 0
    fetches = 0
    prompt_seen = ""

    def log_message(self, *_):
        pass

    def _send(self, payload, status=200, raw=None, content_type="application/json"):
        body = raw if raw is not None else jsonlib.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        assert self.headers.get("Api-Key") == "test-key-value-0123456789"
        assert b"multipart/form-data" in (self.headers.get("Content-Type") or "").encode()
        if self.path.endswith("/describe"):
            self._send({"descriptions": [{"text": DESCRIBED}]})
            return
        Ideogram.prompt_seen = body.decode("utf-8", "replace")
        self._send({"generation_id": "gen_wire", "status": "PENDING", "data": []})

    def do_GET(self):
        if self.path.startswith("/reference"):
            self._send(None, raw=b"reference-bytes", content_type="image/webp")
            return
        if self.path.startswith("/render"):
            Ideogram.fetches += 1
            if Ideogram.fetches == 1:
                self._send({"error": "not ready"}, status=404)
            else:
                self._send(None, raw=PIXEL, content_type="image/png")
            return
        Ideogram.polls += 1
        if Ideogram.polls == 1:
            self._send({"generation_id": "gen_wire", "status": "PENDING", "data": []})
        else:
            self._send({
                "generation_id": "gen_wire", "status": "COMPLETED",
                "reported_cost_usd_micros": 80000, "safety": "safe",
                "data": [{"url": f"http://127.0.0.1:{Ideogram.port}/render.png"}],
            })


def test_the_whole_road_runs_against_a_provider_that_speaks_the_adapter(monkeypatch):
    """Submit, poll, download — and the prompt on the wire is the description with one swap."""
    import asyncio

    from app import config

    Ideogram.polls = Ideogram.fetches = 0
    Ideogram.prompt_seen = ""
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", 0), Ideogram)
    Ideogram.port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{Ideogram.port}"
    try:
        monkeypatch.setattr(config.settings, "ideogram_key", "test-key-value-0123456789", raising=False)
        monkeypatch.setattr(config.settings, "ideogram_base", base, raising=False)
        monkeypatch.setattr(artwork, "POLL_EVERY", 0.01, raising=False)
        monkeypatch.setattr(artwork, "FETCH_EVERY", 0.01, raising=False)

        answer = asyncio.run(artwork.paint(
            name="Gamba roja · congelado",
            reference_url=f"{base}/reference.webp",
            replace=FRESH, subject=FROZEN,
        ))

        assert answer["slug"] == "gamba-roja-congelado"
        assert answer["description"] == DESCRIBED
        assert answer["prompt"] == DESCRIBED.replace(FRESH, FROZEN)
        assert FROZEN in Ideogram.prompt_seen, "the swapped prompt is what went on the wire"
        assert "Studio Ghibli" in Ideogram.prompt_seen, "the family's own words went with it"
        assert base64.b64decode(answer["image"]["data"]) == PIXEL
        assert answer["image"]["bytes"] == len(PIXEL)
        assert answer["provider"]["generation_id"] == "gen_wire"
        assert answer["provider"]["reported_cost_usd_micros"] == 80000
        assert Ideogram.polls >= 2, "it polled until the job was done"
        assert Ideogram.fetches >= 2, "a render URL that 404s for a moment is retried"
        assert len(artwork._SPENT) == 2, "a describe and a generation are two calls at the provider"
    finally:
        server.shutdown()
        server.server_close()


def test_a_job_that_never_finishes_names_its_generation(monkeypatch):
    """The quota's own signature: still running at the ceiling, and the id is in the sentence."""
    import asyncio

    from app import config

    class Stuck(Ideogram):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length") or 0))
            self._send({"generation_id": "gen_stuck", "status": "PENDING", "data": []})

        def do_GET(self):
            if self.path.startswith("/reference"):
                self._send(None, raw=b"reference-bytes", content_type="image/webp")
                return
            self._send({"generation_id": "gen_stuck", "status": "PENDING", "data": []})

    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", 0), Stuck)
    Stuck.port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{Stuck.port}"
    try:
        monkeypatch.setattr(config.settings, "ideogram_key", "test-key-value-0123456789", raising=False)
        monkeypatch.setattr(config.settings, "ideogram_base", base, raising=False)
        monkeypatch.setattr(artwork, "POLL_EVERY", 0.01, raising=False)
        monkeypatch.setattr(artwork, "POLL_CEILING", 0.05, raising=False)
        with pytest.raises(RuntimeError_) as raised:
            asyncio.run(artwork.paint(name="Gamba roja · congelado",
                                      reference_url=f"{base}/reference.webp",
                                      description=DESCRIBED, replace=FRESH, subject=FROZEN))
        assert raised.value.code == "generate_stalled"
        assert "gen_stuck" in raised.value.message
    finally:
        server.shutdown()
        server.server_close()
