#!/usr/bin/env python3
"""The lender dossier: the door on the Money dashboard, the document, the share (FEED-IA §249).

    ROCOTO_DIST=app/dist-dossier .venv/bin/python drives/drive-cedar-dossier.py

`ROCOTO_DIST` is served from a private loopback port; `ROCOTO_URL` overrides that with an already
served `app.html`. `ROCOTO_ONLY=1600` narrows the run to one width, `ROCOTO_BLOCKS=document`
narrows it to one block (`document`, `unconnected`, `reset`, comma separated) and `ROCOTO_SHOTS`
selects the screenshot folder.

«a dossier is a dossier. it's underlated to an action/loan.» — Peter, 14 September. So this drive
asserts a DOCUMENT and a SHARE, and nothing that approves, prices or offers anything.

SIX BLOCKS.

`run_document` walks the whole flow on a connected workspace at 1600, 390 and 320: the door on the
dashboard with its sentence and its one act, the page's six sections in order, and every figure
RECONCILED against the ledger this browser is holding — the invoiced total, the bank inflows, the
requests sent and paid, the success rate read back out of `rocoto-cedar-money-v1:fish`, and the
overdue count and amount read off the dashboard's own Invoices card, so the two surfaces are
measured against one ledger. Then **Share with lender**: the drive saves the actual downloaded PDF
and asserts its file name is `dossier-<workspace>-<day>.pdf`,
that the document title came back afterwards, that the share landed in
`rocoto-cedar-dossier-v1:fish`, and that «PDF prepared 14 Sept 09:46» stands on the page, survives a
reload and appears on the door. It finishes in print media, where the app around the document is
gone and the document alone stands on the paper.

`run_unconnected` answers nothing from the provider and holds the one line that changes: the
receiving account reads «Added at bank connection» while every other figure stands.

`run_reset` shares, presses Reset Cedar → Reset workspace data, and asserts the log returns to the
seed and the door with it.

`run_evidence` proves the source periods, requested amount and actual PDF at all three widths.
`run_export_recovery` holds the lazy-loading boundary, scoped amount updates and export retries.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

DIST = Path(os.getenv("ROCOTO_DIST", "app/dist-export-review"))
URL = os.getenv("ROCOTO_URL", "").split("#")[0]
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-dossier"))
DOSSIER_KEY = "rocoto-cedar-dossier-v1:fish"
WORKSPACE_KEY = "rocoto-cedar-money-api-v1:fish"
TOKEN = "d" * 64
AS_OF = "2026-09-14T12:00:00Z"
ACCOUNT = {
    "ready": True,
    "bank": "bbva",
    "account_label": "Cuenta corriente",
    "account_mask": "•••• 1234",
    "balance_minor": 2170968,
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
SECTIONS = ["identity", "movements", "collections", "order-book", "risk", "consents"]
CHECKS: list[str] = []
FAILURES: list[str] = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args) -> None:  # noqa: D102 - a drive keeps its own log
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


def boot(origin: str | None) -> str:
    """A fresh fish workspace. With an `origin`, it also holds the collection binding the fixture
    answers on, so `bankCapabilityOf` resolves and the receiving account is a provider's answer."""
    binding = (
        f"""
  localStorage.setItem('rocoto-cedar-collections-base', {json.dumps(origin + '/')});
  localStorage.setItem({json.dumps(WORKSPACE_KEY)}, JSON.stringify({{id:'workspace_fixture',token:{json.dumps(TOKEN)},mode:'sample',origin:{json.dumps(origin)}}}));"""
        if origin
        else ""
    )
    return f"""if (!sessionStorage.getItem('cedar-dossier-drive')) {{
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config', JSON.stringify({{version:1,sector:['fish'],cast:'fish'}}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');{binding}
  sessionStorage.setItem('cedar-dossier-drive', 'ready');
}}"""


# THE PRINT STUB. `window.print` opens the browser's own dialog, so the drive replaces it with a
# recorder that keeps the title the document carried at the moment of the press — which is the file
# name a person would be handed.
PRINT_STUB = """
window.__printed = [];
window.print = function () { window.__printed.push(document.title); };
"""

# THE LEDGER, READ OUT OF THE BROWSER. The same predicates `money-model` uses, restated here so the
# drive measures the rendered figures against the contract rather than against the module.
LEDGER = """
() => {
  const state = JSON.parse(localStorage.getItem('rocoto-cedar-money-v1:fish') || 'null');
  if (!state) return null;
  const collectible = (i) => i.status === 'accepted' || (i.origin === 'cedar' && i.status === 'draft');
  const ledger = state.invoices.filter((i) => collectible(i) && i.currency === 'PEN');
  const matched = (id) => state.receipts
    .filter((r) => r.invoiceId === id && r.status === 'matched')
    .reduce((sum, r) => sum + r.amountMinor, 0);
  const bank = state.receipts.filter((r) => r.status === 'matched' && r.source !== 'manual'
    && r.method !== 'cash' && r.currency === 'PEN');
  const day=document.querySelector('[data-prepared-day]')?.dataset.preparedDay;
  const peru=at=>new Date(Date.parse(at)-5*3600000).toISOString().slice(0,10);
  const from=day?new Date(Date.parse(day+'T12:00:00Z')-89*86400000).toISOString().slice(0,10):'';
  const effective=r=>r.source==='prometeo'?r.at:r.receivedAt??r.at;
  const inWindow=at=>!day||(peru(at)>=from&&peru(at)<=day);
  const issued=ledger.filter(i=>inWindow(i.issuedAt));
  const inflows=bank.filter(r=>inWindow(effective(r)));
  const ledgerIds=new Set(ledger.map(i=>i.id));
  const requestedIds=new Set(state.requests.filter(r=>r.sentAt&&ledgerIds.has(r.invoiceId)).map(r=>r.invoiceId));
  const paid = ledger.filter((i) => requestedIds.has(i.id)&&i.amountMinor - matched(i.id) <= 0).length;
  const requests = requestedIds.size;
  return {
    issuedMinor: issued.reduce((sum, i) => sum + i.amountMinor, 0),
    issuedCount: issued.length,
    inflowMinor: inflows.reduce((sum, r) => sum + r.amountMinor, 0),
    inflowCount: inflows.length,
    paid,
    requests,
    successBasisPoints: requests ? Math.round(paid * 10000 / requests) : 0,
  };
}
"""

