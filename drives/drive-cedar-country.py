#!/usr/bin/env python3
"""Cedar display language and market presentation, on the built artifact.

TWO FACTS, PROVED APART. Language is the words (`/cedar/` English · `/cedar/es/` Castellano) and
country is the market (Peru · soles, Spain · euros). All four combinations are walked here, and
each control is proved to leave the other alone.

It serves the whole build directory rather than one entry, because the language choice IS a
navigation between two published entries: `/cedar/` and `/cedar/es/` both have to resolve. It then
serves two more origins, built from links under `<ROCOTO_SHOTS>/origins`, for the two ways a host
can publish no Castellano at all: an entry with no `rocoto-spanish-entry` marker (`make dev`, the
kit gallery) and a `/cedar/es/` answered with the English document (an older generation, an SPA
fallback). Both have to keep a person on Cedar, in English.

    ROCOTO_DIST=app/dist-export-review .venv/bin/python drives/drive-cedar-country.py

It closes with `spain_money_off`: a Spanish workspace planted with Money off, walked door by door at
1600, 390 and 320 — the nav seat, the Find palette, `#/money` and the money setup page, the Business
setup ring, Connections, a Delivery Note, a customer sheet, onboarding and the welcome screen — and
then walked back with the Settings Money toggle, which is the one way Money returns (FEED-IA §247.9).
`spain_money_quiet` then reads the same desk's traffic: with Money off it asks the money API
nothing, and with Money on it reads its bank posture.

The three money cards in Connections, their group headings and the `payments`/`invoicing`/`setup`
tails are asserted absent with Money off (`MoneyConnections` in `areas/admin/connections.tsx`,
gated 13 September 2026); the assertion ran behind a flag while that file was held by another
worker and is unconditional now.

    ROCOTO_DIST=app/dist-<key> .venv/bin/python drives/drive-cedar-country.py

`ROCOTO_SHOTS` selects the screenshot folder. Provider and API traffic is blocked; every write
stays in the isolated browser context.
"""
from __future__ import annotations

import asyncio
import contextlib
import functools
import http.server
import json
import os
import pathlib
import re
import shutil
import socketserver
import threading
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

DIST = pathlib.Path(os.environ.get("ROCOTO_DIST", "app/dist-export-review"))
OUT = pathlib.Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-country-proof"))
EN = "/cedar/"
ES = "/cedar/es/"
ES_INDEX = "/cedar/es/index.html"
RESULTS: list[dict] = []
# A fact this drive READ but cannot yet hold to an answer, because the file that decides it belongs
# to another worker this round. It is never counted as green — `check()` is for proved checks — and
# it FAILS the run at the foot of `main`, so an unproved door is red rather than quiet.
PENDING: list[dict] = []

# ── EURO GRAMMAR, THE ONE SHAPE (`money-model.ts` · `currency.ts`) ───────────────────────────────
# Spain reads es-ES: dots group the thousands and a comma opens the decimals, «15.269,00 €». The
# same euro used to print two ways one click apart — Money in en-PE («€15,269.00») and Sales in
# es-ES — so this drive reads the grammar itself rather than asserting a «€» is somewhere on screen.
EURO_ES = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}\s*€")
EURO_EN = re.compile(r"€\s*\d{1,3}(?:,\d{3})*\.\d{2}")

# ── SPAIN HIDES EVERY MONEY DOOR (FEED-IA §247.9) ────────────────────────────────────────────────
# «ensure you have the good spain / peru toggle which in spains case hides the money shit»
#                                                                       — Peter, 13 September 2026
# The country toggle sets Spain to euros with Money off, and with Money off nothing of Money is
# reachable or visible: the Money area and its nav seat, the invoice and payment card on a Delivery
# Note, the Credit block on a customer sheet, the bank milestone in the setup ring, the bank step of
# onboarding, and the Bank account, Yape & Plin and Invoicing cards in Connections. The Money toggle
# in Settings is the one way back, and `spain_money_off` walks both directions.
SPAIN_MONEY_OFF = json.dumps({
    "version": 1, "pricing": True, "inventory": False, "money": False,
    "country": "spain", "moneyByCountry": {"peru": True, "spain": False},
})
# A walk stored on the bank step meets a workspace with no room for it, and moves on.
STORED_ON_BANK = json.dumps({
    "version": 1, "scope": "fish", "step": "bank", "workspacePrepared": False,
    "businessName": "Pescados del Puerto", "address": "Avenida Principal 100", "ruc": "20123456789",
    "selectedChannel": "whatsapp", "channels": [{"channel": "whatsapp", "status": "connected"}],
    "catalogue": "pending", "invoiceHistory": [], "invoiceSearch": "pending",
})
# ── THE CONNECTIONS DOOR IS GATED AND ASSERTED OUTRIGHT (13 September 2026) ─────────────────────
# While `areas/admin/connections.tsx` was held by another worker, its three assertions stood behind
# ROCOTO_EXPECT_CONNECTIONS_GATED and an unarmed run FAILED naming the flag — a gate that answers
# «could not check» as «clean» is the one failure mode a gate may never have, and `PENDING` keeps
# that rule for any future fact this drive reads and cannot hold to an answer. The gate shipped
# (`MoneyConnections`), so the checks run unconditionally.
# TWO MORE DOORS STOOD BEHIND FLAGS OF THEIR OWN AND ARE HELD OUTRIGHT NOW. The search palette
# listed `RAIL_ORDER` itself, so «Money · Where you work» stood in Find on a workspace whose rail
# has no Money seat and whose `#/money` goes home; the welcome screen's two tiles said «Connect
# messages and banking» and «Orders, customers and money» on every workspace. `shell/search-modal.
# tsx` and `demo-welcome.tsx` read the capability now, so their assertions run unconditionally —
# a shipped fact belongs to the drive, rather than to an environment variable someone has to know.
# THE PROVIDER READ BEHIND THE RING. `useBankCapability` asks the money API for this workspace's
# bank posture on mount and then on a timer, and the Business setup card sits in the rail of every
# desk screen — so a workspace with Money off went on asking Money a question it never shows.
# `spain_money_quiet` plants a collections base so the read can fire, and reads both answers.
MONEY_READS = ("/api/cedar/setup", "/api/cedar/bank")


