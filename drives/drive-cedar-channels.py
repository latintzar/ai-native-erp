#!/usr/bin/env python3
"""FEED-IA §246 acceptance 5 — A CONVERSATION KEEPS ITS CHANNEL'S SEMANTICS.

Peter, 2026-09-10 (voice, transcribed):

  «Just think about whether any of the chats and stuff is actually appropriate. Some chats are
   WhatsApp-based or email-based, and think about what people are going to expect to see. Also,
   what are the places for each chat? If the chat screen is supposed to be crowded but it's not,
   ask if it's appropriate.»

WHAT THE APP DID BEFORE THIS. `source-thread.tsx` called any received turn without mail metadata
WhatsApp evidence, so a TELEPHONE order — a recording, from a customer who has never used WhatsApp
— came out as green bubbles under a «Send on WhatsApp» button; and `reply-channel.ts` moved a
WhatsApp reply into a mailbox on its own the moment the house's number was still being confirmed,
changing where a person's words were going without telling them.

THE LAW THIS FILE HOLDS, one line each:

  1 · a WhatsApp conversation shows WhatsApp identity and a WhatsApp composer, bound or being
      confirmed, and the line under the box states the send state in positive words
  2 · an email conversation keeps sender, subject, attachments and Reply, and Reply AIMS the
      composer at that message
  3 · the Delivery Note's own chip answers an email the same way
  4 · a telephone conversation is CALL RECORDS with an expandable transcript and a Call action,
      in the Delivery Note's chip AND in the Messages workspace, and it carries no composer at
      all — every customer turn on it is a record, recorded or written down; a portal account
      says where its orders come from and keeps an act
  5 · a mixed customer's turns render each by their own channel in ONE timeline, and the channel
      change is a press the person makes — reversible, and printed on the composer
  6 · at 390 the composer stays on screen with the keyboard up
  7 · the copy law over every string these surfaces render (§198-A), and zero page errors

Run from the repo root with
    ROCOTO_DIST=<built dist> [ROCOTO_SHOTS=<dir>] .venv/bin/python drives/drive-cedar-channels.py
    ROCOTO_URL=<served app.html>   red-proofs against a published build instead
    ONLY=1600                      one viewport

Built bundle only; a missing guard fails closed."""
import asyncio
import functools
import http.server
import json
import os
import pathlib
import re
import socketserver
import threading
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

DIST = pathlib.Path(os.environ['ROCOTO_DIST']) if os.environ.get('ROCOTO_DIST') else None
OUT = pathlib.Path(os.environ.get('ROCOTO_SHOTS', '/tmp/cedar-chats'))
OUT.mkdir(parents=True, exist_ok=True)
GREEN: list[str] = []
RED: list[str] = []

WHATSAPP_THREAD = 'manolo'    # a conversation that arrived on WhatsApp
EMAIL_THREAD = 'hotelrec'     # the hotel, whose orders arrive as mail
MIXED_THREAD = 'mixedhouse'   # seeded below: one WhatsApp turn and one email turn, one customer

VIEWPORTS = [(1600, 1000), (390, 844)]
if os.environ.get('ONLY'):
    only = int(os.environ['ONLY'])
    VIEWPORTS = [v for v in VIEWPORTS if v[0] == only] or [(only, 900)]


def check(ok, name, detail=''):
    (GREEN if ok else RED).append(name)
    print(('GREEN ' if ok else 'RED ') + name + ((' · ' + detail) if detail else ''), flush=True)


# ══ THE COPY LAW, READ OFF THE PAINTED SURFACE (§198-A) ═══════════════════════════════════════
NEGATIVES = re.compile(
    r"\b(?:no|not|nothing|never|nobody|none|cannot|can't|don't|doesn't|won't|isn't|aren't"
    r"|wasn't|weren't|hasn't|haven't|didn't|without|unless)\b", re.IGNORECASE)


def copy_law(said: str) -> list[str]:
    return sorted({m.group(0) for m in NEGATIVES.finditer(said)})


# ══ THE MIXED CUSTOMER, SEEDED AS REAL LEDGER EVENTS ══════════════════════════════════════════
# `source-arrive` is the app's own intake event and `day.ts` validates every field of it, so this
# fixture is the same object a real provider turn folds into — one customer id, two arrivals, two
# channels. Nothing here is a rendering hint: the rows carry `source.channel`, which is the fact
# `channelOfTurn` reads first.
def mixed_day() -> str:
    def arrival(sale, at, channel, text, ref):
        return {
            'kind': 'source-arrive', 'sale': sale, 'at': at, 'customer': MIXED_THREAD, 'offset': 0,
            'customerName': 'Peixateria Mixta', 'customerPhone': '+34655010203', 'text': text,
            'channel': channel, 'sourceEvent': ref, 'conversation': 'conv-' + MIXED_THREAD,
            'occurredAt': '2025-08-22T07:10:00Z', 'historical': False, 'lines': [],
        }
    # ⚠ TWO MAIL ARRIVALS ON ONE DAY, DELIBERATELY. `buildSales` gives a mail turn the subject
    #   «Order for <delivery day>», and both of these carry `offset: 0`, so the two mails share one
    #   subject — which is the shape the subject rule is about: it prints once.
    events = [
        arrival('mixed-wa', '08:10', 'whatsapp', 'Morning. Is there gamba roja today?', 'evt-wa-1'),
        arrival('mixed-mail', '09:40', 'email', 'Sending the week order by mail as agreed.', 'evt-mail-1'),
        arrival('mixed-mail-2', '10:20', 'email', 'One more line for the same day, if there is room.', 'evt-mail-2'),
    ]
    return json.dumps({'version': 2, 'sectors': {'fish': {
        'sector': 'fish', 'events': events, 'surfaced': [], 'confirmed': [],
        'answered': {}, 'always': [], 'released': [], 'notice': {},
    }}})


