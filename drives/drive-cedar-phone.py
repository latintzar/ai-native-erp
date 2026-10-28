#!/usr/bin/env python3
"""Cedar phone UI proof with isolated owner-API and Twilio SDK fixtures; zero provider calls.

    ROCOTO_DIST=app/dist-export-review .venv/bin/python drives/drive-cedar-phone.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served `app.html`. `ROCOTO_SHOTS` selects the screenshot folder. Every provider and API request is
answered by this file, so the run reaches no network.

THE CONNECTION IS STATE LED (FEED-IA §246). Seven blocks prove it: `run` walks a commissioned
account end to end, `run_uncommissioned` holds the sample account at one image and one action and
asserts each setup step asks exactly one question, `run_first_walk` takes a SAMPLE account through
its very first `Connect phone` — the walk that creates its own line and must survive doing so —
`run_write_order` parks a provider read across each of the walk's two writes and releases it
afterwards, so a read older than the line can never read as a revocation and the refresh the walk
awaits after a write is never the read that write condemned, `run_state_led` holds the first read
open at a barrier — so the dial's `checking` paint is a fact rather than a race — keeps a
HALF-commissioned line at that same image and then flips the fixture under a live page — ready,
stale, then revoked —
`run_entrances` presses the customer-sheet and connected-inbox call entrances and asserts each
lands on the dial carrying this customer and this number, by route where a route costs nothing and
IN PLACE above a surface a route would take away — where ONE browser Back closes the dial and
leaves that surface standing — and `run_conversation` presses the act a telephone conversation
carries where a composer would, from its own route and again inside the Messages panel.
"""
from __future__ import annotations

import asyncio
import functools
import http.server
import json
import os
import socketserver
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from playwright.async_api import async_playwright, expect

DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
URL = os.getenv("ROCOTO_URL", "").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-phone-proof"))
# `ROCOTO_ONLY=first-walk,state-led` narrows a run to named blocks while a repair is measured.
ONLY = [name for name in os.getenv("ROCOTO_ONLY", "").split(",") if name]
CUSTOMER = "nou"
WORKSPACE = "a" * 32
TOKEN = "b" * 64
SID = "CA" + "1" * 32
STALE_SID = "CA" + "9" * 32
LINE = "line_" + "a" * 24
CHECKS: list[str] = []
SDK = """class FixtureCall {
  constructor(incoming=false){this.handlers={};this.customParameters=new Map(incoming?[['ParentCallSid','CA'+'3'.repeat(32)]]:[]);this.parameters={CallSid:incoming?'CA'+ '2'.repeat(32):'CA'+'1'.repeat(32),From:'+51912345678',To:'+51987654321'};}
  on(name,handler){this.handlers[name]=handler;return this;}
  accept(){this.handlers.accept?.();}reject(){this.handlers.reject?.();}disconnect(){this.handlers.disconnect?.();}mute(){}sendDigits(){}
}
export class Device {
  constructor(){this.handlers={};globalThis.__fixturePhoneDevice=this;}
  on(name,handler){this.handlers[name]=handler;return this;}
  async register(){this.handlers.registered?.();}
  async connect(){return new FixtureCall();}
  destroy(){}updateToken(){}
  incoming(){this.handlers.incoming?.(new FixtureCall(true));}
}
"""


# ONE QUESTION PER STEP (FEED-IA §246). Peter's own first prompt is the first entry, verbatim.
PROMPTS = ["What's your current phone number?", "What's your mobile number?",
           "Forward your calls to this number", "Verify your caller ID", "Save call transcripts?"]


def check(value: bool, name: str) -> None:
    if not value:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


async def shot(page, path: Path) -> None:
    await page.wait_for_timeout(450)
    await page.screenshot(path=str(path))


async def one_question(page, step: int, width: int, tag: str) -> None:
    """The step asks exactly one question, at full weight, with exactly one primary action."""
    await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", str(step))
    await expect(page.get_by_test_id("phone-setup-prompt")).to_have_text(PROMPTS[step])
    heading = await page.get_by_test_id("phone-setup-prompt").evaluate("node => node.tagName")
    primary = page.locator('[data-testid="phone-setup"] button[type="submit"]')
    check(heading == "H2" and await primary.count() == 1,
          f"{width}px: {tag} step {step} asks «{PROMPTS[step]}» with one primary action")


