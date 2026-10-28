"""demo_auth.py — /demo SIGNS IN FOR REAL, AND THE ACCOUNT IS A REAL TENANT (SPEC §17.56c).

Peter's reason, and it inverts the usual read of a sign-in wall: «better authed so they feel secure
… we tell them sign in so your data is secure». The next thing /demo asks for is their entire price
list — every product, every price, the most commercially sensitive file a distributor owns. Asking
them to drop that into an anonymous browser session is the LESS secure offer, and a competitor's rep
could otherwise open the same link. So the sign-in is protection, not a gate, and this module is
what makes that sentence true rather than marketing.

WHAT THIS IS BUILT FROM — and it is emphatically NOT a second auth system:

  · THE SESSION IS THE PANEL'S OWN. `sup_session.mint` → the same `sup_session` cookie, the same
    rotating-secret / prev-secret-grace / idle+absolute expiry / double-submit-CSRF machinery, the
    same `require_sup` gate, the same 401-that-deletes-the-cookie. A visitor who signs in at /demo
    is signed into app.soyrocoto.com, because /demo IS the panel wearing blinders (§17.56b). A
    parallel token would have been a second thing to expire, a second thing to revoke, and a second
    place for a session bug to live.

  · THE WORKSPACE IS THE ALTA'S. `provisioning.resume_or_provision` — the block lifted out of
    `sup_api.sup_alta`, now with two callers and one behaviour. Sign-in mints an operator seat, a
    `team_members` owner row and a tenant `status='test'`; a RETURNING operator resumes the tenant
    they already have. One operator, one workspace, forever: never a second tenant, never a demo
    tenant layered over a live one. Going live later is adding a phone number, not migrating a
    workspace (§17.17 arriving where it always pointed).

  · `ROCOTO_SELF_SERVE` STAYS OFF, AND IS NOT CONSULTED HERE. It gates the public signup CTA
    (`sup_alta`'s 403) — a separate decision that remains Peter's. Provisioning and that flag are
    coupled only through `sup_alta`'s own refusal, never through the provisioner, which is exactly
    why the demo can mint test tenants without flipping it.

  · TWO DOORS, BOTH REAL. **Google** rides the panel's existing rail — `brain_auth.verify_token`
    (server-side verification against the Supabase Auth API) + `has_matching_oauth` (the elevation
    gate: a password signup of somebody's address never elevates, the linkIdentity forgery never
    elevates), byte-identical to `sup_api.sup_login`. **The magic link** is this module's own,
    because Supabase's OTP cannot mint a supplier session: it produces a non-OAuth identity that
    `has_matching_oauth` correctly refuses, and loosening that gate to let it through would open the
    door it exists to hold shut. So the email door proves mailbox control HERE, and then hands the
    result to the SAME minting call.

  · THE MAGIC LINK IS AN IDENTITY NOW, NOT A BOOKMARK. demo_flow's link was a resume handle — hold
    the token, get the session. That is fine for an anonymous scratch world and wrong the moment a
    real tenant is behind it. So: `secrets.token_urlsafe(32)`, only its sha256 stored, 15-minute
    TTL, constant-time compare, SINGLE USE enforced by the atomic consuming UPDATE (not by a
    read-then-write anybody can race), issuance rate-limited per email AND per IP, and portal.py's
    non-leaking law throughout — unknown, expired and already-consumed are ONE answer, and issuance
    answers 200 whether or not the address exists.

  · AND IT IS BOUND TO THE BROWSER THAT ASKED FOR IT (2026-08-09 security remediation, F3). Holding
    the token was, until now, the whole of the proof — so a cross-site form could log a VICTIM into
    the ATTACKER's workspace, and anyone who merely saw the URL in transit owned the account for
    fifteen minutes. A `__Host-` nonce cookie is set at issuance and matched inside the consuming
    UPDATE, with `Sec-Fetch-Site`/`Origin` as the second wall. `magic_verify_post` carries the full
    reasoning, including what this costs (the link no longer opens on a different device).

  · THERE IS NO ANONYMOUS STRETCH LEFT. Peter, 2026-08-09: «should be authed the whole thing yes».
    `POST /api/demo/session` and the resume mail it sent are deleted (see demo_flow.py); every
    /api/demo route that reads or writes session state now requires the `sup_session` cookie AND the
    capability the panel's equivalent asks for AND a tenant in `status='test'`. The two exceptions
    are `GET /config` (the consent wording, which must be readable BEFORE anyone signs in) and the
    login-free unsubscribe, which is withdrawal-only by construction.

  · THE LIVE-TENANT FENCE. If the address already owns a tenant that is NOT `status='test'`, the
    magic door refuses and points at Google. Mailbox control is a strong proof, but §5.11.3's law is
    that only a matching Google identity opens a real company, and quietly making /demo the one
    place that law does not hold would be a privilege escalation nobody reviewed. A live operator
    who wants in signs in with Google and gets THEIR workspace — never a demo tenant, never a
    second one.

  · CONSENT IS ASKED AT THE DOOR AND STORED AS EVIDENCE (consent.py), and it gates NOTHING here:
    every route below behaves identically whether the box was ticked or not. That is §17.56c's
    «not a condition of the demo», enforced by there being no branch on it in any code path.

  · AND SINCE 2026-08-28, THE MINT IS CLOSED AND THE RESUME IS NOT (§21/§22,
    WEBSITE-COMMERCIAL-MODEL.md in Rocoto-Labs/company). Peter: «the /entrar demo-mint door CLOSES (existing
    accounts resume; unknown emails get the closed message, behind a reopenable config switch)».
    /demo's own screen had already sunset for anonymous visitors, but the sign-in BEHIND it kept
    minting a real tenant for any address it had never seen — through /entrar, through both doors,
    for anybody who found the URL. `sign_in`'s fence ① is that closure — and `issue_magic` mails
    the closure rather than a link it could no longer honour, without moving the response by a
    byte. An address that already owns a workspace resumes byte-identically to the day before,
    which is the whole of «keep it live for Carlos», and `config.DEMO_PROVISION_OPEN` reopens the
    mint for a fair or a campaign without a code change.

Routes are thin HTTP shapes; the flow state stays in demo_flow, the evidence in consent, the
workspace in provisioning. es-ES on every visitor-facing sentence (LOCKED LAW).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

import config
import consent as consent_mod
import db
import demo_flow
import provisioning
import sup_api
import sup_session
from brain import auth as brain_auth
from sup_api import SupApiError, _client_ip, _set_cookie

log = logging.getLogger("rocoto.demo_auth")

def _flag_gate() -> None:
    """EVERY route on this router honours DEMO_FLOW_ENABLED — as a router-level dependency, so a
    route added later cannot forget it.

    It could, before. `app.py`'s demo routes each call `_demo_gate()`, but this router carried the
    flag only in the /config RESPONSE — so with the demo switched OFF, `/auth/magic`, `/auth/verify`
    and `/auth/google` still ran, and those are the doors that PROVISION (a tenant, an operator seat,
    an owner membership). Turning the feature off did not turn off the part that writes. Found while
    mitigating the 2026-08-08 review: the kill switch has to reach the whole surface or it is not a
    kill switch."""
    if not config.DEMO_FLOW_ENABLED:
        raise HTTPException(503, "La prueba no está disponible ahora mismo.")


router = APIRouter(prefix="/api/demo", dependencies=[Depends(_flag_gate)])

# ── policy knobs ─────────────────────────────────────────────────────────────────────────────────
MAGIC_TTL_S = 15 * 60          # §17.56c: short. A link you asked for 15 minutes ago is a link you forgot.
MAGIC_PER_EMAIL = 3            # issuances per address per window — enough for «it didn't arrive», not a mail cannon
MAGIC_EMAIL_WINDOW_S = 900
# THE PER-IP BUCKET IS COARSER THAN IT LOOKS, and 30 rather than 10 says so honestly. The /demo SPA
# reaches this backend through Vercel's `/api/:path*` rewrite, so the address `_client_ip` sees for
# every SPA visitor is a VERCEL EDGE they all share (measured 2026-08-09 — see sup_api._client_ip).
# At 10/hour one busy afternoon behind one edge silently locks out every genuine visitor behind it,
# and the throttle branch below is deliberately indistinguishable from «sent». The walls that
# actually hold here are the per-ADDRESS bucket (unspoofable, and the thing a mail cannon must
# defeat) and the absolute global ceiling; this one is a blunt volume guard for direct callers.
MAGIC_PER_IP = 30
MAGIC_IP_WINDOW_S = 3600
MAGIC_GLOBAL = 200             # absolute ceiling per hour: a spoofed-IP flood still hits a wall

# ── the requester binding (2026-08-09 review, F3) ────────────────────────────────────────────────
# A `__Host-`-prefixed nonce cookie, set when the link is REQUESTED and required when it is
# CONSUMED. The prefix is not decoration: it is enforced by the browser, and it means the cookie
# can only have been set by a Secure, host-only, path-/ response from this exact origin — no
# subdomain, no sibling site, nothing a network attacker can plant.
MAGIC_NONCE_COOKIE = "__Host-rk_magic"
MAGIC_NONCE_FALLBACK = "rk_magic"      # a plain http dev box cannot carry a __Host- cookie
MAGIC_NONCE_TTL_S = MAGIC_TTL_S + 300  # outlive the link itself, never by much

# The origins a consume may be POSTed from. The SPA reaches this backend same-origin through the
# panel's Vercel rewrite; `api.soyrocoto.com` is listed because the backend is also directly
# reachable there and a future client may call it without the proxy.
MAGIC_ORIGINS = frozenset(
    x.strip().rstrip("/").lower()
    for x in (config._env("ROCOTO_DEMO_ORIGINS",
                          "https://app.soyrocoto.com,https://api.soyrocoto.com") or "").split(",")
    if x.strip())


_schema_ready = False


async def ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def _hash(token: str) -> str:
    """sha256 hex. Only the HASH is stored — the token in the mailbox is a bearer, and a database
    dump must not be a pile of working sign-in links (sup_session's law, same reason)."""
    return hashlib.sha256((token or "").encode()).hexdigest()


# ── the ONE sentence for every dead token (portal.py's non-leaking law) ──────────────────────────
_LINK_DEAD = ("Este enlace ya no vale — se usa una sola vez y caduca a los 15 minutos. "
              "Pide uno nuevo y te entro enseguida.")
# The one refusal we DO distinguish, because it is not about the token and leaks nothing about any
# address: this browser never asked for a link. Telling somebody «pide uno nuevo» when the real
# problem is «you opened it on your phone» sends them round the same loop forever.
_LINK_WRONG_BROWSER = ("Este enlace solo abre en el navegador desde el que lo pediste — es lo que "
                       "impide que lo use nadie más. Pídelo otra vez aquí y entras en un segundo.")
_MAGIC_SENT = ("Si ese correo es válido, te acabo de mandar un enlace para entrar. "
               "Caduca en 15 minutos.")

# ── §21/§22 · THE SENTENCE FOR AN ADDRESS WITH NO WORKSPACE ──────────────────────────────────────
# PETER'S OWN LINE, SHIPPED AS HE WROTE IT (2026-08-28). It is a status followed immediately by
# what the trial IS now, which is the same shape DemoLayout's closed screen already paints on
# /demo: one closure, one wording, wherever a stranger meets it. The English is a mirror, for the
# lang the magic link carried.
_DEMO_CLOSED = {
    "es": ("La demo abierta se ha cerrado. Rocoto se prueba ahora con tu negocio: "
           "pide tu precio en soyrocoto.com."),
    "en": ("The open demo has closed. Now you try Rocoto on your own business: "
           "ask for your price at soyrocoto.com."),
}


def closed_sentence(lang: str = "es") -> str:
    return _DEMO_CLOSED["en" if str(lang).lower().startswith("en") else "es"]


# ═══ ISSUE ════════════════════════════════════════════════════════════════════════════════════════

async def issue_magic(email: str, *, ip: str, ua: str, marketing: bool,
                      text_version: str = "", text_shown: str = "", lang: str = "es",
                      company: str = "", nonce: str = "") -> dict[str, Any]:
    """Mint + mail a sign-in link. ALWAYS reports success to the caller.

    The consent answer AND the company name ride the LINK ROW rather than being applied now, and
    that is the honest ordering: a box ticked (and a company typed) by whoever put an address into a
    form is not yet evidence that the OWNER of that address did it — the mailbox click is what turns
    a claim into a fact. Both are held here and written at verify time, with the verify request's
    own IP and user-agent, which is what actually gets evidenced. It also means an unclicked link
    can never rename anybody's workspace.

    `nonce` is the REQUESTER BINDING (F3) — see `magic_verify_post`. Only its sha256 lands here."""
    e = demo_flow._clean_email(email)
    if not e:
        return {"ok": False, "error": "bad_email"}
    # RATE LIMITS BEFORE ANY WORK, CHEAPEST-KEYED FIRST. The order is the fix for F10 and it is not
    # cosmetic: `rate_ok` ALLOCATES the bucket it checks, so evaluating the attacker-chosen
    # `…:email:{e}` key first meant every distinct address in a flood permanently allocated a dict
    # entry + a deque in a process that never reclaims them — unbounded heap, from throttled
    # requests that sent no mail. Global and IP are OUR keys, bounded in number, and they now
    # short-circuit before an attacker's string can name a new bucket.
    if not sup_session.rate_ok("demomagic:GLOBAL", MAGIC_GLOBAL, MAGIC_IP_WINDOW_S):
        log.warning("demo magic: GLOBAL issuance ceiling saturated — genuine visitors are being "
                    "silently throttled (last ip=%s)", ip)
        return {"ok": True, "sent": False, "throttled": True}
    if not sup_session.rate_ok(f"demomagic:ip:{ip}", MAGIC_PER_IP, MAGIC_IP_WINDOW_S) or \
       not sup_session.rate_ok(f"demomagic:email:{e}", MAGIC_PER_EMAIL, MAGIC_EMAIL_WINDOW_S):
        # Throttled is NOT reported as throttled: «too many» for one address and «sent» for another
        # is a working oracle for which addresses are being tried. The caller says the same sentence.
        log.info("demo magic link throttled for %s / %s", e, ip)
        return {"ok": True, "sent": False, "throttled": True}
    # ── §21 · THE DOOR IS CLOSED, SO THE LINK WOULD BE A PROMISE WE CANNOT KEEP ──────────────────
    # An address that owns no workspace now meets `sign_in`'s refusal, and a link is the worst way
    # to deliver it: the mail's subject says «Ya puedes entrar en Rocoto» — false for that reader —
    # and the screen it opens fifteen minutes later offers «pedir otro enlace», which is a loop
    # rather than an answer. So the token is not minted and the mail says the one true thing
    # instead, with the door out on it.
    #
    # THE RESPONSE DOES NOT MOVE, and that is the care this needs. This endpoint has always
    # answered the same sentence for every outcome, because one that distinguishes them is an
    # account-enumeration oracle anybody can run from a browser (portal.py's non-leaking law).
    # WHICH mail arrives is visible only to whoever holds the mailbox — which is its owner. The
    # rate limits above already ran, so this path costs a flood exactly what the other one does.
    if not config.DEMO_PROVISION_OPEN:
        async with db.get_pool().acquire() as con:
            known = await provisioning.membership_of(con, e)
        if not known:
            log.info("demo magic: the open mint is closed — sending the closed note instead")
            return {"ok": True, "sent": bool(await _send_closed(e, lang)), "closed": True}

    token = secrets.token_urlsafe(32)
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into demo_magic_links(token_hash, email, ip, user_agent, consent, "
            "  text_version, lang, company, nonce_hash, expires_at) "
            "values($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' seconds')::interval)",
            _hash(token), e, (ip or "")[:80], (ua or "")[:400],
            {"marketing": bool(marketing), "text_shown": (text_shown or "")[:4000]},
            (text_version or consent_mod.CONSENT_TEXT_VERSION)[:40],
            "en" if str(lang).lower().startswith("en") else "es",
            provisioning.clean_company(company),
            _hash(nonce) if nonce else None, str(MAGIC_TTL_S))
    sent = await _send_magic(e, token, lang)
    return {"ok": True, "sent": bool(sent)}


def _magic_url(token: str) -> str:
    """The link goes STRAIGHT to the screen that consumes it: `app.soyrocoto.com/demo/entrar?t=…`.

    IT USED TO GO TO THE API FIRST, and the API's job on that hop was to answer 302 to exactly this
    URL — a round trip whose entire output was this string. It cost two things worth naming. One,
    `config.PUBLIC_BASE_URL` on this deployment is `https://5-161-178-146-rocoto.sslip.io`, so the
    most-read link Rocoto sends anybody, and the raw URL printed under the button for images-off
    readers, was a bare IP address wearing a wildcard-DNS hat. That is not a link a distributor
    pastes into a browser. Two, every redirect is a place a corporate mail gateway can decide to
    stop, rewrite or unwrap.

    NOTHING ABOUT THE SECURITY MODEL MOVES. The GET was never the act — `magic_verify_get` has
    always been a redirect precisely so a mail scanner's prefetch could not burn the token, and the
    consume has always been the POST that `/demo/entrar` fires. This removes the hop, not the rule.
    `magic_verify_get` STAYS mounted for links already sitting in inboxes, and keeps working."""
    base = (config.DEMO_PUBLIC_BASE_URL or "https://app.soyrocoto.com").rstrip("/")
    return f"{base}/demo/entrar?t={quote(token)}"


# ── what the mail says, in both languages (§17.56c; the wording pass of 2026-08-09) ──────────────
#
# THE SUBJECT IS AN ARRIVAL, NOT AN ERRAND. «Tu enlace para entrar en Rocoto» is a filing label: it
# describes the attachment rather than the moment. The door is open — say that.
#
# AND THE BODY LOST ITS NEGATIVE. It ended «Si no lo has pedido tú, ignóralo», which is a whole
# sentence spent on the one reader who did NOT ask for it, planted in front of the many who did.
# (Peter's law, 2026-08-09: «NEVER GIVE NEGATIVES. THEY WASTE SPACE TALKING ABOUT STUFF WE DONT
# WANNA FOCUS ON».) What replaces it is the fact that is actually useful to the person holding the
# link, said as a positive: it opens in the browser you asked from. That is the F3 requester binding
# described as a property rather than as a refusal, and it is the single sentence that stops the
# «why does my link not work on my phone» loop before it starts.
#
# The em dash went with it. «tu espacio en Rocoto — tu catálogo y tus ajustes» is strapline
# punctuation; a colon introduces a list, which is what that actually was.
_MAGIC_MAIL = {
    "es": {
        "subject": "Ya puedes entrar en Rocoto",
        "pre": "Tu enlace está listo. Vale 15 minutos.",
        "h1": "Ya puedes entrar",
        "body": ("<p style=\"margin:0 0 12px\">Este botón te abre tu espacio en Rocoto: tu catálogo "
                 "y tus ajustes, guardados en tu cuenta.</p>"
                 "<p style=\"margin:0\">Se usa una vez y vale 15 minutos. Se abre en el navegador "
                 "desde el que lo pediste.</p>"),
        "cta": "Entrar en Rocoto",
    },
    "en": {
        "subject": "You can come in to Rocoto now",
        "pre": "Your link is ready. It lasts 15 minutes.",
        "h1": "You can come in",
        "body": ("<p style=\"margin:0 0 12px\">This button opens your space in Rocoto: your "
                 "catalogue and your settings, kept in your account.</p>"
                 "<p style=\"margin:0\">It works once, and it lasts 15 minutes. It opens in the "
                 "browser you asked from.</p>"),
        "cta": "Come in to Rocoto",
    },
}


async def _send_magic(email: str, token: str, lang: str = "es") -> bool:
    """TRANSACTIONAL MAIL — it does NOT consult consent, and must not (§17.56c: the magic link and
    «tu catálogo está listo» are the performance of a request the person just made; gating them on a
    marketing checkbox would break the product for everyone who ticked nothing). It therefore also
    carries NO List-Unsubscribe headers: offering to unsubscribe from your own sign-in link is a
    false promise, and mailbox providers read the header as a marketing declaration.

    `lang` FINALLY REACHES THE WORDS. It has been carried on the link row since the door was built —
    `issue_magic` stores it, this function has always taken it — and then every string here was
    Spanish regardless, so an English visitor filled in an English form and got a Spanish mailbox.
    One dict, both languages, chosen where the language is already known."""
    link = _magic_url(token)
    m = _MAGIC_MAIL["en" if str(lang).lower().startswith("en") else "es"]
    try:
        import actions
        try:
            import app as _app  # lazy: app imports this module's router
            html = _app._email_shell(m["h1"], m["body"], m["cta"], link,
                                     lang=lang, preheader=m["pre"])
        except Exception:
            html = f'<p><a href="{link}">{m["cta"]}</a></p><p>{link}</p>'
        return bool(await actions.send_email(email, m["subject"], html))
    except Exception:
        log.exception("demo magic link send failed (fail-soft)")
        return False


# ── §21 · WHAT ARRIVES INSTEAD OF A LINK ─────────────────────────────────────────────────────────
# PETER'S SENTENCE, SPLIT WHERE IT ALREADY BREAKS, AND NOTHING ADDED. The closure is the heading —
# the one closure line §21 allows — and the half that says what the trial IS now sits under it at
# full size, which is the same shape DemoLayout's `DemoClosed` screen already paints. The button and
# its destination are lifted from that screen rather than invented, so a person who meets the
# closure in their inbox and a person who meets it on /demo are told the same thing by the same
# words. Nothing here catalogues what was lost, apologises, or explains the commercial reasoning.
_PLANS_URL = "https://soyrocoto.com/precios.html"
_CLOSED_MAIL = {
    "es": {
        "subject": "La demo abierta se ha cerrado",
        "pre": "Rocoto se prueba ahora con tu negocio.",
        "h1": "La demo abierta se ha cerrado",
        "body": ("<p style=\"margin:0\">Rocoto se prueba ahora con tu negocio: pide tu precio en "
                 "soyrocoto.com.</p>"),
        "cta": "Ver cómo funciona",
    },
    "en": {
        "subject": "The open demo has closed",
        "pre": "Now you try Rocoto on your own business.",
        "h1": "The open demo has closed",
        "body": ("<p style=\"margin:0\">Now you try Rocoto on your own business: ask for your "
                 "price at soyrocoto.com.</p>"),
        "cta": "See how it works",
    },
}


async def _send_closed(email: str, lang: str = "es") -> bool:
    """The closed note. TRANSACTIONAL, like the link it stands in for: it is the answer to a request
    the person made thirty seconds ago, so it consults no consent and carries no unsubscribe header
    — the same reasoning `_send_magic` states, and the same shell, so it arrives from the same
    company. Fail-soft: a mail problem must never become an HTTP failure on a door whose whole law
    is that it answers identically to everybody."""
    m = _CLOSED_MAIL["en" if str(lang).lower().startswith("en") else "es"]
    try:
        import actions
        try:
            import app as _app  # lazy: app imports this module's router
            html = _app._email_shell(m["h1"], m["body"], m["cta"], _PLANS_URL,
                                     lang=lang, preheader=m["pre"])
        except Exception:
            html = f'<p>{m["body"]}</p><p><a href="{_PLANS_URL}">{m["cta"]}</a></p>'
        return bool(await actions.send_email(email, m["subject"], html))
    except Exception:
        log.exception("demo closed note send failed (fail-soft)")
        return False


# ═══ CONSUME ══════════════════════════════════════════════════════════════════════════════════════

async def consume_magic(token: str, nonce: str = "") -> Optional[dict[str, Any]]:
    """token (+ the requester nonce) → the link row, consumed. None for unknown / expired /
    already-used / WRONG-REQUESTER alike.

    SINGLE USE IS THE UPDATE, not a check followed by a write: the conditional `consumed_at is null`
    inside one statement means two concurrent clicks (the mail client's prefetch and the human's
    thumb) cannot both win — exactly one gets a row back. A read-then-write would hand a working
    session to both.

    THE NONCE IS IN THE `WHERE`, NOT IN AN `IF` AFTER IT (2026-08-09 review, F3). A mismatched nonce
    must not CONSUME the link: if it did, a cross-site form could burn a victim's pending sign-in
    even though it could not use it — denial of service instead of takeover, which is still the
    attacker choosing what happens. So the row is only claimed when the nonce matches, and every
    other outcome is the same None.

    Rows minted before this column existed carry `nonce_hash IS NULL`. They are accepted for their
    remaining 15 minutes (`$2 is null` on both sides) rather than dead-lettered — the alternative is
    every link in flight at deploy time silently failing, and the window closes by itself.

    The constant-time compare is `hmac.compare_digest` over the sha256, and the lookup is BY that
    hash: there is no branch on the token's content before the compare, so there is no timing signal
    distinguishing «no such token» from «wrong token»."""
    t = (token or "").strip()
    if not t or len(t) > 200:
        return None
    th = _hash(t)
    nh = _hash(nonce) if (nonce or "").strip() else None
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "update demo_magic_links set consumed_at = now() "
            "where token_hash = $1 and consumed_at is null and expires_at > now() "
            "  and (nonce_hash is null or nonce_hash = $2) "
            "returning token_hash, email, consent, text_version, lang, company, nonce_hash", th, nh)
    if row is None:
        return None
    # Belt to the suspender: the WHERE above already matched by hash, so this can only fail if the
    # row we got back is not the row we asked for. Constant-time anyway — it costs nothing and it
    # keeps the comparison in the file where a reader looks for it.
    if not hmac.compare_digest(row["token_hash"], th):
        return None
    if row["nonce_hash"] and not hmac.compare_digest(row["nonce_hash"], nh or ""):
        return None
    return dict(row)