STUB = """
  window.__opened = [];
  window.open = function (...args) { window.__opened.push(String(args[0] || '')); return null; };
"""

# ── THE MAILBOX, STATED RATHER THAN LEFT TO THE NETWORK (§247.2) ──────────────────────────────
# «Reply by email instead» is an offer to move a person's words onto another channel, so since
# §247.2 it stands only where a mailbox is actually connected — the email capability's own `ready`
# posture. A drive that left `/email/status` to fail was asserting the offer against an accident.
MAILBOX_CONNECTED = {
    'provider': 'unipile', 'configured': True,
    'accounts': [{
        'account_ref': 'acct-fish', 'provider': 'google', 'mode': 'connected', 'status': 'connected',
        'label': 'pedidos@pescadosdelpuerto.example', 'revision': 1, 'history_complete': True,
        'synced_at': '2025-08-22T06:00:00Z', 'invoice_consent_at': None, 'forwarding_address': None,
    }],
}
MAILBOX_EMPTY = {'provider': 'unipile', 'configured': False, 'accounts': []}
# The channel API allocates a private workspace before any read; the fixture answers it so the
# mailbox status below is what the capability actually derives from.
CHANNEL_WORKSPACE = {'workspace_id': 'a' * 32, 'access_token': 'w' * 64, 'expires_at': 4102444800}


async def channel_routes(mailbox: bool, route):
    path = urlsplit(route.request.url).path
    if path.endswith('/access/workspaces'):
        await route.fulfill(json=CHANNEL_WORKSPACE)
    elif path.endswith('/email/status'):
        await route.fulfill(json=MAILBOX_CONNECTED if mailbox else MAILBOX_EMPTY)
    else:
        await route.fulfill(status=404, json={'detail': 'This fixture answers the mailbox status only.'})
CONFIG = ("localStorage.setItem('rocoto-app-front-door','months');"
          "localStorage.setItem('rocoto-app-config',JSON.stringify("
          "{version:2,sector:['fish'],cast:'fish',mailbox:{gmail:false,m365:false}}));")

# ── A TELEPHONE DRAFT, SEEDED ON PURPOSE (§246) ───────────────────────────────────────────────
# `phone-connection-config.ts` is localStorage-backed and its own note says `sourceNumber` sits
# OUTSIDE the provider-owned fields it protects — it is a number typed during PHONE setup. The
# WhatsApp composer used to print it as «WhatsApp · from +34 …», directly above a line saying
# WhatsApp was still being confirmed. Seeding it is what makes that defect visible: without a draft
# in the browser the line has nothing wrong to print.
PHONE_DRAFT = ("localStorage.setItem('rocoto-phone-connection-v1:fish',JSON.stringify({"
               "version:1,tenant:'fish',sourceNumber:'+34600111222',numberPath:'existing',ownerId:'',"
               "routingMode:'owner',ringGroupIds:[],schedule:'office-hours',fallbackNumber:'',"
               "fallbackVerification:'pending',recordingPosture:'metadata-only',forwardingAcknowledged:false,"
               "eligibilityState:'pending',regulatoryState:'pending',documentsState:'not-started',"
               "inventoryState:'not-reserved',inboundActivation:'not-run',outboundActivation:'not-run',"
               "providerState:'pending',prepared:true}));")


async def boot(browser, url, width, height, day=None, mailbox=False):
    page = await browser.new_page(viewport={'width': width, 'height': height}, has_touch=width < 700)
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.route('**/api/cedar/**', functools.partial(channel_routes, mailbox))
    seed = f"localStorage.setItem('rocoto-app-day', {json.dumps(day)});" if day else ''
    await page.add_init_script(STUB + "localStorage.clear();" + CONFIG + PHONE_DRAFT + seed)
    await page.goto(url + '#/sales', wait_until='networkidle')
    await page.wait_for_timeout(300)
    return page, errors


async def open_messages(page):
    overlay = page.locator('[data-testid=chats-overlay]:not([inert])')
    if not await overlay.count():
        await page.evaluate('() => { const s = document.scrollingElement; if (s) s.scrollTop = 0; }')
        for _ in range(4):
            try:
                await page.locator('[data-testid=chats-launcher]').click(timeout=4000)
            except Exception:
                await page.locator('[data-testid=chats-launcher]').evaluate('n => n.click()')
            await page.wait_for_timeout(520)
            if await overlay.count():
                break
    await overlay.first.wait_for(state='visible')
    back = overlay.first.locator('[data-testid=thread-back]')
    if await back.count():
        try:
            await back.first.click(timeout=4000)
        except Exception:
            await back.first.evaluate('n => n.click()')
    await overlay.first.locator('[data-testid=thread-list]').wait_for()
    narrow = overlay.first.locator('[data-testid=chats-narrow-all]')
    if await narrow.count():
        await narrow.first.click()
    await page.wait_for_timeout(320)


async def open_thread(page, who):
    await open_messages(page)
    overlay = page.locator('[data-testid=chats-overlay]:not([inert])').first
    await overlay.locator(f'[data-testid=thread-{who}]').first.click()
    await overlay.locator(f'[data-testid=thread-view][data-thread-open={who}]').wait_for()
    await page.wait_for_timeout(700)


