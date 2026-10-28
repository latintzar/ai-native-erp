"""Tests boot the app with NO provider key and a scratch state dir — nothing here touches a provider.

The live providers are proven from the box, once, and the receipts are written into
THE-RUNTIME-SPEC §RUN-05. What the suite guards is the SHAPING: the four recorded provider answers
in `fixtures/` are real responses (Parsewise's 23 result rows, Deepgram's two-channel utterances,
Google's phone-matched candidates), and every assertion below is about what this service makes of
them — which is the half that changes when someone edits this repo.
"""
from __future__ import annotations

import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"


def load(name: str):
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)
    from starlette.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