# ═══ SIGN IN (both doors end here) ════════════════════════════════════════════════════════════════

def _secure() -> bool:
    """https deployments only — a __Host- cookie is invalid without Secure, and a local http box
    must still be drivable."""
    return str(config.DEMO_PUBLIC_BASE_URL or "").startswith("https")


def _nonce_name() -> str:
    return MAGIC_NONCE_COOKIE if _secure() else MAGIC_NONCE_FALLBACK


def _read_nonce(request: Request) -> str:
    return (request.cookies.get(_nonce_name()) or "")[:120]


def _set_nonce(response: Response, nonce: str) -> None:
    """`__Host-` demands Secure + Path=/ + NO Domain, and the browser enforces all three — which is
    the whole point: a cookie with this prefix cannot have been planted by a sibling subdomain or by
    a network attacker on a plain-http origin. httponly because no script needs it; samesite=lax
    because the consume is a same-origin POST from a page the person navigated to."""
    response.set_cookie(_nonce_name(), nonce, max_age=MAGIC_NONCE_TTL_S,
                        httponly=True, secure=_secure(), samesite="lax", path="/")


def _clear_nonce(response: Response) -> None:
    """SAME ATTRS AS `_set_nonce`, because a `__Host-` cookie says so and the browser enforces it.

    The delete used to go out bare — `__Host-rk_magic=""; expires=…; Max-Age=0; Path=/; SameSite=lax`
    with NO `Secure`. That is not a valid `__Host-` cookie, so Chrome REJECTS the whole header and
    the nonce survives its own consumption. Measured on the live stack 2026-08-09: after a successful
    verify the jar still held `__Host-rk_magic`. Harmless in itself (the LINK is single-use, and the
    nonce is worth nothing without one), but «single use, like the token it guarded» was simply not
    true, and a guard nobody can see failing is a guard nobody can trust."""
    response.delete_cookie(_nonce_name(), path="/",
                           httponly=True, secure=_secure(), samesite="lax")