def check(condition: bool, name: str, **evidence) -> None:
    if not condition:
        raise AssertionError(f"{name}: {evidence}")
    RESULTS.append({"status": "GREEN", "check": name, **evidence})


def serve(directory: pathlib.Path) -> tuple[socketserver.TCPServer, str]:
    """One more local root, for the artifacts a publication can get WRONG."""
    handler = functools.partial(
        type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}),
        directory=str(directory),
    )
    server = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def unpublished_origins(dist: pathlib.Path, at: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path]:
    """TWO ORIGINS THAT PUBLISH NO CASTELLANO, because both of them exist in real life.

    `no-marker` is `make dev` and the kit gallery: an entry document with no
    `rocoto-spanish-entry` meta, because only `tools/build-english-app.mjs` writes one.
    `english-fallback` is a host answering `/cedar/es/` with the English document — an older
    generation, a partial copy, an SPA fallback. The boot has to recognise both.

    Each one is built from links, so a fixture costs the entry documents it rewrites and nothing
    else: the artifact carries map tiles and artwork, and two copies of it is 135 MB of /tmp.
    """
    shutil.rmtree(at, ignore_errors=True)

    def mirror(name: str, *, spanish: bool, marker: bool) -> pathlib.Path:
        root = at / name
        root.mkdir(parents=True)
        for child in dist.iterdir():
            if child.name in {"index.html", "app.html", "cedar"}:
                continue
            (root / child.name).symlink_to(child.resolve())
        cedar = root / "cedar"
        cedar.mkdir()
        for child in (dist / "cedar").iterdir():
            if child.name in {"index.html", "es"}:
                continue
            (cedar / child.name).symlink_to(child.resolve())
        english = (dist / "cedar" / "index.html").read_text()
        if not marker:
            english = re.sub(r'<meta name="rocoto-spanish-entry"[^>]*>', "", english)
        for entry in (root / "index.html", root / "app.html", cedar / "index.html"):
            entry.write_text(english)
        es = cedar / "es"
        es.mkdir()
        if spanish:
            for child in (dist / "cedar" / "es").iterdir():
                (es / child.name).symlink_to(child.resolve())
        else:
            # The host answers the Spanish address with the English document, assets and all.
            es.joinpath("index.html").write_text(english)
        return root

    return mirror("no-marker", spanish=True, marker=False), mirror("english-fallback", spanish=False, marker=True)


