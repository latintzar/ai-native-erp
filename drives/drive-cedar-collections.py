#!/usr/bin/env python3
"""Exercise Cedar UI and isolated collections HTTP service with external providers blocked.

Run the UI locally, then:
ROCOTO_URL=http://127.0.0.1:8094/app.html .venv/bin/python drives/drive-cedar-collections.py
The service uses a temporary encrypted store and generated in-memory operator credentials.
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
from urllib.parse import urlsplit

import httpx
import uvicorn
from cryptography.fernet import Fernet
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app/src/prototypes/copper"))
from runtime.config import Settings  # noqa: E402

URL = os.getenv("ROCOTO_URL", "http://127.0.0.1:8094/app.html").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-collections-proof"))
KEY = "rocoto-cedar-money-v1:fish"
WORKSPACE_KEY = "rocoto-cedar-money-api-v1:fish"
SERVICE: dict = {}
CHECKS: list[str] = []

_spec = importlib.util.spec_from_file_location("cedar_ui_drive", ROOT / "drives/drive-cedar-money.py")
assert _spec and _spec.loader
ui = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ui)


def check(condition, label):
    if not condition:
        raise AssertionError(label)
    CHECKS.append(label)
    print(f"GREEN {label}", flush=True)


@asynccontextmanager
async def running_service(factory, directory):
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    listener.setblocking(False)
    origin = f"http://127.0.0.1:{listener.getsockname()[1]}"
    ui_origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    settings = Settings(Path(directory), origin, secrets.token_urlsafe(40), Fernet.generate_key().decode(),
                        cedar_allowed_origins=(ui_origin,))
    outbound = []

    def block_provider(request):
        outbound.append(request.url.host)
        raise httpx.ConnectError("Provider calls are blocked in this isolated proof", request=request)

    provider = httpx.AsyncClient(transport=httpx.MockTransport(block_provider))
    app = factory(settings, http_client=provider)
    SERVICE["app"] = app  # the running service, so a proof can provision what the UI reads (§247.2)
    server = uvicorn.Server(uvicorn.Config(app, log_level="critical", access_log=False, log_config=None))
    task = asyncio.create_task(server.serve(sockets=[listener]))
    try:
        async with asyncio.timeout(10):
            while not server.started:
                if task.done():
                    await task
                await asyncio.sleep(0.05)
        yield origin, settings, outbound
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


async def saved(page, expression):
    await page.wait_for_function("([key, expression]) => { const s = JSON.parse(localStorage.getItem(key)); return s && new Function('s', 'return ' + expression)(s); }", arg=[KEY, expression])
    return await ui.state(page)


async def seller_context(browser, api_origin, width):
    context = await browser.new_context(viewport={"width": width, "height": 844 if width < 700 else 1000},
                                        timezone_id="America/Lima", has_touch=width < 700)
    ui_origin = f"{urlsplit(URL).scheme}://{urlsplit(URL).netloc}"
    await context.grant_permissions(["clipboard-read", "clipboard-write"], origin=ui_origin)
    await context.add_init_script(ui.BOOT + "\nlocalStorage.setItem('rocoto-cedar-collections-base', " + json.dumps(api_origin) + ");")

    async def guard(route):
        request = route.request
        parsed = urlsplit(request.url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin == api_origin or (origin == ui_origin and not parsed.path.startswith("/api/")):
            await route.continue_()
        else:
            await route.fulfill(status=503, content_type="application/json", body='{"error":"isolated_drive"}')

    await context.route("**/*", guard)
    return context


async def run_flow(browser, api_origin, width):
    label = f"{width}px"
    context = await seller_context(browser, api_origin, width)
    buyer_context = await browser.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Lima")
    seller = await context.new_page()
    buyer = await buyer_context.new_page()
    seller.set_default_timeout(15000)
    buyer.set_default_timeout(15000)
    errors = []
    seller.on("pageerror", lambda error: errors.append(str(error)))
    buyer.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await seller.goto(URL + "#/money", wait_until="domcontentloaded")
        await seller.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)
        await seller.screenshot(path=str(OUT / f"{width}-money-overview.png"))
        local = await saved(seller, "s.examplesLoaded && s.invoices.length > 0")
        invoice = next(item for item in local["invoices"] if 0 < ui.balance(local, item) < item["amountMinor"])
        opening = ui.balance(local, invoice)
        # ⚠ 2026-09-11 · THE MONEY DOORS READ PROMETEO (§247.2). A local `payments: 'demo-connected'`
        # flag opens nothing now: the invoice card's acts stand only when the running service holds
        # an authorized receiving account, so this proof provisions one the way drive-cedar-fiscal.py
        # does — on the service, then a reload, then the balance card's own posture.
        await seller.wait_for_function("key=>Boolean(localStorage.getItem(key))", arg=WORKSPACE_KEY, timeout=30000)
        binding = await seller.evaluate("key => JSON.parse(localStorage.getItem(key))", WORKSPACE_KEY)

        def account_fixture(state):
            state["providers"]["prometeo"] = {"environment": "live", "credentials": {"api_key": "fixture"}}
            state["bank"].update(
                status="logged_in", key="fixture-session", provider="bbva_pers_pe",
                receiving_account={"number": "123456789", "currency": "PEN", "bank": "bbva",
                                   "name": "Drive receiving account", "balance_minor": 500000,
                                   "as_of": "2026-09-09T12:00:00Z"})

        SERVICE["app"].state.store.mutate(binding["id"], account_fixture)
        await seller.evaluate("key => { const s = JSON.parse(localStorage.getItem(key)); s.setup.bank = 'bbva'; s.setup.bankAccountLabel = 'Drive receiving account'; s.setup.consentAt = new Date().toISOString(); localStorage.setItem(key, JSON.stringify(s)); }", KEY)
        await seller.reload(wait_until="domcontentloaded")
        await seller.get_by_test_id("money-overview").wait_for(timeout=45000)
        await expect(seller.get_by_test_id("money-balance-card")).to_have_attribute("data-bank-posture", "ready")
        invoice_hash = f"#/money/invoices/{invoice['id']}"
        await ui.route(seller, invoice_hash, "money-invoice-detail")
        await seller.get_by_test_id("money-update-request").click()
        expression = f"s.requests.some(r => r.invoiceId === {json.dumps(invoice['id'])} && r.remoteId && !r.remotePending)"
        local = await saved(seller, expression)
        link = next(row for row in reversed(local["requests"]) if row["invoiceId"] == invoice["id"] and row.get("remoteId"))
        workspace = await seller.evaluate("key => JSON.parse(localStorage.getItem(key))", WORKSPACE_KEY)
        headers = {"Authorization": "Bearer " + workspace["token"]}
        request_path = f"/api/cedar/requests/{link['remoteId']}"
        check(link["url"].startswith(api_origin + "/collect/") and workspace["mode"] == "sample", f"{label}: UI creates a service-owned buyer URL")
        async with httpx.AsyncClient(base_url=api_origin) as http:
            initial = await http.get(request_path, headers=headers)
            check(initial.status_code == 200 and initial.json()["balance_minor"] == opening, f"{label}: service imports prior receipts and preserves remaining balance")
            check(initial.json()["confirmed_minor"] == 0 and initial.json()["sample_minor"] > 0, f"{label}: sample opening receipts retain their evidence source")
            await seller.get_by_test_id("money-copy-request").click()
            await saved(seller, f"s.requests.find(r => r.id === {json.dumps(link['id'])}).copiedAt")
            check(await seller.evaluate("navigator.clipboard.readText()") == link["url"], f"{label}: copied link is the API buyer URL")

            await buyer.goto(link["url"], wait_until="domcontentloaded")
            await expect(buyer.locator("#amount")).to_contain_text(f"{opening / 100:,.2f}")
            check(await buyer.evaluate("localStorage.length") == 0, f"{label}: separate buyer browser opens request with empty storage")
            public_path = urlsplit(link["url"]).path + "/status"
            public = (await http.get(public_path)).json()
            check("receipts" not in public and "workspace_id" not in public and "public_token" not in public,
                  f"{label}: buyer response omits private receipt fields and workspace credentials")
            check(all(set(row) <= {"amount_minor", "currency", "method", "source", "status", "created_at"}
                      for row in public["timeline"]), f"{label}: buyer timeline exposes only payment display fields")
            check(workspace["token"] not in await buyer.content(), f"{label}: buyer page contains zero owner credentials")
            await buyer.screenshot(path=str(OUT / f"{width}-buyer-opening.png"))
            await buyer.set_viewport_size({"width": 320, "height": 844})
            geometry = await buyer.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,right:document.querySelector('#amount').getBoundingClientRect().right})")
            check(geometry["scroll"] <= 320 and geometry["right"] <= 320,
                  f"{label}: buyer amount and page fit a 320px viewport")
            await buyer.screenshot(path=str(OUT / f"{width}-buyer-320-opening.png"))
            await buyer.set_viewport_size({"width": 390, "height": 844})

            receipt = {"amount_minor": 1, "currency": "PEN", "method": "transfer", "source": "manual", "reference": f"UNAUTHORIZED-{width}"}
            check((await http.get(request_path)).status_code == 401
                  and (await http.post(request_path + "/receipts", json=receipt)).status_code == 401,
                  f"{label}: owner reads and writes require workspace authorization")
            other = (await http.post("/api/cedar/workspaces", json={})).json()
            other_headers = {"Authorization": "Bearer " + other["token"]}
            check((await http.get(request_path, headers=other_headers)).status_code == 404
                  and (await http.post(request_path + "/receipts", json=receipt, headers=other_headers)).status_code == 404,
                  f"{label}: another workspace cannot read or mutate this request")
            spoof = await http.post(request_path + "/receipts", json={**receipt, "source": "prometeo"}, headers=headers)
            check(spoof.status_code == 422, f"{label}: caller cannot manufacture bank-confirmed receipt evidence")
            forged = await http.get(urlsplit(link["url"]).path.rsplit("/", 1)[0] + "/invalid-token/status")
            check(forged.status_code == 404, f"{label}: guessed buyer capability reveals no request")

            partial = max(1, opening // 3)
            await ui.record(seller, partial, f"UI-MANUAL-{width}")
            remaining = opening - partial
            await expect(seller.get_by_test_id("money-invoice-balance")).to_have_text(await ui.money_text(seller, remaining))
            observed = (await http.get(request_path, headers=headers)).json()
            check(observed["manual_minor"] == partial and observed["balance_minor"] == remaining
                  and observed["confirmed_minor"] == 0, f"{label}: UI manual receipt persists through real HTTP with distinct evidence")
            await expect(buyer.locator("#amount")).to_contain_text(f"{remaining / 100:,.2f}", timeout=10000)
            check(True, f"{label}: separate buyer browser polls the reduced balance automatically")
            await seller.reload(wait_until="domcontentloaded")
            await seller.get_by_test_id("money-invoice-detail").wait_for(state="visible")
            await expect(seller.get_by_test_id("money-invoice-balance")).to_have_text(await ui.money_text(seller, remaining))
            check(True, f"{label}: seller reload retains service request and receipt balance")

            final_receipt = {"amount_minor": remaining, "currency": "PEN", "method": "plin", "source": "sample", "reference": f"API-SAMPLE-{width}"}
            posted = await http.post(request_path + "/receipts", json=final_receipt, headers=headers)
            check(posted.status_code == 200 and posted.json()["status"] == "paid", f"{label}: independent API receipt settles the persisted invoice")
            # The seller must observe server state through its regular five-second poll.
            await expect(seller.get_by_test_id("money-invoice-balance")).to_have_text(await ui.money_text(seller, 0), timeout=15000)
            await expect(buyer.locator("#payment-status")).to_contain_text("Saldo cubierto", timeout=10000)
            check(True, f"{label}: seller and buyer poll the same final settlement")
            count = len(posted.json()["receipts"])
            duplicate = await http.post(request_path + "/receipts", json=final_receipt, headers=headers)
            check(duplicate.status_code == 200 and len(duplicate.json()["receipts"]) == count,
                  f"{label}: duplicate API receipt preserves history and settlement")
            wrong_owner_final = await http.get(request_path, headers=other_headers)
            check(wrong_owner_final.status_code == 404, f"{label}: settlement preserves workspace isolation")
            await seller.screenshot(path=str(OUT / f"{width}-seller-paid.png"))
            await buyer.screenshot(path=str(OUT / f"{width}-buyer-paid.png"))
            await buyer.set_viewport_size({"width": 320, "height": 844})
            check(await buyer.evaluate("document.documentElement.scrollWidth <= innerWidth"),
                  f"{label}: settled buyer timeline fits a 320px viewport")
            await buyer.screenshot(path=str(OUT / f"{width}-buyer-320-paid.png"))
            check(not errors, f"{label}: connected seller and buyer run without browser exceptions")
            return {"path": request_path, "headers": headers, "public_path": public_path, "receipt_count": count}
    except Exception:
        await seller.screenshot(path=str(OUT / f"{width}-seller-failure.png"))
        (OUT / f"{width}-seller-failure.txt").write_text(await seller.locator("body").inner_text())
        raise
    finally:
        await context.close()
        await buyer_context.close()


async def main():
    if urlsplit(URL).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local UI URL for this drive.")
    from runtime.cedar_service import create_app

    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    try:
        with tempfile.TemporaryDirectory(prefix="cedar-collections-") as directory:
            async with running_service(create_app, directory) as (origin, settings, outbound):
                async with async_playwright() as playwright:
                    browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"])
                    retained = []
                    widths = [int(os.environ["ROCOTO_ONLY"])] if os.getenv("ROCOTO_ONLY") else [1600, 390]
                    for width in widths:
                        retained.append(await run_flow(browser, origin, width))
                    await browser.close()
                # Reconstruct the application with the same private store/key, using fresh clients.
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(503))) as provider:
                    reopened = create_app(settings, http_client=provider)
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=reopened), base_url=origin) as http:
                        for item in retained:
                            owner = await http.get(item["path"], headers=item["headers"])
                            public = await http.get(item["public_path"])
                            check(owner.status_code == 200 and owner.json()["balance_minor"] == 0
                                  and len(owner.json()["receipts"]) == item["receipt_count"]
                                  and public.status_code == 200 and public.json()["status"] == "paid",
                                  "recreated service reads persisted owner and buyer settlement")
                check(outbound == [], "collections proof performs zero external provider calls")
    except Exception as error:
        failures.append(f"{type(error).__name__}: {error}")
        print("RED " + failures[-1], flush=True)
    (OUT / "result.json").write_text(json.dumps({"checks": CHECKS, "failures": failures, "ui": URL}, indent=2))
    print(f"{len(CHECKS)} GREEN / {len(failures)} RED · {OUT}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
