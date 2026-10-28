"""WP-E — the Vercel preview origins reach the demo routes, and nothing else.

`allow_origin_regex=r"https://.*\\.vercel\\.app"` matched EVERY deployment on that domain, for every
route on this backend — orders, transcripts, money — because a CORSMiddleware's origin test never
sees the path. The regex now lives on a second instance chosen by path, so a preview of the landing
can still drive /api/demo/* and a stranger's preview cannot read anything else.

Preflight only: CORSMiddleware answers an OPTIONS preflight itself, so these requests never reach a
route and never touch the database.
"""
from __future__ import annotations

import os
import sys

from starlette.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import app as app_mod  # noqa: E402
import config  # noqa: E402

PREVIEW = "https://rocoto-git-some-branch.vercel.app"
LANDING = config.DEMO_ALLOWED_ORIGINS.split(",")[0].strip()
STRANGER = "https://not-ours.example.com"

# No context manager: TestClient runs the app's lifespan only inside `with`, and startup wants a
# database. A preflight is answered by the middleware before the app is called at all.
client = TestClient(app_mod.app)


def _preflight(origin: str, path: str):
    return client.options(path, headers={
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })


def _allowed(origin: str, path: str) -> bool:
    return _preflight(origin, path).headers.get("access-control-allow-origin") == origin


def test_a_preview_reaches_the_demo_routes():
    assert _allowed(PREVIEW, "/api/demo/call")


def test_a_preview_reaches_nothing_else():
    for path in ("/api/orders", "/api/stripe/webhook", "/api/subs/webhook", "/healthz"):
        assert not _allowed(PREVIEW, path), f"a Vercel preview must not be a CORS origin for {path}"


def test_the_landing_still_reaches_the_whole_backend():
    assert _allowed(LANDING, "/api/demo/call")
    assert _allowed(LANDING, "/api/orders")


def test_a_stranger_reaches_nothing():
    assert not _allowed(STRANGER, "/api/demo/call")
    assert not _allowed(STRANGER, "/api/orders")