async def spain_money_off(browser, origin: str, origins: set[str]) -> None:
    """A SPANISH WORKSPACE WITH MONEY OFF, DOOR BY DOOR (FEED-IA §247.9).

    Its own context, because the fact under test is what a Spanish house meets on the first load:
    the capability is planted in storage rather than reached through the Settings walk above, so a
    regression in the boot cannot hide behind a click. Provider traffic answers 503, which is the
    posture of a workspace that has connected nothing — the state every demo starts in.

    The walk runs at 1600, 390 and 320 because the Money seat has two housings (the desk rail and the
    phone's bottom row) and the setup ring has two as well (the rail card and the day bar) — and 320
    because the Business setup dialog, the surface whose milestone count changed, is a bottom sheet
    at the narrow widths, so the one-milestone card is read where it is tightest. It closes by
    pressing the Settings Money toggle and proving every door comes back, since that toggle is the
    one way a Spanish workspace turns Money on.

    ⚠ EVERY ABSENCE IS READ AFTER THE SHELL IS UP. `locator.count()` answers immediately, so «no
    Money seat» on a page that has yet to mount is true of every page in the world; `go` waits for
    the rail or the phone's bottom row first, and the route assertions wait for the address itself.
    """
    context = await browser.new_context(viewport={"width": 1600, "height": 1000})

    async def local_only(route):
        request = urlsplit(route.request.url)
        if f"{request.scheme}://{request.netloc}" not in origins:
            await route.abort()
        elif request.path.startswith("/api/"):
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"blocked by country drive"}')
        else:
            await route.continue_()

    await context.route("**/*", local_only)
    await context.add_init_script(
        "if(!sessionStorage.getItem('spain-money-drive')){localStorage.clear();"
        "localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));"
        f"localStorage.setItem('rocoto-workspace-capabilities:fish',{json.dumps(SPAIN_MONEY_OFF)});"
        "sessionStorage.setItem('spain-money-drive','ready');}"
    )
    page = await context.new_page()
    page.set_default_timeout(20000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    # `money-setup` is in the list so a RED run lands on the assertion below rather than on a
    # twenty-second wait: a Spanish workspace standing on the bank step mounts Money's own setup
    # page, which is exactly the door under test.
    SHELL = ('[data-testid="rail"], [data-testid="bottom-nav"], '
             '[data-testid="cedar-onboarding"], [data-testid="money-setup"], '
             '[data-testid="demo-welcome"]')

    async def go(route: str) -> None:
        await page.goto(f"{origin}{EN}{route}", wait_until="networkidle")
        await page.wait_for_selector(SHELL, timeout=20000)
        await page.wait_for_timeout(400)

    async def at_home(said: str) -> None:
        """The router sends a disabled area home; this waits for that address rather than sampling it."""
        with contextlib.suppress(Exception):
            await page.wait_for_function("() => window.location.hash === '#/sales'", timeout=10000)
        check(page.url.endswith("#/sales"), said, url=page.url)

    notes: list[str] = []
    try:
        for width in (1600, 390, 320):
            await page.set_viewport_size({"width": width, "height": 1000 if width > 500 else 844})
            tag = f"spain-money-off-{width}"

            # ── THE NAVIGATION ────────────────────────────────────────────────────────────────
            await go("#/sales")
            seats = await page.locator('[data-area="money"]').count()
            check(seats == 0, f"a Spanish workspace shows no Money seat at {width}px", seats=seats)
            doors = await page.locator('a[href^="#/money"]').count()
            check(doors == 0, f"and no link into Money stands on Sales at {width}px", doors=doors)
            await page.screenshot(path=str(OUT / f"{tag}-sales.png"))

            # ── FIND IS A NAVIGATION TOO ──────────────────────────────────────────────────────
            # The palette lists the places from `RAIL_ORDER` rather than from the workspace's own
            # areas, so «Money · Where you work» stood in Find beside a rail that has no Money seat,
            # and pressing it walked a person to an address that sends them straight home.
            await page.keyboard.press("Control+k")
            await page.get_by_test_id("search-modal").wait_for()
            await page.wait_for_timeout(500)
            place = await page.locator('[data-row-key="area-money"]').count()
            await page.screenshot(path=str(OUT / f"{tag}-find.png"))
            check(place == 0, f"the search palette lists no Money place at {width}px", place=place)
            check(await page.locator('[data-row-key="area-sales"]').count() == 1,
                  f"and keeps the places this workspace does have at {width}px")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(400)

            # ── THE ROUTE, AND THE SETUP PAGE BEHIND IT ───────────────────────────────────────
            await go("#/money")
            await at_home(f"#/money returns to Sales at {width}px")
            await go("#/money/setup/payments")
            await at_home(f"and the money setup page returns with it at {width}px")

            # ── THE SETUP RING COUNTS WHAT THIS WORKSPACE HAS (§247.9) ───────────────────────
            # It counted a bank milestone and offered `#/money/setup/payments`, so a Spanish
            # workspace read «0 of 2» with one of the two unreachable — a ring that can never close,
            # and a door into an area this house is not using.
            await go("#/sales")
            journey = page.get_by_test_id("journey-card")
            await journey.wait_for()
            of, done = await journey.get_attribute("data-of"), await journey.get_attribute("data-done")
            bank, label = await journey.get_attribute("data-bank"), await journey.get_attribute("aria-label")
            check(of == "1", f"the setup ring counts one milestone at {width}px", of=of, done=done)
            check(done == "0", f"and counts nothing done with no channel connected at {width}px", done=done)
            check(bank is None, f"and carries no bank milestone at {width}px", bank=bank)
            check(label == "Business setup · 0 of 1 complete", f"the ring says 0 of 1 at {width}px", label=label)
            if await page.get_by_test_id("journey-next").count():
                said = await page.get_by_test_id("journey-next").inner_text()
                check(said == "0 of 1 complete", f"and the words under it say the same at {width}px", said=said)
            await journey.click()
            await page.get_by_test_id("setup-progress").wait_for()
            # THE CARD IS A BOTTOM SHEET AT 390 AND 320, and it arrives over 400ms. A capture taken
            # on `wait_for` catches it half-transparent over the Sales day, which is a picture
            # nobody can read the milestones off. The evidence waits for the motion to finish.
            await page.wait_for_timeout(600)
            card = await page.get_by_test_id("setup-progress").inner_text()
            await page.screenshot(path=str(OUT / f"{tag}-setup-card.png"))
            check("Bank account" not in card and "Balances and payments" not in card,
                  f"the Business setup card offers no bank milestone at {width}px", card=card.replace("\n", " · ")[:120])
            check("Communication" in card, f"and keeps the one milestone this workspace has at {width}px")
            await page.keyboard.press("Escape")

            # ── CONNECTIONS ───────────────────────────────────────────────────────────────────
            await go("#/admin/connections")
            await page.get_by_test_id("seat-connections").wait_for()
            await page.wait_for_timeout(400)
            cards = {name: await page.get_by_test_id(name).count()
                     for name in ("payment-connection", "wallet-connection", "invoicing-connection")}
            groups = {name: await page.get_by_role("heading", name=name, exact=True).count()
                      for name in ("Banking", "Payments")}
            await page.screenshot(path=str(OUT / f"{tag}-connections.png"))
            check(await page.get_by_test_id("connect-email").count() == 1,
                  f"Connections keeps the channels this workspace does use at {width}px")
            # AND THE TAIL IS A DOOR OF ITS OWN: `#/admin/connections/payments` opens the money
            # setup dialog straight from the address bar, whatever the cards above say.
            await go("#/admin/connections/payments")
            await page.get_by_test_id("seat-connections").wait_for()
            await page.wait_for_timeout(600)
            opened = await page.get_by_test_id("money-setup").count()
            await page.keyboard.press("Escape")
            check(sum(cards.values()) == 0, f"Connections holds no money card at {width}px", cards=cards)
            check(sum(groups.values()) == 0, f"and no heading stands empty above them at {width}px", groups=groups)
            check(opened == 0, f"and the payments tail opens no money setup at {width}px", opened=opened)

            # ── A DELIVERY NOTE AND A CUSTOMER SHEET ──────────────────────────────────────────
            await go("#/sales")
            await page.locator('[data-testid^="open-"][data-feed-row]').first.wait_for()
            sale_ids = await page.locator('[data-testid^="open-"][data-feed-row]').evaluate_all(
                "nodes => nodes.map(node => node.getAttribute('data-feed-row'))")
            check(bool(sale_ids), f"the Sales day lists delivery notes at {width}px", count=len(sale_ids))
            badges = await page.locator('[data-testid^="delivery-payment-"]').count()
            check(badges == 0, f"and carries no payment badge at {width}px", badges=badges)
            # FOUR NOTES RATHER THAN ONE, and the same four are read again with Money on: the card
            # mounts only for a priced note with a customer and lines, so «it is absent» means
            # nothing until the same document is shown carrying it.
            notes = sale_ids[:6]
            for sale_id in notes:
                await go(f"#/sales/{sale_id}")
                await page.get_by_test_id("document").wait_for(timeout=20000)
                await page.wait_for_timeout(300)
                check(await page.get_by_test_id("delivery-note-money").count() == 0,
                      f"a Delivery Note holds no invoice and payment card at {width}px", sale=sale_id)
            await page.screenshot(path=str(OUT / f"{tag}-delivery-note.png"))
            await go("#/customers")
            await page.locator("[data-customer-row]").first.click()
            await page.get_by_test_id("customer-sheet").wait_for()
            await page.wait_for_timeout(500)
            check(await page.get_by_test_id("customer-credit").count() == 0,
                  f"a customer sheet holds no Credit block at {width}px")
            await page.screenshot(path=str(OUT / f"{tag}-customer.png"))

            # ── ONBOARDING WALKS CHANNEL → COMPLETE ──────────────────────────────────────────
            await go("#/onboarding/bank")
            await page.wait_for_timeout(600)
            await page.screenshot(path=str(OUT / f"{tag}-onboarding.png"))
            check(await page.get_by_test_id("money-setup").count() == 0,
                  f"the bank step mounts no money setup page at {width}px", url=page.url)
            check(page.url.endswith("#/onboarding/channel"),
                  f"the bank step's own address returns to the question at {width}px", url=page.url)
            said = await page.locator("body").inner_text()
            check("Connect your bank account" not in said, f"and onboarding offers no bank step at {width}px")

            # ── THE WELCOME SCREEN DESCRIBES THE WALK THIS WORKSPACE TAKES ───────────────────
            # Its two tiles read «Connect messages and banking» and «Orders, customers and money»,
            # the same words whatever the workspace kept — so a Spanish house was offered banking in
            # a walk that ends at its order channel, and money in a workspace with no Money seat.
            # The tiles read the capability now, and the words they carry instead are read here too:
            # an empty tile would satisfy «banking is absent» and say nothing at all.
            #
            # ⚠ READ FROM THE TILES THEMSELVES, `text_content()` RATHER THAN `inner_text()`. The
            # card hides its own detail line under 520px, so a body reading would be silent at
            # 390px whatever the words say — a check that passes because the viewport is narrow is
            # a green that proves nothing. The tile's text is the copy under test at either width.
            await go("#/welcome")
            await page.get_by_test_id("demo-welcome").wait_for()
            await page.wait_for_timeout(400)
            tiles = " · ".join([await page.get_by_test_id(name).text_content() or ""
                                for name in ("demo-view-onboarding", "demo-start-selling")])
            await page.screenshot(path=str(OUT / f"{tag}-welcome.png"))
            check("banking" not in tiles and "money" not in tiles,
                  f"the welcome tiles name the walk this workspace takes at {width}px", said=tiles[:160])
            check("Connect your order channel" in tiles and "Orders and customers" in tiles,
                  f"and say what this workspace does hold at {width}px", said=tiles[:160])

        # ── A WALK ALREADY STANDING ON THE BANK STEP MOVES ON ────────────────────────────────
        await page.set_viewport_size({"width": 1600, "height": 1000})
        await go("#/sales")
        await page.evaluate("value => localStorage.setItem('rocoto-cedar-onboarding-v1:fish', value)", STORED_ON_BANK)
        await go("#/onboarding")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(OUT / "spain-money-off-stored-bank.png"))
        check(await page.get_by_test_id("money-setup").count() == 0,
              "a walk stored on the bank step opens no money setup page", url=page.url)
        step = (await page.get_by_test_id("onboarding-step").get_attribute("data-step")
                if await page.get_by_test_id("onboarding-step").count() else None)
        check(step is not None and step != "bank",
              "and it stands on a step this workspace has", step=step)
        said = await page.locator("body").inner_text()
        check("Connect your bank account" not in said, "with the bank question off the screen")

        # ── THE ONE WAY BACK: THE MONEY TOGGLE IN SETTINGS ──────────────────────────────────
        await go("#/admin/app-settings")
        await page.get_by_test_id("workspace-money-toggle").evaluate("el => el.click()")
        await expect(page.get_by_test_id("workspace-money-toggle")).to_be_checked()
        await go("#/sales")
        check(await page.locator('[data-area="money"]').count() >= 1, "the Money seat returns with the toggle")
        journey = page.get_by_test_id("journey-card")
        await journey.wait_for()
        of = await journey.get_attribute("data-of")
        check(of == "2", "the setup ring counts its bank milestone again", of=of)
        check(await journey.get_attribute("data-bank") == "setup", "and states the posture the provider left")
        await go("#/money")
        await page.get_by_test_id("money-overview").wait_for()
        check(page.url.endswith("#/money"), "Money opens on its own route again", url=page.url)
        # A CAPTURE IS NAMED FOR WHAT IS IN IT, the rule this drive already learnt at 390: the Money
        # overview and the Find palette are two different screens and they get two different names.
        await page.screenshot(path=str(OUT / "spain-money-on-overview-1600.png"))
        await go("#/sales")
        await page.keyboard.press("Control+k")
        await page.get_by_test_id("search-modal").wait_for()
        await page.wait_for_timeout(500)
        check(await page.locator('[data-row-key="area-money"]').count() == 1,
              "and Find offers Money as a place again")
        await page.screenshot(path=str(OUT / "spain-money-on-find-1600.png"))
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        await go("#/admin/connections")
        await page.get_by_test_id("seat-connections").wait_for()
        for name in ("payment-connection", "wallet-connection", "invoicing-connection"):
            check(await page.get_by_test_id(name).count() == 1, f"Connections offers {name} again")
        carried = 0
        for sale_id in notes:
            await go(f"#/sales/{sale_id}")
            await page.get_by_test_id("document").wait_for(timeout=20000)
            await page.wait_for_timeout(300)
            carried += await page.get_by_test_id("delivery-note-money").count()
        check(carried >= 1, "a Delivery Note carries its invoice and payment card again", notes=notes, carried=carried)
        await go("#/customers")
        await page.locator("[data-customer-row]").first.click()
        await page.get_by_test_id("customer-sheet").wait_for()
        await page.wait_for_timeout(500)
        check(await page.get_by_test_id("customer-credit").count() == 1,
              "and a customer sheet carries its Credit block again")
        await go("#/onboarding/bank")
        await page.wait_for_timeout(600)
        said = await page.locator("body").inner_text()
        check("Connect your bank account" in said or await page.get_by_test_id("money-setup").count() == 1,
              "and onboarding asks for the bank account again", url=page.url)

        check(not errors, "the Spain Money walk has no page errors", errors=errors[:3])
    except Exception:
        # THE FAILURE LEAVES ITS OWN EVIDENCE, because «the assertion went red» is not a finding.
        await page.screenshot(path=str(OUT / "spain-money-off-failure.png"))
        (OUT / "spain-money-off-failure.txt").write_text(
            f"url={page.url}\nerrors={errors}\n\n{await page.locator('body').inner_text()}")
        raise
    finally:
        await context.close()