async def run(browser, width: int) -> None:
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""if(!sessionStorage.getItem('phone-drive')){
      localStorage.clear();localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);sessionStorage.setItem('phone-drive','ready');}
    """)
    setup = {"source_number": "+51987654321", "fallback_number": "+51911111111", "recording": "off", "live_transcription": False}
    readiness = {"configured": True, "account_verified": True, "inbound_number": "+51987654321", "caller_id": "+51987654321",
                 "caller_id_verified": False, "browser_ready": True, "forwarding_state": "not-run", "transcription_ready": True}
    line = {"line_id": LINE, "mode": "commissioned", "setup": setup, "readiness": readiness, "checks": {}}
    evidence: dict[str, Any] = {"workspace_id": WORKSPACE, "mode": "commissioned", "setup": setup,
                                "readiness": readiness, "checks": {}, "default_line_id": LINE, "lines": [line]}
    saved_call: dict = {}
    requests: list[dict] = []
    authenticated: set[str] = set()

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        if "@twilio_voice-sdk" in path or "/assets/twilio-" in path:
            await route.fulfill(status=200, content_type="application/javascript", body=SDK)
            return
        payload = None
        if path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path.startswith("/api/cedar/phone/"):
            assert route.request.headers.get("authorization") == f"Bearer {TOKEN}", path
            if path not in authenticated:
                authenticated.add(path)
                check(True, f"{width}px: owner API authenticates {path}")
            body = route.request.post_data_json if route.request.method == "POST" else None
            requests.append({"path": path, "body": body})
            if path.endswith(f"/lines/{LINE}") and route.request.method == "DELETE":
                evidence.update(mode="sample", default_line_id=None, lines=[])
                evidence["setup"] = {"source_number": "", "fallback_number": "", "recording": "off", "live_transcription": False}
                evidence["readiness"] = {"configured": True, "account_verified": False, "inbound_number": "", "caller_id": "",
                                         "caller_id_verified": False, "browser_ready": False, "forwarding_state": "not-run", "transcription_ready": False}
                payload = evidence
            elif path.endswith(f"/lines/{LINE}/setup"):
                if body:
                    setup.update(body)
                payload = line
            elif path.endswith("/setup"):
                if body:
                    setup.update(body)
                payload = evidence
            elif path.endswith(f"/lines/{LINE}/caller-id/start"):
                payload = {"validation_code": "123456", "status": "pending"}
            elif path.endswith(f"/lines/{LINE}/caller-id/check"):
                readiness["caller_id_verified"] = True
                payload = line
            elif path.endswith(f"/lines/{LINE}/forwarding-test"):
                readiness["forwarding_state"] = "verified"
                payload = line
            elif path.endswith("/token"):
                payload = {"token": "fixture-token-" + "c" * 40, "identity": "cedar_fixture", "workspaceId": WORKSPACE, "expiresAt": time.time() + 600}
            elif path.endswith("/calls") and body:
                saved_call.update(sid=SID, sessionId="fixture-intent", direction="outbound", status="ringing", from_="unused")
                saved_call.update({"from": evidence["setup"]["source_number"], "to": body["to"], "startedAt": "2026-09-09T12:00:00Z", "recordingCustody": "none"})
                payload = {"intentId": "fixture-intent", "sid": SID, "params": {"Intent": "fixture-intent-token", "Workspace": WORKSPACE}}
            elif path.endswith("/calls/active"):
                payload = [saved_call] if saved_call and saved_call["status"] not in {"completed", "canceled"} else []
            elif path.endswith("/hangup"):
                saved_call.update(status="completed", endedAt="2026-09-09T12:01:00Z", durationSeconds=50,
                                  transcript={"transcript": "Quiero diez cajas.", "utterances": [{"speaker": 1, "start": 0, "end": 2, "text": "Quiero diez cajas."}],
                                              "language": "es", "provider": "deepgram nova-3"})
                payload = saved_call
            elif path.endswith(f"/calls/{STALE_SID}"):
                await route.fulfill(status=404, content_type="application/json", body='{"detail":"call not found"}')
                return
            elif "/calls/" in path:
                payload = saved_call
            elif path.endswith("/calls"):
                payload = [saved_call] if saved_call else []
        if payload is not None:
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"Isolated phone drive"}')

    await context.route("**/*", guard)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        rail = page.get_by_test_id("phone-rail")
        await rail.wait_for(state="visible", timeout=45000)
        await rail.click()
        await page.get_by_test_id("phone-setup").wait_for(state="visible")
        await expect(page.get_by_role("heading", name="Connect phone")).to_be_visible()
        await page.get_by_test_id("phone-connected-line").locator("button").first.click()
        await one_question(page, 2, width, "commissioned")
        check(await page.get_by_test_id("phone-forwarding-destination").inner_text() == "+51987654321",
              f"{width}px: the forwarding step states its destination")
        check(setup["recording"] == "off" and not setup["live_transcription"], f"{width}px: recording begins off")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 3, width, "commissioned")
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-verification-code")).to_have_text("123456")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 4, width, "commissioned")
        await page.get_by_test_id("phone-recording-consent").check()
        await shot(page, OUT / f"{width}-phone-setup.png")
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-setup")).to_have_count(0)
        check(
            setup["recording"] == "notice" and setup["live_transcription"] is True,
            f"{width}px: explicit transcript consent reaches setup API",
        )
        await page.evaluate("location.hash='#/phone/new?number=%2B51912345678'")
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        await expect(page.get_by_test_id("phone-call-number")).to_have_value("+51912345678")
        check(page.url.endswith("#/phone/new?number=%2B51912345678"), f"{width}px: direct dial URL restores its number")
        await page.get_by_test_id("phone-dial-keypad-toggle").click()
        await expect(page.get_by_test_id("phone-dial-keypad")).to_be_visible()
        await page.get_by_test_id("phone-dial-keypad-toggle").click()
        await page.get_by_test_id("phone-place-call").click()
        await page.get_by_test_id("phone-call-controller").wait_for(state="visible")
        saved_call.update(status="in-progress", answeredAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 8)),
                          liveTranscript={"provider": "deepgram", "language": "es", "utterances": [{"id": "line-one", "track": "outbound", "speaker": 1, "start": 0, "end": 2, "text": "Quiero diez cajas.", "final": True}]})
        await expect(page.get_by_test_id("phone-call-controller")).to_have_attribute("data-call-status", "in-progress")
        await page.get_by_test_id("phone-call-transcript-toggle").click()
        await expect(page.get_by_test_id("phone-live-transcript")).to_contain_text("Quiero diez cajas.")
        await shot(page, OUT / f"{width}-active-call.png")
        await page.get_by_test_id("phone-call-minimise").click()
        await page.evaluate("location.hash='#/money'")
        await page.get_by_test_id("money-overview").wait_for(state="visible")
        await expect(page.get_by_test_id("phone-call-controller")).to_be_visible()
        check(await page.get_by_test_id("phone-call-duration").text_content() != "0:00", f"{width}px: caller and duration persist across routes")
        await page.get_by_test_id("phone-call-conversation").click()
        await expect(page.get_by_test_id("connected-inbox")).to_be_visible()
        check(True, f"{width}px: persistent caller indicator returns to conversations")
        await page.get_by_test_id("phone-call-expand").click()
        await page.get_by_test_id("phone-call-end").click()
        await expect(page.get_by_test_id("phone-call-controller")).to_have_attribute("data-call-status", "completed")
        await expect(page.get_by_test_id("phone-call-controller")).to_contain_text("Saved transcript")
        await shot(page, OUT / f"{width}-saved-transcript.png")
        check(len([row for row in requests if row["path"].endswith("/calls") and row["body"]]) == 1, f"{width}px: one selected call creates one intent")
        await page.get_by_test_id("phone-call-dismiss").click()
        await page.evaluate(f"location.hash='#/phone/calls/{SID}'")
        await page.get_by_test_id("phone-call-route").wait_for(state="visible")
        await expect(page.locator(f'[data-testid="connected-phone-call"][data-call="{SID}"] button').first).to_have_attribute("aria-expanded", "true")
        await expect(page.get_by_test_id("connected-phone-transcript")).to_contain_text("Quiero diez cajas.")
        check(True, f"{width}px: saved call URL opens its transcript in call history")
        await page.get_by_label("Close call history").click()
        await page.evaluate(f"location.hash='#/phone/calls/{STALE_SID}'")
        await page.get_by_test_id("phone-call-route").wait_for(state="visible")
        await expect(page.get_by_test_id("connected-phone-history")).to_contain_text("Call unavailable")
        await expect(page.get_by_test_id("connected-phone-call")).to_have_count(0)
        check(True, f"{width}px: stale call URL shows unavailable without unrelated history")
        await page.get_by_label("Close call history").click()
        saved_call.clear()
        saved_call.update(sid="CA" + "3" * 32, direction="inbound", status="ringing", recordingCustody="none",
                          **{"from": "+51912345678", "to": evidence["setup"]["source_number"], "startedAt": "2026-09-09T12:02:00Z"})
        await expect(page.get_by_test_id("phone-call-controller")).to_have_attribute("data-call-status", "ringing")
        await page.evaluate("globalThis.__fixturePhoneDevice.incoming()")
        await expect(page.get_by_test_id("phone-call-answer")).to_be_visible()
        await shot(page, OUT / f"{width}-incoming-call.png")
        await page.get_by_test_id("phone-call-answer").click()
        saved_call.update(status="in-progress", answeredAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        await expect(page.get_by_test_id("phone-call-controller")).to_have_attribute("data-call-status", "in-progress")
        await page.get_by_test_id("phone-call-end").click()
        await expect(page.get_by_test_id("phone-call-controller")).to_have_attribute("data-call-status", "completed")
        check(True, f"{width}px: incoming browser call binds the existing parent and answers once")
        await page.get_by_test_id("phone-call-dismiss").click()
        await page.evaluate("location.hash='#/admin/connections'")
        await page.get_by_test_id("phone-rail").click()
        await expect(page.get_by_test_id("phone-rail")).to_contain_text("Connected")
        check(True, f"{width}px: a fully verified line reads Connected on its card")
        await page.get_by_test_id("phone-connected-line").locator("button").first.click()
        await one_question(page, 4, width, "resume")
        await page.get_by_test_id("setup-close").click()
        await page.get_by_test_id("phone-rail").click()
        await page.get_by_test_id("phone-disconnect-line").click()
        await expect(page.get_by_test_id("phone-add-line")).to_have_text("Connect phone")
        check(any(row["path"].endswith(f"/lines/{LINE}") and row["body"] is None for row in requests),
              f"{width}px: disconnect removes the selected phone line")
        check(not errors, f"{width}px: browser completes without page errors {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-failure.png"))
        print((await page.locator("body").inner_text())[:2500], flush=True)
        raise
    finally:
        await context.close()


async def run_uncommissioned(browser, width: int) -> None:
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""localStorage.clear();
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);""")
    call_posts: list[str] = []
    phone_writes: list[str] = []

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        if path.startswith("/api/cedar/phone/") and route.request.method in {"POST", "DELETE"}:
            phone_writes.append(path)
        if path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path.endswith("/phone/setup"):
            payload = {"workspace_id": WORKSPACE, "mode": "sample",
                       "setup": {"source_number": "", "fallback_number": "", "recording": "off", "live_transcription": False},
                       "readiness": {"configured": False, "account_verified": False, "inbound_number": "", "caller_id": "",
                                     "caller_id_verified": False, "browser_ready": False, "forwarding_state": "not-run", "transcription_ready": False},
                       "checks": {}, "default_line_id": None, "lines": []}
        elif path.endswith("/phone/calls/active"):
            payload = []
        elif path.endswith("/phone/calls") and route.request.method == "POST":
            call_posts.append(path)
            payload = {"detail": "activation required"}
        elif f"{parsed.scheme}://{parsed.netloc}" == f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}" and not path.startswith("/api/"):
            await route.continue_()
            return
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated phone drive"}')
            return
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/phone/new?number=%2B51912345678", wait_until="domcontentloaded")
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible", timeout=45000)
        await expect(page.get_by_test_id("phone-call-setup-state")).to_be_visible()
        await expect(page.get_by_text("Connect your phone with Twilio to make calls.", exact=True)).to_be_visible()
        artwork = page.get_by_test_id("phone-call-setup-state").locator("img")
        await expect(artwork).to_be_visible()
        check(await artwork.evaluate("image => image.complete && image.naturalWidth > 0"), f"{width}px: disconnected call artwork loads")
        for hidden_testid in ("phone-call-number", "phone-place-call", "phone-dial-keypad-toggle", "phone-dial-keypad"):
            check(await page.get_by_test_id(hidden_testid).count() == 0, f"{width}px: disconnected call hides {hidden_testid}")
        await shot(page, OUT / f"{width}-uncommissioned-dial.png")
        await expect(page.get_by_test_id("phone-call-open-setup")).to_have_text("Connect phone")
        await page.get_by_test_id("phone-call-open-setup").click()
        await expect(page.get_by_test_id("phone-setup")).to_be_visible()
        await expect(page.get_by_role("heading", name="Connect phone")).to_be_visible()
        await one_question(page, 0, width, "sample")
        await shot(page, OUT / f"{width}-setup-step-0.png")
        check(not call_posts, f"{width}px: disconnected call entry opens setup without creating a call")
        await page.get_by_test_id("setup-close").click()
        await page.evaluate("""localStorage.setItem('rocoto-cedar-onboarding-v1:fish',JSON.stringify({
          version:1,scope:'fish',step:'channel-setup',workspacePrepared:false,businessName:'Fixture',address:'Lima',ruc:'20123456789',
          selectedChannel:'phone',channels:[],catalogue:'pending',invoiceHistory:[],invoiceSearch:'pending'}));
          location.hash='#/onboarding/channel-setup';""")
        await page.get_by_test_id("phone-setup").wait_for(state="visible")
        await page.get_by_test_id("phone-test-data").click()
        await expect(page.get_by_test_id("phone-test-data-badge")).to_have_text("Test data")
        await one_question(page, 0, width, "test data")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 1, width, "test data")
        await shot(page, OUT / f"{width}-setup-step-1.png")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 2, width, "test data")
        await shot(page, OUT / f"{width}-setup-step-2.png")
        await page.get_by_test_id("phone-setup-continue").click()
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 3, width, "test data")
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-verification-code")).to_have_text("123456")
        await shot(page, OUT / f"{width}-setup-step-3.png")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 4, width, "test data")
        await shot(page, OUT / f"{width}-setup-step-4.png")
        await page.get_by_test_id("phone-recording-consent").check()
        await page.get_by_test_id("phone-setup-continue").click()
        selected = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-onboarding-v1:fish')).channels[0]")
        check(selected == {"channel": "phone", "status": "sample"}, f"{width}px: test data completes as sample state")
        check(not any("/phone/lines" in path for path in phone_writes), f"{width}px: test-data walkthrough makes no provider setup writes")
    finally:
        await context.close()