# WHAT THE COMPOSER IS ACTUALLY SAYING, read off the painted surface in one pass.
COMPOSER_READ = """(selector) => {
  const c = document.querySelector(selector);
  if (!c) return null;
  const line = c.querySelector('[data-testid=composer-channel]');
  const state = c.querySelector('[data-testid=composer-channel-state]');
  const switcher = c.querySelector('[data-testid$=-switch-act]');
  const bind = c.querySelector('[data-testid$=-connect-whatsapp]');
  const send = c.querySelector('[data-testid$="-send"]');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  return {
    channel: c.getAttribute('data-channel'),
    because: c.getAttribute('data-because'),
    bound: c.getAttribute('data-bound'),
    canSend: c.getAttribute('data-can-send'),
    posture: c.getAttribute('data-whatsapp-posture'),
    emailPosture: c.getAttribute('data-email-posture'),
    sendDisabled: send ? send.disabled === true : null,
    chose: c.getAttribute('data-chose'),
    door: c.getAttribute('data-channel-door'),
    line: line ? line.textContent.trim() : '',
    state: state ? state.textContent.trim() : '',
    switchLabel: switcher ? switcher.textContent.trim() : '',
    switchBox: box(switcher),
    bindLabel: bind ? bind.textContent.trim() : '',
    bindBox: box(bind),
    fieldBox: box(c.querySelector('textarea')),
  };
}"""


# HOW EACH CUSTOMER TURN WAS DRAWN — the row states who spoke, the renderer inside it states what
# it drew (`shell/chats.tsx`). The kit bubble carries its author as a style prop only, so a reader
# that counted `[data-author]` was reading the MAIL card's attribute and calling every telephone
# conversation clean; this asks the row itself.
DRAWN_READ = """(n) => Array.from(n.querySelectorAll('[data-turn][data-turn-author=received]'))
  .map((t) => t.getAttribute('data-turn-drawn'))"""


async def shot(page, name):
    await page.wait_for_timeout(350)
    await page.screenshot(path=str(OUT / f'{name}.png'))


# ══ 1 · A WHATSAPP CONVERSATION (assertions 1 · 7) ════════════════════════════════════════════
async def walk_whatsapp(browser, url, width, height):
    tag = f'{width} whatsapp'
    page, errors = await boot(browser, url, width, height)
    try:
        await open_thread(page, WHATSAPP_THREAD)
        check(await page.locator('[data-testid=thread-whatsapp-logo]:visible').count() == 1,
              f'{tag} · the conversation wears WhatsApp identity')
        said = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(bool(said), f'{tag} · and it carries a composer')
        if said:
            check(said['channel'] == 'whatsapp',
                  f'{tag} · a WhatsApp conversation writes on WhatsApp', str(said['channel']))
            check(said['bound'] == 'no' and said['because'] == 'whatsapp-pending',
                  f'{tag} · an old incoming message establishes no current send capability',
                  f"bound {said['bound']} · {said['because']}")
            check(said['state'] == 'Rocoto sends from your own number once Meta confirms it.',
                  f'{tag} · the line under the box states the send state in full, in positive words',
                  said['state'][:90])
            # ── A STATED BLOCKER IS ONE PRESS FROM THE PLACE IT IS LIFTED ────────────────────
            # The mailbox posture has had this since OUT-05.4. The WhatsApp line shipped without
            # it, so the sentence stood on all 123 WhatsApp conversations of the seeded day with
            # nothing to do about it.
            check(said['bindLabel'] == 'Connect WhatsApp',
                  f'{tag} · and the one act beside it says the same word every WhatsApp entrance says',
                  str(said['bindLabel']))
            check(said['posture'] in ('checking', 'unavailable', 'setup', 'partial'),
                  f'{tag} · the composer carries the capability’s own posture', str(said['posture']))
            # ── THE HOUSE NUMBER ON A WHATSAPP LINE IS WHATSAPP'S OWN (§246) ─────────────────
            # It used to be `usePhoneConnectionConfig(...).sourceNumber` — a localStorage draft
            # written during TELEPHONE setup — so the strip read «WhatsApp · from +34 …» directly
            # above a line saying WhatsApp was still being confirmed. Two channels' facts in one
            # sentence, one of them a browser draft presented as the sending identity.
            check(' from ' not in said['line'],
                  f'{tag} · an unbound WhatsApp line claims no sending number', said['line'][:90])
            seat = said['bindBox']
            check(seat is not None and seat['height'] >= 44 - 0.5,
                  f'{tag} · the Connections press keeps the 44px floor', str(seat))
            check(bool(said['door']) and 'whatsapp' in said['door'],
                  f'{tag} · and the send still hands the words to WhatsApp’s own door', said['door'][:50])
            check(said['switchLabel'] == '',
                  f'{tag} · with one honest channel there is one channel and no switch',
                  said['switchLabel'])
        # ── THE DISC OPENS THE CHANNEL'S OWN DOOR, AND ROCOTO'S OWN SENDING IS WHAT WAITS ──────
        # `whatsappBound` used to be consumed exactly once, to pick a `because` string; it never
        # reached any control, so a composer marked `data-bound="no"` said one thing in words and
        # another in everything it drew. The repair that dimmed the disc was built, measured and
        # removed: `wa.me` is the person's OWN WhatsApp and it opens for anyone, exactly as
        # `mailto:` opens their own mail client, and a `disabled` send leaves the control out of
        # the tab order with `Enter` doing nothing — the app saying they cannot reach their own
        # phone. So the law measured here is the one the app holds (CHANNEL-SEMANTICS.md §3):
        # the disc hands the words over, Rocoto delivers nothing, and the pending line and its one
        # act are still standing when the door has opened.
        field = page.locator('[data-testid=chats-overlay] [data-testid=reply-composer] textarea').first
        await field.fill('Twelve kilos of gamba for Friday, please.')
        await page.wait_for_timeout(350)
        typed = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(typed and typed['canSend'] == 'no',
              f'{tag} · with the number unbound the composer states that ROCOTO’s sending waits',
              str(typed and typed['canSend']))
        check(typed and typed['sendDisabled'] is False,
              f'{tag} · and the send control still opens WhatsApp’s own door, with words in the box',
              str(typed and typed['sendDisabled']))
        check(typed and typed['fieldBox'] is not None,
              f'{tag} · while the writing surface stays exactly as usable')
        # THE STATED BLOCKER STANDS BESIDE THE LIVE DISC, which is the whole shape of the law: the
        # door is the person's and it opens; what waits is Rocoto's own sending, and it is SAID.
        check(typed and typed['state'] == 'Rocoto sends from your own number once Meta confirms it.',
              f'{tag} · the pending line stands beside it, with words in the box',
              str(typed and typed['state'])[:90])
        check(typed and typed['bindLabel'] == 'Connect WhatsApp',
              f'{tag} · and so does the one act that lifts it', str(typed and typed['bindLabel']))
        turns = '[data-testid=chats-overlay] [data-testid=thread-turns] [data-turn]'
        before = await page.locator(turns).count()
        await page.locator('[data-testid=chats-overlay] [data-testid=reply-composer-send]').first.click()
        await page.wait_for_timeout(450)
        opened = await page.evaluate('() => window.__opened || []')
        check(any('wa.me' in href or 'whatsapp.com' in href for href in opened),
              f'{tag} · the press opens the channel’s real door', str(opened)[:80])
        check(await page.locator(turns).count() == before,
              f'{tag} · and Rocoto delivered nothing — the conversation gained no turn')
        after = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(after and after['state'] and 'opened' in after['state'],
              f'{tag} · the line says which door opened, and claims nothing more',
              str(after and after['state'])[:80])
        check(await field.input_value() != '',
              f'{tag} · the words stay in the box, because a handoff is not a receipt')
        # WHAT JUST HAPPENED BELONGS TO THIS CONVERSATION, so leaving it and coming back returns
        # the STANDING state — and that is what the rest of this walk measures from. The recorder
        # is emptied with it, so the Connections press below counts its own tabs.
        await field.fill('')
        await open_thread(page, EMAIL_THREAD)
        await open_thread(page, WHATSAPP_THREAD)
        await page.evaluate('() => { window.__opened = []; }')
        await page.wait_for_timeout(320)
        stands = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(stands and stands['state'] == 'Rocoto sends from your own number once Meta confirms it.',
              f'{tag} · and the pending line is standing again on the next visit',
              str(stands and stands['state'])[:90])
        body = await page.locator('[data-testid=chats-overlay]').inner_text()
        check(not copy_law(body), f'{tag} · §198-A · the conversation says what IS',
              ' · '.join(copy_law(body)))
        await shot(page, f'{width}-whatsapp')
        door = page.locator('[data-testid=chats-overlay] [data-testid=reply-composer-connect-whatsapp]').first
        if await door.count():
            await door.click()
            await page.wait_for_timeout(500)
            where = await page.evaluate('() => location.hash')
            check(where.startswith('#/admin/connections'),
                  f'{tag} · and the press walks to the house’s own connection', where)
            check(await page.evaluate('() => window.__opened || []') == [],
                  f'{tag} · inside the app, opening no tab')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-whatsapp-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 2 · AN EMAIL CONVERSATION (assertions 2 · 7) ══════════════════════════════════════════════