async def money_reads_on_sales(browser, origin: str, origins: set[str], money: bool) -> list[str]:
    """THE MONEY API CALLS A SALES DESK MAKES, with Money on and with Money off.

    A collections base is planted so the read can actually leave the browser — `collectionOrigin()`
    answers nothing on a bare local origin, and a silence that comes from having no address proves
    nothing about a capability. `/api/cedar/workspaces` is answered with a real sample workspace so
    the session succeeds and the two money routes behind it are asked for; those answer 503, which
    is what an unconnected provider says. Everything else is blocked, as in the walk above.
    """
    capabilities = json.dumps({
        "version": 1, "pricing": True, "inventory": False, "money": money,
        "country": "spain", "moneyByCountry": {"peru": True, "spain": money},
    })
    context = await browser.new_context(viewport={"width": 1600, "height": 1000})
    asked: list[str] = []

    async def guard(route):
        request = urlsplit(route.request.url)
        if f"{request.scheme}://{request.netloc}" not in origins:
            await route.abort()
        elif request.path == "/api/cedar/workspaces":
            asked.append(request.path)
            await route.fulfill(json={"id": "cedar-drive", "token": "t" * 64, "mode": "sample"})
        elif request.path.startswith("/api/"):
            asked.append(request.path)
            await route.fulfill(status=503, content_type="application/json", body='{"detail":"blocked by country drive"}')
        else:
            await route.continue_()

    await context.route("**/*", guard)
    await context.add_init_script(
        "if(!sessionStorage.getItem('spain-quiet-drive')){localStorage.clear();"
        "localStorage.setItem('rocoto-app-config',JSON.stringify({version:1,sector:['fish'],cast:'fish'}));"
        f"localStorage.setItem('rocoto-workspace-capabilities:fish',{json.dumps(capabilities)});"
        f"localStorage.setItem('rocoto-cedar-collections-base','{origin}/');"
        "sessionStorage.setItem('spain-quiet-drive','ready');}"
    )
    page = await context.new_page()
    page.set_default_timeout(20000)
    try:
        await page.goto(f"{origin}{EN}#/sales", wait_until="networkidle")
        await page.get_by_test_id("rail").wait_for()
        await page.get_by_test_id("journey-card").wait_for()
        await page.wait_for_timeout(2500)
        return [path for path in asked if path in MONEY_READS]
    finally:
        await context.close()


