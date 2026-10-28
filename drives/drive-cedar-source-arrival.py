#!/usr/bin/env python3
"""A live provider order announces itself in Sales and its Open act reveals the exact row."""
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.async_api import async_playwright, expect

URL = os.getenv("ROCOTO_URL", "http://127.0.0.1:8107/cedar/")
OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-source-arrival"))
WORKSPACE, TOKEN, SID = "a" * 32, "b" * 64, "CA" + "1" * 32


async def main():
    assert urlsplit(URL).hostname in {"localhost", "127.0.0.1"}
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).isoformat()
    speech = {"id": "utterance-arrival", "track": "inbound", "speaker": 1,
              "start": 0, "end": 2, "text": "12 kg merluza", "final": True}
    call = {"sid": SID, "direction": "inbound", "from": "+15550000002",
            "to": "+15550000003", "startedAt": stamp, "endedAt": stamp,
            "status": "completed", "recordingCustody": "none"}
    choices = {"source_number": "+15550000003", "fallback_number": "",
               "recording": "notice", "live_transcription": True}
    ready = {"configured": True, "account_verified": True,
             "inbound_number": "+15550000003", "caller_id": "+15550000003",
             "caller_id_verified": True, "browser_ready": True,
             "forwarding_state": "verified", "transcription_ready": True}
    line = {"line_id": "line_" + "1" * 24, "mode": "commissioned",
            "setup": choices, "readiness": ready, "checks": {}}
    setup = {"workspace_id": WORKSPACE, "mode": "commissioned", "setup": choices,
             "readiness": ready, "checks": {}, "lines": [line],
             "default_line_id": line["line_id"]}
    event = {"id": "live-arrival", "sequence": 1, "call_sid": SID,
             "kind": "final_delta", "mode": "incremental", "created_at": stamp,
             "evidence": [speech]}
    release = asyncio.Event()
    reads = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--no-sandbox"])
        context = await browser.new_context(
            viewport={"width": 1600, "height": 1000}, timezone_id="America/Lima",
        )
        await context.add_init_script("""if (!sessionStorage.getItem('cedar-arrival-seeded')) {
          localStorage.clear();
          localStorage.setItem('rocoto-app-config',JSON.stringify({version:4,cast:'fish',sector:['fish']}));
          localStorage.setItem('rocoto-app-front-door','months');
          sessionStorage.setItem('cedar-arrival-seeded','yes');
        }""")

        async def guard(route):
            parsed = urlsplit(route.request.url)
            path = parsed.path
            body = None
            if path == "/api/cedar/access/workspaces":
                body = {"workspace_id": WORKSPACE, "access_token": TOKEN,
                        "expires_at": int(time.time()) + 3600}
            elif path == "/api/cedar/phone/setup":
                body = setup
            elif path == "/api/cedar/phone/calls":
                body = [call]
            elif path == "/api/cedar/phone/calls/active":
                body = []
            elif path == f"/api/cedar/phone/calls/{SID}/intake":
                await release.wait()
                after = int(parse_qs(parsed.query).get("after", ["0"])[0])
                pending = [event] if after < 1 else []
                body = {"call_sid": SID, "events": pending,
                        "next_cursor": max(after, 1), "has_more": False}
            elif path == "/api/cedar/orders/parse":
                reads.append(route.request.post_data_json)
                product = next(row for row in reads[-1]["products"]
                               if "merluza" in row["name"].lower())
                body = {"isOrder": True, "needsReply": True, "deliveryDay": None,
                        "mode": "model", "lines": [{"rawText": speech["text"],
                        "item": product["name"], "qty": 12, "unit": "kg",
                        "productId": product["id"], "confidence": "high"}],
                        "evidence": {"model": "fixture-model", "ms": 20, "tokens": 50}}
            if body is not None:
                await route.fulfill(json=body)
            elif path.startswith("/api/") or parsed.hostname not in {"localhost", "127.0.0.1"}:
                await route.abort()
            else:
                await route.continue_()

        await context.route("**/*", guard)
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(URL + "#/sales")
        await expect(page.get_by_test_id("river")).to_be_visible()
        await page.get_by_test_id("sales-filter-archived").click()
        release.set()

        notice = page.get_by_role("alert").get_by_text("New order from", exact=False)
        await expect(notice).to_be_visible(timeout=12000)
        buttons = page.get_by_role("alert").get_by_role("button", name="Open", exact=True)
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "source-arrival-notice-1600.png"), animations="disabled")
        await buttons.last.click()
        records = await page.evaluate("""JSON.parse(localStorage.getItem('rocoto-app-day'))
          .sectors.fish.events.filter(e=>e.kind==='source-arrive'&&e.channel==='phone')""")
        assert len(records) == 1 and len(reads) == 1
        row = page.locator(f'[data-river-row="{records[0]["sale"]}"]')
        await expect(row).to_be_visible()
        await expect(row).to_have_attribute("data-selected", "yes")
        await expect(page.get_by_test_id("river")).to_have_attribute("data-view", "all")
        await page.wait_for_timeout(500)
        box = await row.bounding_box()
        assert box and 0 <= box["y"] < 1000 and box["y"] + box["height"] <= 1000, box
        assert not errors, errors
        await page.screenshot(path=str(OUT / "source-arrival-open-1600.png"), animations="disabled")

        # A retained durable receipt is part of the initial book after reload. Even if its transport
        # cursor is lost, ledger dedupe keeps the model read at one and Sales opens without a notice.
        await page.evaluate("""Object.keys(localStorage).filter(key =>
          key.startsWith('rocoto-cedar-phone-intake')).forEach(key => localStorage.removeItem(key))""")
        await page.reload()
        await expect(page.get_by_test_id("river")).to_be_visible()
        await page.wait_for_timeout(3000)
        replay_notices = await page.get_by_text("New order from", exact=False).count()
        assert replay_notices == 0
        assert len(reads) == 1
        (OUT / "results.json").write_text(json.dumps({
            "status": "GREEN",
            "checks": [
                "durable live source announces a named order while its row is filtered out",
                "Open clears the filters and reveals the exact selected row in the viewport",
                "reload and cursor replay stay silent and do not repeat the model read",
            ],
        }, indent=2))
        print((OUT / "results.json").read_text())
        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
