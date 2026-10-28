"""A cached provider agent is insufficient evidence that caller isolation is ready."""

import asyncio

import httpx
import pytest

import config
import voice_toggle


@pytest.fixture
def voice(monkeypatch, tmp_path):
    agent_file = tmp_path / "agent"
    agent_file.write_text("agent-synthetic")
    monkeypatch.setattr(voice_toggle, "_RUNTIME_AGENT_FILE", agent_file)
    monkeypatch.setattr(config, "ELEVENLABS_API_KEY", "synthetic-key")
    monkeypatch.setattr(voice_toggle, "_marker_agent", "")
    monkeypatch.setattr(voice_toggle, "_marker_ready", None)
    return agent_file


def test_failed_provider_patch_degrades_cached_agent_then_success_recovers(monkeypatch, voice):
    patches = []
    fail = [True]

    def respond(request):
        if request.method == "GET":
            return httpx.Response(
                200, json={"conversation_config": {"agent": {"prompt": {"prompt": "Hello"}}}}
            )
        patches.append(request.content)
        return httpx.Response(503 if fail[0] else 200, json={})

    original = httpx.AsyncClient
    monkeypatch.setattr(
        voice_toggle.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    assert voice_toggle.available()
    assert not voice_toggle.healthy()
    assert voice_toggle.caller_marker_status() == "unverified"
    assert not asyncio.run(voice_toggle.ensure_caller_marker())
    assert voice_toggle.caller_marker_status() == "failed"
    assert not voice_toggle.healthy()
    fail[0] = False
    assert asyncio.run(voice_toggle.ensure_caller_marker())
    assert voice_toggle.healthy()
    assert all(b"[[CALLER:" in patch and b"[[CALL:" in patch for patch in patches)
    voice.write_text("replacement-agent")
    assert voice_toggle.caller_marker_status() == "unverified"
    assert not voice_toggle.healthy()


def test_existing_both_markers_verify_without_provider_mutation(monkeypatch, voice):
    methods = []

    def respond(request):
        methods.append(request.method)
        return httpx.Response(
            200,
            json={
                "conversation_config": {
                    "agent": {
                        "prompt": {
                            "prompt": "Hello [[CALLER:{{caller_number}}]] [[CALL:{{call_ref}}]]",
                        }
                    }
                }
            },
        )

    original = httpx.AsyncClient
    monkeypatch.setattr(
        voice_toggle.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    assert asyncio.run(voice_toggle.ensure_caller_marker())
    assert voice_toggle.healthy()
    assert methods == ["GET"]


def test_unexpected_failure_is_visible_and_later_retry_recovers(monkeypatch, voice):
    async def fail():
        raise RuntimeError("fixture")

    monkeypatch.setattr(voice_toggle, "_install_caller_marker", fail)
    assert not asyncio.run(voice_toggle.ensure_caller_marker())
    assert voice_toggle.caller_marker_status() == "failed"