def _same_site_post(request: Request) -> bool:
    """Is this POST from one of our own pages? The SECOND wall under the nonce (F3).

    `Sec-Fetch-Site` is set by the browser and cannot be written by page script; `Origin` is sent on
    every cross-origin POST — including the plain `<form method=POST>` that needs no preflight and
    is exactly what a login-CSRF uses. Either one being wrong is a refusal. A request carrying
    NEITHER is not a browser (curl, a DLP proxy replaying a link it scraped out of an email) and is
    also refused: nothing legitimate reaches this route except the SPA's own fetch."""
    site = (request.headers.get("sec-fetch-site") or "").strip().lower()
    origin = (request.headers.get("origin") or "").strip().rstrip("/").lower()
    if site:
        return site in ("same-origin", "same-site")
    return bool(origin) and origin in MAGIC_ORIGINS


async def sign_in(email: str, *, ip: str, ua: str, via: str,
                  marketing: Optional[bool] = None, text_shown: str = "",
                  text_version: str = "", lang: str = "es", company: str = "",
                  allow_live: bool = False) -> dict[str, Any]:
    """The shared tail of both doors: workspace → session → consent → flow state.

    ORDER MATTERS AND IS DELIBERATE. The workspace is minted FIRST (a session for a tenant that does
    not exist is a session `require_sup` would resolve onto nothing), the session SECOND, and the
    consent row LAST — because consent is fail-soft and must never be able to cost somebody their
    sign-in. The inverse order would make a consent-store hiccup a login outage.

    `company` (§17.56d③) becomes `tenants.name` on a fresh workspace and fills an auto-derived one
    on a resume; it never overwrites a name the operator chose (see `resume_or_provision`).

    `allow_live=False` is the magic door's fence: an address that already owns a NON-test tenant is
    refused here and sent to Google (see the module docstring). Google passes `allow_live=True`
    because a matching OAuth identity is precisely the proof §5.11.3 asks for.

    AND SINCE 2026-08-28 THIS IS ALSO WHERE THE PUBLIC MINT IS CLOSED (§21/§22). See the fence
    below: an address with NO workspace is refused unless `config.DEMO_PROVISION_OPEN` says the
    door is open, and the refusal is the one thing this function may not do quietly."""
    e = (email or "").strip().lower()
    # ONE LOOKUP, BOTH FENCES, AND IT RUNS BEFORE ANY WRITE. Checking either on the value
    # `resume_or_provision` returns would be too late: that call can already have MINTED a
    # workspace, or filled in an auto-derived tenant name, so a REFUSED sign-in would have left a
    # trace — or a whole world — behind the refusal. A refusal must change nothing.
    #
    # IT NOW RUNS FOR GOOGLE TOO. `membership_of` used to be asked only on the magic door
    # (`allow_live=False`), because the live-tenant fence was the only thing it fed; the closure
    # below applies to BOTH doors, since a stranger with a Google account self-provisioned exactly
    # as a stranger with a mailbox did. It costs the Google path one indexed read that
    # `resume_or_provision` was about to make anyway.
    async with db.get_pool().acquire() as con:
        existing = await provisioning.membership_of(con, e)
        status = await con.fetchval(
            "select status from tenants where slug = $1", existing) if existing else None

    # ── ① §21/§22 · THE PUBLIC MINT IS CLOSED (Peter, 2026-08-28) ────────────────────────────────
    # THE DIVERGENCE POINT, NAMED: `provisioning.resume_or_provision` asks `membership_of` and
    # branches — a slug RESUMES, no slug PROVISIONS. Everything the closure has to do is refuse the
    # second branch before it is reached, which is why the check is `not existing` and nothing else.
    # No allowlist, no address, no flag to keep in step with a list of customers: an account IS the
    # credential, exactly as DemoLayout's closed screen decided for the /demo surface.
    #
    # 403, NOT 500 AND NOT A SILENT REDIRECT: `sup_api._sup_api_handler` ships `SupApiError` as
    # `{ok:false, error, detail}` under its status, which is the grammar every client on this
    # surface already parses (`demo/api.ts` reads `detail` and throws a `DemoError` carrying the
    # sentence). `demo_closed` is the machine code; the sentence is Peter's.
    if not existing and not config.DEMO_PROVISION_OPEN:
        log.info("demo sign-in refused: the open mint is closed (via=%s)", via)
        raise SupApiError(403, "demo_closed", closed_sentence(lang))

    # ── ② the live-tenant fence, unmoved (§5.11.3) ───────────────────────────────────────────────
    if not allow_live:
        if existing and (status or "test") != "test":
            raise SupApiError(403, "oauth_required",
                              "Tu empresa ya está activa en Rocoto — entra con Google, con el "
                              "mismo correo. Un enlace por email no abre una empresa en marcha.")

    # `via=VIA_DEMO` (the default, said out loud here because it is the load-bearing half of the
    # retention promise): a world minted by THIS door is marked at creation, which is the only
    # reason `demo_flow.reap` can ever name it. A RESUME re-marks nothing.
    ws = await provisioning.resume_or_provision(e, company=company,
                                                via=provisioning.VIA_DEMO)
    s = await sup_session.mint(e, ws["slug"], ws["role"], ip, ua)
    try:
        await sup_session.audit(e, ws["slug"], ip, "demo.signin",
                                detail={"via": via, "provisioned": bool(ws.get("created"))})
    except Exception:
        # audit() re-raises by design on money/state actions; a sign-in is neither, and losing the
        # trail must not lose the session. Logged loudly instead.
        log.exception("demo sign-in audit failed (fail-soft) for %s", e)

    # THE ALTA ALERT (Peter, 2026-08-14: an email «on account creation»). `ws["created"]` is the
    # honest bit — it is True only when `resume_or_provision` MINTED a workspace, so signing back in
    # never re-alerts, and this is the one place both doors of the product (magic link and Google)
    # already share. Detached and fail-soft: a mail problem must not cost somebody their sign-in,
    # and nobody waits on Resend to be let in.
    if ws.get("created"):
        try:
            from brain import lead_notify as _alert
            _alert.spawn(_alert.alert_account(e, company=ws.get("name") or company,
                                              tenant_slug=ws["slug"], via=via, lang=lang))
        except Exception:  # noqa: BLE001
            log.exception("alta alert could not be scheduled (fail-soft) for %s", e)

    if marketing is not None:
        await consent_mod.record_consent(
            e, "marketing", bool(marketing), method="signin_checkbox",
            text_shown=text_shown, text_version=text_version, ip=ip, user_agent=ua, lang=lang)

    flow = await demo_flow.session_for_operator(e, ws["slug"])
    state = await consent_mod.consent_state(e)
    return {"session": s, "workspace": ws, "flow": flow, "consent": state}


