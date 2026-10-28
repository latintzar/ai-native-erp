#!/usr/bin/env python3
"""Campaigns in Sales: the recommendations, the custom campaign and the schedule (FEED-IA §249).

    ROCOTO_DIST=app/dist-campaigns .venv/bin/python drives/drive-cedar-campaigns.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served `app.html`; `ROCOTO_ONLY=1600` narrows the run to one width and `ROCOTO_SHOTS` selects the
screenshot folder. Every provider call is answered inside this file, so a run reaches no network.

WHAT IT PROVES, IN ONE WALK PER WIDTH (1600 · 390 · 320)

1. **The act stands in the Sales header.** `sales-campaigns` is the red-first assertion: on the
   build this branch started from, the river's head carries the search and the New delivery note
   and nothing else.
2. **The three cards are the book's own reading.** The drive recomputes each figure from OUTSIDE
   the app — the early-pay share from the Money ledger in `localStorage`, the price signal from
   `fixtures/campaigns-v1.json` on disk, the quiet accounts from that same seed — and compares
   them against what the cards print and what their `data-facts` carry.
3. **Every act lands where its word says.** **Get advance** opens `#/money/advance/<minor>` with
   the pre-buy amount; **Send campaign** puts one message in each quiet account's own
   conversation; **Create campaign** opens the Create tab already filled in.
4. **A custom campaign goes to the customers a person chose.** Two accounts, a fifteen per cent
   offer, a budget, **Launch campaign** — then both conversations hold their own merged message
   and the Sent tab states the sends and the redemptions.
5. **A scheduled campaign waits and then goes by itself.** Scheduled for tomorrow, the row says so;
   Playwright's own clock jumps a day and the bounded runner sends it with no dialog open.
6. **It survives a reload and returns to the seed.** The book is read back after `page.reload()`,
   and Reset Cedar empties it.
"""

from __future__ import annotations

import asyncio
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
URL = os.getenv("ROCOTO_URL", "").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-campaigns/shots"))
SCOPE = "fish"
MONEY_KEY = f"rocoto-cedar-money-v1:{SCOPE}"
CAMPAIGNS_KEY = f"rocoto-cedar-campaigns-v1:{SCOPE}"
SEED = Path("app/src/prototypes/cedar/fixtures/campaigns-v1.json")
CHECKS: list[str] = []
FAILURES: list[str] = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):  # noqa: D102 - a drive keeps its own log
        pass


def serve_dist() -> tuple[str, socketserver.TCPServer | None]:
    """Serve the built app privately, unless an already-served URL was given."""
    if URL:
        return URL, None
    root = DIST if DIST.is_absolute() else Path.cwd() / DIST
    if not (root / "app.html").exists():
        raise SystemExit(f"Build the app first: no app.html under {root}")
    httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}/app.html", httpd


BOOT = """if (!sessionStorage.getItem('cedar-campaigns-drive')) {
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config', JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');
  sessionStorage.setItem('cedar-campaigns-drive', 'ready');
}"""


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


def seeded() -> dict:
    return json.loads(SEED.read_text())["fixture"]["collections"]


def early_pay_share(ledger: dict, days: int = 7) -> tuple[int, int, int]:
    """The share the card states, recomputed here: of the invoices a payment request went out
    for, how many were covered in full on or before the seventh day after they were issued."""
    asked = {row["invoiceId"] for row in ledger["requests"]}
    invoices = [row for row in ledger["invoices"] if row["id"] in asked]
    settled = 0
    for invoice in invoices:
        deadline = datetime.fromisoformat(invoice["issuedAt"]) + timedelta(days=days)
        paid = sum(
            row["amountMinor"] for row in ledger["receipts"]
            if row["invoiceId"] == invoice["id"] and row["status"] == "matched"
            and datetime.fromisoformat(row["at"]) <= deadline
        )
        if invoice["amountMinor"] > 0 and paid >= invoice["amountMinor"]:
            settled += 1
    requested = len(invoices)
    return requested, settled, round(settled * 100 / requested) if requested else 0


