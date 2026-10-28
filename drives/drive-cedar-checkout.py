#!/usr/bin/env python3
"""The buyer's Yape checkout, end to end, against Cedar's real collection service (FEED-IA §252).

    ROCOTO_DIST=app/dist-checkout .venv/bin/python drives/drive-cedar-checkout.py

`ROCOTO_DIST` names a built directory the drive serves itself on a private loopback port;
`ROCOTO_URL` overrides that with an already served `app.html`; `ROCOTO_SHOTS` selects the
screenshot folder; `ROCOTO_ONLY=390` narrows the run to one width.

TWO BROWSER CONTEXTS AND ONE REAL SERVICE, because this is the seam §252 changed:

    «WHy is the immudable reference CEDAR0named??? it's a payment for an order. lol.»
    «can we just clone that and serve the links in our own demo domain as a new tab that goes
     through the motions? would make this all super more real»    — Peter, 14 September 2026

The merchant's Cedar creates a payment link for a seeded, unpaid order; the buyer's own browser
opens that link and meets the approval-code checkout — the amount and the order number, the Yape
mark, `+51` and nine digits, six code boxes a paste fills at once and the arrows walk, one act
«Yapear S/ …» — presses it, and the card becomes the receipt. The merchant's order then turns
**Paid** on its own five-second poll, with nothing pressed on that side.

Every check runs at 1600, 390 and 320. The collection service runs for real on a private loopback
port with an isolated encrypted SQLite store and every provider transport replaced by a blocked
mock, so the run reaches no network and makes no provider call.

BLOCKS
  `link`      · the merchant's link carries the ORDER'S OWN NUMBER as its reference.
  `checkout`  · the page is the Yape approval-code checkout, and its act obeys both fields.
  `pay`       · the act posts, works for a moment, and the card becomes the receipt.
  `merchant`  · the order reads «Paid» within one poll, pressed by nobody.
  `retry`     · the same phone and code record one payment; a guessed token reveals nothing.
  `seed`      · a cleared workspace returns to the seed, references and all.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import secrets
import socket
import sys
import tempfile
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
import uvicorn
from cryptography.fernet import Fernet
from playwright.async_api import Browser, Page, async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/src/prototypes/copper"))

from runtime.config import Settings  # noqa: E402

OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-checkout"))
KEY = "rocoto-cedar-money-v1:fish"
WORKSPACE_KEY = "rocoto-cedar-money-api-v1:fish"
CHECKS: list[str] = []
FAILURES: list[str] = []

# The Money drive owns the shared boot and the dist server; this drive boots its own contexts.
_spec = importlib.util.spec_from_file_location("cedar_money_drive", ROOT / "drives/drive-cedar-money.py")
assert _spec and _spec.loader
ui = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ui)


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


@asynccontextmanager
async def running_service(directory: str):
    """Cedar's own collection service, in sample mode, with every provider transport blocked."""
    from runtime.cedar_service import create_app

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    listener.setblocking(False)
    origin = f"http://127.0.0.1:{listener.getsockname()[1]}"
    settings = Settings(
        Path(directory),
        origin,
        secrets.token_urlsafe(40),
        Fernet.generate_key().decode(),
        sample_bank=True,
        cedar_allowed_origins=(UI_ORIGIN,),
    )
    outbound: list[str] = []

    def block_provider(request: httpx.Request) -> httpx.Response:
        outbound.append(request.url.host)
        raise httpx.ConnectError("Provider calls are blocked in this isolated proof", request=request)

    provider = httpx.AsyncClient(transport=httpx.MockTransport(block_provider))
    app = create_app(settings, http_client=provider)
    server = uvicorn.Server(uvicorn.Config(app, log_level="critical", access_log=False, log_config=None))
    task = asyncio.create_task(server.serve(sockets=[listener]))
    try:
        async with asyncio.timeout(15):
            while not server.started:
                if task.done():
                    await task
                await asyncio.sleep(0.05)
        yield origin, outbound
    finally:
        server.should_exit = True
        try:
            await asyncio.wait_for(task, 5)
        except asyncio.TimeoutError:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        await provider.aclose()
        listener.close()


