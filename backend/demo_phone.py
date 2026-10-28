"""demo_phone.py — «Escanea para seguir en tu móvil» (SPEC §17.56 phone handoff, §17.20 extended).

The desk keeps the settings, the phone does the capture, and both are live. That sentence is the
whole feature: a supplier sitting at a laptop cannot photograph the handwritten note on his desk
with it, and asking him to email himself a picture is the moment the demo stops feeling like a
product. So the desk shows a QR, the phone opens the chat pane alone, and what the phone sends
appears on the desk without a refresh.

────────────────────────────────────────────────────────────────────────────────────────────────────
IT EXTENDS THE PROVEN CROSS-DEVICE HAND-OFF; IT DOES NOT REBUILD IT.

  · `brain/onboarding_ext.qr_svg` renders the SVG — the same segno call, the same graceful
    placeholder when segno is absent, that `GET /api/wizard/{token}/qr` has served since the
    onboarding wizard shipped (ONBOARDING.md §cross-device). There is one QR renderer on this box.
  · ONBOARDING.md's three rules survive intact: route by the real viewport (the SPA's job), the
    deep link lands the phone STRAIGHT on the capture surface (the wizard's `?up=1`, here the
    dedicated `/demo/phone/<token>` route), and there is always an «upload here» escape on both
    devices — which is why the desk keeps its own `voice`/`photo` routes rather than the phone
    becoming the only way in.
  · §17.20's `upload_session` is SPEC, not code (it exists in PRODUCT-SPEC.md and in no table on
    this box — grep it). So its ideas are honoured here rather than its schema imported: claim on
    first open, a 15-minute sliding TTL under a 2-hour hard cap, per-image states in one vocabulary
    on both screens, and idempotent retries keyed by a client id. The per-image states and the
    retries live in demo_media (that is where an image is); the claim and the two clocks live here.

────────────────────────────────────────────────────────────────────────────────────────────────────
THE CREDENTIAL — NARROWER THAN THE SESSION TOKEN, AND THAT IS THE ENTIRE DESIGN.

The demo session token opens a workspace: its catalogue, its persona knobs, its email, and (once
signed in) a real tenant. A QR is a thing you hold up in a room. Handing the session token to
whoever photographs a screen would make the QR the weakest credential in the product and the most
publicly displayed one at the same time. So the phone gets a DIFFERENT credential:

    <b64(sid|nonce|exp)>.<b64(hmac-sha256))>      — consent.unsubscribe_token's discipline, verbatim:
                                                     constant-time compare, one non-leaking answer for
                                                     every malformed / forged / expired shape, and a
                                                     key that falls back to the machine key so the
                                                     feature works on day one.

CAPABILITIES (`PHONE_CAPS`), and the list of what is deliberately absent is the more important half:
    can:    send text · send a voice note · send a photo · read this session's board, seeds and
            its own capture state.
    cannot: write persona settings · upload, patch or commit a CATALOGUE (the price list is the
            sensitive thing and it belongs to the desk) · set or read the email · touch consent ·
            reach anything tenant-admin · MINT ANOTHER PHONE LINK (no re-delegation: a phone cannot
            hand the session on to a third device).

Enforced structurally rather than by a flag: the phone's routes are their OWN family
(`/api/demo/phone/{t}/…`) and the resolver here is the only thing that answers a phone token. A
phone token presented to `/api/demo/session/{t}/…` fails at `demo_flow.resolve`, which looks up a
`demo_sessions` row by exact token and will never find one. The two credentials cannot be confused
because they are never read by the same function.

TWO CLOCKS, and each answers a failure the other cannot:
  · the HARD CAP rides INSIDE the signature (`exp`). A link photographed off a projector dies on its
    own two hours later even if every row in this database survives — no revocation needed.
  · the SLIDING WINDOW is a column (`expires_at`, extended by any phone activity). That is what lets
    an active phone keep working past 15 minutes, and — because re-minting rotates `nonce` — it is
    also the revocation a stateless HMAC alone cannot give you: the desk re-mints, the old link is
    dead the same instant.

es-ES is canonical on every visitor-facing string (LOCKED LAW). Code, comments, logs in English.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Any, AsyncIterator, Optional

import config
import db

log = logging.getLogger("rocoto.demo_phone")

# THE CAPABILITY SET. A frozenset rather than a list of `if`s so it can be ASSERTED by a test with no
# DB and no network — «the phone token's reduced capability set» is a claim, and a claim you cannot
# check in one line is a claim that rots.
PHONE_CAPS = frozenset({"view", "chat", "voice", "photo", "board", "seeds", "media"})
DESK_ONLY_CAPS = frozenset({"persona", "catalog", "email", "consent", "qr", "phone", "admin"})

# The ONE sentence for every dead phone link (portal.py's non-leaking law): unknown, tampered,
# expired, revoked and rotated must be indistinguishable, or a probe learns which codes once existed.
LINK_DEAD = "Este código ya no vale. Vuelve a la pantalla del ordenador y escanea el nuevo."
# A CLAIMED link is a different answer on purpose — it is only reachable with a VALID signature, so
# it leaks nothing to a prober, and §17.20 requires the second device to be told what happened.
LINK_CLAIMED = "Este código ya se usó en otro móvil. Pide uno nuevo en el ordenador."

# `vital_rls_coverage` discovers subjects by `column_name='scope'`; this table has none, by design —
# it is keyed by the /demo flow's `sid` and holds no scope-keyed runtime memory, so it is outside the
# RLS regime and needs no entry in schema_rls.sql. (A scope column here WOULD require one, in the
# same change. It has none, so it does not.)
#
# NOTE the nonce is stored in PLAINTEXT and that is not the §17.20 `secret_hash` being ignored: the
# secret in this design is the HMAC KEY, not the nonce. A database dump yields no working link,
# because a link needs a signature only the key can produce — which is the same reason
# consent.py stores nothing at all for its unsubscribe tokens.

_schema_ready = False


async def ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


# ══ ① THE SIGNATURE — consent.py's discipline, with a domain tag ══════════════════════════════════

# Domain separation. The key ladder below can land on the SAME machine key consent.py uses, and two
# HMACs over different payload grammars sharing a key is how a token from one feature gets replayed
# as a token for another. The tag makes that structurally impossible rather than unlikely.
_DOMAIN = b"rocoto/demo-phone/v1|"


def _signing_key() -> bytes:
    """`DEMO_PHONE_SIGNING_SECRET` when set, else the machine key every deployment already has — so
    the handoff works on day one without a new env var, and rotating to a dedicated secret
    invalidates ONLY outstanding phone links. Dev with no key at all gets a process-local one and a
    LOUD line: a silently unverifiable signature is worse than a dev-only warning."""
    raw = (config.DEMO_PHONE_SIGNING_SECRET or config.ROCOTO_API_KEY or "").strip()
    if not raw:
        log.warning("demo_phone: no DEMO_PHONE_SIGNING_SECRET / ROCOTO_API_KEY — phone links are "
                    "process-local and will not survive a restart")
        raw = f"dev-demo-phone-{time.time():.0f}"
    return hashlib.sha256(raw.encode()).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign(sid: str, nonce: str, exp: int) -> str:
    """`<b64(sid|nonce|exp)>.<b64(hmac)>` — path-safe, so it rides in the URL the QR encodes."""
    payload = f"{sid}|{nonce}|{int(exp)}".encode()
    sig = hmac.new(_signing_key(), _DOMAIN + payload, hashlib.sha256).digest()[:24]
    return f"{_b64(payload)}.{_b64(sig)}"


def unsign(token: str, *, now: Optional[float] = None) -> Optional[tuple[str, str, int]]:
    """token → (sid, nonce, exp), or None. PURE — no DB, no clock beyond `now` — so the round trip,
    the tamper and the expiry are all testable with nothing running.

    Every malformed, forged and expired shape answers the SAME None (consent.verify_unsubscribe's
    law): a caller cannot tell «I edited a byte» from «it timed out» from «that sid never existed»,
    which is what stops this being an oracle for which sessions are alive."""
    t = (token or "").strip()
    if not t or "." not in t or len(t) > 400:
        return None
    body, _, sig_s = t.partition(".")
    try:
        payload = _unb64(body)
        given = _unb64(sig_s)
    except Exception:
        return None
    want = hmac.new(_signing_key(), _DOMAIN + payload, hashlib.sha256).digest()[:24]
    if not hmac.compare_digest(want, given):
        return None
    try:
        sid, nonce, exp_s = payload.decode().split("|", 2)
        exp = int(exp_s)
    except Exception:
        return None
    if not sid or not nonce:
        return None
    if (now if now is not None else time.time()) >= exp:
        return None                      # the HARD cap, carried by the token itself
    return sid, nonce, exp


def has_cap(cap: str) -> bool:
    """Does a phone token authorise this? One place, one list, and `DESK_ONLY_CAPS` is written down
    beside it so «what can't it do» is answerable without reading every route."""
    return cap in PHONE_CAPS