# THE PAPER. In print media every sibling of the document's own ancestry is gone and the document
# stands; this reads that off the computed styles rather than off the stylesheet's text.
PAPER = """
() => {
  const document_ = window.document;
  const node = document_.querySelector('[data-testid="money-dossier"]');
  if (!node) return null;
  const hidden = [];
  const shown = [];
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    for (const child of parent.children) {
      if (child === node || child.hasAttribute('data-print-root')) continue;
      if (child.tagName === 'HEAD') continue;
      (getComputedStyle(child).display === 'none' ? hidden : shown).push(child.dataset.testid || child.tagName);
    }
  }
  const acts = document_.querySelector('[data-testid="money-dossier"] [data-print-hide]');
  return {
    hidden,
    shown,
    dossier: getComputedStyle(node).display,
    acts: acts ? getComputedStyle(acts).display : 'absent',
    sections: document_.querySelectorAll('[data-dossier-section]').length,
  };
}
"""


def check(condition: bool, name: str) -> None:
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print(f"GREEN {name}", flush=True)


async def shot(page, width: int, name: str) -> None:
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=False)


async def tall_shot(page, width: int, name: str) -> None:
    await page.screenshot(path=str(OUT / f"{width}-{name}.png"), full_page=True)


def guard_for(origin: str, connected: bool):
    """Every provider read is answered inside this file, so a run reaches no network."""

    async def guard(request_route) -> None:
        parsed = urlsplit(request_route.request.url)
        same_origin = f"{parsed.scheme}://{parsed.netloc}" == origin
        if same_origin and parsed.path.startswith("/api/cedar/"):
            if not connected:
                await request_route.fulfill(status=503, content_type="application/json", body='{"detail":"isolated_drive"}')
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

    return guard


async def open_workspace(browser, width: int, url: str, connected: bool):
    """One isolated context on the fish workspace, with the print recorder installed."""
    origin = f"{urlsplit(url).scheme}://{urlsplit(url).netloc}"
    context = await browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1000},
        has_touch=width < 700,
        timezone_id="America/Lima",
    )
    await context.add_init_script(boot(origin if connected else None))
    await context.add_init_script(PRINT_STUB)
    await context.route("**/*", guard_for(origin, connected))
    page = await context.new_page()
    page.set_default_timeout(15000)
    return context, page


async def numbers(page, testid: str) -> dict:
    node = page.get_by_test_id(testid)
    await node.first.wait_for(state="attached")
    return await node.first.evaluate("element => ({ ...element.dataset, text: element.textContent })")


async def rows(page, testid: str) -> list[dict]:
    return await page.locator(f'[data-testid="{testid}"]').evaluate_all(
        "list => list.map(element => ({ ...element.dataset, text: element.textContent }))"
    )


