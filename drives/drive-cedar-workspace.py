#!/usr/bin/env python3
"""Cedar category navigation, prepared entry, export disclosure, responsive layout and Reset Cedar.

    ROCOTO_DIST=app/dist-export-review .venv/bin/python drives/drive-cedar-workspace.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served entry. `ROCOTO_SHOTS` selects the screenshot folder.

The first block blocks every provider/API request and walks the workspace. `run_reset_section`
holds the Reset Cedar rows at 1600, 390 and 320 on their own, so that surface gates on itself. The
RESET blocks (FEED-IA §247.6) answer the provider traffic themselves, so the run reaches no network:
`run_reset_data` seeds a changed workspace, presses «Reset workspace data» and proves the seeded
defaults return while WhatsApp, phone and email stay exactly as connected as they were;
`run_reset_disconnect` presses «Reset and disconnect everything» and counts the provider calls —
one Meta session, one DELETE per phone line, one DELETE per mailbox — then reads the Connections
postures back. `fail_phone`, run at 1600 AND 390, holds one provider at «Still connected» with its
44 px retry beside a two-line reason, proves the local reset landed anyway, and proves that the
refused line KEEPS its local mirror until the retry answers. Once either act has swept, the card
holds past Escape and a scrim click, so the only exit is the reload behind «Open the workspace» —
and `exit_by="back"` proves the ROUTE is that same exit, because browser Back on a swept card
performs the reload rather than leaving a live half-reset app standing. `run_reset_stopped` holds
`/phone/setup` open for 2.5 s and catches the walk in flight: «Stop» and browser Back abort the same
controller, so the sweep never runs, the account that already answered hands over its mirror, the
line the walk never released keeps its own, and the stopped card closes through «Close».
"""

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
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
URL = os.getenv("ROCOTO_URL", "").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-workspace-check"))
OUT.mkdir(parents=True, exist_ok=True)

WORKSPACE = "a" * 32
TOKEN = "b" * 64
LINES = ["line_" + "c" * 24, "line_" + "d" * 24]
ACCOUNTS = ["acct_gmail_one", "acct_outlook_two"]
CHECKS: list[str] = []

# The keys a changed workspace is holding when the reset is pressed, and what each one proves.
SEEDED = {
    "rocoto-app-day": json.dumps({"version": 7, "sectors": {}}),
    "rocoto-cedar-money-v1:fish": json.dumps({"version": 1, "scope": "fish"}),
    "rocoto-cedar-finance-v1:fish": json.dumps({"plan": "drive-advance"}),
    "rocoto-cedar-onboarding-v1:fish": json.dumps({"scope": "fish", "step": "channels"}),
    "rocoto-app-reply-drafts": json.dumps({"version": 1, "drafts": {}}),
    "rocoto-app-print-journal": json.dumps({"version": 1, "jobs": []}),
    "rocoto-phone-connection-v1:fish": json.dumps({
        "version": 1, "tenant": "fish", "sourceNumber": "+51987654321",
        "fallbackNumber": "+51911111111", "prepared": True, "ownerId": "", "forwardingAcknowledged": False}),
    "rocoto-workspace-capabilities:fish": json.dumps({
        "version": 1, "pricing": True, "inventory": False, "money": False,
        "country": "spain", "moneyByCountry": {"peru": True, "spain": False}}),
}
# What a data reset keeps, so the connections stand exactly as they stand.
KEPT_BY_DATA_RESET = {
    "rocoto-rail-open": "no",
    "rocoto-cedar-whatsapp-selected-v1": "true",
    "rocoto-cedar-email-intake-cursor-v1": "cursor-9",
    "rocoto-cedar-phone-browser-v1": "enabled",
}

SDK = """export class Device {
  constructor(){this.handlers={};}
  on(name,handler){this.handlers[name]=handler;return this;}
  async register(){this.handlers.registered?.();}
  async connect(){return {on(){return this;},accept(){},reject(){},disconnect(){},mute(){},sendDigits(){}};}
  destroy(){}updateToken(){}
}
"""


def check(value: bool, name: str) -> None:
    if not value:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


async def shot(page, path: Path) -> None:
    await page.wait_for_timeout(450)
    await page.screenshot(path=str(path), full_page=True)


def seed_script(extra: str = "") -> str:
    entries = {**SEEDED, **KEPT_BY_DATA_RESET}
    writes = "".join(f"localStorage.setItem({json.dumps(k)},{json.dumps(v)});" for k, v in entries.items())
    return (
        "if(!sessionStorage.getItem('cedar-reset-drive')){localStorage.clear();"
        "localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));"
        "localStorage.setItem('rocoto-runtime-base',location.origin);"
        f"{writes}"
        "localStorage.setItem('rocoto-cedar-channel-access-v1:'+location.origin,JSON.stringify("
        f"{{workspace_id:{json.dumps(WORKSPACE)},access_token:{json.dumps(TOKEN)},"
        "expires_at:Math.floor(Date.now()/1000)+3600}));"
        f"{extra}"
        "sessionStorage.setItem('cedar-reset-drive','ready');}"
    )