# ══ THE CONNECTION IS ONE STATE, POLLED (FEED-IA §246) ═══════════════════════════════════════
# «any action that has to do with calling someone should always result in the same thing, with the
#  image … You hard-coded the state, which should always just sort of poll … for the state of the
#  connection.»                                                                — Peter, 2026-09-10

SAMPLE_SETUP = {"source_number": "", "fallback_number": "", "recording": "off", "live_transcription": False}
SAMPLE_READINESS = {"configured": False, "account_verified": False, "inbound_number": "", "caller_id": "",
                    "caller_id_verified": False, "browser_ready": False, "forwarding_state": "not-run", "transcription_ready": False}
DIAL_CONTROLS = ("phone-call-number", "phone-place-call", "phone-dial-keypad-toggle", "phone-dial-keypad", "phone-call-customer")
# A BROWSER DRAFT LEFT BEHIND BY AN ABANDONED WALK. Connections used to read this as «Finish
# activation» and print its number, over the top of a provider that holds no line at all.
STALE_DRAFT = """localStorage.setItem('rocoto-phone-connection-v1:fish',JSON.stringify({
  version:1,tenant:'fish',sourceNumber:'+51999888777',fallbackNumber:'+51999888000',prepared:true,
  ownerId:'',numberPath:'existing',routingMode:'owner',ringGroupIds:[],schedule:'office-hours'}));"""


def sample_evidence() -> dict:
    return {"workspace_id": WORKSPACE, "mode": "sample", "setup": dict(SAMPLE_SETUP),
            "readiness": dict(SAMPLE_READINESS), "checks": {}, "default_line_id": None, "lines": []}


def commissioned_evidence(caller_id_verified: bool, forwarding_state: str, browser_ready: bool = True) -> dict:
    setup = {"source_number": "+51987654321", "fallback_number": "+51911111111", "recording": "off", "live_transcription": False}
    readiness = {"configured": True, "account_verified": True, "inbound_number": "+51987000111", "caller_id": "+51987654321",
                 "caller_id_verified": caller_id_verified, "browser_ready": browser_ready, "forwarding_state": forwarding_state,
                 "transcription_ready": True}
    line = {"line_id": LINE, "mode": "commissioned", "setup": dict(setup), "readiness": dict(readiness), "checks": {}}
    return {"workspace_id": WORKSPACE, "mode": "commissioned", "setup": dict(setup), "readiness": dict(readiness),
            "checks": {}, "default_line_id": LINE, "lines": [line]}


# ══ ONE WHATSAPP CONNECTION AND ONE CONVERSATION ═════════════════════════════════════════════
# The connected inbox's own `Call` act only stands once a conversation is open, so a block that
# presses it needs the panel to hold a bound account and a thread. Served only while a block asks
# for it (`state['whatsapp']`), so every other block keeps meeting the inbox's setup state.
INBOX_NUMBER = "+34931234567"
INBOX_CONVERSATION = {"id": "conv-nou", "name": "Marisquería Nou", "number": INBOX_NUMBER,
                      "lastMessage": "¿Tenéis merluza para mañana?", "lastAt": "2026-09-09T09:00:00Z", "count": 3}
INBOX_MESSAGES = {"messages": [{"id": "wa-1", "direction": "inbound", "text": "¿Tenéis merluza para mañana?",
                                "kind": "text", "timestamp": "2026-09-09T09:00:00Z",
                                "historical": False, "mediaAvailable": False}], "nextCursor": None}


def whatsapp_state() -> dict:
    """What the proof API answers for a workspace whose WhatsApp account is bound to this house."""
    return {"ready": True, "blockers": [],
            "meta": {"appId": "fixture", "configId": "fixture", "graphVersion": "v21.0"},
            "connection": {"wabaId": "waba-1", "phoneId": "phone-1", "number": "+34931000000",
                           "name": "Pescados Rocoto", "coexistence": False, "workspace": "fish"},
            "setup": None,
            "history": {"status": "complete", "progress": 100, "messages": 12, "conversations": 1,
                        "oldestAt": "2026-08-01T09:00:00Z", "newestAt": "2026-09-09T09:00:00Z"}}