async def run_document(browser, width: int, url: str) -> None:
    """The door, the document, its figures against the ledger, the share and the paper."""

    def label(name: str) -> str:
        return f"{width}: {name}"

    context, page = await open_workspace(browser, width, url, connected=True)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money", wait_until="domcontentloaded")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=60000)

        # ── the door
        door = page.get_by_test_id("lender-door")
        await door.wait_for(state="visible")
        await door.scroll_into_view_if_needed()
        text = await door.inner_text()
        check(
            "Lender dossier" in text
            and "Your identity, movements, order book and risk signals in one document." in text,
            label("the door names the document and says what it holds"),
        )
        check(
            await page.get_by_test_id("lender-door-shared").count() == 0
            and await door.get_attribute("data-shared") == "pending",
            label("a workspace that has shared nothing yet carries the act alone"),
        )
        act = page.get_by_test_id("lender-door-open")
        box = await act.bounding_box()
        check(
            await act.inner_text() == "Share with lender" and box is not None and box["height"] >= 44,
            label("the door's one act is Share with lender, at 44 px"),
        )
        await shot(page, width, "door")

        # ── the document
        await act.click()
        await page.get_by_test_id("money-dossier").wait_for(state="visible")
        check(page.url.endswith("#/money/dossier"), label("the act lands on the document at #/money/dossier"))
        head = await page.get_by_test_id("money-dossier").inner_text()
        prepared_day = await page.get_by_test_id("money-dossier").get_attribute("data-prepared-day")
        check(
            "Peix Vilalta" in head and "RUC 20123456789" in head and "Prepared " in head and "Movements " in head,
            label("the head names the workspace, its RUC, the day and the window"),
        )
        order = await page.evaluate(
            "() => [...document.querySelectorAll('[data-dossier-section]')].map(node => node.dataset.testid)"
        )
        check(
            order == [f"dossier-{name}" for name in SECTIONS],
            label(f"the six sections stand in order · {order}"),
        )
        check(
            (await numbers(page, "dossier-account"))["text"] == "Cuenta corriente · •••• 1234",
            label("the receiving account is the provider's own answer"),
        )

        # ── every figure against the ledger this browser holds
        ledger = await page.evaluate(LEDGER)
        check(bool(ledger and ledger["issuedCount"] > 0), label(f"the seeded ledger is loaded · {ledger}"))
        issued = await numbers(page, "dossier-issued")
        inflow = await numbers(page, "dossier-inflow")
        check(
            int(issued["amountMinor"]) == ledger["issuedMinor"] and int(issued["count"]) == ledger["issuedCount"],
            label(f"Invoiced is the ledger's own total · {issued['amountMinor']}"),
        )
        check(
            int(inflow["amountMinor"]) == ledger["inflowMinor"] and int(inflow["count"]) == ledger["inflowCount"],
            label(f"Money in is the matched bank receipts · {inflow['amountMinor']}"),
        )
        requests = await numbers(page, "dossier-requests")
        paid = await numbers(page, "dossier-paid")
        rate = await numbers(page, "dossier-success-rate")
        check(
            int(requests["count"]) == ledger["requests"] and int(paid["count"]) == ledger["paid"]
            and int(rate["basisPoints"]) == ledger["successBasisPoints"],
            label(f"Collections counts the requests, the paid and the rate between them · {rate['text']}"),
        )
        balance = await numbers(page, "dossier-average-balance")
        closing = await numbers(page, "dossier-closing-balance")
        check(
            int(closing["amountMinor"]) >= int(balance["amountMinor"]) > 0
            and "Read across " in (await page.get_by_test_id("dossier-movements").inner_text()),
            label("the average daily balance states the window it was read across"),
        )
        customers = await rows(page, "dossier-top-customer")
        values = [int(row["amountMinor"]) for row in customers]
        shares = [int(row["basisPoints"]) for row in customers]
        check(
            len(customers) == 5 and values == sorted(values, reverse=True) and 0 < sum(shares) <= 10000,
            label(f"five customers stand in order of what they buy · {shares}"),
        )
        weekdays = await rows(page, "dossier-weekday")
        check(
            len(weekdays) == 7 and sum(int(row["basisPoints"]) for row in weekdays) == 10000,
            label("the weekday seasonality adds up to one hundred per cent"),
        )
        prices = await rows(page, "dossier-price")
        check(
            len(prices) == 3 and all(int(row["minMinor"]) <= int(row["averageMinor"]) <= int(row["maxMinor"]) for row in prices),
            label(f"the three products state a unit price range · {[row['product'] for row in prices]}"),
        )

        # The dashboard's own Invoices card and this document read ONE ledger.
        overdue = await numbers(page, "dossier-overdue")
        await page.evaluate("() => { window.location.hash = '#/money'; }")
        await page.get_by_test_id("money-overview").wait_for(state="visible")
        summary = await page.get_by_test_id("money-overdue-summary").inner_text()
        check(
            summary.startswith(f"{overdue['count']} overdue"),
            label(f"the dashboard and the dossier count one overdue set · {summary}"),
        )

        # ── the share
        await page.evaluate("() => { window.location.hash = '#/money/dossier'; }")
        await page.get_by_test_id("money-dossier").wait_for(state="visible")
        await tall_shot(page, width, "document")
        title_before = await page.title()
        async with page.expect_download() as downloaded:
            await page.get_by_test_id("dossier-share").click()
        download = await downloaded.value
        await download.save_as(OUT / f"{width}-document.pdf")
        shared = page.get_by_test_id("dossier-shared")
        await shared.wait_for(state="visible", timeout=4000)
        printed = [download.suggested_filename]
        check(
            len(printed) == 1 and printed[0] == f"dossier-peix-vilalta-{prepared_day}.pdf",
            label(f"the share produces the document, named for the workspace and the day · {printed}"),
        )
        check(await page.title() == title_before, label("the document title stays in place after the PDF download"))
        log = await page.evaluate("key => JSON.parse(localStorage.getItem(key) || 'null')", DOSSIER_KEY)
        shared_words = await shared.inner_text()
        check(
            bool(log) and log["version"] == 1 and log["scope"] == "fish" and len(log["shares"]) == 1
            and await shared.get_attribute("data-at") == log["shares"][0]["at"],
            label(f"the share is recorded once, at the recorded action instant · {log['shares'] if log else None}"),
        )
        check(shared_words.startswith("PDF prepared "), label(f"the head states the share · {shared_words}"))
        consents = await rows(page, "dossier-consent")
        check(
            any(row["kind"] == "share" and row["at"] == log["shares"][0]["at"] for row in consents),
            label(f"the share stands in the consent log · {[row['kind'] for row in consents]}"),
        )
        await shot(page, width, "shared")

        # ── the reload: the record survives, and the door reads it
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=60000)
        check(
            await page.get_by_test_id("dossier-shared").inner_text() == shared_words,
            label("the share survives a reload, word for word"),
        )
        await page.get_by_test_id("dossier-back").click()
        await page.get_by_test_id("money-overview").wait_for(state="visible")
        door_line = page.get_by_test_id("lender-door-shared")
        await door_line.wait_for(state="visible")
        check(
            await door_line.inner_text() == shared_words
            and await page.get_by_test_id("lender-door").get_attribute("data-shared") == "yes",
            label("the door states the same share the document does"),
        )
        await shot(page, width, "door-shared")

        # ── the paper
        await page.evaluate("() => { window.location.hash = '#/money/dossier'; }")
        await page.get_by_test_id("money-dossier").wait_for(state="visible")
        await page.emulate_media(media="print")
        paper = await page.evaluate(PAPER)
        check(
            bool(paper) and paper["dossier"] != "none" and paper["acts"] == "none"
            and len(paper["hidden"]) > 0 and paper["shown"] == [] and paper["sections"] == 6,
            label(f"on paper the document stands alone, its acts left off · hid {len(paper['hidden'])}"),
        )
        await tall_shot(page, width, "print")
        await page.emulate_media(media=None)
        check(not errors, label(f"the dossier runs without browser exceptions: {errors}"))
    except Exception as error:  # noqa: BLE001 - a drive reports the failure it stopped on
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await page.emulate_media(media=None)
        await tall_shot(page, width, "document-failure")
    finally:
        await context.close()