# ── THE PROVIDER FIXTURES ────────────────────────────────────────────────────────────────────
# Every account this workspace holds, and the calls the reset makes against them. The fixture is
# the only witness the drive trusts: a «Disconnected» word beside an empty call log proves nothing.
def provider_world(fail_phone: bool = False, phone_delay_ms: int = 0) -> dict[str, Any]:
    readiness = {
        "configured": True, "account_verified": True, "inbound_number": "+51987000111",
        "caller_id": "+51987654321", "caller_id_verified": True, "browser_ready": False,
        "forwarding_state": "verified", "transcription_ready": True,
    }
    choices = {"source_number": "+51987654321", "fallback_number": "+51911111111",
               "recording": "off", "live_transcription": False}
    return {
        "fail_phone": fail_phone,
        # THE PHONE ANSWERS SLOWLY, so the walk can be caught in flight. `/phone/setup` is the
        # evidence read every line release waits on, so holding it holds the whole phone step.
        "phone_delay_ms": phone_delay_ms,
        "whatsapp": True,
        "lines": [{"line_id": line, "mode": "commissioned", "setup": dict(choices),
                   "readiness": dict(readiness), "checks": {}} for line in LINES],
        "accounts": [{"account_ref": ref, "provider": "google" if "gmail" in ref else "outlook",
                      "mode": "connected", "status": "connected", "label": f"{ref}@example.test",
                      "revision": 1, "history_complete": True, "synced_at": "2026-09-10T09:00:00Z",
                      "invoice_consent_at": None, "forwarding_address": None} for ref in ACCOUNTS],
        "choices": choices, "readiness": readiness,
        "calls": {"whatsapp": [], "lines": [], "accounts": []},
    }


def phone_evidence(world: dict[str, Any]) -> dict[str, Any]:
    lines = world["lines"]
    return {
        "workspace_id": WORKSPACE, "mode": "commissioned" if lines else "sample",
        "setup": dict(world["choices"]) if lines else {"source_number": "", "fallback_number": "",
                                                       "recording": "off", "live_transcription": False},
        "readiness": dict(world["readiness"]) if lines else {
            "configured": True, "account_verified": False, "inbound_number": "", "caller_id": "",
            "caller_id_verified": False, "browser_ready": False, "forwarding_state": "not-run",
            "transcription_ready": False},
        "checks": {}, "default_line_id": lines[0]["line_id"] if lines else None, "lines": lines,
    }


def whatsapp_state(world: dict[str, Any]) -> dict[str, Any]:
    return {
        "ready": True, "blockers": [],
        "meta": {"appId": "fixture", "configId": "fixture", "graphVersion": "v21.0"},
        # `whatsappCapabilityOf` reads Connected off ONE fact: a connection this workspace owns,
        # so the fixture states the binding the provider would report (§247.2). A connection
        # naming no workspace is a house switch left half way, and the card says so.
        "connection": {"wabaId": "waba-1", "phoneId": "phone-1", "number": "+51987654321",
                       "name": "Pescados Manolo", "coexistence": False,
                       "workspace": "fish"} if world["whatsapp"] else None,
        "setup": None,
        "history": {"status": "complete", "progress": 100, "messages": 12, "conversations": 3,
                    "oldestAt": "2026-08-01T09:00:00Z", "newestAt": "2026-09-10T09:00:00Z"},
    }


def make_guard(world: dict[str, Any], origin: str):
    async def guard(route):
        parsed = urlsplit(route.request.url)
        path, method = parsed.path, route.request.method
        if "@twilio_voice-sdk" in path or "/assets/twilio-" in path:
            await route.fulfill(status=200, content_type="application/javascript", body=SDK)
            return
        payload: Any = None
        status = 200
        if path == "/api/proof/session":
            payload = {"ok": True}
        elif path == "/api/proof/state":
            payload = whatsapp_state(world)
        elif path == "/api/proof/whatsapp/disconnect":
            world["calls"]["whatsapp"].append(method)
            world["whatsapp"] = False
            payload = {"connection": None}
        elif path == "/api/cedar/access/workspaces":
            payload = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path == "/api/cedar/phone/setup":
            if world["phone_delay_ms"]:
                await asyncio.sleep(world["phone_delay_ms"] / 1000)
            payload = phone_evidence(world)
        elif path.startswith("/api/cedar/phone/lines/") and method == "DELETE":
            line_id = path.rsplit("/", 1)[-1]
            if world["fail_phone"]:
                await route.fulfill(status=503, content_type="application/json",
                                    body='{"detail":"Reconnect the phone service, then try again."}')
                return
            world["calls"]["lines"].append(line_id)
            world["lines"] = [row for row in world["lines"] if row["line_id"] != line_id]
            payload = phone_evidence(world)
        elif path == "/api/cedar/phone/calls/active":
            payload = []
        elif path == "/api/cedar/phone/token":
            status, payload = 503, {"detail": "This browser stays off in the drive."}
        elif path == "/api/cedar/email/status":
            payload = {"provider": "unipile", "configured": True, "accounts": world["accounts"]}
        elif path.startswith("/api/cedar/email/accounts/") and method == "DELETE":
            ref = path.rsplit("/", 1)[-1]
            world["calls"]["accounts"].append(ref)
            world["accounts"] = [row for row in world["accounts"] if row["account_ref"] != ref]
            payload = {"disconnected": True}
        if payload is not None:
            await route.fulfill(status=status, content_type="application/json", body=json.dumps(payload))
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"Isolated workspace drive"}')

    return guard


