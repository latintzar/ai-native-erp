"""vital_demo_doors.py — /demo's TWO SIGN-IN DOORS, END TO END, THROUGH THE REAL ASGI APP.

WHY THIS FILE EXISTS. `vital_demo_auth.py` proves the ORGANS: consume_magic is single-use, sign_in
provisions exactly one workspace, the nonce binding refuses a stranger. It calls Python functions.
Two independent audits (2026-08-08/09) then found that NEITHER DOOR COULD ACTUALLY BE WALKED —

  · the magic link 302s to `/demo/entrar?t=…`, and `entrar` existed nowhere in the SPA, so the
    splat route swallowed it and dropped the query string. `POST /api/demo/auth/verify/{token}`
    had ZERO callers. A 0 % completion rate, with every organ underneath it green.
  · the Google button went to `sessionApi.login` → `/api/sup/session/login`, which REQUIRES an
    existing membership and 403s a stranger. `POST /api/demo/auth/google` — the only path that
    provisions — also had zero callers.

Function-level vitals cannot see that, and a surface Peter is about to put in front of prospects
must be proved as a SURFACE. So this rides `httpx.ASGITransport` against the real `app.app`, with
a real database and a real cookie jar, and walks what a browser walks:

  ① THE MAGIC DOOR, all the way: ask → the mail actually sent, linking at the app's own screen →
    the API's legacy GET hop still redirects → the cross-site POST refused → the no-nonce POST
    refused → the RIGHT browser gets a `sup_session` cookie and a provisioned workspace, WITH the
    page's two boot probes racing the sign-in in one commit and a third 401 landing after it →
    `/me` answers → a demo write authorises.
  ② THE GOOGLE DOOR, all the way: a verified Google identity with NO membership is refused by the
    PANEL door and MINTS a workspace at the DEMO door (that difference is the whole of §17.56c),
    and «Salir» then really does forget the browser.
  ③ THE LIVE-TENANT FENCE, at the ROUTE, not the helper: a commit posted through the demo door
    against a `status='live'` tenant is refused before `golive.seed_catalogue` can retire a paying
    customer's assortment. This is the punch list's P0#1 and it is the one that destroys data.
  ④ CAPABILITY, at the route: a `repartidor` cookie reaches nothing.
  ⑤ THE ANONYMOUS DOOR IS GONE, at the route: 404/405, not 200.

Nothing here reaches the network: Supabase's verifier and Resend's sender are both stubbed. The
DB is real, and it must be a rehearsal clone.

Run on prod as root:
  REHEARSAL_DB=rocoto_rehearsal PYTHONPATH=. venv/bin/python tests/vital_demo_doors.py
"""
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import config  # noqa: E402
import db  # noqa: E402

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_clone() -> None:
    """NEVER against production. This vital PROVISIONS, and provisioning is a write."""
    dsn = config.DATABASE_URL or ""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0]
    if tail == "rocoto" or "rehearsal" not in tail and "secfix" not in tail:
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


STAMP = str(int(time.time()))[-6:]
MAIL = f"puerta.magica.{STAMP}@distribuciones-vital-{STAMP}.es"
GOOG = f"puerta.google.{STAMP}@quesos-vital-{STAMP}.es"
COMPANY = "Distribuciones Vital, S.L."
# same-origin, the way the SPA's own fetch arrives through the panel's Vercel rewrite
SAME = {"sec-fetch-site": "same-origin", "origin": "https://app.soyrocoto.com"}
CROSS = {"sec-fetch-site": "cross-site", "origin": "https://evil.tld"}


def token_in(html: str) -> str:
    """The token as the reader's browser reaches it — out of the mailed link. That link is the SPA's
    own `/demo/entrar?t=…` since 2026-08-09; see the note at ① for why it moved off the API path."""
    return html.split("/demo/entrar?t=")[1].split('"')[0].split("&")[0].split("<")[0].strip()


