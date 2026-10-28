#!/usr/bin/env python3
"""THE HYBRID DEMO, ON THE REAL COLLECTION SERVICE (FEED-IA §251).

    ROCOTO_DIST=app/dist-hybrid .venv/bin/python drives/drive-cedar-hybrid.py

«it should be with mock data cos we still dont have rela prometeo but people dont need to know
 that. this is still admeo after all. a hybrid real.fake demo»            — Peter, 14 September 2026

Every other Cedar drive answers the collection API from inside its own file. This one does the
opposite: it starts the ACTUAL runtime process — `app/src/prototypes/copper`, uvicorn, SQLite, a
private mode-0600 configuration in a temporary directory — with `CEDAR_SAMPLE_BANK=1`, and points
the built app at it. So what these checks measure is the service a browser will meet on
`copper-demo.soyrocoto.com`, not a fixture of it. The run reaches no network: the runtime holds no
provider credentials, the app's own `rocoto-runtime-base` points at a dead port, and every request
outside the two loopback origins is refused by the page's route guard.

WHAT IT HOLDS. At 1600, 390 and 320: the Money dashboard's balance is the fixture's own arithmetic
to the centavo (the opening balance plus every seeded receipt, the same sum `money-projections.ts`
makes in the browser); the balance card names the house's account and mask; the working-capital card
is **Offered** with a ready bank rather than **Connect bank**; Settings → Connections reads the bank,
Yape & Plin and Electronic invoices as Connected; money setup opens at «Your account is connected»
in one step; the transactions card lists the seeded movements with their own references; a Delivery
Note prepares a payment, its request reaches the service and a recorded receipt reduces its balance;
a reload keeps all of it; and **Reset workspace data** returns the workspace to the seed.

RED FIRST. Run the same walk against the untouched build of `main`:

    ROCOTO_DIST=app/dist-export-review ROCOTO_SHOTS=/tmp/cedar-hybrid/red .venv/bin/python drives/drive-cedar-hybrid.py

`main`'s `readBankSnapshot` rejects `mode: 'sample'`, so the snapshot never lands, every Money door
reads **Connect bank**, and the balance falls back to the browser's own projection — the screenshot
Peter sent with §251. The first check of each width is red there and green here.

`ROCOTO_ONLY=1600` narrows the run to one width; `ROCOTO_SHOTS` selects the screenshot folder.
"""

from __future__ import annotations

import asyncio
import functools
import http.server
import json
import os
import secrets
import shutil
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-hybrid"))
ONLY = [int(value) for value in os.getenv("ROCOTO_ONLY", "").split(",") if value.strip().isdigit()]
COPPER = ROOT / "app/src/prototypes/copper"
SAMPLE = COPPER / "runtime/sample_bank_v1.json"
VENV = ROOT / ".venv/bin/python"
SCOPE = "fish"
KEY = f"rocoto-cedar-money-v1:{SCOPE}"
WORKSPACE_KEY = f"rocoto-cedar-money-api-v1:{SCOPE}"
CHECKS: list[str] = []


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):  # noqa: D102 - a drive keeps its own log
        pass


def serve_dist() -> tuple[str, socketserver.TCPServer]:
    root = DIST if DIST.is_absolute() else ROOT / DIST
    if not (root / "app.html").exists():
        raise SystemExit(f"Build the app first: no app.html under {root}")
    httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}", httpd


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def expected_ledger() -> dict:
    """The seeded ledger of this house, read from the file the service reads."""
    data = json.loads(SAMPLE.read_text())["fixture"]["collections"]
    account = next(row for row in data["accounts"] if row["scope"] == SCOPE)
    receipts = [row for row in data["receipts"] if row["scope"] == SCOPE]
    return {
        "account": account,
        "receipts": receipts,
        "mask": "•••• " + account["accountNumber"][-4:],
        "balanceMinor": account["openingBalanceMinor"] + sum(row["amountMinor"] for row in receipts),
    }


