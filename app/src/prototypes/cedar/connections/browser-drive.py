#!/usr/bin/env python3
"""Synthetic Cedar connection UI proof using pinned repository Playwright.

Run after the isolated build, from the repository root:
  .venv/bin/python app/src/prototypes/cedar/connections/browser-drive.py

All provider/API data is intercepted synthetic test data. The HTTP server serves only this
checkout's isolated build on an ephemeral loopback port. No real provider is contacted.
Screenshots stay under /tmp/cedar-ux-browser/synthetic (override CEDAR_PROOF_SHOTS).
"""

from __future__ import annotations

import base64
import functools
import hashlib
import http.server
import json
import os
import re
import subprocess
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[5]
DIST = ROOT / "app/dist-cedar-connections"
SHOTS = Path(os.environ.get("CEDAR_PROOF_SHOTS", "/tmp/cedar-ux-browser/synthetic"))
TRANSFER_URL = "https://cedar-demo.soyrocoto.com/?preview=setup&transfer=1#whatsapp-business"
DOWNLOAD_URL = "https://cedar-demo.soyrocoto.com/download/whatsapp-business"
DOWNLOADS = {
    "Download for iPhone": "https://apps.apple.com/app/whatsapp-business/id1386412985",
    "Download for Android": "https://play.google.com/store/apps/details?id=com.whatsapp.w4b",
}
REGULAR_DOWNLOADS = {
    "ios": "https://apps.apple.com/app/whatsapp-messenger/id310633997",
    "android": "https://play.google.com/store/apps/details?id=com.whatsapp",
}
CHOICE_HEADING = "Do you use the WhatsApp Business app?"
TRANSFER_ACTION = "My chats are in WhatsApp Business"
SESSION_RECOVERY = "Your setup session needs a fresh connection. Continue with WhatsApp Business."


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def message(number: int, *, media: bool = False) -> dict:
    return {
        "id": f"synthetic-{number:04}",
        "direction": "outbound" if number % 2 else "inbound",
        "text": f"Synthetic QA message {number}: a controlled conversation for the browser proof.",
        "kind": "document" if number == 105 else "text",
        "timestamp": f"2026-09-09T08:{number // 60:02}:{number % 60:02}Z",
        "historical": True,
        "mediaAvailable": media,
    }


