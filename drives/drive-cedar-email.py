#!/usr/bin/env python3
"""Isolated Cedar email UX proof. Owner API fixtures; external providers stay blocked.

    ROCOTO_DIST=app/dist-email .venv/bin/python drives/drive-cedar-email.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served `app.html`. `ROCOTO_SHOTS` selects the screenshot folder. Every provider and owner API
request is answered by this file, so the run reaches no network.

THE CONNECTION IS STATE LED (FEED-IA §247.2). Four blocks prove it: `run` walks a mailbox end to
end, `run_steps` asserts each setup step asks exactly one question with one primary action,
`run_entrances` holds EVERY email entry — the Connections card, the connected inbox, onboarding,
the customer sheet and the composer's mailbox line — at one image and one `Connect email` while
nothing is connected, and `run_state_led` flips the fixture under a live page: partial, forwarding
only, connected without a reload, a stale read, and a revoked mailbox. `ROCOTO_ONLY=state-led`
narrows a run to named blocks while a repair is measured.
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
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-email"))
ONLY = [name for name in os.getenv("ROCOTO_ONLY", "").split(",") if name]
# `ROCOTO_WIDTHS=320` reads one narrow pass; the standing pair is 1600 and 390.
WIDTHS = tuple(int(value) for value in os.getenv("ROCOTO_WIDTHS", "1600,390").split(",") if value.strip())
CHECKS: list[str] = []
TOKEN = "b" * 64
WORKSPACE = "a" * 32
CUSTOMER = "hotelrec"
# An account of the same book whose orders arrive on WhatsApp, so its record holds no mail
# source at all. Planting `channel: email` on it is the state «their orders arrive by mail and
# the mailbox has handed the house nothing yet».
BLANK = "arrosseria-cadaques"

# ONE QUESTION PER STEP (§246 · §247.2). The prompt each step of `email-connection.tsx` shows.
PROMPTS = {
    "choose": "Which mailbox do you use?",
    "authorize-google": "Sign in to Gmail",
    "authorize-outlook": "Sign in to Microsoft 365",
    "forwarding": "Forward order email to this address",
}
# THE MAILBOX CONTROLS A CONNECTION HAS TO JUSTIFY. Every one of them is absent while the
# workspace holds no live mailbox; the RECORD is never what this list is about.
MAILBOX_CONTROLS = ["email-refresh", "email-history-more", "email-open-invoice-history",
                    "email-message", "email-connected-account", "connected-email-message",
                    "customer-email-send"]


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    CHECKS.append(label)
    print("GREEN " + label, flush=True)


async def shot(page, path: Path) -> None:
    await page.wait_for_timeout(450)
    await page.screenshot(path=str(path))


def fixture_message(**patch: Any) -> dict:
    """One authorized message, in the runtime's own shape."""
    return {"source_ref": "src_state", "account_ref": "mail_fixture", "provider": "google",
            "mode": "connected", "subject": "Synthetic order", "from": ["customer@example.invalid"],
            "to": ["seller@example.invalid"], "at": "2026-09-10T09:15:00Z",
            "body": "Synthetic order source text.", "attachments": [],
            "provenance": {"source_ref": "src_state", "source_revision": 1, "method": "unipile-v2",
                           "observed_at": "2026-09-10T09:15:00Z", "content_state": "provider_backed"},
            **patch}


def mailbox_account(**patch: Any) -> dict:
    """The provider's own `GET /email/status` row for one authorized mailbox."""
    return {"account_ref": "mail_fixture", "provider": "google", "mode": "connected",
            "status": "connected", "label": "seller@example.invalid", "revision": 1,
            "history_complete": True, "synced_at": "2026-09-11T09:00:00Z",
            "invoice_consent_at": None, "forwarding_address": None, **patch}


def boot_script(extra: str = "") -> str:
    """A workspace that already holds its channel access, so a read never allocates one."""
    return ("""if (!sessionStorage.getItem('email-state-drive')) {
      localStorage.clear();
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);
      localStorage.setItem('rocoto-cedar-channel-access-v1:'+location.origin,JSON.stringify(
        {workspace_id:'""" + WORKSPACE + """',access_token:'""" + TOKEN + """',
         expires_at: Math.floor(Date.now()/1000)+3600}));
      """ + extra + """
      sessionStorage.setItem('email-state-drive','ready');}
    """)


async def state_context(browser, width: int, world: dict, extra: str = ""):
    """A context whose ONLY provider answer is `world`, so a posture can be flipped mid-page."""
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script(boot_script(extra))

    async def guard(route):
        parsed = urlsplit(route.request.url)
        path = parsed.path
        value: Any = None
        if path == "/api/cedar/access/workspaces":
            value = {"workspace_id": WORKSPACE, "access_token": TOKEN, "expires_at": int(time.time()) + 3600}
        elif path == "/api/cedar/email/status":
            world["reads"] = world.get("reads", 0) + 1
            if world.get("fail"):
                await route.fulfill(status=int(world["fail"]), content_type="application/json",
                                    body='{"detail":"The mailbox service is taking longer than expected. Try again."}')
                return
            body = json.dumps({"provider": "unipile", "configured": world.get("configured", True),
                               "accounts": world["accounts"]})
            # ⚠ A READ THAT BEGAN BEFORE A WRITE. `world["hold"]` parks the next status read with the
            # answer it would have carried AT REQUEST TIME — the pre-write truth — and hands it over
            # only when the block releases the gate, after a sync has published the newer state.
            if world.get("hold"):
                world["hold"] = False
                world["held"] = True
                await world["gate"].wait()
                await route.fulfill(status=200, content_type="application/json", body=body)
                return
            await route.fulfill(status=200, content_type="application/json", body=body)
            return
        elif path.endswith("/customer-binding"):
            posted = route.request.post_data_json or {}
            world.setdefault("bindings", []).append(posted)
            value = {"customerId": posted.get("customer_id", "")}
        elif path.endswith("/sync"):
            world["syncs"] = world.get("syncs", 0) + 1
            if world.get("sync_accounts") is not None:
                world["accounts"] = world.pop("sync_accounts")
            value = {"messages": world.get("messages", []), "has_more": False, "coverage": "bound-customers"}
            if world.get("bound") is not None:
                value["bound"] = world["bound"]
        elif path.startswith("/api/cedar/email/") or path.startswith("/api/cedar/"):
            await route.fulfill(status=503, content_type="application/json",
                                body='{"detail":"Fixture provider setup pending."}')
            return
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
            return
        else:
            await route.fulfill(status=503, content_type="application/json",
                                body='{"detail":"External provider blocked by isolated proof."}')
            return
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(value))

    await context.route("**/*", guard)
    return context


async def says(locator, text: str) -> bool:
    try:
        return text in (await locator.inner_text())
    except Exception:
        return False


async def wake_until(page, probe, floor: bool = False, seconds: float = 60) -> bool:
    """Wake the shared snapshot until the surface itself states the new posture.

    `floor=True` uses the tab-return boundary alone, which the snapshot holds to its ten-second
    floor — that is the claim «a mailbox authorized elsewhere reaches this page without a reload».
    Everything else also dispatches `rocoto:channel-workspace-ready`, the app's own unfloored
    trigger, so arranging a posture costs a moment rather than a floor. The PAINTED surface is the
    witness, never a request count: `email-intake.tsx` reads `/email/status` on its own five-second
    poll, so a counter says nothing about the snapshot every entrance reads.
    """
    wake = ("window.dispatchEvent(new Event('focus'))" if floor else
            "window.dispatchEvent(new Event('focus'));"
            "window.dispatchEvent(new Event('rocoto:channel-workspace-ready'))")
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if await probe():
            return True
        await page.evaluate(wake)
        await page.wait_for_timeout(500)
    return await probe()


async def hidden(page, width: int, tag: str) -> None:
    """Every mailbox control the connection does not justify is absent from this surface."""
    for control in MAILBOX_CONTROLS:
        check(await page.get_by_test_id(control).count() == 0,
              f"{width}px: {tag} hides {control}")


