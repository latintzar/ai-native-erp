#!/usr/bin/env python3
"""Capture a local app page and report browser errors. Requires Playwright and Chromium."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path


async def capture(url: str, output: Path, wait_ms: int) -> list[str]:
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            page = await browser.new_page(
                viewport={"width": 1600, "height": 1200}, device_scale_factor=2,
            )
            errors: list[str] = []
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = await page.goto(url, wait_until="networkidle")
            if response and response.status >= 400:
                errors.append(f"HTTP {response.status}: {url}")
            await page.wait_for_timeout(wait_ms)
            output.parent.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(output), full_page=True)
            return errors
        finally:
            await browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8080/", help="page served by make dev")
    parser.add_argument("--output", required=True, type=Path, help="PNG path, typically under /tmp")
    parser.add_argument("--wait-ms", type=int, default=1500)
    args = parser.parse_args()
    if args.wait_ms < 0:
        parser.error("--wait-ms must be zero or greater")
    errors = asyncio.run(capture(args.url, args.output, args.wait_ms))
    print(f"Screenshot: {args.output}")
    for error in errors:
        print(f"Browser error: {error}")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