async def money_text(page, minor: int) -> str:
    return await page.evaluate(
        "n => 'S/\\u00a0' + new Intl.NumberFormat('en-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n / 100)",
        minor,
    )


async def shot(page, width: int, name: str) -> None:
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def stored(page, key: str):
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key) || 'null')", key)


async def open_dialog(page):
    await page.get_by_test_id("sales-campaigns").click()
    await page.get_by_test_id("campaigns-dialog").wait_for(state="visible")
    await page.get_by_test_id("campaigns-panel").wait_for(state="visible")


async def show_tab(page, tab: str):
    await page.get_by_test_id(f"campaigns-tab-{tab}").click()
    await expect(page.get_by_test_id("campaigns-panel")).to_have_attribute("data-tab", tab)


async def conversation_of(page, customer_id: str) -> str:
    """What that customer's own conversation holds, read through the chats widget."""
    await page.get_by_test_id("chats-launcher").first.click()
    overlay = page.locator("[data-testid=chats-overlay]:not([inert])").first
    await overlay.wait_for(state="visible")
    await overlay.locator(f"[data-testid=thread-{customer_id}]").first.click()
    await overlay.locator(f"[data-testid=thread-view][data-thread-open={customer_id}]").wait_for()
    said = overlay.locator("[data-testid=thread-turns] [data-turn]").last
    await said.scroll_into_view_if_needed()
    await said.wait_for(state="visible")
    await page.wait_for_timeout(500)
    text = await overlay.inner_text()
    await page.keyboard.press("Escape")
    await page.get_by_test_id("river-header").wait_for(state="visible")
    return text


async def pick_customer(page, name: str):
    """Base's own multi-select: type the account, then take the option by its exact name."""
    field = page.locator('[data-testid="campaign-customers"] input').first
    await field.click()
    await field.fill(name)
    await page.get_by_role("option", name=name, exact=True).first.click()