async def run_unconnected(browser, width: int, url: str) -> None:
    """One line changes when the provider answers nothing, and the document stands."""

    def label(name: str) -> str:
        return f"{width}: {name}"

    context, page = await open_workspace(browser, width, url, connected=False)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=60000)
        check(
            (await numbers(page, "dossier-account"))["text"] == "Added at bank connection",
            label("a workspace still to connect its bank states that act on the account line"),
        )
        order = await page.evaluate(
            "() => [...document.querySelectorAll('[data-dossier-section]')].map(node => node.dataset.testid)"
        )
        check(order == [f"dossier-{name}" for name in SECTIONS], label("the six sections stand in every bank posture"))
        ledger = await page.evaluate(LEDGER)
        issued = await numbers(page, "dossier-issued")
        check(
            int(issued["amountMinor"]) == ledger["issuedMinor"] > 0,
            label("the ledger's own figures stand with the provider out of reach"),
        )
        await page.evaluate("() => { window.location.hash = '#/money'; }")
        await page.get_by_test_id("money-overview").wait_for(state="visible")
        check(
            await page.get_by_test_id("lender-door").count() == 1,
            label("the door stands on the dashboard in every bank posture"),
        )
        await tall_shot(page, width, "unconnected")
        check(not errors, label(f"the unconnected posture runs without browser exceptions: {errors}"))
    except Exception as error:  # noqa: BLE001 - a drive reports the failure it stopped on
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await tall_shot(page, width, "unconnected-failure")
    finally:
        await context.close()


async def run_reset(browser, width: int, url: str) -> None:
    """Reset Cedar → Reset workspace data returns the share log to its seed, and the door with it."""

    def label(name: str) -> str:
        return f"{width}: {name}"

    context, page = await open_workspace(browser, width, url, connected=True)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=60000)
        await page.get_by_test_id("dossier-share").click()
        await page.get_by_test_id("dossier-shared").wait_for(state="visible", timeout=4000)
        check(
            bool(await page.evaluate("key => localStorage.getItem(key)", DOSSIER_KEY)),
            label("the share log holds this workspace's share before the reset"),
        )
        await page.evaluate("() => { window.location.hash = '#/admin/app-settings'; }")
        await page.get_by_test_id("seat-app-settings").wait_for(state="visible")
        await page.locator('[data-section="reset-cedar"]').scroll_into_view_if_needed()
        await page.get_by_test_id("row-reset-workspace-data").click()
        await page.get_by_test_id("reset-card").wait_for(state="visible")
        await page.get_by_test_id("reset-confirm").click()
        # The reset lands on a freshly loaded Cedar; wait on the hash AND the swept key, because a
        # `wait_for_url` armed after the navigation has already committed waits for a second one.
        await page.wait_for_function(
            "key => window.location.hash === '#/sales' && !localStorage.getItem(key)",
            arg=DOSSIER_KEY, timeout=60000)
        check(
            await page.evaluate("key => localStorage.getItem(key)", DOSSIER_KEY) is None,
            label("Reset workspace data returns the share log to its seed"),
        )
        await page.evaluate("() => { window.location.hash = '#/money'; }")
        await page.get_by_test_id("money-overview").wait_for(state="visible", timeout=60000)
        door = page.get_by_test_id("lender-door")
        await door.wait_for(state="visible")
        check(
            await door.get_attribute("data-shared") == "pending"
            and await page.get_by_test_id("lender-door-shared").count() == 0,
            label("the door returns to its own sentence after the reset"),
        )
        await shot(page, width, "reset")
        check(not errors, label(f"the reset runs without browser exceptions: {errors}"))
    except Exception as error:  # noqa: BLE001 - a drive reports the failure it stopped on
        FAILURES.append(label(f"{type(error).__name__}: {error}"))
        print("RED " + FAILURES[-1], flush=True)
        await tall_shot(page, width, "reset-failure")
    finally:
        await context.close()


# The blocks this drive can run. `run_unconnected` and `run_reset` measure a posture rather than a
# layout, so they walk one width unless `ROCOTO_ONLY` names another.