async def phone_context(browser, width: int, state: dict, reads: list, extra_script: str = ""):
    """One isolated context whose only phone truth is `state['evidence']`, flippable mid-run."""
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""localStorage.clear();
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);""" + extra_script)
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        if "@twilio_voice-sdk" in path or "/assets/twilio-" in path:
            await route.fulfill(status=200, content_type="application/javascript", body=SDK)
            return
        payload: Any = None
        if state.get("whatsapp") and path.startswith("/api/proof/"):
            if path == "/api/proof/session":
                payload = {"ok": True}
            elif path == "/api/proof/state":
                payload = whatsapp_state()
            elif path == "/api/proof/conversations":
                payload = {"conversations": [INBOX_CONVERSATION]}
            elif path.endswith("/messages"):
                payload = json.loads(json.dumps(INBOX_MESSAGES))
        elif path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path.endswith("/phone/setup") and route.request.method == "GET":
            # THE FIRST READ IS HELD OPEN ON PURPOSE, AND BY A BARRIER RATHER THAN A CLOCK. The dial
            # is a lazy chunk, so a shared or restored `#/phone/new` URL routinely paints before the
            # provider has answered — the posture the answer-device choice used to latch on and
            # never leave. A fixed 1.2 s sleep made the assertion a race with the page's own boot:
            # it could only ever be too short, and a loaded box read `partial` where it wanted
            # `checking`. The read now waits for the drive's own release, so «the dial paints at
            # `checking` while the provider has not answered» is a fact the drive holds open.
            if state.get("park") and not state.get("parked"):
                state["parked"] = True
                while not state.get("release"):
                    await asyncio.sleep(0.05)
            reads.append(time.time())
            if state.get("fail"):
                await route.fulfill(status=503, content_type="application/json",
                                    body='{"detail":"The phone service is taking longer than expected. Try again."}')
                return
            payload = state["evidence"]
        elif path.endswith("/phone/calls/active"):
            payload = []
        elif "/phone/calls" in path:
            payload = state.get("calls", [])
        if payload is not None:
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated phone drive"}')

    await context.route("**/*", guard)
    return context


async def poll_again(page, reads: list) -> None:
    """Wait out the ten-second refresh floor, wake the tab, and wait for the next provider read."""
    elapsed = time.time() - (reads[-1] if reads else 0)
    if elapsed < 11:
        await page.wait_for_timeout(int((11 - elapsed) * 1000))
    before = len(reads)
    await page.evaluate("""window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));""")
    for _ in range(100):
        if len(reads) > before:
            return
        await page.wait_for_timeout(100)
    raise AssertionError("the phone connection was read once and never again")


# ══ THE FIRST CONNECT PHONE ON A SAMPLE ACCOUNT ══════════════════════════════════════════════
# The walk that CREATES its own line, which is the one the recovery effect could destroy: the
# sample account answers `lines: []`, so a snapshot read before the POST cannot contain the line
# the POST just made. Holding that absence against the line read it as revoked, wiped the walk's
# `lineId`, printed «This line was disconnected» and dropped step 2 to «Rocoto number awaiting
# activation» with the primary degraded to «Save phone setup» — on the ordinary demo path.
#
# The fixture models exactly that race: the read issued right after the POST answers the PRE-POST
# snapshot once, and every read is slowed so React commits and flushes its effects first.
ISSUED = "+447460094145"


async def run_first_walk(browser, width: int) -> None:
    """Step 0 → step 1 → POST /phone/lines → step 2, on an account that had no line at all."""
    created: dict[str, Any] = {}
    stale_reads = {"left": 1}
    posts: list[str] = []

    def evidence() -> dict:
        if not created or stale_reads["left"] > 0:
            return sample_evidence()
        return {"workspace_id": WORKSPACE, "mode": "commissioned", "setup": dict(created["setup"]),
                "readiness": dict(created["readiness"]), "checks": {}, "default_line_id": created["line_id"],
                "lines": [json.loads(json.dumps(created))]}

    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""localStorage.clear();
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);""")
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        payload: Any = None
        if path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path.endswith("/phone/lines") and route.request.method == "POST":
            body = route.request.post_data_json or {}
            posts.append(json.dumps(body, sort_keys=True))
            created.clear()
            created.update({
                "line_id": LINE, "mode": "commissioned",
                "setup": {"source_number": body.get("source_number", ""), "fallback_number": body.get("fallback_number", ""),
                          "recording": body.get("recording", "off"), "live_transcription": bool(body.get("live_transcription"))},
                # THE OPERATOR GRANT ISSUED THE NUMBER, so the issued number is also the caller ID
                # and `caller_id_verified` arrives true — the caller-ID step is already answered.
                "readiness": {"configured": True, "account_verified": True, "inbound_number": ISSUED, "caller_id": ISSUED,
                              "caller_id_verified": True, "browser_ready": True, "forwarding_state": "not-run",
                              "transcription_ready": True},
                "checks": {"number": {"issued": True, "country": "GB"}},
            })
            payload = json.loads(json.dumps(created))
        elif path.endswith(f"/lines/{LINE}/forwarding-test"):
            created["readiness"]["forwarding_state"] = "verified"
            payload = json.loads(json.dumps(created))
        elif path.endswith(f"/lines/{LINE}/setup"):
            created["setup"].update(route.request.post_data_json or {})
            payload = json.loads(json.dumps(created))
        elif path.endswith("/phone/setup"):
            await asyncio.sleep(0.4)
            payload = evidence()
            if stale_reads["left"] > 0 and created:
                stale_reads["left"] -= 1
        elif "/phone/calls" in path:
            payload = []
        if payload is not None:
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated phone drive"}')

    await context.route("**/*", guard)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    setup_frame = '[data-testid="phone-setup"]'
    try:
        await page.goto(URL + "#/phone/new?number=%2B51912345678", wait_until="domcontentloaded")
        await page.get_by_test_id("phone-call-open-setup").wait_for(state="visible", timeout=45000)
        await page.get_by_test_id("phone-call-open-setup").click()
        await one_question(page, 0, width, "first walk")
        await page.get_by_test_id("phone-source-number").fill("+12025550111")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 1, width, "first walk")
        await page.get_by_test_id("phone-mobile-number").fill("+447700900123")
        await page.get_by_test_id("phone-setup-continue").click()

        # ── THE LINE IT JUST CREATED IS STILL ITS LINE ─────────────────────────────────────
        await one_question(page, 2, width, "first walk")
        await page.wait_for_timeout(1500)          # let the stale read land and every effect flush
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "2")
        check(len(posts) == 1, f"{width}px: the first walk creates exactly one line · {posts}")
        alerts = await page.locator(f'{setup_frame} [role="alert"]').count()
        check(alerts == 0, f"{width}px: a line the walk just created raises no alert about itself")
        destination = await page.get_by_test_id("phone-forwarding-destination").inner_text()
        check(destination.strip() == ISSUED,
              f"{width}px: step 2 states the number the operator grant issued · {destination.strip()}")
        action = (await page.get_by_test_id("phone-setup-continue").inner_text()).strip()
        check("forwarding" in action.lower(),
              f"{width}px: the created line keeps its forwarding test as the primary act · {action}")
        await shot(page, OUT / f"{width}-first-walk-step-2.png")

        # ── AND THE ISSUED NUMBER IS ITS OWN CALLER ID, SO THAT STEP IS ALREADY ANSWERED ───
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "4")
        await one_question(page, 4, width, "first walk")
        check(True, f"{width}px: an issued number is the caller ID, so its verification step stands aside")
        await page.get_by_test_id("phone-recording-consent").check()
        await shot(page, OUT / f"{width}-first-walk-transcripts.png")
        words = await page.locator(setup_frame).inner_text()
        check("spoken recording notice" not in words,
              f"{width}px: the transcript step promises the transcript it saves · {words!r}")
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-setup")).to_have_count(0)
        check(created["setup"]["recording"] == "notice" and created["setup"]["live_transcription"] is True,
              f"{width}px: the transcript choice reaches the runtime in the vocabulary it accepts")

        # ── THE LINE IS NAMED BY THE NUMBER IT ANSWERS ON ─────────────────────────────────
        await page.evaluate("location.hash='#/admin/connections'")
        rail = page.get_by_test_id("phone-rail")
        await rail.wait_for(state="visible")
        await expect(rail).to_contain_text("Connected")
        check(ISSUED in await rail.inner_text(),
              f"{width}px: the Connections card prints the caller ID the grant issued")
        await rail.click()
        row = page.get_by_test_id("phone-connected-line").first
        await row.wait_for(state="visible")
        identity = (await row.locator("strong").first.inner_text()).strip()
        check(identity == ISSUED,
              f"{width}px: the lines list names the line by its issued number · {identity}")
        check("+12025550111" in await row.inner_text(),
              f"{width}px: and keeps the business number beside it · " + (await row.inner_text()).replace("\n", " · "))
        await shot(page, OUT / f"{width}-first-walk-lines.png")
        check(not errors, f"{width}px: the first walk completes without page errors {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-first-walk-failure.png"))
        print((await page.locator("body").inner_text())[:2000], flush=True)
        raise
    finally:
        await context.close()