async def walk_email(browser, url, width, height):
    tag = f'{width} email'
    page, errors = await boot(browser, url, width, height)
    try:
        await open_thread(page, EMAIL_THREAD)
        card = page.locator('[data-testid=chats-overlay] [data-testid=email-thread]').first
        await card.wait_for()
        check(await page.locator('[data-testid=thread-mail-name]:visible').count() == 1,
              f'{tag} · the mail workspace says whose conversation it is')
        subject = (await card.locator('[data-testid=email-subject]').first.inner_text()).strip()
        check(len(subject) > 0, f'{tag} · the email keeps its subject', subject[:60])
        sender = await card.locator('[data-email-sender]').first.inner_text()
        check(len(sender.strip()) > 0, f'{tag} · and its sender', sender.strip()[:40])
        files = card.locator('[data-testid=source-files] a, [data-testid=source-files] button')
        check(await files.count() >= 1, f'{tag} · the attachment stands with the message',
              str(await files.count()))
        reply = card.locator('[data-testid=email-reply]').first
        check(await reply.count() == 1, f'{tag} · one message can be answered by hitting Reply')
        await reply.click()
        await page.wait_for_timeout(400)
        aimed = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(aimed and aimed['because'] == 'reply-aimed' and aimed['channel'] == 'email',
              f'{tag} · Reply aims the composer at that email',
              f"{aimed and aimed['channel']}/{aimed and aimed['because']}")
        body = await page.locator('[data-testid=chats-overlay]').inner_text()
        check(not copy_law(body), f'{tag} · §198-A · the mail room says what IS',
              ' · '.join(copy_law(body)))
        await shot(page, f'{width}-email')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-email-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 3 · THE DELIVERY NOTE'S OWN CHIP (assertions 3 · 7) ═══════════════════════════════════════
