#!/usr/bin/env python3
"""Cedar Money's prototype lifecycle and connection postures, in isolated Playwright contexts.

    ROCOTO_DIST=app/dist-money-state .venv/bin/python drives/drive-cedar-money.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served `app.html`. `ROCOTO_ONLY=1600` narrows the run to one width, `ROCOTO_BLOCKS=chase` narrows
it to one block (`unconnected`, `definitive`, `viewport`, `chase`, `receipts`, comma separated), and
`ROCOTO_SHOTS` selects the screenshot folder, so 1600, 390 and 320 each keep their own
`result.json`.

MONEY READS ITS PROVIDER, CHASES UNPAID ORDERS AND SHOWS RECENT RECEIPTS (§246, §247.2, §249).

`run_unconnected` holds a workspace whose service answers nothing — and plants the old local
`demo-connected` flags to prove they have no vote — then asks every Money surface what it says:
Connections reads Connect bank / Set up payments / Set up invoicing with no ✓, the transactions
card shows one picture and one act instead of a synthesized statement, the invoice card and the
buyer preview show the single «Set up payments» door, and the working-capital card states its
posture. It also walks money setup and asserts each step asks exactly one thing, that consent
lands on «Authorization sent», and that the local step alone never prints «Connected».

`run_definitive` reads one workspace three times — the authorized account, a 503, a 401 — and holds
the rule that decides which of them clears a connected bank: a transport failure keeps the account
and its balance, and the provider's own answer about this workspace states Connect bank again.

`run_viewport` mounts an isolated fixture of Cedar's own collection service — the authorized
Prometeo account, the workspace readiness and the request/receipt ledger — and walks the whole
lifecycle a connected workspace can reach, including the one state vocabulary. Every request in
both blocks is answered inside this file, so the run reaches no network.

`run_chase` walks §249's unpaid orders on that same fixture with Playwright's own clock installed:
one card per unpaid order, **Chase now** with its rung and its words, the reminder landing in the
customer's conversation, **Auto-chase** at 12 h firing the second rung when the clock jumps, and
the third rung flagging the card with the advance beside it.

⚠ 13 September 2026 — RETARGETED (FEED-IA §247.8, «also remove future connotation. nothing is
future»). The working-capital card used to carry a «Future» pill and answer to
`money-future` / `data-future-posture` / `money-future-setup-state` / `money-future-open-setup`,
and the same pill stood on the dashboard's customer-credit card, on the credit page and on the
customer sheet's Credit block. The card is now `money-working-capital` with `data-plan-posture`,
its setup state is `money-working-capital-setup-state`, its act is
`money-working-capital-open-setup`, and four checks hold the word off those surfaces.
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
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
URL = os.getenv("ROCOTO_URL", "").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-money-proof"))
KEY = "rocoto-cedar-money-v1:fish"
WORKSPACE_KEY = "rocoto-cedar-money-api-v1:fish"
ADVANCE_KEY = "rocoto-cedar-finance-v1:fish"
CHASE_KEY = "rocoto-cedar-chase-v1:fish"
TOKEN = "b" * 64
AS_OF = "2026-09-11T12:00:00Z"
ACCOUNT = {
    "ready": True,
    "bank": "bbva",
    "account_label": "Drive receiving account",
    "account_mask": "•••• 1234",
    "balance_minor": 987654,
    "currency": "PEN",
    "as_of": AS_OF,
    "mode": "sandbox",
    "source": "prometeo",
    "monitor": {"status": "scheduled"},
}
READINESS = {
    "prometeo": {"configured": True, "bank_authorized": True, "last_read": AS_OF, "mode": "sandbox"},
    "nubefact": {"configured": True, "mode": "sandbox", "documents": 0},
}
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


class Collections:
    """Cedar's collection service, as much of it as a browser proof needs.

    It holds one request per idempotency key, allocates a receipt in full when the money fits the
    remaining balance and its currency matches, and leaves everything else for review — the same
    three answers `cedar_store` gives, with none of its persistence.
    """

    def __init__(self, origin: str) -> None:
        self.origin = origin
        self.requests: dict[str, dict] = {}
        self.calls: list[str] = []

    def balance(self, item: dict) -> int:
        matched = sum(row["amount_minor"] for row in item["receipts"] if row["status"] == "matched")
        return item["invoice_amount_minor"] - matched

    def add(self, item: dict, row: dict) -> None:
        for existing in item["receipts"]:
            if existing["reference"] == row["reference"]:
                return
        review = row["currency"] != "PEN" or row["amount_minor"] > self.balance(item)
        receipt = {
            "id": f"receipt_{len(item['receipts']) + 1}",
            "amount_minor": row["amount_minor"],
            "currency": row["currency"],
            "reference": row["reference"],
            "method": row["method"],
            "source": row["source"],
            "status": "review" if review else "matched",
            "created_at": row.get("created_at") or AS_OF,
        }
        if review:
            receipt["reason"] = "Review this collection receipt."
        item["receipts"].append(receipt)

    def view(self, item: dict) -> dict:
        balance, matched = self.balance(item), [row for row in item["receipts"] if row["status"] == "matched"]
        source_total = lambda name: sum(row["amount_minor"] for row in matched if row["source"] == name)  # noqa: E731
        return {
            "id": item["id"],
            "buyer_url": f"{self.origin}/collect/{item['id']}/synthetic-public",
            "amount_minor": item["amount_minor"],
            "currency": "PEN",
            "status": "paid" if balance == 0 else "partial" if matched else "pending",
            "balance_minor": balance,
            "confirmed_minor": source_total("prometeo"),
            "manual_minor": source_total("manual"),
            "sample_minor": source_total("sample"),
            "receipts": item["receipts"],
        }

    def create(self, body: dict) -> dict:
        key = body.get("idempotency_key") or f"request_{len(self.requests) + 1}"
        item = self.requests.get(key)
        if item is None:
            item = {
                "id": key,
                "amount_minor": body["amount_minor"],
                "invoice_amount_minor": body.get("invoice_amount_minor", body["amount_minor"]),
                "receipts": [],
            }
            self.requests[key] = item
            for row in body.get("initial_receipts", []):
                self.add(item, row)
        return self.view(item)

    def answer(self, method: str, path: str, body: dict | None) -> dict | None:
        self.calls.append(f"{method} {path}")
        if path == "/api/cedar/bank":
            return ACCOUNT
        if path == "/api/cedar/bank/movements":
            return {"ready": True, "mode": "sandbox", "as_of": AS_OF, "movements": []}
        if path == "/api/cedar/setup":
            return {"id": "workspace_fixture", "mode": "sample", "setup": {}, "readiness": READINESS}
        if path == "/api/cedar/requests" and method == "POST":
            return self.create(body or {})
        if path.startswith("/api/cedar/requests/"):
            rest = path[len("/api/cedar/requests/") :]
            request_id = rest.split("/")[0]
            item = self.requests.get(request_id)
            if item is None:
                return None
            if rest.endswith("/receipts") and method == "POST":
                self.add(item, {**(body or {}), "created_at": AS_OF})
            return self.view(item)
        return None
# THE ONE STATE TABLE (MONEY-SPEC «Money states»), copied here so the drive measures the rendered
# words against the contract rather than against the module that produces them.
STATUS_WORDS = {
    "offered": "Offered",
    "upcoming": "Upcoming",
    "due": "Due",
    "requested": "Payment link sent",
    "overdue": "Overdue",
    "part-paid": "Part paid",
    "paid": "Paid",
    "repaying": "Repaying",
    "repaid": "Repaid",
}
def boot(origin: str | None) -> str:
    """A fresh workspace. With an `origin`, it also holds the collection binding the fixture
    answers on, so `collectionOrigin()` resolves and every provider read reaches this file."""
    binding = (
        f"""
  localStorage.setItem('rocoto-cedar-collections-base', {json.dumps(origin + '/')});
  localStorage.setItem({json.dumps(WORKSPACE_KEY)}, JSON.stringify({{id:'workspace_fixture',token:{json.dumps(TOKEN)},mode:'sample',origin:{json.dumps(origin)}}}));"""
        if origin
        else ""
    )
    return f"""if (!sessionStorage.getItem('cedar-money-drive')) {{
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config', JSON.stringify({{version:1,sector:['fish'],cast:'fish'}}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');{binding}
  sessionStorage.setItem('cedar-money-drive', 'ready');
}}"""


# `drive-cedar-collections.py` imports this module for its shared helpers and boots its own seller
# context from this script, so the plain no-binding boot keeps its name.
BOOT = boot(None)


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


async def state(page):
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


async def saved(page, expression: str):
    await page.wait_for_function(
        "([key, expression]) => { const s = JSON.parse(localStorage.getItem(key)); return s && new Function('s', 'return ' + expression)(s); }",
        arg=[KEY, expression],
    )
    return await state(page)


async def route(page, value: str, target: str):
    await page.evaluate("hash => { window.location.hash = hash; }", value)
    await page.get_by_test_id(target).first.wait_for(state="visible")


async def field(page, name: str):
    node = page.get_by_test_id(name)
    return (
        node
        if await node.evaluate("el => ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)")
        else node.locator("input,textarea,select").first
    )


async def fill(page, name: str, value: str):
    await (await field(page, name)).fill(value)


async def checkbox(page, name: str):
    node = page.get_by_test_id(name)
    await node.locator("xpath=ancestor::label[1]").click()
    await expect(node).to_be_checked()


async def money_text(page, minor: int) -> str:
    return await page.evaluate(
        "n => 'S/\\u00a0' + new Intl.NumberFormat('en-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n / 100)",
        minor,
    )


def balance(s, invoice):
    return invoice["amountMinor"] - sum(
        r["amountMinor"]
        for r in s["receipts"]
        if r["invoiceId"] == invoice["id"] and r["status"] == "matched"
    )


async def record(page, minor: int, reference: str):
    await page.get_by_test_id("money-record-payment").click()
    await page.get_by_test_id("money-receipt-dialog").wait_for(state="visible")
    await fill(page, "money-receipt-amount", f"{minor / 100:.2f}")
    await fill(page, "money-receipt-reference", reference)
    await page.get_by_test_id("money-save-receipt").click()
    await page.get_by_test_id("money-receipt-dialog").wait_for(state="hidden")


async def shot(page, width: int, name: str):
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def drawn_card(page, testid: str):
    """Bring a card into view and let its object decode and paint, so a shot shows what a person
    sees. `complete` alone is load, not paint: the viewport screenshot caught this card's 1254 px
    wallet as an empty box at 390 until the decode and two frames below were awaited."""
    await page.get_by_test_id(testid).scroll_into_view_if_needed()
    await page.wait_for_function(
        "id => { const img = document.querySelector(`[data-testid=${id}] img[data-artwork]`);"
        " return Boolean(img && img.complete && img.naturalWidth > 0); }",
        arg=testid,
    )
    await page.evaluate(
        """async id => {
          const img = document.querySelector(`[data-testid=${id}] img[data-artwork]`);
          try { await img.decode(); } catch { /* the object appears as soon as it decodes */ }
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }""",
        testid,
    )


async def run_unconnected(browser, width: int, url: str):
    """THE §246 PICTURE. A workspace whose service answers nothing, carrying the old local
    `demo-connected` flags, so every check below measures the provider's answer against a flag
    that used to speak for it."""

    def label(name):
        return f"{width}: {name}"

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(boot(None))

    async def guard(request_route):
        parsed = urlsplit(request_route.request.url)
        if f"{parsed.scheme}://{parsed.netloc}" == origin and not parsed.path.startswith("/api/"):
            await request_route.continue_()
        else:
            await request_route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(12000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        await saved(page, "s.examplesLoaded && s.invoices.length === 24")
        s = await state(page)
        check(
            s["setup"]["payments"] == "pending" and s["setup"]["invoicing"] == "pending",
            label("seeding writes example records and claims no connection"),
        )
        # The flag the four surfaces used to believe. It is planted here on purpose.
        await page.evaluate(
            """key => { const s = JSON.parse(localStorage.getItem(key));
              Object.assign(s.setup, {payments:'demo-connected', invoicing:'demo-connected',
                consentAt:new Date().toISOString()});
              localStorage.setItem(key, JSON.stringify(s)); }""",
            KEY,
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)

        await route(page, "#/admin/connections", "payment-connection")
        await page.wait_for_timeout(600)
        for testid, word in (
            ("payment-connection", "Connect bank"),
            ("wallet-connection", "Set up payments"),
            ("invoicing-connection", "Set up invoicing"),
        ):
            text = await page.get_by_test_id(testid).inner_text()
            check(word in text, label(f"{testid} states its act while the provider says nothing"))
            check("Connected" not in text, label(f"{testid} keeps «Connected» for provider evidence"))
        await shot(page, width, "connections-unconnected")

        await route(page, "#/money/transactions", "money-transactions-page")
        await page.wait_for_timeout(400)
        check(
            await page.get_by_test_id("money-bank-setup-state").count() == 1
            and await page.get_by_test_id("money-bank-open-setup").count() == 1,
            label("bank activity answers with one picture and one Connect bank"),
        )
        check(
            await page.get_by_test_id("money-bank-transaction").count() == 0,
            label("bank activity manufactures no statement rows"),
        )
        await shot(page, width, "transactions-unconnected")

        invoice_id = await page.evaluate("key => JSON.parse(localStorage.getItem(key)).invoices[0].id", KEY)
        await page.evaluate("id => window.location.hash = '#/money/invoices/' + encodeURIComponent(id)", invoice_id)
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible")
        await page.wait_for_timeout(300)
        check(
            await page.get_by_test_id("money-set-up-payments").count() == 1
            and await page.get_by_test_id("money-record-payment").count() == 0
            and await page.get_by_test_id("money-sample-receipt").count() == 0
            and await page.get_by_test_id("money-create-request").count() == 0,
            label("an invoice card offers the single Set up payments door and nothing beside it"),
        )
        await shot(page, width, "invoice-unconnected")

        # AND THE VERIFICATION LINE LIVES BEHIND THE SAME GATE (§246 review, finding 4). A request
        # that reached the service once keeps its `remoteId` for good, so a workspace that later
        # loses its bank posture — an operator's logout, a lapsed authorization, the first paint —
        # stated «Payment verification delayed. Retry the bank check.» directly under «Set up
        # payments» and mounted a live «Check payment» the connection could no longer honour.
        remote_invoice = await page.evaluate(
            """key => { const s = JSON.parse(localStorage.getItem(key));
              s.requests[0].remoteId = s.requests[0].id;
              localStorage.setItem(key, JSON.stringify(s)); return s.requests[0].invoiceId; }""",
            KEY,
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible", timeout=45000)
        await page.evaluate("id => window.location.hash = '#/money/invoices/' + encodeURIComponent(id)", remote_invoice)
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible")
        await page.wait_for_timeout(600)
        check(
            await page.get_by_test_id("money-service-state").count() == 0
            and await page.get_by_test_id("money-retry-verification").count() == 0
            and await page.get_by_test_id("money-set-up-payments").count() == 1,
            label("a request the service already answered states one setup act and no verification line"),
        )

        request_id = await page.evaluate("key => JSON.parse(localStorage.getItem(key)).requests[0].id", KEY)
        await page.evaluate("id => window.location.hash = '#/money/request/' + encodeURIComponent(id)", request_id)
        await page.get_by_test_id("money-payment-preview").wait_for(state="visible")
        check(
            await page.get_by_test_id("money-preview-simulate").count() == 0
            and await page.get_by_test_id("money-preview-set-up-payments").count() == 1,
            label("the buyer preview answers the same way as the invoice card"),
        )
        # A COLLECTOR MARK IS A CLAIM ABOUT AN ACCOUNT (§246 review). The page being shown to the
        # person who pays advertised Yape, Plin and a locally drafted account name while every
        # collector stood at «Set up payments». One act is what it states now.
        check(
            await page.get_by_test_id("money-preview-collectors").count() == 0
            and await page.locator('[data-testid="money-payment-preview"] img').count() == 0,
            label("the buyer preview names a collector only where one answered"),
        )
        await shot(page, width, "preview-unconnected")

        await route(page, "#/money", "money-overview")
        # NOTHING IS FUTURE (FEED-IA §247.8, «also remove future connotation. nothing is future»).
        # Working capital and customer credit are features of this product, and the bank connection
        # is what gates them — so the word, its pill and its state attribute left Cedar. This check
        # stands ahead of the card's own, because it is the one the change is about: on the build
        # of `main` the pill answers here twice, in the working-capital head and on the
        # customer-credit card.
        check(
            await page.get_by_test_id("future-label").count() == 0
            and "Future" not in await page.get_by_test_id("money-overview").inner_text(),
            label("no Future label stands on the Money dashboard"),
        )
        working_capital = page.get_by_test_id("money-working-capital")
        check(
            await working_capital.get_attribute("data-plan-posture") == "setup"
            and await page.get_by_test_id("money-working-capital-open-setup").count() == 1
            and await page.get_by_test_id("advance-open").count() == 0,
            label("the working-capital card names its posture and offers one act"),
        )
        await drawn_card(page, "money-working-capital")
        await shot(page, width, "working-capital-setup")
        check(
            await page.get_by_test_id("money-balance-card").get_attribute("data-bank-posture") == "unavailable",
            label("the balance card states the posture the provider left it in"),
        )
        # A BANK BRAND IS A CLAIM ABOUT AN ACCOUNT (§246 review, finding 5). `state.setup.bank`
        # carries the model default `bbva` on every workspace, so this tile advertised «BBVA» on
        # the same dashboard whose balance card was offering «Connect bank».
        tile = await page.get_by_test_id("money-transactions-card").inner_text()
        check(
            "Bank transactions" in tile
            and all(brand not in tile for brand in ("BBVA", "Interbank", "Scotiabank")),
            label("the Transactions tile names a bank only where the provider answered"),
        )
        await shot(page, width, "overview-unconnected")

        # ── ONE QUESTION PER STEP, AND THE PROVIDER OWNS «CONNECTED» ────────────────────────
        # The planted legacy flag means «this local step is finished», so setup resumes at the
        # step it names — and that step is «Authorization sent», never «connected».
        await route(page, "#/money/setup/payments", "setup-payment-authorized")
        check(
            await page.get_by_test_id("setup-payment-ready").count() == 0,
            label("a stored local flag resumes at Authorization sent, never at connected"),
        )
        await page.get_by_test_id("setup-change-bank").click()
        await page.get_by_test_id("setup-bank-bbva").wait_for(state="visible")
        await page.get_by_test_id("setup-bank-bbva").click()
        await page.get_by_test_id("setup-bank-account").wait_for(state="visible")
        check(
            await page.get_by_test_id("setup-bank-consent").count() == 0,
            label("the account step asks for the account name alone"),
        )
        await fill(page, "setup-bank-account", "Drive receiving account")
        await page.get_by_test_id("setup-defer").click()
        s = await saved(page, "s.setup.payments === 'deferred'")
        check(
            s["setup"]["bankAccountLabel"] == "Drive receiving account",
            label("defer saves receiving-account draft"),
        )
        await page.reload(wait_until="domcontentloaded")
        await route(page, "#/admin/connections/payments", "setup-bank-account")
        check(
            await page.locator('[data-testid="money-setup"][data-presentation="dialog"]').count() == 1,
            label("Settings resumes payment setup in dialog"),
        )
        check(
            await (await field(page, "setup-bank-account")).input_value() == "Drive receiving account",
            label("reload retains setup draft"),
        )
        await (await field(page, "setup-bank-account")).focus()
        for _ in range(6):
            await page.keyboard.press("Tab")
            check(
                await page.evaluate("Boolean(document.activeElement?.closest('[role=dialog]'))"),
                label("setup dialog retains keyboard focus"),
            )
        await shot(page, width, "setup-account-question")
        await page.get_by_test_id("setup-account-continue").click()
        await page.get_by_test_id("setup-connect-sample").wait_for(state="visible")
        check(
            await page.get_by_test_id("setup-bank-account").count() == 0,
            label("consent stands on its own screen, with one act"),
        )
        await shot(page, width, "setup-consent")
        await page.get_by_test_id("setup-connect-sample").click()
        s = await saved(page, "s.setup.payments === 'authorizing'")
        check(bool(s["setup"].get("consentAt")), label("the consent act records consent and waits for the provider"))
        authorized = await page.get_by_test_id("setup-payment-authorized").inner_text()
        check(
            "Prometeo activates this account." in authorized,
            label("a local authorization words itself as sent, never as connected"),
        )
        check(
            await page.get_by_test_id("setup-payment-ready").count() == 0,
            label("«Your account is connected» stays behind the provider's own answer"),
        )
        await shot(page, width, "setup-authorized")
        await page.get_by_test_id("setup-payment-done").click()

        await route(page, "#/money/setup/invoicing", "setup-invoice-authorized")
        check(
            await page.get_by_test_id("setup-invoice-ready").count() == 0,
            label("a stored invoicing flag resumes at Authorization sent, never at ready"),
        )
        await page.get_by_test_id("setup-edit-invoicing").first.click()
        await page.get_by_test_id("setup-seller-name").wait_for(state="visible")
        await expect(page.get_by_test_id("setup-ruc")).to_have_count(0)
        await fill(page, "setup-seller-name", "Drive sample distributor")
        await page.get_by_test_id("setup-seller-continue").click()
        await expect(page.get_by_test_id("setup-seller-name")).to_have_count(0)
        await fill(page, "setup-ruc", "20123456789")
        await page.get_by_test_id("setup-ruc-continue").click()
        await expect(page.get_by_test_id("setup-ruc")).to_have_count(0)
        await fill(page, "setup-invoice-series", "F001")
        check(True, label("invoicing asks for seller name, RUC and series one field at a time"))
        await page.get_by_test_id("setup-review-invoicing").click()
        await page.get_by_test_id("setup-enable-invoice-preview").click()
        s = await saved(page, "s.setup.invoicing === 'authorizing'")
        check(
            "NubeFact activates this account." in await page.get_by_test_id("setup-invoice-authorized").inner_text()
            and await page.get_by_test_id("setup-invoice-ready").count() == 0,
            label("invoice authorization is worded as sent, and the provider owns the ready step"),
        )
        await shot(page, width, "setup-invoice-authorized")
        await route(page, "#/admin/connections", "payment-connection")
        await page.wait_for_timeout(600)
        check(
            "Connect bank" in await page.get_by_test_id("payment-connection").inner_text()
            and "Set up invoicing" in await page.get_by_test_id("invoicing-connection").inner_text(),
            label("a completed local walk moves no Connections card"),
        )
        check(not errors, label(f"the unconnected posture runs without browser exceptions: {errors}"))
    except Exception as error:
        FAILURES.append(label(f"unconnected · {type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "unconnected-failure")
        (OUT / f"{width}-unconnected-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


async def run_viewport(browser, width: int, url: str):
    def label(name):
        return f"{width}: {name}"

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    service = Collections(origin)
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.grant_permissions(["clipboard-read", "clipboard-write"], origin=origin)
    await context.add_init_script(boot(origin))
    blocked = []

    async def network_guard(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if same_origin and parsed.path.startswith("/api/cedar/"):
            assert request.headers.get("authorization") == f"Bearer {TOKEN}"
            value = service.answer(request.method, parsed.path, request.post_data_json)
            if value is None:
                blocked.append({"method": request.method, "url": request.url})
                await request_route.fulfill(status=404, content_type="application/json", body='{"detail":"fixture"}')
            else:
                await request_route.fulfill(content_type="application/json", body=json.dumps(value))
        elif not same_origin or parsed.path.startswith("/api/"):
            blocked.append({"method": request.method, "url": request.url})
            await request_route.fulfill(
                status=503, content_type="application/json", body='{"error":"isolated_drive"}'
            )
        else:
            await request_route.continue_()

    await context.route("**/*", network_guard)
    page = await context.new_page()
    page.set_default_timeout(12000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        s = await saved(page, "s.examplesLoaded && s.invoices.length === 24")
        check(
            len(s["invoices"]) == 24 and len({i["saleId"] for i in s["invoices"]}) == 24,
            label("retained scenario seeds 24 distinct delivery-note invoices"),
        )
        check(
            s["setup"]["payments"] == "pending" and s["setup"]["invoicing"] == "pending",
            label("sample invoices preserve pending setup"),
        )
        await expect(page.get_by_test_id("money-balance-card")).to_have_attribute("data-bank-posture", "ready")
        check(
            "BBVA" in await page.get_by_test_id("money-transactions-card").inner_text(),
            label("the Transactions tile names the provider's own bank once it answered"),
        )
        await shot(page, width, "dashboard-initial")

        # THE CONNECTED WORKSPACE OPENS AT ITS PROVIDER'S OWN ANSWER (FEED-IA §247.2). Money setup
        # reaches «Your account is connected» because Prometeo says the account is authorized, and
        # it prints the account the service named rather than the words a person typed.
        await route(page, "#/money/setup/payments", "setup-payment-ready")
        ready_text = await page.get_by_test_id("setup-payment-ready").inner_text()
        check(
            ACCOUNT["account_label"] in ready_text and ACCOUNT["account_mask"] in ready_text,
            label("connected setup states the provider's own account and mask"),
        )
        await shot(page, width, "setup-connected")
        await route(page, "#/money/setup/invoicing", "setup-invoice-ready")
        check(True, label("a configured NubeFact account opens invoicing setup at its ready step"))
        s = await state(page)

        # Find an existing delivery note through the Sales surface, outside seeded invoices.
        await page.evaluate("window.location.hash = '#/sales'")
        await page.locator('[data-testid^="open-"][data-feed-row]').first.wait_for(state="visible")
        sale_ids = await page.locator('[data-testid^="open-"][data-feed-row]').evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('data-feed-row'))"
        )
        existing = {invoice["saleId"] for invoice in s["invoices"]}
        candidates = [sale_id for sale_id in sale_ids if sale_id not in existing]
        chosen = None
        for sale_id in candidates:
            await page.evaluate("id => window.location.hash = '#/sales/' + encodeURIComponent(id)", sale_id)
            try:
                await page.get_by_test_id("money-issue-invoice").wait_for(state="visible", timeout=2500)
                chosen = sale_id
                break
            except Exception:
                continue
        check(bool(chosen), label("existing Delivery Note offers payment preparation before fiscal issuance"))
        count = len(s["invoices"])
        await page.get_by_test_id("money-issue-invoice").click()
        await fill(page, "money-issue-address", "Av. Peru 123, Lima")
        await page.get_by_test_id("money-confirm-issue").click()
        s = await saved(page, f"s.invoices.length === {count + 1}")
        invoice = next(i for i in s["invoices"] if i["saleId"] == chosen)
        frozen = json.dumps(invoice, sort_keys=True)
        total = invoice["amountMinor"]
        check(
            invoice["sourceCurrency"] == "PEN" and invoice["currency"] == "PEN" and invoice["fxRate"] == 1,
            label("billing preparation preserves the native PEN source amount"),
        )
        check(
            abs(total - invoice["sourceTotal"] * 100) <= 0.5
            and sum(line["amountMinor"] for line in invoice["lines"]) == total,
            label("frozen invoice lines reconcile to the native total"),
        )
        await page.get_by_test_id("delivery-note-invoice-link").click()
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible")
        note_href = await page.get_by_test_id("money-source-note").get_attribute("href")
        check(note_href == f"#/sales/{chosen}", label("invoice links to its exact source delivery note"))
        invoice_hash = f"#/money/invoices/{invoice['id']}"
        await expect(page.get_by_test_id("money-source-amount")).to_contain_text("S/")
        await expect(page.get_by_test_id("money-fx-rate")).to_have_count(0)
        due = date.fromisoformat(invoice["dueAt"])
        month_label = "Sept" if due.month == 9 else due.strftime("%b")
        expected_due = f"{due.day} {month_label} {due.year}"
        await expect(
            page.get_by_test_id("money-invoice-detail").locator(f'time[datetime="{invoice["dueAt"]}"]')
        ).to_have_text(expected_due)
        check(True, label("Lima timezone preserves invoice due calendar date"))

        check(
            invoice["status"] == "draft" and invoice["origin"] == "cedar" and not invoice.get("fiscal"),
            label("payment request precedes fiscal acceptance"),
        )
        s = await state(page)
        request = next(r for r in reversed(s["requests"]) if r["invoiceId"] == invoice["id"])
        # The connected request carries the SERVICE's buyer link; Cedar's own preview page is
        # reached by the request identity, so the drive walks it by id.
        old_request_hash = f"#/money/request/{request['id']}"
        check(
            request["url"].startswith(origin + "/collect/") and request.get("remoteId") == request["id"],
            label("a connected request carries the service's own buyer link"),
        )
        check(
            request["amountMinor"] == total and request["status"] == "created",
            label("request starts at invoice balance"),
        )
        await page.get_by_test_id("money-copy-request").click()
        s = await saved(page, f"s.requests.find(r => r.id === {json.dumps(request['id'])}).copiedAt")
        copied = next(r for r in s["requests"] if r["id"] == request["id"])
        check(
            copied["status"] == "copied" and not copied.get("sentAt"),
            label("copy records copied action independently from sent"),
        )
        check(
            await page.evaluate("navigator.clipboard.readText()") == request["url"],
            label("copy writes exact request link to clipboard"),
        )
        await page.get_by_test_id("money-record-sent").click()
        await saved(page, f"s.requests.find(r => r.id === {json.dumps(request['id'])}).sentAt")
        check(True, label("Record as sent records explicit operator action"))

        partial = total // 3
        reference = f"DRIVE-PARTIAL-{width}"
        await record(page, partial, reference)
        s = await state(page)
        remaining = total - partial
        check(
            balance(s, invoice) == remaining
            and next(i for i in s["invoices"] if i["id"] == invoice["id"])["status"] == "draft",
            label("partial receipt reduces balance while fiscal issuance remains pending"),
        )
        await expect(page.get_by_test_id("money-copy-request")).to_be_disabled()
        await expect(page.get_by_test_id("money-record-sent")).to_be_disabled()
        check(True, label("stale request requires refresh before copy or record-sent"))
        await route(page, old_request_hash, "money-payment-preview")
        await expect(page.get_by_test_id("money-preview-current-balance")).to_have_text(
            await money_text(page, remaining)
        )
        await expect(page.get_by_test_id("money-preview-original-amount")).to_contain_text(
            await money_text(page, total)
        )
        check(True, label("old buyer request leads current balance and explains original amount"))
        # The connected preview takes its account line from the provider, and the wallet marks wait
        # for a collector of their own: this fixture's snapshot states no `wallets`.
        collectors = await page.get_by_test_id("money-preview-collectors").inner_text()
        check(
            ACCOUNT["account_label"] in collectors
            and await page.locator('[data-testid="money-payment-preview"] img').count() == 0,
            label("the connected preview reads the provider's own account and waits for a collector"),
        )
        await shot(page, width, "partial-buyer-preview")
        await route(page, invoice_hash, "money-invoice-detail")
        await page.get_by_test_id("money-update-request").click()
        s = await state(page)
        refreshed = next(r for r in reversed(s["requests"]) if r["invoiceId"] == invoice["id"])
        check(
            refreshed["id"] != request["id"] and refreshed["amountMinor"] == remaining,
            label("refresh creates a request for remaining balance"),
        )
        receipt_count = len(s["receipts"])
        await record(page, partial, reference)
        s = await state(page)
        check(
            len(s["receipts"]) == receipt_count and balance(s, invoice) == remaining,
            label("duplicate receipt reference preserves balance and history count"),
        )
        await record(page, remaining + 1, f"DRIVE-REVIEW-{width}")
        s = await state(page)
        check(
            s["receipts"][-1]["status"] == "review" and balance(s, invoice) == remaining,
            label("overpayment goes to review and leaves outstanding unchanged"),
        )
        await shot(page, width, "invoice-partial")
        await route(page, old_request_hash, "money-payment-preview")
        await page.get_by_text("Payment actions", exact=True).click()
        await page.get_by_test_id("money-preview-simulate").click()
        await expect(page.get_by_test_id("money-preview-current-balance")).to_have_text(
            await money_text(page, 0)
        )
        await expect(page.get_by_test_id("money-preview-simulate")).to_be_disabled()
        s = await state(page)
        check(
            s["receipts"][-1]["amountMinor"] == remaining
            and s["receipts"][-1]["source"] == "demo-bank"
            and balance(s, invoice) == 0,
            label("old request simulates only current remaining amount and then disables"),
        )
        await route(page, invoice_hash, "money-invoice-detail")
        await page.get_by_test_id("money-source-note").click()
        await page.get_by_test_id("delivery-note-money").wait_for(state="visible")
        await expect(page.get_by_test_id("delivery-note-money")).to_contain_text("Paid")
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("delivery-note-invoice-link").wait_for(state="visible")
        s = await state(page)
        check(
            balance(s, invoice) == 0
            and json.dumps(next(i for i in s["invoices"] if i["id"] == invoice["id"]), sort_keys=True)
            == frozen,
            label("reload preserves settlement and frozen invoice snapshot"),
        )

        await route(page, "#/money/payments", "money-tab-payments")
        await page.get_by_test_id("money-filter").select_option("review")
        check(
            await page.get_by_test_id("money-payment-row").count() == 1,
            label("payment review filter isolates the unmatched receipt"),
        )
        await fill(page, "money-search", f"DRIVE-REVIEW-{width}")
        await page.get_by_test_id("money-payment-row").click()
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible")
        if width < 700:
            await page.get_by_test_id("money-detail-back").click()
            await page.get_by_test_id("money-payment-row").wait_for(state="visible")
            check(True, label("phone detail back restores filtered payment list"))

        # ── ONE WITNESS FOR «IS THE BANK CONNECTED» (FEED-IA §247.2) ────────────────────────
        await route(page, "#/admin/connections", "payment-connection")
        await page.wait_for_timeout(600)
        card_text = await page.get_by_test_id("payment-connection").inner_text()
        check("Connected" in card_text, label("the Bank card reads Connected from the provider"))
        check(
            ACCOUNT["account_label"] in card_text,
            label("the Bank card names the account the provider returned"),
        )
        wallet_text = await page.get_by_test_id("wallet-connection").inner_text()
        check(
            "Set up payments" in wallet_text and "Connected" not in wallet_text,
            label("an authorized bank leaves Yape & Plin at its own posture"),
        )
        check(
            "Connected" in await page.get_by_test_id("invoicing-connection").inner_text(),
            label("Electronic invoices reads Connected from the same NubeFact record the invoice reads"),
        )
        await shot(page, width, "connections-connected")
        await route(page, "#/money", "money-overview")
        check(
            await page.get_by_test_id("money-balance-card").get_attribute("data-bank-posture") == "ready",
            label("the Money balance and the Connections card answer from one witness"),
        )
        check(
            await page.get_by_test_id("money-bank-balance").get_attribute("data-amount-minor")
            == str(ACCOUNT["balance_minor"]),
            label("the balance card prints the provider's own figure"),
        )
        check(
            await page.get_by_test_id("money-bank-monitor").get_attribute("data-monitor") == "scheduled",
            label("every parsed bank-monitor state is a state the card can read"),
        )
        await route(page, "#/money/transactions", "money-transactions-page")
        check(
            await page.get_by_test_id("money-bank-setup-state").count() == 0,
            label("a connected workspace reads its provider's transactions"),
        )
        await route(page, "#/money", "money-overview")
        credit_card = await page.get_by_test_id("money-credit-card").inner_text()
        check(
            "Unpaid orders" in credit_card and "repayment" not in credit_card.lower(),
            label("the unpaid-orders card names its own outstanding money"),
        )
        await page.get_by_test_id("money-credit-card").click()
        await page.get_by_test_id("credit-sort-amount").click()
        amounts = await page.locator('[data-testid^="credit-customer-"]').evaluate_all(
            "nodes => nodes.map(n => Number(n.dataset.amountMinor))"
        )
        check(
            len(amounts) > 0 and amounts == sorted(amounts, reverse=True),
            label("customer credit sorts by actual outstanding amount"),
        )
        credit_rows = await page.locator('[data-testid^="credit-customer-"]').evaluate_all(
            "nodes => nodes.map(n => ({status: n.dataset.status, text: n.innerText}))"
        )
        check(
            len(credit_rows) > 0 and all(row["status"] in STATUS_WORDS for row in credit_rows),
            label("every customer-credit row holds a state from the one table"),
        )
        check(
            all(STATUS_WORDS[row["status"]] in row["text"] for row in credit_rows),
            label("every customer-credit row prints the word its state names"),
        )
        check(
            await page.get_by_test_id("future-label").count() == 0
            and "Future" not in await page.get_by_test_id("money-credit").inner_text(),
            label("no Future label stands on the credit page"),
        )
        await shot(page, width, "credit-page")
        # The customer sheet's own Credit block, through the door a person actually takes.
        await page.locator('[data-testid^="credit-customer-"]').first.click()
        await page.get_by_test_id("customer-credit").wait_for(state="visible")
        check(
            await page.get_by_test_id("future-label").count() == 0
            and "Future" not in await page.get_by_test_id("customer-credit").inner_text(),
            label("no Future label stands on the customer sheet's Credit block"),
        )
        await page.get_by_test_id("customer-credit").scroll_into_view_if_needed()
        await shot(page, width, "customer-credit")
        await route(page, "#/money", "money-overview")
        check(
            await page.get_by_test_id("future-label").count() == 0
            and "Future" not in await page.get_by_test_id("money-overview").inner_text(),
            label("no Future label stands on the connected Money dashboard"),
        )
        # The two cards the pill stood on, at the size a person reads them.
        await drawn_card(page, "money-working-capital")
        await shot(page, width, "dashboard-features")
        await page.get_by_test_id("money-working-capital").screenshot(
            path=str(OUT / f"{width}-working-capital-card.png")
        )
        # ── THE ADVANCE, OFFERED AND GRANTED (FEED-IA §249, «just like in monzo») ──────────
        # ⚠ 14 September 2026 — RETARGETED. The card used to state one fixed S/ 1,000 principal
        # and its act read «Choose repayment plan». The offer is now the amount this workspace's
        # own book makes available (`advanceLimitOf`), the act is «Get advance», and the grant
        # carries an amount, a purpose and a repayment authorization. `advance-confirm`,
        # `advance-details`, `advance-record-repayment` and `advance-reset` keep their names;
        # `advance-outstanding` moved into the repayment details, so it is read with them open,
        # and the accepted plan this block walks is three payments on S/ 5,000 rather than six on
        # S/ 1,000.
        offer = await page.get_by_test_id("advance-offer").inner_text()
        available = await page.get_by_test_id("advance-available").get_attribute("data-amount-minor")
        check(
            available == "2000000" and await money_text(page, 2000000) in offer and "available" in offer,
            label(f"the offered card states what the book makes available · {available}"),
        )
        check(
            "From your last four weeks of sales. Repaid from incoming payments." in offer,
            label("the offered card names the basis in one sentence"),
        )
        await expect(page.get_by_test_id("advance-open")).to_have_text("Get advance")
        await page.get_by_test_id("advance-open").click()
        await page.get_by_test_id("advance-dialog").wait_for(state="visible")
        # The popup as a person first meets it, after its 400 ms entrance settles: hero, then
        # title, then the choices, then one action.
        await page.wait_for_timeout(600)
        await shot(page, width, "advance-opened")
        check(
            await page.get_by_test_id("advance-amount").count() == 1
            and await page.get_by_test_id("advance-amount-input").count() == 1,
            label("Pay over time takes the amount on a slider with the figure beside it"),
        )
        for count in (1, 3, 6):
            await page.get_by_test_id(f"advance-radio-{count}").check()
            rows = (
                await page.get_by_test_id("advance-timeline")
                .locator("li")
                .evaluate_all(
                    "nodes => nodes.map(n => ({amount:Number(n.dataset.amountMinor), due:n.dataset.dueAt}))"
                )
            )
            check(
                len(rows) == count
                and sum(row["amount"] for row in rows) == 100000 + {1: 0, 3: 500, 6: 900}[count]
                and [row["due"] for row in rows] == sorted(row["due"] for row in rows),
                label(f"{count} repayment option reconciles principal, total interest and dates"),
            )
        # THE HERO AND THE OFFER'S OWN WORDS (FEED-IA §247.6). Uber's modal anatomy is image,
        # title, body, one action; and an offer nobody has accepted may carry no schedule.
        hero = page.get_by_test_id("hero-working-capital")
        check(await hero.count() == 1, label("working-capital popup mounts one hero slot"))
        check(
            await hero.get_attribute("data-hero-source") == "/cedar-artwork/hero-working-capital.png",
            label("hero slot names the installed hero file"),
        )
        # THE HERO'S OWN DEBT, NAMED (hero review, 11 September). While the picture has yet to be
        # generated the slot may report `pending`, and the check says so in its own name. The
        # moment the file is installed the second check below requires it to be drawn and served.
        hero_state = await hero.get_attribute("data-hero-state")
        hero_installed = (DIST / "cedar-artwork/hero-working-capital.png").exists() or (
            Path("app/public/cedar-artwork/hero-working-capital.png").exists()
        )
        check(
            hero_state in {"drawn", "pending"},
            label(
                "hero slot reports its own state · "
                + str(hero_state)
                + ("" if hero_installed else " · GENERATION OWED")
            ),
        )
        if hero_installed:
            hero_status = await page.evaluate(
                "src => fetch(src, {cache:'no-store'}).then(response => response.status)",
                await hero.get_attribute("data-hero-source"),
            )
            check(
                hero_state == "drawn" and hero_status == 200,
                label(f"the installed hero is drawn and served · {hero_status}"),
            )
        check(
            await page.evaluate(
                "() => { const dialog = document.querySelector('[data-testid=advance-dialog]');"
                " const art = dialog.querySelector('[data-hero]');"
                " const title = [...dialog.querySelectorAll('h3')].find(n => n.textContent.trim() === 'Working capital');"
                " return Boolean(art && title && (art.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)); }"
            ),
            label("hero sits above the popup title"),
        )
        check(
            await page.evaluate(
                "() => { const dialog = document.querySelector('[data-testid=advance-dialog]');"
                " const art = dialog.querySelector('[data-hero]');"
                " return Math.abs(art.getBoundingClientRect().width - dialog.getBoundingClientRect().width) <= 1; }"
            ),
            label("hero runs the full width of the popup"),
        )
        offer_rows = await page.get_by_test_id("advance-timeline").locator("li").evaluate_all(
            "nodes => nodes.map(n => ({status: n.dataset.status, text: n.innerText}))"
        )
        check(
            len(offer_rows) == 6 and all(row["status"] == "offered" for row in offer_rows),
            label("every row of an unaccepted offer holds the offer state"),
        )
        check(
            all(STATUS_WORDS[row["status"]] in row["text"] for row in offer_rows),
            label("every offer row prints the word its state names"),
        )
        popup_text = await page.get_by_test_id("advance-dialog").inner_text()
        check(
            "Scheduled" not in popup_text,
            label("the working-capital popup carries no Scheduled state"),
        )
        await shot(page, width, "advance-options")

        # THE AMOUNT: the slider moves the figure and the figure moves the slider, both on the
        # S/ 100 grain the plan is built on.
        thumb = page.get_by_test_id("advance-amount-thumb")
        await thumb.focus()
        await page.keyboard.press("ArrowRight")
        await page.keyboard.press("ArrowRight")
        stepped = await page.get_by_test_id("advance-principal").get_attribute("data-amount-minor")
        check(stepped == "120000", label(f"the slider moves the advance in S/ 100 steps · {stepped}"))
        await fill(page, "advance-amount-input", "5000")
        await expect(thumb).to_have_attribute("aria-valuenow", "500000")
        slid = await page.get_by_test_id("advance-principal").get_attribute("data-amount-minor")
        check(slid == "500000", label(f"the figure beside the slider carries the amount · {slid}"))
        await page.get_by_test_id("advance-radio-3").check()
        chosen_rows = await page.get_by_test_id("advance-timeline").locator("li").evaluate_all(
            "nodes => nodes.map(n => Number(n.dataset.amountMinor))"
        )
        check(
            chosen_rows == [167500, 167500, 167500],
            label(f"three payments on S/ 5,000 reconcile principal and interest · {chosen_rows}"),
        )
        check(
            await money_text(page, 502500) in await page.get_by_test_id("advance-total").inner_text(),
            label("the popup states the total repayment of the amount chosen"),
        )
        await page.get_by_test_id("advance-purpose-prebuy").click()
        await expect(page.get_by_test_id("advance-purpose-prebuy")).to_have_attribute("aria-pressed", "true")
        check(
            await page.get_by_test_id("advance-confirm").is_disabled(),
            label("the grant waits for the repayment authorization"),
        )
        await checkbox(page, "advance-consent")
        await expect(page.get_by_test_id("advance-confirm")).to_have_text("Get advance")
        # The choice's own 400 ms settles before the shot, so the picture shows what a person sees.
        await page.wait_for_timeout(600)
        await shot(page, width, "advance-chosen")
        await page.get_by_test_id("advance-confirm").click()
        await page.get_by_test_id("advance-dialog").wait_for(state="hidden")

        # THE GRANT, ON THE SPOT: the card reads what was granted, the next payment and what is
        # still available, and the record carries the consent the BaaS rules ask for.
        plan = await page.evaluate("key => JSON.parse(localStorage.getItem(key))", ADVANCE_KEY)
        check(
            plan["version"] == 3
            and plan["principalMinor"] == 500000
            and plan["count"] == 3
            and plan["purpose"] == "prebuy"
            and plan["limitMinor"] == 2000000
            and bool(plan["consentAt"]),
            label("the grant is saved with its amount, plan, purpose, consent and limit"),
        )
        granted = await page.get_by_test_id("advance-existing").inner_text()
        await expect(page.get_by_test_id("advance-granted")).to_have_attribute("data-amount-minor", "500000")
        check(
            await money_text(page, 500000) in granted and "granted" in granted,
            label("the card reads the advance it granted"),
        )
        await expect(page.get_by_test_id("advance-available")).to_have_attribute("data-amount-minor", "1500000")
        check(
            await money_text(page, 1500000) in granted and "still available" in granted,
            label("the card states what the limit still holds"),
        )
        await expect(page.get_by_test_id("advance-status")).to_have_text("Repaying")
        await expect(page.get_by_test_id("advance-next")).to_contain_text(STATUS_WORDS["upcoming"] + " · ")
        check(True, label("the card leads with the next payment's own state · Upcoming before its date"))
        await drawn_card(page, "money-working-capital")
        await shot(page, width, "advance-granted")
        await page.get_by_test_id("advance-details").click()
        consent_line = await page.get_by_test_id("advance-consent-record").inner_text()
        check(
            "Pre-buy" in consent_line and "authorized" in consent_line,
            label(f"the repayment details carry the purpose and the day it was authorized · {consent_line}"),
        )
        await page.get_by_test_id("advance-record-repayment").click()
        repaid_once = await page.evaluate("key => JSON.parse(localStorage.getItem(key))", ADVANCE_KEY)
        check(
            repaid_once["count"] == 3 and repaid_once["paidCount"] == 1,
            label("sample repayment advances saved plan once"),
        )
        accepted_rows = await page.get_by_test_id("advance-timeline").locator("li").evaluate_all(
            "nodes => nodes.map(n => ({status: n.dataset.status, text: n.innerText}))"
        )
        check(
            [row["status"] for row in accepted_rows] == ["paid", "upcoming", "upcoming"],
            label("an accepted plan reads Paid and Upcoming while every date is still ahead"),
        )
        check(
            all(STATUS_WORDS[row["status"]] in row["text"] for row in accepted_rows),
            label("every accepted row prints the word its state names"),
        )
        await shot(page, width, "advance-repaying")
        # THE WIDEST HEADER THE CARD EVER DRAWS is the repaying one — the amount, the next
        # payment's word and its date — so the narrow reading is taken here as well as at Repaid.
        repaying_geometry = await page.get_by_test_id("money-overview").evaluate(
            """el => ({scroll:el.scrollWidth, client:el.clientWidth, right:el.getBoundingClientRect().right, viewport:innerWidth,
              over:[...el.querySelectorAll('*')].filter(n=>n.scrollWidth > n.clientWidth + 1 && n.clientWidth > 0)
                .slice(0,5).map(n=>`${n.tagName}.${n.dataset.testid||''}:${n.scrollWidth}/${n.clientWidth}:${n.textContent.slice(0,30)}`)})"""
        )
        check(
            repaying_geometry["scroll"] <= repaying_geometry["client"] + 1
            and repaying_geometry["right"] <= repaying_geometry["viewport"] + 1,
            label(f"Money dashboard fits viewport width in the Repaying state {repaying_geometry['over']}"),
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible")
        await page.get_by_test_id("money-credit-card").click()
        await expect(page.get_by_test_id("credit-sort-amount")).to_have_attribute("aria-pressed", "true")
        await route(page, "#/money", "money-overview")
        # ⚠ 14 September 2026 — RETARGETED (FEED-IA §249). The card's own heading is the advance
        # that was granted, so what is still to repay reads inside the repayment details.
        await page.get_by_test_id("advance-details").click()
        await expect(page.get_by_test_id("advance-outstanding")).to_have_text(
            await money_text(page, sum(row["amountMinor"] for row in plan["installments"][1:]))
        )
        check(True, label("credit sort and advance repayment survive reload"))
        for _ in range(2):
            await page.get_by_test_id("advance-record-repayment").click()
        await expect(page.get_by_test_id("advance-status")).to_have_text("Repaid")
        await expect(page.get_by_test_id("advance-complete")).to_have_text("Repaid")
        settled = await page.get_by_test_id("advance-timeline").locator("li").evaluate_all(
            "nodes => nodes.map(n => n.dataset.status)"
        )
        check(
            settled == ["paid"] * 3,
            label("a settled plan holds one word for every row"),
        )
        await expect(page.get_by_test_id("advance-next")).to_have_text("3 of 3 paid")
        check(True, label("a settled plan reads Repaid once and not two ways"))
        # ON-TIME REPAYMENT RAISES THE LIMIT (FEED-IA §249, the Monzo behaviour): the ceiling
        # moves with the record, and the card states the amount it moved to.
        await expect(page.get_by_test_id("advance-limit-rose")).to_contain_text(await money_text(page, 2200000))
        await expect(page.get_by_test_id("advance-available")).to_have_attribute("data-amount-minor", "2200000")
        check(True, label("a plan repaid on time raises the limit to S/ 22,000"))
        await page.wait_for_timeout(600)
        await shot(page, width, "advance-repaid")
        # THE ROUTE THAT CARRIES AN AMOUNT (FEED-IA §249): the campaigns' pre-buy card, the
        # cash-crunch line and the 72 h chase all take `#/money/advance/<minor>`, which opens Pay
        # over time on that amount and returns the hash so Back leaves the dashboard behind.
        await page.get_by_test_id("advance-reset").click()
        await page.get_by_test_id("advance-offer").wait_for(state="visible")
        await route(page, "#/money/advance/500000", "advance-dialog")
        await expect(page.get_by_test_id("advance-dialog")).to_have_attribute("data-prefilled-minor", "500000")
        await expect(page.get_by_test_id("advance-principal")).to_have_attribute("data-amount-minor", "500000")
        landed = await page.evaluate("() => window.location.hash")
        check(landed == "#/money", label(f"the amount-carrying route opens Pay over time and returns the hash · {landed}"))
        # The sheet's own 400 ms entrance settles before the shot.
        await page.wait_for_timeout(600)
        await shot(page, width, "advance-prefilled")
        await page.get_by_test_id("workflow-close").click()
        await page.get_by_test_id("advance-dialog").wait_for(state="hidden")
        await page.get_by_test_id("advance-offer").wait_for(state="visible")
        geometry = await page.get_by_test_id("money-overview").evaluate(
            "el => ({scroll:el.scrollWidth, client:el.clientWidth, right:el.getBoundingClientRect().right, viewport:innerWidth})"
        )
        check(
            geometry["scroll"] <= geometry["client"] + 1 and geometry["right"] <= geometry["viewport"] + 1,
            label("Money dashboard fits viewport width"),
        )
        await shot(page, width, "dashboard-final")
        check(not errors, label(f"Money lifecycle runs without browser exceptions: {errors}"))
        (OUT / f"{width}-network-blocks.json").write_text(json.dumps(blocked, indent=2))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "failure")
        (OUT / f"{width}-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


async def run_chase(browser, width: int, url: str):
    """UNPAID ORDERS, CHASE NOW AND THE AUTO-CHASE TIMER (FEED-IA §249, brief A).

    The same connected fixture as `run_viewport`, plus Playwright's own clock, because the whole
    point of the timer is what happens after twelve hours. The block walks the demo: the credit
    page is the list of unpaid ORDERS, one card each, counted against the stored ledger; **Chase
    now** opens the send with its rung, its words and its payment link; **Send** puts that text in
    the customer's conversation and records the request as sent; **Auto-chase** at 12 h fires the
    second rung on its own, and the third flags the card and offers the advance.
    """

    def label(name):
        return f"{width}: {name}"

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    service = Collections(origin)
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(boot(origin))
    # The clock is installed before the first script runs and then resumed, so the app behaves
    # exactly as it does on a real device until the drive jumps forward deliberately.
    await context.clock.install()
    await context.clock.resume()

    async def chase_routes(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if same_origin and parsed.path.startswith("/api/cedar/"):
            value = service.answer(request.method, parsed.path, request.post_data_json)
            if value is None:
                await request_route.fulfill(status=404, content_type="application/json", body='{"detail":"fixture"}')
            else:
                await request_route.fulfill(content_type="application/json", body=json.dumps(value))
        elif not same_origin or parsed.path.startswith("/api/"):
            await request_route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')
        else:
            await request_route.continue_()

    await context.route("**/*", chase_routes)
    page = await context.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    async def chase_state(invoice_id: str):
        return await page.evaluate(
            "([key, id]) => { const b = JSON.parse(localStorage.getItem(key) || 'null');"
            " return b && b.records ? b.records[id] || null : null; }",
            [CHASE_KEY, invoice_id],
        )

    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        await route(page, "#/money/credit", "money-credit")
        # THE RED-FIRST ASSERTION. On the build this branch started from, Money → Customer credit
        # ranks customers and offers no act at all, so this wait is the whole of «the surface is
        # absent there»; on this branch every unpaid order carries its own Chase now.
        standing = True
        try:
            await page.locator('[data-testid^="chase-now-"]').first.wait_for(state="visible", timeout=30000)
        except Exception:
            standing = False
        check(standing, label("every unpaid order carries its own Chase now"))
        # `run_viewport` pins the seed's own count; this block only needs the ledger it lists.
        s = await saved(page, "s.examplesLoaded && s.invoices.length > 0")
        head = await page.get_by_test_id("money-credit").inner_text()
        check("Unpaid orders" in head and "Customer credit" in head,
              label("the credit page is headed Unpaid orders over Customer credit"))

        # ONE CARD PER UNPAID ORDER, counted against the ledger the browser is holding.
        unpaid = [
            invoice for invoice in s["invoices"]
            if invoice["currency"] == "PEN" and invoice["customerId"]
            and (invoice["status"] == "accepted" or (invoice["origin"] == "cedar" and invoice["status"] == "draft"))
            and balance(s, invoice) > 0
        ]
        cards = await page.locator('[data-testid^="unpaid-card-"]').evaluate_all(
            "nodes => nodes.map(n => ({id: n.dataset.testid || n.getAttribute('data-testid'),"
            " status: n.dataset.status, step: n.dataset.step, auto: n.dataset.auto,"
            " amount: Number(n.dataset.amountMinor), text: n.innerText}))"
        )
        check(len(cards) == len(unpaid) and len(cards) > 0,
              label(f"one card per unpaid order · {len(cards)} cards for {len(unpaid)} unpaid invoices"))
        owed = sum(balance(s, invoice) for invoice in unpaid)
        check(sum(row["amount"] for row in cards) == owed,
              label("the cards' amounts sum to the outstanding balance"))
        await expect(page.get_by_test_id("credit-total")).to_have_text(await money_text(page, owed))
        # Peter's three words for an order's collection state (§249), each read off its own card.
        words = {"due": "Unpaid", "overdue": "Unpaid", "part-paid": "Part paid",
                 "requested": "Payment link sent", "paid": "Paid"}
        check(all(row["status"] in STATUS_WORDS for row in cards),
              label("every unpaid card holds a state from the one table"))
        check(all(words[row["status"]] in row["text"] for row in cards),
              label("every unpaid card prints Unpaid, Part paid or Payment link sent"))
        check(all(row["step"] == "1" and row["auto"] == "off" for row in cards),
              label("an unchased order stands at step 1 with its timer off"))
        await shot(page, width, "unpaid-orders")

        # THE ONE THE DEMO CHASES: the most overdue order the sort puts first.
        card = page.locator('[data-testid^="unpaid-card-"]').first
        invoice_id = (await card.get_attribute("data-testid"))[len("unpaid-card-"):]
        invoice = next(row for row in s["invoices"] if row["id"] == invoice_id)
        customer_id = invoice["customerId"]
        owed_here = balance(s, invoice)

        await page.get_by_test_id(f"chase-now-{invoice_id}").click()
        await page.get_by_test_id("chase-dialog").wait_for(state="visible")
        await page.wait_for_timeout(600)
        dialog = await page.get_by_test_id("chase-dialog").inner_text()
        check("Chase now" in dialog and "Reminder 1 of 3 · softer" in dialog,
              label("Chase now opens on the first rung and says which rung it is"))
        await expect(page.get_by_test_id("chase-link")).to_be_visible()
        channel = await page.get_by_test_id("chase-channel").inner_text()
        check(channel.split(" · ")[0] in {"WhatsApp", "Phone", "Email", "Portal", "In person"},
              label(f"the dialog names the account's own channel · {channel}"))
        written = await page.get_by_test_id("chase-message").input_value()
        amount_text = await money_text(page, owed_here)
        check(invoice["customerName"] in written and invoice["number"] in written
              and amount_text in written and "Pay here:" in written,
              label("the softer reminder names the customer, the order, the amount and the link"))
        check("late fee" not in written, label("the first rung carries no fee sentence"))
        await shot(page, width, "chase-dialog")

        await page.get_by_test_id("chase-send").click()
        await page.get_by_test_id("chase-dialog").wait_for(state="hidden")
        await expect(card).to_have_attribute("data-step", "2")
        status = await page.get_by_test_id(f"chase-status-{invoice_id}").inner_text()
        check(status.startswith("Chased "), label(f"the card states when it was chased · {status}"))
        record = await chase_state(invoice_id)
        check(record and len(record["sends"]) == 1 and record["sends"][0]["step"] == 1,
              label("one send is recorded, on the first rung"))
        sent = await saved(page, f"s.requests.some(r => r.invoiceId === {json.dumps(invoice_id)} && r.status === 'sent')")
        link = next(r for r in sent["requests"] if r["invoiceId"] == invoice_id)
        check(link["status"] == "sent" and bool(link["sentAt"]),
              label("the payment request reads Payment link sent"))
        await shot(page, width, "chased-once")

        # THE CONVERSATION IS THE RECORD. The text a person approved is in that customer's thread.
        launcher = page.get_by_test_id("chats-launcher")
        await launcher.first.click()
        overlay = page.locator("[data-testid=chats-overlay]:not([inert])").first
        await overlay.wait_for(state="visible")
        thread = overlay.locator(f"[data-testid=thread-{customer_id}]").first
        await thread.click()
        await overlay.locator(f"[data-testid=thread-view][data-thread-open={customer_id}]").wait_for()
        # The turn's own entrance is 400 ms and it runs on the clock this block installed, so the
        # shot is taken after that clock has actually been run for it.
        said = overlay.locator("[data-testid=thread-turns] [data-turn]").last
        await said.scroll_into_view_if_needed()
        await said.wait_for(state="visible")
        await page.clock.run_for("02")
        await page.wait_for_timeout(500)
        conversation = await overlay.inner_text()
        check(written[:60] in conversation,
              label("the reminder lands in that customer's own conversation"))
        await shot(page, width, "chase-conversation")
        await page.keyboard.press("Escape")
        await route(page, "#/money/credit", "money-credit")

        # AUTO-CHASE AT 12 h, then the clock moves and the second rung goes on its own.
        await page.get_by_test_id(f"auto-chase-every-{invoice_id}-12").click()
        await page.get_by_test_id(f"auto-chase-{invoice_id}").locator("xpath=ancestor::label[1]").click()
        await expect(card).to_have_attribute("data-auto", "on")
        await expect(card).to_have_attribute("data-every", "12")
        status = await page.get_by_test_id(f"chase-status-{invoice_id}").inner_text()
        check("next in 12 h" in status, label(f"the card counts down to the next reminder · {status}"))
        await shot(page, width, "auto-chase-on")

        await page.clock.fast_forward("12:00:30")
        await expect(card).to_have_attribute("data-step", "3", timeout=20000)
        record = await chase_state(invoice_id)
        check(len(record["sends"]) == 2 and record["sends"][1]["step"] == 2,
              label("the timer sent the second rung with no dialog"))
        check("late fee" in record["sends"][1]["text"] and "applies from" in record["sends"][1]["text"],
              label("the firmer reminder states the late fee and the day it starts"))
        await shot(page, width, "auto-chase-fired")

        # THE THIRD RUNG FLAGS THE CARD AND OFFERS THE ADVANCE.
        await page.clock.fast_forward("12:00:30")
        await page.get_by_test_id(f"unpaid-flag-{invoice_id}").wait_for(state="visible", timeout=20000)
        record = await chase_state(invoice_id)
        check(len(record["sends"]) == 3 and bool(record["flaggedAt"]) and record["auto"]["nextAt"] is None,
              label("the third rung flags the order and the ladder ends there"))
        flag = await page.get_by_test_id(f"unpaid-flag-{invoice_id}").inner_text()
        check("Needs a call" in flag and "Pay over time" in flag,
              label(f"the flagged card asks for a call and offers the advance · {flag.splitlines()[0]}"))
        advance_href = await page.get_by_test_id(f"unpaid-advance-{invoice_id}").get_attribute("href")
        check(advance_href == f"#/money/advance/{owed_here}",
              label("the advance line opens Pay over time with this order's amount"))
        await card.scroll_into_view_if_needed()
        await card.screenshot(path=str(OUT / f"{width}-unpaid-card-flagged.png"))
        await shot(page, width, "chase-flagged")

        geometry = await page.get_by_test_id("money-credit").evaluate(
            "el => ({scroll:el.scrollWidth, client:el.clientWidth, right:el.getBoundingClientRect().right, viewport:innerWidth})"
        )
        check(
            geometry["scroll"] <= geometry["client"] + 1 and geometry["right"] <= geometry["viewport"] + 1,
            label("the unpaid-orders page fits its viewport width"),
        )
        check(not errors, label(f"the chase walk runs without browser exceptions: {errors}"))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "chase-failure")
        (OUT / f"{width}-chase-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()



async def run_receipts(browser, width: int, url: str):
    """Brief item 1: the dashboard's three urgent orders and the last 30 days of receipts.

    Each independent contract records its own red, so the previous build leaves a complete
    evidence sheet and screenshots at every width. The retained seed supplies every order and
    receipt; moving two timestamps across the window and assigning one cash method exercise
    the boundary and all four methods without inventing customers or changing any amount.
    """
    def hold(condition: bool, name: str) -> bool:
        label = f"{width}: receipts: {name}"
        if condition:
            CHECKS.append(label)
            print("GREEN " + label, flush=True)
        else:
            FAILURES.append(label)
            print("RED " + label, flush=True)
        return condition

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    service = Collections(origin)
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700, timezone_id="America/Lima",
    )
    await context.add_init_script(boot(origin))
    # Fixed browser time makes the fixture offsets and the 30-day edge reproducible.
    instant = datetime(2026, 9, 15, 14, 45, tzinfo=timezone.utc)
    await context.clock.install(time=instant)
    await context.clock.resume()

    async def network_guard(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if same_origin and parsed.path.startswith("/api/cedar/"):
            value = service.answer(request.method, parsed.path, request.post_data_json)
            if value is not None and request.method == "POST" and parsed.path.endswith("/receipts"):
                # The service's ledger date follows Money's sample clock; its arrival timestamp
                # follows the actual send/receive sequence on the device, like the native store.
                value["receipts"][-1]["received_at"] = await page.evaluate("new Date().toISOString()")
            await request_route.fulfill(
                status=200 if value is not None else 404,
                content_type="application/json", body=json.dumps(value if value is not None else {"detail": "fixture"}),
            )
        elif not same_origin or parsed.path.startswith("/api/"):
            await request_route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')
        else:
            await request_route.continue_()

    await context.route("**/*", network_guard)
    page = await context.new_page()
    page.set_default_timeout(12000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    async def geometry(test_id: str, surface: str):
        values = await page.get_by_test_id(test_id).evaluate(
            "el => { const r=el.getBoundingClientRect(); return {scroll:el.scrollWidth,client:el.clientWidth,"
            "left:r.left,right:r.right,width:innerWidth}; }"
        )
        hold(values["scroll"] <= values["client"] + 1 and values["left"] >= -1
             and values["right"] <= values["width"] + 1,
             f"{surface} fits the {width}px viewport")

    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        s = await saved(page, "s.examplesLoaded && s.invoices.length > 0")
        unpaid = [invoice for invoice in s["invoices"]
                  if invoice["currency"] == "PEN" and invoice["customerId"]
                  and (invoice["status"] == "accepted" or (invoice["origin"] == "cedar" and invoice["status"] == "draft"))
                  and balance(s, invoice) > 0]
        # Urgency is the earliest due date, then the customer name and order id.
        urgent = sorted(unpaid, key=lambda invoice: (invoice["dueAt"], invoice["customerName"], invoice["id"]))[:3]
        owed = sum(balance(s, invoice) for invoice in unpaid)
        card = page.get_by_test_id("money-credit-card")
        await card.scroll_into_view_if_needed()
        await shot(page, width, "receipts-dashboard")
        await card.screenshot(path=str(OUT / f"{width}-receipts-dashboard-card.png"))
        text = await card.inner_text()
        headings = await card.locator("h1,h2,h3,h4").all_text_contents()
        hold("Unpaid orders" in headings, "money-overview.tsx: the card's own heading is Unpaid orders")
        count = page.get_by_test_id("money-unpaid-count")
        hold(await count.count() == 1 and str(len(unpaid)) in await count.inner_text(),
             f"money-overview.tsx: the card states {len(unpaid)} unpaid orders")
        hold((await money_text(page, owed)) in text,
             f"money-overview.tsx: the card states its {owed} minor-unit unpaid balance")
        previews = await card.locator('[data-testid^="money-unpaid-preview-"]').evaluate_all(
            "nodes => nodes.map(n => ({id:n.dataset.invoiceId,amount:Number(n.dataset.amountMinor),"
            "due:n.dataset.dueAt,overdue:Number(n.dataset.overdueDays),text:n.innerText}))"
        )
        hold([row["id"] for row in previews] == [invoice["id"] for invoice in urgent],
             "money-overview.tsx: the three most urgent orders appear in deadline order")
        for invoice, row in zip(urgent, previews, strict=False):
            days = max(0, (instant.date() - date.fromisoformat(invoice["dueAt"])).days)
            hold(row["id"] == invoice["id"] and row["amount"] == balance(s, invoice)
                 and row["due"] == invoice["dueAt"] and row["overdue"] == days,
                 f"money-overview.tsx: {invoice['id']} carries its balance and {days} overdue days")
            hold(invoice["customerName"] in row["text"]
                 and (await money_text(page, balance(s, invoice))) in row["text"]
                 and f"{days} day{'' if days == 1 else 's'} overdue" in row["text"],
                 f"money-overview.tsx: {invoice['id']} prints customer, amount and overdue days")
        await geometry("money-credit-card", "the unpaid-orders dashboard card")

        # Existing matched receipts stay attached to their original orders and amounts. A cash
        # receipt, two dates outside the period, and three chase times test the rendered contract.
        now = instant + timedelta(seconds=len(s["events"]))
        matched = [row for row in s["receipts"] if row["status"] == "matched"]
        picked = matched[0]
        picked["method"] = "cash"
        picked["source"] = "manual"
        matched[-1]["at"] = (now - timedelta(days=30, seconds=1)).isoformat()
        matched[-2]["at"] = (now + timedelta(days=1)).isoformat()
        paid_at = datetime.fromisoformat(picked["at"].replace("Z", "+00:00"))
        preceding = paid_at - timedelta(hours=1)
        chase = {"version": 1, "scope": "fish", "records": {picked["invoiceId"]: {
            "invoiceId": picked["invoiceId"],
            "sends": [
                {"at": (paid_at - timedelta(hours=2)).isoformat(), "step": 1, "channel": "email", "text": "First payment reminder."},
                {"at": preceding.isoformat(), "step": 2, "channel": "whatsapp", "text": "Payment reminder for this order."},
                {"at": (paid_at + timedelta(hours=1)).isoformat(), "step": 3, "channel": "email", "text": "Later payment reminder."},
            ],
            "auto": {"on": False, "everyHours": 24, "nextAt": None}, "flaggedAt": None,
        }}}
        await page.evaluate(
            "([moneyKey,chaseKey,money,chase]) => { localStorage.setItem(moneyKey,JSON.stringify(money));"
            "localStorage.setItem(chaseKey,JSON.stringify(chase)); }", [KEY, CHASE_KEY, s, chase],
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        await route(page, "#/money/credit", "money-credit")
        await shot(page, width, "receipts-unpaid")
        await geometry("money-credit", "the unpaid-orders page")
        unpaid_tab, paid_tab = page.get_by_test_id("credit-tab-unpaid"), page.get_by_test_id("credit-tab-paid")
        hold(await unpaid_tab.count() == 1, "money-credit.tsx: an Unpaid orders tab names the unpaid list")
        has_paid = hold(await paid_tab.count() == 1, "money-credit.tsx: Paid stands beside the unpaid list")
        if has_paid:
            hold((await paid_tab.inner_text()).strip() == "Paid", "money-credit.tsx: the second tab is named Paid")
            for test_id in ("credit-tab-unpaid", "credit-tab-paid"):
                seat = await page.get_by_test_id(test_id).bounding_box()
                hold(seat is not None and seat["width"] >= 44 and seat["height"] >= 44,
                     f"money-credit.tsx: {test_id} has a 44px touch target")
            await paid_tab.click()
            await page.get_by_test_id("money-paid").wait_for(state="visible")
            paid = page.get_by_test_id("money-paid")
            hold("Last 30 days" in await page.get_by_test_id("money-credit").inner_text(), "money-credit.tsx: Paid states Last 30 days")
            await shot(page, width, "receipts-paid")
            await geometry("money-paid", "the Paid receipt section")
            invoices = {invoice["id"]: invoice for invoice in s["invoices"]}
            eligible = [row for row in s["receipts"] if row["status"] == "matched" and row["currency"] == "PEN"
                        and row["invoiceId"] in invoices
                        and now.date() - timedelta(days=29) <= datetime.fromisoformat(row["at"].replace("Z", "+00:00")).astimezone(timezone(timedelta(hours=-5))).date() <= now.date()]
            expected = sorted(eligible, key=lambda row: (-datetime.fromisoformat(row["at"].replace("Z", "+00:00")).timestamp(), row["id"]))
            shown = await paid.locator('[data-testid^="paid-receipt-"]').evaluate_all(
                "nodes => nodes.map(n => ({id:n.dataset.receiptId,invoice:n.dataset.invoiceId,amount:Number(n.dataset.amountMinor),"
                "method:n.dataset.method,at:n.dataset.at,text:n.innerText,times:[...n.querySelectorAll('time')].map(t=>({at:t.dateTime,text:t.innerText}))}))"
            )
            hold([row["id"] for row in shown] == [row["id"] for row in expected],
                 "money-credit.tsx: Paid lists exactly the last 30 days of matched receipts, newest first")
            words = {"yape": "Yape", "plin": "Plin", "transfer": "Transfer", "cash": "Cash"}
            for receipt in expected:
                row = next((item for item in shown if item["id"] == receipt["id"]), None)
                hold(row is not None, f"money-credit.tsx: receipt {receipt['id']} appears")
                if row is None:
                    continue
                invoice = invoices[receipt["invoiceId"]]
                hold(row["invoice"] == invoice["id"] and row["amount"] == receipt["amountMinor"]
                     and row["method"] == receipt["method"] and row["at"] == receipt["at"],
                     f"money-credit.tsx: {receipt['id']} retains its order, amount, method and date")
                hold(invoice["customerName"] in row["text"] and (await money_text(page, receipt["amountMinor"])) in row["text"]
                     and words[receipt["method"]] in row["text"]
                     and any(t["at"] == receipt["at"] and bool(t["text"].strip()) for t in row["times"]),
                     f"money-credit.tsx: {receipt['id']} prints customer, amount, method and day")
            last_chase = page.get_by_test_id(f"paid-chase-{picked['id']}")
            if hold(await last_chase.count() == 1, "chase.ts → money-credit.tsx: the receipt shows the chase that preceded payment"):
                chase_text = await last_chase.inner_text()
                hold("2" in chase_text and "WhatsApp" in chase_text and "3" not in chase_text.split("·")[0],
                     "chase.ts → money-credit.tsx: the receipt selects reminder 2 on WhatsApp, before payment")
                await last_chase.scroll_into_view_if_needed()
                await shot(page, width, "receipts-paid-chase")
            targets = await paid.locator("a,summary").evaluate_all(
                "nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return {width:r.width,height:r.height}; })"
            )
            hold(bool(targets) and all(target["width"] >= 44 and target["height"] >= 44 for target in targets),
                 "money-credit.tsx: every receipt link and chase disclosure has a 44px touch target")
            await unpaid_tab.click()
            hold(await page.locator('[data-testid^="unpaid-card-"]').count() == len(unpaid),
                 "money-credit.tsx: returning to Unpaid orders restores every unpaid order")

            # Exercise the actual buttons with clocks that disagree: a late-morning reminder
            # precedes a newly received service payment carrying an older sample ledger date.
            await context.clock.fast_forward(2 * 60 * 60 * 1000)
            chosen = next(invoice for invoice in unpaid if balance(s, invoice) == invoice["amountMinor"])
            invoice_id = chosen["id"]
            await page.get_by_test_id(f"chase-now-{invoice_id}").click()
            await page.get_by_test_id("chase-dialog").wait_for(state="visible")
            sent_text = await page.get_by_test_id("chase-message").input_value()
            await page.get_by_test_id("chase-send").click()
            await page.get_by_test_id("chase-dialog").wait_for(state="hidden")
            actual_chase = await page.evaluate(
                "([key,id]) => JSON.parse(localStorage.getItem(key)).records[id].sends.at(-1)",
                [CHASE_KEY, invoice_id],
            )
            hold(actual_chase["text"] == sent_text,
                 "chase.ts: pressing Send records the reminder's own text and wall-clock instant")
            await route(page, f"#/money/invoices/{invoice_id}", "money-invoice-detail")
            await page.get_by_test_id("money-connect-request").click()
            await saved(page, f"s.requests.some(r => r.invoiceId === {json.dumps(invoice_id)} && r.remoteId && !r.remotePending)")
            await record(page, chosen["amountMinor"], "RECEIPT-AFTER-CHASE")
            after_payment = await saved(page, "s.receipts.some(r => r.reference === 'RECEIPT-AFTER-CHASE')")
            received = next(row for row in after_payment["receipts"] if row["reference"] == "RECEIPT-AFTER-CHASE")
            hold(received["at"] < actual_chase["at"] and received.get("receivedAt", "") >= actual_chase["at"],
                 "money-api.ts → money-store.ts: the service receipt preserves its later arrival beside its sample ledger date")
            await route(page, "#/money/credit", "money-credit")
            await page.get_by_test_id("credit-tab-paid").click()
            actual_row = page.get_by_test_id(f"paid-receipt-{received['id']}")
            await actual_row.wait_for(state="visible")
            await actual_row.scroll_into_view_if_needed()
            await shot(page, width, "receipts-after-send")
            actual_history = page.get_by_test_id(f"paid-chase-{received['id']}")
            if hold(await actual_history.count() == 1,
                    "chase.ts → money-credit.tsx: the payment just recorded shows the reminder just sent across the two clocks"):
                await actual_history.locator("summary").click()
                hold(sent_text in await actual_history.inner_text(),
                     "money-credit.tsx: opening the receipt's chase reveals the exact sent reminder")
                await actual_history.scroll_into_view_if_needed()
                await shot(page, width, "receipts-after-send-open")
            await page.reload(wait_until="domcontentloaded")
            await page.get_by_test_id("money-credit").wait_for(state="visible", timeout=45000)
            await page.get_by_test_id("credit-tab-paid").click()
            hold(await page.get_by_test_id(f"paid-chase-{received['id']}").count() == 1,
                 "money-credit.tsx: reloading preserves the receipt's preceding reminder")
        else:
            hold(False, "money-credit.tsx: Paid exposes customer, amount, method and day for recent receipts")
            hold(False, "chase.ts → money-credit.tsx: a Paid receipt exposes the preceding chase")
        await page.evaluate("location.hash='#/money/payments'")
        await page.wait_for_timeout(500)
        await shot(page, width, "payments-both-sides")
        both = await page.get_by_test_id("credit-tab-unpaid").count() == 1 and await page.get_by_test_id("credit-tab-paid").count() == 1
        hold(both, "Payments opens both unpaid orders and paid receipts under its own heading")
        if both:
            hold(await page.get_by_role("heading", name="Payments", exact=True).count() == 1, "Payments names both sides of the ledger")
            await page.get_by_test_id("credit-tab-unpaid").click()
            await page.get_by_test_id("credit-sort-deadline").click()
            dates = await page.locator('[data-testid^="unpaid-card-"]').evaluate_all("nodes => nodes.map(node => node.dataset.dueAt)")
            hold(bool(dates) and dates == sorted(dates), "Payments puts the most urgent unpaid orders first")
            await page.get_by_test_id("credit-tab-paid").click()
            hold(await page.get_by_test_id("money-paid").count() == 1, "Payments reaches the last thirty days of receipts")
            await shot(page, width, "payments-paid")
        hold(not errors, f"the receipts walk completes with zero browser exceptions: {errors}")
    except Exception as error:
        hold(False, f"{type(error).__name__}: {error}")
        await shot(page, width, "receipts-failure")
        (OUT / f"{width}-receipts-failure.txt").write_text(await page.locator("body").inner_text())
    finally:
        await context.close()


async def run_definitive(browser, width: int, url: str):
    """WHAT CLEARS A CONNECTED BANK, AND WHAT LEAVES IT STANDING (§246 review, finding 2).

    The same workspace is read three times: the service answers its authorized account, then a
    503, then a 401. A transport failure is a fact about the NETWORK — the card stays Connected and
    the balance stays on screen — and the provider's own answer about this workspace is a fact
    about the ACCOUNT, so it clears the evidence and every money door states its act again. This is
    `phone-runtime.declinePhoneSetup`'s rule (DEFINITIVE = 401, 403, 404), per money workspace.
    """

    def label(name):
        return f"{width}: {name}"

    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    answer = {"status": 200}
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(boot(origin))

    async def network_guard(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if same_origin and parsed.path.startswith("/api/cedar/"):
            if answer["status"] != 200:
                # The copper service's own refusal shape (`cedar_service.py` workspace_access_required).
                await request_route.fulfill(
                    status=answer["status"], content_type="application/json",
                    body='{"detail":"workspace_access_required"}',
                )
            elif parsed.path == "/api/cedar/bank":
                await request_route.fulfill(content_type="application/json", body=json.dumps(ACCOUNT))
            elif parsed.path == "/api/cedar/setup":
                await request_route.fulfill(content_type="application/json", body=json.dumps(
                    {"id": "workspace_fixture", "mode": "sample", "setup": {}, "readiness": READINESS}))
            elif parsed.path == "/api/cedar/bank/movements":
                await request_route.fulfill(content_type="application/json", body=json.dumps(
                    {"ready": True, "mode": "sandbox", "as_of": AS_OF, "movements": []}))
            else:
                await request_route.fulfill(status=404, content_type="application/json", body='{"detail":"fixture"}')
        elif not same_origin or parsed.path.startswith("/api/"):
            await request_route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')
        else:
            await request_route.continue_()

    await context.route("**/*", network_guard)
    page = await context.new_page()
    page.set_default_timeout(12000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        card = page.get_by_test_id("money-balance-card")
        await expect(card).to_have_attribute("data-bank-posture", "ready")
        check(
            await page.get_by_test_id("money-balance-open-setup").count() == 0,
            label("an authorized account opens the dashboard connected"),
        )

        # The window returning is one of the boundaries the runtime reads on.
        answer["status"] = 503
        await page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        await page.wait_for_timeout(1500)
        await expect(card).to_have_attribute("data-bank-posture", "ready")
        check(
            await page.get_by_test_id("money-balance-open-setup").count() == 0
            and await page.get_by_test_id("money-bank-balance").inner_text() != "",
            label("a transport failure keeps the connected account and its balance"),
        )

        answer["status"] = 401
        await page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        await expect(card).to_have_attribute("data-bank-posture", "unavailable")
        check(
            await page.get_by_test_id("money-balance-open-setup").count() == 1,
            label("the provider's answer about this workspace clears the account and states Connect bank"),
        )
        await shot(page, width, "definitive-workspace-refused")
        await route(page, "#/admin/connections", "payment-connection")
        connections = await page.get_by_test_id("payment-connection").inner_text()
        check(
            "Connect bank" in connections and "Connected" not in connections,
            label("Connections states the act the provider's refusal left behind"),
        )
        check(not errors, label(f"the connection postures run without browser exceptions: {errors}"))
    except Exception as error:
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await shot(page, width, "definitive-failure")
    finally:
        await context.close()


# The blocks this drive can run, in their default order. `ROCOTO_BLOCKS=chase` narrows a run to
# one of them, which is what a source flip costs instead of four walks of the same flip.
BLOCKS = {
    "unconnected": lambda *a: run_unconnected(*a),
    "definitive": lambda *a: run_definitive(*a),
    "viewport": lambda *a: run_viewport(*a),
    "chase": lambda *a: run_chase(*a),
    "receipts": lambda *a: run_receipts(*a),
}


async def main():
    url, httpd = serve_dist()
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local app URL for this drive.")
    OUT.mkdir(parents=True, exist_ok=True)
    widths = [1600, 390, 320]
    if os.getenv("ROCOTO_ONLY"):
        widths = [int(os.environ["ROCOTO_ONLY"])]
    blocks = [name for name in os.getenv("ROCOTO_BLOCKS", "").split(",") if name] or list(BLOCKS)
    unknown = [name for name in blocks if name not in BLOCKS]
    if unknown:
        raise SystemExit(f"Unknown block(s) {unknown}; choose from {sorted(BLOCKS)}")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
        )
        for width in widths:
            for name in blocks:
                await BLOCKS[name](browser, width, url)
        await browser.close()
    if httpd:
        httpd.shutdown()
    result = {"url": url, "checks": CHECKS, "failures": FAILURES, "screenshots": str(OUT)}
    (OUT / "result.json").write_text(json.dumps(result, indent=2))
    print(f"{len(CHECKS)} GREEN / {len(FAILURES)} RED · {OUT}", flush=True)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