def _wire(out: dict[str, Any]) -> dict[str, Any]:
    """What the SPA gets back. Shaped like `sup_api._wire_session` where it overlaps (so the panel's
    AuthProvider can accept it unchanged) plus the demo's own flow fields."""
    s, ws, flow = out["session"], out["workspace"], out["flow"]
    return {"ok": True, "email": s["email"], "tenant_slug": ws["slug"], "tenant_name": ws["name"],
            # `company` is the SAME string as tenant_name, named for the job it does on the customer
            # view's top bar (§17.56d③). Two keys, one value, on purpose: the header must not have
            # to know that a tenant's display name is what a WhatsApp contact is called.
            "company": ws["name"],
            "tenant_status": ws.get("status") or "test", "role": s["role"],
            "caps": sorted(sup_session.ROLE_CAPS.get(s["role"], [])), "csrf": s["csrf"],
            "expires_in_s": int(s.get("ttl") or 0), "provisioned": bool(ws.get("created")),
            # §11 (PEDIDOS-PRICING-BUILD.md, 2026-08-11): `resume_or_provision`'s own `onboarded`
            # bit, carried onto the wire. Its ABSENCE here used to mean `parseSupSession` defaulted
            # `onboarded` to TRUE for every workspace this door ever touched (`bool(r.onboarded,
            # true)`) — silent while `/demo`'s own next step (`/demo/catalog`) sits outside the Gate
            # and never reads the flag, live the moment a `/plan`-routed signup lands back inside it
            # with no onboarding wizard behind them.
            "onboarded": bool(ws.get("onboarded")),
            "consent": out["consent"], **flow}