async def run_evidence(browser, width: int, url: str):
    """Gap item 4: every source/period, actual repayment arithmetic and downloaded PDF bytes."""
    def hold(condition: bool, name: str) -> bool:
        label = f"{width}: dossier evidence: {name}"
        (CHECKS if condition else FAILURES).append(label)
        print(("GREEN " if condition else "RED ") + label, flush=True)
        return condition

    context, page = await open_workspace(browser, width, url, True)
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=45000)
        await shot(page, width, "evidence-head")
        for section in SECTIONS:
            card = page.get_by_test_id(f"dossier-{section}")
            source = page.get_by_test_id(f"dossier-source-{section}")
            if hold(await source.count() == 1, f"money-dossier.tsx: {section} carries its source and period"):
                value = await source.inner_text()
                attrs = await source.evaluate("n => ({from:n.dataset.from,to:n.dataset.to})")
                hold(value.startswith("From ") and bool(attrs["from"]) and bool(attrs["to"]),
                     f"dossier.ts: {section} names its source and both period boundaries")
            await card.scroll_into_view_if_needed()
            await shot(page, width, f"evidence-{section}")
        amount = page.get_by_test_id("dossier-requested-advance")
        if hold(await amount.count() == 1, "money-dossier.tsx: the requested advance has its own field"):
            # Move one retained receipt into the previous calendar month: the amount, customer,
            # payment method and reference stay the book's own records.
            expected = await page.evaluate("""() => {
              const key='rocoto-cedar-money-v1:fish', state=JSON.parse(localStorage.getItem(key));
              const day=document.querySelector('[data-prepared-day]').dataset.preparedDay;
              const from=new Date(day+'T12:00:00Z');from.setUTCDate(1);from.setUTCMonth(from.getUTCMonth()-1);
              const to=new Date(day+'T12:00:00Z');to.setUTCDate(0);
              const stamp=new Date(from);stamp.setUTCDate(15);
              const first=state.receipts.find(r=>r.status==='matched');first.at=stamp.toISOString();first.receivedAt=stamp.toISOString();first.source='manual';
              localStorage.setItem(key,JSON.stringify(state));
              const peru=d=>new Date(new Date(d).getTime()-5*3600000).toISOString().slice(0,10);
              const total=state.receipts.filter(r=>r.status==='matched'&&r.currency==='PEN'
                &&peru(r.source==='prometeo'?r.at:r.receivedAt??r.at)>=from.toISOString().slice(0,10)&&peru(r.source==='prometeo'?r.at:r.receivedAt??r.at)<=to.toISOString().slice(0,10))
                .reduce((sum,r)=>sum+r.amountMinor,0);
              const request=Math.floor(total/4);
              return {total,request,ratio:Math.round(request*10000/total),from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
            }""")
            await page.reload(wait_until="domcontentloaded")
            await page.get_by_test_id("money-dossier").wait_for(state="visible")
            await amount.fill(f"{expected['request'] / 100:.2f}")
            await amount.blur()
            facts = await numbers(page, "dossier-capacity")
            hold(int(facts["requestedMinor"]) == expected["request"] and int(facts["takingsMinor"]) == expected["total"]
                 and int(facts["basisPoints"]) == expected["ratio"],
                 "dossier.ts: repayment capacity is the requested amount divided by the previous month's takings")
            await amount.scroll_into_view_if_needed()
            await shot(page, width, "evidence-capacity")
            box = await amount.bounding_box()
            hold(box is not None and box["height"] >= 44 and box["width"] >= 44,
                 "money-dossier.tsx: the requested amount has a 44px target")
            await page.reload(wait_until="domcontentloaded")
            await page.get_by_test_id("money-dossier").wait_for(state="visible")
            hold(await amount.input_value() == f"{expected['request'] / 100:.2f}",
                 "money-dossier.tsx: the requested advance survives a reload")
        downloads = []
        page.on("download", lambda download: downloads.append(download))
        await page.get_by_test_id("dossier-share").click()
        for _ in range(50):
            if downloads:
                break
            await page.wait_for_timeout(100)
        if hold(len(downloads) == 1, "money-dossier.tsx: Share with lender downloads one PDF"):
            download = downloads[0]
            day = await page.get_by_test_id("money-dossier").get_attribute("data-prepared-day")
            hold(download.suggested_filename == f"dossier-peix-vilalta-{day}.pdf",
                 "dossier.ts: the file name includes the workspace, date and .pdf extension")
            target = OUT / f"{width}-{download.suggested_filename}"
            await download.save_as(target)
            hold(target.read_bytes().startswith(b"%PDF-"), "dossier-pdf.ts: the download contains PDF bytes")
        bounds = await page.get_by_test_id("money-dossier").evaluate(
            "n=>({scroll:n.scrollWidth,width:n.clientWidth,right:n.getBoundingClientRect().right,viewport:innerWidth})")
        hold(bounds["scroll"] <= bounds["width"] + 1 and bounds["right"] <= bounds["viewport"] + 1,
             "money-dossier.tsx: the document fits its viewport")
    except Exception as error:
        hold(False, f"{type(error).__name__}: {error}")
        await shot(page, width, "evidence-failure")
    finally:
        await context.close()


