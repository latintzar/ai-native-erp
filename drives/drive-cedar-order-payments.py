#!/usr/bin/env python3
"""Order-owned checkout and automatic delivery contact on an isolated native runtime.

ROCOTO_DIST=app/dist-export-review .venv/bin/python drives/drive-cedar-order-payments.py
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("order_checkout", ROOT / "drives/drive-cedar-checkout.py")
assert _spec and _spec.loader
checkout = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(checkout)
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-order-payments/browser"))
CHECKS: list[str] = []
FAILURES: list[str] = []
PUBLISHED=os.getenv("ROCOTO_PUBLISHED")=="1"


@asynccontextmanager
async def payment_runtime():
    if PUBLISHED:
        target=json.loads((ROOT/"app/src/prototypes/cedar/money-runtime.json").read_text())
        if checkout.UI_ORIGIN not in target["uiOrigins"]:
            raise RuntimeError("Published proof requires the declared demo UI origin")
        yield target["apiOrigin"],None
    else:
        if urlsplit(checkout.UI_URL).hostname not in {"127.0.0.1","localhost","::1"}:
            raise RuntimeError("Use ROCOTO_PUBLISHED=1 for the declared live sample runtime")
        with tempfile.TemporaryDirectory(prefix="order-payments-") as directory:
            async with checkout.running_service(directory) as runtime:
                yield runtime



def check(ok, text):
    if not ok:
        raise AssertionError(text)
    CHECKS.append(text)
    print("GREEN " + text, flush=True)


async def run_width(browser, api_origin, width):
    context = await checkout.merchant_context(browser, api_origin, width)
    page = await context.new_page()
    page.on("pageerror", lambda error: print("BROWSER " + str(error).splitlines()[0], flush=True))
    try:
        await page.goto(checkout.UI_URL + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(timeout=60000)
        state = await checkout.saved(page, "s.examplesLoaded && s.invoices.length >= 24")
        chosen = None
        candidates=[i for i in state["invoices"] if i.get("collectionOnly") and i["issuedAt"][:10]==state["fixtureDay"] and i["dueAt"]==state["fixtureDay"] and checkout.balance_of(state,i)>0
                    and not next((r.get("sentAt") for r in state["requests"] if r["invoiceId"]==i["id"]),None)]
        print(f"PROOF {width}: {len(candidates)} collectible orders awaiting first contact",flush=True)
        for candidate in candidates[:40]:
            await checkout.ui.route(page,"#/sales/"+candidate["saleId"],"sale-detail")
            await expect(page.get_by_test_id("sale-detail")).to_have_attribute("data-sale",candidate["saleId"])
            print("SOURCE "+str(await page.get_by_test_id("sale-detail").get_attribute("data-state")),flush=True)
            if await page.get_by_test_id("do-send-now").count():
                await page.get_by_test_id("do-send-now").click()
                await expect(page.get_by_test_id("sale-detail")).to_have_attribute("data-state","sent")
            if await page.get_by_test_id("do-deliver").count():
                chosen=candidate
                break
        if chosen is None:
            raise AssertionError("A collectible order awaiting delivery supplies the real dispatch proof")
        await page.get_by_test_id("do-deliver").click()
        state=await checkout.saved(page,f"s.requests.some(r=>r.invoiceId==={json.dumps(chosen['id'])}&&r.dispatch?.by==='auto')")
        automatic=next(r for r in state["requests"] if r["invoiceId"]==chosen["id"])
        check(automatic["dispatch"]["reason"]=="delivery",f"{width}: actual delivery automatically sends the order payment link")
        await page.get_by_test_id("order-payment-actions").scroll_into_view_if_needed()
        await expect(page.get_by_test_id("payment-dispatch-status")).to_contain_text("on delivery")
        await page.screenshot(path=str(OUT/f"{width}-delivered.png"))
        await page.get_by_role("button",name="Open chat",exact=True).last.click()
        conversation=page.locator("[data-testid=chats-overlay]:not([inert])").first.locator(f"[data-testid=thread-view][data-thread-open={chosen['customerId']}]:visible").first
        await expect(conversation).to_contain_text(automatic["dispatch"]["text"])
        message=conversation.get_by_text(automatic["dispatch"]["text"],exact=True)
        await page.wait_for_timeout(500)
        await message.scroll_into_view_if_needed()
        await expect(message).to_be_in_viewport()
        await message.screenshot(path=str(OUT/f"{width}-customer-message-row.png"))
        await page.screenshot(path=str(OUT/f"{width}-customer-message.png"))
        check(True,f"{width}: automatic delivery contact appears in the actual customer conversation")
        await page.goto(checkout.UI_URL+"#/money/invoices/"+chosen["id"],wait_until="domcontentloaded")
        await checkout.ui.route(page, "#/money/invoices/" + chosen["id"], "money-invoice-detail")
        await page.get_by_test_id("money-invoice-detail").screenshot(path=str(OUT / f"{width}-order-payment.png"))
        await page.screenshot(path=str(OUT / f"{width}-viewport.png"))
        await page.wait_for_function("([key,id])=>JSON.parse(localStorage.getItem(key)).requests.some(r=>r.invoiceId===id&&r.remoteId&&!r.remotePending)",
                                     arg=[checkout.KEY,chosen["id"]],timeout=8000)
        check(True,f"{width}: the order owns its native checkout link automatically")
        check(await page.get_by_test_id("money-record-sent").count() == 0,f"{width}: payment sharing records its own action")
        anchor = page.get_by_test_id("money-request-preview")
        await expect(anchor).to_have_attribute("target","_blank")
        check(True,f"{width}: checkout opens through an actual new-tab anchor")
        await page.get_by_test_id("order-payment-actions").scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT / f"{width}-payment-actions.png"))
        check(await page.get_by_text("Accepted",exact=True).count()==0,f"{width}: fiscal acceptance follows actual provider evidence")
        await page.get_by_test_id("payment-hold").select_option("manual")
        await expect(page.get_by_test_id("payment-hold-reason")).to_contain_text("Held by you")
        await page.screenshot(path=str(OUT / f"{width}-held.png"))
        await page.get_by_test_id("payment-send-link").click()
        state=await checkout.saved(page,f"s.requests.some(r=>r.invoiceId==={json.dumps(chosen['id'])}&&r.dispatches?.some(d=>d.by==='manual'))")
        request=next(row for row in state["requests"] if row["invoiceId"]==chosen["id"])
        check(request["dispatches"][-1]["text"].endswith(request["url"]),f"{width}: the send owns its exact customer message and real link")
        async with page.expect_popup() as opened:
            await anchor.click()
        buyer=await opened.value
        await buyer.wait_for_load_state("domcontentloaded")
        await expect(buyer.locator("h1")).to_contain_text("Código de aprobación")
        await expect(buyer.locator("#order")).to_have_text("Pedido "+chosen["number"])
        await buyer.screenshot(path=str(OUT/f"{width}-buyer.png"))
        check(await buyer.locator("#copy-reference").count()==0,f"{width}: payment reference is bound automatically and remains a plain order detail")
        brand=await buyer.locator(".brand img").evaluate_all("nodes=>nodes.map(n=>({src:n.getAttribute('src'),loaded:n.complete&&n.naturalWidth>0,w:n.parentElement.getBoundingClientRect().width,h:n.parentElement.getBoundingClientRect().height}))")
        check(len(brand)==1 and brand[0]["src"]=="/assets/rocoto-mark.svg" and brand[0]["loaded"] and brand[0]["w"]>=44 and brand[0]["h"]>=44,f"{width}: checkout carries the product's actual Rocoto mark with a 44px link")
        geometry=await buyer.evaluate("()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,boxes:[...document.querySelectorAll('.box')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))})")
        check(geometry["scroll"]<=geometry["width"]+1,f"{width}: buyer checkout fits the viewport")
        check(all(row["w"]>=44 and row["h"]>=44 for row in geometry["boxes"]),f"{width}: each approval digit has a 44px target")
        await buyer.locator("#phone").fill("987654321")
        await checkout.paste_code(buyer,"123456")
        await buyer.locator("#pay").click()
        await expect(buyer.locator("#receipt")).to_be_visible(timeout=30000)
        await buyer.screenshot(path=str(OUT/f"{width}-buyer-paid.png"))
        state=await checkout.saved(page,f"s.receipts.some(r=>r.invoiceId==={json.dumps(chosen['id'])}&&r.receivedAt)")
        check(checkout.balance_of(state,chosen)==0,f"{width}: merchant payment settles on the shared poll")
        receipts=[row for row in state["receipts"] if row["invoiceId"]==chosen["id"]]
        expected_hour=await buyer.evaluate("at=>new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(at))",receipts[-1]["receivedAt"])
        check(await buyer.locator("#receipt-hour").inner_text()==expected_hour,f"{width}: buyer receipt uses the actual arrival in Lima time")
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-invoice-detail").wait_for(timeout=60000)
        state=await checkout.saved(page,f"s.receipts.some(r=>r.invoiceId==={json.dumps(chosen['id'])}&&r.receivedAt)")
        check([row["id"] for row in state["receipts"] if row["invoiceId"]==chosen["id"]]==[row["id"] for row in receipts],f"{width}: reload retains exactly the same receipt")
        await page.get_by_test_id("money-history").scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT/f"{width}-merchant-paid.png"))
        await buyer.close()
        await page.get_by_test_id("chats-launcher").first.click()
        overlay=page.locator("[data-testid=chats-overlay]:not([inert])").first
        await overlay.get_by_test_id("thread-"+chosen["customerId"]).first.click()
        conversation=overlay.locator(f"[data-testid=thread-view][data-thread-open={chosen['customerId']}]:visible").first
        expected=[automatic["dispatch"]["text"],request["dispatches"][-1]["text"]]
        for words in set(expected):
            await expect(conversation.get_by_text(words,exact=True)).to_have_count(expected.count(words))
        check(True,f"{width}: initial and manual customer messages each restore once after reload")
    except Exception as error:
        (OUT/f"{width}-error.txt").write_text(str(error))
        await page.screenshot(path=str(OUT/f"{width}-failure.png"))
        (OUT/f"{width}-failure.txt").write_text(await page.locator("body").inner_text())
        raise
    finally:
        await context.close()


async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with payment_runtime() as (api_origin,outbound):
        async with async_playwright() as playwright:
            browser=await playwright.chromium.launch(headless=True,args=["--no-sandbox"])
            for width in ([int(os.environ["ROCOTO_ONLY"])] if os.getenv("ROCOTO_ONLY") else [1600,390,320]):
                try:
                    await run_width(browser,api_origin,width)
                except Exception as error:
                    FAILURES.append(f"{width}: {type(error).__name__}: {str(error).splitlines()[0]}")
                    print("RED "+FAILURES[-1],flush=True)
            await browser.close()
        check(outbound is None or outbound == [],"the native proof uses its scoped sample account")
    (OUT/"result.json").write_text(json.dumps({"checks":CHECKS,"failures":FAILURES},indent=2))
    print(f"TOTAL {len(CHECKS)} GREEN / {len(FAILURES)} RED",flush=True)
    return bool(FAILURES)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