# ══ ② MINT · CLAIM · VERIFY ═══════════════════════════════════════════════════════════════════════

def phone_url(token: str) -> str:
    """Where the QR points: the panel's own SPA, on the demo's route family (§17.56b — /demo lives
    IN the panel, so the phone meets the same app wearing tighter blinders, never a second bundle).
    English route names, matching /demo/catalog · /demo/settings · /demo/chat (§17.55o)."""
    base = (config.DEMO_PUBLIC_BASE_URL or "https://app.soyrocoto.com").rstrip("/")
    return f"{base}/demo/phone/{token}"


async def mint(sid: str, *, rotate: bool = False) -> dict[str, Any]:
    """The live link for this session — REUSED when one is healthy, re-minted when it is not.

    Re-minting on every render would be wrong twice over: it would kill a QR mid-scan, and it would
    hand a new nonce to a phone that had already claimed the old one. So a link inside its sliding
    window and more than a minute from expiry is returned as-is (the desk re-GETs freely to redraw),
    and a new one is cut when it has expired, been revoked, or when the caller explicitly rotates —
    which is §17.20's «the desk re-mints on expiry, so the new QR is already on screen», and is also
    the revoke.

    A NEW NONCE CLEARS THE CLAIM, deliberately: a fresh code must be scannable by the phone in the
    room, including the same phone that claimed the dead one."""
    await ensure_schema()
    now = time.time()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow("select * from demo_phone_link where sid=$1", sid)
        healthy = (row is not None and not row["revoked"]
                   and row["expires_at"] is not None
                   and row["expires_at"].timestamp() > now + 60
                   and row["hard_until"] is not None
                   and row["hard_until"].timestamp() > now + 60)
        if healthy and not rotate:
            tok = sign(sid, row["nonce"], int(row["hard_until"].timestamp()))
            return _link_view(row, tok, fresh=False)
        nonce = secrets.token_urlsafe(12)
        row = await con.fetchrow(
            "insert into demo_phone_link(sid,nonce,expires_at,hard_until) "
            "values($1,$2, now() + ($3 || ' seconds')::interval, "
            "                now() + ($4 || ' seconds')::interval) "
            "on conflict (sid) do update set nonce=excluded.nonce, created_at=now(), "
            "  expires_at=excluded.expires_at, hard_until=excluded.hard_until, "
            "  claim=null, claimed_at=null, phone_seen=null, revoked=false "
            "returning *",
            sid, nonce, str(int(config.DEMO_PHONE_TTL_S)),
            str(int(config.DEMO_PHONE_HARD_CAP_S)))
    log.info("demo_phone: link minted for sid=%s (hard cap %ss)", sid,
             int(config.DEMO_PHONE_HARD_CAP_S))
    # Sign the DB's OWN `hard_until`, never a Python-side `time.time() + cap`. The two clocks can
    # differ, and the failure of the naive version is silent: a signature that expires a few seconds
    # before (or after) the row it is supposed to agree with.
    return _link_view(row, sign(sid, nonce, int(row["hard_until"].timestamp())), fresh=True)