async def walk_chip(browser, url, width, height):
    tag = f'{width} chip'
    page, errors = await boot(browser, url, width, height)
    try:
        await page.goto(url + '#/sales/' + EMAIL_THREAD, wait_until='networkidle')
        convo = page.locator('[data-testid=conversation]').first
        await convo.wait_for()
        await convo.scroll_into_view_if_needed()
        await page.wait_for_timeout(300)
        check(await convo.get_attribute('data-channel') == 'email',
              f'{tag} · the Delivery Note names the channel its order arrived on',
              str(await convo.get_attribute('data-channel')))
        check(await convo.locator('[data-testid=email-thread]').count() == 1,
              f'{tag} · and the compact summary keeps the source message whole')
        chip = await page.evaluate(COMPOSER_READ, '[data-testid=chip-composer]')
        check(bool(chip) and chip['channel'] == 'email',
              f'{tag} · the chip’s composer stands beside it, on the same channel',
              str(chip and chip['channel']))
        reply = convo.locator('[data-testid=email-reply]').first
        check(await reply.count() >= 1, f'{tag} · one email in the chip carries Reply')
        await reply.scroll_into_view_if_needed()
        await reply.click()
        await page.wait_for_timeout(400)
        aimed = await page.evaluate(COMPOSER_READ, '[data-testid=chip-composer]')
        check(aimed and aimed['because'] == 'reply-aimed',
              f'{tag} · and pressing it aims the chip’s own composer at that email',
              str(aimed and aimed['because']))
        # THE COMPOSER IS REACHABLE, which is the half of §246 acceptance 5 a phone decides.
        field = page.locator('[data-testid=chip-composer] textarea').first
        await field.scroll_into_view_if_needed()
        seat = await field.bounding_box()
        check(seat is not None and seat['y'] >= -1 and seat['y'] + seat['height'] <= height + 1,
              f'{tag} · the composer is reachable inside the viewport', str(seat))
        said = await convo.inner_text()
        check(not copy_law(said), f'{tag} · §198-A · the chip says what IS', ' · '.join(copy_law(said)))
        await shot(page, f'{width}-chip-email')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-chip-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 4 · A TELEPHONE CONVERSATION (assertions 4 · 7) ═══════════════════════════════════════════
async def walk_phone(browser, url, width, height):
    tag = f'{width} phone'
    page, errors = await boot(browser, url, width, height)
    try:
        # THE PHONE ORDER IS FOUND BY WALKING THE RIVER, because a river row states its sale and
        # the conversation states its channel — no fixture id is assumed.
        # ⚠ THE IDS ARE READ BEFORE ANY PRESS. A phone shows ONE pane at a time, so a river row
        #   asked for its id after the detail has replaced the river is a row that no longer
        #   exists — measured at 390, where the walk timed out on `rows.nth(1)`.
        rows = page.locator('[data-river-row]')
        await rows.first.wait_for()
        ids = [await rows.nth(i).get_attribute('data-river-row')
               for i in range(min(await rows.count(), 26))]
        # ⚠ AND EVERY TELEPHONE CONVERSATION THE WALK PASSES IS SWEPT, rather than one named sale.
        #   `isCallTurn` used to require a RECORDING, and `spoken()` records only the first received
        #   row of each sale — so a customer turn the fixtures left unrecorded came out as a green
        #   WhatsApp bubble inside a conversation with no chat channel. The predicate now names a
        #   CUSTOMER TURN on a telephone account, and this is the invariant that holds it: across
        #   every telephone conversation in this walk, zero received bubbles and one record per
        #   customer turn.
        found, swept, bubbles, records = None, 0, 0, 0
        for sale in ids:
            await page.goto(url + '#/sales/' + sale, wait_until='networkidle')
            await page.wait_for_timeout(220)
            convo = page.locator('[data-testid=conversation]').first
            if not await convo.count() or await convo.get_attribute('data-channel') != 'phone':
                continue
            swept += 1
            drawn = await convo.evaluate(DRAWN_READ)
            records += drawn.count('call')
            bubbles += len([d for d in drawn if d != 'call'])
            if found is None:
                found = sale
        check(found is not None, f'{tag} · a telephone order stands in the day', str(found))
        check(swept >= 1 and bubbles == 0 and records >= swept,
              f'{tag} · every customer turn on a telephone account is a call record',
              f'{swept} conversations · {records} records · {bubbles} drawn as bubbles')
        if found:
            await page.goto(url + '#/sales/' + found, wait_until='networkidle')
            await page.wait_for_timeout(260)
            convo = page.locator('[data-testid=conversation]').first
            await convo.scroll_into_view_if_needed()
            await page.wait_for_timeout(300)
            record = convo.locator('[data-call-turn]').first
            check(await record.count() >= 1,
                  f'{tag} · the telephone order is a call record', str(await record.count()))
            check(await record.get_attribute('data-direction') == 'inbound',
                  f'{tag} · and it says which way the call went',
                  str(await record.get_attribute('data-direction')))
            heading = (await record.locator('[data-testid$=-direction]').first.inner_text()).strip()
            check(heading == 'Incoming call', f'{tag} · in words as well as in an attribute', heading)
            # THE TRANSCRIPT EXPANDS. One line standing, the whole reading one press below.
            toggle = record.locator('[data-testid$=-transcript-toggle]').first
            check(await toggle.count() == 1, f'{tag} · the transcript is one press away')
            reading = record.locator('[data-testid$=-transcript]').first
            check(await reading.get_attribute('data-open') == 'no',
                  f'{tag} · it rests closed, one line standing',
                  str(await reading.get_attribute('data-open')))
            await toggle.click()
            await page.wait_for_timeout(450)
            check(await reading.get_attribute('data-open') == 'yes',
                  f'{tag} · and the press opens the words that were said',
                  str(await reading.get_attribute('data-open')))
            check(await convo.locator('[data-testid=chip-composer]').count() == 0,
                  f'{tag} · a telephone conversation carries the Call action rather than a composer')
            act = convo.locator('[data-testid=call-action]').first
            check(await act.count() == 1, f'{tag} · and the Call action stands where the composer would')
            seat = await act.bounding_box()
            check(seat is not None and min(seat['width'], seat['height']) >= 44 - 0.5,
                  f'{tag} · the Call act keeps the 44px floor', str(seat))
            check(await convo.locator('img[src*=whatsapp]').count() == 0,
                  f'{tag} · and no WhatsApp mark stands over a telephone call')
            said = await convo.inner_text()
            check(not copy_law(said), f'{tag} · §198-A · the call record says what IS',
                  ' · '.join(copy_law(said)))
            await shot(page, f'{width}-phone')
            # THE ACT WALKS THE APP'S OWN DIAL ROUTE, and opens no tab of its own.
            await act.click()
            await page.wait_for_timeout(600)
            where = await page.evaluate('() => location.hash')
            check(where.startswith('#/phone/new'),
                  f'{tag} · the Call act walks the app’s own dial route', where)
            check(await page.evaluate('() => window.__opened || []') == [],
                  f'{tag} · and it opened no tab')
            await shot(page, f'{width}-phone-dial')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-phone-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 4b · AN ACCOUNT WITH NO MESSAGE DOOR (assertions 4 · 7) ═══════════════════════════════════