async def open_reset(page, testid: str, width: int, tag: str) -> None:
    """The row opens one question at full weight, with exactly one primary action."""
    await page.get_by_test_id(f"row-{testid}").click()
    await page.get_by_test_id("reset-card").wait_for(state="visible")
    heading = await page.get_by_test_id("reset-question").evaluate("node => node.tagName")
    question = await page.get_by_test_id("reset-question").inner_text()
    primary = page.locator('[data-testid="reset-card"] [data-testid="reset-confirm"]')
    check(heading == "H2" and question.endswith("?") and await primary.count() == 1,
          f"{width}px: {tag} asks «{question}» with one primary action")


async def stored(page, key: str):
    return await page.evaluate("key => localStorage.getItem(key)", key)


def country_pill(page, country: str):
    """The country the workspace is standing in, read off the control rather than the value.

    The trailing value column stands down at phone widths (three columns on a 288 px row painted
    the label under the value), so `[data-value="workspace-country-choice"]` exists at 1600 and
    not at 390. The selected pill is the same fact at every width.
    """
    return page.locator(f'[data-selected]:has([data-testid="workspace-country-{country}"])')


async def run_workspace(browser, width: int, results: list) -> None:
    context = await browser.new_context(
        viewport={"width": width, "height": 1000 if width > 500 else 844}, device_scale_factor=1
    )
    # ⚠ 2026-09-11 · THE MILESTONES ARE PROVIDER-LED (§247.2). This block used to abort every
    # /api/** and read «2 of 2» off the seeded local flag; that flag is a visit now and carries no
    # vote, so the WhatsApp connection is answered here the way drive-cedar-operations-hub.py
    # answers it — a connection bound to this workspace — while the bank stays unconnected, which
    # is what a workspace with no Prometeo account honestly reads: one milestone of two.
    whatsapp_state = {
        "ready": True, "blockers": [],
        "meta": {"appId": "123", "configId": "456", "graphVersion": "v23.0"},
        "connection": {"wabaId": "fixture-waba", "phoneId": "fixture-phone", "number": "+15555550163",
                       "name": "Connected business", "coexistence": True, "workspace": "fish"},
        "history": {"status": "complete", "progress": 100, "messages": 0, "conversations": 0, "oldestAt": None, "newestAt": None},
    }

    async def workspace_guard(route, _request=None, *, state=whatsapp_state):
        path = urlsplit(route.request.url).path
        if path == "/api/proof/session":
            await route.fulfill(json={"ok": True})
        elif path == "/api/proof/state":
            await route.fulfill(json=state)
        elif path == "/api/proof/intake":
            await route.fulfill(json={"workspace": "fish", "messages": [], "nextCursor": None})
        else:
            await route.abort()

    await context.route("**/api/**", workspace_guard)
    await context.add_init_script(
        """if(!sessionStorage.seeded){localStorage.clear();localStorage.setItem('rocoto-app-front-door','months');localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));localStorage.setItem('rocoto-runtime-base','http://127.0.0.1:9');sessionStorage.seeded='yes';}"""
    )
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e, collected=errors: collected.append(str(e)))
    try:
        await page.goto(URL)
        await page.wait_for_url("**/#/sales", timeout=25000, wait_until="commit")
        await page.evaluate("location.hash='#/money'")
        await page.get_by_test_id("money-overview").wait_for()
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-of", "2")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-communication", "ready")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-bank", "setup")
        await expect(page.get_by_test_id("journey-card")).to_have_attribute("data-done", "1")
        await expect(page.get_by_test_id("money-bank-activity")).to_have_count(0)
        await expect(page.get_by_test_id("credit-sort-amount")).to_have_count(0)
        await expect(page.get_by_test_id("money-overdue-summary")).to_be_visible()
        for kind in ["invoices", "payments", "transactions", "credit"]:
            await page.get_by_test_id(f"money-{kind}-card").click()
            await page.wait_for_url(f"**/#/money/{kind}", wait_until="commit")
            await page.go_back()
            await page.get_by_test_id("money-overview").wait_for()
        await page.get_by_test_id("money-overview-connections").click()
        await page.get_by_test_id("seat-connections").wait_for()
        for title in ["Banking", "Payments", "Communications"]:
            await expect(page.get_by_role("heading", name=title, exact=True)).to_be_visible()
        for testid in [
            "payment-connection",
            "wallet-connection",
            "invoicing-connection",
            "whatsapp-connection-setup",
            "connect-email",
            "phone-rail",
        ]:
            await expect(page.get_by_test_id(testid)).to_be_visible()
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / f"{width}-connections.png"), full_page=True)
        await page.evaluate("location.hash='#/admin/connections'")
        await page.get_by_test_id("seat-connections").wait_for()
        if width == 1600:
            await page.get_by_test_id("connect-email").click()
            # THE CONNECTIONS DOOR OFFERS THE MAILBOXES A PERSON CAN AUTHORIZE, and that is all it
            # can offer: `onSampleComplete` reaches `EmailConnection` only from
            # `cedar-onboarding.tsx`, so `email-view-sample` has never rendered on this door and
            # this step waited thirty seconds for a button that cannot exist. The sample-mailbox
            # walk lives where the callback does, in `drives/drive-cedar-email.py`.
            await page.get_by_test_id("email-connection").wait_for()
            await expect(page.locator('[data-email-step="choose"]')).to_be_visible()
            await page.wait_for_timeout(450)
            await page.screenshot(path=str(OUT / "email-door.png"))
            await page.keyboard.press("Escape")
            await page.evaluate("location.hash='#/sales'")
            await page.get_by_test_id("export-centre").click()
            await page.get_by_test_id("export-modal").wait_for()
            # ⚠ 2026-09-11 · THE CENTRE OPENS ON PREP (FEED-IA §246); the library — «Your templates»
            # — stands behind the square Email schedules control on that card, and its categories
            # stand behind disclosures. Copied from drive-189-output-objects.py's reach_library.
            if not await page.locator("[data-testid=export-library]").count():
                await page.locator("[data-testid=export-batch-hub]").wait_for(timeout=10000)
                await page.locator("[data-testid=prep-email-schedules]").click()
            await page.locator("[data-testid=export-library]").wait_for(timeout=10000)
            await page.wait_for_timeout(450)
            await page.screenshot(path=str(OUT / "export.png"))
            categories = page.locator('[data-testid^="export-library-section-"]')
            assert await categories.count() > 0, "Export categories available"
            if await categories.count():
                first = categories.first.locator("button").first
                await expect(first).to_have_attribute("aria-expanded", "false")
                panel = page.locator('[id="' + await first.get_attribute("aria-controls") + '"]')
                assert (
                    await panel.evaluate("node=>getComputedStyle(node).transitionDuration")
                    == "0.4s, 0.4s"
                ), "400ms disclosure"
                await page.emulate_media(reduced_motion="reduce")
                assert (
                    await panel.evaluate("node=>getComputedStyle(node).transitionDuration") == "0s"
                ), "Reduced motion disclosure"
                await page.emulate_media(reduced_motion="no-preference")
                await first.click()
                await expect(first).to_have_attribute("aria-expanded", "true")
                await page.wait_for_timeout(450)
                await page.screenshot(path=str(OUT / "export-expanded.png"))
            await page.get_by_test_id("export-close").click()
        assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), (
            "horizontal overflow"
        )
        assert not errors, errors
        results.append({"width": width, "block": "workspace", "status": "GREEN", "errors": errors})
    except Exception as e:
        results.append(
            {
                "width": width,
                "block": "workspace",
                "status": "RED",
                "error": str(e)[:1200],
                "url": page.url,
                "errors": errors,
            }
        )
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / f"{width}-failure.png"), full_page=True)
        (OUT / f"{width}-failure.txt").write_text(await page.locator("body").inner_text())
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def reset_context(browser, width: int, world: dict[str, Any]):
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 1000 if width > 500 else 844},
                                        timezone_id="America/Lima")
    await context.add_init_script(seed_script())
    await context.route("**/*", make_guard(world, origin))
    page = await context.new_page()
    page.set_default_timeout(25000)
    return context, page


