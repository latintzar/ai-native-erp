"""Opt-in browser capture through the declared Cedar development Deepgram endpoint.

ROCOTO_LIVE_DICTATION=1 ROCOTO_URL=http://127.0.0.1:8107/cedar/ python3 drives/drive-cedar-dictation-live.py
Uses repository fixture audio as a Chromium microphone and makes one real transcription request.
Other provider traffic is blocked. It appends words to a draft and sends no customer message.
"""
import asyncio
import json
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

URL = os.getenv('ROCOTO_URL', 'http://127.0.0.1:8107/cedar/').split('#')[0]
OUT = Path(os.getenv('ROCOTO_SHOTS', '/tmp/cedar-dictation-live'))
FIXTURE = Path(__file__).parent / 'fixtures/voices/voice-luis.mp3'


async def main():
    if os.getenv('ROCOTO_LIVE_DICTATION') != '1':
        raise SystemExit('Set ROCOTO_LIVE_DICTATION=1 to select one real development transcription.')
    assert urlsplit(URL).hostname in {'localhost', '127.0.0.1'}
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cedar-dictation-') as folder:
        wav = Path(folder) / 'microphone.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(FIXTURE),
                        '-ac', '1', '-ar', '48000', str(wav)], check=True)
        await capture(wav)


async def capture(wav: Path):
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream', f'--use-file-for-fake-audio-capture={wav}'])
        context = await browser.new_context(viewport={'width': 1200, 'height': 900}, permissions=['microphone'])
        await context.add_init_script("""localStorage.setItem('rocoto-app-front-door','months');
          localStorage.setItem('rocoto-app-config',JSON.stringify({version:4,cast:'fish',sector:['fish']}));
          localStorage.setItem('rocoto-runtime-base',location.origin);""")
        responses = []
        async def guard(route):
            path = urlsplit(route.request.url).path
            if path == '/api/transcribe':
                response = await context.request.post('https://demo.soyrocoto.com/api/transcribe',
                    data=route.request.post_data_buffer,
                    headers={'Content-Type': route.request.headers['content-type']}, timeout=60000)
                body = await response.json()
                responses.append({'status': response.status, 'body': body})
                await route.fulfill(response=response)
            elif path.startswith('/api/') or urlsplit(route.request.url).hostname not in {'localhost', '127.0.0.1'}:
                await route.abort()
            else:
                await route.continue_()
        await context.route('**/*', guard)
        page = await context.new_page()
        await page.goto(URL + '#/sales')
        await page.get_by_test_id('assistant-launcher').click()
        field = page.get_by_test_id('assistant-composer-input')
        await field.fill('Order:')
        mic = page.get_by_test_id('assistant-composer-mic')
        await mic.scroll_into_view_if_needed()
        box = await mic.bounding_box()
        assert box
        await page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
        await page.mouse.down()
        await page.wait_for_timeout(3300)
        await page.mouse.up()
        await expect(page.get_by_test_id('assistant-composer')).to_have_attribute('data-dictation', 'said', timeout=60000)
        value = await field.input_value()
        assert value.startswith('Order: ') and len(value) > 15, value
        assert len(responses) == 1 and responses[0]['status'] == 200, responses
        await expect(page.locator('[data-testid=assistant-thread] article[data-role=user]')).to_have_count(0)
        await page.screenshot(path=str(OUT / 'dictated-draft.png'), animations='disabled')
        (OUT / 'result.json').write_text(json.dumps({'responses': responses, 'field': value}, indent=2))
        print(json.dumps({'status':'GREEN','provider':responses[0]['body'].get('provider'),'characters':len(value)}))
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