# A portal account reaches the house another way. A composer under its conversation would point a
# person's words down a channel that account has never used, and the WhatsApp mark over it would be
# a brand standing on a conversation that never touched the brand.
async def walk_note(browser, url, width, height):
    tag = f'{width} note'
    page, errors = await boot(browser, url, width, height)
    try:
        rows = page.locator('[data-river-row]')
        await rows.first.wait_for()
        ids = [await rows.nth(i).get_attribute('data-river-row')
               for i in range(min(await rows.count(), 30))]
        found = None
        for sale in ids:
            await page.goto(url + '#/sales/' + sale, wait_until='networkidle')
            await page.wait_for_timeout(200)
            convo = page.locator('[data-testid=conversation]').first
            if await convo.count() and await convo.get_attribute('data-channel') == 'note':
                found = sale
                break
        check(found is not None, f'{tag} · an account with no message door stands in the day', str(found))
        if found:
            convo = page.locator('[data-testid=conversation]').first
            await convo.scroll_into_view_if_needed()
            await page.wait_for_timeout(250)
            check(await convo.locator('img[src*=whatsapp]').count() == 0,
                  f'{tag} · no WhatsApp mark stands over it')
            check(await convo.locator('[data-testid=chip-composer]').count() == 0,
                  f'{tag} · and no composer points its words down a channel it has never used')
            note = convo.locator('[data-testid=channel-note]').first
            check(await note.count() == 1, f'{tag} · it says where its orders come from instead')
            says = (await note.inner_text()).strip() if await note.count() else ''
            check(says.endswith('orders through the portal.') or says.endswith('orders in person.'),
                  f'{tag} · in one direct sentence', says[:80])
            check(not copy_law(says), f'{tag} · §198-A · and it says what IS', ' · '.join(copy_law(says)))
            # ── AND IT KEEPS AN ACT RATHER THAN ENDING IN NOTHING ────────────────────────────
            # Three rungs, highest honest one: an address gives a composer, a number gives the
            # WhatsApp door behind an explicit press, and neither leaves «Open chat» in the chip's
            # own header as the way into the whole conversation. The seeded portal accounts carry
            # neither field, so this asserts the rung the surface says it is on and that the way
            # out stands.
            dock = convo.locator('[data-testid=channel-note-dock]').first
            rung = await dock.get_attribute('data-act') if await dock.count() else None
            check(rung in ('whatsapp', 'none'), f'{tag} · it names the act it is offering', str(rung))
            if rung == 'whatsapp':
                act = convo.locator('[data-testid=channel-note-whatsapp]').first
                seat = await act.bounding_box()
                check(seat is not None and seat['height'] >= 44 - 0.5,
                      f'{tag} · and the press keeps the 44px floor', str(seat))
            else:
                check(await convo.locator('[data-testid=trail-open-chat]').count() == 1,
                      f'{tag} · and the whole conversation is one press away')
            await shot(page, f'{width}-note')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-note-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 4c · THE SAME TELEPHONE CONVERSATION, IN THE MESSAGES WORKSPACE (assertions 4 · 7) ════════