def _link_view(row: Any, token: str, *, fresh: bool) -> dict[str, Any]:
    return {"ok": True, "token": token, "url": phone_url(token), "fresh": fresh,
            "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
            "hard_until": row["hard_until"].isoformat() if row["hard_until"] else None,
            "claimed": bool(row["claim"]),
            "phone_seen": row["phone_seen"].isoformat() if row["phone_seen"] else None}


async def revoke(sid: str) -> dict[str, Any]:
    """«I put that QR on a projector.» One statement, and every outstanding link for this session is
    dead — because verification requires the stored nonce to match, and a revoked row matches
    nothing. The desk's next `mint` cuts a fresh one."""
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_phone_link set revoked=true, expires_at=now() where sid=$1",
                          sid)
    return {"ok": True, "revoked": True}


async def qr(sid: str, *, rotate: bool = False) -> tuple[str, dict[str, Any]]:
    """(svg, link) — the same renderer the onboarding wizard's QR uses, on the demo's link."""
    link = await mint(sid, rotate=rotate)
    from brain import onboarding_ext as _ob_ext
    return _ob_ext.qr_svg(link["url"]), link


async def claim_and_resolve(token: str, device: str) -> tuple[Optional[dict[str, Any]], str]:
    """(demo_sessions row, error_key) — THE phone gate, and the only thing that reads a phone token.

    Order matters, and each step answers a state §17.20 names:
      ① signature + hard cap        → LINK_DEAD (unknown ≡ forged ≡ timed out, one answer)
      ② the link row + its nonce    → LINK_DEAD (rotated or revoked is also «no longer valid»)
      ③ the sliding window          → LINK_DEAD
      ④ THE DEMO SESSION ITSELF     → LINK_DEAD. «The session expired while the phone was open» is
                                       a real state, and the phone must meet the desk's own answer,
                                       not a stale success that would let it send into a dead world.
      ⑤ the claim                   → 'claimed' when another device already has it. First open wins;
                                       a QR glowing on a screen in a shared office is not a door for
                                       whoever photographs it.
    On success the sliding window is extended and `phone_seen` stamped, which is what makes «any
    phone upload extends it» true rather than documented."""
    got = unsign(token)
    if got is None:
        return None, "dead"
    sid, nonce, _exp = got
    await ensure_schema()
    now = time.time()
    async with db.get_pool().acquire() as con:
        link = await con.fetchrow("select * from demo_phone_link where sid=$1", sid)
        if link is None or link["revoked"] or not hmac.compare_digest(link["nonce"] or "", nonce):
            return None, "dead"
        if link["expires_at"] is None or link["expires_at"].timestamp() <= now:
            return None, "dead"
        dev = (device or "")[:120]
        held = (link["claim"] or "")
        # ONCE A DEVICE HAS CLAIMED, a request that presents no device id is refused too — otherwise
        # the fence is bypassed by simply dropping the cookie. A client that NEVER sends one still
        # works end to end (it never claims, so `held` stays empty), which is the deliberate
        # fail-open for a browser with cookies blocked: the claim is a courtesy fence in a shared
        # room, and the real credential is the signature + the two clocks + revoke.
        if held and held != dev:
            return None, "claimed"
        if not held and dev:
            # first open wins — an UPDATE with the emptiness in its WHERE, so two phones opening the
            # same code at the same instant cannot both believe they claimed it.
            won = await con.fetchval(
                "update demo_phone_link set claim=$2, claimed_at=now() "
                "where sid=$1 and (claim is null or claim='') returning claim", sid, dev)
            if won is None:
                again = await con.fetchval("select claim from demo_phone_link where sid=$1", sid)
                if (again or "") != dev:
                    return None, "claimed"
        await con.execute(
            "update demo_phone_link set phone_seen=now(), "
            "expires_at = least(now() + ($2 || ' seconds')::interval, hard_until) where sid=$1",
            sid, str(int(config.DEMO_PHONE_TTL_S)))
        srow = await con.fetchrow(
            "select * from demo_sessions where sid=$1 "
            "and (expires_at is null or expires_at > now())", sid)
    if srow is None:
        return None, "dead"                       # ④ the session died under the open phone
    return dict(srow), ""