async def spain_money_quiet(browser, origin: str, origins: set[str]) -> None:
    """AND NOTHING OF MONEY RUNS EITHER (FEED-IA §247.9).

    The Business setup ring read the bank capability whatever the workspace kept, so a Spanish desk
    asked the money API for a bank posture on every mount and again on the provider's own timer —
    a question about an area with no seat, repeated for as long as the workspace stayed open. The
    milestone and the read are one object now: `BankMilestone` holds the hook and mounts only where
    the bank milestone does. The control is the same page with Money on, which must still ask.
    """
    quiet = await money_reads_on_sales(browser, origin, origins, money=False)
    check(quiet == [], "a Sales desk with Money off asks the money API nothing", asked=quiet)
    loud = await money_reads_on_sales(browser, origin, origins, money=True)
    check(bool(loud), "and the same desk with Money on reads its bank posture", asked=loud)


async def main() -> None:
    if not (DIST / "cedar" / "index.html").is_file():
        raise SystemExit(f"{DIST}/cedar/index.html is not there. Run `npm run build:app-en` first.")
    if not (DIST / "cedar" / "es" / "index.html").is_file():
        raise SystemExit(f"{DIST}/cedar/es/index.html is not there — this build published no Castellano entry.")
    OUT.mkdir(parents=True, exist_ok=True)
    server, served = serve(DIST)
    origin = os.getenv("ROCOTO_URL", served).rstrip("/")
    parsed = urlsplit(origin)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise SystemExit("ROCOTO_URL must use local HTTP.")
    no_marker_dir, fallback_dir = unpublished_origins(DIST, OUT / "origins")
    _, no_marker_origin = serve(no_marker_dir)
    _, fallback_origin = serve(fallback_dir)
    origins = {origin, no_marker_origin, fallback_origin}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})

        async def local_only(route):
            request = urlsplit(route.request.url)
            if f"{request.scheme}://{request.netloc}" not in origins:
                await route.abort()
            elif request.path.startswith("/api/"):
                await route.fulfill(status=503, content_type="application/json", body='{"detail":"blocked by country drive"}')
            else:
                await route.continue_()

        await context.route("**/*", local_only)
        # One clear, at the first document of the run: the language preference and the workspace
        # state both have to SURVIVE the hop between the two entries, so a per-load clear would
        # erase the very fact under test.
        await context.add_init_script("""if(!sessionStorage.getItem('country-drive')) {
          localStorage.clear(); localStorage.setItem('rocoto-app-config', JSON.stringify({version:1,sector:['fish'],cast:'fish'}));
          sessionStorage.setItem('country-drive','ready');
        }""")
        page = await context.new_page()
        page.set_default_timeout(20000)
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        async def go(path: str, route: str = "", at: str = "") -> None:
            await page.goto(f"{at or origin}{path}{route}", wait_until="networkidle")
            await page.wait_for_timeout(500)

        async def lang() -> str:
            return await page.evaluate("document.documentElement.lang")

        async def rail() -> str:
            return await page.get_by_test_id("rail").inner_text()

        async def choose_language(value: str) -> None:
            await page.get_by_test_id("row-ui-language").click()
            await page.get_by_test_id("language-card").wait_for()
            await page.get_by_test_id(f"ui-language-{value}").click()
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(400)

        # ── ENGLISH IS THE DESIGN SOURCE, AND IT IS WHAT A FRESH BROWSER GETS ──────────────────
        await go(EN, "#/sales")
        check(await lang() == "en", "a fresh browser opens Cedar in English", entry=page.url)
        check("Sales" in await rail(), "the English rail says Sales")
        await go(EN, "#/money")
        peru_balance = await page.get_by_test_id("money-bank-balance").inner_text()
        check("S/" in peru_balance, "Peru starts in PEN", value=peru_balance)

        # ── LANGUAGE IS A CHOICE IN SETTINGS, AND IT KEEPS THE SURFACE A PERSON IS ON ──────────
        await go(EN, "#/admin/app-settings")
        check("App language" in await page.get_by_test_id("row-ui-language").inner_text(), "Settings holds an App language row")
        await choose_language("es")
        check(page.url.endswith(f"{ES}#/admin/app-settings"), "Castellano lands on the Spanish entry, same screen", url=page.url)
        check(await lang() == "es", "the Spanish entry declares lang es")
        check("Ventas" in await rail(), "the Spanish rail says Ventas", rail=(await rail()).replace("\n", " · ")[:80])
        settings_text = await page.get_by_test_id("seat-app-settings").inner_text()
        check("Idioma de la aplicación" in settings_text, "Settings reads Spanish")
        check("País" in settings_text, "Country stays discoverable in Spanish")

        # ── SPANISH + PERU: SOLES ─────────────────────────────────────────────────────────────
        await go(ES, "#/money")
        spanish_peru = await page.get_by_test_id("money-bank-balance").inner_text()
        check("S/" in spanish_peru, "Spanish + Peru shows soles", value=spanish_peru)
        check(spanish_peru == peru_balance, "the language change left the market alone", value=spanish_peru)
        await go(ES, "#/sales")
        await expect(page.locator('[data-currency="PEN"]').first).to_be_visible()
        check(await page.locator('[data-currency="EUR"]').count() == 0, "Spanish + Peru Sales figures declare PEN")

        # ── SPANISH + SPAIN: EUROS, AND MONEY STARTS QUIET ────────────────────────────────────
        await go(ES, "#/admin/app-settings")
        await page.get_by_test_id("workspace-country-spain").click()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(400)
        check(await lang() == "es", "a country change keeps the language", url=page.url)
        check(not await page.get_by_test_id("workspace-money-toggle").is_checked(), "Spain starts with Money off")
        await go(ES, "#/money")
        check(page.url.endswith("#/sales"), "disabled Money returns to Sales", url=page.url)
        await go(ES, "#/admin/app-settings")
        await page.get_by_test_id("workspace-money-toggle").evaluate("el => el.click()")
        await expect(page.get_by_test_id("workspace-money-toggle")).to_be_checked()
        await go(ES, "#/money")
        values = {
            "balance": await page.get_by_test_id("money-bank-balance").inner_text(),
            "invoices": await page.get_by_test_id("money-invoices-card").inner_text(),
            "credit": await page.get_by_test_id("money-credit-card").inner_text(),
            "incoming": await page.get_by_test_id("money-incoming-card").inner_text(),
        }
        for surface, text in values.items():
            has_eur = "€" in text or (surface == "incoming" and "EUR" in text)
            check(has_eur and "S/" not in text and "PEN" not in text, f"Spanish + Spain {surface} reads euros", value=text[:90])
        # ── THE MARKET SETS THE CURRENCY; THE PROVIDER SETS THE POSTURE (MONEY-SPEC «Connection
        # state») ─────────────────────────────────────────────────────────────────────────────
        # This workspace holds no collection origin, so every money selector reads `unavailable`:
        # the working-capital card carries its one setup act instead of an offer, and the
        # bank-transactions card is one picture and one Connect bank. The euro figure under test
        # moved to customer credit, which states an amount on the market's own currency alone.
        # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8, «nothing is future»). The card used to be
        # `money-future`; the word Future has left Cedar, so the same card is `money-working-capital`
        # and carries the same `data-bank-posture`. What it said before: a Future preview of working
        # capital. What it says now: Working capital, a feature the bank connection gates.
        await expect(page.get_by_test_id("money-working-capital")).to_have_attribute("data-bank-posture", "unavailable")
        check(True, "Spanish + Spain working capital states the bank posture the provider left")
        await go(ES, "#/money/transactions")
        check(
            await page.get_by_test_id("money-bank-setup-state").count() == 1
            and await page.get_by_test_id("money-bank-open-setup").count() == 1,
            "Spanish + Spain transactions answer with one picture and one Connect bank",
        )
        for route in ("sales", "customers"):
            await go(ES, f"#/{route}")
            await expect(page.locator('[data-currency="EUR"]').first).to_be_visible()
            check(await page.locator('[data-currency="PEN"]').count() == 0, f"Spanish + Spain {route} figures declare EUR")

        # ── ONE EURO, ONE GRAMMAR, ONE CLICK APART ────────────────────────────────────────────
        # Money printed «€6,131.59» (en-PE) while the Sales day header printed «22.697,50 €»
        # (es-ES), so a Spanish merchant scanning the balance read six euros. Both surfaces are
        # read here and both are held to Spain's own shape.
        await go(ES, "#/money")
        money_eur = await page.get_by_test_id("money-bank-balance").inner_text()
        check(bool(EURO_ES.search(money_eur)), "Spanish + Spain Money reads Spain's own grammar", value=money_eur)
        check(not EURO_EN.search(money_eur), "and carries no US grouping", value=money_eur)
        await go(ES, "#/sales")
        sales_eur = await page.locator('[data-currency="EUR"]').first.inner_text()
        check(bool(EURO_ES.search(sales_eur)), "Spanish + Spain Sales reads the same grammar", value=sales_eur)
        check(not EURO_EN.search(sales_eur), "and Money and Sales agree one click apart", money=money_eur, sales=sales_eur)

        # ── THE TWO CONTROLS PETER DEMOS ARE NEIGHBOURS ───────────────────────────────────────
        # «the spanish - peru toggle etc. super key cos im demoing to spain». The roadmap block —
        # nineteen English strings — used to stand between Language and Country, so the walk from
        # one control to the other crossed it. It now closes the page.
        await go(ES, "#/admin/app-settings")
        order = await page.evaluate("""() => {
          const at = (sel) => { const node = document.querySelector(sel); return node ? node.getBoundingClientRect().top + window.scrollY : -1; };
          return { language: at('[data-section="language"]'), country: at('[data-section="workspace-country"]'), roadmap: at('[data-testid="admin-roadmap"]') };
        }""")
        check(all(v >= 0 for v in order.values()), "Settings holds Language, Country and Roadmap", order=order)
        check(order["country"] > order["language"], "Country follows Language", order=order)
        check(order["roadmap"] > order["country"], "the English roadmap closes the page, below Country", order=order)

        # ── THE PICKER SAYS WHAT IT OFFERS, AND STOPS THERE ───────────────────────────────────
        settings_now = await page.get_by_test_id("seat-app-settings").inner_text()
        for gone in ("se queda como lo dejes", "stays as it is", "stays as you set it"):
            check(gone not in settings_now, f"the reassurance «{gone}» is off the page")
        await page.get_by_test_id("row-ui-language").click()
        await page.get_by_test_id("language-card").wait_for()
        card_text = await page.get_by_test_id("language-card").inner_text()
        check("come with you" not in card_text and "misma pantalla" not in card_text,
              "the language card is a heading, two pills and one act", card=card_text.replace("\n", " · "))
        check(await page.get_by_test_id("ui-language-es").count() == 1, "a published Castellano is offered")
        await page.keyboard.press("Escape")

        # ── THE BANCA CARD KEEPS ITS HEIGHT IN BOTH LANGUAGES ─────────────────────────────────
        # Its height used to be decided by `name === 'Bank account'`, and the snapshot translates
        # that name — so the Spanish card grew 48px while the English one stayed short.
        await go(ES, "#/admin/connections")
        spanish_bank = (await page.get_by_test_id("payment-connection").bounding_box())["height"]
        await page.screenshot(path=str(OUT / "spanish-connections-1600.png"))

        # ── THE SHIPPED OUTPUT NAMES STAY ENGLISH IN THE RECORD ───────────────────────────────
        # The two entries share `rocoto:outputs:templates`, so a Spanish-first visit used to leave
        # «Albaranes» inside the record the English design build reads back.
        await go(ES, "#/sales")
        spanish_seat = await page.locator('[data-testid^="day-albaranes-"]:not([data-testid$="-aloud"])').first.inner_text()
        check("Albaranes" in spanish_seat, "the Spanish day header reads Albaranes", value=spanish_seat.replace("\n", " · ")[:60])
        stored = await page.evaluate("() => localStorage.getItem('rocoto:outputs:templates:fish')")
        check(stored is not None and "Delivery notes" in stored, "and the stored record keeps the English shipped name", record=(stored or "")[:80])
        check("Albaranes" not in (stored or ""), "with no Spanish name written into it")

        # ── THE SCREENS PETER DEMOS, IN CASTELLANO ────────────────────────────────────────────
        for width in (1600, 390):
            await page.set_viewport_size({"width": width, "height": 1000 if width > 500 else 844})
            await go(ES, "#/sales")
            await page.screenshot(path=str(OUT / f"spanish-sales-{width}.png"))
            await page.get_by_test_id("export-centre").click()
            await page.wait_for_timeout(800)
            await page.screenshot(path=str(OUT / f"spanish-prep-{width}.png"))
            prep = await page.get_by_test_id("export-batch-hub").inner_text()
            check("Próximas entregas" in prep, f"Prep reads Spanish at {width}px")
            check("Imprimir" in prep and "Descargar" in prep, f"Prep keeps Print and Download at {width}px")
            await page.keyboard.press("Escape")
            await go(ES, "#/money")
            await page.screenshot(path=str(OUT / f"spanish-spain-money-{width}.png"))
            await go(ES, "#/admin/app-settings")
            await page.screenshot(path=str(OUT / f"spanish-settings-{width}.png"))

        # ── EVERY PHONE WIDTH FITS ────────────────────────────────────────────────────────────
        # A SPANISH WORD IS LONGER THAN ITS ENGLISH ONE, AND THE HEADER IS THE NARROWEST ROW IN
        # THE PRODUCT. «Preparación» measured 112px from x=231 at 320, so its last four letters
        # were clipped by the bar while the page itself reported no overflow at all. The word is
        # «Reparto», and this assertion is what keeps the next long one out.
        for width in (390, 320):
            await page.set_viewport_size({"width": width, "height": 844})
            for route in ("#/money", "#/sales", "#/admin/app-settings"):
                await go(ES, route)
                overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                check(overflow <= 1, f"Spanish {route} fits {width}px", overflow=overflow)
            await go(ES, "#/sales")
            box = await page.get_by_test_id("export-centre").bounding_box()
            check(box is not None and box["x"] + box["width"] <= width, f"the Spanish header word fits inside {width}px", right=round((box or {}).get("x", 0) + (box or {}).get("width", 0)))
            check(box is not None and box["height"] >= 44, f"the Spanish header act keeps the 44px floor at {width}px", height=(box or {}).get("height"))
            # A CAPTURE IS NAMED FOR WHAT IS IN IT. This loop stands on Sales, and it used to write
            # `spanish-settings-{width}.png` over the Settings captures the first loop had taken —
            # so the Settings evidence at 390 was a picture of the Sales day header.
            await page.screenshot(path=str(OUT / f"spanish-sales-header-{width}.png"))
            await go(ES, "#/admin/app-settings")
            await page.screenshot(path=str(OUT / f"spanish-settings-{width}.png"))
            # ── THE COUNTRY ROW IS TWO COLUMNS ON A PHONE ───────────────────────────────────
            # At 320 in Castellano «País del espacio de trabajo» painted under «España · EUR»
            # beside two pills — three columns on a 288px row. The pills say the country, so the
            # value stands down on a phone and the label keeps its own room beside the pills.
            row = page.locator('[data-row="workspace-country-choice"]')
            label = await row.locator("[data-row-label]").bounding_box()
            spain = await page.get_by_test_id("workspace-country-spain").bounding_box()
            peru = await page.get_by_test_id("workspace-country-peru").bounding_box()
            check(await page.locator('[data-value="workspace-country-choice"]').count() == 0,
                  f"the country value stands down at {width}px · the pills say the country")
            check(label is not None and spain is not None and label["x"] + label["width"] <= spain["x"] + 1,
                  f"the country label keeps its own column at {width}px",
                  label_right=round((label or {}).get("x", 0) + (label or {}).get("width", 0)), pills_left=round((spain or {}).get("x", 0)))
            check(peru is not None and peru["x"] + peru["width"] <= width,
                  f"the country pills stand inside {width}px", right=round((peru or {}).get("x", 0) + (peru or {}).get("width", 0)))

        # ── ENGLISH REMAINS AVAILABLE FOR DESIGN REVIEW ───────────────────────────────────────
        await page.set_viewport_size({"width": 1600, "height": 1000})
        await go(ES, "#/admin/app-settings")
        await choose_language("en")
        check(page.url.endswith(f"{EN}#/admin/app-settings"), "English returns to the English entry, same screen", url=page.url)
        check(await lang() == "en", "the English entry declares lang en")
        check("Sales" in await rail(), "the English rail says Sales again")

        # ── ENGLISH + SPAIN: THE FOURTH COMBINATION, WITH SPAIN STILL SELECTED ─────────────────
        # The walk used to pass through this state and assert only the rail's word, so a euro
        # regression that lived in the English design build alone would have gone green.
        await go(EN, "#/money")
        english_spain = await page.get_by_test_id("money-bank-balance").inner_text()
        check("€" in english_spain and "S/" not in english_spain, "English + Spain Money reads euros", value=english_spain)
        check(bool(EURO_ES.search(english_spain)), "English + Spain keeps Spain's euro grammar", value=english_spain)
        await go(EN, "#/sales")
        english_sales = await page.locator('[data-currency="EUR"]').first.inner_text()
        check(bool(EURO_ES.search(english_sales)), "English + Spain Sales agrees with Money", money=english_spain, sales=english_sales)
        await page.screenshot(path=str(OUT / "english-spain-sales-1600.png"))
        english_seat = await page.locator('[data-testid^="day-albaranes-"]:not([data-testid$="-aloud"])').first.inner_text()
        check("Delivery notes" in english_seat, "the English day header still reads Delivery notes", value=english_seat.replace("\n", " · ")[:60])
        await go(EN, "#/admin/connections")
        english_bank = (await page.get_by_test_id("payment-connection").bounding_box())["height"]
        check(abs(english_bank - spanish_bank) < 1, "the Banca card is the same height as Bank account", english=english_bank, spanish=spanish_bank)
        await page.screenshot(path=str(OUT / "english-connections-1600.png"))

        # ── PERU'S OWN MONEY PREFERENCE SURVIVED THE WHOLE WALK ───────────────────────────────
        await go(EN, "#/admin/app-settings")
        await page.get_by_test_id("workspace-country-peru").click()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(400)
        check(await page.get_by_test_id("workspace-money-toggle").is_checked(), "Peru Money preference is restored")
        await go(EN, "#/money")
        restored = await page.get_by_test_id("money-bank-balance").inner_text()
        check(restored == peru_balance, "Peru balance and currency are restored", value=restored)

        # ── A STORED CASTELLANO MEETS THE ENGLISH ADDRESS ─────────────────────────────────────
        await go(EN, "#/admin/app-settings")
        await choose_language("es")
        await go(EN, "#/money")
        check(page.url.endswith(f"{ES}#/money"), "opening /cedar/ with Castellano stored relocates to /cedar/es/", url=page.url)
        check(await lang() == "es", "and the relocated document is the Spanish one")
        spanish_peru_again = await page.get_by_test_id("money-bank-balance").inner_text()
        check(spanish_peru_again == peru_balance, "and it is the same workspace, in soles", value=spanish_peru_again)

        # ── AN ORIGIN THAT PUBLISHES NO CASTELLANO KEEPS A PERSON ON CEDAR ────────────────────
        # `make dev` serves no `/cedar/es/`, so choosing Castellano used to send a person to
        # whatever the dev server's fallback answers with — and the stored preference sent them
        # back there on every later load, with the Settings screen that could undo it unreachable.
        await go(EN, "#/admin/app-settings", at=no_marker_origin)
        check(await lang() == "en", "an unmarked build opens Cedar in English", url=page.url)
        check("Sales" in await rail(), "and Cedar is the thing that mounted")
        await page.get_by_test_id("row-ui-language").click()
        await page.get_by_test_id("language-card").wait_for()
        check(await page.get_by_test_id("ui-language-en").count() == 1, "Settings offers the language this build published")
        check(await page.get_by_test_id("ui-language-es").count() == 0, "and offers no entry it never wrote")
        await page.screenshot(path=str(OUT / "unpublished-language-card-1600.png"))
        await page.keyboard.press("Escape")
        await page.evaluate("() => localStorage.setItem('rocoto-display-language', 'es')")
        await go(EN, "#/sales", at=no_marker_origin)
        check(page.url.startswith(f"{no_marker_origin}{EN}"), "a stored Castellano stays on Cedar here", url=page.url)
        check("Sales" in await rail(), "and the app renders", url=page.url)

        # ── A SPANISH ADDRESS ANSWERED IN ENGLISH SAYS SO, ONCE ───────────────────────────────
        # A host can serve the English document at `/cedar/es/` — an older generation, a partial
        # copy. The boot tries the Spanish index once and then stands still, in English.
        await go(ES, "#/sales", at=fallback_origin)
        check(page.url.startswith(f"{fallback_origin}{ES_INDEX}"), "the English fallback is retried at the Spanish index once", url=page.url)
        check(await lang() == "en", "and the document that answered is English", url=page.url)
        check("Sales" in await rail(), "so Cedar renders in English rather than a blank Spanish URL")
        await go(ES_INDEX, "#/admin/app-settings", at=fallback_origin)
        await page.get_by_test_id("row-ui-language").click()
        await page.get_by_test_id("language-card").wait_for()
        check(await page.get_by_test_id("ui-language-es").count() == 0, "an unpublished Castellano leaves the picker")
        await page.screenshot(path=str(OUT / "english-fallback-settings-1600.png"))
        await page.keyboard.press("Escape")
        await go(EN, "#/sales", at=fallback_origin)
        check(page.url.startswith(f"{fallback_origin}{EN}"), "and the English entry stays put afterwards", url=page.url)

        check(not errors, "the language and country walk has no page errors", errors=errors[:3])
        await spain_money_off(browser, origin, origins)
        await spain_money_quiet(browser, origin, origins)
        await browser.close()

    payload = {"dist": str(DIST), "origin": origin, "checks": len(RESULTS),
               "pending": PENDING, "results": RESULTS}
    (OUT / "results.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nGREEN {len(RESULTS)}/{len(RESULTS)} · shots in {OUT}")
    # ⚠ AN UNPROVED FACT IS RED, RATHER THAN QUIET. `PENDING` holds a door this drive READ and could
    # not hold to an answer, because the file that decides it is another worker's this round. It
    # used to print beside the green count and exit 0, which is a gate answering «could not check»
    # as «clean». The run fails instead, and names the flag that closes each one.
    if PENDING:
        for row in PENDING:
            print(f"PENDING · {row['check']} · {row['note']}")
        raise SystemExit(f"PENDING {len(PENDING)} · facts this run read and left unproved")


if __name__ == "__main__":
    asyncio.run(main())
