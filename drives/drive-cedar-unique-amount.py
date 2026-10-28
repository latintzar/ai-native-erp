#!/usr/bin/env python3
"""The buyer sees and pays the server's exact cents quote through the real local runtime."""
from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import secrets
import socket
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import uvicorn
from cryptography.fernet import Fernet
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/src/prototypes/copper"))
from runtime.cedar_service import create_app  # noqa: E402 — the drive selects its checkout's runtime
from runtime.config import Settings  # noqa: E402 — the drive selects its checkout's runtime

OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-unique/screens"))
checks: list[dict[str, object]] = []


def check(passed, name):
    checks.append({"passed": bool(passed), "name": name})
    print(("GREEN " if passed else "RED ") + name, flush=True)


async def merchant(browser, api, auth, width, url, money):
    """Actual runtime receipt, rendered in the scoped browser ledger; isolated bank DTO fixture."""
    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 1000 if width == 1600 else 844}, timezone_id="America/Lima")
    await context.add_init_script(money.boot(origin))
    fixture = money.Collections(origin)
    rows = [{"id": "a" * 64, "source": "prometeo", "mode": "sandbox", "date": "2026-09-15",
        "detail": "Incoming transfer", "reference": "", "currency": "PEN", "account_mask": "•••• 1234",
        "debit_minor": 0, "credit_minor": 10001, "allocated_minor": 0, "unallocated_minor": 10001,
        "status": "review", "reason": "review_required", "request_id": None, "invoice_id": None,
        "document_id": None, "payer_name": "María Torres", "match_key": None}]

    async def guard(route):
        parsed = urlsplit(route.request.url)
        if parsed.path.startswith("/api/"):
            data = ({"ready": True, "mode": "sandbox", "as_of": "2026-09-15T15:00:00Z", "movements": rows}
                if parsed.path == "/api/cedar/bank/movements" else fixture.answer(route.request.method, parsed.path, None))
            await route.fulfill(status=200 if data else 503, content_type="application/json", body=json.dumps(data or {}))
        elif route.request.url.startswith(origin + "/") or parsed.scheme in {"data", "blob"}:
            await route.continue_()
        else:
            await route.abort()

    await context.route("**/*", guard)
    page = await context.new_page()
    await page.goto(url + "#/money")
    await page.get_by_test_id("money-overview").wait_for()
    await page.wait_for_function("JSON.parse(localStorage.getItem('rocoto-cedar-money-v1:fish')||'{}').invoices?.length > 0")
    state = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-money-v1:fish'))")
    invoice = next(row for row in state["invoices"] if row["status"] == "accepted")
    principal = invoice["amountMinor"]
    item = None
    for index in [1, 2]:
        result = await api.post("/api/cedar/requests", headers=auth, json={
            "invoice_id": f"merchant-{width}-{index}", "document_id": invoice["saleId"],
            "seller_name": invoice["sellerName"], "customer_name": invoice["customerName"],
            "description": invoice["saleNumber"], "amount_minor": principal, "invoice_amount_minor": principal,
            "currency": "PEN", "receiving_bank": "bbva", "account_label": invoice["sellerName"],
            "reference": f"M-{width}-{index}", "idempotency_key": f"merchant-{width}-{index}"})
        result.raise_for_status()
        item = result.json()
    approved = await api.post(urlsplit(item["buyer_url"]).path + "/approve", json={
        "phone": "987654321", "code": "654321", "quote_id": item["quote_id"]})
    approved.raise_for_status()
    paid = (await api.get("/api/cedar/requests/" + item["id"], headers=auth)).json()
    receipt = paid["receipts"][0]
    rows.append({**rows[0], "id": "b" * 64, "payer_name": None, "status": "matched", "reason": "",
        "credit_minor": receipt["amount_minor"], "allocated_minor": receipt["amount_minor"], "unallocated_minor": 0,
        "request_id": item["id"], "invoice_id": invoice["id"], "document_id": invoice["saleId"], "match_key": "amount"})
    state["receipts"] = [row for row in state["receipts"] if row["invoiceId"] != invoice["id"]]
    state["receipts"].append({"id": "unique-amount-receipt", "invoiceId": invoice["id"],
        "amountMinor": receipt["amount_minor"], "roundingMinor": receipt["rounding_minor"],
        "currency": receipt["currency"], "reference": receipt["reference"], "method": "yape",
        "source": "demo-bank", "status": "matched", "at": receipt["created_at"]})
    await page.evaluate("state => localStorage.setItem('rocoto-cedar-money-v1:fish', JSON.stringify(state))", state)
    await page.goto(url + "#/money/invoices/" + invoice["id"])
    await page.reload()
    await page.get_by_test_id("money-history").wait_for()
    await page.get_by_test_id("money-history").scroll_into_view_if_needed()
    await page.screenshot(path=str(OUT / f"{width}-merchant-receipt.png"), full_page=True)
    check(await page.get_by_test_id("money-receipt-rounding").count() == 1, f"{width}px: merchant receipt separates invoice principal and rounding")
    check(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{width}px: merchant receipt fits viewport")
    await page.goto(url + "#/money/transactions")
    await page.get_by_test_id("money-bank-transaction").first.click()
    await page.screenshot(path=str(OUT / f"{width}-payer-review.png"), full_page=True)
    check("Payer: María Torres" in await page.get_by_test_id("money-bank-transaction-detail").inner_text(), f"{width}px: bank payer is shown as review context")
    await page.get_by_test_id("money-bank-transaction").nth(1).click()
    await page.screenshot(path=str(OUT / f"{width}-amount-match.png"), full_page=True)
    check("Exact amount" in await page.get_by_test_id("money-bank-transaction-detail").inner_text(), f"{width}px: bank evidence states the amount matching key")
    await context.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    money = None
    httpd = None
    url = None
    if os.getenv("ROCOTO_DIST"):
        module = importlib.util.spec_from_file_location("money_drive", ROOT / "drives/drive-cedar-money.py")
        assert module and module.loader
        money = importlib.util.module_from_spec(module)
        module.loader.exec_module(money)
        url, httpd = money.serve_dist()
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    listener.setblocking(False)
    origin = f"http://127.0.0.1:{listener.getsockname()[1]}"
    with tempfile.TemporaryDirectory(prefix="cedar-amounts-") as directory:
        settings = Settings(Path(directory), origin, secrets.token_urlsafe(40), Fernet.generate_key().decode(), sample_bank=True)
        service = uvicorn.Server(uvicorn.Config(create_app(settings), log_level="critical", access_log=False))
        task = asyncio.create_task(service.serve(sockets=[listener]))
        try:
            while not service.started:
                await asyncio.sleep(.05)
            async with httpx.AsyncClient(base_url=origin) as api, async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox"])
                for width in [1600, 390, 320]:
                    owner = (await api.post("/api/cedar/workspaces", json={"scope": "fish"})).json()
                    auth = {"Authorization": "Bearer " + owner["token"]}
                    item = None
                    for index in [1, 2]:
                        item = (await api.post("/api/cedar/requests", headers=auth, json={
                            "invoice_id": f"invoice-{index}", "document_id": f"order-{index}",
                            "seller_name": "Peix Vilalta", "customer_name": "Restaurant",
                            "description": f"Pedido 1509-{index}", "amount_minor": 10000,
                            "invoice_amount_minor": 10000, "currency": "PEN", "receiving_bank": "bbva",
                            "account_label": "Peix Vilalta", "reference": f"1509-{index}",
                            "idempotency_key": str(index), "sample_clock": "2026-09-15T12:00:00Z"})).json()
                    context = await browser.new_context(viewport={"width": width, "height": 1000 if width == 1600 else 844}, timezone_id="America/Lima")
                    page = await context.new_page()
                    await page.goto(item["buyer_url"])
                    await page.wait_for_function("document.getElementById('order').textContent.includes('1509-2')")
                    await page.screenshot(path=str(OUT / f"{width}-quote.png"), full_page=True)
                    words = await page.locator("body").inner_text()
                    check("100.01" in words and "Paga exactamente" in words, f"{width}px: exact allocated amount is visible")
                    check(item["invoice_amount_minor"] == 10000 and item.get("rounding_minor") == 1, f"{width}px: quote keeps invoice principal and rounding separate")
                    check(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{width}px: checkout fits viewport")
                    targets = await page.locator('.brand a, .box').evaluate_all("elements => elements.map(element => {const r=element.getBoundingClientRect(); return {width:r.width,height:r.height};})")
                    check(all(row['width'] >= 44 and row['height'] >= 44 for row in targets), f"{width}px: buyer brand and code targets reach 44px")
                    await page.locator("#phone").fill("987654321")
                    for index, digit in enumerate("123456"):
                        await page.locator(".box").nth(index).fill(digit)
                    await page.wait_for_function("!document.getElementById('pay').disabled")
                    await page.wait_for_timeout(250)
                    await page.screenshot(path=str(OUT / f"{width}-ready.png"), full_page=True)
                    await page.locator("#pay").click()
                    await page.locator("#receipt").wait_for(state="visible")
                    await page.screenshot(path=str(OUT / f"{width}-receipt.png"), full_page=True)
                    paid = (await api.get("/api/cedar/requests/" + item["id"], headers=auth)).json()
                    check(paid["balance_minor"] == 0 and paid["receipts"][0]["amount_minor"] == 10001 and paid["receipts"][0].get("rounding_minor") == 1, f"{width}px: buyer payment reaches merchant ledger once")
                    check("100.01" in await page.locator("#receipt").inner_text(), f"{width}px: receipt states actual money received")
                    await context.close()
                    if money:
                        await merchant(browser, api, auth, width, url, money)
                await browser.close()
        finally:
            service.should_exit = True
            await task
            listener.close()
            if httpd:
                httpd.shutdown()
    (OUT / "checks.json").write_text(json.dumps(checks, indent=2))
    print(f"{sum(row['passed'] for row in checks)} GREEN · {sum(not row['passed'] for row in checks)} RED")
    return 0 if all(row["passed"] for row in checks) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