# The chip and the workspace are two housings of one conversation, and only the chip was proved.
# `CallDock` mounts in `ThreadView`'s own dock (shell/chats.tsx) and nothing read it there — so the
# workspace could have drawn a WhatsApp composer under a telephone account and every check stayed
# green. The door in is the chip's own «Open chat», which is also what that button is for.
async def walk_phone_workspace(browser, url, width, height):
    tag = f'{width} phone workspace'
    page, errors = await boot(browser, url, width, height)
    try:
        rows = page.locator('[data-river-row]')
        await rows.first.wait_for()
        ids = [await rows.nth(i).get_attribute('data-river-row')
               for i in range(min(await rows.count(), 26))]
        found = None
        for sale in ids:
            await page.goto(url + '#/sales/' + sale, wait_until='networkidle')
            await page.wait_for_timeout(220)
            convo = page.locator('[data-testid=conversation]').first
            if await convo.count() and await convo.get_attribute('data-channel') == 'phone':
                found = sale
                break
        check(found is not None, f'{tag} · a telephone order stands in the day', str(found))
        if found:
            convo = page.locator('[data-testid=conversation]').first
            await convo.scroll_into_view_if_needed()
            await page.wait_for_timeout(250)
            await convo.locator('[data-testid=trail-open-chat]').first.click()
            overlay = page.locator('[data-testid=chats-overlay]:not([inert])').first
            await overlay.wait_for(state='visible')
            view = overlay.locator('[data-testid=thread-view]').first
            await view.wait_for()
            await page.wait_for_timeout(700)
            check(await view.locator('[data-call-turn]').count() >= 1,
                  f'{tag} · the workspace draws the call records too',
                  str(await view.locator('[data-call-turn]').count()))
            check(await overlay.locator('[data-testid=reply-composer]').count() == 0,
                  f'{tag} · and it stands no composer over a telephone account')
            drawn = await view.evaluate(DRAWN_READ)
            check(len(drawn) >= 1 and all(d == 'call' for d in drawn),
                  f'{tag} · every customer turn in the whole thread is a call record',
                  f'{len(drawn)} customer turns · {sorted(set(drawn))}')
            act = overlay.locator('[data-testid=call-action]').first
            check(await act.count() == 1, f'{tag} · the Call act stands where the composer would')
            says = overlay.locator('[data-testid=call-action-says]').first
            heard = (await says.inner_text()).strip() if await says.count() else ''
            check(heard == 'This conversation happens by telephone.',
                  f'{tag} · saying what this conversation is', heard[:70])
            # ONE CHANNEL, ONE WORD. The header printed the cast's raw `phone` beside the
            # comercial while the chip's header said «Phone» about the same account.
            head = overlay.locator('[data-testid=thread-header]').first
            words = (await head.inner_text()).strip()
            check('Phone' in words and 'phone ·' not in words,
                  f'{tag} · and the header names the channel the way the chip does',
                  words.replace(chr(10), ' · ')[:80])
            body = await overlay.inner_text()
            check(not copy_law(body), f'{tag} · §198-A · the workspace says what IS',
                  ' · '.join(copy_law(body)))
            await shot(page, f'{width}-phone-workspace')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-phone-workspace-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 5 · A MIXED CUSTOMER, AND THE EXPLICIT SWITCH (assertions 5 · 7) ══════════════════════════
async def walk_mixed(browser, url, width, height):
    tag = f'{width} mixed'
    # A CONNECTED MAILBOX, STATED. §247.2 makes «Reply by email instead» an offer that requires the
    # other channel to work, so the walk that exercises the switch says which mailbox is behind it.
    page, errors = await boot(browser, url, width, height, day=mixed_day(), mailbox=True)
    try:
        await open_thread(page, MIXED_THREAD)
        view = page.locator(f'[data-testid=thread-view][data-thread-open={MIXED_THREAD}]').first
        mail = view.locator('[data-turn] [data-email-entry=message]')
        check(await mail.count() >= 1,
              f'{tag} · the email turn keeps its own anatomy inside a WhatsApp conversation',
              str(await mail.count()))
        sender = (await mail.first.locator('[data-email-sender]').first.inner_text()).strip()
        check(sender == 'Peixateria Mixta', f'{tag} · and it keeps its sender', sender)
        # ── THE SUBJECT IS PRINTED WHERE IT CHANGES (§40.3 · §25.5) ──────────────────────────
        # Two mails on one subject print the heading once. The chat stream used to mount the card
        # with «print it whenever there is one», so the same fact stood twice in one column.
        headings = await view.evaluate(
            "(n) => Array.from(n.querySelectorAll('[data-email-entry=message] h4'))"
            ".map((h) => h.textContent.trim())")
        check(await mail.count() >= 2 and len(headings) == 1,
              f'{tag} · two mails on one subject print that subject once',
              f'{await mail.count()} mail turns · headings {headings}')
        turns = await view.locator('[data-turn]').count()
        check(turns > await mail.count(),
              f'{tag} · both channels stand in ONE timeline',
              f'{turns} turns, {await mail.count()} of them mail')
        said = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(said and said['channel'] == 'whatsapp',
              f'{tag} · the composer defaults to the account’s own channel',
              str(said and said['channel']))
        # ── AN OFFER TO SWITCH IS A PROMISE THE OTHER CHANNEL WORKS (§247.2) ──────────────────
        # It used to stand on `emailStanding` alone — an address on the customer record or a mail
        # turn in the history, which is RECORD PROVENANCE — so the control moved a person's reply
        # onto a mailbox nobody had connected. The mailbox's own posture is the condition now.
        check(said and said['emailPosture'] == 'ready',
              f'{tag} · the mailbox behind the offer is connected', str(said and said['emailPosture']))
        check(said and said['switchLabel'] == 'Reply by email instead',
              f'{tag} · with a connected mailbox standing, one explicit switch is offered',
              str(said and said['switchLabel']))
        seat = said and said['switchBox']
        check(seat is not None and seat['height'] >= 44 - 0.5,
              f'{tag} · the switch keeps the 44px floor', str(seat))
        await shot(page, f'{width}-mixed')
        await page.locator('[data-testid=chats-overlay] [data-testid=reply-composer-switch-act]').first.click()
        await page.wait_for_timeout(450)
        moved = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(moved and moved['channel'] == 'email' and moved['because'] == 'chosen-email',
              f'{tag} · the channel changes because a PERSON changed it',
              f"{moved and moved['channel']}/{moved and moved['because']}")
        check(moved and moved['chose'] == 'email',
              f'{tag} · and the composer prints whose choice it was', str(moved and moved['chose']))
        check(moved and moved['state'] == 'This reply goes by email.',
              f'{tag} · the line under the box says where these words go',
              str(moved and moved['state'])[:80])
        check(moved and moved['switchLabel'] == 'Reply on WhatsApp instead',
              f'{tag} · and the choice is reversible from the composer that took it',
              str(moved and moved['switchLabel']))
        await shot(page, f'{width}-mixed-email')
        await page.locator('[data-testid=chats-overlay] [data-testid=reply-composer-switch-act]').first.click()
        await page.wait_for_timeout(450)
        back = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
        check(back and back['channel'] == 'whatsapp',
              f'{tag} · pressing it again puts the reply back', str(back and back['channel']))
        # ── AND REPLY ON THE MAIL TURN AIMS THE COMPOSER THAT ACTUALLY STANDS THERE ─────────
        # §196.7 clause 1 inside a MIXED timeline. The button used to flip to «Replying» against
        # state the housing had switched off, so the press changed the label and nothing else.
        reply = view.locator('[data-testid=email-reply]').first
        check(await view.locator('[data-testid=email-reply]').count() >= 1,
              f'{tag} · the mail turn carries Reply inside the chat stream')
        if await reply.count():
            await reply.scroll_into_view_if_needed()
            await reply.click()
            await page.wait_for_timeout(450)
            check(await reply.get_attribute('data-aimed') == 'yes',
                  f'{tag} · the card says which message is being answered',
                  str(await reply.get_attribute('data-aimed')))
            at = await page.evaluate(COMPOSER_READ, '[data-testid=chats-overlay] [data-testid=reply-composer]')
            check(at and at['channel'] == 'email' and at['because'] == 'reply-aimed',
                  f'{tag} · and the composer standing under it took the aim',
                  f"{at and at['channel']}/{at and at['because']}")
            check(at and at['state'] == 'Answering the email above.',
                  f'{tag} · the line under the box says which message', str(at and at['state'])[:80])
            # ── AND THE DOOR CARRIES THE MESSAGE IT IS ANSWERING (the chats-fix review) ──────
            # The aim used to be React's raw setter handed straight to the card as its `onReply`,
            # so the whole `ThreadTurn` went into the aim and `emailTo` / `emailSubject` came out
            # undefined — a BLANK mailto under «Answering the email above.» The aim is built from
            # the row's own mail metadata now, and the door proves it.
            check(at and at['door'] and 'su=' in at['door'] or (at and at['door'] and 'subject=' in at['door']),
                  f'{tag} · the composer’s door carries the subject it is answering',
                  str(at and at['door'])[:110])
            await shot(page, f'{width}-mixed-aimed')
        body = await page.locator('[data-testid=chats-overlay]').inner_text()
        check(not copy_law(body), f'{tag} · §198-A · the mixed conversation says what IS',
              ' · '.join(copy_law(body)))
        await shot(page, f'{width}-mixed-back')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-mixed-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