async def run_export_recovery(browser, width: int, url: str):
    """The document keeps its scoped amount current and a failed font read can be retried."""
    def hold(condition: bool, name: str) -> bool:
        label = f"{width}: dossier recovery: {name}"
        (CHECKS if condition else FAILURES).append(label)
        print(("GREEN " if condition else "RED ") + label, flush=True)
        return condition

    context, page = await open_workspace(browser, width, url, True)
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url))
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=45000)
        hold(not any("dossier-pdf-" in request for request in requests),
             "dossier-pdf.ts: opening the dossier leaves PDF code outside the initial requests")
        amount = page.get_by_test_id("dossier-requested-advance")
        await amount.fill("1234.00")
        await amount.blur()
        await page.evaluate("""() => {
          const key='rocoto-cedar-dossier-v1:fish', log=JSON.parse(localStorage.getItem(key));
          log.requestedAdvanceMinor=432100;localStorage.setItem(key,JSON.stringify(log));
          dispatchEvent(new StorageEvent('storage',{key}));
        }""")
        await page.wait_for_timeout(100)
        hold(await amount.input_value() == "4321.00",
             "money-dossier.tsx: an amount saved in another tab updates the document")
        await page.evaluate("""() => {
          localStorage.removeItem('rocoto-cedar-dossier-v1:fish');
          dispatchEvent(new CustomEvent('rocoto:cedar-workspace-reset',{detail:{scope:'fish'}}));
        }""")
        await page.wait_for_timeout(100)
        hold(await amount.input_value() == "",
             "money-dossier.tsx: workspace reset clears the mounted requested amount")
        await amount.scroll_into_view_if_needed()
        await shot(page, width, "recovery-amount")
        font_pattern = "**/inter-latin-400-normal-*.woff"
        await page.route(font_pattern, lambda route: route.abort())
        downloads = []
        page.on("download", lambda download: downloads.append(download))
        button = page.get_by_test_id("dossier-share")
        box = await button.bounding_box()
        hold(box is not None and box["height"] >= 44 and box["width"] >= 44,
             "money-dossier.tsx: the PDF download has a 44px target")
        await button.click()
        await page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        shares = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-dossier-v1:fish') || 'null')?.shares || []")
        hold(len(shares) == 0 and len(downloads) == 0,
             "money-dossier.tsx: a font failure keeps the share log at its previous state")
        hold("Create the document again" in await page.get_by_role("alert").inner_text(),
             "money-dossier.tsx: the export error gives a retry instruction")
        await shot(page, width, "recovery-font")
        await page.unroute(font_pattern)
        async with page.expect_download() as download_event:
            await button.click()
        download = await download_event.value
        await download.save_as(OUT / f"{width}-recovered-{download.suggested_filename}")
        shares = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-dossier-v1:fish')).shares")
        hold(len(shares) == 1 and len(downloads) == 1,
             "money-dossier.tsx: retry creates one PDF and records one share")
        hold(any("dossier-pdf-" in request for request in requests),
             "dossier-pdf.ts: PDF code is requested by the download action")
    except Exception as error:
        hold(False, f"{type(error).__name__}: {error}")
        await shot(page, width, "recovery-failure")
    finally:
        await context.close()


async def export_cancel_case(browser, width: int, url: str, mode: str):
    """Reset while a PDF font is in flight keeps the former workspace's document private."""
    def hold(condition: bool, name: str) -> bool:
        label = f"{width}: dossier cancellation ({mode}): {name}"
        (CHECKS if condition else FAILURES).append(label)
        print(("GREEN " if condition else "RED ") + label, flush=True)
        return condition

    context, page = await open_workspace(browser, width, url, True)
    font_requested, release_font = asyncio.Event(), asyncio.Event()
    downloads = []
    page.on("download", lambda download: downloads.append(download))

    async def delayed_font(route):
        font_requested.set()
        await release_font.wait()
        # Cancellation may have already closed this request.
        with contextlib.suppress(Exception):
            await route.continue_()

    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=45000)
        await page.route("**/inter-latin-400-normal-*.woff", delayed_font)
        await page.get_by_test_id("dossier-share").click()
        await asyncio.wait_for(font_requested.wait(), timeout=15)
        # Reset events follow cleared storage; a scope switch follows the configuration store.
        await page.evaluate("""mode => {
          if(mode==='scope') {
            const key='rocoto-app-config', config=JSON.parse(localStorage.getItem(key));
            config.sector=['meat'];config.cast='meat';const newValue=JSON.stringify(config);
            localStorage.setItem(key,newValue);dispatchEvent(new StorageEvent('storage',{key,newValue}));
          } else {
            localStorage.removeItem('rocoto-cedar-dossier-v1:fish');
            if(mode==='storage') {
              const key='rocoto-cedar-money-v1:fish';localStorage.removeItem(key);
              dispatchEvent(new StorageEvent('storage',{key,newValue:null}));
            } else dispatchEvent(new CustomEvent('rocoto:cedar-workspace-reset',{detail:{scope:'fish'}}));
          }
        }""", mode)
        release_font.set()
        await page.wait_for_function("document.querySelector('[data-testid=dossier-share]')?.getAttribute('aria-busy') !== 'true'", timeout=15000)
        await page.wait_for_timeout(100)
        shares = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-dossier-v1:fish') || 'null')?.shares || []")
        hold(len(downloads) == 0, "money-dossier.tsx: reset cancels the pending document download")
        hold(len(shares) == 0, "money-dossier.tsx: the pending export preserves the reset share log")
        await shot(page, width, f"cancel-{mode}")
    except Exception as error:
        hold(False, f"{type(error).__name__}: {error}")
        await shot(page, width, f"cancel-{mode}-failure")
    finally:
        release_font.set()
        await context.close()


async def run_export_cancel(browser, width: int, url: str):
    for mode in ["reset", "storage", "scope"]:
        await export_cancel_case(browser, width, url, mode)