async def main():
    guard_clone()
    import httpx

    import actions as _actions
    import app as rocoto_app
    import consent as consent_mod
    import demo_api as app_mod  # the rate-limit constants ⑦ drives against
    import demo_auth
    import demo_flow
    import sup_api

    await db.init()
    await consent_mod.ensure_schema()
    await demo_auth.ensure_schema()
    await demo_flow.ensure_demo_schema()
    config.DEMO_FLOW_ENABLED = True          # the kill switch is off on prod right now, by design
    # THIS FILE PROVES THE DOORS CAN BE WALKED, which is a statement about their MECHANICS — the
    # nonce, the origin wall, the cookie, the redirect, the capability. Both walks below end in a
    # first sight, so they need the mint open. The mint's own closure (§21/§22, and the shipped
    # default `DEMO_PROVISION_OPEN=False`) is proved in tests/vital_demo_auth.py, which flips this
    # switch both ways and asserts that a stranger is refused and an existing operator is not.
    config.DEMO_PROVISION_OPEN = True

    sent: list = []

    async def _stub_send(to, subject, html, reply_to=None, headers=None):
        sent.append({"to": to, "html": html})
        return True

    WHO = {"u": None}

    async def _fake_verify(_tok):
        return WHO["u"]

    real_send, real_verify = _actions.send_email, demo_auth.brain_auth.verify_token
    real_login_verify = sup_api.brain_auth.verify_token
    _actions.send_email = _stub_send
    demo_auth.brain_auth.verify_token = _fake_verify
    sup_api.brain_auth.verify_token = _fake_verify

    tr = httpx.ASGITransport(app=rocoto_app.app)
    try:
        # ══ ① THE MAGIC DOOR, END TO END ═════════════════════════════════════════════════════════
        print("\n① the magic link, walked")
        async with httpx.AsyncClient(transport=tr, base_url="https://app.soyrocoto.com") as c:
            r = await c.get("/api/demo/config")
            ck("the public config answers before anyone signs in (the consent wording)",
               r.status_code == 200 and bool(r.json().get("consent", {}).get("version")),
               str(r.status_code))

            r = await c.post("/api/demo/auth/magic", headers=SAME,
                             json={"email": MAIL, "company": COMPANY,
                                   "consent": {"marketing": True},
                                   "text_version": consent_mod.CONSENT_TEXT_VERSION})
            ck("asking for a link answers 200", r.status_code == 200, str(r.status_code))
            ck("…and the mail actually went", len(sent) == 1 and sent[0]["to"] == MAIL)
            nonce_name = demo_auth._nonce_name()
            ck("…and the response set the requester nonce cookie",
               bool(c.cookies.get(nonce_name)), nonce_name)

            # the token, as it appears in the mailed link
            #
            # THIS PARSE USED TO SPLIT ON `/api/demo/auth/verify/` AND IT WAS RIGHT TO, until
            # 2026-08-09. The mail pointed at the API and leaned on that route's 302 to reach the
            # screen; `demo_auth._magic_url` now mails `{DEMO_PUBLIC_BASE_URL}/demo/entrar?t=…`
            # directly. The old expectation was a property of the MAIL, not a rule of the door — and
            # keeping it would have pinned the most-read link Rocoto sends to `PUBLIC_BASE_URL`,
            # which on this deployment is the bare `https://5-161-178-146-rocoto.sslip.io`. So the
            # parse follows the link, and the two rules that ARE load-bearing get asserted instead:
            # the mailed link must land on the demo host's own sign-in screen, and the API's GET hop
            # must STILL redirect without consuming, because links mailed before today are sitting
            # in inboxes and corporate scanners prefetch every URL in them.
            html = sent[0]["html"]
            demo_base = (config.DEMO_PUBLIC_BASE_URL or "https://app.soyrocoto.com").rstrip("/")
            ck("the mail links straight at the sign-in screen on the demo host — the reader sees a "
               "name, not an IP", f"{demo_base}/demo/entrar?t=" in html, demo_base)
            ck("…and no bare PUBLIC_BASE_URL address appears anywhere in that mail",
               config.PUBLIC_BASE_URL not in html, config.PUBLIC_BASE_URL)
            tok = token_in(html)
            ck("the mail carries a sign-in link with a token", len(tok) > 20, f"{len(tok)} chars")

            r = await c.get(f"/api/demo/auth/verify/{tok}", follow_redirects=False)
            ck("the API's GET hop still redirects and does NOT consume — the links already in "
               "inboxes keep working, and mail scanners fetch every URL",
               r.status_code == 302 and "/demo/entrar?t=" in r.headers.get("location", ""),
               r.headers.get("location", "")[:60])

        # a DIFFERENT browser (no nonce cookie), posting cross-site — the login-CSRF attack
        async with httpx.AsyncClient(transport=tr, base_url="https://app.soyrocoto.com") as v:
            r = await v.post(f"/api/demo/auth/verify/{tok}", headers=CROSS)
            ck("F3: a CROSS-SITE form POST is refused (403), so a victim cannot be logged into "
               "the attacker's workspace", r.status_code == 403, str(r.status_code))
            r = await v.post(f"/api/demo/auth/verify/{tok}", headers=SAME)
            ck("F3: even same-origin, a browser that never asked for the link is refused (401) — "
               "so observing the URL in transit is not enough", r.status_code == 401,
               str(r.status_code))
            ck("F3: neither refusal set a session cookie",
               not v.cookies.get(sup_api.SUP_COOKIE))

        # the browser that ASKED — same client, so it still holds the nonce
        async with httpx.AsyncClient(transport=tr, base_url="https://app.soyrocoto.com") as c:
            await c.post("/api/demo/auth/magic", headers=SAME,
                         json={"email": MAIL, "company": COMPANY,
                               "consent": {"marketing": True}})
            tok2 = token_in(sent[-1]["html"])

            # ══ THE THREE REQUESTS OF ONE COMMIT, FIRED THE WAY THE PAGE FIRES THEM ══════════════
            # `/demo/entrar` mounts three things at once and all three fetch immediately: DemoLayout's
            # boot `GET /api/demo/me`, the panel AuthProvider's `GET /api/sup/session/me`, and
            # EntrarScreen's `POST …/verify/{t}`. The first two carry no cookie yet and correctly
            # answer 401; the third mints the session. `_sup_auth_handler` used to answer EVERY 401
            # with `Set-Cookie: sup_session=""; Max-Age=0`, and a 401 knows only about the request it
            # refused while Set-Cookie rewrites the WHOLE jar — so whichever probe answered last threw
            # away the session the sign-in had just created. Measured on the live stack: sign-in at
            # +0.545s, the straggling probe's 401 at +2.8s, jar empty. Peter's two prod sign-ins on
            # 2026-08-09 both show a `sup_session` row touched once ~0.175s after minting and never
            # again — never revoked, never expired. The browser simply stopped holding the cookie.
            # A SERIAL WALK CANNOT SEE THIS, which is why the door's own vital was green through
            # every one of those sign-ins. So the three go out together, and then a straggler goes
            # out after — one cookie jar, exactly one browser.
            probe_a = c.build_request("GET", "/api/demo/me", headers=SAME)
            probe_b = c.build_request("GET", "/api/sup/session/me", headers=SAME)
            r, pa, pb = await asyncio.gather(
                c.post(f"/api/demo/auth/verify/{tok2}", headers=SAME),
                c.send(probe_a), c.send(probe_b))
            body = r.json() if r.status_code == 200 else {}
            ck("THE RIGHT BROWSER GETS IN (200) — the door completes end to end",
               r.status_code == 200, f"{r.status_code} {str(body)[:120]}")
            ck("…the two boot probes that raced it were refused, as they should be (they carried no "
               "session yet)", pa.status_code == 401 and pb.status_code == 401,
               f"demo/me {pa.status_code} · sup/session/me {pb.status_code}")
            ck("…and NEITHER refusal wrote the cookie jar — a 401 knows only about the request it "
               "refused, and Set-Cookie rewrites everything",
               not any("sup_session" in h for p in (pa, pb)
                       for h in p.headers.get_list("set-cookie")),
               str([p.headers.get_list("set-cookie") for p in (pa, pb)])[:80])
            ck("…with a sup_session cookie", bool(c.cookies.get(sup_api.SUP_COOKIE)))

            # THE STRAGGLER: the probe that left before the sign-in and lands after it. Built by hand
            # with its Cookie header stripped, because in this jar a request issued now would carry
            # the session the browser did not yet have when the real one was sent. This is the exact
            # +2.8s response that emptied the jar on the live stack.
            _late = c.build_request("GET", "/api/demo/me", headers=SAME)
            _late.headers.pop("cookie", None)
            late = await c.send(_late)
            ck("a 401 LANDING AFTER THE SIGN-IN leaves the session alone — this is the bug that ate "
               "every /demo sign-in on 2026-08-09", late.status_code == 401
               and bool(c.cookies.get(sup_api.SUP_COOKIE)), str(late.status_code))
            _still = await c.get("/api/demo/me")
            ck("…and the browser is still signed in one request later (200, not «Tu sesión ha "
               "caducado»)", _still.status_code == 200, str(_still.status_code))
            ck("…a provisioned workspace named with the company they typed",
               body.get("tenant_name") == COMPANY and body.get("provisioned") is True,
               str(body.get("tenant_name")))
            ck("…the owner role and its caps", body.get("role") == "owner"
               and "admin:rocoto" in (body.get("caps") or []))
            ck("…a CSRF token the SPA echoes on every write", bool(body.get("csrf")))
            ck("…and the consent they ticked, recorded against the wording shown",
               (body.get("consent") or {}).get("marketing") is True, str(body.get("consent")))
            slug, csrf = body.get("tenant_slug"), body.get("csrf")
            ftok = body.get("token")
            ck("…and the flow token the SPA needs to name its session", bool(ftok))

            r = await c.get("/api/demo/me")
            ck("/me answers for that cookie", r.status_code == 200
               and r.json().get("email") == MAIL, str(r.status_code))

            # ══ ⑥ THE RETENTION MARKER, WRITTEN BY THE DOOR ══════════════════════════════════════
            # BUG 1 (2026-08-09): the reaper matched a slug SHAPE and `provisioning.provision`
            # derives the slug from the email, so the sweep reached zero of the tenants this door
            # creates while two live public pages promised 90-day deletion. The discriminator is
            # now a column written HERE, at creation — asserted at the route, because a marker the
            # organ writes and the door does not reach is the same bug in a different place.
            async with db.get_pool().acquire() as con:
                via = await con.fetchval(
                    "select provisioned_via from tenants where slug=$1", slug)
            ck("⑥ the workspace this door minted is marked provisioned_via='demo' — the ONE thing "
               "that lets the retention sweep ever name it", via == "demo", str(via))

            # ══ ⑦ THE EXPENSIVE ROUTES ARE METERED (BUG 3) ═══════════════════════════════════════
            # `/order-card`, `/media`, `/phone`, `/qr` and `/stream` had no ceiling at all, on the
            # single uvicorn worker that also answers paying customers' WhatsApp webhooks. Driven
            # here rather than unit-tested because the limit is a property of the ROUTE.
            print("\n⑦ the expensive routes have a ceiling")
            hit429 = 0
            for _i in range(app_mod._DEMO_QR_ROTATE_PER_SESSION + 3):
                rr = await c.get(f"/api/demo/session/{ftok}/qr?rotate=1", headers=SAME)
                if rr.status_code == 429:
                    hit429 += 1
            ck("`/qr?rotate=1` (an HMAC mint AND a DB write per call) walls at its own tighter "
               "bucket", hit429 >= 1, f"{hit429} refusals")
            r = await c.get(f"/api/demo/session/{ftok}/qr", headers=SAME)
            ck("…and the PLAIN redraw is a different bucket, so hitting the rotate wall does not "
               "black out the QR already on screen", r.status_code == 200, str(r.status_code))
            walled = 0
            for _i in range(app_mod._DEMO_CARD_PER_SESSION + 3):
                rr = await c.get(f"/api/demo/session/{ftok}/order-card/1", headers=SAME)
                if rr.status_code == 429:
                    walled += 1
            ck("`/order-card` (hundreds of ms of Pillow per hit) walls — an <img> retry loop "
               "cannot starve the WhatsApp webhook", walled >= 1, f"{walled} refusals")
            for what in ("media", "phone"):
                rr = await c.get(f"/api/demo/session/{ftok}/{what}", headers=SAME)
                ck(f"`/{what}` still answers a normal request (the ceiling is above human speed)",
                   rr.status_code == 200, str(rr.status_code))

            # ══ ⑧ THE ORDER CARD IS RENDERED ONCE ════════════════════════════════════════════════
            # The other half of BUG 3. The card is a few hundred ms of Pillow off an APPEND-ONLY
            # event, so the second render is pure waste — waste that competes with an order arriving
            # on WhatsApp on the same single worker. Driven at `demo_flow.order_card_png` rather
            # than through the route so it needs no model and no rate-limit headroom: the event is
            # written directly, and the renderer is spied on to count actual rasterisations.
            import brain.order_card as _oc
            row_ = await demo_flow.resolve(ftok)
            scope_ = demo_flow.scope_of_row(row_)
            async with db.scoped_tx(scope_) as sc_:
                await sc_.execute(
                    "insert into scope_node(scope,tier,tenant_slug,lineage) "
                    "values($1::ltree,'customer',$2,'test') on conflict do nothing", scope_, slug)
                ev_ = await sc_.fetchval(
                    "insert into event(scope,type,source,payload,lane,lineage) "
                    "values($1::ltree,'order.drafted','vital',$2,'world','test') returning id",
                    scope_, {"lines": [{"qty": 3, "name": "Chorizo picante", "unit": "kg",
                                        "price": 9.5, "sku": "X-1"}]})
            renders = {"n": 0}
            _real_render = _oc.render_order_card

            def _spy_render(**kw):
                renders["n"] += 1
                return _real_render(**kw)

            _oc.render_order_card = _spy_render
            try:
                demo_flow.card_cache_clear()
                a_ = await demo_flow.order_card_png(ftok, str(ev_))
                b_ = await demo_flow.order_card_png(ftok, str(ev_))
                ck("the order card renders and the second request is byte-identical",
                   bool(a_) and a_ == b_, f"{len(a_ or b'')} bytes")
                ck("…and Pillow ran ONCE, not twice — the bytes came from the cache",
                   renders["n"] == 1, f"{renders['n']} renders")
                c_ = await demo_flow.order_card_png(ftok, "0" + str(ev_))
                ck("…and a differently-SPELLED ref is the same cache entry, not a second one "
                   "(«007» and «7» are one card)", c_ == a_ and renders["n"] == 1,
                   f"{renders['n']} renders")
                demo_flow.card_cache_clear()
                await demo_flow.order_card_png(ftok, str(ev_))
                ck("…and clearing the cache really does re-render (it is a cache, not a store)",
                   renders["n"] == 2, f"{renders['n']} renders")
            finally:
                _oc.render_order_card = _real_render
                demo_flow.card_cache_clear()

            # a real demo WRITE authorises (this is what the whole cookie+cap+fence chain gates)
            r = await c.post(f"/api/demo/session/{ftok}/persona",
                             headers={**SAME, "x-sup-csrf": csrf},
                             json={"changes": {"tone": "formal"}})
            ck("an authed, capped, CSRF-carrying demo write is ACCEPTED",
               r.status_code == 200, f"{r.status_code} {r.text[:100]}")
            r = await c.post(f"/api/demo/session/{ftok}/persona", headers=SAME,
                             json={"changes": {"tone": "warm"}})
            ck("the same write WITHOUT the CSRF header is refused (403)",
               r.status_code == 403, str(r.status_code))

            # ══ ③ THE LIVE-TENANT FENCE, AT THE ROUTE ════════════════════════════════════════════
            print("\n③ a live workspace cannot be driven from /demo (punch list P0#1)")
            async with db.get_pool().acquire() as con:
                await con.execute("update tenants set status='live' where slug=$1", slug)
                skus_before = await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1", slug)
            for path, method, payload in (
                (f"/api/demo/session/{ftok}/catalog", "POST", {"text": "chorizo 9,50", "name": "x"}),
                (f"/api/demo/session/{ftok}/catalog/whatever/commit", "POST", {}),
                (f"/api/demo/session/{ftok}/persona", "POST", {"changes": {"confirm": "never"}}),
                (f"/api/demo/session/{ftok}/board", "GET", None),
            ):
                r = (await c.get(path, headers=SAME) if method == "GET"
                     else await c.post(path, headers={**SAME, "x-sup-csrf": csrf}, json=payload))
                ck(f"LIVE tenant → {method} {path.split('/')[-1]} refused (409)",
                   r.status_code == 409, f"{r.status_code} {r.text[:80]}")
            r = await c.get("/api/demo/me")
            ck("…and /me itself refuses rather than minting a session onto a live world",
               r.status_code == 409, str(r.status_code))
            async with db.get_pool().acquire() as con:
                skus_after = await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1", slug)
                await con.execute("update tenants set status='test' where slug=$1", slug)
            ck("…and nothing in that company's catalogue moved", skus_before == skus_after,
               f"{skus_before} → {skus_after}")

            # ══ ④ CAPABILITY, AT THE ROUTE ═══════════════════════════════════════════════════════
            print("\n④ a driver reaches nothing")
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "update team_members set role='repartidor' "
                    "where tenant_slug=$1", slug)
                await con.execute("update sup_session set role='repartidor' "
                                  "where tenant_slug=$1 and revoked_at is null", slug)
            for path, method in ((f"/api/demo/session/{ftok}/board", "GET"),
                                 (f"/api/demo/session/{ftok}/persona", "POST"),
                                 ("/api/demo/me", "GET")):
                r = (await c.get(path, headers=SAME) if method == "GET"
                     else await c.post(path, headers={**SAME, "x-sup-csrf": csrf},
                                       json={"changes": {"tone": "formal"}}))
                ck(f"repartidor → {method} {path.split('/')[-1]} refused (403)",
                   r.status_code == 403, str(r.status_code))
            async with db.get_pool().acquire() as con:
                await con.execute("update team_members set role='owner' where tenant_slug=$1", slug)
                await con.execute("update sup_session set role='owner' "
                                  "where tenant_slug=$1 and revoked_at is null", slug)

        # ══ ② THE GOOGLE DOOR ════════════════════════════════════════════════════════════════════
        print("\n② the Google door, walked")
        WHO["u"] = {"email": GOOG, "identities": [{"provider": "google", "identity_data":
                                                   {"email": GOOG, "email_verified": True}}]}
        async with httpx.AsyncClient(transport=tr, base_url="https://app.soyrocoto.com") as g:
            r = await g.post("/api/sup/session/login", headers=SAME,
                             json={"access_token": "stub"})
            ck("the PANEL door refuses a stranger with no membership (403) — this is what the SPA "
               "used to send /demo's Google button to", r.status_code == 403, str(r.status_code))
            r = await g.post("/api/demo/auth/google", headers=SAME,
                             json={"access_token": "stub", "company": "Quesos Vital SL",
                                   "consent": {"marketing": False}})
            gb = r.json() if r.status_code == 200 else {}
            ck("the DEMO door MINTS the workspace instead (200) — §17.56c's whole point",
               r.status_code == 200 and gb.get("provisioned") is True,
               f"{r.status_code} {str(gb)[:100]}")
            ck("…named with the company carried across the OAuth bounce",
               gb.get("tenant_name") == "Quesos Vital SL", str(gb.get("tenant_name")))
            ck("…and the response is `_wire_session`-shaped, so the panel's AuthProvider takes it",
               all(k in gb for k in ("email", "tenant_slug", "role", "caps", "csrf",
                                     "expires_in_s")))
            ck("…with a sup_session cookie", bool(g.cookies.get(sup_api.SUP_COOKIE)))
            r = await g.get("/api/demo/me")
            ck("…and /me answers for it", r.status_code == 200
               and r.json().get("email") == GOOG, str(r.status_code))
            gslug = gb.get("tenant_slug")

            # ══ THE OTHER HALF OF THE SAME RULE: «SALIR» MUST STILL FORGET THE BROWSER ═══════════
            # Taking the clear out of the 401 path only holds if the one place that MEANS «forget
            # this browser» actually does it — otherwise the fix trades a session that dies for a
            # session that will not die. `sup_logout` did NOT clear: `_clear_cookie(response)` wrote
            # the header onto the INJECTED response and the handler then returned a brand-new
            # `Response(204)`, which FastAPI merges nothing into, so the delete went on the floor
            # every time. Asserted on the header, not just the jar, because the header is what the
            # browser obeys — and with the Secure/SameSite attrs, since a browser strict on the way
            # in is entitled to be strict on the way out.
            r = await g.post("/api/sup/session/logout",
                             headers={**SAME, "x-sup-csrf": gb.get("csrf") or ""})
            _sc = " ".join(r.headers.get_list("set-cookie"))
            ck("«Salir» answers 204 AND sends the delete on the response the client actually gets",
               r.status_code == 204 and "sup_session=" in _sc, f"{r.status_code} {_sc[:70]}")
            ck("…with the attrs that make a browser accept it (Secure · SameSite=Lax · Path=/)",
               all(x in _sc.lower() for x in ("secure", "samesite=lax", "path=/")), _sc[:90])
            ck("…the jar is empty afterwards", not g.cookies.get(sup_api.SUP_COOKIE))
            r = await g.get("/api/demo/me")
            ck("…and the door is shut behind them (401)", r.status_code == 401, str(r.status_code))

        # F1 at the ROUTE: the two workspaces are disjoint, whatever the local parts look like
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select o.email, o.id, tm.tenant_slug from team_members tm "
                "join operators o on o.id = tm.operator_id where o.email = any($1)",
                [MAIL, GOOG])
        by = {r["email"]: (r["id"], r["tenant_slug"]) for r in rows}
        ck("the two doors produced two DISTINCT operators and two DISTINCT workspaces",
           len(by) == 2 and by[MAIL][0] != by[GOOG][0] and by[MAIL][1] != by[GOOG][1], str(by))

        # ══ ⑤ THE ANONYMOUS DOOR IS GONE, AT THE ROUTE ═══════════════════════════════════════════
        print("\n⑤ the anonymous door")
        async with httpx.AsyncClient(transport=tr, base_url="https://app.soyrocoto.com") as a:
            r = await a.post("/api/demo/session", headers=SAME,
                             json={"email": "victima@target.es", "company": "X"})
            ck("POST /api/demo/session no longer exists (404/405), so no unauthenticated stranger "
               "can mint a tenant or mail a bearer token to anybody",
               r.status_code in (404, 405), str(r.status_code))
            before = len(sent)
            ck("…and no mail was sent by trying", len(sent) == before)
            r = await a.post(f"/api/demo/session/{ftok}/email", headers=SAME,
                             json={"email": "victima@target.es"})
            ck("POST /api/demo/session/{t}/email is gone too", r.status_code in (404, 405),
               str(r.status_code))
            r = await a.get(f"/api/demo/session/{ftok}/board", headers=SAME)
            ck("holding a real flow token WITHOUT the cookie reaches nothing (401)",
               r.status_code == 401, str(r.status_code))

    finally:
        _actions.send_email = real_send
        demo_auth.brain_auth.verify_token = real_verify
        sup_api.brain_auth.verify_token = real_login_verify
        async with db.get_pool().acquire() as con:
            for e_ in (MAIL, GOOG):
                await con.execute("update sup_session set revoked_at=now() where actor_email=$1", e_)
                await con.execute("delete from demo_sessions where lower(operator_email)=$1", e_)
                await con.execute("delete from demo_magic_links where lower(email)=$1", e_)
            gone = await con.fetch(
                "select tm.tenant_slug from team_members tm join operators o "
                "on o.id = tm.operator_id where o.email = any($1)", [MAIL, GOOG])
            await con.execute("delete from team_members tm using operators o "
                              "where o.id = tm.operator_id and o.email = any($1)", [MAIL, GOOG])
            await con.execute("delete from operators where email = any($1)", [MAIL, GOOG])
            for r_ in gone:
                await con.execute("delete from tenants where slug=$1", r_["tenant_slug"])

    print(f"\nvital_demo_doors: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
