#!/usr/bin/env python3
"""Cedar entrance, existing-account setup and bounded assistant in isolated browsers."""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

URL = os.getenv('ROCOTO_URL', 'http://127.0.0.1:8107/cedar/').split('#')[0]
OUT = Path(os.getenv('ROCOTO_SHOTS', '/tmp/cedar-operations-hub'))
OUT.mkdir(parents=True, exist_ok=True)


async def main():
    if urlsplit(URL).hostname not in {'localhost', '127.0.0.1'}:
        raise SystemExit('Use a local isolated build.')
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox'], headless=True)
        for width in [1600, 390, 320]:
            context = await browser.new_context(viewport={'width': width, 'height': 1000 if width > 500 else 844}, timezone_id='America/Lima')
            await context.add_init_script("""if(!sessionStorage.operationsProof){localStorage.clear();
              localStorage.setItem('rocoto-app-front-door','months');
              localStorage.setItem('rocoto-app-config',JSON.stringify({version:4,cast:'fish',sector:['fish']}));
              localStorage.setItem('rocoto-runtime-base','http://127.0.0.1:9');
              sessionStorage.operationsProof='yes';}""")
            state = {'ready': True, 'blockers': [], 'meta': {'appId': '123', 'configId': '456', 'graphVersion': 'v23.0'},
                     'connection': {'wabaId': 'fixture-waba', 'phoneId': 'fixture-phone', 'number': '+15555550163', 'name': 'Connected business', 'coexistence': True, 'workspace': 'fish'},
                     'history': {'status': 'complete', 'progress': 100, 'messages': 0, 'conversations': 0, 'oldestAt': None, 'newestAt': None}}

            async def guard(route, _request=None, *, state=state):
                path = urlsplit(route.request.url).path
                if path == '/api/proof/session':
                    await route.fulfill(json={'ok': True})
                elif path == '/api/proof/state':
                    await route.fulfill(json=state)
                elif path == '/api/proof/intake':
                    await route.fulfill(json={'workspace': 'fish', 'messages': [], 'nextCursor': None})
                elif path.startswith('/api/') or urlsplit(route.request.url).hostname not in {'localhost', '127.0.0.1'} or ':9/' in route.request.url:
                    await route.abort()
                else:
                    await route.continue_()
            await context.route('**/*', guard)
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error, errors=errors: errors.append(str(error)))
            try:
                # First assertion also runs against the preceding build to demonstrate red.
                await page.goto(URL + '#/sales')
                # ⚠ 14 September 2026 · ONE MARK IN THE WINDOW (FEED-IA §253): the rail carries it
                # on a desk and the bar leads with the area's own name; on a phone, where the rail
                # is away, the bar keeps the mark and the word.
                if width <= 560:
                    await expect(page.get_by_test_id('workspace-brand')).to_have_text('Rocoto')
                else:
                    await expect(page.get_by_test_id('rail-logo')).to_have_count(1)
                    await expect(page.get_by_test_id('workspace-brand')).to_have_count(0)
                    await expect(page.get_by_test_id('area-title')).to_have_text('Sales')
                await expect(page.locator('[data-testid^=net-line-]')).to_have_count(0)
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                results.append({'width': width, 'check': 'Rocoto header and one review filter', 'status': 'GREEN'})
                await page.get_by_test_id('assistant-launcher').click()
                await page.get_by_test_id('assistant-composer-input').fill('How are sales today?')
                await page.get_by_test_id('assistant-composer-input').press('Enter')
                reply = page.locator('[data-testid=assistant-thread] article[data-role=copilot]').last
                await expect(reply).to_contain_text('S/', timeout=20000)
                await expect(reply.get_by_test_id('assistant-evidence')).not_to_have_attribute('open', '')
                await reply.get_by_test_id('assistant-evidence').locator('> summary').click()
                await expect(reply).to_contain_text('Workspace records')
                results.append({'width': width, 'check': 'record-grounded assistant and collapsed evidence', 'status': 'GREEN'})
                await page.goto(URL + '#/welcome')
                await expect(page.get_by_test_id('setup-close')).to_have_count(0)
                await expect(page.get_by_role('heading', name='Welcome, Peter')).to_be_visible()
                await expect(page.get_by_test_id('demo-start-selling')).to_contain_text('Open workspace')
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                for name in ['demo-view-onboarding', 'demo-start-selling']:
                    bounds = await page.get_by_test_id(name).evaluate('e=>({client:e.clientHeight,scroll:e.scrollHeight})')
                    assert bounds['scroll'] <= bounds['client'] + 1, bounds
                    arrow = await page.get_by_test_id(name).locator('svg').last.bounding_box()
                    assert arrow and arrow['width'] == 20, arrow
                await page.screenshot(path=str(OUT / f'{width}-entrance.png'), animations='disabled')
                results.append({'width': width, 'check': 'entrance hierarchy and Peter identity', 'status': 'GREEN'})
                await page.get_by_test_id('demo-view-onboarding').click()
                await expect(page.get_by_test_id('onboarding-connected-count')).to_have_text('1 connected')
                await expect(page.get_by_test_id('onboarding-channel-whatsapp')).to_contain_text('Connected')
                await page.get_by_test_id('onboarding-channel-whatsapp').click()
                await expect(page.get_by_test_id('whatsapp-existing-account')).to_contain_text('Connected business')
                await expect(page.get_by_test_id('whatsapp-existing-account')).to_contain_text('+15555550163')
                await page.screenshot(path=str(OUT / f'{width}-existing-account.png'), animations='disabled')
                await page.get_by_test_id('whatsapp-add-another').click()
                await expect(page.get_by_test_id('whatsapp-existing-account')).to_have_count(0)
                await page.get_by_test_id('whatsapp-connection').get_by_test_id('setup-back').click()
                await expect(page.get_by_test_id('whatsapp-existing-account')).to_be_visible()
                await page.get_by_test_id('whatsapp-connection-continue').click()
                await page.get_by_test_id('setup-bank-bbva').wait_for()
                saved = await page.evaluate("JSON.parse(localStorage.getItem('rocoto-cedar-onboarding-v1:fish'))")
                assert saved['channels'] == [{'channel': 'whatsapp', 'status': 'connected'}]
                assert not errors, errors
                results.append({'width': width, 'check': 'existing verified account, add/cancel, continue to bank', 'status': 'GREEN'})
                await page.goto(URL + '#/sales')
                await page.keyboard.press('Control+k')
                search = page.get_by_test_id('search-modal')
                await expect(search).to_be_visible()
                await expect(search).to_have_attribute('data-open-ms', '400ms')
                await expect(search).to_have_attribute('data-shut-ms', '400ms')
                await page.emulate_media(reduced_motion='reduce')
                assert await search.evaluate('e=>getComputedStyle(e).transitionDuration') == '0s'
                await page.keyboard.press('Escape')
                results.append({'width': width, 'check': '400 ms interaction and reduced-motion override', 'status': 'GREEN'})

                # ══ §247.2 · ONE CONNECTION STATE AT EVERY WHATSAPP ENTRANCE ══════════════════
                # «always we havbe to be super consistent and not fget people igo confusing menus
                #  when they shouldnt see them» — Peter, 11 September 2026.
                # The card asked `Boolean(state.connection)` without the workspace check onboarding
                # and the intake both applied, printed `company.whatsapp[0].number` when the
                # provider had issued none, and opened Team numbers for a channel that did not
                # exist. One capability answers all three now.
                await page.goto(URL + '#/admin/connections')
                card = page.get_by_test_id('whatsapp-connection-setup')
                await expect(card).to_contain_text('Connected')
                await expect(card).to_contain_text('+15555550163')
                await page.get_by_test_id('connection-more-settings').locator('> summary').click()
                await expect(page.get_by_test_id('add-number')).to_have_count(1)
                await expect(page.get_by_test_id('team-numbers-setup')).to_have_count(0)
                await page.screenshot(path=str(OUT / f'{width}-connections-bound.png'), animations='disabled')
                results.append({'width': width, 'check': 'the WhatsApp card and Team numbers read the bound connection', 'status': 'GREEN'})

                # THE CONNECTED INBOX OPENS ON THE ONE CHANNEL THAT IS CONNECTED. Both tabs used to
                # render unconditionally, so a workspace with neither channel met a two-item menu
                # and two Connect walls. A one-item menu is no choice either.
                await page.goto(URL + '#/sales')
                await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{}}))")
                inbox = page.get_by_test_id('connected-inbox')
                await inbox.wait_for(state='visible')
                await expect(inbox).to_have_attribute('data-connected', '1')
                await expect(inbox).to_have_attribute('data-channel', 'whatsapp')
                await expect(page.get_by_test_id('connected-inbox-switcher')).to_have_count(0)
                await page.screenshot(path=str(OUT / f'{width}-inbox-one-channel.png'), animations='disabled')
                results.append({'width': width, 'check': 'the inbox opens on the connected channel and offers no menu', 'status': 'GREEN'})

                # A CONNECTION BOUND TO ANOTHER HOUSE READS THE SAME WAY EVERYWHERE. After a house
                # switch Connections used to read ✓Connected while the onboarding tile beside it
                # read unconnected — same provider, same snapshot, two answers.
                # AND `partial` HAS TWO CAUSES WITH ONE ACT BETWEEN THEM. The workspace field is
                # written from the operator's CEDAR_PROOF_WORKSPACE_BINDINGS map and
                # `Store.bind_workspace` keeps an existing binding where it is, so «Finish setup»
                # beside a door promised a repair only an operator can make: Meta's walk returns
                # the same answer however often it is walked. This leg says where the account IS
                # set up and carries no act; the interrupted-walk leg below keeps both.
                other_house = 'This WhatsApp account is set up for another workspace.'
                state['connection'] = dict(state['connection'], workspace='meat')
                await page.goto(URL + '#/admin/connections')
                await page.reload()
                await expect(card).to_contain_text(other_house)
                await expect(card).not_to_contain_text('+15555550163')
                assert await card.evaluate('n => n.tagName') == 'DIV', 'the card stands still'
                await page.get_by_test_id('connection-more-settings').locator('> summary').click()
                await expect(page.get_by_test_id('add-number')).to_have_count(0)
                await expect(page.get_by_test_id('team-numbers-setup')).to_have_attribute('data-whatsapp-posture', 'partial')
                await expect(page.get_by_test_id('team-numbers-setup')).to_contain_text(other_house)
                await expect(page.get_by_test_id('team-numbers-connect')).to_have_count(0)
                await page.screenshot(path=str(OUT / f'{width}-connections-other-house.png'), animations='disabled')

                # ── EVERY ENTRANCE FOR THAT POSTURE SAYS THE SAME SENTENCE (13 September 2026) ──
                # The card stated the binding while the connected inbox and the composer still
                # offered «Finish setup» — a door into Meta's signup, which answers with the same
                # binding, because `Store.bind_workspace` keeps an existing one where it is. Every
                # entrance states where the account IS set up and carries the one act that leads
                # somewhere: Connections, where the operator repair is named.
                await page.goto(URL + '#/sales')
                await page.evaluate("window.dispatchEvent(new CustomEvent('rocoto:open-connected-inbox',{detail:{}}))")
                inbox_setup = page.get_by_test_id('whatsapp-setup-state')
                await inbox_setup.wait_for(state='visible')
                await expect(inbox_setup).to_have_attribute('data-whatsapp-posture', 'partial')
                await expect(inbox_setup).to_have_attribute('data-acts', 'no')
                await expect(inbox_setup).to_contain_text(other_house)
                await expect(inbox_setup).not_to_contain_text('Finish setup')
                inbox_door = page.get_by_test_id('whatsapp-open-setup')
                await expect(inbox_door).to_have_text('Open Connections')
                assert await inbox_door.evaluate('n => n.getBoundingClientRect().height') >= 44
                await page.screenshot(path=str(OUT / f'{width}-inbox-other-house.png'), animations='disabled')
                await inbox_door.click()
                await page.wait_for_timeout(400)
                assert page.url.endswith('#/admin/connections'), page.url
                await expect(page.get_by_test_id('whatsapp-connection-setup')).to_contain_text(other_house)
                await expect(page.get_by_test_id('whatsapp-connection')).to_have_count(0)
                results.append({'width': width, 'check': 'the inbox states the binding and its one act opens Connections', 'status': 'GREEN'})

                # ── AND THE COMPOSER, THE LAST ENTRANCE (14 September 2026, folds review) ──────
                # A WhatsApp conversation's composer used to offer «Finish setup» on this posture
                # too, and that press opened Meta's dialog reading «WhatsApp account linked» — the
                # contradiction §247.2 removes everywhere else. `ChannelLine` now reads the
                # capability's act flag: the sentence names the other house and the one act opens
                # Connections.
                # A fresh load: the inbox overlay the leg above opened would otherwise keep the
                # chats panel inert (`supportActive`), and its rows would never read as visible.
                await page.goto(URL + '#/sales')
                await page.reload()
                launcher = page.get_by_test_id('chats-launcher')
                await launcher.wait_for(state='visible')
                await page.wait_for_timeout(600)
                if await launcher.get_attribute('data-open') != 'yes':
                    await launcher.click()
                rows = page.locator('[data-thread]')
                await rows.first.wait_for(state='visible')
                composer_seen = False
                for index in range(min(await rows.count(), 12)):
                    await rows.nth(index).click()
                    await page.get_by_test_id('thread-view').wait_for()
                    await page.wait_for_timeout(400)
                    handoff = page.get_by_test_id('native-chat-handoff')
                    if await handoff.count() == 0 or await handoff.first.get_attribute('data-channel') != 'whatsapp':
                        continue
                    composer_seen = True
                    said = page.get_by_test_id('composer-channel-state')
                    await expect(said).to_contain_text(other_house)
                    await expect(said).not_to_contain_text('Finish setup')
                    door = page.locator('[data-testid$="-connect-whatsapp"]')
                    await expect(door).to_have_text('Open Connections')
                    await expect(door).to_have_attribute('data-acts', 'no')
                    assert await door.evaluate('n => n.getBoundingClientRect().height') >= 44
                    await page.screenshot(path=str(OUT / f'{width}-composer-other-house.png'), animations='disabled')
                    await door.click()
                    await page.wait_for_timeout(400)
                    assert page.url.endswith('#/admin/connections'), page.url
                    await expect(page.get_by_test_id('whatsapp-connection-setup')).to_contain_text(other_house)
                    break
                assert composer_seen, 'a WhatsApp conversation stands in the list'
                results.append({'width': width, 'check': 'the composer states the binding and its one act opens Connections', 'status': 'GREEN'})

                # THE OTHER CAUSE: a Meta walk left half way through IS this house's to finish, so
                # it keeps the word that resumes it and the door behind it.
                state['connection'] = None
                state['setup'] = {'status': 'interrupted', 'step': 'business', 'error': 'Continue with WhatsApp Business.'}
                await page.reload()
                await expect(card).to_contain_text('Finish setup')
                await expect(card).not_to_contain_text(other_house)
                assert await card.evaluate('n => n.tagName') == 'BUTTON', 'the half-finished walk keeps its door'
                await page.get_by_test_id('connection-more-settings').locator('> summary').click()
                await expect(page.get_by_test_id('team-numbers-connect')).to_contain_text('Finish setup')
                await page.screenshot(path=str(OUT / f'{width}-connections-halfway.png'), animations='disabled')
                state.pop('setup', None)
                results.append({'width': width, 'check': 'another workspace’s connection completes nothing here, and states what it is', 'status': 'GREEN'})

                # AND THE VISIT FLAG NEVER PRODUCES A ✓. `rocoto-cedar-whatsapp-selected-v1` was
                # written by the mere act of OPENING the setup dialog, before Meta had been asked
                # anything, and nothing anywhere cleared it.
                await page.evaluate("localStorage.setItem('rocoto-cedar-whatsapp-selected-v1','true')")
                state['connection'] = None
                await page.reload()
                journey = page.get_by_test_id('journey-card')
                await expect(journey).to_have_attribute('data-communication', 'setup')
                await expect(journey).to_have_attribute('data-whatsapp-posture', 'setup')
                await expect(card).to_contain_text('Connect WhatsApp')
                await expect(card).not_to_contain_text('+15555550163')
                await page.screenshot(path=str(OUT / f'{width}-visit-flag.png'), animations='disabled')
                assert not errors, errors
                results.append({'width': width, 'check': 'opening the door is a visit, and a visit completes no milestone', 'status': 'GREEN'})
            except Exception as error:
                results.append({'width': width, 'status': 'RED', 'error': str(error)[:2000], 'errors': errors})
                (OUT / 'results.json').write_text(json.dumps(results, indent=2))
                try:
                    await page.screenshot(path=str(OUT / f'{width}-failure.png'), animations='disabled', timeout=5000)
                    (OUT / f'{width}-failure.txt').write_text(await page.locator('body').inner_text())
                except Exception as capture_error:
                    results[-1]['capture_error'] = str(capture_error)[:500]
            await context.close()
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
    if any(row['status'] == 'RED' for row in results):
        raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