async def run_business_document(browser, width: int, url: str):
    """The founder's dossier design: a business document with operating evidence."""
    def hold(condition: bool, name: str) -> None:
        label = f"{width}: business dossier: {name}"
        (CHECKS if condition else FAILURES).append(label)
        print(("GREEN " if condition else "RED ") + label, flush=True)
    context, page = await open_workspace(browser, width, url, True)
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=60000)
        await shot(page, width, "business-head")
        hold(await page.get_by_test_id("dossier-masthead").count() == 1,
             "money-dossier.tsx: business identity leads a formal document masthead")
        hold(await page.get_by_test_id("dossier-record-depth").count() == 1,
             "dossier.ts: source record counts lead the report")
        hold(await page.get_by_test_id("dossier-executive-summary").count() == 1,
             "money-dossier.tsx: summary connects repeat business with operating records")
        numbers = await page.locator("[data-dossier-section-number]").all_text_contents()
        hold(numbers == ['01', '02', '03', '04', '05', '06'],
             "money-dossier.tsx: six evidence chapters have a stable reading order")
        for name in ['collections', 'order-book']:
            await page.get_by_test_id(f'dossier-{name}').scroll_into_view_if_needed()
            await shot(page, width, f'business-{name}')
        hold(await page.get_by_test_id("dossier-repeat-customers").count() == 1,
             "dossier.ts: repeat customer evidence is visible")
        hold(await page.get_by_test_id("dossier-payment-depth").count() == 1,
             "dossier.ts: partial payments and reminder outcomes are visible")
        hold(await page.get_by_test_id("dossier-payment-source").count() == 1,
             "dossier.ts: payment behaviour states its own receipt and reminder period")
        hold(await page.get_by_test_id("dossier-weekly-trading").count() == 1,
             "dossier.ts: weekly trading history is graphed from dated orders")
        fitting = await page.evaluate("""() => {const root=document.querySelector('[data-testid=money-dossier]');return root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth;}""")
        hold(fitting, "money-dossier.tsx: all report text fits the viewport")
        async with page.expect_download() as pending:
            await page.get_by_test_id('dossier-share').click()
        download = await pending.value
        await download.save_as(OUT / f'{width}-business-dossier.pdf')
    except Exception as exc:
        hold(False, str(exc))
    finally:
        await context.close()


async def run_operating_receipts(browser, width: int, url: str):
    """A real local record transition changes the dossier's payment evidence."""
    def hold(condition: bool, name: str) -> bool:
        label = f"{width}: operating records: {name}"
        (CHECKS if condition else FAILURES).append(label)
        print(("GREEN " if condition else "RED ") + label, flush=True)
        return condition

    context, page = await open_workspace(browser, width, url, True)
    try:
        await page.goto(url + "#/money/dossier", wait_until="domcontentloaded")
        await page.get_by_test_id("money-dossier").wait_for(state="visible", timeout=60000)
        depth = page.get_by_test_id("dossier-payment-depth")
        if not hold(await depth.count() == 1, "money-dossier.tsx: invoice-linked payment evidence exists"):
            await shot(page, width, "operating-red")
            return
        before = await depth.evaluate("n=>Object.fromEntries([...n.children].map(row=>[row.children[0].textContent,Number(row.children[1].textContent)]))")
        expected = await page.evaluate("""() => {
          const key='rocoto-cedar-money-v1:fish', state=JSON.parse(localStorage.getItem(key));
          const day=document.querySelector('[data-prepared-day]').dataset.preparedDay;
          const paid=id=>state.receipts.filter(r=>r.invoiceId===id&&r.status==='matched').reduce((sum,r)=>sum+r.amountMinor,0);
          const invoice=state.invoices.find(i=>i.status==='accepted'&&paid(i.id)>0&&paid(i.id)<i.amountMinor);
          const balance=invoice.amountMinor-paid(invoice.id),at=day+'T13:00:00Z';
          state.receipts.push({id:'dossier-operating-payment',invoiceId:invoice.id,amountMinor:balance,currency:'PEN',
            method:'cash',source:'manual',at:invoice.issuedAt,receivedAt:at,status:'matched',reference:'DOSSIER-OPERATING-PROOF'});
          localStorage.setItem(key,JSON.stringify(state));
          const chaseKey='rocoto-cedar-chase-v1:fish',chase=JSON.parse(localStorage.getItem(chaseKey));
          const record=chase.records[invoice.id]??{invoiceId:invoice.id,sends:[],auto:{on:false,everyHours:24,nextAt:null},flaggedAt:null};
          record.sends.push({at:day+'T12:00:00Z',step:1,channel:'email',text:'Payment reminder'});
          chase.records[invoice.id]=record;localStorage.setItem(chaseKey,JSON.stringify(chase));
          return {balance,invoiceId:invoice.id};
        }""")
        await page.reload(wait_until="domcontentloaded")
        await depth.wait_for(state="visible")
        after = await depth.evaluate("n=>Object.fromEntries([...n.children].map(row=>[row.children[0].textContent,Number(row.children[1].textContent)]))")
        hold(after['Split payments'] == before['Split payments'] + 1,
             "dossier.ts: cash receipt joins the earlier payment on the same invoice")
        hold(after['Part-paid invoices'] == before['Part-paid invoices'] - 1,
             "dossier.ts: the actual remaining balance leaves the partial-payment count")
        hold(after['Reminders recorded'] == before['Reminders recorded'] + 1,
             "dossier.ts: the recorded reminder is counted once")
        hold(after['Paid after a reminder'] == before['Paid after a reminder'] + 1,
             f"dossier.ts: recorded arrival settles {expected['invoiceId']} after its actual reminder")
        await depth.scroll_into_view_if_needed()
        await shot(page, width, "operating-green")
    except Exception as error:
        hold(False, f"{type(error).__name__}: {error}")
    finally:
        await context.close()