# ═══ ROUTES ═══════════════════════════════════════════════════════════════════════════════════════

@router.post("/auth/magic")
async def demo_auth_magic(request: Request, response: Response, payload: dict | None = None):
    """`{email, company?, consent:{marketing}, text_version?, text_shown?, lang?}` → 200, ALWAYS.

    Never leaks whether an address exists, is throttled, or bounced: one sentence for every outcome.
    That is not politeness — an issuance endpoint that distinguishes them is an account-enumeration
    oracle anybody can run from a browser.

    `company` IS OPTIONAL, and that is the fix for the defect Peter named on 2026-08-11: «if they
    choose Google, it doesn't ask them for the name of their company, what? … That should be part
    of the normal onboarding.» This route used to answer 400 `company_required` without one, while
    `/auth/google` — the OTHER door onto the very same `sign_in` — has always accepted a missing
    company and simply derived a name. So the two doors of one sign-in screen disagreed about what
    signing in costs, and the door that demanded MORE was the one a person picks precisely because
    they have no Google account. There is nothing to validate here: what the business is called is
    `/bienvenida`'s first question, written through `POST /api/sup/company`, the same wire Empresa
    edits it with.

    WITH NO COMPANY, THIS PATH IS NOW BYTE-IDENTICAL TO GOOGLE'S. Both hand `sign_in` an empty
    string, so both reach `provisioning.resume_or_provision('')`: a RESUMING operator keeps the
    name their workspace already has (a sign-in never renames a workspace — provisioning.py's own
    law), and a brand-new one is named by `provisioning.provision`'s `_person_of` fallback, the
    same derivation every Google signup has always been given. `clean_company` still runs inside
    `issue_magic`, so a company that IS sent — `/demo`'s own screens always send one — is stored
    and applied exactly as before, and their behaviour does not move.

    IT ALSO SETS THE REQUESTER NONCE (F3). The cookie goes out on every call, including the
    throttled and the bad-address ones, because a response that sets a cookie only on success is an
    existence oracle wearing a different hat."""
    body = payload if isinstance(payload, dict) else {}
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")
    c = body.get("consent") if isinstance(body.get("consent"), dict) else {}
    # ONE nonce per browser, reused while it is alive: asking for a second link (the «it didn't
    # arrive» case) must not invalidate the first one the person is about to click.
    nonce = _read_nonce(request) or secrets.token_urlsafe(24)
    _set_nonce(response, nonce)
    await issue_magic(str(body.get("email") or ""), ip=ip, ua=ua,
                      marketing=bool(c.get("marketing")),
                      text_version=str(body.get("text_version") or ""),
                      text_shown=str(body.get("text_shown") or ""),
                      lang=str(body.get("lang") or "es"),
                      company=str(body.get("company") or ""),
                      nonce=nonce)
    return {"ok": True, "detail": _MAGIC_SENT}


