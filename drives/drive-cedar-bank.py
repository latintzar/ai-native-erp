#!/usr/bin/env python3
"""Cedar bank activity UX with isolated owner HTTP fixtures and canonical seed IDs.

Run: ROCOTO_URL=http://127.0.0.1:8101/app.html .venv/bin/python drives/drive-cedar-bank.py
Provider traffic is blocked. This proves the browser contract, not bank commissioning.
"""

from __future__ import annotations

import asyncio
import copy
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

URL = os.getenv("ROCOTO_URL", "http://127.0.0.1:8101/app.html").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-bank-proof"))
API = "http://127.0.0.1:18876"
KEY = "rocoto-cedar-money-v1:fish"
WORKSPACE_KEY = "rocoto-cedar-money-api-v1:fish"
TOKEN = "b" * 64
AS_OF = "2026-09-10T02:00:00Z"
CHECKS: list[str] = []


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    CHECKS.append(label)
    print("GREEN " + label, flush=True)


async def state(page):
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


async def replace_state(page, value):
    await page.evaluate(
        """([key,value]) => {
      const oldValue=localStorage.getItem(key), newValue=JSON.stringify(value);
      localStorage.setItem(key,newValue);
      window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue}));
    }""",
        [KEY, value],
    )


async def run(browser, width: int) -> None:
    def label(value):
        return f"{width}px: {value}"

    origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    context = await browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Lima")
    await context.add_init_script("""if (!sessionStorage.getItem('bank-drive')) {
      localStorage.clear();
      localStorage.setItem('rocoto-app-front-door','months');
      localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
      localStorage.setItem('rocoto-runtime-base','http://127.0.0.1:9');
      sessionStorage.setItem('bank-drive','ready');
    }""")
    connected = False
    reset = False
    matched = False
    hold = False
    holding = asyncio.Event()
    release = asyncio.Event()
    movements: list[dict] = []
    match_calls: list[dict] = []
    errors: list[str] = []
    unexpected: list[str] = []
    target: dict = {}

    async def guard(route):
        nonlocal matched
        request = route.request
        parsed = urlsplit(request.url)
        request_origin = f"{parsed.scheme}://{parsed.netloc}"
        if request_origin == API:
            headers = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers": "authorization, content-type",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            }
            if request.method == "OPTIONS":
                await route.fulfill(status=204, headers=headers)
                return
            if parsed.path == "/api/cedar/workspaces":
                # A reset drops the binding, and the money provider immediately asks for a new
                # workspace (money-bank-api.ts polls rather than remembering one read). This
                # isolated fixture declines, so the card stays at its unconnected posture.
                await route.fulfill(
                    status=503, headers=headers, content_type="application/json",
                    body='{"detail":"Isolated browser fixture."}',
                )
                return
            assert request.headers.get("authorization") == f"Bearer {TOKEN}"
            if parsed.path in ("/api/cedar/bank", "/api/cedar/bank/movements") and hold:
                holding.set()
                await release.wait()
            if parsed.path == "/api/cedar/setup":
                # The workspace's own provider record, read beside the account (money-bank-api.ts).
                value = {
                    "id": "workspace_fixture",
                    "mode": "sample",
                    "setup": {},
                    "readiness": {
                        "prometeo": {"configured": connected, "bank_authorized": connected, "last_read": AS_OF if connected else None, "mode": "live" if connected else None},
                        "nubefact": {"configured": False, "mode": None, "documents": 0},
                    },
                }
            elif parsed.path == "/api/cedar/bank":
                value = (
                    {
                        "ready": True,
                        "bank": "bbva",
                        "account_label": "Synthetic seller account",
                        "account_mask": "•••• 1234",
                        "balance_minor": 987654,
                        "currency": "PEN",
                        "as_of": AS_OF,
                        "mode": "live",
                        "source": "prometeo",
                    }
                    if connected
                    else {"ready": False, "mode": "sample"}
                )
            elif parsed.path == "/api/cedar/bank/movements":
                value = {
                    "ready": connected,
                    "mode": "live" if connected else None,
                    "as_of": AS_OF if connected else None,
                    "movements": movements if connected else [],
                }
            elif parsed.path == "/api/cedar/bank/match":
                payload = request.post_data_json
                assert payload == {"movement_id": "2" * 64, "request_id": "request_fixture"}
                match_calls.append(payload)
                matched = True
                movements[1].update(
                    status="matched",
                    reason="",
                    allocated_minor=2000,
                    unallocated_minor=0,
                    request_id="request_fixture",
                    invoice_id=target["id"],
                    document_id=target["saleId"],
                )
                value = {"status": "matched"}
            elif parsed.path in (
                "/api/cedar/requests/request_fixture",
                "/api/cedar/requests/duplicate_request",
            ):
                request_id = parsed.path.rsplit("/", 1)[1]
                paid = matched and request_id == "request_fixture"
                document = target if request_id == "request_fixture" else linked
                value = {
                    "id": request_id,
                    "buyer_url": API + f"/collect/{request_id}/synthetic-public",
                    "amount_minor": document["amountMinor"],
                    "currency": "PEN",
                    "status": "partial" if paid else "pending",
                    "balance_minor": document["amountMinor"] - (2000 if paid else 0),
                    "confirmed_minor": 2000 if paid else 0,
                    "manual_minor": 0,
                    "sample_minor": 0,
                    "receipts": [
                        {
                            "id": "receipt_fixture",
                            "amount_minor": 2000,
                            "currency": "PEN",
                            "reference": "SYNTHETIC-BANK-RECEIPT",
                            "method": "transfer",
                            "source": "prometeo",
                            "status": "matched",
                            "created_at": AS_OF,
                        }
                    ]
                    if paid
                    else [],
                }
            else:
                unexpected.append(f"{request.method} {parsed.path}")
                await route.fulfill(
                    status=503,
                    headers=headers,
                    content_type="application/json",
                    body='{"detail":"Choose a fixture action."}',
                )
                return
            await route.fulfill(headers=headers, content_type="application/json", body=json.dumps(value))
        elif request_origin == origin and not parsed.path.startswith("/api/"):
            await route.continue_()
        else:
            await route.fulfill(
                status=503, content_type="application/json", body='{"detail":"Isolated browser fixture."}'
            )

    await context.route("**/*", guard)
    page = await context.new_page()
    page.set_default_timeout(12000)
    page.on("pageerror", lambda error: errors.append(str(error)))

    async def expand(movement_id):
        row = page.locator(f'[data-movement-id="{movement_id}"]')
        if await row.get_attribute("aria-expanded") != "true":
            await row.click()
        await expect(page.get_by_test_id("money-bank-transaction-detail")).to_be_visible()
        return row

    try:
        await page.goto(URL + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        await page.wait_for_function(
            "key => JSON.parse(localStorage.getItem(key))?.invoices.length===24", arg=KEY
        )
        saved = await state(page)
        await expect(page.get_by_test_id("money-history-line")).to_have_count(1)
        await expect(page.get_by_test_id("money-bank-chart")).to_have_count(0)
        check(
            len(saved["invoices"]) == 24,
            label("sample chart and bank rows start from the retained 24-invoice scenario"),
        )

        target = copy.deepcopy(
            next(invoice for invoice in saved["invoices"] if invoice["amountMinor"] > 5000)
        )
        linked = next(
            invoice
            for invoice in saved["invoices"]
            if invoice["id"] != target["id"] and invoice["amountMinor"] > 5000
        )
        target.update(
            origin="cedar",
            status="draft",
            number="DRAFT-BANK-001",
            invoiceSeries="F001",
            customerAddress="Synthetic address",
        )
        saved["invoices"] = [
            target if invoice["id"] == target["id"] else invoice for invoice in saved["invoices"]
        ]
        saved["receipts"] = [receipt for receipt in saved["receipts"] if receipt["invoiceId"] != target["id"]]
        saved["requests"] = [request for request in saved["requests"] if request["invoiceId"] != target["id"]]
        saved["requests"].append(
            {
                "id": "link_fixture",
                "invoiceId": target["id"],
                "amountMinor": target["amountMinor"],
                "currency": "PEN",
                "url": API + "/collect/request_fixture/synthetic-public",
                "status": "created",
                "createdAt": AS_OF,
                "remoteId": "request_fixture",
            }
        )
        saved["setup"].update(payments="demo-connected", invoicing="demo-connected")
        await replace_state(page, saved)
        await page.evaluate(
            """([origin,key,token])=>{
          localStorage.setItem('rocoto-cedar-collections-base',origin);
          localStorage.setItem(key,JSON.stringify({id:'workspace_fixture',token,mode:'sample',origin}));
        }""",
            [API, WORKSPACE_KEY, TOKEN],
        )

        def movement(index, **changes):
            return {
                "id": str(index) * 64,
                "source": "prometeo",
                "mode": "live",
                "date": "2026-09-09",
                "detail": f"Synthetic bank transfer {index}",
                "reference": "UNKNOWN-REFERENCE",
                "currency": "PEN",
                "account_mask": "•••• 1234",
                "debit_minor": 0,
                "credit_minor": 500,
                "allocated_minor": 0,
                "unallocated_minor": 500,
                "status": "review",
                "reason": "reference_not_found",
                "request_id": None,
                "invoice_id": None,
                "document_id": None,
                **changes,
            }

        movements.extend(
            [
                movement(
                    1,
                    reference=linked["number"],
                    credit_minor=3000,
                    allocated_minor=3000,
                    unallocated_minor=0,
                    status="matched",
                    reason="",
                    request_id="linked_request",
                    invoice_id=linked["id"],
                    document_id=linked["saleId"],
                ),
                movement(
                    2,
                    reference=target["number"],
                    detail="Synthetic bank transfer with the complete customer instruction: delivery to the central market, morning collection and invoice reference retained in the bank description.",
                    credit_minor=2000,
                    unallocated_minor=2000,
                ),
                movement(3),
                movement(
                    4,
                    detail="Synthetic supplier payment",
                    debit_minor=750,
                    credit_minor=0,
                    unallocated_minor=0,
                    reason="outgoing_movement",
                ),
                movement(
                    5, reference=target["number"], currency="USD", credit_minor=88800, unallocated_minor=88800
                ),
                movement(6, date="2026-08-20", credit_minor=100000, unallocated_minor=100000),
                movement(7, mode="sandbox", credit_minor=999000, unallocated_minor=999000),
                movement(8, reference=linked["number"], credit_minor=1000, unallocated_minor=1000),
            ]
        )
        connected = True
        # The money provider's wake-up keeps a ten-second floor, so a flurry of focus events is one
        # read (money-bank-api.ts). The drive waits it out rather than reaching past it.
        await page.wait_for_timeout(10200)
        await page.evaluate("window.dispatchEvent(new Event('focus'))")
        await expect(page.get_by_test_id("money-bank-balance")).to_have_attribute(
            "data-amount-minor", "987654"
        )
        # Acquiring the owner binding correctly clears any prior remote IDs. Install
        # this owner's prepared document only after that change has been observed.
        await replace_state(page, saved)
        await expect(page.get_by_test_id("money-bank-chart")).to_be_visible()
        await expect(page.get_by_test_id("money-history-line")).to_have_count(0)
        await expect(page.get_by_test_id("money-forecast-line")).to_have_count(0)
        await expect(page.get_by_test_id("money-bank-incoming-total")).to_have_attribute(
            "data-amount-minor", "6500"
        )
        points = (
            await page.get_by_test_id("money-bank-history-line").get_attribute("data-amounts-minor")
        ).split(",")
        check(
            len(points) == 14 and points[-1] == "6500" and sum(map(int, points)) == 6500,
            label("actual 14-day chart uses Peru dates and account currency/mode, with all incoming credits"),
        )
        await page.get_by_test_id("money-transactions-card").click()
        await page.get_by_test_id("money-transactions-page").wait_for(state="visible")
        await expect(page.get_by_test_id("money-bank-transaction")).to_have_count(8)
        await expect(page.locator('[data-movement-id="' + "4" * 64 + '"]')).to_contain_text("Money out")
        check(
            True,
            label(
                "connected bank balance and matched, review and debit transactions replace sample activity"
            ),
        )
        await page.screenshot(path=str(OUT / f"{width}-dashboard.png"))

        await expand("1" * 64)
        detail = page.get_by_test_id("money-bank-transaction-detail")
        await expect(detail).to_contain_text("•••• 1234")
        await expect(detail).to_contain_text(linked["number"])
        invoice_link = detail.locator(f'a[href="#/money/invoices/{linked["id"]}"]')
        await expect(invoice_link).to_have_count(1)
        await invoice_link.click()
        await expect(page.get_by_test_id("money-invoice-detail")).to_be_visible()
        check(
            await page.evaluate("location.hash") == f"#/money/invoices/{linked['id']}",
            label("matched transfer opens its existing invoice"),
        )
        await page.evaluate("location.hash='#/money/transactions'")
        await expect(page.get_by_test_id("money-bank-transaction")).to_have_count(8)
        await expand("1" * 64)
        await (
            page.get_by_test_id("money-bank-transaction-detail")
            .get_by_role("link", name="Delivery Note")
            .click()
        )
        await expect(page.get_by_test_id("delivery-note-money")).to_be_visible()
        check(
            await page.evaluate("location.hash") == f"#/sales/{linked['saleId']}",
            label("matched transfer opens its original Delivery Note with billing history"),
        )
        await page.evaluate("location.hash='#/money/transactions'")
        await expect(page.get_by_test_id("money-bank-transaction")).to_have_count(8)
        await page.get_by_test_id("money-bank-review-filter").click()
        await expect(page.get_by_test_id("money-bank-transaction")).to_have_count(6)
        check(
            await page.locator('[data-movement-id="' + "4" * 64 + '"]').count() == 0,
            label("Review filter includes unresolved incoming transfers and excludes debits/matches"),
        )
        await expand("2" * 64)
        await expect(page.get_by_test_id("money-bank-match")).to_be_visible()
        await expect(
            page.get_by_test_id("money-bank-transaction-detail").get_by_text(
                movements[1]["detail"], exact=True
            )
        ).to_be_visible()
        check(True, label("expanded transaction retains the complete description from its truncated row"))
        check(True, label("exact live Cedar draft reference and saved remote request offers Check payment"))
        for movement_id in ("3", "5", "7", "8"):
            await expand(movement_id * 64)
            await expect(page.get_by_test_id("money-bank-match")).to_have_count(0)
            if movement_id == "7":
                await expect(page.get_by_test_id("money-bank-transaction-detail")).to_contain_text(
                    "Prometeo sandbox"
                )
        check(
            True,
            label(
                "unknown reference, wrong currency, sandbox and sample invoice each keep matching unavailable"
            ),
        )

        await expand("2" * 64)
        for case in ("missing-request", "rejected", "insufficient-balance", "duplicate-reference"):
            changed = copy.deepcopy(saved)
            if case == "missing-request":
                changed["requests"][-1].pop("remoteId")
            elif case == "rejected":
                next(invoice for invoice in changed["invoices"] if invoice["id"] == target["id"])[
                    "status"
                ] = "rejected"
            elif case == "insufficient-balance":
                changed["receipts"].append(
                    {
                        "id": "almost-paid",
                        "invoiceId": target["id"],
                        "amountMinor": target["amountMinor"] - 1000,
                        "currency": "PEN",
                        "method": "transfer",
                        "source": "manual",
                        "reference": "ALMOST-PAID",
                        "at": AS_OF,
                        "status": "matched",
                    }
                )
            else:
                duplicate = next(invoice for invoice in changed["invoices"] if invoice["id"] == linked["id"])
                duplicate.update(
                    origin="cedar",
                    status="draft",
                    number=target["number"],
                    invoiceSeries="F001",
                    customerAddress="Synthetic address",
                )
                changed["receipts"] = [
                    receipt for receipt in changed["receipts"] if receipt["invoiceId"] != duplicate["id"]
                ]
                changed["requests"].append(
                    {
                        **changed["requests"][-1],
                        "id": "duplicate_link",
                        "invoiceId": duplicate["id"],
                        "remoteId": "duplicate_request",
                    }
                )
            await replace_state(page, changed)
            await expect(page.get_by_test_id("money-bank-match")).to_have_count(0)
            await replace_state(page, saved)
            await expect(page.get_by_test_id("money-bank-match")).to_be_visible()
        check(
            True, label("matching requires a saved request, collectible balance and one unambiguous document")
        )
        await page.get_by_test_id("money-bank-activity").scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT / f"{width}-review.png"))
        await page.get_by_test_id("money-bank-match").click()
        await expect(page.get_by_test_id("money-bank-transaction")).to_have_count(5)
        await page.wait_for_function(
            "key => JSON.parse(localStorage.getItem(key)).receipts.some(r=>r.source==='prometeo'&&r.reference==='SYNTHETIC-BANK-RECEIPT')",
            arg=KEY,
        )
        current = await state(page)
        receipt = next(
            receipt for receipt in current["receipts"] if receipt["reference"] == "SYNTHETIC-BANK-RECEIPT"
        )
        check(
            len(match_calls) == 1 and receipt["amountMinor"] == 2000 and receipt["invoiceId"] == target["id"],
            label(
                "Check payment posts exact IDs once and imports the returned bank evidence into its invoice"
            ),
        )
        await page.get_by_test_id("money-bank-activity").get_by_role("button", name="All", exact=True).click()
        await expand("2" * 64)
        await expect(page.get_by_test_id("money-bank-transaction-detail")).to_contain_text(
            "Matched to request"
        )
        await page.evaluate("location.hash = '#/money'")
        await page.reload(wait_until="domcontentloaded")
        await expect(page.get_by_test_id("money-bank-balance")).to_have_attribute(
            "data-amount-minor", "987654"
        )
        current = await state(page)
        check(
            len(
                [
                    receipt
                    for receipt in current["receipts"]
                    if receipt["reference"] == "SYNTHETIC-BANK-RECEIPT"
                ]
            )
            == 1,
            label("reload preserves one matched bank receipt and retrieves the connected balance"),
        )

        await page.get_by_test_id("money-transactions-card").click()
        await page.get_by_test_id("money-bank-activity").scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT / f"{width}-transactions.png"))
        check(
            await page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
            label("bank dashboard and activity stay within the viewport"),
        )
        hold = True
        await page.get_by_role("button", name="Refresh bank transactions").click()
        await asyncio.wait_for(holding.wait(), 10)
        reset = True
        await page.evaluate(
            """key=>{const oldValue=localStorage.getItem(key);localStorage.removeItem(key);
          window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:null}));}""",
            WORKSPACE_KEY,
        )
        await expect(page.get_by_test_id("money-bank-chart")).to_have_count(0)
        await expect(page.get_by_text("Synthetic seller account", exact=False)).to_have_count(0)
        release.set()
        await page.wait_for_timeout(300)
        await expect(page.get_by_test_id("money-bank-chart")).to_have_count(0)
        await expect(page.locator('[data-movement-id="' + "2" * 64 + '"]')).to_have_count(0)
        await page.evaluate("location.hash='#/money'")
        await page.get_by_test_id('money-overview').wait_for()
        await expect(page.get_by_test_id('money-bank-chart')).to_have_count(0)
        await expect(page.get_by_text('Synthetic seller account', exact=False)).to_have_count(0)
        current = await state(page)
        check(
            reset
            and not any(receipt["source"] == "prometeo" for receipt in current["receipts"])
            and not any(request.get("remoteId") for request in current["requests"]),
            label(
                "workspace reset clears mounted private bank data, receipts and request bindings and rejects the late feed"
            ),
        )
        if errors or unexpected:
            print(
                json.dumps({"browser_errors": errors, "unexpected_fixture_operations": unexpected}),
                flush=True,
            )
        check(
            not errors and not unexpected,
            label("zero browser errors and only declared owner API fixture operations"),
        )
    except Exception:
        await page.screenshot(path=str(OUT / f"{width}-failure.png"))
        print((await page.locator("body").inner_text())[-2800:], flush=True)
        raise
    finally:
        release.set()
        await context.close()


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            try:
                for width in (1600, 390):
                    await run(browser, width)
            finally:
                await browser.close()
    finally:
        (OUT / "result.json").write_text(
            json.dumps({"mode": "isolated owner HTTP fixtures", "checks": CHECKS}, indent=2)
        )


if __name__ == "__main__":
    asyncio.run(main())