async def phone_view(row: dict[str, Any]) -> dict[str, Any]:
    """Everything the phone pane needs, composed HERE so the route stays a shape.

    `company` is §17.56d③'s field doing its second job: the name at the top of the customer view is
    the contact a real customer sees, and «Demo — tus productos» is the placeholder that section
    explicitly forbids showing a prospect — so an anonymous session returns '' and the SPA falls
    back to its own copy rather than putting our placeholder in their customer's WhatsApp."""
    import demo_flow
    import demo_media
    view = await demo_flow.session_view(row["token"]) or {}
    company = ""
    try:
        async with db.get_pool().acquire() as con:
            company = await con.fetchval("select name from tenants where slug=$1",
                                         demo_flow.tenant_of_row(row)) or ""
    except Exception:
        log.debug("demo_phone: tenant name read fail-soft", exc_info=True)
    if company.strip() == "Demo — tus productos":
        company = ""
    return {"ok": True, "company": company,
            "catalog_ready": bool(view.get("catalog_ready")),
            "turns_left": int(view.get("turns_left") or 0),
            "closed": bool(view.get("closed")),
            "caps": sorted(PHONE_CAPS),
            "handoff": await link_state(row["sid"]),
            "media": (await demo_media.state(row["sid"]))["media"]}


# ══ ③ PRESENCE — «is the computer watching?», answered honestly ═══════════════════════════════════