class Runtime:
    """The real collection service, in sample mode, on a private loopback port."""

    def __init__(self, ui_origin: str) -> None:
        from cryptography.fernet import Fernet

        self.port = free_port()
        self.origin = f"http://127.0.0.1:{self.port}"
        self.home = Path(tempfile.mkdtemp(prefix="cedar-hybrid-"))
        state = self.home / "state"
        state.mkdir(mode=0o700)
        self.config = self.home / "copper.env"
        self.config.write_text(
            "\n".join(
                [
                    f"COPPER_STATE_DIR={state}",
                    f"COPPER_PUBLIC_ORIGIN={self.origin}",
                    f"COPPER_ADMIN_TOKEN=drive-{secrets.token_urlsafe(48)}",
                    f"COPPER_ENCRYPTION_KEY={Fernet.generate_key().decode()}",
                    "COPPER_ALLOW_LIVE=0",
                    "CEDAR_SAMPLE_BANK=1",
                    f"CEDAR_ALLOWED_ORIGINS={ui_origin}",
                    "",
                ]
            )
        )
        self.config.chmod(0o600)
        self.process = subprocess.Popen(  # noqa: S603 - a repository path with fixed arguments
            [str(VENV), "-m", "runtime", "serve", "--config", str(self.config), "--port", str(self.port)],
            cwd=str(COPPER),
            env={**os.environ, "PYTHONPATH": str(COPPER)},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        self.wait()

    def wait(self) -> None:
        for _ in range(120):
            if self.process.poll() is not None:
                raise SystemExit(f"The collection service stopped: {self.process.communicate()[0][-2000:]}")
            try:
                with urllib.request.urlopen(self.origin + "/health", timeout=1) as answer:  # noqa: S310
                    if json.loads(answer.read())["status"] == "ok":
                        return
            except (urllib.error.URLError, OSError, ValueError, KeyError):
                time.sleep(0.25)
        raise SystemExit("The collection service never answered /health")

    def close(self) -> None:
        self.process.terminate()
        try:
            self.process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.process.kill()
        shutil.rmtree(self.home, ignore_errors=True)


def boot(collections: str) -> str:
    """A fresh workspace bound to the running collection service, on the fish book."""
    return f"""if (!sessionStorage.getItem('cedar-hybrid-drive')) {{
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config', JSON.stringify({{version:1,sector:['{SCOPE}'],cast:'{SCOPE}'}}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');
  localStorage.setItem('rocoto-cedar-collections-base', {json.dumps(collections + "/")});
  sessionStorage.setItem('cedar-hybrid-drive', 'ready');
}}"""


async def shot(page, width: int, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def money_state(page):
    return await page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


async def route(page, value: str, target: str) -> None:
    await page.evaluate("hash => { window.location.hash = hash; }", value)
    await page.get_by_test_id(target).first.wait_for(state="visible")


async def field(page, name: str):
    node = page.get_by_test_id(name)
    return (
        node
        if await node.evaluate("el => ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)")
        else node.locator("input,textarea,select").first
    )


async def fill(page, name: str, value: str) -> None:
    await (await field(page, name)).fill(value)


async def run(browser, width: int, url: str, ledger: dict, collections: str, results: list) -> None:
    def label(name: str) -> str:
        return f"{width}: {name}"

    context = await browser.new_context(
        viewport={"width": width, "height": 900 if width > 500 else 844},
        device_scale_factor=1,
        permissions=["clipboard-read", "clipboard-write"],
    )
    await context.add_init_script(boot(collections))
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda event: errors.append(str(event)))
    # Everything outside the built page and its own collection service is refused, so the walk
    # cannot reach a provider even by accident.
    await page.route(
        "**/*",
        lambda handler: asyncio.ensure_future(
            handler.continue_()
            if handler.request.url.startswith((url, collections))
            else handler.fulfill(status=503, content_type="application/json", body='{"detail":"isolated"}')
        ),
    )
    try:
        await page.goto(url + "/app.html#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=45000)

        # ── 1 · THE BALANCE IS THE FIXTURE'S OWN ARITHMETIC ─────────────────────────────────────
        balance = page.get_by_test_id("money-bank-balance")
        await expect(balance).to_have_attribute("data-amount-minor", str(ledger["balanceMinor"]), timeout=30000)
        check(True, label(f"the balance is the seeded ledger to the centavo ({ledger['balanceMinor']})"))
        await expect(page.get_by_test_id("money-balance-card")).to_have_attribute("data-bank-posture", "ready")
        card = await page.get_by_test_id("money-balance-card").inner_text()
        check(
            ledger["account"]["houseName"] in card and ledger["mask"] in card,
            label("the balance card names the house's own account and mask"),
        )
        check(
            "S/" in await balance.inner_text()
            and await balance.evaluate("node => getComputedStyle(node).whiteSpace") == "nowrap"
            and "tabular-nums" in await balance.evaluate("node => getComputedStyle(node).fontVariantNumeric"),
            label("the figure carries its currency on one line in tabular numerals"),
        )

        # ── 2 · THE WORKING-CAPITAL CARD IS OFFERED, NOT «CONNECT BANK» ─────────────────────────
        working = page.get_by_test_id("money-working-capital")
        await working.scroll_into_view_if_needed()
        await expect(working).to_have_attribute("data-bank-posture", "ready")
        words = await working.inner_text()
        check("Connect bank" not in words, label("the working-capital card stands on a connected bank"))
        check(
            await page.get_by_test_id("advance-status").inner_text() == "Offered",
            label("the advance is Offered on the seeded bank"),
        )
        await shot(page, width, "money-dashboard")

        # ── 3 · THE TRANSACTIONS CARD LISTS THE SEEDED MOVEMENTS ───────────────────────────────
        await page.get_by_test_id("money-bank-activity").scroll_into_view_if_needed()
        rows = page.get_by_test_id("money-bank-transaction")
        await expect(rows.first).to_be_visible(timeout=30000)
        shown = await rows.count()
        check(shown > 0, label(f"the transactions card lists the account's own movements ({shown})"))
        await rows.first.click()
        detail = await page.get_by_test_id("money-bank-transaction-detail").inner_text()
        check(
            any(row["reference"] in detail for row in ledger["receipts"]) and ledger["mask"] in detail,
            label("a movement states its own reference and the account it landed in"),
        )
        check(
            "Review" not in await page.get_by_test_id("money-bank-review-filter").inner_text(),
            label("every seeded movement is matched, so the review filter counts none"),
        )
        await shot(page, width, "bank-transactions")
        await rows.first.click()

        # ── 4 · EVERY CONNECTION CARD READS CONNECTED ──────────────────────────────────────────
        await route(page, "#/admin/connections", "payment-connection")
        for testid in ("payment-connection", "wallet-connection", "invoicing-connection"):
            await expect(page.get_by_test_id(testid)).to_contain_text("Connected")
        check(True, label("Connections reads the bank, Yape & Plin and invoicing as Connected"))
        check(
            ledger["account"]["houseName"] in await page.get_by_test_id("payment-connection").inner_text(),
            label("the bank card names the account the service answered with"),
        )
        await shot(page, width, "connections")

        # ── 5 · THE WALK LANDS ON THE CONNECTED STEP IN ONE PRESS ──────────────────────────────
        await route(page, "#/money/setup/payments", "setup-payment-ready")
        ready = await page.get_by_test_id("setup-payment-ready").inner_text()
        check(
            ledger["account"]["houseName"] in ready and ledger["mask"] in ready,
            label("money setup opens at «Your account is connected» with the account's own name"),
        )
        await shot(page, width, "setup-connected")

        # ── 6 · A DELIVERY NOTE PREPARES A PAYMENT ON THE REAL SERVICE ─────────────────────────
        before = await money_state(page)
        await page.evaluate("window.location.hash = '#/sales'")
        await page.locator('[data-testid^="open-"][data-feed-row]').first.wait_for(state="visible")
        sale_ids = await page.locator('[data-testid^="open-"][data-feed-row]').evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('data-feed-row'))"
        )
        invoiced = {invoice["saleId"] for invoice in before["invoices"]}
        chosen = None
        for sale_id in [item for item in sale_ids if item not in invoiced]:
            await page.evaluate("id => window.location.hash = '#/sales/' + encodeURIComponent(id)", sale_id)
            try:
                await page.get_by_test_id("money-issue-invoice").wait_for(state="visible", timeout=2500)
                chosen = sale_id
                break
            except Exception:  # noqa: BLE001 - the next Delivery Note is tried
                continue
        check(bool(chosen), label("a Delivery Note offers payment preparation"))
        await page.get_by_test_id("money-issue-invoice").click()
        await fill(page, "money-issue-address", "Av. Arequipa 1234, Lima")
        await page.get_by_test_id("money-confirm-issue").click()
        await page.wait_for_function(
            "([key, count]) => (JSON.parse(localStorage.getItem(key))?.invoices ?? []).length === count",
            arg=[KEY, len(before["invoices"]) + 1],
        )
        after = await money_state(page)
        invoice = next(row for row in after["invoices"] if row["saleId"] == chosen)
        request = next(row for row in reversed(after["requests"]) if row["invoiceId"] == invoice["id"])
        check(
            request["url"].startswith(collections + "/collect/") and request.get("remoteId"),
            label("the request carries the running service's own buyer link"),
        )
        await page.get_by_test_id("delivery-note-invoice-link").click()
        await page.get_by_test_id("money-invoice-detail").wait_for(state="visible")
        part = max(100, invoice["amountMinor"] // 3)
        reference = f"HYBRID-{width}-{chosen}"
        await page.get_by_test_id("money-record-payment").click()
        await page.get_by_test_id("money-receipt-dialog").wait_for(state="visible")
        check(
            await page.evaluate(
                "() => document.activeElement?.closest('[data-testid=\"money-receipt-dialog\"]') !== null"
            ),
            label("the receipt dialog opens with focus inside it"),
        )
        await fill(page, "money-receipt-amount", f"{part / 100:.2f}")
        await fill(page, "money-receipt-reference", reference)
        await page.get_by_test_id("money-save-receipt").click()
        await page.get_by_test_id("money-receipt-dialog").wait_for(state="hidden")
        await page.wait_for_function(
            "([key, ref]) => (JSON.parse(localStorage.getItem(key))?.receipts ?? []).some(r => r.reference === ref)",
            arg=[KEY, reference],
        )
        paid = await money_state(page)
        recorded = next(row for row in paid["receipts"] if row["reference"] == reference)
        check(
            recorded["amountMinor"] == part and recorded["status"] == "matched",
            label("the recorded receipt lands on the invoice at its own amount"),
        )
        history = page.locator('[data-testid="money-history-receipt"]').first
        check(
            await history.get_attribute("data-source") in {"manual", "demo-bank", "prometeo"},
            label("the receipt row carries its provenance as data rather than as a word"),
        )
        check(
            "Sample bank receipt" not in await page.get_by_test_id("money-history").inner_text(),
            label("the history says «Bank receipt», the merchant's own word"),
        )
        await shot(page, width, "invoice-recorded")

        # ── 7 · A RELOAD KEEPS THE WHOLE FLOW ──────────────────────────────────────────────────
        await page.reload(wait_until="domcontentloaded")
        await route(page, f"#/money/invoices/{invoice['id']}", "money-invoice-detail")
        reloaded = await money_state(page)
        check(
            any(row["reference"] == reference for row in reloaded["receipts"])
            and any(row["id"] == invoice["id"] for row in reloaded["invoices"]),
            label("a reload keeps the prepared invoice and its recorded payment"),
        )
        await route(page, "#/money", "money-bank-balance")
        await expect(page.get_by_test_id("money-balance-card")).to_have_attribute("data-bank-posture", "ready")
        check(True, label("the bank is still connected after a reload"))

        # ── 8 · RESET CEDAR RETURNS THE WORKSPACE TO THE SEED ───────────────────────────────────
        await route(page, "#/admin/app-settings", "seat-app-settings")
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await page.get_by_test_id("row-reset-workspace-data").click()
        await page.get_by_test_id("reset-card").wait_for(state="visible")
        await shot(page, width, "reset-question")
        await page.get_by_test_id("reset-confirm").click()
        await page.wait_for_url("**/#/sales", timeout=45000, wait_until="commit")
        await route(page, "#/money", "money-bank-balance")
        await expect(page.get_by_test_id("money-bank-balance")).to_have_attribute(
            "data-amount-minor", str(ledger["balanceMinor"]), timeout=30000
        )
        seeded = await money_state(page)
        check(
            all(row["reference"] != reference for row in seeded["receipts"])
            and len(seeded["invoices"]) == len(before["invoices"]),
            label("Reset Cedar returns the ledger to the seed"),
        )
        check(
            await page.evaluate("key => localStorage.getItem(key)", WORKSPACE_KEY) is not None,
            label("the reset workspace binds a fresh collection workspace that reads the seed again"),
        )
        await shot(page, width, "after-reset")

        assert not errors, errors
        results.append({"width": width, "status": "GREEN", "checks": len(CHECKS)})
    except Exception as failure:  # noqa: BLE001 - a drive records its own red
        OUT.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(OUT / f"{width}-failure.png"), full_page=True)
        (OUT / f"{width}-failure.txt").write_text(await page.locator("body").inner_text())
        results.append({"width": width, "status": "RED", "error": str(failure)[:1500],
                        "url": page.url, "errors": errors})
    print(json.dumps(results[-1]), flush=True)
    await context.close()


async def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    ledger = expected_ledger()
    url, httpd = serve_dist()
    service = Runtime(url)
    results: list[dict] = []
    try:
        async with async_playwright() as driver:
            browser = await driver.chromium.launch()
            try:
                for width in ONLY or (1600, 390, 320):
                    await run(browser, width, url, ledger, service.origin, results)
            finally:
                await browser.close()
    finally:
        service.close()
        httpd.shutdown()
    reds = [row for row in results if row["status"] == "RED"]
    (OUT / "result.json").write_text(json.dumps({"checks": CHECKS, "results": results}, indent=2))
    print(f"\nTOTAL {len(CHECKS)} GREEN / {len(reds)} RED")
    return 1 if reds else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
