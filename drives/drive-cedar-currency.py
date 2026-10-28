#!/usr/bin/env python3
"""Cedar's PEN display, invoice source and responsive currency lockups.

Each context owns disposable seeded data. API traffic is blocked.
"""

import asyncio
import json
import os
import re
from pathlib import Path

from playwright.async_api import async_playwright, expect

URL = os.getenv('ROCOTO_URL', 'http://127.0.0.1:8106/cedar/')
OUT = Path(os.getenv('ROCOTO_SHOTS', '/tmp/cedar-currency-proof'))
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
        for width in [1600, 390, 320]:
            context = await browser.new_context(viewport={'width': width, 'height': 1000 if width > 500 else 844})
            await context.route('**/api/**', lambda route: route.abort())
            await context.add_init_script("""if(!sessionStorage.currencyProof){
              localStorage.clear();localStorage.setItem('rocoto-app-front-door','months');
              localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
              localStorage.setItem('rocoto-runtime-base','http://127.0.0.1:9');sessionStorage.currencyProof='yes';
            }""")
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error, target=errors: target.append(str(error)))
            try:
                await page.goto(URL)
                await page.wait_for_url('**/#/sales', timeout=25000)
                for route in ['sales', 'stock', 'customers', 'money', 'money/invoices', 'money/payments', 'money/transactions', 'admin/data', 'admin/geography']:
                    await page.evaluate('(route)=>location.hash="#/"+route', route)
                    await page.wait_for_timeout(900)
                    if route == 'stock' and width < 500:
                        # The compact catalogue shows product identities; prices live in its sheet.
                        await page.get_by_text('Merluza', exact=True).first.click()
                        await expect(page.get_by_test_id('stock-sheet')).to_be_visible()
                        await page.wait_for_timeout(450)
                    if route == 'admin/geography' and width < 500:
                        await page.get_by_text('Gràcia', exact=True).first.click()
                        await expect(page.get_by_test_id('zone-name')).to_be_visible()
                        await page.wait_for_timeout(450)
                    body = await page.locator('body').inner_text()
                    if route == 'money/transactions' and await page.get_by_test_id('money-bank-setup-state').count():
                        # ⚠ 2026-09-11 · with no bank connected the transactions card is the setup
                        # state (one picture, one Connect bank); the soles read is the balance card's.
                        await page.evaluate('location.hash="#/money"')
                        await page.wait_for_timeout(600)
                        body = await page.locator('body').inner_text()
                    assert 'S/' in body, f'{route}: expected soles amounts'
                    assert not re.search(r'[€£]|\b(?:EUR|USD)\b', body), f'{route}: foreign currency in prepared merchant surface'
                    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'{route}: horizontal overflow'
                    results.append({'width': width, 'route': route, 'status': 'GREEN'})
                    if route in ['sales', 'money']:
                        await page.screenshot(path=str(OUT / f'{width}-{route}.png'))
                await page.evaluate('location.hash="#/money/invoices"')
                await page.get_by_test_id('money-invoice-row').first.click()
                await expect(page.get_by_test_id('money-source-amount')).to_have_attribute('data-source-currency', 'PEN')
                await expect(page.get_by_test_id('money-source-amount')).to_contain_text('S/')
                await expect(page.get_by_test_id('money-fx-rate')).to_have_count(0)
                assert not errors, errors
                results.append({'width': width, 'route': 'invoice-source', 'status': 'GREEN'})
            except Exception as error:
                results.append({'width': width, 'status': 'RED', 'url': page.url, 'error': str(error)[:1600], 'pageErrors': errors})
                await page.screenshot(path=str(OUT / f'{width}-failure.png'), full_page=True)
                (OUT / f'{width}-failure.txt').write_text(await page.locator('body').inner_text())
            await context.close()
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
    if any(result['status'] == 'RED' for result in results):
        raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