_desk_stamped: dict[str, float] = {}


async def desk_seen(sid: str) -> None:
    """The desk's SSE loop stamps this. Throttled in-proc to one write per 15 s so a live channel
    does not become a write every two seconds for the whole time a tab is open."""
    now = time.time()
    if now - _desk_stamped.get(sid, 0.0) < 15:
        return
    _desk_stamped[sid] = now
    if len(_desk_stamped) > 5000:                 # bound memory, try_chat._HITS' housekeeping
        for k in list(_desk_stamped)[:1000]:
            _desk_stamped.pop(k, None)
    try:
        await ensure_schema()
        async with db.get_pool().acquire() as con:
            await con.execute("update demo_phone_link set desk_seen=now() where sid=$1", sid)
    except Exception:
        log.debug("demo_phone desk_seen fail-soft", exc_info=True)


async def link_state(sid: str) -> dict[str, Any]:
    """The handoff, as both screens need to see it — and the es-ES sentence for each state, because
    §17.20's whole point is that every death gets an honest line rather than a spinner.

    `desk_watching` is what flips the phone's header between «Tu ordenador lo está viendo» and «El
    ordenador no está mirando — lo que mandes se guarda igual». Presence shown honestly, loss never
    implied: the second sentence promises the uploads still land, because they do."""
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow("select * from demo_phone_link where sid=$1", sid)
    if row is None or row["revoked"]:
        return {"ok": True, "linked": False, "claimed": False, "desk_watching": False,
                "sentence": "Escanea para seguir en tu móvil."}
    now = time.time()
    alive = row["expires_at"] is not None and row["expires_at"].timestamp() > now
    watching = (row["desk_seen"] is not None
                and now - row["desk_seen"].timestamp() < config.DEMO_DESK_PRESENCE_S)
    if not alive:
        sentence = "Ese código ya caducó. Vuelve a la pantalla del ordenador y escanea el nuevo."
    elif not row["claim"]:
        sentence = "Escanea el código con tu móvil — la cámara y el micro los pone él."
    elif watching:
        sentence = "Tu ordenador lo está viendo."
    else:
        sentence = "El ordenador no está mirando — lo que mandes se guarda igual."
    return {"ok": True, "linked": alive, "claimed": bool(row["claim"]),
            "desk_watching": watching, "sentence": sentence,
            "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
            "hard_until": row["hard_until"].isoformat() if row["hard_until"] else None,
            "phone_seen": row["phone_seen"].isoformat() if row["phone_seen"] else None}