@router.get("/auth/verify/{token}")
async def magic_verify_get(token: str):
    """The click. It REDIRECTS and does NOT consume — the consumption is the POST below.

    WHY, and it is not fussiness: corporate mail scanners and link-preview bots fetch every URL in
    an inbound email with a GET, before the human sees it. A GET that consumed a single-use token
    would hand the session to the scanner and a dead link to the person, and the failure would be
    invisible to us and infuriating to them. Nothing issues a POST on your behalf, so the POST is
    where the act belongs. GET stays idempotent, which is also what the method means."""
    base = (config.DEMO_PUBLIC_BASE_URL or "https://app.soyrocoto.com").rstrip("/")
    return RedirectResponse(f"{base}/demo/entrar?t={quote(token or '')}", status_code=302)


@router.post("/auth/verify/{token}")
async def magic_verify_post(token: str, request: Request, response: Response):
    """Consume the link → mint the panel's session → provision-or-resume → record the consent that
    was ticked when the link was requested. The cookie is set through `sup_api._set_cookie`, so it is
    byte-identical to the one `/api/sup/session/login` issues — same name, same path, same attrs,
    same everything `require_sup` and the logout path already know how to handle.

    ── THE REQUESTER BINDING (2026-08-09 review, F3) ────────────────────────────────────────────
    This route used to take a token and nothing else: no body model, no session to double-submit a
    CSRF token against, no `Origin` check. That is LOGIN CSRF, and the consequence is the reverse of
    the usual one — the attacker does not steal the victim's session, they PLANT their own. Request
    a link for an address you own, name the workspace «Distribuciones García», do not click it, and
    auto-submit a cross-site form POST at it from a page the victim visits. A form POST is a
    CORS-simple request: no preflight, and nothing needs to be read back. SameSite governs whether a
    cookie is SENT, not whether a `Set-Cookie` is STORED, so `lax` does not help. The victim then
    opens /demo, sees a plausible workspace with a plausible name, and uploads their price list into
    the attacker's tenant. Second consequence of the same gap: anyone who merely OBSERVES the link
    URL — a mail scanner, a DLP proxy, a shared inbox — owned the account for fifteen minutes.

    Two walls, and they fail differently on purpose. ① the `__Host-` nonce cookie, set when the link
    was requested and matched inside the consuming UPDATE: a cross-site page can neither read nor
    forge it, and a passive URL observer never had it. ② `Sec-Fetch-Site` / `Origin`: the browser
    writes those and page script cannot. ① is the one that also stops the observer; ② is the one
    that still holds if a browser ever ships without the cookie.

    THE COST, STATED: the link now completes only in the browser that asked for it. Requesting on a
    laptop and clicking on a phone is refused, with a sentence that says exactly that. This is the
    same trade Supabase's own PKCE magic-link flow makes, and it is the right one when the next
    screen asks for the operator's entire price list."""
    if not _same_site_post(request):
        log.warning("demo magic verify refused: cross-site POST (site=%r origin=%r)",
                    request.headers.get("sec-fetch-site"), request.headers.get("origin"))
        raise SupApiError(403, "bad_origin", _LINK_DEAD)
    nonce = _read_nonce(request)
    row = await consume_magic(token, nonce)
    if row is None:
        raise SupApiError(401, "link_dead", _LINK_WRONG_BROWSER if not nonce else _LINK_DEAD)
    c = dict(row.get("consent") or {})
    out = await sign_in(row["email"], ip=_client_ip(request),
                        ua=request.headers.get("user-agent", ""), via="magic",
                        marketing=bool(c.get("marketing")),
                        text_shown=str(c.get("text_shown") or ""),
                        text_version=row.get("text_version") or "",
                        lang=row.get("lang") or "es",
                        company=row.get("company") or "",
                        allow_live=False)
    _set_cookie(response, out["session"]["raw"])
    _clear_nonce(response)          # single use, like the token it guarded
    return _wire(out)