async def run_preparation(browser, width: int, url: str) -> None:
    """Completed PDF preparation is an action record; the accounting snapshot keeps its clock."""
    context, page = await open_workspace(browser, width, url, connected=True)
    def hold(ok, message):
        check(ok, f"{width}: PDF preparation · {message}")
    try:
        await context.add_init_script("""if (!sessionStorage.getItem('dossier-preparation-legacy')) {
          localStorage.setItem('rocoto-cedar-dossier-v1:fish', JSON.stringify({version:1, scope:'fish',
            shares:[{at:'2026-08-31T14:45:00.000Z'}], requestedAdvanceMinor:0}));
          sessionStorage.setItem('dossier-preparation-legacy','ready');
        }""")
        await page.goto(url + '#/money/dossier', wait_until='domcontentloaded')
        article = page.get_by_test_id('money-dossier')
        await article.wait_for(timeout=60000)
        accounting_day = await article.get_attribute('data-prepared-day')
        hold(await page.get_by_test_id('dossier-shared').inner_text() == 'PDF prepared 31 Aug 09:45',
             'legacy history keeps its instant and describes a prepared document')
        action = page.get_by_test_id('dossier-share')
        hold(await action.inner_text() == 'Share with lender', 'the founder action stays verbatim')
        started = await page.evaluate('Date.now()')
        async with page.expect_download(timeout=60000) as got:
            await action.click()
        download = await got.value
        first_pdf = OUT / f'{width}-prepared-zero.pdf'
        await download.save_as(first_pdf)
        finished = await page.evaluate('Date.now()')
        saved = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-dossier-v1:fish'))")
        stamp = saved['shares'][-1]['at']
        millis = datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp() * 1000
        hold(len(saved['shares']) == 2 and saved['shares'][0]['at'] == '2026-08-31T14:45:00.000Z',
             'the successful action appends to the compatible version1 history')
        hold(started <= millis <= finished, 'the completed action uses wall time after PDF generation')
        hold(await article.get_attribute('data-prepared-day') == accounting_day,
             'the financial snapshot retains its accounting day')
        line = page.get_by_test_id('dossier-shared')
        words = await line.inner_text()
        hold(words.startswith('PDF prepared ') and await line.get_attribute('data-at') == stamp,
             'the result labels the evidenced preparation')
        await line.scroll_into_view_if_needed()
        await shot(page, width, 'prepared-result')
        first_text = subprocess.check_output(['pdftotext', '-layout', str(first_pdf), '-'], text=True)
        (OUT / f'{width}-prepared-zero.txt').write_text(first_text)
        hold('Received last month' in first_text and 'Requested advance' not in first_text
             and 'Enter an advance amount' not in first_text,
             'a zero request exports measured takings without an invented request or editor instruction')
        hold('PDF prepared' in first_text and 'Shared with lender' not in first_text,
             'the PDF identifies prior preparation history precisely')
        await page.reload(wait_until='domcontentloaded')
        await page.get_by_test_id('money-dossier').wait_for(timeout=60000)
        hold(await page.get_by_test_id('dossier-shared').inner_text() == words,
             'reload preserves the exact action timestamp')
        await page.get_by_test_id('dossier-requested-advance').fill('2500')
        await page.get_by_test_id('dossier-requested-advance').blur()
        await page.wait_for_function("document.querySelector('[data-testid=dossier-capacity]')?.dataset.requestedMinor === '250000'")
        async with page.expect_download(timeout=60000) as got:
            await page.get_by_test_id('dossier-share').click()
        download = await got.value
        second_pdf = OUT / f'{width}-prepared-requested.pdf'
        await download.save_as(second_pdf)
        second_text = subprocess.check_output(['pdftotext', '-layout', str(second_pdf), '-'], text=True)
        (OUT / f'{width}-prepared-requested.txt').write_text(second_text)
        hold('Requested advance' in second_text and '2,500.00' in second_text
             and "of the previous month's takings" in second_text,
             'an authored positive request includes its actual amount and repayment ratio')
        hold(second_text.count('PDF prepared') == first_text.count('PDF prepared') + 1,
             'the next PDF includes the preceding completed preparation')
        await page.get_by_test_id('dossier-consents').scroll_into_view_if_needed()
        await shot(page, width, 'prepared-history')
        hold(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),
             'preparation and consent words fit the viewport')
    except Exception as error:
        hold(False, f'{type(error).__name__}: {error}')
    finally:
        await context.close()


BLOCKS = {
    "preparation": (run_preparation, None),
    "operating": (run_operating_receipts, None),
    "business": (run_business_document, None),
    "evidence": (run_evidence, None),
    "recovery": (run_export_recovery, None),
    "cancel": (run_export_cancel, None),
    "document": (run_document, None),
    "unconnected": (run_unconnected, 1600),
    "reset": (run_reset, 1600),
}


async def main() -> int:
    url, httpd = serve_dist()
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Use an isolated local app URL for this drive.")
    OUT.mkdir(parents=True, exist_ok=True)
    only = os.getenv("ROCOTO_ONLY")
    widths = [int(only)] if only else [1600, 390, 320]
    names = [name for name in os.getenv("ROCOTO_BLOCKS", "").split(",") if name] or list(BLOCKS)
    unknown = [name for name in names if name not in BLOCKS]
    if unknown:
        raise SystemExit(f"Unknown block(s) {unknown}; choose from {sorted(BLOCKS)}")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
        )
        for width in widths:
            for name in names:
                run, single = BLOCKS[name]
                if single is not None and not only and width != single:
                    continue
                await run(browser, width, url)
        await browser.close()
    if httpd:
        httpd.shutdown()
    (OUT / "result.json").write_text(json.dumps(
        {"url": url, "checks": CHECKS, "failures": FAILURES, "screenshots": str(OUT)}, indent=2))
    print(f"{len(CHECKS)} GREEN / {len(FAILURES)} RED · {OUT}", flush=True)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
