#!/usr/bin/env python3
"""Real Cedar call-outbox consumer with isolated provider fixtures and zero external calls."""
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.async_api import async_playwright

URL = os.getenv('ROCOTO_URL', 'http://127.0.0.1:8107/cedar/')
OUT = Path(os.getenv('ROCOTO_SHOTS', '/tmp/cedar-phone-intake'))
WORKSPACE, TOKEN, SID = 'a' * 32, 'b' * 64, 'CA' + '1' * 32


async def main():
    assert urlsplit(URL).hostname in {'localhost', '127.0.0.1'}
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).isoformat()
    source = {'id': 'utterance1', 'track': 'inbound', 'speaker': 1, 'start': 0, 'end': 2,
              'text': '12 kg merluza', 'final': True}
    call = {'sid': SID, 'direction': 'inbound', 'from': '+15550000002', 'to': '+15550000003',
            'startedAt': stamp, 'endedAt': stamp, 'status': 'completed', 'recordingCustody': 'none'}
    choices = {'source_number': '+15550000003', 'fallback_number': '', 'recording': 'notice',
               'live_transcription': True}
    ready = {'configured': True, 'account_verified': True, 'inbound_number': '+15550000003',
             'caller_id': '+15550000003', 'caller_id_verified': True, 'browser_ready': True,
             'forwarding_state': 'verified', 'transcription_ready': True}
    line = {'line_id': 'line_' + '1' * 24, 'mode': 'commissioned', 'setup': choices, 'readiness': ready, 'checks': {}}
    evidence = {'workspace_id': WORKSPACE, 'mode': 'commissioned', 'setup': choices, 'readiness': ready,
                'checks': {}, 'lines': [line], 'default_line_id': line['line_id']}
    events = [
        {'id': 'history_1', 'sequence': 1, 'call_sid': SID, 'kind': 'full_transcript',
         'mode': 'historical', 'created_at': stamp, 'evidence': [source]},
        {'id': 'live_2', 'sequence': 2, 'call_sid': SID, 'kind': 'final_delta',
         'mode': 'incremental', 'created_at': stamp, 'evidence': [source]},
    ]
    reads = []
    checks = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='America/Lima')
        await context.add_init_script("""if(!sessionStorage.phoneIntakeProof){localStorage.clear();
          localStorage.setItem('rocoto-app-config',JSON.stringify({version:4,cast:'fish',sector:['fish']}));
          localStorage.setItem('rocoto-app-front-door','months');sessionStorage.phoneIntakeProof='ready';}""")

        async def guard(route):
            parsed = urlsplit(route.request.url)
            path = parsed.path
            body = None
            if path == '/api/cedar/access/workspaces':
                body = {'workspace_id': WORKSPACE, 'access_token': TOKEN, 'expires_at': int(time.time()) + 3600}
            elif path == '/api/cedar/phone/setup':
                body = evidence
            elif path == '/api/cedar/phone/calls':
                body = [call]
            elif path == '/api/cedar/phone/calls/active':
                body = []
            elif path == f'/api/cedar/phone/calls/{SID}/intake':
                after = int(parse_qs(parsed.query).get('after', ['0'])[0])
                body = {'call_sid': SID, 'events': [item for item in events if item['sequence'] > after],
                        'next_cursor': max(after, 2), 'has_more': False}
            elif path == '/api/cedar/orders/parse':
                assert route.request.headers.get('authorization') == f'Bearer {TOKEN}'
                reading = route.request.post_data_json
                reads.append(reading)
                product = next(row for row in reading['products'] if 'merluza' in row['name'].lower())
                body = {'isOrder': True, 'needsReply': True, 'deliveryDay': None, 'mode': 'model',
                        'lines': [{'rawText': source['text'], 'item': product['name'], 'qty': 12,
                                   'unit': 'kg', 'productId': product['id'], 'confidence': 'high'}],
                        'evidence': {'model': 'fixture-model', 'ms': 20, 'tokens': 50}}
            if body is not None:
                await route.fulfill(json=body)
            elif path.startswith('/api/') or parsed.hostname not in {'localhost', '127.0.0.1'}:
                await route.abort()
            else:
                await route.continue_()

        await context.route('**/*', guard)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await page.goto(URL + '#/sales')
            await page.wait_for_function("JSON.parse(localStorage.getItem('rocoto-app-day')||'null')?.sectors?.fish?.events?.some(e=>e.kind==='source-arrive'&&e.channel==='phone')", timeout=12000)
            records = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-app-day')).sectors.fish.events.filter(e=>e.kind==='source-arrive'&&e.channel==='phone')")
            assert len(records) == 1 and len(reads) == 1
            assert records[0]['phoneSource']['utterances'][0]['id'] == source['id']
            assert records[0]['phoneSource']['workspaceId'] == WORKSPACE
            assert records[0]['lines'][0]['qty'] == 12 and records[0]['occurredAt'] == stamp
            checks.append('live final speech creates one quoted order; imported full transcript stays history')
            await page.reload()
            await page.wait_for_timeout(3200)
            assert len(reads) == 1
            assert await page.evaluate("JSON.parse(localStorage.getItem('rocoto-app-day')).sectors.fish.events.filter(e=>e.kind==='source-arrive'&&e.channel==='phone').length") == 1
            checks.append('reload retains transcript metadata and resumes cursor without another model call')
            assert not errors, errors
            await page.screenshot(path=str(OUT / 'sales-390.png'), animations='disabled')
            (OUT / 'results.json').write_text(json.dumps({'status': 'GREEN', 'checks': checks}, indent=2))
            print(json.dumps(checks, indent=2))
        except Exception as error:
            (OUT / 'results.json').write_text(json.dumps({'status': 'RED', 'error': str(error), 'errors': errors}, indent=2))
            raise
        finally:
            await context.close()
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