@router.post("/auth/google")
async def demo_auth_google(request: Request, response: Response, payload: dict | None = None):
    """`{access_token, company, consent:{marketing}, text_version?, text_shown?}`.

    HOW THE COMPANY SURVIVES THE OAUTH BOUNCE (§17.56d③, decision stated rather than discovered):
    it rides THIS call, not the `next=` carry. The screen collects email+company+consent, the SPA
    keeps the company in `sessionStorage` across the Supabase redirect, and `/auth/callback` — which
    already POSTs the access token to the backend — sends it along. That is honest with the Supabase
    rail (nothing extra to register, no state parameter to smuggle through Google), it keeps a
    business name out of URLs, redirect logs and `Referer` headers, and it needs no follow-up call
    the person could bounce before making. The cost is that a session cleared mid-bounce loses the
    company — which is why `company_fallback` exists and why nobody ever sees a placeholder.

    THE SAME RAIL `sup_api.sup_login` USES, with one difference that is the whole point of §17.56c:
    login requires a membership and refuses without one, because the panel is for people who already
    have a workspace; /demo MINTS the workspace on first sight. Both gates that guard elevation are
    identical and unmoved — the bearer is verified server-side against the Supabase Auth API, and
    `has_matching_oauth` still refuses a password signup and the linkIdentity forgery.

    The frontend reaches here from the EXISTING `/auth/callback` route carrying `next=/demo/…`; no
    second OAuth rail, no second redirect URI to register."""
    body = payload if isinstance(payload, dict) else {}
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")
    if not sup_session.rate_ok(f"demogoogle:{ip}", 12, 300) or \
       not sup_session.rate_ok("demogoogle:GLOBAL", 60, 300):
        raise SupApiError(429, "rate_limited", "Demasiados intentos. Espera unos minutos.")
    user = await brain_auth.verify_token(str(body.get("access_token") or "").strip())
    if not user:
        raise SupApiError(401, "unauthorized", "No hemos podido verificar tu sesión de Google.")
    if not brain_auth.has_matching_oauth(user):
        raise SupApiError(403, "oauth_required", "Entra con Google — sin contraseñas.")
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise SupApiError(403, "no_email", "Tu cuenta de Google no nos da un correo.")
    c = body.get("consent") if isinstance(body.get("consent"), dict) else {}
    marketing = bool(c.get("marketing")) if "marketing" in (c or {}) else None
    out = await sign_in(email, ip=ip, ua=ua, via="google", marketing=marketing,
                        text_shown=str(body.get("text_shown") or ""),
                        text_version=str(body.get("text_version") or ""),
                        company=str(body.get("company") or ""),
                        allow_live=True)
    _set_cookie(response, out["session"]["raw"])
    return _wire(out)


@router.get("/me")
async def demo_me(ctx: dict = Depends(sup_api.require_cap("read"))):
    """Everything the /demo SPA needs on boot, for a SIGNED-IN operator: who they are, which
    workspace, what they consented to, and where the flow got to. A clean 401 (JSON, cookie-clearing)
    when there is no session — never an HTML redirect the SPA would have to sniff.

    TWO GATES ADDED 2026-08-09 (review F4). This route was `require_sup` with NO cap, and it MINTED
    a flow session (and returned its token) for whatever tenant the cookie happened to carry —
    including a live paying one, since nothing in this family checked `status`. That made it the
    front door to the whole /demo write surface for any seat at any tenant. Now: `read` is the floor
    (a `repartidor`, cap set `{'deliver'}`, gets 403 here and therefore nowhere), and a NON-test
    tenant is refused BEFORE `session_for_operator` writes anything — a refusal must leave no trace,
    the same law `sign_in`'s live-tenant fence already follows."""
    email = ctx["actor_email"]
    t = await sup_api._tenant_row(ctx["tenant_slug"])
    if ((t or {}).get("status") or "") != "test":
        raise SupApiError(409, "live_tenant",
                          "Tu empresa ya está en marcha en Rocoto. La prueba solo trabaja sobre "
                          "un espacio en pruebas — para tu cuenta de verdad, entra en el panel.")
    flow = await demo_flow.session_for_operator(email, ctx["tenant_slug"])
    view = await demo_flow.session_view(flow["token"])
    # §17.56d③: the customer view's top bar renders from THIS call, with no second round-trip. The
    # fallback runs only for a workspace somehow provisioned without a name — never «Demo — tus
    # productos», which is the anonymous world's title and must not reach an authed operator.
    name = (t or {}).get("name") or ""
    if not name or name == "Demo — tus productos":
        name = provisioning.company_fallback(email)
    return {"ok": True, "email": email, "tenant_slug": ctx["tenant_slug"],
            "tenant_name": name, "company": name,
            "tenant_status": (t or {}).get("status") or "test",
            "role": ctx["role"], "csrf": ctx["csrf"],
            "consent": await consent_mod.consent_state(email),
            "consent_wording": consent_mod.wording(),
            **flow, **(view or {})}


