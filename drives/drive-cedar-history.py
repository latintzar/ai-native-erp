#!/usr/bin/env python3
"""Ninety-day sales, bank and dossier reconciliation on the actual isolated collection runtime.

ROCOTO_DIST selects the UI. ROCOTO_PROOF_SOURCE selects a previous checkout's runtime for red.
The default runs all three viewports; ROCOTO_SHOTS retains the images and receipt of each check.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import tempfile
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.getenv('ROCOTO_PROOF_SOURCE', str(ROOT)))
OUT = Path(os.getenv('ROCOTO_SHOTS', '/tmp/cedar-history'))
PUBLISHED = os.getenv('ROCOTO_PUBLISHED') == '1'
spec = importlib.util.spec_from_file_location('history_checkout', SOURCE / 'drives/drive-cedar-checkout.py')
assert spec and spec.loader
checkout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checkout)
CHECKS: list[str] = []
FAILURES: list[str] = []


def check(condition: bool, name: str):
    (CHECKS if condition else FAILURES).append(name)
    print(('GREEN ' if condition else 'RED ') + name, flush=True)


async def run(browser, origin: str, width: int):
    context = await checkout.merchant_context(browser, origin, width)
    page = await context.new_page()
    page.set_default_timeout(45000)
    errors: list[str] = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        await page.goto(checkout.UI_URL + '#/money', wait_until='domcontentloaded')
        await page.get_by_test_id('money-bank-chart').wait_for()
        state = await checkout.saved(page, 's.examplesLoaded && s.invoices.length > 0')
        chart = page.get_by_test_id('money-bank-chart')
        await chart.scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT / f'{width}-dashboard.png'))
        await chart.screenshot(path=str(OUT / f'{width}-incoming.png'))
        points = [int(value) for value in (await page.get_by_test_id('money-bank-history-line').get_attribute('data-amounts-minor')).split(',')]
        check(len(points) == 14 and sum(value > 0 for value in points) >= 10 and len(set(points)) >= 8,
              f'{width}: Incoming money has varied takings across the fortnight')
        dates = sorted({row['at'][:10] for row in state['receipts']})
        check(len(dates) > 70 and (date.fromisoformat(dates[-1]) - date.fromisoformat(dates[0])).days >= 89,
              f'{width}: receipts cover ninety days from the sales book')
        bank = [row for row in state['receipts'] if row['source'] == 'demo-bank' and row['method'] != 'cash' and row['status'] == 'matched']
        bank_balance = int(await page.get_by_test_id('money-bank-balance').get_attribute('data-amount-minor'))
        check(await page.get_by_test_id('money-bank-balance').evaluate("""element => {
            const range = document.createRange(); range.selectNodeContents(element);
            const text = range.getBoundingClientRect(); const card = element.closest('section').getBoundingClientRect();
            return text.left >= card.left + 12 && text.right <= card.right - 12;
        }"""), f'{width}: the full ninety-day balance fits inside its card')
        check(bank_balance == 500000 + sum(row['amountMinor'] for row in bank),
              f'{width}: the runtime balance equals opening balance plus the browser bank ledger')
        await page.evaluate("location.hash='#/money/dossier'")
        await page.get_by_test_id('money-dossier').wait_for()
        prepared = date.fromisoformat(await page.get_by_test_id('money-dossier').get_attribute('data-prepared-day'))
        window_start = prepared - timedelta(days=89)
        recent = [row for row in bank if window_start.isoformat() <= row['at'][:10] <= prepared.isoformat()]
        check(int(await page.get_by_test_id('dossier-inflow').get_attribute('data-amount-minor')) == sum(row['amountMinor'] for row in recent),
              f'{width}: the dossier reads the same ninety-day inflow to the centavo')
        check(int(await page.get_by_test_id('dossier-closing-balance').get_attribute('data-amount-minor')) == bank_balance,
              f'{width}: the dossier and account close on the same balance')
        movement = page.get_by_test_id('dossier-movements')
        await movement.scroll_into_view_if_needed()
        await page.screenshot(path=str(OUT / f'{width}-dossier.png'))
        await page.evaluate("location.hash='#/money/credit'")
        await page.get_by_test_id('money-credit').wait_for()
        book = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-chase-v1:fish') || 'null')")
        rungs = sorted(len(row['sends']) for row in (book or {}).get('records', {}).values())
        check(rungs == [1, 2, 3], f'{width}: three aged orders carry the first, second and call rungs')
        check(sum(bool(row.get('disputed')) for row in state['invoices']) == 2, f'{width}: two disputed invoices stay in the aged ledger')
        await page.screenshot(path=str(OUT / f'{width}-aged.png'))
        check(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}: the aged ledger fits the viewport')
        await page.reload(wait_until='domcontentloaded')
        await page.get_by_test_id('money-credit').wait_for()
        reloaded = await checkout.state(page)
        check(reloaded['invoices'] == state['invoices'] and reloaded['receipts'] == state['receipts'], f'{width}: reload retains the source ledger')
        check(not errors, f'{width}: browser exceptions stay empty')
    except Exception as error:
        check(False, f'{width}: walk failed: {error}')
        await page.screenshot(path=str(OUT / f'{width}-failure.png'))
    finally:
        await context.close()


@asynccontextmanager
async def bank_runtime():
    if PUBLISHED:
        yield 'https://copper-demo.soyrocoto.com', []
    else:
        with tempfile.TemporaryDirectory(prefix='cedar-history-') as directory:
            async with checkout.running_service(directory) as value:
                yield value


async def main():
    checkout.UI_URL, httpd = checkout.ui.serve_dist()
    url = urlsplit(checkout.UI_URL)
    if PUBLISHED:
        if checkout.UI_URL != 'https://demo.soyrocoto.com/cedar/':
            raise ValueError('Published proof requires the declared development page.')
    elif url.hostname not in {'127.0.0.1', 'localhost', '::1'}:
        raise ValueError('Use a loopback build or select the declared published proof.')
    checkout.UI_ORIGIN = f'{url.scheme}://{url.netloc}'
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        async with bank_runtime() as (origin, outbound):
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
                for width in [1600, 390, 320]:
                    await run(browser, origin, width)
                await browser.close()
            if not PUBLISHED:
                check(not outbound, 'the proof stays on the isolated sample runtime')
    finally:
        if httpd:
            httpd.shutdown()
    (OUT / 'result.json').write_text(json.dumps({'checks': CHECKS, 'failures': FAILURES, 'source': str(SOURCE), 'published': PUBLISHED}, indent=2))
    print(f'{len(CHECKS)} GREEN / {len(FAILURES)} RED', flush=True)
    return bool(FAILURES)


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