async def merchant_context(browser: Browser, api_origin: str, width: int):
    """The seller's Cedar, bound to the running service and cut off from everything else."""
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.grant_permissions(["clipboard-read", "clipboard-write"], origin=UI_ORIGIN)
    await context.add_init_script(
        ui.BOOT + "\nlocalStorage.setItem('rocoto-cedar-collections-base', " + json.dumps(api_origin) + ");"
    )

    async def guard(route):
        parsed = urlsplit(route.request.url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin == api_origin or (origin == UI_ORIGIN and not parsed.path.startswith("/api/")):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')

    await context.route("**/*", guard)
    return context


async def state(page: Page) -> dict[str, Any]:
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


async def saved(page: Page, expression: str) -> dict[str, Any]:
    await page.wait_for_function(
        "([key, expression]) => { const s = JSON.parse(localStorage.getItem(key)); return s && new Function('s', 'return ' + expression)(s); }",
        arg=[KEY, expression],
        timeout=45000,
    )
    return await state(page)


def balance_of(s: dict[str, Any], invoice: dict[str, Any]) -> int:
    return invoice["amountMinor"] - sum(
        row["amountMinor"]
        for row in s["receipts"]
        if row["invoiceId"] == invoice["id"] and row["status"] == "matched"
    )


async def paste_code(page: Page, code: str) -> None:
    """A real clipboard paste into the first box, with a dispatched paste event as the fallback so
    the run holds the page's own handler on a box that refuses the system clipboard."""
    first = page.locator("#code-boxes .box").first
    await first.focus()
    with suppress(Exception):
        await page.evaluate("value => navigator.clipboard.writeText(value)", code)
        await page.keyboard.press("Control+V")
    if await page.evaluate("() => [...document.querySelectorAll('#code-boxes .box')].every(b => !b.value)"):
        await first.evaluate(
            "(node, value) => { const data = new DataTransfer(); data.setData('text', value);"
            " node.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true})); }",
            code,
        )


async def boxes_text(page: Page) -> str:
    return await page.evaluate("() => [...document.querySelectorAll('#code-boxes .box')].map(b => b.value).join('')")


async def shot(page: Page, width: int, name: str) -> None:
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def run_width(browser: Browser, api_origin: str, width: int) -> None:
    label = f"{width}px"
    context = await merchant_context(browser, api_origin, width)
    buyer_context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await buyer_context.grant_permissions(["clipboard-read", "clipboard-write"], origin=api_origin)
    seller = await context.new_page()
    buyer = await buyer_context.new_page()
    seller.set_default_timeout(20000)
    buyer.set_default_timeout(20000)
    errors: list[str] = []
    seller.on("pageerror", lambda error: errors.append("seller: " + str(error)))
    buyer.on("pageerror", lambda error: errors.append("buyer: " + str(error)))
    try:
        # ── link · the merchant's payment link carries the order's own number ──────────────────
        await seller.goto(UI_URL + "#/money", wait_until="domcontentloaded")
        await seller.get_by_test_id("money-overview").wait_for(state="visible", timeout=60000)
        s = await saved(seller, "s.examplesLoaded && s.invoices.length === 24")
        references = [invoice["number"] for invoice in s["invoices"]]
        check(
            all(reference.startswith("F001-") for reference in references) and len(set(references)) == 24,
            f"{label}: the seeded book numbers its own 24 documents",
        )
        check(
            all(receipt["reference"].startswith("F001-") for receipt in s["receipts"]),
            f"{label}: every seeded receipt pays under its document's number",
        )
        await expect(seller.get_by_test_id("money-balance-card")).to_have_attribute("data-bank-posture", "ready")
        await shot(seller, width, "merchant-money")

        unpaid = [i for i in s["invoices"] if balance_of(s, i) == i["amountMinor"]]
        chosen = None
        for invoice in unpaid:
            await ui.route(seller, f"#/money/invoices/{invoice['id']}", "money-invoice-detail")
            await expect(seller.get_by_test_id("money-invoice-detail")).to_contain_text(invoice["number"])
            if (await seller.get_by_test_id("money-invoice-status").inner_text()).strip() == "Payment link sent":
                chosen = invoice
                break
        check(bool(chosen), f"{label}: an unpaid order stands at «Payment link sent»")
        assert chosen is not None
        total = chosen["amountMinor"]

        await seller.get_by_test_id("money-connect-request").click()
        s = await saved(seller, f"s.requests.some(r => r.invoiceId === {json.dumps(chosen['id'])} && r.remoteId && !r.remotePending)")
        link = next(r for r in reversed(s["requests"]) if r["invoiceId"] == chosen["id"] and r.get("remoteId"))
        check(link["url"].startswith(api_origin + "/collect/"), f"{label}: the link is the service's own buyer URL")
        binding = await seller.evaluate("key => JSON.parse(localStorage.getItem(key))", WORKSPACE_KEY)
        headers = {"Authorization": "Bearer " + binding["token"]}
        async with httpx.AsyncClient(base_url=api_origin, timeout=20) as http:
            stored = (await http.get(f"/api/cedar/requests/{link['remoteId']}", headers=headers)).json()
            check(
                stored["reference"] == chosen["number"] and stored["reference"].startswith("F001-"),
                f"{label}: the request's reference is the order's own number, {chosen['number']}",
            )
            check(
                "CEDAR-" not in json.dumps(stored),
                f"{label}: the stored request carries no codename",
            )

            # ── checkout · the page is the Yape approval-code checkout ────────────────────────
            await buyer.goto(link["url"], wait_until="domcontentloaded")
            await expect(buyer.locator("#amount")).to_contain_text(f"{total / 100:,.2f}")
            await expect(buyer.locator("#order")).to_have_text(f"Pedido {chosen['number']}")
            await expect(buyer.locator("h1")).to_contain_text("Código de aprobación")
            await expect(buyer.locator(".field-label").first).to_have_text("Ingresa tu celular Yape")
            check(await buyer.locator(".prefix").inner_text() == "+51", f"{label}: the phone field carries its +51")
            check(await buyer.locator("#code-boxes .box").count() == 6, f"{label}: the approval code has six boxes")
            check(
                await buyer.locator(".mark").get_attribute("src") == "/assets/yape.png",
                f"{label}: the Yape mark stands on the card",
            )
            await expect(buyer.locator("#for-order")).to_contain_text(f"Pago para el pedido {chosen['number']}")
            check(await buyer.locator("#pay").is_disabled(), f"{label}: the act waits for both fields")
            check(await buyer.evaluate("localStorage.length") == 0, f"{label}: the buyer's browser opens with empty storage")
            check(binding["token"] not in await buyer.content(), f"{label}: the buyer page holds zero owner credentials")
            geometry = await buyer.evaluate(
                "() => { const act = document.querySelector('#pay').getBoundingClientRect();"
                " const seats = [...document.querySelectorAll('#code-boxes .box')].map(b => b.getBoundingClientRect());"
                " const amount = document.querySelector('#amount');"
                " return {scroll: document.documentElement.scrollWidth, width: innerWidth,"
                " actHeight: act.height, actRight: act.right,"
                " boxWidth: Math.min(...seats.map(r => r.width)), boxHeight: Math.min(...seats.map(r => r.height)),"
                " amountRight: amount.getBoundingClientRect().right,"
                " amountWrap: getComputedStyle(amount).whiteSpace,"
                " amountFigures: getComputedStyle(amount).fontVariantNumeric,"
                " qr: document.querySelector('#qr-open').hidden}; }"
            )
            check(
                geometry["scroll"] <= geometry["width"] + 1 and geometry["amountRight"] <= geometry["width"],
                f"{label}: the checkout and its amount fit the viewport without a sideways scroll",
            )
            check(
                geometry["actHeight"] >= 44 and geometry["boxHeight"] >= 44 and geometry["boxWidth"] >= 44,
                f"{label}: the act and all six code boxes are 44 px seats "
                f"({geometry['boxWidth']:.1f}×{geometry['boxHeight']:.0f})",
            )
            check(
                geometry["amountWrap"] == "nowrap" and "tabular-nums" in geometry["amountFigures"],
                f"{label}: the amount keeps its unit on one line in tabular figures",
            )
            check(geometry["qr"] is True, f"{label}: the QR act waits for a configured destination")
            await shot(buyer, width, "checkout-empty")

            # The phone alone leaves the act waiting; a pasted six-character code fills all six.
            await buyer.locator("#phone").fill("987654321")
            check(await buyer.locator("#phone").input_value() == "987 654 321", f"{label}: the phone reads in threes")
            check(await buyer.locator("#pay").is_disabled(), f"{label}: a phone alone leaves the act waiting")
            await paste_code(buyer, "284915")
            check(await boxes_text(buyer) == "284915", f"{label}: a pasted code fills all six boxes")
            await expect(buyer.locator("#pay")).to_be_enabled()
            await expect(buyer.locator("#pay")).to_contain_text(f"Yapear S/ {total / 100:,.2f}")
            check(True, f"{label}: the act reads «Yapear» with the amount and its unit on one line")

            # Backspace walks the boxes backwards, and the arrows walk them either way.
            for _ in range(6):
                await buyer.keyboard.press("Backspace")
            check(await boxes_text(buyer) == "", f"{label}: backspace walks the six boxes back to empty")
            check(await buyer.locator("#pay").is_disabled(), f"{label}: an emptied code returns the act to its rest")
            for digit in "150304":
                await buyer.keyboard.type(digit)
            check(await boxes_text(buyer) == "150304", f"{label}: typing walks forward one box at a time")
            await buyer.keyboard.press("ArrowLeft")
            focused = await buyer.evaluate("() => [...document.querySelectorAll('#code-boxes .box')].indexOf(document.activeElement)")
            check(focused == 4, f"{label}: the arrow keys walk the boxes")
            await shot(buyer, width, "checkout-filled")

            # ── pay · the act works for a moment, then the card is the receipt ────────────────
            await buyer.locator("#pay").click()
            await expect(buyer.locator("#pay-working")).to_be_visible()
            check(
                "Procesando" in await buyer.locator("#pay-working").inner_text(),
                f"{label}: the act states its working moment",
            )
            await shot(buyer, width, "checkout-working")
            await expect(buyer.locator("#receipt")).to_be_visible(timeout=20000)
            await expect(buyer.locator("#receipt-title")).to_have_text("Pago recibido")
            await expect(buyer.locator("#receipt-amount")).to_contain_text(f"{total / 100:,.2f}")
            await expect(buyer.locator("#receipt-order")).to_have_text(f"Pedido {chosen['number']}")
            check(
                bool((await buyer.locator("#receipt-hour").inner_text()).strip()),
                f"{label}: the receipt states the hour the payment landed",
            )
            await expect(buyer.locator("#receipt")).to_contain_text("Puedes cerrar esta ventana.")
            check(await buyer.locator("#ask").is_hidden(), f"{label}: the form gives its place to the receipt")
            page_text = await buyer.locator("body").inner_text()
            check(
                all(word.lower() not in page_text.lower() for word in ("demo", "ejemplo", "prueba", "sample", "test")),
                f"{label}: the buyer reads the payment and the seller, and nothing about the workspace",
            )
            await shot(buyer, width, "checkout-receipt")

            # A reload mid-flow keeps the receipt: the payment lives in the service, not the tab.
            await buyer.reload(wait_until="domcontentloaded")
            await expect(buyer.locator("#receipt-title")).to_have_text("Pago recibido", timeout=20000)
            check(True, f"{label}: the buyer's reload returns the same receipt")

            # ── merchant · the order turns Paid on its own poll ───────────────────────────────
            await expect(seller.get_by_test_id("money-invoice-status")).to_have_text("Paid", timeout=20000)
            await expect(seller.get_by_test_id("money-invoice-balance")).to_have_text(
                await ui.money_text(seller, 0)
            )
            check(True, f"{label}: the merchant's order turns «Paid» within one poll, pressed by nobody")
            s = await state(seller)
            imported = [r for r in s["receipts"] if r["invoiceId"] == chosen["id"]]
            check(
                len(imported) == 1
                and imported[0]["reference"] == chosen["number"]
                and imported[0]["method"] == "yape"
                and imported[0]["source"] == "demo-bank",
                f"{label}: the imported receipt is one Yape payment under the order's number",
            )
            await shot(seller, width, "merchant-paid")
            await seller.reload(wait_until="domcontentloaded")
            await seller.get_by_test_id("money-invoice-detail").wait_for(state="visible", timeout=60000)
            await expect(seller.get_by_test_id("money-invoice-status")).to_have_text("Paid")
            check(True, f"{label}: the merchant's reload keeps the settled order settled")

            # ── retry · one payment, whatever the buyer's tab does next ───────────────────────
            path = urlsplit(link["url"]).path
            before = len((await http.get(f"/api/cedar/requests/{link['remoteId']}", headers=headers)).json()["receipts"])
            again = await http.post(path + "/approve", json={"phone": "987654321", "code": "150304"})
            after = (await http.get(f"/api/cedar/requests/{link['remoteId']}", headers=headers)).json()["receipts"]
            check(
                again.status_code == 200 and len(after) == before == 1,
                f"{label}: the same phone and code record one payment",
            )
            forged = await http.post(
                path.rsplit("/", 1)[0] + "/invalid-token/approve", json={"phone": "987654321", "code": "150304"}
            )
            check(forged.status_code == 404, f"{label}: a guessed capability reveals no order")
            short = await http.post(path + "/approve", json={"phone": "987654321", "code": "1503"})
            check(short.status_code == 422, f"{label}: a short approval code is refused")

        check(not errors, f"{label}: the merchant and the buyer run without browser exceptions")
    except Exception:
        await seller.screenshot(path=str(OUT / f"{width}-merchant-failure.png"))
        await buyer.screenshot(path=str(OUT / f"{width}-buyer-failure.png"))
        (OUT / f"{width}-merchant-failure.txt").write_text(await seller.locator("body").inner_text())
        raise
    finally:
        await context.close()
        await buyer_context.close()


async def run_seed(browser: Browser, api_origin: str) -> None:
    """A cleared workspace returns to the seed, references and all."""
    context = await merchant_context(browser, api_origin, 1600)
    page = await context.new_page()
    page.set_default_timeout(20000)
    try:
        await page.goto(UI_URL + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=60000)
        first = await saved(page, "s.examplesLoaded && s.invoices.length === 24")
        await page.evaluate(
            "keys => { for (const key of keys) localStorage.removeItem(key); sessionStorage.clear(); }",
            [KEY, WORKSPACE_KEY],
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=60000)
        second = await saved(page, "s.examplesLoaded && s.invoices.length === 24")
        check(
            [i["number"] for i in second["invoices"]] == [i["number"] for i in first["invoices"]],
            "a cleared workspace returns to the seed with the same 24 document numbers",
        )
        check(
            sorted(r["reference"] for r in second["receipts"]) == sorted(r["reference"] for r in first["receipts"]),
            "the returned seed pays under the same references",
        )
    finally:
        await context.close()


async def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    widths = [int(os.environ["ROCOTO_ONLY"])] if os.getenv("ROCOTO_ONLY") else [1600, 390, 320]
    try:
        with tempfile.TemporaryDirectory(prefix="cedar-checkout-") as directory:
            async with running_service(directory) as (api_origin, outbound):
                async with async_playwright() as playwright:
                    browser = await playwright.chromium.launch(
                        headless=True,
                        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
                    )
                    for width in widths:
                        await run_width(browser, api_origin, width)
                    await run_seed(browser, api_origin)
                    await browser.close()
                check(outbound == [], "the checkout proof performs zero external provider calls")
    except Exception as error:
        FAILURES.append(f"{type(error).__name__}: {error}")
        print("RED " + FAILURES[-1], flush=True)
    (OUT / "result.json").write_text(json.dumps({"checks": CHECKS, "failures": FAILURES, "ui": UI_URL}, indent=2))
    print(f"TOTAL {len(CHECKS)} GREEN / {len(FAILURES)} RED · {OUT}", flush=True)
    return 1 if FAILURES else 0


UI_URL, _SERVER = ui.serve_dist()
UI_ORIGIN = f"{urlsplit(UI_URL).scheme}://{urlsplit(UI_URL).netloc}"

if __name__ == "__main__":
    if urlsplit(UI_URL).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local UI for this drive.")
    sys.exit(asyncio.run(main()))