def run():
    assert (DIST / "index.html").is_file(), "Build the isolated connection entry first"
    SHOTS.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(QuietHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    evidence = []
    external = []
    sdk_requests = []
    requests = []
    diagnostic_reports = []
    pending_diagnostics = []
    download_requests = []
    decoded_transfer_url = None
    pending_connect = []
    pending_code = []
    pending_state = []
    login_proofs = []
    local_images = []
    store_link_proofs = []
    source_files = [
        Path(__file__),
        *[Path(__file__).with_name(name) for name in ("app.tsx", "meta.ts", "hooks.ts", "api.ts")],
    ]
    source_hashes = {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_files
    }
    bundle_hashes = {
        str(path.relative_to(DIST)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in DIST.rglob("*.js")
    }
    source_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-gpu", "--disable-software-rasterizer", "--renderer-process-limit=1"],
            )
            context = browser.new_context(viewport={"width": 1600, "height": 1000})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            model = {
                "locked": True,
                "ready": True,
                "connected": False,
                "total": 120,
                "fail_older": False,
                "older_failed": False,
                "media": False,
                "same_second": False,
                "session_failures": 1,
                "reject_cookie": False,
                "setup_error": False,
                "hold_state": False,
                "hold_code": False,
                "hold_diagnostic": False,
            }

            def state():
                return {
                    "ready": model["ready"],
                    "blockers": [] if model["ready"] else ["CEDAR_PROOF_META_CONFIG_ID"],
                    "meta": {"appId": "1234567", "configId": "9876543", "graphVersion": "v24.0"},
                    "setup": {
                        "status": "interrupted" if model["setup_error"] else "ready",
                        "step": "history" if model["setup_error"] else "complete",
                        "error": "Synthetic history request needs review." if model["setup_error"] else None,
                    }
                    if model["connected"]
                    else None,
                    "connection": {
                        "wabaId": "1234567",
                        "phoneId": "2222",
                        "number": "+34 600 000 000",
                        "name": "Synthetic QA account",
                        "coexistence": True,
                    }
                    if model["connected"]
                    else None,
                    "history": {
                        "status": "syncing" if model["connected"] else "idle",
                        "progress": 50 if model["connected"] else None,
                        "messages": model["total"] if model["connected"] else 0,
                        "conversations": 1 if model["connected"] else 0,
                        "oldestAt": "2026-03-13T08:00:00Z" if model["connected"] else None,
                        "newestAt": "2026-09-09T08:02:00Z" if model["connected"] else None,
                    },
                }

            def route(request):
                url = request.request.url
                parsed = urlparse(url)
                if url in {*DOWNLOADS.values(), *REGULAR_DOWNLOADS.values(), DOWNLOAD_URL}:
                    download_requests.append(url)
                    return request.fulfill(
                        content_type="text/html", body="<title>Synthetic store destination check</title>"
                    )
                if parsed.path.startswith("/api/proof"):
                    requests.append(parsed.path)
                    if parsed.path == "/api/proof/session":
                        assert request.request.method == "POST"
                        assert request.request.post_data_json == {}
                        if model["session_failures"]:
                            model["session_failures"] -= 1
                            return request.fulfill(
                                status=503,
                                json={"detail": "Your browser session needs another attempt. Try again."},
                            )
                        model["locked"] = model["reject_cookie"]
                        return request.fulfill(json={"ok": True})
                    if model["locked"]:
                        return request.fulfill(
                            status=401, json={"detail": "Open your WhatsApp setup to continue."}
                        )
                    if parsed.path == "/api/proof/state":
                        if model["hold_state"]:
                            model["hold_state"] = False
                            pending_state.append(request)
                            return None
                        return request.fulfill(json=state())
                    if parsed.path == "/api/proof/whatsapp/code":
                        assert request.request.post_data_json == {"code": "synthetic-code"}
                        if model["hold_code"]:
                            model["hold_code"] = False
                            pending_code.append(request)
                            return None
                        return request.fulfill(json={"authorizationId": "synthetic-authorization"})
                    if parsed.path == "/api/proof/whatsapp/diagnostics":
                        diagnostic_reports.append(request.request.post_data_json)
                        if model["hold_diagnostic"]:
                            model["hold_diagnostic"] = False
                            pending_diagnostics.append(request)
                            return None
                        return request.fulfill(json={"receiptId": "a" * 64})
                    if parsed.path == "/api/proof/whatsapp/connect":
                        assert request.request.post_data_json["authorizationId"] == "synthetic-authorization"
                        assert request.request.post_data_json["historyRequested"] is True
                        model.update({"connected": True, "setup_error": True, "locked": True})
                        pending_connect.append(request)
                        return None
                    if parsed.path.startswith("/api/proof/conversations") and not model["connected"]:
                        return request.fulfill(
                            status=401, json={"detail": "Connect your WhatsApp account to continue."}
                        )
                    if parsed.path == "/api/proof/conversations":
                        return request.fulfill(
                            json={
                                "conversations": [
                                    {
                                        "id": "synthetic-contact",
                                        "name": "Synthetic QA customer with a long business name",
                                        "number": "+34 600 000 001",
                                        "lastMessage": "Synthetic QA conversation preview",
                                        "lastAt": message(model["total"])["timestamp"],
                                        "count": model["total"],
                                    }
                                ]
                                if model["connected"]
                                else []
                            }
                        )
                    if parsed.path.endswith("/messages"):
                        cursor = parse_qs(parsed.query).get("before", [None])[0]
                        if cursor and model["fail_older"] and not model["older_failed"]:
                            model["older_failed"] = True
                            return request.fulfill(
                                status=503,
                                json={"detail": "The message page needs another refresh. Try again."},
                            )
                        maximum = int(cursor) - 1 if cursor else model["total"]
                        minimum = max(1, maximum - 99)
                        messages = [message(i, media=model["media"]) for i in range(minimum, maximum + 1)]
                        if model["same_second"]:
                            for i, item in zip(range(minimum, maximum + 1), messages, strict=True):
                                item["timestamp"] = "2026-09-09T08:00:00Z"
                                item["id"] = f"opaque-{9999 - i}"
                                item["kind"] = "document" if i == 5 else "text"
                        return request.fulfill(
                            json={
                                "messages": messages,
                                "nextCursor": str(minimum) if minimum > 1 else None,
                            }
                        )
                    return request.fulfill(
                        status=400, json={"detail": "This synthetic drive reads controlled responses only."}
                    )
                if parsed.netloc == "connect.facebook.net":
                    sdk_requests.append(url)
                    return request.fulfill(
                        content_type="text/javascript",
                        body="window.cedarQaLoginCalls=0;window.cedarQaLoginOptions=[];"
                        "window.cedarQaLoginGestures=[];window.FB={init:function(){},"
                        "login:function(callback,options){window.cedarQaLoginCalls++;"
                        "window.cedarQaLoginOptions.push(options);"
                        "window.cedarQaLoginGestures.push(navigator.userActivation.isActive);"
                        "window.cedarQaLoginCallback=callback}};window.fbAsyncInit?.();",
                    )
                if url.startswith(origin):
                    if re.search(r"\.(svg|png|webp)(?:\?|$)", url):
                        local_images.append(parsed.path)
                    return request.continue_()
                external.append(parsed.netloc)
                return request.abort()

            context.route("**/*", route)

            def proof(name: str):
                page.evaluate("document.fonts.ready")
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), (
                    f"Horizontal overflow: {name}"
                )
                assert page.evaluate("localStorage.length===0 && sessionStorage.length===0"), (
                    f"Private data persisted: {name}"
                )
                if page.viewport_size["width"] <= 390:
                    small_buttons = page.locator("button").evaluate_all("""nodes => nodes.filter(node => {
                        const rect = node.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && (rect.height < 43.5 || rect.width < 43.5);
                    }).map(node => node.getAttribute('aria-label') || node.textContent)""")
                    assert not small_buttons, f"Phone touch targets: {name}: {small_buttons}"
                page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True, animations="disabled")
                evidence.append(name)

            def check_signup_options(gesture: str):
                options = page.evaluate("window.cedarQaLoginOptions.at(-1)")
                assert options["extras"]["setup"] == {}, "App choice must leave Meta phone entry to Meta"
                assert options["response_type"] == "code"
                assert options["override_default_response_type"] is True
                assert options["extras"]["featureType"] == "whatsapp_business_app_onboarding"
                assert options["extras"]["sessionInfoVersion"] == "3"
                assert page.evaluate("window.cedarQaLoginGestures.at(-1)") is True
                login_proofs.append({"gesture": gesture, "setup": options["extras"]["setup"]})

            def check_choice():
                expect(page.get_by_role("heading", name=CHOICE_HEADING, exact=True)).to_be_visible()
                expect(page.get_by_test_id("connect-meta")).to_have_attribute(
                    "aria-label", "WhatsApp Business"
                )
                expect(page.get_by_test_id("open-transfer")).to_have_attribute("aria-label", "WhatsApp")
                expect(page.get_by_test_id("whatsapp-number")).to_have_count(0)
                expect(page.get_by_role("checkbox")).to_have_count(0)
                expect(page.get_by_text("Privacy and chat sharing", exact=True)).to_have_count(1)
                expect(page.get_by_text("Privacy and chat sharing", exact=True)).to_be_visible()
                for choice in ("connect-meta", "open-transfer"):
                    icon = page.get_by_test_id(choice).locator("img")
                    expect(icon).to_have_count(1)
                    expect(icon).to_have_js_property("complete", True)
                    assert icon.evaluate("node => node.complete && node.naturalWidth > 0")
                    assert icon.evaluate(
                        "node => node.src.startsWith(location.origin + '/') "
                        "|| node.src.startsWith('data:image/')"
                    ), "App icon loads from an external reference instead of the local artifact"

            def check_transfer_action():
                expect(page.get_by_test_id("connect-meta")).to_have_text(TRANSFER_ACTION)
                expect(page.get_by_test_id("connect-meta")).to_be_enabled()
                expect(page.get_by_role("checkbox")).to_have_count(0)

            def check_progress(status: str):
                progress = page.get_by_test_id("meta-setup-progress")
                expect(progress).to_be_visible()
                expect(progress.get_by_role("heading", name=status, exact=True)).to_be_visible()
                expect(page.get_by_test_id("meta-setup-spinner")).to_be_visible()
                expect(page.get_by_role("button", name="Pause setup", exact=True)).to_be_visible()
                expect(page.get_by_test_id("connect-meta")).to_have_count(0)
                expect(page.get_by_test_id("open-transfer")).to_have_count(0)

            def check_store_links(device: str):
                apple = device in {"phone", "ipad"}
                expected = {
                    "business-store-link": DOWNLOADS[
                        "Download for iPhone" if apple else "Download for Android"
                    ],
                    "whatsapp-store-link": REGULAR_DOWNLOADS["ios" if apple else "android"],
                }
                prior_calls = page.evaluate("window.cedarQaLoginCalls")
                prior_path = page.url
                prior_writes = [path for path in requests if "/whatsapp/" in path]
                for link_id, destination in expected.items():
                    link = page.get_by_test_id(link_id)
                    expect(link).to_have_attribute("href", destination)
                    assert link.evaluate(
                        "node => node.tagName === 'A' && !node.closest('button,[role=button]')"
                    )
                    choice_id = "connect-meta" if link_id == "business-store-link" else "open-transfer"
                    page.get_by_test_id(choice_id).focus()
                    page.keyboard.press("Tab")
                    expect(link).to_be_focused()
                    with page.expect_popup() as opened:
                        page.keyboard.press("Enter")
                    expect(opened.value).to_have_url(destination)
                    opened.value.close()
                    check_choice()
                    assert page.url == prior_path, "Store identification link changed the setup step"
                    assert page.evaluate("window.cedarQaLoginCalls") == prior_calls
                    assert [path for path in requests if "/whatsapp/" in path] == prior_writes
                    store_link_proofs.append({"device": device, "link": link_id, "destination": destination})

            page.goto(origin + "/?preview=setup")
            expect(
                page.get_by_text("Your browser session needs another attempt. Try again.", exact=True)
            ).to_be_visible()
            expect(page.get_by_test_id("proof-access-code")).to_have_count(0)
            expect(page.get_by_test_id("connect-meta")).to_have_count(0)
            assert requests == ["/api/proof/session"], "Failed bootstrap leaked into account requests"
            assert not sdk_requests, "SDK loaded before browser session was established"
            proof("1600-session-retry")
            page.get_by_role("button", name="Try again", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            check_choice()
            assert requests[:3] == ["/api/proof/session", "/api/proof/session", "/api/proof/state"]
            assert not any("conversations" in path for path in requests)
            assert page.evaluate("window.cedarQaLoginCalls") == 0, "Meta opened without a user click"
            # The SDK call must happen inside the original activation handler, before it returns.
            assert (
                page.get_by_test_id("connect-meta").evaluate("""node => {
                const before = window.cedarQaLoginCalls;
                node.click();
                return window.cedarQaLoginCalls - before;
            }""")
                == 1
            ), "Business choice deferred SDK login beyond its click handler"
            check_signup_options("Business click")
            # Waiting in Meta must remain visibly active in Cedar on desktop and phone.
            check_progress("Continue in the WhatsApp window")
            for width in [1600, 390]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                check_progress("Continue in the WhatsApp window")
                proof(f"{width}-meta-authorizing")
            page.set_viewport_size({"width": 1600, "height": 1000})
            model["hold_diagnostic"] = True
            with page.expect_request("**/api/proof/whatsapp/diagnostics"):
                page.evaluate("""() => window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR'}
                }))""")
            expect(
                page.get_by_text(
                    "Meta needs another connection attempt. Continue to review the setup.", exact=True
                )
            ).to_be_visible()
            expect(page.get_by_test_id("meta-report-status")).to_have_text(
                "Sending the error report to Rocoto…"
            )
            assert len(pending_diagnostics) == 1
            assert len(diagnostic_reports) == 1
            assert {key: value for key, value in diagnostic_reports[0].items() if key != "attemptId"} == {
                "event": "ERROR",
            }, "A bare provider event must retain its event-only diagnostic"
            pending_diagnostics.pop().fulfill(json={"receiptId": "a" * 64})
            expect(page.get_by_test_id("meta-report-status")).to_have_text("Report received by Rocoto.")
            check_choice()
            proof("1600-meta-error-retry")
            page.get_by_test_id("connect-meta").click()
            check_signup_options("Business retry")
            expect(page.get_by_test_id("meta-report-status")).to_have_count(0)
            page.evaluate("""() => {
                window.cedarQaCancelledLoginCallback = window.cedarQaLoginCallback;
                window.cedarQaLoginCallback({status: 'unknown'});
            }""")
            expect(
                page.get_by_text("Setup closed. You can continue when you are ready.", exact=True)
            ).to_be_visible()
            # Exceed the previous one-second grace: support reports may follow a closed login.
            page.wait_for_timeout(1300)
            with page.expect_request("**/api/proof/whatsapp/diagnostics"):
                page.evaluate("""() => window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL'}
                }))""")
            expect(page.get_by_test_id("meta-report-status")).to_have_text("Report received by Rocoto.")
            assert len(diagnostic_reports) == 2
            assert {key: value for key, value in diagnostic_reports[1].items() if key != "attemptId"} == {
                "event": "CANCEL",
            }
            # A later report from this same popup enriches the earlier bare cancellation.
            with page.expect_request("**/api/proof/whatsapp/diagnostics"):
                page.evaluate("""() => {
                    window.dispatchEvent(new MessageEvent('message', {
                origin: 'https://www.facebook.com',
                data: {type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {
                    error_code: 2494064, current_step: 'PHONE_NUMBER_SETUP',
                    session_id: 'f34b51dab5e0498', timestamp: '1746041036',
                    error_message: 'private synthetic account text', access_token: 'private-synthetic-token'
                }}
            })); }""")
            expect(
                page.get_by_text("Setup closed. You can continue when you are ready.", exact=True)
            ).to_be_visible()
            expect(page.get_by_test_id("meta-report-status")).to_have_text(
                "Meta error 2494064. Report received by Rocoto."
            )
            check_choice()
            page.evaluate("""() => {
                window.cedarQaCancelledLoginCallback({authResponse: {code: 'late-cancelled-code'}});
                window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
                        data: {waba_id: '1234567', phone_number_id: '2222'}}
                }));
            }""")
            assert not any(path.endswith(("/whatsapp/code", "/whatsapp/connect")) for path in requests), (
                "Provider rejection or cancellation triggered code/connect/history writes"
            )
            assert len(diagnostic_reports) == 3
            for report in diagnostic_reports:
                assert re.fullmatch(r"[0-9a-f-]{36}", report["attemptId"])
            assert {key: value for key, value in diagnostic_reports[2].items() if key != "attemptId"} == {
                "event": "CANCEL", "errorCode": "2494064", "currentStep": "PHONE_NUMBER_SETUP",
                "sessionId": "f34b51dab5e0498", "reportedAt": "1746041036",
            }, "Provider text or credentials leaked into the diagnostic request"
            proof("1600-meta-report-received")
            page.get_by_test_id("connect-meta").press("Enter")
            assert page.evaluate("window.cedarQaLoginCalls") == 3
            check_signup_options("Business Enter")
            expect(page.get_by_test_id("meta-report-status")).to_have_count(0)
            page.evaluate("""() => window.cedarQaCancelledLoginCallback({
                authResponse: {code: 'late-previous-attempt-code'}
            })""")
            page.get_by_role("button", name="Pause setup", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            page.evaluate("""() => {
                window.cedarQaLoginCallback({authResponse: {code: 'late-paused-code'}});
                window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR'}
                }));
            }""")
            page.wait_for_timeout(100)
            assert len(diagnostic_reports) == 3, "Disposed attempts kept receiving provider reports"
            assert not any(path.endswith(("/whatsapp/code", "/whatsapp/connect")) for path in requests), (
                "A stale callback regained authorization after retry or pause"
            )

            # A /code 401 remounts setup during cookie recovery. The reason must survive it.
            model["hold_code"] = True
            page.get_by_test_id("connect-meta").click()
            page.evaluate("""() => {
                window.cedarQaExpiredLoginCallback = window.cedarQaLoginCallback;
                window.cedarQaLoginCallback({authResponse: {code: 'synthetic-code'}});
            }""")
            check_progress("Checking your account")
            assert len(pending_code) == 1
            for width in [1600, 390]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                check_progress("Checking your account")
                proof(f"{width}-meta-checking-account")
            before_recovery = len(requests)
            model["locked"] = True
            pending_code.pop().fulfill(status=401, json={"detail": "Synthetic setup session expired."})
            expect(page.get_by_test_id("meta-session-recovery")).to_have_text(SESSION_RECOVERY)
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            assert "/api/proof/session" in requests[before_recovery:]
            assert not model["connected"]
            expect(page.get_by_test_id("provider-message")).to_have_count(0)
            for width in [1600, 390]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                expect(page.get_by_test_id("meta-session-recovery")).to_have_text(SESSION_RECOVERY)
                proof(f"{width}-meta-code-session-recovery")
            before_stale = [
                path for path in requests if path.endswith(("/whatsapp/code", "/whatsapp/connect"))
            ]
            page.evaluate("""() => {
                window.cedarQaExpiredLoginCallback({authResponse: {code: 'late-expired-code'}});
                window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
                        data: {waba_id: '1234567', phone_number_id: '2222'}}
                }));
            }""")
            page.wait_for_timeout(100)
            assert before_stale == [
                path for path in requests if path.endswith(("/whatsapp/code", "/whatsapp/connect"))
            ]
            expect(page.get_by_test_id("meta-session-recovery")).to_have_text(SESSION_RECOVERY)
            page.get_by_test_id("connect-meta").click()
            expect(page.get_by_test_id("meta-session-recovery")).to_have_count(0)
            check_progress("Continue in the WhatsApp window")
            page.evaluate("""() => window.cedarQaExpiredLoginCallback({
                authResponse: {code: 'late-previous-expired-code'}
            })""")
            page.get_by_role("button", name="Pause setup", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            assert before_stale == [
                path for path in requests if path.endswith(("/whatsapp/code", "/whatsapp/connect"))
            ]

            # Idle polling may discover the expired session after a paused signup as well.
            before_recovery = requests.count("/api/proof/session")
            model["locked"] = True
            expect(page.get_by_test_id("meta-session-recovery")).to_have_text(SESSION_RECOVERY, timeout=15000)
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            assert requests.count("/api/proof/session") > before_recovery
            expect(page.get_by_test_id("provider-message")).to_have_count(0)
            proof("390-meta-poll-session-recovery")
            page.get_by_test_id("connect-meta").click()
            expect(page.get_by_test_id("meta-session-recovery")).to_have_count(0)
            check_progress("Continue in the WhatsApp window")
            page.get_by_role("button", name="Pause setup", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()

            def device_page(width, device="desktop"):
                nonlocal context, page
                context.close()
                options = {"viewport": {"width": width, "height": 1000 if width >= 1000 else 844}}
                if device in {"phone", "ipad", "android"}:
                    options.update(
                        {
                            "is_mobile": True,
                            "has_touch": True,
                            "user_agent": (
                                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
                                "Chrome/126.0.0.0 Mobile Safari/537.36"
                            )
                            if device == "android"
                            else (
                                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
                                "AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
                            )
                            if device == "phone"
                            else (
                                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) "
                                "AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"
                            ),
                        }
                    )
                context = browser.new_context(**options)
                if device == "ipad":
                    context.add_init_script(
                        "Object.defineProperty(navigator, 'platform', {get: () => 'MacIntel'});"
                        "Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5});"
                    )
                context.route("**/*", route)
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))

            def advance_download(device):
                if device == "desktop":
                    expect(page.get_by_test_id("download-business")).to_have_count(0)
                    page.get_by_test_id("transfer-continue").click()
                else:
                    expect(page.get_by_test_id("download-business")).to_have_attribute("href", DOWNLOAD_URL)
                    with page.expect_popup() as opened:
                        page.get_by_test_id("download-business").click()
                    expect(opened.value).to_have_url(DOWNLOAD_URL)
                    opened.value.close()
                expect(page.get_by_role("heading", name="Transfer your chats", exact=True)).to_be_visible()
                check_transfer_action()
                expect(page.get_by_role("link", name="Read the official transfer steps")).to_have_attribute(
                    "href", re.compile(r"^https://faq.whatsapp.com/")
                )

            # Each device follows separate connection, download and phone-transfer steps.
            for width, presentation, device in [
                (1600, "", "desktop"),
                (390, "", "phone"),
                (320, "", "phone"),
                (390, "dialog", "phone"),
                (320, "", "desktop"),
                (1024, "", "ipad"),
                (390, "", "android"),
            ]:
                device_page(width, device)
                suffix = "&presentation=dialog" if presentation else ""
                previous_requests = len(requests)
                page.goto(origin + "/?preview=setup" + suffix)
                expect(page.get_by_test_id("connect-meta")).to_be_enabled()
                check_choice()
                expect(page.get_by_test_id("proof-access-code")).to_have_count(0)
                expect(page.get_by_role("link", name="Open private setup", exact=True)).to_have_count(0)
                expect(page.get_by_role("link", name="Reviewer access", exact=True)).to_have_count(0)
                assert requests[previous_requests : previous_requests + 2] == [
                    "/api/proof/session",
                    "/api/proof/state",
                ]
                tag = f"{width}-{device}{('-' + presentation) if presentation else ''}"
                proof(tag + "-customer-setup")
                check_store_links(device)
                page.get_by_test_id("open-transfer").click()
                heading = page.get_by_role("heading", name="Download WhatsApp Business", exact=True)
                expect(heading).to_be_visible()
                expect(heading).to_be_focused()
                expect(page.get_by_test_id("connect-meta")).to_have_count(0)
                expect(page.get_by_role("heading", name=CHOICE_HEADING, exact=True)).to_have_count(0)
                expect(page.get_by_role("link", name="Download for iPhone")).not_to_be_visible()
                qr = page.get_by_test_id("whatsapp-transfer-qr")
                if device == "desktop":
                    expect(qr).to_be_visible()
                    decoder = (
                        (ROOT / "app/src/prototypes/cedar/vendor/jsqr.js")
                        .read_text()
                        .replace(
                            "export default vendored.exports;", "window.cedarQaDecodeQr = vendored.exports;"
                        )
                    )
                    page.add_script_tag(content=decoder)
                    image_url = "data:image/png;base64," + base64.b64encode(qr.screenshot()).decode("ascii")
                    decoded_transfer_url = page.evaluate(
                        """async imageUrl => {
                        const image = new Image(); image.src = imageUrl; await image.decode();
                        const canvas = document.createElement('canvas');
                        canvas.width = image.width; canvas.height = image.height;
                        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
                        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                        return window.cedarQaDecodeQr(pixels.data, pixels.width, pixels.height)?.data;
                    }""",
                        image_url,
                    )
                    assert decoded_transfer_url == DOWNLOAD_URL
                else:
                    expect(qr).to_have_count(0)
                proof(tag + "-download")
                advance_download(device)
                expect(page.get_by_role("heading", name="Transfer your chats", exact=True)).to_be_focused()
                proof(tag + "-transfer")
                check_transfer_action()
                if device == "phone" and not presentation:
                    page.reload()
                    expect(
                        page.get_by_role("heading", name="Transfer your chats", exact=True)
                    ).to_be_visible()
                    check_transfer_action()
                    assert page.evaluate("window.cedarQaLoginCalls") == 0
                page.get_by_test_id("transfer-back").click()
                expect(
                    page.get_by_role("heading", name="Download WhatsApp Business", exact=True)
                ).to_be_visible()
                page.get_by_test_id("return-setup").click()
                expect(page.get_by_test_id("connect-meta")).to_be_enabled()
                check_choice()
                assert page.evaluate("window.cedarQaLoginCalls") == 0, "Transfer navigation launched Meta"
                if presentation:
                    expect(page.get_by_role("dialog")).to_be_visible()
            assert decoded_transfer_url == DOWNLOAD_URL

            # An unknown device gets a QR and explicit store choices on the server's fallback page.
            handoff = urlparse(TRANSFER_URL)
            device_page(390)
            page.goto(origin + handoff.path + "?" + handoff.query + "#" + handoff.fragment)
            expect(page.get_by_role("heading", name="Download WhatsApp Business", exact=True)).to_be_visible()
            expect(page.get_by_test_id("whatsapp-transfer-qr")).to_be_visible()
            expect(page.get_by_test_id("download-business")).to_have_count(0)
            for label, href in DOWNLOADS.items():
                page.get_by_text("Choose your app store", exact=True).click()
                with page.expect_popup() as opened:
                    page.get_by_role("link", name=label, exact=True).click()
                expect(opened.value).to_have_url(href)
                opened.value.close()
                expect(page.get_by_role("heading", name="Transfer your chats", exact=True)).to_be_visible()
                page.get_by_test_id("transfer-back").click()
            assert set(download_requests) == {DOWNLOAD_URL, *DOWNLOADS.values(), *REGULAR_DOWNLOADS.values()}
            proof("390-unknown-device-fallback")
            page.get_by_test_id("return-setup").click()
            page.goto(origin)
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()

            # A direct return URL preserves only the public step; Meta still needs an explicit confirmation.
            page.goto(origin + "/?transfer=2")
            expect(page.get_by_role("heading", name="Transfer your chats", exact=True)).to_be_visible()
            check_transfer_action()
            assert page.evaluate("window.cedarQaLoginCalls") == 0
            page.reload()
            check_transfer_action()
            assert page.evaluate("window.cedarQaLoginCalls") == 0
            assert (
                page.get_by_test_id("connect-meta").evaluate("""node => {
                const before = window.cedarQaLoginCalls;
                node.click();
                return window.cedarQaLoginCalls - before;
            }""")
                == 1
            ), "Transfer confirmation deferred SDK login beyond its click handler"
            check_signup_options("confirmed transfer click")
            page.get_by_role("button", name="Pause setup", exact=True).click()
            page.goto(origin)
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()

            # A browser refusing the session cookie gets one automatic renewal, then an explicit retry.
            model.update({"locked": True, "reject_cookie": True})
            previous_requests = len(requests)
            page.reload()
            expect(
                page.get_by_text("Allow cookies for this site, then try again.", exact=True)
            ).to_be_visible()
            assert requests[previous_requests:] == ["/api/proof/session", "/api/proof/state"] * 2
            expect(page.get_by_test_id("connect-meta")).to_have_count(0)
            proof("390-cookie-retry")
            model["reject_cookie"] = False
            page.get_by_role("button", name="Try again", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()

            page.set_viewport_size({"width": 1600, "height": 1000})
            model["ready"] = False
            page.goto(origin)
            expect(page.get_by_role("heading", name=CHOICE_HEADING, exact=True)).to_be_visible()
            expect(page.get_by_test_id("connect-meta")).to_be_disabled()
            for width in [1600, 390, 320]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                proof(f"{width}-blocked-setup")

            model["ready"] = True
            page.get_by_role("button", name="Check again").click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            for width in [1600, 390, 320]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                proof(f"{width}-ready-setup")
            page.get_by_test_id("open-transfer").click()
            page.get_by_test_id("transfer-continue").click()
            expect(page.get_by_role("heading", name="Transfer your chats", exact=True)).to_be_visible()
            check_transfer_action()
            proof("320-regular-guidance")
            page.get_by_test_id("transfer-back").click()
            page.get_by_test_id("return-setup").click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()

            for width in [1600, 390, 320]:
                page.set_viewport_size({"width": width, "height": 1000 if width == 1600 else 844})
                page.goto(origin + "/?presentation=dialog")
                expect(page.get_by_role("dialog")).to_be_visible()
                expect(page.get_by_test_id("connect-meta")).to_be_enabled()
                proof(f"{width}-dialog")
                page.keyboard.press("Escape")
                expect(page.get_by_role("dialog")).not_to_be_visible()
                page.get_by_role("button", name="Open connection setup").click()
                expect(page.get_by_role("dialog")).to_be_visible()

            # An account verified before a later provider error stays accessible in the browser.
            # An older state request is already pending when signup starts and will return 401.
            model["hold_state"] = True
            page.wait_for_timeout(5500)
            assert pending_state, "The regression requires an in-flight state request"
            page.get_by_test_id("connect-meta").click()
            page.evaluate("""() => {
                window.cedarQaLoginCallback({authResponse: {code: 'synthetic-code'}});
                window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://www.facebook.com',
                    data: {type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
                        data: {waba_id: '1234567', phone_number_id: '2222'}}
                }));
            }""")
            check_progress("Connecting your WhatsApp Business account")
            pending_state.pop().fulfill(status=401, json={"detail": "Synthetic old cookie was rotated."})
            page.wait_for_timeout(5500)
            assert pending_connect, "The connecting request was aborted before its response"
            assert requests[-2:] == ["/api/proof/whatsapp/code", "/api/proof/whatsapp/connect"], (
                "State/session polling must pause until the rotating connection response finishes"
            )
            check_progress("Connecting your WhatsApp Business account")
            model["locked"] = False
            pending_connect.pop().fulfill(
                status=502,
                json={"detail": "Synthetic provider setup interrupted after account verification."},
            )
            expect(
                page.get_by_text(
                    "Synthetic provider setup interrupted after account verification.", exact=True
                )
            ).to_be_visible()
            expect(page.get_by_role("heading", name="Your WhatsApp conversations")).to_be_visible()
            expect(page.get_by_text("Synthetic history request needs review.", exact=True)).to_be_visible()
            proof("320-verified-account-interrupted")

            previous_requests = len(requests)
            page.goto(origin)
            expect(page.get_by_role("heading", name="Your WhatsApp conversations")).to_be_visible()
            assert requests[previous_requests : previous_requests + 2] == [
                "/api/proof/session",
                "/api/proof/state",
            ]
            expect(page.get_by_test_id("connect-meta")).to_have_count(0)
            assert model["connected"], "Browser bootstrap lost the verified account on reload"
            expect(page.get_by_role("button", name=re.compile("Synthetic QA customer"))).to_be_visible()
            proof("320-conversation-list")
            page.get_by_role("button", name=re.compile("Synthetic QA customer")).click()
            expect(page.get_by_test_id("provider-message")).to_have_count(100)
            proof("320-chat-latest")
            page.get_by_role("button", name="Load earlier messages").click()
            expect(page.get_by_test_id("provider-message")).to_have_count(120)
            assert (
                page.get_by_test_id("provider-message").first.get_attribute("data-message-id")
                == "synthetic-0001"
            )
            assert (
                page.get_by_test_id("provider-message").last.get_attribute("data-message-id")
                == "synthetic-0120"
            )
            model["total"] = 121
            model["media"] = True
            expect(page.get_by_test_id("provider-message")).to_have_count(121, timeout=20000)
            expect(page.get_by_text("Media received · open in WhatsApp", exact=True)).to_be_visible()
            assert (
                page.get_by_test_id("provider-message").first.get_attribute("data-message-id")
                == "synthetic-0001"
            ), "Polling discarded earlier loaded pages"
            proof("320-chat-updated")
            page.set_viewport_size({"width": 1600, "height": 1000})
            proof("1600-chat-updated")
            page.set_viewport_size({"width": 390, "height": 844})
            proof("390-chat-updated")

            # Fail a later pagination request once, then verify an explicit retry keeps the view usable.
            page.get_by_role("button", name="Back to conversations").click()
            page.get_by_role("button", name=re.compile("Synthetic QA customer")).click()
            expect(page.get_by_test_id("provider-message")).to_have_count(100)
            model["fail_older"] = True
            page.get_by_role("button", name="Load earlier messages").click()
            expect(page.get_by_text("The message page needs another refresh. Try again.")).to_be_visible()
            expect(page.get_by_test_id("provider-message")).to_have_count(100)
            page.get_by_role("button", name="Try again", exact=True).click()
            expect(page.get_by_test_id("provider-message")).to_have_count(121)

            # Provider-ID order and the server's opaque pagination order deliberately disagree.
            # A same-second media update on an older page must be reconciled while the chat is open.
            model.update({"same_second": True, "total": 120, "media": False, "fail_older": False})
            page.goto(origin)
            page.get_by_role("button", name=re.compile("Synthetic QA customer")).click()
            expect(page.get_by_test_id("provider-message")).to_have_count(100)
            page.get_by_role("button", name="Load earlier messages").click()
            expect(page.get_by_test_id("provider-message")).to_have_count(120)
            model.update({"total": 121, "media": True})
            expect(page.get_by_test_id("provider-message")).to_have_count(121, timeout=20000)
            expect(page.locator('[data-message-id="opaque-9994"]')).to_contain_text(
                "Media received", timeout=20000
            )
            proof("390-same-second-update")

            # Expired account access clears the visible conversation before fresh setup can begin.
            model.update({"locked": True, "connected": False, "setup_error": False, "session_failures": 1})
            page.get_by_role("button", name="Refresh messages", exact=True).click()
            expect(
                page.get_by_text("Your browser session needs another attempt. Try again.", exact=True)
            ).to_be_visible()
            expect(page.get_by_test_id("provider-message")).to_have_count(0)
            expect(page.get_by_text(re.compile("Synthetic QA account"))).to_have_count(0)
            expect(page.get_by_role("heading", name="Your WhatsApp conversations")).to_have_count(0)
            proof("390-expired-account-cleared")
            page.get_by_role("button", name="Try again", exact=True).click()
            expect(page.get_by_test_id("connect-meta")).to_be_enabled()
            expect(page.get_by_test_id("provider-message")).to_have_count(0)
            expect(page.get_by_test_id("proof-access-code")).to_have_count(0)

            assert not errors, errors
            assert not external, external
            assert set(requests) <= {
                "/api/proof/whatsapp/diagnostics",
                "/api/proof/session",
                "/api/proof/whatsapp/code",
                "/api/proof/whatsapp/connect",
                "/api/proof/state",
                "/api/proof/conversations",
                "/api/proof/conversations/synthetic-contact/messages",
            }, requests
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    receipt = {
        "providerPosture": "synthetic intercepted API and SDK; no provider calls",
        "sourceHead": source_head,
        "sourceSha256": source_hashes,
        "bundleSha256": bundle_hashes,
        "screenshots": evidence,
        "decodedTransferQr": decoded_transfer_url,
        "interceptedDownloadTargets": download_requests,
        "syntheticDiagnostics": diagnostic_reports,
        "appStoreLinks": store_link_proofs,
        "localImagePaths": sorted(set(local_images)),
        "sdkChoices": login_proofs,
        "checks": [
            "browser session failure/retry before state and SDK",
            "every entry including preview opens actual customer setup without an access code",
            "Meta popup requires a synchronous user click",
            "desktop and phone show a spinner, current step and secondary Pause while Meta is active",
            "code401 and later polling401 preserve the interrupted signup reason across session recovery",
            "an explicit new attempt clears recovery copy while expired callbacks remain inert",
            "two app choices with bundled icons and no Cedar phone entry",
            "Business choice passes empty setup; Meta owns account and phone selection",
            "app-store sublinks have separate keyboard focus and preserve setup without SDK login",
            "provider error/cancel returns to app choices without code/connect/history writes",
            "bare provider errors report their event and show receipt only after server acknowledgement",
            "reports remain deliverable after the former one-second cancellation timeout",
            "a detailed provider report enriches an earlier bare cancellation from the same attempt",
            "cancelled, retried and paused callbacks retain no authorization access",
            "cookie rejection bounded renewal and explicit retry",
            "verified account state recovered after provider setup error",
            "long connection pauses polling and discards an older in-flight 401 during cookie rotation",
            "verified browser account survives reload",
            "expired account clears visible history before bootstrap retry",
            "blocked/ready setup",
            "separate download and phone-transfer steps with one primary action",
            "regular app choice guides transfer without account classification or Meta login",
            "explicit transfer confirmation launches Meta; direct URL/reload preserves only the public step",
            "Meta owns history consent; connection request enables eligible history",
            "step heading focus and secondary back navigation",
            "rendered desktop QR decodes to device download route, including narrow desktop",
            "phone and desktop-mode iPad smart-download opens a new tab and advances",
            "unknown-device fallback offers QR and correct Business store choices without a redirect loop",
            "1600/390/320 widths",
            "dialog close/reopen",
            "cursor pagination",
            "open-chat refresh",
            "older-page retention",
            "media enrichment",
            "pagination failure/retry",
            "same-second opaque cursor/media reconciliation",
            "44px phone buttons",
            "empty browser storage",
            "zero external requests",
            "zero page errors",
        ],
    }
    assert source_hashes == {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_files
    }, "Reviewed source changed during the browser drive"
    assert bundle_hashes == {
        str(path.relative_to(DIST)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in DIST.rglob("*.js")
    }, "Served browser bundle changed during the drive"
    (SHOTS / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    run()
