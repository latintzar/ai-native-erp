"""consent.py — CONSENT AS EVIDENCE, NOT AS A BOOLEAN (SPEC §17.56c; GDPR Art. 4(11) + Recital 32).

Peter's rule, and it is law rather than taste: «proof is stored, not assumed». A column that says
`marketing_ok = true` cannot answer the only question that matters when it is asked — *what exactly
did they see, when, from where, and how did they say yes?* — and it cannot answer «and when did they
change their mind?» at all, because the change destroyed the evidence of the state before it. So the
store here is an APPEND-ONLY LOG, and the current state is a DERIVATION over it:

    consent_events            one row per ACT of consenting or withdrawing
    consent_state(email)      the latest row per (email, kind) — computed, never stored

Consequences that fall out, each one a GDPR requirement met by construction rather than by
discipline:
  · A WITHDRAWAL IS AN INSERT. Nothing in this file updates or deletes a consent row, and a DB
    trigger (the `cr_audit` discipline — it binds even for the owner role) makes that structural
    rather than a convention one hurried edit can break. «Withdrawal as easy as giving it» is then
    literally the same operation with `granted=false`.
  · THE WORDING IS STORED WITH THE ANSWER. `text_shown` + `text_version` mean the proof survives the
    copy being rewritten next month. And because the canonical wording lives HERE as one constant
    that the config endpoint serves to the frontend, the string that gets rendered and the string
    that gets stored cannot drift — the alternative (a sentence in the SPA, another in the backend)
    is a lie you only discover in a complaint.
  · REFUSAL IS A FIRST-CLASS ANSWER, RECORDED. `granted=false` at sign-in is a ROW, not an absence:
    «we asked and they said no» and «we never asked» are different facts and the regulator's
    question distinguishes them.

**THE THING THIS FILE MUST NEVER BECOME: a gate on the service.** §17.56c: refusing marketing may
not block sign-in, upload or chat. The service runs on the contract basis; the marketing runs on
consent; tying them together is exactly the «bundling» Recital 32 forbids. That is why the ONLY
enforcement function here is `may_send_marketing`, why it is called from SEND paths and nowhere
else, and why `record_consent` is fail-soft on the way in (a consent-store hiccup must not cost
somebody their sign-in — it must cost us the send, which is the safe direction).

Transactional mail — the magic link, «tu catálogo está listo», an invoice — does NOT pass through
`may_send_marketing` and must not: it is the performance of a contract, not a marketing message, and
gating it on a checkbox would break the product for anyone who ticked nothing.

`consent_events` is EMAIL-keyed, not scope-keyed: it carries no `scope` column, so it is correctly
outside `schema_rls.sql`'s array (tests/vital_rls_coverage.py discovers its subjects by
`column_name='scope'`) — the same reasoning that keeps `catalogue_intake` and `demo_sessions` out.
The fence here is that no route ever reads a consent row for an address the session does not own.

es-ES is canonical on every human-facing string (LOCKED LAW). Code, comments, logs in English.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.consent")

# ── THE CANONICAL WORDING — ONE STRING, THREE CONSUMERS ──────────────────────────────────────────
# Rendered by the SPA (served through the config endpoint), stored verbatim in `text_shown`, and
# quoted back in the panel's own «puedes cambiarlo cuando quieras» switch. One constant is what makes
# «the wording we can evidence» and «the wording they saw» the same object rather than two strings
# somebody has to remember to edit together.
#
# It says ONE purpose in plain words (Recital 32: specific + informed), it is separate from the Terms
# (never bundled), and the checkbox that carries it ships UNTICKED (never pre-ticked). The links are
# rendered by the SPA around the two page names; the stored evidence keeps the sentence.
MARKETING_TEXT_ES = (
    "Quiero que el equipo de Rocoto pueda escribirme y recibir correos con novedades y consejos "
    "de producto. Puedo darme de baja cuando quiera, con un clic, desde cualquiera de esos correos. "
    "No es necesario para usar la prueba."
)
MARKETING_TEXT_EN = (
    "I'd like the Rocoto team to be able to contact me and to receive product news and tips by "
    "email. I can unsubscribe at any time, in one click, from any of those emails. This is not "
    "required to use the demo."
)
# Bump this string — never edit a wording in place without bumping it — whenever either sentence
# above changes in meaning. Old rows keep their old version and their own `text_shown`, which is the
# whole point: consent is evidence of what was shown THEN.
CONSENT_TEXT_VERSION = "2026-08-08.1"

# The kinds this product asks about. Open by design (§17.56c: «keep the column open for future
# kinds») — a new purpose is a new member here plus its own wording, never a second table and never
# a reuse of `marketing` to cover something the sentence above does not describe.
CONSENT_KINDS: tuple[str, ...] = ("marketing",)

# How the answer was given. Recorded because «they agreed» is not evidence unless you can say HOW.
CONSENT_METHODS: tuple[str, ...] = (
    "signin_checkbox",      # the box at /demo sign-in (the §17.56c ask)
    "panel_switch",         # the visible switch in the panel
    "email_unsubscribe",    # the one-click link in a marketing email (always a withdrawal)
    "support",              # recorded on their behalf after an explicit request — say so, don't hide it
)


_schema_ready = False


async def ensure_schema(con=None) -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    if con is not None:
        await assert_current(con)
        return
    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def text_for(kind: str, lang: str = "es") -> str:
    """The exact sentence for a kind. Unknown kind → '' (an empty `text_shown` on a stored row is a
    visible defect; inventing a sentence would be an invisible one)."""
    if kind != "marketing":
        return ""
    return MARKETING_TEXT_EN if str(lang or "es").lower().startswith("en") else MARKETING_TEXT_ES


def wording() -> dict[str, Any]:
    """What the config endpoint hands the SPA, so the rendered string and the evidenced string are
    the same object. Shipping the version alongside is what lets the client echo it back and lets us
    refuse an echo that does not match what is current."""
    return {"version": CONSENT_TEXT_VERSION, "kinds": list(CONSENT_KINDS),
            "text": {"marketing": {"es": MARKETING_TEXT_ES, "en": MARKETING_TEXT_EN}}}


# ── writing ───────────────────────────────────────────────────────────────────────────────────────

async def record_consent(email: str, kind: str, granted: bool, *, method: str,
                         text_shown: str = "", text_version: str = "",
                         ip: str = "", user_agent: str = "", lang: str = "es") -> bool:
    """Append ONE consent act. Returns True if the row landed.

    FAIL-SOFT ON THE WAY IN, deliberately and in the safe direction: if the store hiccups we lose the
    GRANT (so `consent_state` keeps saying «no» and no marketing goes out) rather than losing the
    person their sign-in. The inverse — treating an unwritable store as consent — is the one failure
    mode that could actually mail somebody who never agreed.

    `text_shown` defaults to the canonical wording for the kind rather than to '': a client that
    forgot to echo it still leaves usable evidence, and a client that echoes a DIFFERENT string is
    recorded verbatim, because what they saw is what must be stored even when it is our bug."""
    e = (email or "").strip().lower()[:200]
    k = (kind or "").strip().lower()[:40]
    if not e or k not in CONSENT_KINDS:
        log.warning("consent: refusing to record kind=%r for %r", kind, bool(e))
        return False
    shown = (text_shown or text_for(k, lang))[:4000]
    ver = (text_version or CONSENT_TEXT_VERSION)[:40]
    m = (method or "").strip()[:40] or "unknown"
    try:
        await ensure_schema()
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into consent_events(operator_email, kind, granted, text_shown, "
                "  text_version, ip, user_agent, method) values($1,$2,$3,$4,$5,$6,$7,$8)",
                e, k, bool(granted), shown, ver, (ip or "")[:80], (user_agent or "")[:400], m)
        log.info("consent recorded email=%s kind=%s granted=%s method=%s", e, k, bool(granted), m)
        return True
    except Exception:
        log.exception("consent record FAILED (fail-soft, state stays as it was) email=%s kind=%s", e, k)
        return False


async def withdraw(email: str, kind: str = "marketing", *, method: str = "panel_switch",
                   ip: str = "", user_agent: str = "") -> bool:
    """A withdrawal. Not a special operation — the same append with `granted=false`, which is exactly
    why «as easy as giving it» is true here instead of aspirational. `text_shown` carries the wording
    they are withdrawing FROM, so the row reads as a complete sentence on its own."""
    return await record_consent(email, kind, False, method=method, ip=ip, user_agent=user_agent)


# ── reading ───────────────────────────────────────────────────────────────────────────────────────

async def consent_state(email: str) -> dict[str, bool]:
    """Current state = the LATEST row per kind, `id desc` (monotonic, so two acts in the same
    millisecond still order — a `created_at desc` tiebreak is a coin flip and this is evidence).

    Every known kind is present in the answer, defaulting to False: NO ROW IS NOT CONSENT. Silence
    is the one thing Art. 4(11) is most explicit about, so the absence of evidence renders here as a
    hard «no», never as an unknown the caller might coerce."""
    out = dict.fromkeys(CONSENT_KINDS, False)
    e = (email or "").strip().lower()
    if not e:
        return out
    try:
        await ensure_schema()
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select distinct on (kind) kind, granted from consent_events "
                "where lower(operator_email) = $1 order by kind, id desc", e)
        for r in rows:
            if r["kind"] in out:
                out[r["kind"]] = bool(r["granted"])
    except Exception:
        log.exception("consent_state read failed for %s — answering NO for every kind", e)
        return dict.fromkeys(CONSENT_KINDS, False)
    return out


async def history(email: str, limit: int = 50) -> list[dict[str, Any]]:
    """The trail, newest first — what an access request (Art. 15) or a complaint is answered with.
    Read-only and email-bounded; the caller owns the fence (never serve this for an address the
    session does not own)."""
    e = (email or "").strip().lower()
    if not e:
        return []
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, kind, granted, text_shown, text_version, ip, user_agent, method, created_at "
            "from consent_events where lower(operator_email) = $1 order by id desc limit $2",
            e, max(1, min(int(limit or 50), 500)))
    return [{**dict(r), "created_at": r["created_at"].isoformat() if r["created_at"] else None}
            for r in rows]


# ── THE GATE ──────────────────────────────────────────────────────────────────────────────────────

async def may_send_marketing(email: str) -> bool:
    """THE ONE ENFORCEMENT POINT. Every marketing send asks this; no transactional send does.

    Fail-CLOSED on any error, which is the opposite posture to the rest of this module's fail-soft
    writes and is the correct asymmetry: a store we cannot read must cost us a send, never cost
    somebody an unwanted email we cannot prove they agreed to."""
    try:
        return bool((await consent_state(email)).get("marketing"))
    except Exception:
        log.exception("may_send_marketing failed for %s — refusing the send", email)
        return False


# ── ONE-CLICK UNSUBSCRIBE (signed, no login) ─────────────────────────────────────────────────────
# «Withdrawal as easy as giving it» cannot mean «sign in first»: the person receiving a marketing
# email may have no session, no password and no memory of us. So the link carries its own proof.
#
# THE TOKEN IS A SIGNATURE OVER (email, kind), NOT A STORED ROW, on purpose: a stored token is a
# second thing to mint, expire and reap for every send, and losing it means an unsubscribe link that
# silently stops working — the worst possible failure for this particular button. An HMAC needs no
# storage, cannot be enumerated, and is verified in constant time. It does NOT expire: an
# unsubscribe link from two years ago must still work.
#
# It authorises exactly ONE act — recording a WITHDRAWAL for that address. It grants no session, no
# read, and no way to grant consent (a signed link that could turn marketing ON would be a
# forgery surface with a real payoff; `unsubscribe` hard-codes granted=False).

def _signing_key() -> bytes:
    """The HMAC key. `CONSENT_SIGNING_SECRET` when set; otherwise the machine key, which every
    deployment already has — so the link works on day one without a new env var, and rotating to a
    dedicated secret is a one-line change that invalidates only outstanding unsubscribe links."""
    raw = (config._env("CONSENT_SIGNING_SECRET", "") or config.ROCOTO_API_KEY or "").strip()
    if not raw:
        # No key configured (dev): derive a process-stable one so nothing crashes, and SAY SO — a
        # silently unverifiable signature is worse than a loud dev-only warning.
        log.warning("consent: no CONSENT_SIGNING_SECRET / ROCOTO_API_KEY — unsubscribe links are "
                    "process-local and will not survive a restart")
        raw = f"dev-consent-{time.time():.0f}"
    return hashlib.sha256(raw.encode()).digest()


def _b64(raw: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    import base64
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def unsubscribe_token(email: str, kind: str = "marketing") -> str:
    """`<b64(email|kind)>.<b64(hmac)>` — opaque enough that it is not a readable address in a URL bar
    over someone's shoulder, and signed so it cannot be edited into another person's."""
    e = (email or "").strip().lower()
    payload = f"{e}|{(kind or 'marketing').strip().lower()}".encode()
    sig = hmac.new(_signing_key(), payload, hashlib.sha256).digest()[:24]
    return f"{_b64(payload)}.{_b64(sig)}"


def verify_unsubscribe(token: str) -> Optional[tuple[str, str]]:
    """token → (email, kind), or None. Constant-time compare; every malformed/forged shape answers
    the SAME None so a probe learns nothing about which addresses exist (portal.py's law)."""
    t = (token or "").strip()
    if not t or "." not in t or len(t) > 400:
        return None
    body, _, sig_s = t.partition(".")
    try:
        payload = _unb64(body)
        given = _unb64(sig_s)
    except Exception:
        return None
    want = hmac.new(_signing_key(), payload, hashlib.sha256).digest()[:24]
    if not hmac.compare_digest(want, given):
        return None
    try:
        email, _, kind = payload.decode().partition("|")
    except Exception:
        return None
    if not email or kind not in CONSENT_KINDS:
        return None
    return email, kind


def unsubscribe_url(email: str, kind: str = "marketing") -> str:
    """The link that goes in the email. It lands on the API host (this backend owns the act); the
    route answers a tiny es-ES page rather than JSON, because a human clicks it."""
    base = (config.PUBLIC_BASE_URL or "").rstrip("/")
    return f"{base}/api/demo/unsubscribe/{unsubscribe_token(email, kind)}"


def list_unsubscribe_headers(email: str, kind: str = "marketing") -> dict[str, str]:
    """RFC 8058 one-click. `List-Unsubscribe-Post` is what makes Gmail/Outlook render their OWN
    unsubscribe control and POST to the URL without the person ever seeing our page — the single
    highest-signal thing you can do for deliverability AND the most honest reading of «as easy as
    giving it». Both headers must be present or mailbox providers ignore the pair."""
    url = unsubscribe_url(email, kind)
    return {"List-Unsubscribe": f"<{url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}


def unsubscribe_footer_html(email: str, kind: str = "marketing", lang: str = "es") -> str:
    """The visible footer link. The headers above are for the client; this is for the person whose
    client does not render them. Both, always, in every marketing send."""
    url = unsubscribe_url(email, kind)
    if str(lang or "es").lower().startswith("en"):
        return (f'<p style="margin:24px 0 0;font-size:13px;color:#998F83">Don\'t want these? '
                f'<a href="{url}" style="color:#998F83">Unsubscribe in one click</a>.</p>')
    return (f'<p style="margin:24px 0 0;font-size:13px;color:#998F83">Si no quieres más correos, '
            f'<a href="{url}" style="color:#998F83">date de baja con un clic</a>.</p>')