# ══ 6 · THE PHONE'S KEYBOARD (assertion 6) ════════════════════════════════════════════════════
# A soft keyboard takes the bottom of the screen. This MEASURES the composer's seat before and
# after the room is taken, rather than assuming the flex dock holds.
async def walk_keyboard(browser, url, width, height):
    tag = f'{width} keyboard'
    page, errors = await boot(browser, url, width, height)
    try:
        await open_thread(page, WHATSAPP_THREAD)
        field = page.locator('[data-testid=chats-overlay] [data-testid=reply-composer] textarea').first
        await field.click()
        await page.wait_for_timeout(300)
        before = await field.bounding_box()
        check(before is not None and before['y'] + before['height'] <= height + 1,
              f'{tag} · the composer is on screen before the keyboard', str(before))
        # THE KEYBOARD, AS THE ROOM IT TAKES. Chromium on Android resizes the layout viewport; this
        # takes 304px of it, which is a full keyboard on a 390-wide phone.
        await page.set_viewport_size({'width': width, 'height': height - 304})
        await page.wait_for_timeout(500)
        after = await field.bounding_box()
        check(after is not None and after['y'] >= -1 and after['y'] + after['height'] <= (height - 304) + 1,
              f'{tag} · and it is still on screen with the keyboard up', str(after))
        send = page.locator('[data-testid=chats-overlay] [data-testid=reply-composer-send]').first
        seat = await send.bounding_box() if await send.count() else None
        check(seat is not None and seat['y'] + seat['height'] <= (height - 304) + 1,
              f'{tag} · the send control stays reachable too', str(seat))
        await shot(page, f'{width}-keyboard')
        check(not errors, f'{tag} · zero page errors', errors[0][:140] if errors else '')
    except Exception as error:
        await shot(page, f'{width}-keyboard-failure')
        check(False, f'{tag} · drive completed', f'{type(error).__name__}: {error}'[:220])
    await page.close()


async def main():
    server = None
    url = os.environ.get('ROCOTO_URL')
    if not url:
        handler = functools.partial(
            type('Quiet', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None}),
            directory=str(DIST))
        server = socketserver.TCPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_address[1]}/app.html'
    print(f'serving {url}', flush=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=[
            '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--renderer-process-limit=1'])
        for width, height in VIEWPORTS:
            await walk_whatsapp(browser, url, width, height)
            await walk_email(browser, url, width, height)
            await walk_chip(browser, url, width, height)
            await walk_phone(browser, url, width, height)
            await walk_phone_workspace(browser, url, width, height)
            await walk_note(browser, url, width, height)
            await walk_mixed(browser, url, width, height)
            if width < 700:
                await walk_keyboard(browser, url, width, height)
        await browser.close()
    if server:
        server.shutdown()

    print(f'TOTAL {len(GREEN)} GREEN / {len(RED)} RED', flush=True)
    raise SystemExit(1 if RED else 0)


asyncio.run(main())