# ══ THE OTHER ORDERING: AN OLDER READ LANDS LAST ═════════════════════════════════════════════
# `run_first_walk` drives the stale read that arrives BEFORE the fresh one, which the walk's own
# `reported` ref holds. This block drives the reverse, which it could not: a `/phone/setup` read
# issued before the line existed, parked in flight, and released only after the post-write read has
# already published the line. The walk had then seen the line, so the next snapshot that lacks it
# reads as a revocation — «This line was disconnected», step 0, from a read that merely predates the
# write. A read that began before a write is older than the truth, so its answer is discarded.
async def run_write_order(browser, width: int) -> None:
    """Step 0 → step 1 → POST /phone/lines → an OLDER read lands, and the line stands."""
    created: dict[str, Any] = {}
    parked = {"armed": False, "hit": False, "release": False}
    second = {"armed": False, "hit": False, "release": False}
    saved: list[dict] = []
    reads: list[float] = []

    def evidence() -> dict:
        if not created:
            return sample_evidence()
        return {"workspace_id": WORKSPACE, "mode": "commissioned", "setup": dict(created["setup"]),
                "readiness": dict(created["readiness"]), "checks": {}, "default_line_id": created["line_id"],
                "lines": [json.loads(json.dumps(created))]}

    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""localStorage.clear();
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);""")
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        payload: Any = None
        if path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path.endswith("/phone/lines") and route.request.method == "POST":
            body = route.request.post_data_json or {}
            created.clear()
            created.update({
                "line_id": LINE, "mode": "commissioned",
                "setup": {"source_number": body.get("source_number", ""), "fallback_number": body.get("fallback_number", ""),
                          "recording": body.get("recording", "off"), "live_transcription": bool(body.get("live_transcription"))},
                "readiness": {"configured": True, "account_verified": True, "inbound_number": ISSUED, "caller_id": ISSUED,
                              "caller_id_verified": True, "browser_ready": True, "forwarding_state": "not-run",
                              "transcription_ready": True},
                "checks": {"number": {"issued": True, "country": "GB"}},
            })
            payload = json.loads(json.dumps(created))
        elif path.endswith(f"/lines/{LINE}/forwarding-test"):
            created["readiness"]["forwarding_state"] = "verified"
            payload = json.loads(json.dumps(created))
        elif path.endswith(f"/lines/{LINE}/setup"):
            # THE SECOND WRITE THE WALK MAKES, and the one whose answer only reaches the surfaces
            # through `await provider.refresh()`. Nothing else publishes after it.
            created["setup"].update(route.request.post_data_json or {})
            saved.append(dict(created["setup"]))
            payload = json.loads(json.dumps(created))
        elif path.endswith("/phone/setup"):
            reads.append(time.time())
            if second["armed"] and not second["hit"]:
                # A POLL READ HELD OPEN ACROSS THE SECOND WRITE. `refreshPhoneSetup` used to hand
                # the walk's own `await provider.refresh()` this very task, which the write stamp
                # had already condemned — so the refresh resolved having published nothing, and
                # the choice the provider had just saved was missing from the capability every
                # surface reads until the next poll.
                second["hit"] = True
                older = evidence()
                while not second["release"]:
                    await asyncio.sleep(0.05)
                payload = older
            elif parked["armed"] and not parked["hit"]:
                # THE READ THAT BEGAN BEFORE THE WRITE. Its answer is taken now — while the line
                # does not exist — and handed back only after the post-write read has published.
                parked["hit"] = True
                older = evidence()
                while not parked["release"]:
                    await asyncio.sleep(0.05)
                payload = older
            else:
                payload = evidence()
        elif "/phone/calls" in path:
            payload = []
        if payload is not None:
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated phone drive"}')

    await context.route("**/*", guard)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(30000)
    setup_frame = '[data-testid="phone-setup"]'
    try:
        await page.goto(URL + "#/phone/new?number=%2B51912345678", wait_until="domcontentloaded")
        await page.get_by_test_id("phone-call-open-setup").wait_for(state="visible", timeout=45000)
        await page.get_by_test_id("phone-call-open-setup").click()
        await one_question(page, 0, width, "write order")
        await page.get_by_test_id("phone-source-number").fill("+12025550111")
        await page.get_by_test_id("phone-setup-continue").click()
        await one_question(page, 1, width, "write order")
        await page.get_by_test_id("phone-mobile-number").fill("+447700900123")

        # ── A READ STARTS, AND IT IS STILL IN FLIGHT WHEN THE LINE IS CREATED ─────────────
        parked["armed"] = True
        elapsed = time.time() - (reads[-1] if reads else 0)
        if elapsed < 11:
            await page.wait_for_timeout(int((11 - elapsed) * 1000))
        await page.evaluate("""window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));""")
        for _ in range(200):
            if parked["hit"]:
                break
            await page.wait_for_timeout(100)
        check(parked["hit"], f"{width}px: a provider read is in flight when the line is created")

        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "2")
        await expect(page.get_by_test_id("phone-forwarding-destination")).to_have_text(ISSUED)

        # ── AND WHEN IT LANDS, IT IS OLDER THAN THE TRUTH ────────────────────────────────
        parked["release"] = True
        await page.wait_for_timeout(1800)
        alerts = await page.locator(f'{setup_frame} [role="alert"]').count()
        check(alerts == 0,
              f"{width}px: a read issued before the line existed raises no alert about it")
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "2")
        check(True, f"{width}px: and the walk stays on the step the line reached")
        destination = (await page.get_by_test_id("phone-forwarding-destination").inner_text()).strip()
        check(destination == ISSUED,
              f"{width}px: the issued number still stands as the forwarding destination · {destination}")
        await shot(page, OUT / f"{width}-write-order.png")

        # ── AND THE REFRESH A WRITE IS FOLLOWED BY IS NEVER THE READ THAT WRITE CONDEMNED ──
        # `refreshPhoneSetup` hands a second caller the read already in flight. Phone setup's last
        # step is `saveLineSetup`, then `await provider.refresh()` — so that refresh could be handed
        # a task the write stamp had already condemned: it resolved having published nothing, the
        # walk stood on its `finally`, and the choice the provider had just saved was missing from
        # the capability. A write drops the doomed read with it, so the next reader starts a fresh
        # one. The poll read is parked ACROSS the write to hold that ordering open.
        await page.get_by_test_id("phone-setup-continue").click()
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "4")
        await one_question(page, 4, width, "write order")
        await page.get_by_test_id("phone-recording-consent").check()
        second["armed"] = True
        elapsed = time.time() - (reads[-1] if reads else 0)
        if elapsed < 11:
            await page.wait_for_timeout(int((11 - elapsed) * 1000))
        await page.evaluate("""window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));""")
        for _ in range(200):
            if second["hit"]:
                break
            await page.wait_for_timeout(100)
        check(second["hit"], f"{width}px: a provider read is in flight when the transcript choice is saved")
        await page.get_by_test_id("phone-setup-continue").click()
        for _ in range(90):
            if await page.get_by_test_id("phone-setup").count() == 0:
                break
            await page.wait_for_timeout(100)
        check(await page.get_by_test_id("phone-setup").count() == 0,
              f"{width}px: the refresh the walk awaits after a write lands while an older read is parked")
        check(bool(saved) and saved[-1]["recording"] == "notice" and saved[-1]["live_transcription"] is True,
              f"{width}px: the transcript choice reaches the runtime · {saved[-1] if saved else None}")

        # The capability the next surface reads carries that saved choice rather than the pre-write
        # evidence a discarded response leaves standing.
        await page.evaluate("location.hash='#/admin/connections'")
        rail = page.get_by_test_id("phone-rail")
        await rail.wait_for(state="visible")
        await rail.click()
        row = page.get_by_test_id("phone-connected-line").first
        await row.wait_for(state="visible")
        await row.locator("button").first.click()
        await expect(page.get_by_test_id("phone-setup-step")).to_have_attribute("data-step", "4")
        check(await page.get_by_test_id("phone-recording-consent").is_checked(),
              f"{width}px: and the saved choice stands in the capability the next surface reads")
        await shot(page, OUT / f"{width}-write-order-saved.png")
        second["release"] = True
        check(not errors, f"{width}px: the write-order walk completes without page errors {errors}")
    except Exception:
        parked["release"] = True
        second["release"] = True
        await page.screenshot(path=str(OUT / f"{width}-write-order-failure.png"))
        print((await page.locator("body").inner_text())[:2000], flush=True)
        raise
    finally:
        parked["release"] = True
        second["release"] = True
        await context.close()


async def run_state_led(browser, width: int) -> None:
    # THE BROWSER IS NOT REGISTERED WHILE THE LINE IS HALF COMMISSIONED, which is the fact the
    # answer-device choice used to latch on: it opened on the mobile and stayed there for the rest
    # of the dialog's life, even after the line registered this browser.
    state = {"evidence": commissioned_evidence(caller_id_verified=False, forwarding_state="waiting", browser_ready=False),
             "park": True}
    reads: list = []
    context = await phone_context(browser, width, state, reads, extra_script=STALE_DRAFT)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        # ── A HALF-COMMISSIONED LINE IS THE IMAGE, NOT A KEYPAD ─────────────────────────────
        await page.goto(URL + "#/phone/new?number=%2B51912345678", wait_until="domcontentloaded")
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible", timeout=45000)
        posture = page.get_by_test_id("phone-call-setup-state")
        await posture.wait_for(state="visible")
        # The dial paints before the provider answers, so it opens at `checking` — one picture and
        # one act there too — and settles on the line's own posture when the read lands. The read is
        # PARKED for both halves of that sentence: held open while the first is read, released for
        # the second.
        check(state.get("parked") is True,
              f"{width}px: the provider read this dial is waiting on is held open")
        check(await posture.get_attribute("data-phone-posture") == "checking",
              f"{width}px: a dial that paints before the provider answers shows the same one picture")
        state["release"] = True
        await expect(posture).to_have_attribute("data-phone-posture", "partial")
        check(True, f"{width}px: a commissioned line with caller ID and forwarding pending reads partial")
        await expect(page.get_by_text("Connect your phone with Twilio to make calls.", exact=True)).to_be_visible()
        artwork = posture.locator("img")
        check(await artwork.evaluate("image => image.complete && image.naturalWidth > 0"),
              f"{width}px: partial commissioning shows the same phone image")
        await expect(page.get_by_test_id("phone-call-open-setup")).to_have_text("Connect phone")
        for hidden in DIAL_CONTROLS:
            check(await page.get_by_test_id(hidden).count() == 0,
                  f"{width}px: partial commissioning hides {hidden}")
        await shot(page, OUT / f"{width}-partial-dial.png")

        # ── THE CARD READS THE PROVIDER, NEVER THE BROWSER DRAFT ────────────────────────────
        await page.evaluate("location.hash='#/admin/connections'")
        rail = page.get_by_test_id("phone-rail")
        await rail.wait_for(state="visible")
        words = await rail.inner_text()
        check("Finish setup" in words, f"{width}px: Connections states a partial line as Finish setup · {words!r}")
        check("+51987654321" in words, f"{width}px: the Phone card prints the provider's own number")
        check("+51999888777" not in words, f"{width}px: a stale browser draft never speaks for the connection")
        await shot(page, OUT / f"{width}-connections-partial.png")

        # ── CANCELLED SETUP RETURNS TO THE SAME DIAL ────────────────────────────────────────
        await page.evaluate("location.hash='#/phone/new?number=%2B51912345678'")
        await page.get_by_test_id("phone-call-setup-state").wait_for(state="visible")
        await page.get_by_test_id("phone-call-open-setup").click()
        await page.get_by_test_id("phone-setup").wait_for(state="visible")
        await page.get_by_test_id("setup-close").click()
        await page.get_by_test_id("phone-call-setup-state").wait_for(state="visible")
        check(page.url.endswith("#/phone/new?number=%2B51912345678"),
              f"{width}px: cancelled setup returns to the dial with the same number")

        # ── THE LINE IS COMMISSIONED ELSEWHERE, AND THIS PAGE FINDS OUT ─────────────────────
        state["evidence"] = commissioned_evidence(caller_id_verified=True, forwarding_state="verified")
        await poll_again(page, reads)
        await page.get_by_test_id("phone-call-number").wait_for(state="visible")
        await expect(page.get_by_test_id("phone-call-number")).to_have_value("+51912345678")
        await expect(page.get_by_test_id("phone-place-call")).to_be_visible()
        check(await page.get_by_test_id("phone-call-setup-state").count() == 0,
              f"{width}px: a line verified elsewhere reaches the open dial without a reload")
        # THE ANSWER DEVICE FOLLOWS THE PROVIDER IN BOTH DIRECTIONS. This dial opened while the
        # line was still partial, so the browser was unavailable and the choice stood on the
        # mobile; the line now registers this browser, so the choice comes back to it.
        await expect(page.get_by_test_id("phone-answer-browser")).to_have_attribute("aria-pressed", "true")
        check(await page.get_by_test_id("phone-answer-phone").get_attribute("aria-pressed") == "false",
              f"{width}px: a registered browser takes the answer back from the mobile")
        await shot(page, OUT / f"{width}-ready-dial.png")

        # ── A READ THAT FAILED IS A FACT ABOUT THE NETWORK, NOT ABOUT THE LINE ──────────────
        state["fail"] = True
        await poll_again(page, reads)
        await page.get_by_test_id("phone-dial-stale").wait_for(state="visible")
        check(await page.get_by_test_id("phone-place-call").count() == 1,
              f"{width}px: a transient read keeps a verified line dialling")
        check(await page.get_by_test_id("phone-call-setup-state").count() == 0,
              f"{width}px: and keeps the dial off the artwork")
        check((await page.get_by_test_id("phone-dial-stale").inner_text()).strip() == "Checking…",
              f"{width}px: the dial says «Checking…» and nothing else changes")
        check(await page.locator('[data-testid="phone-dial-dialog"] [role="alert"]').count() == 0,
              f"{width}px: and it says it ONCE — the quiet line is the whole statement")
        await shot(page, OUT / f"{width}-stale-dial.png")
        state["fail"] = False
        await poll_again(page, reads)
        await expect(page.get_by_test_id("phone-dial-stale")).to_have_count(0)
        check(True, f"{width}px: the next good read clears the stale word")

        # ── AND WHEN IT IS REVOKED, THE CONTROLS LEAVE ──────────────────────────────────────
        state["evidence"] = sample_evidence()
        await poll_again(page, reads)
        await page.get_by_test_id("phone-call-setup-state").wait_for(state="visible")
        check(await page.get_by_test_id("phone-call-setup-state").get_attribute("data-phone-posture") == "setup",
              f"{width}px: a revoked line returns the dial to its image")
        for hidden in DIAL_CONTROLS:
            check(await page.get_by_test_id(hidden).count() == 0,
                  f"{width}px: a revoked line hides {hidden}")
        check(not errors, f"{width}px: the state-led walk completes without page errors {errors}")
    except Exception:
        state["release"] = True
        await page.screenshot(path=str(OUT / f"{width}-state-led-failure.png"))
        print((await page.locator("body").inner_text())[:2000], flush=True)
        raise
    finally:
        state["release"] = True
        await context.close()


# ONE SAVED CALL WITH ITS WORDS, so the sheet's own call records are asserted rather than its
# empty state: the leg used to wait for `connected-phone-history` against a fixture that answered
# zero calls, which proved only that the section mounts.
SHEET_CALL = {
    "sid": "CA" + "7" * 32, "direction": "inbound", "from": "+51987654321", "to": "+51911111111",
    "startedAt": "2026-09-09T10:00:00Z", "endedAt": "2026-09-09T10:02:18Z", "durationSeconds": 138,
    "status": "completed", "recordingCustody": "none",
    "transcript": {"transcript": "Quiero diez cajas de merluza.", "language": "es", "provider": "deepgram nova-3",
                   "utterances": [{"speaker": 0, "start": 0.4, "end": 2.1, "text": "Pescados Rocoto, dígame."},
                                  {"speaker": 1, "start": 2.6, "end": 6.9, "text": "Quiero diez cajas de merluza."}]},
}


async def run_entrances(browser, width: int) -> None:
    """Every call entrance on the customer sheet goes to one place, and none of them is `tel:`."""
    state = {"evidence": sample_evidence(), "calls": [SHEET_CALL], "whatsapp": True}
    reads: list = []
    context = await phone_context(browser, width, state, reads)
    page = await context.new_page()
    telephone: list[str] = []
    page.on("request", lambda request: telephone.append(request.url) if request.url.startswith("tel:") else None)
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + f"#/customers/{CUSTOMER}", wait_until="domcontentloaded")
        await page.get_by_test_id("sheet-number").wait_for(state="visible", timeout=45000)
        number = (await page.get_by_test_id("sheet-number").inner_text()).strip()
        check(number.startswith("+"), f"{width}px: the sheet carries the account's own number · {number}")

        standing = page.get_by_test_id("sheet-calls-standing")
        await standing.wait_for(state="visible")
        check(await standing.get_attribute("data-phone-posture") == "setup",
              f"{width}px: the sheet's call rail reads the shared connection state")

        for entrance in ("sheet-bar-act", "sheet-call-out"):
            await page.evaluate(f"location.hash='#/customers/{CUSTOMER}'")
            await page.get_by_test_id(entrance).wait_for(state="visible")
            await page.get_by_test_id(entrance).click()
            await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
            hash_now = page.url.split("#", 1)[1] if "#" in page.url else ""
            check(hash_now.startswith("/phone/new?"), f"{width}px: {entrance} opens the canonical dial route · {hash_now}")
            check(f"customer={CUSTOMER}" in hash_now, f"{width}px: {entrance} carries the intended customer")
            check("number=%2B" in hash_now, f"{width}px: {entrance} carries the intended number")
            await expect(page.get_by_test_id("phone-call-setup-state")).to_be_visible()
            await expect(page.get_by_test_id("phone-call-open-setup")).to_have_text("Connect phone")
            check(await page.get_by_test_id("phone-place-call").count() == 0,
                  f"{width}px: {entrance} on an uncommissioned account offers the image and one act")
            await shot(page, OUT / f"{width}-{entrance}-dial.png")
            await page.get_by_test_id("setup-close").click()

        check(not telephone, f"{width}px: no call entrance navigates to tel: · {telephone}")
        check(page.url.startswith(URL.split("#")[0]), f"{width}px: every call entrance stays inside the app")

        # ── A SURFACE A ROUTE WOULD TAKE AWAY KEEPS THE DIAL ABOVE IT ──────────────────────
        # The connected inbox, the customer sheet opened over a product card and the one opened
        # from knows-web are the same class: component state with no address of their own, so
        # `location.hash='#/phone/new…'` unmounts their host and `history.back()` cannot bring
        # them back. With one of them standing, the entrance opens the dial IN PLACE.
        await page.evaluate(f"location.hash='#/customers/{CUSTOMER}'")
        await page.get_by_test_id("sheet-call-out").wait_for(state="visible")
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{}}))")
        await page.get_by_test_id("connected-inbox").wait_for(state="visible")
        before = page.url
        # The chat panel paints OVER the sheet in this arrangement, where the product-card and
        # knows-web overlays put the very same button in front of the person; the act under test is
        # the entrance's own handler, so the press is dispatched on the real button.
        await page.get_by_test_id("sheet-call-out").dispatch_event("click")
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        check(page.url == before,
              f"{width}px: an entrance under a standing overlay opens the dial without moving the route · {page.url}")
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: and the surface it was pressed on is still standing")
        await expect(page.get_by_test_id("phone-call-setup-state")).to_be_visible()
        check(await page.get_by_test_id("phone-call-open-setup").count() == 1,
              f"{width}px: the in-place dial is the same one picture and the same one act")
        await shot(page, OUT / f"{width}-overlay-dial.png")

        # ── AND THE ONE ACT IT OFFERS FINISHES THE WALK WHERE IT STANDS ────────────────────
        # `Connect phone` on the in-place dial used to set `#/admin/connections`, so the single act
        # the overlay's dial offers took the overlay away — and landed somewhere different from the
        # identical press on the route dial, which opens phone setup inside the dialog it is in.
        await page.get_by_test_id("phone-call-open-setup").click()
        await page.get_by_test_id("phone-setup").wait_for(state="visible")
        check(page.url == before,
              f"{width}px: Connect phone on the in-place dial opens setup without moving the route · {page.url}")
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: and the surface it was pressed on is still standing behind setup")
        await one_question(page, 0, width, "in-place setup")
        await shot(page, OUT / f"{width}-overlay-setup.png")
        await page.get_by_test_id("setup-close").click()
        await page.get_by_test_id("phone-call-setup-state").wait_for(state="visible")
        check(page.url == before,
              f"{width}px: and closing setup returns to the same in-place dial · {page.url}")

        await page.get_by_test_id("setup-close").click()
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: closing the in-place dial leaves that surface where it was")

        # ── ONE BACK CLOSES THE DIAL, AND THE SURFACE UNDER IT IS STILL THERE ─────────────
        # The dial used to watch the ADDRESS alone. Every surface it opens above is a same-address
        # history layer — `useHistoryLayer` pushes at `window.location.href` — so the first Back
        # fires `popstate` at an unchanged href: the surface went and the dial stayed, standing over
        # whatever was drawn next. The dial takes a history step of its own, so the FIRST press —
        # the one a person actually makes — closes the dial and leaves the surface standing.
        await page.evaluate("location.hash='#/sales'")
        await page.wait_for_timeout(500)
        await page.evaluate(f"location.hash='#/customers/{CUSTOMER}'")
        await page.get_by_test_id("sheet-call-out").wait_for(state="visible")
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{}}))")
        await page.get_by_test_id("connected-inbox").wait_for(state="visible")
        await page.get_by_test_id("sheet-call-out").dispatch_event("click")
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        standing_at = page.url
        await page.go_back()
        await page.wait_for_timeout(700)
        check(await page.get_by_test_id("phone-dial-dialog").count() == 0,
              f"{width}px: one browser Back closes the in-place dial · {page.url}")
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: and the surface it stood over is still standing")
        check(page.url == standing_at,
              f"{width}px: the address the dial was opened at is the address left behind · {page.url}")
        await shot(page, OUT / f"{width}-back-once.png")

        # ── THE CONNECTED INBOX'S OWN CALL ACT, PRESSED WHERE IT ACTUALLY STANDS ──────────
        # The inbox's `Call` is the act two reviews named, and no drive had ever pressed it: the
        # panel only draws it inside an open conversation, so the fixture answers a bound WhatsApp
        # account and one thread and the walk opens it.
        await page.evaluate(f"location.hash='#/customers/{CUSTOMER}'")
        await page.get_by_test_id("sheet-call-out").wait_for(state="visible")
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{}}))")
        await page.get_by_test_id("connected-inbox").wait_for(state="visible")
        conversation = page.get_by_test_id("connected-whatsapp-conversation").first
        await conversation.wait_for(state="visible")
        await conversation.click()
        entrance = page.get_by_test_id("connected-inbox-call")
        await entrance.wait_for(state="visible")
        here = page.url
        await entrance.click()
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        check(page.url == here,
              f"{width}px: the inbox's own Call act opens the dial without moving the route · {page.url}")
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: and the inbox it was pressed in is still standing")
        check(await page.get_by_test_id("phone-call-open-setup").count() == 1,
              f"{width}px: the inbox's Call act lands on the same one picture and the same one act")
        await shot(page, OUT / f"{width}-inbox-call-dial.png")
        await page.get_by_test_id("setup-close").click()
        check(await page.get_by_test_id("connected-inbox").count() == 1,
              f"{width}px: and closing it leaves the conversation where it was")

        # ── THE SHEET'S OWN CALL RECORDS, WITH THEIR WORDS ─────────────────────────────────
        await page.goto(URL + f"#/customers/{CUSTOMER}", wait_until="domcontentloaded")
        await page.get_by_test_id("sheet-number").wait_for(state="visible")
        # Scoped to the sheet's own Calls block: the connected inbox draws the same component for
        # the conversation it holds, so an unscoped id names two sections on this surface.
        history = page.get_by_test_id("sheet-calls").get_by_test_id("connected-phone-history")
        await history.wait_for(state="visible")
        await history.get_by_test_id("connected-phone-call").first.wait_for(state="visible")
        check(await history.get_by_test_id("connected-phone-call").count() == 1,
              f"{width}px: the sheet draws the provider's own call record")

        # ── AND THE ROW'S TWO SIDES STAY OFF EACH OTHER WHERE THE GLASS IS NARROWEST ──────
        # At 320 «Transcript saved» painted straight through «09/09/2026, 05:00:00»: `minWidth:0`
        # sat on the inline-flex WRAPPER, and the label inside it is a flex item at the default
        # `min-width:auto`, so it refused to shrink and the wrapper overflowed its own track onto
        # the middle column. A sideways-overflow measurement cannot see that — the collision is
        # INSIDE the row — so the two boxes are measured against each other.
        await page.set_viewport_size({"width": 320, "height": 900})
        await page.wait_for_timeout(600)
        await page.get_by_test_id("sheet-calls").scroll_into_view_if_needed()
        await page.wait_for_timeout(400)
        # The box a span occupies and the box its TEXT paints in are different things when the text
        # cannot shrink: the element stayed inside its track and the words went over the column
        # beside it. The painted extent is what a reader sees, so it is what is measured.
        painted = """(node)=>{const box=node.getBoundingClientRect();
          return {l:box.left, r:box.left+Math.max(box.width,node.scrollWidth),
                  t:box.top, b:box.top+Math.max(box.height,node.scrollHeight)};}"""
        when = await history.get_by_test_id("connected-phone-call-when").first.evaluate(painted)
        said = await history.get_by_test_id("connected-phone-call-state").first.evaluate(painted)
        across = min(when["r"], said["r"]) - max(when["l"], said["l"])
        down = min(when["b"], said["b"]) - max(when["t"], said["t"])
        check(not (across > 0.5 and down > 0.5),
              f"{width}px: at 320 the call row's label and its date each stay in their own box · "
              f"overlap {round(across, 1)}x{round(down, 1)}")
        await shot(page, OUT / f"{width}-320-call-row.png")
        await page.set_viewport_size({"width": width, "height": 900})
        await page.wait_for_timeout(500)

        await history.get_by_test_id("connected-phone-call").first.locator("button").first.click()
        await history.get_by_test_id("connected-phone-transcript-toggle").click()
        await expect(history.get_by_test_id("connected-phone-transcript")).to_contain_text("merluza")
        check(True, f"{width}px: and its transcript expands one level deeper on the sheet")
        await shot(page, OUT / f"{width}-customer-calls.png")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-entrances-failure.png"))
        print((await page.locator("body").inner_text())[:2000], flush=True)
        raise
    finally:
        await context.close()


# ══ THE CALL ENTRANCE ON A TELEPHONE CONVERSATION ════════════════════════════════════════════
# `CallDock` stands where a composer would on a telephone conversation, and it is the primary act
# of that surface. It carried `customer.phone` — which a seeded telephone account never holds, its
# number being derived from its own record — so on a commissioned workspace it opened the dial with
# an empty field, no customer selector and a dead Call button.
async def run_conversation(browser, width: int) -> None:
    """A telephone conversation's Call act opens the dial carrying that account's own number."""
    state = {"evidence": commissioned_evidence(caller_id_verified=True, forwarding_state="verified"), "calls": []}
    reads: list = []
    context = await phone_context(browser, width, state, reads)
    page = await context.new_page()
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/sales", wait_until="domcontentloaded")
        rows = page.locator("[data-river-row]")
        await rows.first.wait_for(state="attached", timeout=45000)
        # A river row states its sale, and a conversation states its channel, so the telephone one
        # is found by walking rather than by naming a fixture id.
        ids = [await rows.nth(index).get_attribute("data-river-row") for index in range(min(await rows.count(), 26))]
        found = None
        for sale in ids:
            await page.evaluate(f"location.hash='#/sales/{sale}'")
            await page.wait_for_timeout(240)
            conversation = page.get_by_test_id("conversation").first
            if await conversation.count() and await conversation.get_attribute("data-channel") == "phone":
                found = sale
                break
        check(found is not None, f"{width}px: a telephone conversation stands in the day · {found}")
        act = page.get_by_test_id("call-action").first
        await act.wait_for(state="visible")
        await act.click()
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        number = (await page.get_by_test_id("phone-call-number").input_value()).strip()
        plain = number.replace(" ", "")
        check(plain.startswith("+") and len(plain) >= 9,
              f"{width}px: the conversation's Call act opens the dial carrying that account's own number · {number!r}")
        call = page.get_by_test_id("phone-place-call")
        check(await call.count() == 1 and not await call.is_disabled(),
              f"{width}px: and the Call button is live on a commissioned workspace · {(await call.inner_text()).strip()}")
        hash_now = page.url.split("#", 1)[1] if "#" in page.url else ""
        check("number=%2B" in hash_now,
              f"{width}px: the act carries the number on the canonical dial route · {hash_now}")
        await shot(page, OUT / f"{width}-conversation-dial.png")
        await page.get_by_test_id("setup-close").click()

        # ── AND THE SAME ACT INSIDE THE MESSAGES PANEL KEEPS THE CONVERSATION ─────────────
        # `CallDock` stands in the panel too, and there a hash write is fatal: `useRouteTransition`
        # in `shell/chats.tsx` nulls `minimizedWorkspace`, closes the panel and drops the thread,
        # and `closeCallRoute`'s `history.back()` returns the address without returning the
        # conversation. The panel is a surface a route would take away, so the dial opens above it.
        who = parse_qs(hash_now.split("?", 1)[1]).get("customer", [""])[0]
        check(bool(who), f"{width}px: the telephone conversation names its customer · {who}")
        await page.evaluate(f"location.hash='#/sales/{found}'")
        # The day's own line cards sit over the launcher at the narrow width, and the act under test
        # is the panel's, so the launcher press is dispatched on the real button.
        await page.get_by_test_id("chats-launcher").dispatch_event("click")
        panel = page.get_by_test_id("chats-overlay")
        await panel.get_by_test_id(f"thread-{who}").click()
        await panel.get_by_test_id("thread-view").wait_for(state="visible")
        await expect(panel.get_by_test_id("thread-view")).to_have_attribute("data-thread-open", who)
        act = panel.get_by_test_id("call-action").first
        await act.wait_for(state="visible")
        here = page.url
        await act.click()
        await page.get_by_test_id("phone-dial-dialog").wait_for(state="visible")
        check(page.url == here,
              f"{width}px: the panel's own Call act opens the dial without moving the route · {page.url}")
        check(await panel.get_by_test_id("thread-view").get_attribute("data-thread-open") == who,
              f"{width}px: and the conversation it was pressed in is still open · {who}")
        await shot(page, OUT / f"{width}-panel-call-dial.png")
        await page.get_by_test_id("setup-close").click()
        await expect(page.get_by_test_id("phone-dial-dialog")).to_have_count(0)
        check(await panel.get_by_test_id("thread-view").get_attribute("data-thread-open") == who,
              f"{width}px: closing the dial leaves that same conversation open · {who}")
        check(page.url == here,
              f"{width}px: and the address never moved for either press · {page.url}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-conversation-failure.png"))
        print((await page.locator("body").inner_text())[:2000], flush=True)
        raise
    finally:
        await context.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    global URL
    server = None
    if not URL:
        if not (DIST / "app.html").is_file():
            raise SystemExit(f"{DIST}/app.html is not there. Run `npm run build:app-en` first.")
        handler = functools.partial(
            type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}),
            directory=str(DIST),
        )
        server = socketserver.TCPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        URL = f"http://127.0.0.1:{server.server_address[1]}/app.html"
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            try:
                blocks = {"commissioned": run, "uncommissioned": run_uncommissioned,
                          "first-walk": run_first_walk, "write-order": run_write_order,
                          "state-led": run_state_led, "entrances": run_entrances,
                          "conversation": run_conversation}
                for width in (1600, 390):
                    for name, block in blocks.items():
                        if ONLY and name not in ONLY:
                            continue
                        await block(browser, width)
            finally:
                await browser.close()
    finally:
        if server is not None:
            server.shutdown()
    (OUT / "result.json").write_text(json.dumps({"mode": "owner API and SDK fixtures", "checks": CHECKS}, indent=2))
    print(f"{len(CHECKS)} GREEN", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
