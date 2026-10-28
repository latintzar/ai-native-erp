#!/usr/bin/env python3
"""Cedar's onboarding proof in isolated desktop and mobile browsers.

Two milestones where Money is on, and one where it is off: `run_spain_money_off` walks a Spanish
workspace whose channel Continue is the last step of the walk, and holds the Business setup ring to
the single milestone it then counts (FEED-IA §247.9).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

URL = os.getenv("ROCOTO_URL", "http://127.0.0.1:8097/app.html").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-onboarding-proof"))
KEY = "rocoto-cedar-onboarding-v1:fish"
CHECKS: list[str] = []
FAILURES: list[str] = []
BOOT = """if (!sessionStorage.getItem('cedar-onboarding-drive')) {
  localStorage.clear();
  localStorage.setItem('rocoto-app-config', JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');
  sessionStorage.setItem('cedar-onboarding-drive', 'ready');
}
globalThis.__onboardingEvents=[];
window.addEventListener('rocoto:cedar-onboarding-changed', event => globalThis.__onboardingEvents.push(event.detail));"""


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


async def saved(page):
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


async def step(page, name: str):
    await expect(page.get_by_test_id("onboarding-step")).to_have_attribute("data-step", name)


async def shot(page, width: int, name: str):
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def run_viewport(browser, width: int):
    def label(name: str) -> str:
        return f"{width}px: {name}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(BOOT)
    blocked: list[str] = []

    async def guard(route):
        request = route.request
        parsed = urlsplit(request.url)
        origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
        if f"{parsed.scheme}://{parsed.netloc}" == origin and not parsed.path.startswith("/api/"):
            await route.continue_()
        else:
            blocked.append(request.url)
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated onboarding drive"}')

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(20000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(URL + "#/onboarding/channel", wait_until="domcontentloaded")
        await step(page, "channel")
        await expect(page.get_by_test_id("setup-close")).to_have_count(0)
        check(True, label("full-page onboarding has a single navigation path"))
        await expect(page.get_by_test_id("onboarding-channel-choices")).to_be_visible()
        await expect(page.get_by_test_id("onboarding-channel-whatsapp")).to_be_visible()
        await expect(page.get_by_test_id("onboarding-channel-email")).to_be_visible()
        await expect(page.get_by_test_id("onboarding-channel-phone")).to_be_visible()
        text = await page.get_by_test_id("onboarding-step").inner_text()
        check("sample" not in text.lower() and "preview" not in text.lower(), label("channel choice uses ordinary product language"))
        await shot(page, width, "channel")

        await page.evaluate("window.location.hash='#/onboarding/bank'")
        await step(page, "channel")
        check((await saved(page))["channels"] == [], label("bank deep link waits for a communication channel"))

        # ── §246 · THE CHANNEL-SETUP FALL-THROUGH RETURNS TO THE QUESTION, IN THE URL TOO ─────
        # `#/onboarding/channel-setup` is reachable directly. The model already sent the STATE back
        # to the question, but the address bar stayed on the setup step — so Back, a reload and a
        # shared link all landed on a step that was already over, and the step itself offered
        # «Connect WhatsApp Business» whatever the person had chosen.
        await page.evaluate("window.location.hash='#/onboarding/channel-setup'")
        await page.wait_for_function("window.location.hash === '#/onboarding/channel'")
        await step(page, "channel")
        await expect(page.get_by_test_id("onboarding-provider-setup")).to_have_count(0)
        check(True, label("a channel-setup link with no channel chosen returns to the question"))

        # ── AND THAT REDIRECT REPLACES THE ENTRY RATHER THAN PUSHING ONE (§246 review) ────────
        # Assigning `location.hash` PUSHES, so the redirect left [ …, the deep link, the question ]
        # in history. Back returned to the deep link, the reader fired again, pushed the question
        # back on top and truncated the forward entry — every press landed the person exactly where
        # they already were, and whatever preceded the link (a sale, an email, the opener of a
        # shared link) was unreachable for ever. `move()` still pushes: a step a PERSON takes is a
        # place they came from.
        await page.evaluate("window.location.hash='#/sales'")
        await page.wait_for_function("window.location.hash === '#/sales'")
        await page.wait_for_timeout(400)
        await page.evaluate("window.location.hash='#/onboarding/channel-setup'")
        await page.wait_for_function("window.location.hash === '#/onboarding/channel'")
        await page.go_back()
        await page.wait_for_timeout(600)
        check(await page.evaluate("window.location.hash") == "#/sales",
              label("and Back from that redirect reaches what preceded the link"))
        await page.evaluate("window.location.hash='#/onboarding/channel'")
        await step(page, "channel")

        heading = await page.get_by_role("heading", name="Where do orders arrive?").bounding_box()
        check(heading and heading["y"] < 300, label("setup question sits near the top of the page"))
        boxes = [await page.get_by_test_id("onboarding-channel-" + channel).bounding_box() for channel in ["whatsapp", "email"]]
        check(boxes[0] and boxes[1] and abs(boxes[0]["y"] - boxes[1]["y"]) < 2,
              label("channel choices sit side by side"))
        await page.get_by_test_id("onboarding-channel-whatsapp").click()
        await page.get_by_test_id("whatsapp-use-test-data").click()
        await expect(page.get_by_test_id("meta-test-mode")).to_have_text("Test data")
        await expect(page.get_by_test_id("meta-phone")).not_to_have_value("")
        for _ in range(3):
            await page.get_by_test_id("meta-next").click()
        await page.get_by_test_id("meta-share-chats").check()
        await page.get_by_test_id("meta-next").click()
        await page.get_by_test_id("meta-complete").click()
        await page.get_by_test_id("setup-bank-bbva").wait_for(state="visible")
        state = await saved(page)
        check(state["step"] == "bank" and state["channels"] == [{"channel":"whatsapp","status":"sample"}],
              label("test-data WhatsApp walkthrough advances to bank with fixture provenance"))
        events = await page.evaluate("globalThis.__onboardingEvents")
        check(any(event and event.get("scope") == "fish" for event in events),
              label("same-tab progress event carries the workspace scope"))
        await shot(page, width, "bank")

        await page.get_by_test_id("setup-bank-bbva").click()
        await expect(page.get_by_test_id("setup-bank-account")).to_have_value("Main receiving account")
        # ONE QUESTION PER STEP (FEED-IA §246): the account's name, then the consent act on its own
        # screen, then «Authorization sent» — the provider owns the word «connected».
        check(await page.get_by_test_id("setup-bank-consent").count() == 0,
              label("the money account step asks for the account name alone"))
        await page.get_by_test_id("setup-account-continue").click()
        await page.get_by_test_id("setup-connect-sample").click()
        await page.get_by_test_id("setup-payment-authorized").wait_for(state="visible")
        check(await page.get_by_test_id("setup-payment-ready").count() == 0,
              label("a finished local walk words itself as sent, never as connected"))
        await page.get_by_test_id("setup-payment-done").click()
        await step(page, "complete")
        state = await saved(page)
        check(state["workspacePrepared"] is True and state["step"] == "complete",
              label("bank completion prepares the workspace and opens completion"))
        await expect(page.get_by_test_id("onboarding-start-selling")).to_have_text("Open workspace")
        await shot(page, width, "complete")
        await page.get_by_test_id("onboarding-start-selling").click()
        await page.wait_for_function("window.location.hash === '#/sales'")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-of", "2")
        # ── §246 · A `sample` ROW IS A NOTE ABOUT A WALK, NEVER A CONNECTION ──────────────────
        # The Business setup card used to read `state.channels.some(status === 'connected' ||
        # 'sample' || 'prepared')`, so the Meta TEST-DATA walkthrough this drive just completed
        # painted a ✓ on the communication milestone for a workspace whose provider had answered
        # nothing at all — and a half-finished phone walk read `Ready` the same way. The bank
        # milestone this walk really did complete stands; communication waits for a provider.
        # Both milestones are provider-led now, and this drive answers `/api/` with 503 — so the
        # walk records what it walked and neither milestone claims a connection nobody made.
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-communication", "setup")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-bank", "setup")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-done", "0")
        check((await saved(page))["channels"] == [{"channel": "whatsapp", "status": "sample"}],
              label("the sample row is still recorded as the note about the walk that it is"))
        check(True, label("a sample channel row completes no milestone"))

        await page.goto(URL + "#/onboarding", wait_until="domcontentloaded")
        await step(page, "complete")
        await expect(page.get_by_test_id("onboarding-start-selling")).to_have_text("Open workspace")
        await expect(page.get_by_role("button", name="Business details")).to_be_visible()
        await expect(page.get_by_role("button", name="Product catalogue")).to_be_visible()
        await expect(page.get_by_role("button", name="Invoice history")).to_be_visible()
        await page.goto(URL + "#/onboarding/history", wait_until="domcontentloaded")
        await step(page, "history")
        await expect(page.get_by_test_id("onboarding-upload-invoices")).to_be_visible()
        check(True, label("prepared workspace can open optional invoice history directly"))
        await page.reload(wait_until="domcontentloaded")
        await step(page, "history")
        check((await saved(page))["workspacePrepared"] is True, label("optional route survives reload"))
        await shot(page, width, "history")

        check(not errors, label(f"onboarding runs without browser exceptions: {errors}"))
        (OUT / f"{width}-requests.json").write_text(json.dumps({"blocked": blocked}, indent=2))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "failure")
        (OUT / f"{width}-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


# ══ §246 · CONTINUE WITH SEVERAL CONNECTED CHANNELS ASKS WHICH ═══════════════════════════════
# «Continue» used to take `CHANNELS.find(row => connected[row.id])!.id` — the first entry in
# DECLARATION order. With phone genuinely connected AND WhatsApp connected, it recorded WhatsApp,
# because WhatsApp is written first in `cedar-onboarding.tsx`. The count above it describes a SET;
# one act that silently picks a member of it is a decision the person should be making.
LINE_ID = "line_" + "d" * 20
WORKSPACE_ID = "f" * 32


def phone_commissioned() -> dict:
    setup = {"source_number": "+51987654321", "fallback_number": "+51911111111",
             "recording": "off", "live_transcription": False}
    readiness = {"configured": True, "account_verified": True, "inbound_number": "+51987000111",
                 "caller_id": "+51987654321", "caller_id_verified": True, "browser_ready": True,
                 "forwarding_state": "verified", "transcription_ready": True}
    line = {"line_id": LINE_ID, "mode": "commissioned", "setup": dict(setup),
            "readiness": dict(readiness), "checks": {}}
    return {"workspace_id": WORKSPACE_ID, "mode": "commissioned", "setup": dict(setup),
            "readiness": dict(readiness), "checks": {}, "default_line_id": LINE_ID, "lines": [line]}


WHATSAPP_BOUND = {
    "ready": True, "blockers": [],
    "meta": {"appId": "fixture", "configId": "fixture", "graphVersion": "v23.0"},
    "connection": {"wabaId": "waba-1", "phoneId": "phone-1", "number": "+51987000222",
                   "name": "Pescados del Puerto", "coexistence": False, "workspace": "fish"},
    "setup": None,
    "history": {"status": "complete", "progress": 100, "messages": 4, "conversations": 1,
                "oldestAt": None, "newestAt": None},
}


async def run_connected_choice(browser, width: int):
    def label(name: str) -> str:
        return f"{width}px: {name}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700, timezone_id="America/Lima")
    await context.add_init_script(BOOT)

    async def guard(route):
        path = urlsplit(route.request.url).path
        if path == "/api/proof/session":
            await route.fulfill(json={"ok": True})
        elif path == "/api/proof/state":
            await route.fulfill(json=WHATSAPP_BOUND)
        elif path == "/api/cedar/access/workspaces":
            await route.fulfill(json={"workspace_id": WORKSPACE_ID, "access_token": "t" * 64,
                                      "expires_at": 4102444800})
        elif path == "/api/cedar/phone/setup":
            await route.fulfill(json=phone_commissioned())
        elif path.startswith("/api/"):
            await route.fulfill(status=404, json={"detail": "This fixture answers two channels."})
        else:
            await route.continue_()

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(20000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(URL + "#/onboarding/channel", wait_until="domcontentloaded")
        await step(page, "channel")
        await expect(page.get_by_test_id("onboarding-connected-count")).to_have_text("2 connected")
        await expect(page.get_by_test_id("onboarding-use-connected")).to_have_count(0)
        choice = page.get_by_test_id("onboarding-connected-choice")
        await expect(choice).to_be_visible()
        await expect(page.get_by_test_id("onboarding-use-whatsapp")).to_contain_text("WhatsApp Business")
        await expect(page.get_by_test_id("onboarding-use-phone")).to_contain_text("Phone")
        await expect(page.get_by_test_id("onboarding-use-email")).to_have_count(0)
        seats = [await page.get_by_test_id(f"onboarding-use-{row}").bounding_box() for row in ["whatsapp", "phone"]]
        check(all(seat and seat["height"] >= 44 - 0.5 for seat in seats),
              label("each connected channel is its own 44px act"))
        await page.screenshot(path=str(OUT / f"{width}-connected-choice.png"))
        await page.get_by_test_id("onboarding-use-phone").click()
        await page.get_by_test_id("setup-bank-bbva").wait_for(state="visible")
        recorded = await saved(page)
        check(recorded["channels"] == [{"channel": "phone", "status": "connected"}],
              label("the channel the person pressed is the channel recorded"))
        check(recorded["selectedChannel"] == "phone",
              label("and array order decides nothing"))
        # THE MILESTONE AGREES WITH THE TILE BESIDE IT. A commissioned, caller-ID-verified line
        # used to read «0 of 2» on the Business setup card while this screen read it as connected.
        await page.evaluate("window.location.hash='#/sales'")
        await page.get_by_test_id("journey-card").wait_for(state="visible")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-communication", "ready")
        check(not errors, label(f"connected-channel choice runs without browser exceptions: {errors}"))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await page.screenshot(path=str(OUT / f"{width}-connected-choice-failure.png"))
        (OUT / f"{width}-connected-choice-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


# ══ §247.9 · A SPANISH WORKSPACE WALKS CHANNEL → COMPLETE ════════════════════════════════════
# «also ensure you have the good spain / peru toggle which in spains case hides the money shit»
#                                                                     — Peter, 13 September 2026
# The bank step mounts `MoneySetup`, so with Money off it is a Money door: the walk is the order
# channel and then the finished workspace, the step that used to prepare the workspace is the
# channel's own Continue, and the Business setup ring counts one milestone rather than two with one
# of them unreachable. WhatsApp answers as a bound account so the walk has a channel to continue on.
SPAIN_MONEY_OFF = json.dumps({
    "version": 1, "pricing": True, "inventory": False, "money": False,
    "country": "spain", "moneyByCountry": {"peru": True, "spain": False},
})
SPAIN_BOOT = BOOT.replace(
    "sessionStorage.setItem('cedar-onboarding-drive', 'ready');",
    f"  localStorage.setItem('rocoto-workspace-capabilities:fish', {json.dumps(SPAIN_MONEY_OFF)});\n"
    "  sessionStorage.setItem('cedar-onboarding-drive', 'ready');",
)


async def run_spain_money_off(browser, width: int):
    def label(name: str) -> str:
        return f"{width}px: {name}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700, timezone_id="Europe/Madrid")
    await context.add_init_script(SPAIN_BOOT)

    async def guard(route):
        path = urlsplit(route.request.url).path
        if path == "/api/proof/session":
            await route.fulfill(json={"ok": True})
        elif path == "/api/proof/state":
            await route.fulfill(json=WHATSAPP_BOUND)
        elif path == "/api/cedar/access/workspaces":
            await route.fulfill(json={"workspace_id": WORKSPACE_ID, "access_token": "t" * 64,
                                      "expires_at": 4102444800})
        elif path.startswith("/api/"):
            await route.fulfill(status=404, json={"detail": "This workspace connected one channel."})
        else:
            await route.continue_()

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(20000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(URL + "#/onboarding/channel", wait_until="domcontentloaded")
        await step(page, "channel")
        await expect(page.get_by_test_id("onboarding-connected-count")).to_have_text("1 connected")
        said = await page.locator("body").inner_text()
        check("Connect your bank account" not in said, label("the walk offers no bank step"))
        await shot(page, width, "spain-channel")

        # THE CHANNEL'S OWN CONTINUE PREPARES THE WORKSPACE, because it is the last step of the walk.
        await page.get_by_test_id("onboarding-use-connected").click()
        await step(page, "complete")
        check(await page.get_by_test_id("setup-bank-bbva").count() == 0,
              label("Continue lands on the finished workspace rather than a bank account"))
        saved_state = await saved(page)
        check(saved_state["step"] == "complete" and saved_state["workspacePrepared"] is True,
              label("and the workspace is prepared by the step that finished the walk"))
        check(saved_state["channels"] == [{"channel": "whatsapp", "status": "connected"}],
              label("with the channel the person continued on recorded"))
        await expect(page.get_by_test_id("onboarding-start-selling")).to_have_text("Open workspace")
        await shot(page, width, "spain-complete")

        # ── THE BANK STEP'S OWN ADDRESS RETURNS TO THE QUESTION ───────────────────────────────
        await page.evaluate("window.location.hash='#/onboarding/bank'")
        await page.wait_for_timeout(600)
        hash_now = await page.evaluate("window.location.hash")
        check(hash_now != "#/onboarding/bank", label("a bank deep link stands on a step this workspace has"))
        said = await page.locator("body").inner_text()
        check("Connect your bank account" not in said, label("and the bank question stays off the screen"))

        # ── THE RING COUNTS ONE MILESTONE, AND SAYS SO ────────────────────────────────────────
        await page.evaluate("window.location.hash='#/sales'")
        await page.get_by_test_id("journey-card").wait_for(state="visible")
        journey = page.get_by_test_id("journey-card")
        await expect(journey).to_have_attribute("data-of", "1")
        await expect(journey).to_have_attribute("data-done", "1")
        await expect(journey).to_have_attribute("data-communication", "ready")
        await expect(journey).to_have_attribute("aria-label", "Business setup · 1 of 1 complete")
        check(await journey.get_attribute("data-bank") is None,
              label("the ring carries no bank milestone with Money off"))
        await journey.click()
        card = await page.get_by_test_id("setup-progress").inner_text()
        check("Bank account" not in card, label("and the Business setup card offers none either"))
        await page.screenshot(path=str(OUT / f"{width}-spain-setup-card.png"))
        check(not errors, label(f"the Spanish walk runs without browser exceptions: {errors}"))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await page.screenshot(path=str(OUT / f"{width}-spain-failure.png"))
        (OUT / f"{width}-spain-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


async def main():
    if urlsplit(URL).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local app URL for this drive.")
    OUT.mkdir(parents=True, exist_ok=True)
    widths = [int(os.environ["ROCOTO_ONLY"])] if os.getenv("ROCOTO_ONLY") else [1600, 390]
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        for width in widths:
            await run_viewport(browser, width)
            await run_connected_choice(browser, width)
            await run_spain_money_off(browser, width)
        await browser.close()
    (OUT / "result.json").write_text(json.dumps({"ui": URL, "checks": CHECKS, "failures": FAILURES}, indent=2))
    print(f"{len(CHECKS)} GREEN / {len(FAILURES)} RED · {OUT}", flush=True)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