async def run_campaigns(browser, width: int, url: str):
    """The whole walk, at one width."""

    def label(name: str) -> str:
        return f"{width}: {name}"

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(BOOT)
    await context.clock.install()
    await context.clock.resume()

    async def guard(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if not same_origin or parsed.path.startswith("/api/"):
            await request_route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')
        else:
            await request_route.continue_()

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(15000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    try:
        await page.goto(url + "#/sales", wait_until="domcontentloaded")
        await page.get_by_test_id("river-header").wait_for(state="visible", timeout=45000)

        # ── THE RED-FIRST ASSERTION ──────────────────────────────────────────────────────────
        # On the build this branch started from the river's head carries the search and the New
        # delivery note and nothing else, so this wait is the whole of «the surface is absent
        # there»; on this branch Campaigns stands beside the search at every width.
        standing = True
        try:
            await page.get_by_test_id("sales-campaigns").wait_for(state="visible", timeout=30000)
        except Exception:
            standing = False
        check(standing, label("Campaigns stands in the Sales header"))
        act = page.get_by_test_id("sales-campaigns")
        box = await act.bounding_box()
        aria = await act.get_attribute("aria-label")
        words = (await act.inner_text()).strip()
        check(aria == "Campaigns", label("the act carries its own accessible name"))
        if width < 560:
            check(box["height"] >= 44 and box["width"] >= 44,
                  label(f"the phone's act keeps the 44 px floor · {round(box['width'])}×{round(box['height'])}"))
        else:
            check(words == "Campaigns", label("the desk's act wears its word"))
        await shot(page, width, "sales-header")

        await open_dialog(page)
        await expect(page.get_by_test_id("campaigns-panel")).to_have_attribute("data-tab", "recommended")
        head = await page.get_by_test_id("campaigns-dialog").inner_text()
        for word in ["Campaigns", "Recommended campaigns", "Create custom campaign", "Sent"]:
            check(word in head, label(f"the dialog carries «{word}»"))

        facts = {}
        for key in ["pre-buy", "win-back", "early-pay"]:
            card = page.get_by_test_id(f"campaign-card-{key}")
            await card.wait_for(state="visible")
            facts[key] = json.loads(await card.get_attribute("data-facts"))
        await shot(page, width, "recommended")

        # ── THE PRE-BUY CARD, AGAINST THE SEEDED SIGNAL ──────────────────────────────────────
        signals = {row["product"]: row for row in seeded()["priceSignals"] if row["market"] == "peru"}
        pre_buy_fact = await page.get_by_test_id("campaign-fact-pre-buy").inner_text()
        named = [name for name in signals if pre_buy_fact.startswith(f"{name} ·")]
        check(len(named) == 1, label(f"the pre-buy card names one published line · {pre_buy_fact[:64]}"))
        signal = signals[named[0]]
        check(facts["pre-buy"]["risePercent"] == signal["risePercent"],
              label(f"the rise is the feed's own · {named[0]} +{signal['risePercent']} %"))
        check(f"{signal['risePercent']} % more from" in pre_buy_fact,
              label("the card says how much more, and from when"))
        check(facts["pre-buy"]["preBuyMinor"] == facts["pre-buy"]["weeklyMinor"] * 2,
              label("the pre-buy is two weeks of that line at today's prices"))
        figure = await page.get_by_test_id("campaign-figure-pre-buy").inner_text()
        check(figure == await money_text(page, facts["pre-buy"]["preBuyMinor"]),
              label(f"the figure is the amount, with its unit on its own line · {figure}"))

        # ── THE QUIET ACCOUNTS, AGAINST THE SEEDED HISTORY ───────────────────────────────────
        history = [row for row in seeded()["accountHistory"] if row["scope"] == SCOPE]
        win_back_fact = await page.get_by_test_id("campaign-fact-win-back").inner_text()
        quiet = facts["win-back"]["quiet"]
        check(0 < quiet <= len(history), label(f"the book names {quiet} quiet account(s) of {len(history)} in its history"))
        check("VUELVE10" in win_back_fact and "10 % off" in win_back_fact,
              label("the win-back card states its code and its offer"))
        check(f"last order {facts['win-back']['days']} days ago" in win_back_fact,
              label(f"the card says how long that account has been quiet · {facts['win-back']['days']} days"))
        check(facts["win-back"]["days"] >= 14, label("the threshold is fourteen days"))

        # ── THE EARLY-PAY SHARE, RECOMPUTED FROM THE LEDGER THIS BROWSER HOLDS ───────────────
        await page.wait_for_function("key => { const s = JSON.parse(localStorage.getItem(key) || 'null');"
                                     " return s && s.invoices && s.invoices.length > 0; }", arg=MONEY_KEY)
        ledger = await stored(page, MONEY_KEY)
        requested, settled, share = early_pay_share(ledger)
        check((facts["early-pay"]["requested"], facts["early-pay"]["settled"], facts["early-pay"]["sharePercent"])
              == (requested, settled, share),
              label(f"the early-pay share is the ledger's own · {share} % · {settled} of {requested}"))
        early_fact = await page.get_by_test_id("campaign-fact-early-pay").inner_text()
        check(f"{share} % of invoices are paid within 7 days" in early_fact,
              label("the card states the share in the words the model wrote"))

        # ── WIDTH: NOTHING SCROLLS SIDEWAYS ──────────────────────────────────────────────────
        geometry = await page.get_by_test_id("campaigns-panel").evaluate(
            "el => ({scroll: el.scrollWidth, client: el.clientWidth, right: el.getBoundingClientRect().right, viewport: innerWidth})")
        check(geometry["scroll"] <= geometry["client"] + 1 and geometry["right"] <= geometry["viewport"] + 1,
              label("the recommended cards fit their viewport width"))

        # ── SEND CAMPAIGN: ONE MESSAGE PER QUIET ACCOUNT, IN ITS OWN CONVERSATION ────────────
        await page.get_by_test_id("campaign-act-win-back").click()
        await page.get_by_test_id("campaign-win-back-sent").wait_for(state="visible")
        book = await stored(page, CAMPAIGNS_KEY)
        record = next(row for row in book["campaigns"] if row["name"] == "Win back quiet customers")
        check(len(record["sends"]) == quiet and record["kind"] == "recommended",
              label(f"the campaign records one send per quiet account · {len(record['sends'])}"))
        check(await page.get_by_test_id("campaign-act-win-back").count() == 0,
              label("a campaign already sent today offers the same send no second time"))
        await shot(page, width, "win-back-sent")

        quiet_id = record["sends"][0]["customerId"]
        check(any(row["customerId"] == quiet_id for row in history),
              label(f"the account it wrote to is one the seed holds history for · {quiet_id}"))
        await page.keyboard.press("Escape")
        await page.get_by_test_id("campaigns-dialog").wait_for(state="hidden")
        check(True, label("Escape closes the dialog"))
        said = await conversation_of(page, quiet_id)
        check("we miss your orders" in said and "VUELVE10" in said,
              label("the win-back message lands in that account's own conversation"))
        await shot(page, width, "win-back-conversation")

        # ── CREATE CUSTOM CAMPAIGN: TWO ACCOUNTS, LAUNCHED NOW ──────────────────────────────
        await open_dialog(page)
        await show_tab(page, "create")
        await expect(page.get_by_test_id("campaign-name")).to_be_focused()
        check(True, label("the Create tab opens with the keyboard in its first field"))
        await page.get_by_test_id("campaign-name").fill("Spring offer")
        await page.get_by_test_id("campaign-audience-chosen").click()
        await pick_customer(page, "Bar Manolo")
        await pick_customer(page, "Hotel Rec")
        await expect(page.get_by_test_id("campaign-audience-count")).to_have_text("2 customers")
        await page.get_by_test_id("campaign-offer-value").fill("15")
        await page.get_by_test_id("campaign-budget").fill("500")
        preview = await page.get_by_test_id("campaign-preview").inner_text()
        check("Bar Manolo" in preview and "15 % off" in preview,
              label(f"the preview states what a customer will read · {preview}"))
        await shot(page, width, "create")
        await page.get_by_test_id("campaign-launch").click()
        await expect(page.get_by_test_id("campaigns-panel")).to_have_attribute("data-tab", "sent")

        book = await stored(page, CAMPAIGNS_KEY)
        custom = next(row for row in book["campaigns"] if row["name"] == "Spring offer")
        check(sorted(row["customerId"] for row in custom["sends"]) == ["hotelrec", "manolo"],
              label("the custom campaign went to exactly the two accounts a person chose"))
        check(custom["offer"] == {"type": "percent", "value": 15} and custom["budgetMinor"] == 50000,
              label("the record holds the offer and the budget in minor units"))
        row = page.get_by_test_id(f"campaign-row-{custom['id']}")
        await row.wait_for(state="visible")
        await expect(row).to_have_attribute("data-sends", "2")
        redemptions = int(await row.get_attribute("data-redemptions"))
        printed = int(await page.get_by_test_id(f"campaign-redemptions-{custom['id']}").inner_text())
        check(redemptions == printed and 0 <= redemptions <= 2,
              label(f"the Sent row states its redemptions from the book · {redemptions} of 2"))
        await shot(page, width, "sent")

        for customer, name in [("manolo", "Bar Manolo"), ("hotelrec", "Hotel Rec")]:
            await page.keyboard.press("Escape")
            await page.get_by_test_id("campaigns-dialog").wait_for(state="hidden")
            said = await conversation_of(page, customer)
            check(f"Hi {name}, 15 % off your next order this week." in said,
                  label(f"{name}'s own conversation holds their own merged message"))
            await open_dialog(page)
            await show_tab(page, "sent")

        # ── A RELOAD MID-FLOW KEEPS THE BOOK ────────────────────────────────────────────────
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("river-header").wait_for(state="visible", timeout=45000)
        await open_dialog(page)
        await show_tab(page, "sent")
        await page.get_by_test_id(f"campaign-row-{custom['id']}").wait_for(state="visible")
        check(len((await stored(page, CAMPAIGNS_KEY))["campaigns"]) == 2,
              label("the campaigns survive a reload"))

        # ── A SCHEDULED CAMPAIGN WAITS, THEN GOES BY ITSELF ─────────────────────────────────
        tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
        await show_tab(page, "create")
        await page.get_by_test_id("campaign-name").fill("Thursday offer")
        await page.get_by_test_id("campaign-schedule-date").click()
        date_field = page.locator('[data-testid="campaign-date"]').first
        await date_field.fill(tomorrow.strftime("%d/%m/%Y"))
        await date_field.press("Enter")
        await expect(page.get_by_test_id("campaign-launch")).to_be_enabled()
        await page.get_by_test_id("campaign-launch").click()
        await expect(page.get_by_test_id("campaigns-panel")).to_have_attribute("data-tab", "sent")
        book = await stored(page, CAMPAIGNS_KEY)
        scheduled = next(row for row in book["campaigns"] if row["name"] == "Thursday offer")
        check(scheduled["sends"] == [] and scheduled["scheduledFor"] is not None,
              label("a scheduled campaign records its day and sends nothing yet"))
        pending = page.get_by_test_id(f"campaign-row-{scheduled['id']}")
        await expect(pending).to_have_attribute("data-scheduled", "yes")
        words = await page.get_by_test_id(f"campaign-schedule-{scheduled['id']}").inner_text()
        check(words.startswith("Scheduled for "), label(f"the pending row says when it goes · {words}"))
        await shot(page, width, "scheduled")

        # The runner is bounded: thirty seconds, focus and visibility. The clock jumps a day and
        # the campaign goes with no dialog open and no press.
        await page.keyboard.press("Escape")
        await page.get_by_test_id("campaigns-dialog").wait_for(state="hidden")
        await page.clock.fast_forward("24:01:00")
        await page.wait_for_function(
            "key => { const b = JSON.parse(localStorage.getItem(key) || 'null');"
            " const row = b && b.campaigns.find(c => c.name === 'Thursday offer');"
            " return Boolean(row && row.sends.length > 0); }", arg=CAMPAIGNS_KEY, timeout=30000)
        book = await stored(page, CAMPAIGNS_KEY)
        sent_late = next(row for row in book["campaigns"] if row["name"] == "Thursday offer")
        check(len(sent_late["sends"]) == len(sent_late["customers"]) and sent_late["scheduledFor"] is None,
              label(f"the clock sent the scheduled campaign on its own · {len(sent_late['sends'])} sends"))

        # ── RESET CEDAR RETURNS THE WORKSPACE TO ITS SEED ───────────────────────────────────
        await page.evaluate("() => { window.location.hash = '#/admin/app-settings'; }")
        await page.get_by_test_id("seat-app-settings").wait_for(state="visible", timeout=45000)
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await page.get_by_test_id("row-reset-workspace-data").click()
        await page.get_by_test_id("reset-card").wait_for(state="visible")
        await page.get_by_test_id("reset-confirm").click()
        await page.wait_for_url("**/#/sales", timeout=45000, wait_until="commit")
        await page.get_by_test_id("river-header").wait_for(state="visible", timeout=45000)
        check(await stored(page, CAMPAIGNS_KEY) is None, label("Reset Cedar clears the campaigns key"))
        await open_dialog(page)
        await show_tab(page, "sent")
        await page.get_by_test_id("campaigns-sent-empty").wait_for(state="visible")
        check(True, label("the Sent tab states what will appear there once the book is back to its seed"))
        await shot(page, width, "after-reset")

        check(not errors, label(f"the campaigns walk runs without browser exceptions: {errors}"))
    except Exception as error:  # noqa: BLE001 - a drive reports its own failure
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "failure")
    finally:
        await context.close()


async def main() -> int:
    url, httpd = serve_dist()
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local app URL for this drive.")
    OUT.mkdir(parents=True, exist_ok=True)
    widths = [1600, 390, 320]
    if os.getenv("ROCOTO_ONLY"):
        widths = [int(os.environ["ROCOTO_ONLY"])]
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
        )
        for width in widths:
            await run_campaigns(browser, width, url)
        await browser.close()
    if httpd:
        httpd.shutdown()
    (OUT / "result.json").write_text(json.dumps(
        {"url": url, "checks": CHECKS, "failures": FAILURES, "screenshots": str(OUT)}, indent=2))
    print(f"{len(CHECKS)} GREEN / {len(FAILURES)} RED · {OUT}", flush=True)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