@router.post("/company")
async def demo_company(payload: dict, ctx: dict = Depends(sup_api.require_cap("admin:rocoto"))):
    """`{name}` → rename the workspace (§17.56d③). Somebody WILL typo their own company name, and it
    is on screen at the top of the customer view for the rest of the demo, so correcting it is a
    first-class act rather than a settings-page errand.

    Authed, CSRF-checked, capped at `admin:rocoto` (the office cap — renaming the business is the
    operator's own job, not an owner-only act) and bounded to the SESSION's tenant: the body names a
    string, never a slug, so renaming somebody else's workspace is not expressible.

    Fenced to `status='test'` like the rest of the family (F4b): /demo must not be a second, less
    audited way to rename a live paying workspace."""
    t = await sup_api._tenant_row(ctx["tenant_slug"])
    if ((t or {}).get("status") or "") != "test":
        raise SupApiError(409, "live_tenant",
                          "Tu empresa ya está en marcha — cambia el nombre desde el panel.")
    name = await provisioning.rename(ctx["tenant_slug"],
                                     str((payload or {}).get("name") or ""))
    if not name:
        raise SupApiError(400, "bad_company",
                          "Ese nombre no me vale — escribe cómo se llama tu empresa.")
    await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], ctx.get("ip") or "",
                            "demo.company", detail={"len": len(name)})
    return {"ok": True, "company": name, "tenant_name": name}


@router.post("/consent")
async def demo_consent(payload: dict, request: Request, ctx: dict = Depends(sup_api.require_sup)):
    """`{kind, granted, text_shown?, text_version?}` → a NEW row. Authed, CSRF-checked by
    `require_sup` (this is a POST), and bounded to the SESSION's own address — the body cannot name
    somebody else's email, so a consent row for another person is not expressible here.

    Both directions are the same call, which is what «withdrawal as easy as giving it» means in
    code: the panel's switch posts `granted:false` and that is the whole withdrawal."""
    body = payload if isinstance(payload, dict) else {}
    kind = str(body.get("kind") or "marketing").strip().lower()
    if kind not in consent_mod.CONSENT_KINDS:
        raise SupApiError(400, "bad_kind", "Ese permiso no existe.")
    granted = bool(body.get("granted"))
    ok = await consent_mod.record_consent(
        ctx["actor_email"], kind, granted, method="panel_switch",
        text_shown=str(body.get("text_shown") or ""),
        text_version=str(body.get("text_version") or ""),
        ip=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    if not ok:
        raise SupApiError(500, "consent_not_recorded",
                          "No he podido guardar ese cambio. Inténtalo otra vez.")
    return {"ok": True, "consent": await consent_mod.consent_state(ctx["actor_email"])}


_UNSUB_PAGE = """<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rocoto</title>
<style>body{{font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#2A2521;background:#FBF9F6;
margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}}
.c{{max-width:30rem;text-align:center}}h1{{font-size:20px;margin:0 0 8px}}p{{margin:0;color:#6B625A}}</style>
<div class="c"><h1>{title}</h1><p>{body}</p></div>"""


@router.get("/unsubscribe/{signed}")
@router.post("/unsubscribe/{signed}")
async def demo_unsubscribe(signed: str, request: Request):
    """ONE-CLICK UNSUBSCRIBE — no login, no session, no form (§17.56c: as easy as giving it).

    GET is the human clicking the footer link; POST is RFC 8058's one-click, which Gmail and Outlook
    issue themselves from the `List-Unsubscribe-Post` header without the person ever leaving their
    inbox. Both do exactly one thing: append a WITHDRAWAL row. The signed token authorises nothing
    else — it cannot grant consent, cannot read anything, and mints no session — so a leaked link
    costs, at most, one unsubscribe.

    It ALWAYS renders the same page. An invalid signature is not told it is invalid: the page is the
    same «done» either way, because distinguishing them turns the endpoint into a probe for which
    addresses we hold."""
    hit = consent_mod.verify_unsubscribe(signed)
    if hit:
        email, kind = hit
        await consent_mod.withdraw(email, kind, method="email_unsubscribe",
                                   ip=_client_ip(request),
                                   user_agent=request.headers.get("user-agent", ""))
    return HTMLResponse(_UNSUB_PAGE.format(
        title="Listo — no te escribimos más",
        body="Has dejado de recibir correos de novedades de Rocoto. Los correos de tu cuenta "
             "(enlaces para entrar, avisos de tu catálogo) seguirán llegando."))


@router.get("/consent/wording")
async def demo_consent_wording():
    """The canonical checkbox text + its version, served so the SPA renders the SAME string that
    ends up in `text_shown`. Public: it is the sentence we are about to show a stranger, and it must
    be readable before there is a session."""
    return {"ok": True, **consent_mod.wording()}


@router.get("/config")
async def demo_config():
    """THE DEMO'S PUBLIC CONFIG — everything the SPA needs before there is a session, in one call.

    It exists because the sign-in screen cannot be rendered honestly without the consent wording,
    and a screen that has to make TWO round-trips before it can draw its own checkbox will
    sometimes draw it late, or (worse) draw it against a default string that is not the one we
    would store as evidence. The frontend's rule is «no wording, no checkbox» — so this endpoint
    is what makes the checkbox appear at all.

    Public and unauthenticated by construction: every field here is something we are about to show
    a stranger. Nothing tenant-shaped may ever be added to it."""
    return {
        "ok": True,
        "enabled": bool(config.DEMO_FLOW_ENABLED),
        "consent": consent_mod.wording(),
    }


def mount(app) -> None:
    """ONE line in app.py, after `sup_api.mount(...)` — this router binds sup_api's own session
    dependency and raises sup_api's own error types, so its handlers must already be registered."""
    app.include_router(router)
