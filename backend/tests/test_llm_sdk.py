"""Exercise the pinned Anthropic SDK's real argument validation and HTTP serialization offline."""

import ast
import asyncio
import inspect
import json
from pathlib import Path

import anthropic
import httpx2
import pytest

from brain import llm

TOOL = {"name": "record", "description": "Record synthetic data", "input_schema": {"type": "object"}}


def client_for(monkeypatch, statuses, *, tool_name="record"):
    calls, health = [], []

    def reply(request):
        calls.append(json.loads(request.content))
        status = statuses[len(calls) - 1]
        if status != 200:
            return httpx2.Response(
                status,
                json={
                    "type": "error",
                    "error": {
                        "type": "overloaded_error" if status == 529 else "invalid_request_error",
                        "message": "fixture",
                    },
                },
            )
        return httpx2.Response(
            200,
            json={
                "id": "msg_fixture",
                "type": "message",
                "role": "assistant",
                "model": "fixture",
                "content": [
                    {"type": "tool_use", "id": "tool_fixture", "name": tool_name, "input": {"value": 42}}
                ],
                "stop_reason": "tool_use",
                "stop_sequence": None,
                "usage": {"input_tokens": 1, "output_tokens": 1},
            },
        )

    client = anthropic.Anthropic(
        api_key="synthetic", max_retries=0, http_client=httpx2.Client(transport=httpx2.MockTransport(reply))
    )
    monkeypatch.setattr(llm, "_client", lambda: client)
    monkeypatch.setattr(llm._mind, "note_ok", lambda: health.append("ok"))
    monkeypatch.setattr(llm._mind, "note_fail", lambda error: health.append(error.status_code))
    return calls, health


def test_sync_and_async_sdk_calls_preserve_structured_tool_contract(monkeypatch):
    calls, health = client_for(monkeypatch, [200, 200])
    assert llm.call_tool_sync("primary", "system", "user", TOOL, "record") == {"value": 42}
    assert asyncio.run(llm.call_tool("primary", "system", "user", TOOL, "record")) == {"value": 42}
    assert health == ["ok", "ok"]
    assert all(
        call["tools"] == [TOOL]
        and call["tool_choice"] == {"type": "tool", "name": "record"}
        and "temperature" not in call
        for call in calls
    )


def test_overload_falls_back_once_and_recovers_health(monkeypatch):
    calls, health = client_for(monkeypatch, [529, 200])
    assert llm.call_tool_sync("primary", "s", "u", TOOL, "record", fallback="fallback") == {"value": 42}
    assert [call["model"] for call in calls] == ["primary", "fallback"]
    assert health == [529, "ok"]


def test_invalid_request_does_not_fall_back(monkeypatch):
    calls, health = client_for(monkeypatch, [400])
    with pytest.raises(anthropic.BadRequestError):
        llm.call_tool_sync("primary", "s", "u", TOOL, "record", fallback="fallback")
    assert len(calls) == 1
    assert health == [400]


def test_unrelated_tool_is_not_mistaken_for_expected_output(monkeypatch):
    client_for(monkeypatch, [200], tool_name="different")
    assert llm.call_tool_sync("primary", "s", "u", TOOL, "record") is None


def test_backend_direct_messages_calls_use_supported_sdk_arguments():
    """Consumer audit: the same removed keyword also broke transcription and catalogue parsing."""
    allowed = set(inspect.signature(anthropic.resources.Messages.create).parameters)
    failures = []
    for source in Path(__file__).resolve().parents[1].rglob("*.py"):
        if "tests" in source.parts:
            continue
        for node in ast.walk(ast.parse(source.read_text())):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "create"
                and isinstance(node.func.value, ast.Attribute)
                and node.func.value.attr == "messages"
            ):
                unknown = {keyword.arg for keyword in node.keywords if keyword.arg} - allowed
                if unknown:
                    failures.append(f"{source.name}:{node.lineno}: {sorted(unknown)}")
    assert not failures, failures