# ══ ④ THE LIVE CHANNEL — §17.39's rail, with one extra cursor ═════════════════════════════════════

def _frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def desk_stream(sid: str, tenant: str, since: int = 0) -> AsyncIterator[str]:
    """ONE SSE connection per demo desk: the spine head, ticks with coarse shelf hints, heartbeats —
    plus one `media` hint when this session's capture state moves.

    THIS IS §17.39's RAIL, NOT A SECOND ONE. The semantics come from `sync.head` and
    `sync.shelves_since` — the panel's own primitives, so a demo desk and a tenant desk agree about
    what «the head» is and which shelf a write touched, and a change to the shelf map reaches both.
    What is composed on top is a single extra cursor: `demo_media.cursor(sid)`, watched in the same
    loop, because the spine only moves when a TURN lands and the desk wants the shimmer the moment
    the phone's bytes arrive — the ~10 s of transcription in between is exactly the dead time the
    presence feeling lives or dies in.

    §17.20's law is kept: THESE FRAMES ARE HINTS. The truth is `GET …/media` (demo_media.state) and
    `GET …/board`, which the desk re-renders from on any poke, on reconnect and on tab refocus — so
    a buffering proxy costs latency, never correctness, and a client that never receives a frame can
    still fall back to polling the same state doc.

    ⚠️ BUILD-CONCERNS #10: an open SSE connection means Playwright's `networkidle` NEVER fires.
    Anything that drives /demo in a browser waits on `domcontentloaded` + an explicit settle."""
    import sync
    last_seq = int(since or 0)
    last_media = await _media_cursor(sid)
    head = await sync.head(tenant)
    await desk_seen(sid)
    yield _frame("head", {"seq": head, "shelves": list(sync.SHELVES),
                          "media_cursor": last_media})
    last_seq = head
    idle = 0.0
    try:
        while True:
            await asyncio.sleep(sync.POLL_S)
            idle += sync.POLL_S
            await desk_seen(sid)
            cur = await sync.head(tenant)
            moved = False
            if cur > last_seq:
                yield _frame("tick", {"seq": cur,
                                      "shelves": await sync.shelves_since(tenant, last_seq)})
                last_seq = cur
                moved = True
            mc = await _media_cursor(sid)
            if mc != last_media:
                # the hint the spine cannot give: bytes have landed / a read finished / one failed.
                yield _frame("media", {"cursor": mc})
                last_media = mc
                moved = True
            if moved:
                idle = 0.0
            elif idle >= sync.HEARTBEAT_S:
                # a beat keeps proxies from closing the stream AND lets the client tell «nothing
                # happened» apart from «the connection died» — different states, different UI.
                yield _frame("beat", {"seq": last_seq})
                idle = 0.0
    except asyncio.CancelledError:
        raise
    except Exception:
        log.debug("demo_phone desk stream ended for sid=%s", sid, exc_info=True)


async def _media_cursor(sid: str) -> str:
    try:
        import demo_media
        return await demo_media.cursor(sid)
    except Exception:
        return ""