async def setup_state(page, width: int, tag: str, posture: str) -> None:
    """One picture, one line, one `Connect email` — the same three things at every entrance."""
    state = page.get_by_test_id("email-setup-state")
    await state.wait_for(state="visible", timeout=20000)
    check(await state.get_attribute("data-email-posture") == posture,
          f"{width}px: {tag} reads the shared connection state as {posture}")
    artwork = state.locator("img")
    check(await artwork.evaluate("image => image.complete && image.naturalWidth > 0"),
          f"{width}px: {tag} draws the email illustration")
    check(await artwork.get_attribute("data-artwork") == "email",
          f"{width}px: {tag} draws the ONE installed email artwork")
    act = page.get_by_test_id("email-open-setup")
    check(await act.count() == 1 and (await act.inner_text()).strip() == "Connect email",
          f"{width}px: {tag} offers exactly one act, labelled Connect email")
    check(await act.evaluate("node => node.getBoundingClientRect().height >= 44"),
          f"{width}px: {tag} keeps the 44 px target")


async def run(browser, width: int) -> None:
    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""if (!sessionStorage.getItem('email-drive')) {
      localStorage.clear();localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base',location.origin);
      localStorage.setItem('rocoto-app-customer-edits',JSON.stringify({hotelrec:{email:'hotel@example.invalid'}}));
      sessionStorage.setItem('email-drive','ready');}
    """)
    account = {
        "account_ref": "mail_fixture",
        "provider": "google",
        "mode": "connected",
        "status": "connected",
        "label": "seller@example.invalid",
        "revision": 0,
        "history_complete": True,
        "synced_at": None,
        "invoice_consent_at": None,
        "forwarding_address": None,
    }
    connected = False
    searches: list[dict] = []
    message = {
        "source_ref": "src_fixture",
        "account_ref": "mail_fixture",
        "provider": "google",
        "mode": "connected",
        "subject": "Synthetic invoice",
        "from": ["customer@example.invalid"],
        "to": ["seller@example.invalid"],
        "at": "2025-08-22T14:45:00Z",
        "body": "Synthetic invoice source text.",
        "attachments": [
            {
                "attachment_ref": "att_fixture",
                "name": "Synthetic invoice.pdf",
                "content_type": "application/pdf",
                "available": True,
            }
        ],
        "provenance": {
            "source_ref": "src_fixture",
            "source_revision": 1,
            "method": "unipile-v2",
            "observed_at": "2025-08-22T14:45:00Z",
            "content_state": "provider_backed",
        },
    }
    consent = False
    # PR #95 · the UI pushes one customer binding per address BEFORE the first sync, because the
    # runtime reads only mail exchanged with a bound customer. The order is the assertion.
    bindings: list[dict] = []
    syncs: list[str] = []
    errors: list[str] = []
    documents: list[dict] = []
    document_parses: list[str] = []
    private_reset = False
    long_thread = False
    new_arrival = False
    hold_older = False
    release_older = asyncio.Event()
    thread_pages: list[str] = []

    def history_message(index):
        return {
            **message, "source_ref": f"src_history_{index}", "body": f"Synthetic history message {index:02d}",
            "at": f"2025-08-22T{15 if index == 60 else 14:02d}:{0 if index == 60 else index:02d}:00Z",
            "attachments": [{**message["attachments"][0], "attachment_ref": "att_oldest", "name": "Oldest invoice.pdf"}] if index == 0 else [],
            "provenance": {**message["provenance"], "source_ref": f"src_history_{index}"},
        }

    async def guard(route):
        nonlocal connected, consent
        parsed = urlsplit(route.request.url)
        path = parsed.path
        value = None
        if path == "/api/cedar/access/workspaces":
            value = {
                "workspace_id": ("c" if private_reset else "a") * 32,
                "access_token": "d" * 64 if private_reset else TOKEN,
                "expires_at": int(time.time()) + 3600,
            }
        elif path.startswith("/api/cedar/email/"):
            assert route.request.headers.get("authorization") in (f"Bearer {TOKEN}", f"Bearer {'d' * 64}")
            if route.request.method == "DELETE" and path.endswith("/accounts/mail_fixture"):
                connected = False
                value = {"disconnected": True}
            elif path.endswith("/status"):
                value = {
                    "provider": "unipile",
                    "configured": connected,
                    "accounts": [account] if connected and not private_reset else [],
                }
            elif path.endswith("/thread") and long_thread:
                cursor = parse_qs(parsed.query).get("cursor", [""])[0]
                thread_pages.append(cursor)
                if cursor:
                    assert cursor == "page_fixture"
                    if hold_older:
                        await release_older.wait()
                    rows = [history_message(index) for index in reversed(range(11))]
                else:
                    rows = [history_message(index) for index in range(60 if new_arrival else 59, 10 if new_arrival else 9, -1)]
                value = {"messages": rows, "has_more": not cursor, "next_cursor": None if cursor else "page_fixture"}
            elif path.endswith("/intake"):
                value = {"messages": [], "nextCursor": "", "hasMore": False}
            elif path.endswith("/customer-binding"):
                body = route.request.post_data_json
                assert isinstance(body.get("address"), str) and isinstance(body.get("customer_id"), str)
                bindings.append(body)
                value = {"customerId": body["customer_id"]}
            elif path.endswith("/sync") or path.endswith("/thread"):
                syncs.append(path)
                value = {"messages": [message], "has_more": False, "coverage": "bound-customers",
                         "bound": len(bindings)}
            elif path.endswith("/invoice-consent"):
                consent = route.request.post_data_json["consent"]
                value = {"consent_at": "2025-08-22T14:45:00Z" if consent else None}
            elif path.endswith("/invoice-search"):
                assert consent
                searches.append(route.request.post_data_json)
                value = {"messages": [message], "coverage": "provider-search-results"}
            elif path.endswith("/parse"):
                value = {
                    "result": {
                        "columns": ["product", "quantity"],
                        "rows": [{"product": "Synthetic product", "quantity": 2}],
                    },
                    "review_required": True,
                    "provenance": {
                        "source_ref": "src_fixture",
                        "attachment_ref": "att_fixture",
                        "method": "parsewise-albaran-lines",
                        "observed_at": "2025-08-22T14:45:00Z",
                    },
                }
            else:
                await route.fulfill(
                    status=503,
                    content_type="application/json",
                    body='{"detail":"Fixture provider setup pending."}',
                )
                return
        elif path.startswith("/api/cedar/documents"):
            assert route.request.headers.get("authorization") in (f"Bearer {TOKEN}", f"Bearer {'d' * 64}")
            if path == "/api/cedar/documents" and route.request.method == "POST":
                raw = route.request.post_data_buffer or b""
                assert b"private-30-days" in raw and b"%PDF-" in raw
                documents.append(
                    {
                        "source_ref": "doc_fixture",
                        "source_kind": "operator_upload",
                        "name": "Synthetic upload.pdf",
                        "content_type": "application/pdf",
                        "created_at": 1755873900,
                        "expires_at": 1758465900,
                        "status": "uploaded",
                        "result": None,
                        "provenance": {
                            "source_ref": "doc_fixture",
                            "source_revision": 1,
                            "method": "operator-upload",
                            "actor": "workspace-owner",
                            "policy": "cedar-operator-upload-30d-v1",
                            "consent_at": 1755873900,
                        },
                    }
                )
                value = documents[0]
            elif path.endswith("/parse"):
                document_parses.append(path)
                documents[0]["result"] = {
                    "columns": ["product", "quantity"],
                    "rows": [{"product": "Synthetic upload line", "quantity": 3}],
                    "confidence": 0.9,
                }
                documents[0]["status"] = "review"
                documents[0]["provenance"]["method"] = "parsewise-albaran-lines"
                value = documents[0]
            else:
                value = {"documents": [] if private_reset else documents}
        elif f"{parsed.scheme}://{parsed.netloc}" == origin and not path.startswith("/api/"):
            await route.continue_()
            return
        else:
            await route.fulfill(
                status=503,
                content_type="application/json",
                body='{"detail":"External provider blocked by isolated proof."}',
            )
            return
        await route.fulfill(status=200, content_type="application/json", body=json.dumps(value))

    await context.route("**/*", guard)
    page = await context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(URL + "#/admin/connections/email")
        await expect(page.locator('[data-email-step="choose"]')).to_be_visible()
        check(
            await page.get_by_test_id("email-connected-account").count() == 0,
            f"{width}px: readiness never fabricates a connected mailbox",
        )
        gmail_logo = page.get_by_test_id("email-connection").locator('img[src="/connection-brands/gmail.png"]')
        await expect(gmail_logo).to_be_visible()
        check(
            await gmail_logo.evaluate("node=>node.naturalWidth>0"),
            f"{width}px: official Gmail mark loads",
        )
        await shot(page, OUT / f"{width}-email-choice.png")
        # THE PROVIDER-PENDING SENTENCE BELONGS TO THE STEP IT IS ABOUT (§247.2). It used to stand
        # on the choose screen, where a person choosing a mailbox had to decode it.
        await page.get_by_test_id("email-connect-google").click()
        await expect(page.get_by_test_id("email-provider-pending")).to_be_visible()
        await page.get_by_test_id("setup-back").click()
        await expect(page.locator('[data-email-step="choose"]')).to_be_visible()
        await page.evaluate("""() => {
          localStorage.setItem('rocoto-cedar-onboarding-v1:fish',JSON.stringify({version:1,scope:'fish',step:'channel-setup',
            workspacePrepared:false,businessName:'Synthetic company',address:'Synthetic address',ruc:'20123456789',
            selectedChannel:'email',channels:[],catalogue:'pending',invoiceHistory:[],invoiceSearch:'pending'}));
          location.hash='#/onboarding/channel-setup';
        }""")
        # §247.2 — the onboarding email channel shows the SAME one picture and one act.
        await setup_state(page, width, "the onboarding email channel", "setup")
        await shot(page, OUT / f"{width}-email-onboarding-setup.png")
        await page.get_by_test_id("email-open-setup").click()
        await page.get_by_test_id("email-view-sample").click()
        await expect(page.get_by_test_id("email-sample-mailbox")).to_be_visible()
        await page.locator('[data-testid^="email-inbox-thread-"]').first.click()
        check(
            await page.locator("[data-source-sale][data-source-customer]").count() > 0,
            f"{width}px: sample email carries canonical sales and customer identities",
        )
        await shot(page, OUT / f"{width}-email-sample.png")
        await page.get_by_test_id("setup-back").click()
        await expect(page.get_by_test_id("email-sample-mailbox")).to_be_visible()
        await page.get_by_test_id("setup-back").click()
        await page.get_by_test_id("email-forwarding").click()
        await expect(page.get_by_test_id("email-setup-prompt")).to_have_text(PROMPTS["forwarding"])
        await expect(page.get_by_test_id("email-forwarding-pending")).to_be_visible()
        check(
            await page.get_by_test_id("email-forwarding-address").count() == 0,
            f"{width}px: forwarding remains a separate commissioned address",
        )
        check(
            await page.get_by_test_id("email-forwarding-done").count() == 1,
            f"{width}px: the forwarding step carries one primary action",
        )
        connected = True
        await page.reload()
        # THE HOUSE NEVER READS THE AGGREGATOR'S NAME (THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06). The
        # account row names the mailbox the person chose and states that it is connected.
        row = page.get_by_test_id("email-connected-account")
        await row.wait_for(state="visible")
        said = await row.inner_text()
        check("Unipile" not in said and "unipile" not in said,
              f"{width}px: the account row names the mailbox rather than the transport · {said!r}")
        check("Connected" in said and "seller@example.invalid" in said,
              f"{width}px: and it reads Connected beside the mailbox the person chose · {said!r}")
        await page.get_by_test_id("email-connected-account").click()
        await page.get_by_test_id("email-message").click()
        check(
            bool(bindings) and bool(syncs),
            f"{width}px: the mailbox pushes its customer bindings and then reads history",
        )
        check(
            all("@" in row["address"] for row in bindings),
            f"{width}px: every binding carries a customer address and its customer id",
        )
        await expect(page.get_by_test_id("email-live-thread")).to_contain_text(
            "Synthetic invoice source text."
        )
        await page.get_by_test_id("email-parse-pdf").click()
        await expect(page.get_by_test_id("email-pdf-review")).to_contain_text("Synthetic product")
        await shot(page, OUT / f"{width}-email-thread.png")
        await page.get_by_test_id("email-open-invoice-history").click()
        await expect(page.get_by_test_id("email-invoice-search")).to_be_disabled()
        check(not searches, f"{width}px: invoice search waits for explicit permission")
        await page.get_by_text("Allow Rocoto to search earlier invoice email", exact=True).click()
        await page.get_by_test_id("email-invoice-search").click()
        await expect(page.get_by_test_id("email-invoice-results")).to_contain_text("1 email to review")
        check(searches == [{"query": "factura"}], f"{width}px: selected search reaches authorized API once")
        await shot(page, OUT / f"{width}-email-invoice-results.png")
        stored = await page.evaluate("JSON.stringify({...localStorage})")
        check(
            "Synthetic invoice source text" not in stored and "Synthetic invoice.pdf" not in stored,
            f"{width}px: source bodies and filenames remain transient",
        )
        check(
            await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
            f"{width}px: viewport contains email setup",
        )
        # The real account branch must keep its results mounted until the user continues.
        await page.goto(URL + "#/admin/connections")
        await page.evaluate("""() => {
          localStorage.setItem('rocoto-cedar-onboarding-v1:fish',JSON.stringify({version:1,scope:'fish',step:'gmail-permission',
            workspacePrepared:true,businessName:'Synthetic company',address:'Synthetic address',ruc:'20123456789',
            selectedChannel:'email',channels:[{channel:'email',status:'connected'}],catalogue:'sample',invoiceHistory:[],invoiceSearch:'pending'}));
          location.hash='#/onboarding/gmail-permission';
        }""")
        await expect(page.get_by_test_id("onboarding-step")).to_have_attribute("data-step", "history")
        check(True, f"{width}px: legacy Gmail step resumes at optional invoice history")
        await expect(page.get_by_test_id("onboarding-upload-invoices")).to_be_visible()
        check(True, f"{width}px: prepared workspace keeps invoice upload reachable")
        await shot(page, OUT / f"{width}-onboarding-history.png")
        await page.get_by_test_id("setup-back").click()
        await expect(page.get_by_test_id("onboarding-start-selling")).to_be_visible()
        await page.get_by_test_id("onboarding-start-selling").click()
        await page.wait_for_url("**#/sales")
        check(True, f"{width}px: optional history returns through Start selling into Sales")

        long_thread = True
        await page.goto(URL + "#/admin/connections/email")
        await page.get_by_test_id("email-connected-account").click()
        await page.get_by_test_id("email-message").click()
        turns = page.locator('[data-testid^="exchange-turn-src_history_"]')
        await expect(turns).to_have_count(50)
        await page.get_by_test_id("email-thread-more").click()
        await expect(turns).to_have_count(60)
        check(await turns.first.get_attribute("data-testid") == "exchange-turn-src_history_0",
              f"{width}px: older page deduplicates the boundary and preserves chronological order")
        await page.get_by_test_id("email-parse-pdf").click()
        await expect(page.get_by_test_id("email-pdf-review")).to_contain_text("Synthetic product")
        check(True, f"{width}px: oldest thread attachment keeps its authorized PDF review action")
        new_arrival = True
        await page.evaluate("window.dispatchEvent(new Event('focus'))")
        await expect(turns).to_have_count(61)
        await expect(page.get_by_test_id("email-thread-more")).to_have_count(0)
        check(await turns.first.get_attribute("data-testid") == "exchange-turn-src_history_0"
              and await turns.last.get_attribute("data-testid") == "exchange-turn-src_history_60",
              f"{width}px: current refresh keeps opened history and adds the new message once")

        await page.goto(URL + "#/sales")
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox'))")
        # §247.2 · `ConnectedInbox` opens on the channel that is actually connected, and this
        # workspace holds a live mailbox and no WhatsApp account, so the Email inbox is what stands.
        await expect(page.get_by_test_id("connected-inbox")).to_have_attribute("data-channel", "email")
        await page.get_by_role("button", name=account["label"], exact=True).click()
        await page.get_by_test_id("connected-email-message").click()
        await expect(page.get_by_test_id("email-thread-more")).to_be_visible()
        await page.get_by_test_id("email-thread-more").click()
        await expect(turns).to_have_count(61)
        check(True, f"{width}px: connected inbox reuses the full paged thread reader")
        await shot(page, OUT / f"{width}-thread-history.png")
        await page.get_by_role("button", name="Back to email", exact=True).click()
        await page.get_by_test_id("connected-email-message").click()
        hold_older = True
        await page.get_by_test_id("email-thread-more").click()
        await expect(page.get_by_test_id("email-thread-more")).to_be_disabled()
        await page.evaluate("""window.dispatchEvent(new CustomEvent('rocoto:email-disconnect', {
          detail:{phase:'complete',accountRef:'mail_fixture'}
        }))""")
        await expect(page.get_by_test_id("email-thread-reader")).to_have_count(0)
        check(True, f"{width}px: disconnect completion clears an independently mounted source view")
        private_reset = True
        await page.evaluate("""() => {
          const key='rocoto-cedar-channel-access-v1:'+location.origin, oldValue=localStorage.getItem(key);
          localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:null}));
        }""")
        release_older.set()
        await expect(page.get_by_test_id("email-thread-reader")).to_have_count(0)
        await page.wait_for_timeout(100)
        await expect(turns).to_have_count(0)
        check(True, f"{width}px: workspace reset discards a late older-thread response")
        # Reopen the authorized fixture for the independent upload custody proof.
        private_reset = False
        await page.evaluate("""() => {
          for(const key of Object.keys(localStorage)) if(key.startsWith('rocoto-cedar-channel-access-v1:')) localStorage.removeItem(key);
        }""")
        await page.evaluate("""() => {
          localStorage.setItem('rocoto-cedar-onboarding-v1:fish',JSON.stringify({version:1,scope:'fish',step:'history',
            workspacePrepared:true,businessName:'Synthetic company',address:'Synthetic address',ruc:'20123456789',
            selectedChannel:'email',channels:[{channel:'email',status:'sample'}],catalogue:'sample',invoiceHistory:[],invoiceSearch:'pending'}));
          location.hash='#/onboarding/history';
        }""")
        await page.get_by_test_id("onboarding-upload-invoices").click()
        await expect(page.get_by_test_id("invoice-upload-choose")).to_be_disabled()
        check(not documents, f"{width}px: file custody waits for explicit permission")
        await page.get_by_text("Keep these files privately for 30 days", exact=True).click()
        await page.get_by_test_id("invoice-upload-file").set_input_files(
            {
                "name": "Synthetic upload.pdf",
                "mimeType": "application/pdf",
                "buffer": b"%PDF-1.4 SYNTHETIC upload",
            }
        )
        await expect(page.get_by_test_id("invoice-upload-review")).to_contain_text("Synthetic upload line")
        await expect(page.get_by_test_id("invoice-upload-review-done")).to_be_enabled()
        await shot(page, OUT / f"{width}-invoice-upload-review.png")
        await page.reload()
        await page.get_by_test_id("onboarding-upload-invoices").click()
        await expect(page.get_by_test_id("invoice-upload-card")).to_contain_text("Synthetic upload.pdf")
        await page.get_by_test_id("invoice-upload-open").click()
        await expect(page.get_by_test_id("invoice-upload-review")).to_contain_text("Synthetic upload line")
        check(
            len(document_parses) == 1,
            f"{width}px: upload review survives reload and reuses its parsed source",
        )
        stored = await page.evaluate("JSON.stringify({...localStorage})")
        check(
            "%PDF-" not in stored and "Synthetic upload line" not in stored,
            f"{width}px: private upload and parsed source stay on server",
        )
        private_reset = True
        await page.evaluate("""() => {
          const key='rocoto-cedar-channel-access-v1:'+location.origin, oldValue=localStorage.getItem(key);
          localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:null}));
        }""")
        await expect(page.get_by_test_id("invoice-upload-review")).to_have_count(0)
        await expect(page.get_by_test_id("invoice-upload-card")).to_have_count(0)
        await expect(page.get_by_text("Synthetic upload line", exact=True)).to_have_count(0)
        check(True, f"{width}px: resetting workspace removes open upload content and saved-source rows")
        private_reset = False
        connected = True
        await page.evaluate("""() => {
          for(const key of Object.keys(localStorage)) if(key.startsWith('rocoto-cedar-channel-access-v1:')) localStorage.removeItem(key);
        }""")
        await page.goto(URL + "#/admin/connections/email")
        await page.get_by_test_id("email-connection").wait_for(state="visible")
        await page.wait_for_timeout(1500)
        opened = await page.locator("[data-email-step]").get_attribute("data-email-step")
        check(opened == "accounts",
              f"{width}px: a workspace holding a mailbox opens the walk on its accounts · {opened!r}")
        await page.get_by_test_id("email-disconnect").click()
        await expect(page.get_by_test_id("email-connected-account")).to_have_count(0)
        check(not connected, f"{width}px: Disconnect email reaches the owner API and removes the account")
        check(not errors, f"{width}px: zero browser page errors")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-failure.png"))
        print((await page.locator("body").inner_text())[-2600:], flush=True)
        raise
    finally:
        await context.close()




# ══ 2 · ONE QUESTION PER STEP, AND THE QUESTION LEADS (FEED-IA §246 · §247.2) ═════════════════
async def run_steps(browser, width: int) -> None:
    """Each setup step shows exactly one prompt at full weight and exactly one primary action."""
    world: dict = {"accounts": [], "configured": True, "reads": 0}
    context = await state_context(browser, width, world)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/admin/connections/email", wait_until="domcontentloaded")
        await page.get_by_test_id("email-connection").wait_for(state="visible", timeout=45000)

        async def one_question(step: str, prompt: str, act: str, act_id: str, tag: str) -> None:
            await expect(page.locator(f'[data-email-step="{step.split(":")[0]}"]')).to_be_visible()
            said = page.get_by_test_id("email-setup-prompt")
            await expect(said).to_have_text(prompt)
            heading = await said.evaluate("node => node.tagName")
            primary = page.get_by_test_id(act_id)
            check(heading == "H2" and await primary.count() == 1
                  and (await primary.first.inner_text()).strip() == act,
                  f'{width}px: {tag} asks «{prompt}» with one primary action · {act}')

        # STEP ONE · the question, and three square choices — the onboarding channel shape.
        await expect(page.get_by_test_id("email-setup-prompt")).to_have_text(PROMPTS["choose"])
        tiles = page.get_by_test_id("email-mailbox-choices").locator("> button")
        check(await tiles.count() == 3, f"{width}px: the mailbox question offers three square choices")
        for tile in ("email-connect-google", "email-connect-outlook", "email-forwarding"):
            box = await page.get_by_test_id(tile).bounding_box()
            check(bool(box) and abs(box["width"] - box["height"]) <= 2,
                  f"{width}px: {tile} is a square choice · {box}")
        check(await page.get_by_test_id("email-view-sample").count() == 0,
              f"{width}px: the Connections door offers what it can actually do")
        await hidden(page, width, "the mailbox question")
        await shot(page, OUT / f"{width}-step-choose.png")

        # STEP TWO · the provider's own hosted authorization, as ONE act that returns to the flow.
        await page.get_by_test_id("email-connect-google").click()
        await one_question("authorize", PROMPTS["authorize-google"], "Open Gmail", "email-authorize", "Gmail")
        check(await page.get_by_test_id("email-connect-google").count() == 0,
              f"{width}px: the authorization step carries no second choice")
        # THE STEP'S OWN QUESTION TAKES FOCUS. `ConnectionSetupFrame` keys its heading focus on the
        # title, and accounts, choose and authorize share one — so the press unmounted the focused
        # tile and left focus on the body with the new question unannounced.
        await page.wait_for_timeout(250)
        focused = await page.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')")
        check(focused == "email-setup-prompt",
              f"{width}px: the step's own question takes focus on a step change · {focused!r}")
        await shot(page, OUT / f"{width}-step-authorize.png")

        # A FAILED AUTHORIZATION SHOWS ONE LINE AND ONE ACTION.
        await page.get_by_test_id("email-authorize").click()
        await page.get_by_role("alert").first.wait_for(state="visible")
        check(await page.get_by_test_id("email-authorize").count() == 1,
              f"{width}px: a refused authorization keeps one line and the same one act")
        await shot(page, OUT / f"{width}-step-authorize-refused.png")

        await page.get_by_test_id("setup-back").click()
        await page.get_by_test_id("email-connect-outlook").click()
        await one_question("authorize", PROMPTS["authorize-outlook"], "Open Microsoft", "email-authorize", "Microsoft 365")

        # THE FORWARDING ADDRESS · one fact and one Done.
        await page.get_by_test_id("setup-back").click()
        await page.get_by_test_id("email-forwarding").click()
        await one_question("forwarding", PROMPTS["forwarding"], "Done", "email-forwarding-done", "forwarding")
        await shot(page, OUT / f"{width}-step-forwarding.png")
        await page.get_by_test_id("email-forwarding-done").click()
        await expect(page.locator('[data-email-step="choose"]')).to_be_visible()
        check(True, f"{width}px: Done returns the walk to its own question")

        check(
            await page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
            f"{width}px: every setup step fits its viewport",
        )
        check(not errors, f"{width}px: the one-question walk completes without page errors · {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-steps-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
        print("page errors: " + " | ".join(errors)[:2000], flush=True)
        raise
    finally:
        await context.close()


# ══ 3 · EVERY EMAIL ENTRY, IN THE UNCONNECTED POSTURE (FEED-IA §247.2) ════════════════════════
async def run_entrances(browser, width: int) -> None:
    """«always we havbe to be super consistent and not fget people igo confusing menus when they
    shouldnt see them» — the Connections card, the connected inbox, onboarding, the customer
    sheet and the composer's mailbox line all answer with the same one picture and one act."""
    world: dict = {"accounts": [], "configured": True, "reads": 0}
    # A STALE LOCAL STATE HAS NO VOTE. The house's own mailbox switches are armed and its company
    # card carries a typed address; the provider says this workspace holds nothing.
    context = await state_context(browser, width, world, extra="""
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:2,sector:['fish'],cast:'fish',
        mailbox:{gmail:true,m365:true}}));
      localStorage.setItem('rocoto-app-customer-edits',JSON.stringify({hotelrec:{email:'hotel@example.invalid'}}));
    """)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        # ── THE CONNECTIONS CARD ───────────────────────────────────────────────────────────────
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        card = page.get_by_test_id("connect-email")
        await card.wait_for(state="visible", timeout=45000)
        words = await card.inner_text()
        await card.scroll_into_view_if_needed()
        check("Connect email" in words, f"{width}px: the Connections card states Connect email · {words!r}")
        check("gmail@" not in words and "@example" not in words,
              f"{width}px: a browser draft never speaks for the mailbox · {words!r}")
        await shot(page, OUT / f"{width}-card-unconnected.png")

        # ── THE ONBOARDING EMAIL CHANNEL ───────────────────────────────────────────────────────
        await page.evaluate("""() => {
          localStorage.setItem('rocoto-cedar-onboarding-v1:fish',JSON.stringify({version:1,scope:'fish',
            step:'channel-setup',workspacePrepared:false,businessName:'Synthetic company',
            address:'Synthetic address',ruc:'20123456789',selectedChannel:'email',channels:[],
            catalogue:'pending',invoiceHistory:[],invoiceSearch:'pending'}));
          location.hash='#/onboarding/channel-setup';
        }""")
        await setup_state(page, width, "the onboarding email channel", "setup")
        await hidden(page, width, "the onboarding email channel")
        await shot(page, OUT / f"{width}-onboarding-unconnected.png")

        # ── THE CUSTOMER SHEET'S EMAIL ACTION · THE RECORD SURVIVES THE POSTURE ────────────────
        # Hotel Rec's own orders arrived by mail, so the house holds their source. With nothing
        # connected the act still opens that record: the rule removes SEND and MAILBOX controls,
        # never the record itself.
        await page.goto(URL + f"#/customers/{CUSTOMER}", wait_until="domcontentloaded")
        act = page.get_by_test_id("sheet-bar-act")
        await act.wait_for(state="visible", timeout=45000)
        check((await act.inner_text()).strip() == "Open the email",
              f"{width}px: an email account's act keeps the app's one pair of words")
        check(await page.get_by_test_id("sheet-mail").count() == 1,
              f"{width}px: the mail this account already sent stands on the sheet in every posture")
        await act.click()
        await page.locator("[data-testid=email-thread]:visible").first.wait_for(state="visible")
        check(await page.get_by_test_id("customer-email-send").count() == 0,
              f"{width}px: and the record it opens carries no send the connection cannot justify")
        await shot(page, OUT / f"{width}-sheet-record.png")

        # ── AND WITH NO STORED SOURCE, THE SAME ACT IS THE ONE PICTURE AND THE ONE ACT ─────────
        # An account whose orders arrive by mail and whose mailbox has handed the house nothing
        # yet: a door into an empty thread is the confusing menu §247.2 removes.
        blank = BLANK
        # The edits store reads its key once per document, so the plant is followed by a real load.
        await page.evaluate("""id => {
          localStorage.setItem('rocoto-app-customer-edits',JSON.stringify({
            hotelrec:{email:'hotel@example.invalid'},
            [id]:{channel:'email',email:'blank@example.invalid'}}));
          location.hash='#/customers/'+id;
        }""", blank)
        await page.reload(wait_until="domcontentloaded")
        act = page.get_by_test_id("sheet-bar-act")
        await act.wait_for(state="visible", timeout=45000)
        await act.click()
        check((await act.inner_text()).strip() == "Open the email",
              f"{width}px: an account with no stored mail keeps the same pair of words")
        await page.get_by_test_id("customer-email-compose").wait_for(state="visible")
        await setup_state(page, width, "the customer sheet's email action", "setup")
        await hidden(page, width, "the customer sheet's email action")
        await shot(page, OUT / f"{width}-sheet-unconnected.png")
        await page.get_by_test_id("workflow-close").click()

        # ── THE COMPOSER'S MAILBOX LINE ────────────────────────────────────────────────────────
        await page.get_by_test_id("chats-launcher").click()
        await page.get_by_test_id("chats-overlay").wait_for(state="visible")
        await page.locator(f"[data-thread={CUSTOMER}]").click()
        line = page.locator("[data-testid=reply-composer-mailbox]:visible").first
        await line.wait_for(state="visible")
        check(await line.get_attribute("data-posture") == "offline",
              f"{width}px: the composer's mailbox line reads the shared connection state")
        door = page.locator("[data-testid=reply-composer-connect-mailbox]:visible").first
        check(await door.count() == 1 and (await door.inner_text()).strip() == "Connect email",
              f"{width}px: and its one act is labelled Connect email")
        check(await page.get_by_test_id("customer-email-send").count() == 0,
              f"{width}px: the composer offers no send the connection cannot justify")
        await shot(page, OUT / f"{width}-composer-unconnected.png")

        check(not errors, f"{width}px: every unconnected entrance paints without page errors · {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-entrances-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
        print("page errors: " + " | ".join(errors)[:2000], flush=True)
        raise
    finally:
        await context.close()


# ══ 4 · THE FIXTURE MOVES UNDER A LIVE PAGE (FEED-IA §247.2) ══════════════════════════════════
async def run_state_led(browser, width: int) -> None:
    """Partial, forwarding only, connected without a reload, a stale read, and a revoked mailbox."""
    world: dict = {"accounts": [mailbox_account(status="attention")], "configured": True, "reads": 0}
    # An account whose orders arrive by mail and whose record holds no source, so its sheet's email
    # door is the one picture and the one act rather than a stored record.
    context = await state_context(browser, width, world, extra="""
      localStorage.setItem('rocoto-app-customer-edits',JSON.stringify(
        {'""" + BLANK + """':{channel:'email',email:'blank@example.invalid'}}));
    """)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        # ── A MAILBOX STILL AUTHORIZING IS PARTIAL, AND THE CARD SAYS SO ───────────────────────
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        card = page.get_by_test_id("connect-email")
        await card.wait_for(state="visible", timeout=45000)
        check(await wake_until(page, lambda: says(card, "Finish setup")),
              f"{width}px: a mailbox whose authorization is pending reads Finish setup")
        await card.scroll_into_view_if_needed()
        await shot(page, OUT / f"{width}-card-partial.png")

        # ── A HISTORY IMPORT THAT HAS YET TO RUN IS PARTIAL TOO ────────────────────────────────
        world["accounts"] = [mailbox_account(history_complete=False, synced_at=None)]
        check(await wake_until(page, lambda: says(card, "seller@example.invalid")),
              f"{width}px: a mailbox whose history import is pending names itself")
        check(await says(card, "Finish setup"),
              f"{width}px: and reads Finish setup until its history has been imported")

        # ── A FORWARDING ADDRESS ON ITS OWN IS A MAILBOX THE WORKSPACE STILL LACKS ─────────────
        world["accounts"] = [mailbox_account(account_ref="mail_forward", mode="forwarded",
                                             label="Forwarding", forwarding_address="orders@rocoto.invalid")]
        check(await wake_until(page, lambda: says(card, "orders@rocoto.invalid")),
              f"{width}px: the card describes the workspace from the provider's own evidence")
        check(await says(card, "Finish setup"),
              f"{width}px: and a forwarding address on its own is a mailbox still to come")

        # ── THE MAILBOX IS AUTHORIZED ELSEWHERE, AND THIS PAGE FINDS OUT ───────────────────────
        # The tab-return boundary alone, held to the snapshot's own ten-second floor.
        world["accounts"] = [mailbox_account()]
        check(await wake_until(page, lambda: says(card, "Connected"), floor=True),
              f"{width}px: a mailbox authorized elsewhere reaches this page without a reload")
        check(await says(card, "seller@example.invalid"),
              f"{width}px: and the card prints the provider's own mailbox address")
        await card.scroll_into_view_if_needed()
        await shot(page, OUT / f"{width}-card-connected.png")

        # ── A READ THAT FAILED IS A FACT ABOUT THE NETWORK, NOT ABOUT THE MAILBOX ──────────────
        world["fail"] = 503
        for _ in range(6):
            await page.evaluate("window.dispatchEvent(new Event('rocoto:channel-workspace-ready'))")
            await page.wait_for_timeout(500)
        check(await says(card, "Connected"),
              f"{width}px: a transient read keeps the mailbox exactly as it stands")
        world["fail"] = 0

        # ── THE CONNECTED INBOX, AND WHAT LEAVES IT WHEN THE MAILBOX GOES ──────────────────────
        # `ConnectedInbox` opens on the channel that is actually connected, so a live mailbox puts
        # the Email inbox on screen; the posture is then flipped underneath it.
        await page.evaluate("location.hash='#/sales'")
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox'))")
        inbox = page.get_by_test_id("connected-inbox")
        await inbox.wait_for(state="visible")
        await expect(inbox).to_have_attribute("data-channel", "email", timeout=20000)
        check(await page.get_by_test_id("connected-email-accounts").count() == 1,
              f"{width}px: a live mailbox opens the connected inbox on its own accounts")
        check(await page.get_by_test_id("email-setup-state").count() == 0,
              f"{width}px: and a live mailbox draws the inbox rather than the illustration")
        await shot(page, OUT / f"{width}-inbox-connected.png")

        # ── AND WHEN THE MAILBOX STOPS BEING LIVE, EVERY ENTRY RETURNS TO ITS PICTURE ─────────
        # ⚠ `ConnectedInbox` chooses its channel from the two capabilities, so an email posture that
        # leaves `ready` moves that panel back to WhatsApp's own entrance (the WhatsApp lane owns
        # that rule). The customer sheet's email door is this worker's own entry and states the
        # posture wherever it stands, so the flip is read there.
        world["accounts"] = [mailbox_account(status="attention")]
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        await card.wait_for(state="visible", timeout=45000)
        check(await wake_until(page, lambda: says(card, "Finish setup")),
              f"{width}px: a mailbox that stopped being authorized leaves the card at Finish setup")
        await page.goto(URL + f"#/customers/{BLANK}", wait_until="domcontentloaded")
        await page.get_by_test_id("sheet-bar-act").wait_for(state="visible", timeout=45000)
        await page.get_by_test_id("sheet-bar-act").click()
        await page.get_by_test_id("customer-email-compose").wait_for(state="visible")
        state = page.get_by_test_id("email-setup-state")

        async def posture_is(value: str) -> bool:
            try:
                return await state.get_attribute("data-email-posture") == value
            except Exception:
                return False

        check(await posture_is("partial"),
              f"{width}px: a mailbox that stopped being authorized returns the door to its image")
        await setup_state(page, width, "a mailbox that stopped being authorized", "partial")
        await hidden(page, width, "a mailbox that stopped being authorized")
        await shot(page, OUT / f"{width}-door-partial.png")

        # ── AND WHEN THE PROVIDER REVOKES IT, THE CONTROLS LEAVE ───────────────────────────────
        world["fail"] = 401
        check(await wake_until(page, lambda: posture_is("unavailable")),
              f"{width}px: the provider's own answer about this workspace revokes the mailbox")
        await setup_state(page, width, "a revoked mailbox", "unavailable")
        await hidden(page, width, "a revoked mailbox")
        await shot(page, OUT / f"{width}-door-revoked.png")
        await page.get_by_test_id("workflow-close").click()

        # ── AND RESET CEDAR'S OWN ANNOUNCEMENT REACHES THE SNAPSHOT AT ONCE ───────────────────
        # The Reset worker's shared event is `rocoto:cedar-workspace-reset` {scope, disconnect}, and
        # it fires AFTER every provider disconnect has returned. `resetEmailProvider` listens for
        # it, returns the snapshot to `checking` and reads again — WITHOUT the ten-second floor, so
        # Connections says `Connect email` the moment the mailboxes are gone rather than at the next
        # boundary. The proof is exactly that: no focus is dispatched here at all.
        world["fail"] = 0
        world["accounts"] = [mailbox_account()]
        await page.goto(URL + "#/admin/connections", wait_until="domcontentloaded")
        await card.wait_for(state="visible", timeout=45000)
        check(await wake_until(page, lambda: says(card, "Connected")),
              f"{width}px: the mailbox comes back when the provider answers for it again")
        world["accounts"] = []
        await page.evaluate("""window.dispatchEvent(new CustomEvent('rocoto:cedar-workspace-reset',
          {detail:{scope:'fish',disconnect:true}}))""")
        landed = False
        for _ in range(16):
            await page.wait_for_timeout(500)
            if await says(card, "Connect email"):
                landed = True
                break
        check(landed,
              f"{width}px: Reset Cedar's own announcement reads the connection again at once")
        await card.scroll_into_view_if_needed()
        await shot(page, OUT / f"{width}-card-after-reset.png")

        check(not errors, f"{width}px: the state-led walk completes without page errors · {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-state-led-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
        print("page errors: " + " | ".join(errors)[:2000], flush=True)
        raise
    finally:
        await context.close()



# ══ 5 · A READ THAT BEGAN BEFORE A WRITE IS OLDER THAN THE TRUTH ══════════════════════════════
async def run_write_guard(browser, width: int) -> None:
    """A `/email/status` read parked across a sync may never walk the snapshot backwards.

    `EmailConnectionHost` holds a subscriber for the app's life, so the sixty-second period is
    always running. A person who opens their mailbox finishes a sync — the runtime writes
    `history_complete` and `synced_at` — and the walk publishes the new evidence; the read that was
    already in flight then lands carrying the row as it stood BEFORE the sync. Publishing that
    answer read as a revocation: Connections returned to «Finish setup», the connected inbox swapped
    itself for the illustration and the customer sheet's door returned to the picture, with no act
    that explains it. The write generation discards it, exactly as `phone-runtime.ts` does.
    """
    world: dict = {"accounts": [mailbox_account(history_complete=False, synced_at=None)],
                   "configured": True, "messages": [], "sync_accounts": [mailbox_account()],
                   "gate": asyncio.Event()}
    context = await state_context(browser, width, world)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/admin/connections/email", wait_until="domcontentloaded")
        await page.get_by_test_id("email-connection").wait_for(state="visible", timeout=45000)
        card = page.get_by_test_id("connect-email")
        check(await wake_until(page, lambda: says(card, "Finish setup")),
              f"{width}px: a mailbox whose history import is pending reads Finish setup")
        await expect(page.locator('[data-email-step="accounts"]')).to_be_visible()
        # THE HOUSE NEVER READS THE AGGREGATOR'S NAME, in this posture either.
        said = await page.get_by_test_id("email-connected-account").inner_text()
        check("Unipile" not in said, f"{width}px: a pending row names the mailbox rather than the transport · {said!r}")
        await shot(page, OUT / f"{width}-accounts-row.png")

        # ── PARK THE PRE-SYNC ANSWER IN FLIGHT ─────────────────────────────────────────────────
        world["hold"] = True
        await page.evaluate("window.dispatchEvent(new Event('rocoto:channel-workspace-ready'))")
        for _ in range(30):
            if world.get("held"):
                break
            await page.wait_for_timeout(100)
        check(bool(world.get("held")), f"{width}px: a status read is in flight across the sync")

        # ── THE SYNC LANDS, AND THE WALK PUBLISHES WHAT IT WROTE ───────────────────────────────
        await page.get_by_test_id("email-connected-account").click()
        await page.get_by_test_id("email-refresh").wait_for(state="visible")
        check(await wake_until(page, lambda: says(card, "Connected")),
              f"{width}px: the sync the person asked for reaches Connections at once")

        # ── THE OLDER ANSWER LANDS, AND CHANGES NOTHING ────────────────────────────────────────
        world["gate"].set()
        await page.wait_for_timeout(1500)
        check(await says(card, "Connected"),
              f"{width}px: a read that began before the sync leaves Connections at Connected")
        check(await page.get_by_test_id("email-refresh").count() == 1,
              f"{width}px: and the inbox that read opened stays open")

        # THE COUNT IS THE RESPONSE'S OWN. This sync carried none, so the empty state is one
        # sentence rather than «0 customers looked up.» about a mailbox that was read for eight.
        empty = page.get_by_test_id("email-history-empty")
        await empty.wait_for(state="visible")
        said = (await empty.inner_text()).strip()
        check(said == "Mail from your customers appears here.",
              f"{width}px: a sync carrying no count states the sentence alone · {said!r}")

        # ── AND THE COUNT, WHERE THE RUNTIME SENDS ONE ─────────────────────────────────────────
        world["bound"] = 8
        await page.get_by_test_id("email-refresh").click()
        await expect(empty).to_have_text("Mail from your customers appears here. Rocoto read this mailbox for 8 customers.")
        check(True, f"{width}px: a sync that carries a count states what Rocoto read the mailbox for")
        world["bound"] = 1
        await page.get_by_test_id("email-refresh").click()
        await expect(empty).to_have_text("Mail from your customers appears here. Rocoto read this mailbox for 1 customer.")
        check(True, f"{width}px: and one customer is one customer")
        check(not errors, f"{width}px: the write-guard walk completes without page errors · {errors}")
    except Exception:
        world["gate"].set()
        await page.screenshot(path=str(OUT / f"{width}-write-guard-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
        raise
    finally:
        world["gate"].set()
        await context.close()


# ══ 6 · EVERY ACCOUNT THE WORKSPACE HOLDS A RECORD THROUGH OPENS FROM THE INBOX ════════════════
async def run_inbox(browser, width: int) -> None:
    """A forwarding address is a source of mail that already arrived, so its records open.

    `EmailInbox` listed `accounts.filter(mailboxConnected)`, which drops every `mode: 'forwarded'`
    row — so a workspace with a live Gmail BESIDE its commissioned forwarding address read «Email
    accounts» over a list holding one of them, and the forwarded mail it already received could be
    opened from nowhere in that panel. The rule removes the SEND and the mailbox controls a
    connection cannot justify; it never removes the record.
    """
    world: dict = {"accounts": [mailbox_account(),
                                mailbox_account(account_ref="mail_forward", mode="forwarded", status="connected",
                                                label="orders@rocoto.invalid", forwarding_address="orders@rocoto.invalid")],
                   "configured": True, "messages": [fixture_message()]}
    context = await state_context(browser, width, world)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/sales", wait_until="domcontentloaded")
        await page.wait_for_timeout(600)
        await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox'))")
        inbox = page.get_by_test_id("connected-inbox")
        await inbox.wait_for(state="visible", timeout=45000)
        await expect(inbox).to_have_attribute("data-channel", "email", timeout=20000)
        forwarding = page.get_by_role("button", name="orders@rocoto.invalid", exact=True)
        check(await forwarding.count() == 1,
              f"{width}px: the forwarding address stands in the connected inbox beside the mailbox")
        check(await page.get_by_role("button", name="seller@example.invalid", exact=True).count() == 1,
              f"{width}px: and the authorized mailbox stands beside it")
        await forwarding.click()
        message = page.get_by_test_id("connected-email-message").first
        await message.wait_for(state="visible")
        check(await message.count() == 1,
              f"{width}px: the mail that already arrived on the forwarding address opens from there")
        await shot(page, OUT / f"{width}-inbox-forwarding.png")
        await message.click()
        await page.get_by_test_id("email-thread-reader").wait_for(state="visible")
        check(True, f"{width}px: and its record opens in the same reader the mailbox uses")
        # THE PANEL HOLDS THE NAME AND THE ACT. A forwarding address is a whole email address in a
        # heading, so at 320 the head has to wrap rather than push «Add a mailbox» off the edge.
        fits = await page.evaluate('''() => {
          const panel = document.querySelector('[data-testid=connected-inbox]');
          const act = document.querySelector('[data-testid=connected-email-accounts]');
          if (!panel || !act) return false;
          return Math.round(act.getBoundingClientRect().right) <= Math.round(panel.getBoundingClientRect().right) + 1;
        }''')
        check(fits, f"{width}px: the panel contains the mailbox it names and its one act")
        check(not errors, f"{width}px: the connected inbox paints without page errors · {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-inbox-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
        raise
    finally:
        await context.close()


# ══ 7 · PREP'S SCHEDULED-EMAIL DESTINATION READS THE SAME MAILBOX ═════════════════════════════
TEMPLATE_SEED = """
      localStorage.setItem('rocoto:outputs:templates:fish',JSON.stringify({version:1,templates:[
        {id:'tpl_email_state',category:'email',name:'Daily albaranes',
         layout:{kind:'email',recipients:'accounts@example.invalid',timing:'Daily at 09:00',
                 timezone:'UTC',attachments:'Delivery notes',reviewRule:'Send directly'}}]}));
"""


async def open_email_plan(page) -> None:
    """Prep → the output library → the email template's own Schedule screen."""
    if not await page.get_by_test_id("export-library").count():
        await page.get_by_test_id("prep-email-schedules").click()
    await page.get_by_test_id("export-library").wait_for(state="visible")
    toggles = page.locator('[data-testid^=export-library-section-] button[aria-expanded][aria-controls]')
    for index in range(await toggles.count()):
        toggle = toggles.nth(index)
        if await toggle.get_attribute("aria-expanded") == "false":
            await toggle.focus()
            await toggle.press("Enter")
    await page.wait_for_timeout(700)
    await page.get_by_test_id("export-run-tpl_email_state").click()
    await page.get_by_test_id("export-email-destination").wait_for(state="visible")


async def plan_state(page) -> str:
    """The plan's own state line — «Prepared · …».

    ⚠ 14 September 2026 · the line had no seat of its own until the mail rail was folded onto the
    capability, so the section's whole text is the fallback and the RED on main's build reads as a
    sentence rather than as a timeout.
    """
    line = page.get_by_test_id("export-email-state")
    if await line.count():
        return (await line.inner_text()).strip()
    return (await page.get_by_test_id("export-email-objects").inner_text()).strip()


async def run_prep(browser, width: int) -> None:
    """«Sending email is ready to connect» stood on Prep while every other entrance read Connected.

    The destination decided from `railWorld`'s `config.mailbox` draft, whose only writer was a setup
    step nothing mounted — so it contradicted Connections, the connected inbox, the customer sheet
    and the composer on every workspace holding a live mailbox. It reads the one capability now.

    ⚠ 14 September 2026 · THE REST OF THE SCREEN CAUGHT UP WITH ITS OWN HEADING. The panel above
    was folded onto `useEmailCapability()` in the §247.2 sweep and everything under it was left on
    `railWorld`'s `email` rail, whose three fields have been constants since `config.mailbox` was
    retired. So on a workspace holding a live authorized mailbox, main's build reads
    «seller@example.invalid · Connected» in the panel and, forty pixels below it,
    «Prepared · Connect email to activate» on the plan, «Prepared · connect email to activate» on
    the schedule activity row, «Connect email to let this schedule run.» in the template editor and
    an empty `data-email` on the Prep door. Every one of those is asserted here, in both postures.
    """
    world: dict = {"accounts": [mailbox_account()], "configured": True}
    context = await state_context(browser, width, world, extra=TEMPLATE_SEED)
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_default_timeout(20000)
    try:
        await page.goto(URL + "#/sales", wait_until="domcontentloaded")
        door = page.get_by_test_id("export-centre")
        await door.wait_for(state="visible", timeout=45000)
        await door.click(force=True)
        await page.get_by_test_id("export-modal").wait_for(state="visible")
        await open_email_plan(page)
        destination = page.get_by_test_id("export-email-destination")

        # ── A LIVE MAILBOX READS THE CONNECTED WORDS, THE SAME ONES CONNECTIONS READS ──────────
        connection = page.get_by_test_id("export-email-connection")
        check(await wake_until(page, lambda: says(connection, "Connected")),
              f"{width}px: a workspace holding a live mailbox reads Connected on Prep")
        said = (await connection.inner_text()).strip()
        check("seller@example.invalid" in said,
              f"{width}px: and the destination names the mailbox the provider reported · {said!r}")
        check(await page.get_by_test_id("email-setup-state").count() == 0,
              f"{width}px: a connected destination draws its words rather than the setup state")

        # ── AND SO DOES THE PLAN UNDER IT. Prepare the schedule and read what it says it does. ──
        await page.get_by_test_id("export-run-tpl_email_state").click()
        await page.get_by_test_id("export-schedule").wait_for(state="visible")
        prepared = await plan_state(page)
        check("After activation · " in prepared,
              f"{width}px: a prepared plan on a live mailbox states the hour it is due · {prepared!r}")
        check("Connect email to activate" not in prepared,
              f"{width}px: and it stops asking for the mailbox the panel above it just named")
        row = page.locator("[data-testid=export-schedule] [data-schedule-row]").first
        activity = (await row.inner_text()).strip()
        check("Prepared · After activation · " in activity,
              f"{width}px: the schedule activity row reads the same mailbox · {activity!r}")
        check(await door.get_attribute("data-email") == "0",
              f"{width}px: the Prep door carries the mail count while a mailbox stands")
        await shot(page, OUT / f"{width}-prep-connected.png")

        # ── THE TEMPLATE EDITOR'S SCHEDULE NOTE STANDS DOWN ON A CONNECTED MAILBOX ─────────────
        await page.get_by_test_id("export-edit-tpl_email_state").click()
        editor = page.get_by_test_id("export-output-configuration")
        await editor.wait_for(state="visible")
        note = page.get_by_text("Connect email to let this schedule run.", exact=True)
        await editor.get_by_text("Pre-send review", exact=True).first.scroll_into_view_if_needed()
        check(await note.count() == 0,
              f"{width}px: the template editor's schedule note stands down on a live mailbox")
        await shot(page, OUT / f"{width}-prep-editor-connected.png")
        await page.get_by_test_id("export-back").click()

        # ── AND WHEN THE WORKSPACE HOLDS NO MAILBOX, THE SAME PICTURE AND THE SAME ONE ACT ─────
        world["accounts"] = []
        await open_email_plan(page)
        check(await wake_until(page, lambda: says(connection, "Connect email")),
              f"{width}px: a workspace holding no mailbox reaches the destination without a reload")
        await setup_state(page, width, "Prep's scheduled-email destination", "setup")
        check(await destination.get_by_text("Scheduled email", exact=True).count() == 1,
              f"{width}px: and the destination still names itself")
        unconnected = await plan_state(page)
        check("Prepared · Connect email to activate" in unconnected,
              f"{width}px: the prepared plan asks for the mailbox it needs · {unconnected!r}")
        row = page.locator("[data-testid=export-schedule] [data-schedule-row]").first
        activity = (await row.inner_text()).strip()
        check("Prepared · connect email to activate" in activity,
              f"{width}px: and so does its activity row · {activity!r}")
        check(await door.get_attribute("data-email") == "",
              f"{width}px: the Prep door carries no mail count while the mailbox is still to come")
        await shot(page, OUT / f"{width}-prep-unconnected.png")
        await page.get_by_test_id("export-edit-tpl_email_state").click()
        await editor.wait_for(state="visible")
        await note.scroll_into_view_if_needed()
        check(await note.count() == 1,
              f"{width}px: the template editor states what the schedule still needs")
        await shot(page, OUT / f"{width}-prep-editor-unconnected.png")
        check(await page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
              f"{width}px: the destination fits its viewport in both postures")
        check(not errors, f"{width}px: the Prep destination paints without page errors · {errors}")
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-prep-failure.png"))
        print((await page.locator("body").inner_text())[:2400], flush=True)
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
            browser = await playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            try:
                blocks = {"mailbox": run, "steps": run_steps,
                          "entrances": run_entrances, "state-led": run_state_led,
                          "write-guard": run_write_guard, "inbox": run_inbox, "prep": run_prep}
                for width in WIDTHS:
                    for name, block in blocks.items():
                        if ONLY and name not in ONLY:
                            continue
                        await block(browser, width)
            finally:
                await browser.close()
    finally:
        if server is not None:
            server.shutdown()
    (OUT / "result.json").write_text(
        json.dumps({"mode": "explicit owner API fixtures", "checks": CHECKS}, indent=2)
    )
    print(f"{len(CHECKS)} GREEN", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