async def run_reset_section(browser, width: int, results: list) -> None:
    """Reset Cedar stands in Settings with its two rows, at every width.

    This check used to sit inside `run_workspace`, behind that block's money walk. It stands on its
    own now so the Reset surface gates on itself: a change to the business-setup milestone or the
    export library holds its own block red without hiding whether these two rows still render.
    """
    world = provider_world()
    context, page = await reset_context(browser, width, world)
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        await page.goto(URL + "#/admin/app-settings", wait_until="domcontentloaded")
        await page.get_by_test_id("seat-app-settings").wait_for(state="visible", timeout=45000)
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await expect(page.get_by_role("heading", name="Reset Cedar", exact=True)).to_be_visible()
        for testid in ["reset-workspace-data", "reset-and-disconnect"]:
            await expect(page.locator(f'[data-row="{testid}"]')).to_be_visible()
        await shot(page, OUT / f"{width}-reset-section.png")
        check(await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
              f"{width}px: Reset Cedar stands in Settings with its two rows and no horizontal overflow")
        assert not errors, errors
        results.append({"width": width, "block": "reset-section", "status": "GREEN", "errors": errors})
    except Exception as e:
        results.append({"width": width, "block": "reset-section", "status": "RED", "error": str(e)[:1200],
                        "url": page.url, "errors": errors})
        await page.screenshot(path=str(OUT / f"{width}-reset-section-failure.png"), full_page=True)
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def run_reset_data(browser, width: int, results: list) -> None:
    """«Reset workspace data»: the seeded defaults return, the connections stand as they stand."""
    world = provider_world()
    context, page = await reset_context(browser, width, world)
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        await page.goto(URL + "#/admin/app-settings", wait_until="domcontentloaded")
        await page.get_by_test_id("seat-app-settings").wait_for(state="visible", timeout=45000)
        # The display language is written after boot, so the drive stays on the English entry and
        # still proves the sweep reaches the preference that chooses one.
        await page.evaluate("localStorage.setItem('rocoto-display-language','es');"
                            "localStorage.setItem('rocoto-spanish-entry','/cedar/es/');")
        await expect(country_pill(page, "spain")).to_have_attribute("data-selected", "yes")
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await shot(page, OUT / f"{width}-reset-rows.png")
        await open_reset(page, "reset-workspace-data", width, "Reset workspace data")
        await shot(page, OUT / f"{width}-reset-data-question.png")
        await page.get_by_test_id("reset-confirm").click()
        await page.wait_for_url("**/#/sales", timeout=45000, wait_until="commit")

        for key, planted in SEEDED.items():
            check(await stored(page, key) != planted, f"{width}px: the reset returned {key} to its default")
        check(await stored(page, "rocoto-display-language") != "es",
              "the display language returns to its default with the data")
        for key, value in KEPT_BY_DATA_RESET.items():
            check(await stored(page, key) == value, f"{width}px: {key} stands while the connections stand")
        check(await page.evaluate("Boolean(localStorage.getItem('rocoto-cedar-channel-access-v1:'+location.origin))"),
              f"{width}px: the workspace keeps the channel access its providers answer on")
        check(world["calls"] == {"whatsapp": [], "lines": [], "accounts": []},
              f"{width}px: a data reset makes zero provider calls")

        await page.evaluate("location.hash='#/admin/connections'")
        await page.get_by_test_id("seat-connections").wait_for()
        await expect(page.get_by_test_id("whatsapp-connection-setup")).to_contain_text("Connected")
        await expect(page.get_by_test_id("phone-rail")).to_contain_text("Connected")
        await expect(page.get_by_test_id("connect-email")).to_contain_text("Connected")
        check(True, f"{width}px: WhatsApp, phone and email are still connected after a data reset")
        await shot(page, OUT / f"{width}-reset-data-connections.png")

        await page.evaluate("location.hash='#/admin/app-settings'")
        await page.get_by_test_id("seat-app-settings").wait_for()
        await expect(country_pill(page, "peru")).to_have_attribute("data-selected", "yes")
        check(True, f"{width}px: the country returns to its default")
        assert not errors, errors
        results.append({"width": width, "block": "reset-data", "status": "GREEN", "errors": errors})
    except Exception as e:
        results.append({"width": width, "block": "reset-data", "status": "RED", "error": str(e)[:1200],
                        "url": page.url, "errors": errors})
        await page.screenshot(path=str(OUT / f"{width}-reset-data-failure.png"), full_page=True)
        (OUT / f"{width}-reset-data-failure.txt").write_text(await page.locator("body").inner_text())
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def run_reset_disconnect(browser, width: int, results: list, fail_phone: bool = False,
                               exit_by: str = "open") -> None:
    """«Reset and disconnect everything»: one provider call per account, each stating its result.

    `exit_by="back"` leaves the swept card by the browser's own Back button instead of «Open the
    workspace», and proves a person lands on a freshly loaded Cedar rather than on a live app whose
    stores went out from under it.
    """
    world = provider_world(fail_phone=fail_phone)
    tag = "reset-disconnect-failing-phone" if fail_phone else "reset-disconnect"
    if exit_by == "back":
        tag = f"{tag}-back"
    context, page = await reset_context(browser, width, world)
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        await page.get_by_test_id("seat-connections").wait_for(state="visible", timeout=45000)
        await expect(page.get_by_test_id("whatsapp-connection-setup")).to_contain_text("Connected")
        await expect(page.get_by_test_id("phone-rail")).to_contain_text("Connected")
        await expect(page.get_by_test_id("connect-email")).to_contain_text("Connected")
        check(True, f"{width}px: {tag} starts from three connected accounts")

        await page.evaluate("location.hash='#/admin/app-settings'")
        await page.get_by_test_id("seat-app-settings").wait_for()
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await open_reset(page, "reset-and-disconnect", width, "Reset and disconnect everything")
        await shot(page, OUT / f"{width}-{tag}-question.png")
        await page.get_by_test_id("reset-confirm").click()
        await page.get_by_test_id("reset-results").wait_for(state="visible")
        await expect(page.get_by_test_id("reset-result-email")).to_have_attribute("data-outcome", "disconnected")
        await shot(page, OUT / f"{width}-{tag}-results.png")

        check(world["calls"]["whatsapp"] == ["POST"],
              f"{width}px: {tag} asked Meta to disconnect the session once")
        check(sorted(world["calls"]["accounts"]) == sorted(ACCOUNTS),
              f"{width}px: {tag} released one mailbox per connected account")
        for key, planted in SEEDED.items():
            check(await stored(page, key) != planted, f"{width}px: {tag} returned {key} to its default")
        for key in ["rocoto-cedar-whatsapp-selected-v1", "rocoto-cedar-email-intake-cursor-v1"]:
            check(await stored(page, key) is None, f"{width}px: {tag} cleared the local {key}")
        check(await stored(page, "rocoto-rail-open") == "no",
              f"{width}px: {tag} keeps the person's own rail preference")
        check(await page.evaluate("Boolean(localStorage.getItem('rocoto-cedar-channel-access-v1:'+location.origin))"),
              f"{width}px: {tag} keeps the channel access the disconnects travelled on")

        if fail_phone:
            await expect(page.get_by_test_id("reset-result-phone")).to_have_attribute("data-outcome", "connected")
            await expect(page.get_by_test_id("reset-result-phone")).to_contain_text("Still connected")
            await expect(page.get_by_test_id("reset-retry-phone")).to_be_visible()
            check(world["calls"]["lines"] == [],
                  f"{width}px: a refused phone disconnect leaves its lines standing and says so")
            await expect(page.get_by_test_id("reset-result-whatsapp")).to_have_attribute("data-outcome", "disconnected")
            check(True, f"{width}px: the other two providers keep their results beside the refusal")
            # ── A MIRROR GOES ONLY WHEN ITS OWN PROVIDER SAID SO ──────────────────────────────
            # The sweep used to clear every connection key whatever the walk returned, so this
            # line kept its Twilio registration at the provider while the browser mirror it is
            # read through was dropped. The phone answered «Still connected», so its mirror
            # stands until the retry answers.
            check(await stored(page, "rocoto-cedar-phone-browser-v1") == "enabled",
                  f"{width}px: the line that is still connected keeps its local mirror")
            # THE RETRY IS THE ONE ACTION HERE A HAND REACHES FOR ON A HANDSET.
            box = await page.get_by_test_id("reset-retry-phone").bounding_box()
            check(box is not None and box["height"] >= 44,
                  f"{width}px: «Try again» keeps a 44 px target ({round(box['height'])} px)")
            world["fail_phone"] = False
            await page.get_by_test_id("reset-retry-phone").click()
            await expect(page.get_by_test_id("reset-result-phone")).to_have_attribute("data-outcome", "disconnected", timeout=25000)
            check(sorted(world["calls"]["lines"]) == sorted(LINES),
                  f"{width}px: the retry released every line through the provider")
            await expect(page.locator("[data-testid='reset-result-phone'] [data-testid='reset-retry-phone']")).to_have_count(0)
            check(await stored(page, "rocoto-cedar-phone-browser-v1") is None,
                  f"{width}px: the retry released the line's local mirror with it")
            await shot(page, OUT / f"{width}-{tag}-retry.png")
        else:
            await expect(page.get_by_test_id("reset-result-phone")).to_have_attribute("data-outcome", "disconnected")
            check(sorted(world["calls"]["lines"]) == sorted(LINES),
                  f"{width}px: {tag} released one line per commissioned line")
            check(await stored(page, "rocoto-cedar-phone-browser-v1") is None,
                  f"{width}px: {tag} cleared the local rocoto-cedar-phone-browser-v1")

        # ── THE SWEEP HAS LANDED, SO THE CARD HAS ONE EXIT ───────────────────────────────────
        # Escape or a scrim click used to return a person to a live Settings page whose stores had
        # gone out from under it, and the modules still holding their pre-reset book in memory
        # wrote it straight back. «Open the workspace» is the reload, and the reload is the act.
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)
        await expect(page.get_by_test_id("reset-card")).to_be_visible()
        await page.mouse.click(3, 3)
        await page.wait_for_timeout(300)
        await expect(page.get_by_test_id("reset-card")).to_be_visible()
        check(await page.get_by_test_id("reset-open-workspace").count() == 1,
              f"{width}px: {tag} holds the card open past Escape and the scrim, on «Open the workspace»")

        if exit_by == "back":
            # ── THE ROUTE WAS THE ONE DOOR LEFT OPEN ─────────────────────────────────────────
            # Escape and the scrim are held, and browser Back reached past both: Cedar is a hash
            # router, so the route change unmounted the card and left a live Settings page
            # standing over swept stores — and the modules holding their pre-reset book in memory
            # wrote it straight back. The results card's own unmount now performs the reload the
            # act requires, so Back lands on a freshly loaded Cedar. The probe is the witness:
            # a value on `window` survives a hash change and goes with a real document load.
            await page.evaluate("window.__cedarResetProbe = 1")
            await page.go_back()
            await page.wait_for_url("**/#/sales", timeout=45000, wait_until="commit")
            await page.wait_for_load_state("domcontentloaded")
            check(await page.evaluate("window.__cedarResetProbe === undefined"),
                  f"{width}px: {tag} Back on the swept card loaded a fresh document")
            check(page.url.endswith("#/sales"),
                  f"{width}px: {tag} Back on the swept card lands on the prepared workspace")
            check(await page.get_by_test_id("reset-card").count() == 0,
                  f"{width}px: {tag} leaves no reset card standing over the reloaded workspace")
            await shot(page, OUT / f"{width}-{tag}-after-back.png")
        else:
            await page.get_by_test_id("reset-open-workspace").click()
            await page.wait_for_url("**/#/sales", timeout=45000, wait_until="commit")
        await page.evaluate("location.hash='#/admin/connections'")
        await page.get_by_test_id("seat-connections").wait_for()
        await expect(page.get_by_test_id("whatsapp-connection-setup")).to_contain_text("Connect WhatsApp")
        await expect(page.get_by_test_id("phone-rail")).to_contain_text("Connect phone")
        await expect(page.get_by_test_id("connect-email")).to_contain_text("Connect email")
        check(True, f"{width}px: {tag} leaves Connections at Connect WhatsApp · Connect phone · Connect email")
        await shot(page, OUT / f"{width}-{tag}-connections.png")
        assert not errors, errors
        results.append({"width": width, "block": tag, "status": "GREEN", "errors": errors})
    except Exception as e:
        results.append({"width": width, "block": tag, "status": "RED", "error": str(e)[:1200],
                        "url": page.url, "errors": errors})
        await page.screenshot(path=str(OUT / f"{width}-{tag}-failure.png"), full_page=True)
        (OUT / f"{width}-{tag}-failure.txt").write_text(await page.locator("body").inner_text())
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def run_reset_stopped(browser, width: int, results: list, exit_by: str) -> None:
    """THE WALK IS STOPPED IN FLIGHT, and the sweep never runs.

    Two ways out of a walk that is still asking the providers: the card's own «Stop», and the
    browser's Back button. Both carry the same `AbortController` into `disconnectProviders`, so the
    walk asks no further account and the store sweep stands down — a person who leaves mid-walk
    keeps every record exactly as it was. The account that already answered `disconnected` is a
    settled fact, so its local mirror goes with it; the line the walk never released keeps its own.

    The fixture holds `/phone/setup` open for 2.5 s, which is the evidence read every line release
    waits on, so the walk can be caught while it is asking the phone.
    """
    world = provider_world(phone_delay_ms=2500)
    tag = f"reset-stopped-{exit_by}"
    context, page = await reset_context(browser, width, world)
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        await page.get_by_test_id("seat-connections").wait_for(state="visible", timeout=45000)
        await page.evaluate("location.hash='#/admin/app-settings'")
        await page.get_by_test_id("seat-app-settings").wait_for()
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await open_reset(page, "reset-and-disconnect", width, "Reset and disconnect everything")
        # A VALUE ON `window` SURVIVES A HASH CHANGE AND GOES WITH A REAL DOCUMENT LOAD, so it is
        # the witness for «nothing reloaded» as much as for «a fresh document was loaded».
        await page.evaluate("window.__cedarResetProbe = 1")
        await page.get_by_test_id("reset-confirm").click()
        # THE HELD CARD NAMES THE ACCOUNT IT IS ASKING. WhatsApp answers at once, so the line
        # reaches the phone, whose evidence read this fixture holds open.
        await expect(page.get_by_test_id("reset-asking")).to_have_text("Asking the phone service…", timeout=25000)
        check(True, f"{width}px: the held card names the account it is asking")
        check(await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
              f"{width}px: the held card fits the width")
        await shot(page, OUT / f"{width}-reset-busy.png")

        if exit_by == "stop":
            box = await page.get_by_test_id("reset-stop").bounding_box()
            check(box is not None and box["height"] >= 44,
                  f"{width}px: «Stop» keeps a 44 px target ({round(box['height'])} px)")
            await page.get_by_test_id("reset-stop").click()
            # ONCE STOP IS PRESSED THE LINE NAMES THE STOP, not the account the person just stopped
            # asking: the phone's read is still held open by the fixture, so the line is readable.
            await expect(page.get_by_test_id("reset-asking")).to_have_text("Stopping. Finishing the last check.", timeout=5000)
            check(True, f"{width}px: after Stop the line names the stop rather than the account")
            await page.get_by_test_id("reset-results").wait_for(state="visible", timeout=25000)
            check(await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
                  f"{width}px: the stopped card fits the width")
            await expect(page.get_by_test_id("reset-stopped")).to_have_text("Stopped. Your data stays as it is.")
            await expect(page.get_by_test_id("reset-result-whatsapp")).to_have_attribute("data-outcome", "disconnected")
            await expect(page.get_by_test_id("reset-result-phone")).to_have_attribute("data-outcome", "connected")
            await expect(page.get_by_test_id("reset-retry-phone")).to_be_visible()
            await expect(page.get_by_test_id("reset-result-email")).to_have_attribute("data-outcome", "connected")
            await expect(page.get_by_test_id("reset-retry-email")).to_be_visible()
            check(True, f"{width}px: the stopped card states every account, with a retry on the two it left standing")
            await shot(page, OUT / f"{width}-reset-stopped.png")
        else:
            await page.go_back()
            await page.get_by_test_id("seat-connections").wait_for(timeout=45000)
            check(await page.get_by_test_id("reset-card").count() == 0,
                  f"{width}px: Back during the walk takes the card with the route")
            # The settled fact lands when the phone's held evidence read finally returns.
            await page.wait_for_function(
                "() => localStorage.getItem('rocoto-cedar-whatsapp-selected-v1') === null", timeout=25000)

        check(await page.evaluate("window.__cedarResetProbe === 1"),
              f"{width}px: {tag} reloads nothing, because nothing was swept")
        # THE SWEEP REMOVES KEYS, so a key still standing is the proof it never ran; the three the
        # running app leaves alone are held to their planted value as well. (`rocoto-app-print-journal`
        # and the phone/capability rows are normalised on read by the stores that own them.)
        for key in SEEDED:
            check(await stored(page, key) is not None, f"{width}px: {tag} left {key} standing")
        for key in ["rocoto-app-day", "rocoto-cedar-money-v1:fish", "rocoto-cedar-onboarding-v1:fish"]:
            check(await stored(page, key) == SEEDED[key], f"{width}px: {tag} left {key} exactly as it was")
        check(world["calls"]["lines"] == [] and world["calls"]["accounts"] == [],
              f"{width}px: {tag} released no line and no mailbox")
        check(world["calls"]["whatsapp"] == ["POST"],
              f"{width}px: the account that answered before the stop answered once")
        check(await stored(page, "rocoto-cedar-whatsapp-selected-v1") is None,
              f"{width}px: {tag} hands over the mirror of the account that already answered")
        check(await stored(page, "rocoto-cedar-phone-browser-v1") == "enabled",
              f"{width}px: {tag} keeps the mirror of the line it never released")
        check(await stored(page, "rocoto-cedar-email-intake-cursor-v1") == "cursor-9",
              f"{width}px: {tag} keeps the cursor the mailbox intake reads from")

        if exit_by == "stop":
            # NOTHING WAS SWEPT, SO THE CARD IS A CARD AGAIN and «Close» is a real exit.
            await page.get_by_test_id("reset-close").click()
            await expect(page.get_by_test_id("reset-card")).to_have_count(0)
            await page.get_by_test_id("seat-app-settings").wait_for()
            check(await page.evaluate("window.__cedarResetProbe === 1"),
                  f"{width}px: «Close» returns to Settings on the same document")
            await shot(page, OUT / f"{width}-reset-stopped-closed.png")
        assert not errors, errors
        results.append({"width": width, "block": tag, "status": "GREEN", "errors": errors})
    except Exception as e:
        results.append({"width": width, "block": tag, "status": "RED", "error": str(e)[:1200],
                        "url": page.url, "errors": errors})
        await page.screenshot(path=str(OUT / f"{width}-{tag}-failure.png"), full_page=True)
        (OUT / f"{width}-{tag}-failure.txt").write_text(await page.locator("body").inner_text())
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def main():
    global URL
    server = None
    if not URL:
        if not (DIST / "cedar" / "index.html").is_file():
            raise SystemExit(f"{DIST}/cedar/index.html is not there. Run `npm run build:app-en` first.")
        handler = functools.partial(
            type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}),
            directory=str(DIST),
        )
        server = socketserver.TCPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        URL = f"http://127.0.0.1:{server.server_address[1]}/cedar/"
    results: list[dict] = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            try:
                for width in [1600, 390, 320]:
                    await run_workspace(browser, width, results)
                    await run_reset_section(browser, width, results)
                for width in [1600, 390]:
                    await run_reset_data(browser, width, results)
                    await run_reset_disconnect(browser, width, results)
                    # THE REFUSAL IS LAID OUT AT BOTH WIDTHS. A result row that wraps beside an
                    # inline «Try again» is most likely to crowd on a handset, which is exactly
                    # where that button gets pressed.
                    await run_reset_disconnect(browser, width, results, fail_phone=True)
                    # BROWSER BACK IS A DOOR OUT OF THE CARD TOO, and the two windows answer it
                    # differently: once the sweep has landed the only honest answer is the reload,
                    # and while the walk is still asking the only honest answer is to stop it.
                    await run_reset_disconnect(browser, width, results, exit_by="back")
                    await run_reset_stopped(browser, width, results, "stop")
                    await run_reset_stopped(browser, width, results, "back")
                # THE BUSY AND STOPPED CARDS ARE THE ONES THAT ADD WIDTH PRESSURE inside the card
                # (a loading primary beside «Stop»; three result rows each with an inline retry),
                # so the narrowest width is proven on the Stop leg as well.
                await run_reset_stopped(browser, 320, results, "stop")
            finally:
                await browser.close()
    finally:
        if server is not None:
            server.shutdown()
    (OUT / "results.json").write_text(json.dumps({"results": results, "checks": CHECKS}, indent=2))
    print(f"{len(CHECKS)} GREEN", flush=True)
    if any(r["status"] == "RED" for r in results):
        raise SystemExit(1)


asyncio.run(main())
