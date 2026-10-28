"""vital_demo_auth.py — §17.56c/§17.56d③: /demo signs in for real, and consent is evidence.

The security + lawfulness floor for the public front door. Asserts, against a real DB and with NO
network (Supabase `verify_token` is never called — the Google door's gates are proved in
vital_cr_auth/vital_caps_split; what is new here is everything AFTER a verified address):

  · THE MAGIC LINK IS A CREDENTIAL, not a bookmark — single use enforced by the atomic consuming
    UPDATE (two concurrent consumes → exactly one winner), expiry, and ONE answer for unknown /
    expired / already-consumed (portal.py's non-leaking law). Only the sha256 is stored.
  · ONE OPERATOR, ONE WORKSPACE, FOREVER — a first sign-in mints exactly one tenant + one operator
    seat + one owner membership; a SECOND sign-in resumes it and mints nothing.
  · THE COMPANY NAME NAMES THE TENANT (§17.56d③), accents and «S.L.» intact, and a resume never
    silently renames a workspace the operator renamed themselves.
  · CONSENT IS NOT A GATE — refusing marketing changes nothing about sign-in or the flow.
  · A WITHDRAWAL WINS over an earlier grant, and a later grant wins over the withdrawal (ordering by
    the monotonic id, not by a timestamp two rows can share).
  · THE MARKETING GATE REFUSES an unconsented send; TRANSACTIONAL MAIL IGNORES CONSENT ENTIRELY.
  · consent_events is APPEND-ONLY at the DB level (UPDATE/DELETE blocked for the owner role too).
  · THE SCOPE/TENANT INVARIANT holds for both worlds: tenant_of(scope_of_row(r)) == tenant_of_row(r).

§14 — THE 2026-08-09 SECURITY REMEDIATION. One block per finding of the adversarial review, and
each one asserts that the ATTACK fails, not that the patch is present:

  F1  two addresses sharing a local part (`pedidos@evil.tld` / `pedidos@carnicasaldonza.es`) get
      DIFFERENT operator ids and DISJOINT memberships; `peter@<anything>` cannot seize `op_peter`;
      an existing id under a different email RAISES; `membership_of` is deterministic.
  F2  the anonymous door is GONE — no `create_session`, no `set_email`, no routes, and the one
      remaining mint fails closed without both an operator and a tenant.
  F3  a consume without the requester nonce is refused AND does not burn the link; a cross-site
      POST is refused on Sec-Fetch-Site / Origin.
  F4  a `repartidor` reaches nothing; a missing CSRF refuses an owner; a LIVE tenant is fenced off
      the whole surface; the commit no longer honours a client-supplied `override`.
  F5  the loop stays responsive through a 60 000-row parse; the excel walk clips AND says so.
  F7  a forged `X-Forwarded-For` from an untrusted peer is ignored; the rightmost entry wins.
  F8  expired sessions, dead links and orphan `demo_` tenants are actually deleted — and a real
      provisioned workspace is not.
  F10 the rate-limit store stays bounded under a flood of attacker-named keys, and a saturated
      global short-circuits before one is allocated.
  F11 the absolute 24h spend ceiling refuses, per kind.
  F9  the wording the SPA parses is the shape the backend serves, and the privacy links live
      outside the checkbox block.

Run on prod as root:  REHEARSAL_DB=rocoto_rehearsal PYTHONPATH=. venv/bin/python tests/vital_demo_auth.py
"""
import asyncio
import inspect
import io
import os
import time
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())

import config  # noqa: E402
import consent as consent_mod  # noqa: E402
import db  # noqa: E402
import demo_api  # noqa: E402 — test environment must be configured before importing the API
import demo_auth  # noqa: E402
import demo_flow  # noqa: E402
import provisioning  # noqa: E402
import sup_session  # noqa: E402
import tenancy  # noqa: E402

R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

_BACKEND = Path(__file__).resolve().parent.parent
STAMP = str(int(time.time()))[-6:]
E1 = f"vital.demo.{STAMP}@carnicas-vital-{STAMP}.es"     # business domain → company_fallback uses it
E2 = f"vital.demo2.{STAMP}@gmail.com"                    # consumer domain → local-part fallback
COMPANY = "Cárnicas Aldonza, S.L. — Ñoño & Hijos"        # accents, ñ, legal form, punctuation


async def main():
    await db.init()
    await consent_mod.ensure_schema()
    await demo_auth.ensure_schema()
    await demo_flow.ensure_demo_schema()
    # THE OPEN MINT IS A THING THIS FILE PROVES THE SHAPE OF — ④, ⑤ and ⑦ below all assert what
    # provisioning DOES on a first sight — so the door is held open for them. The CLOSURE (§21, and
    # the shipped default) has its own block after ⑬, which flips this switch both ways and asserts
    # both halves against the same database.
    config.DEMO_PROVISION_OPEN = True

    # ── ① the company name, cleaned but NOT mangled (§17.56d③) ────────────────────────────────────
    ck("company: whitespace collapsed, string otherwise untouched",
       provisioning.clean_company("  Cárnicas   Aldonza,  S.L. ") == "Cárnicas Aldonza, S.L.")
    ck("company: accents / ñ / «S.L.» survive (a Spanish name IS its accents)",
       provisioning.clean_company(COMPANY) == COMPANY)
    ck("company: empty in → empty out (the caller falls back; no placeholder is minted here)",
       provisioning.clean_company("   ") == "" and provisioning.clean_company(None) == "")
    ck("company: capped at COMPANY_MAX",
       len(provisioning.clean_company("x" * 500)) == provisioning.COMPANY_MAX)
    ck("fallback: a business domain becomes the name",
       provisioning.company_fallback(E1).lower().startswith("carnicas"),
       provisioning.company_fallback(E1))
    ck("fallback: a consumer mailbox falls back to the person, never to the provider",
       "Gmail" not in provisioning.company_fallback(E2), provisioning.company_fallback(E2))

    # ── ② the magic link is a credential ──────────────────────────────────────────────────────────
    # The sender is STUBBED rather than relying on EGRESS_SANDBOX being on: a vital that mails a
    # made-up address when someone runs it with the sandbox off is a vital that damages sender
    # reputation to prove a point.
    import actions as _actions
    _real_send = _actions.send_email
    _sent: list = []
    async def _stub_send(to, subject, html, reply_to=None, headers=None):
        _sent.append({"to": to, "headers": headers}); return True
    _actions.send_email = _stub_send
    try:
        out = await demo_auth.issue_magic(E1, ip="1.2.3.4", ua="vital/1", marketing=True,
                                          company=COMPANY,
                                          text_shown=consent_mod.MARKETING_TEXT_ES)
    finally:
        _actions.send_email = _real_send
    ck("issuance always reports ok (never an existence oracle)", out.get("ok") is True)
    ck("issuance actually mailed the link", len(_sent) == 1 and _sent[0]["to"] == E1)

    # mint one directly so we hold the plaintext, exactly as _send_magic would have mailed it
    import secrets as _s
    tok = _s.token_urlsafe(32)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into demo_magic_links(token_hash, email, ip, consent, text_version, company, "
            "  expires_at) values($1,$2,$3,$4,$5,$6, now() + interval '15 minutes')",
            demo_auth._hash(tok), E1, "1.2.3.4",
            {"marketing": True, "text_shown": consent_mod.MARKETING_TEXT_ES},
            consent_mod.CONSENT_TEXT_VERSION, COMPANY)
        raw_stored = await con.fetchval(
            "select count(*) from demo_magic_links where token_hash = $1", tok)
        hash_stored = await con.fetchval(
            "select count(*) from demo_magic_links where token_hash = $1", demo_auth._hash(tok))
    ck("the raw token is NOT stored", raw_stored == 0)
    ck("sha256(token) IS stored", hash_stored == 1)

    ck("unknown token → None", (await demo_auth.consume_magic("not-a-token")) is None)
    ck("empty token → None (fail-closed)", (await demo_auth.consume_magic("")) is None)

    # single use, proved under CONCURRENCY: the atomic UPDATE must pick exactly one winner
    first, second = await asyncio.gather(demo_auth.consume_magic(tok),
                                         demo_auth.consume_magic(tok))
    winners = [x for x in (first, second) if x is not None]
    ck("two concurrent consumes → exactly ONE winner (single use is the UPDATE, not a check)",
       len(winners) == 1, f"{len(winners)} winners")
    ck("a third consume → None (consumed = expired = unknown, one answer)",
       (await demo_auth.consume_magic(tok)) is None)
    link = winners[0]
    ck("the consumed row carries the email, the consent answer and the company",
       link["email"] == E1 and dict(link["consent"]).get("marketing") is True
       and link["company"] == COMPANY)

    # an EXPIRED link is refused, and refused identically
    tok_old = _s.token_urlsafe(32)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into demo_magic_links(token_hash, email, expires_at) "
            "values($1,$2, now() - interval '1 minute')", demo_auth._hash(tok_old), E1)
    ck("expired token → None", (await demo_auth.consume_magic(tok_old)) is None)

    # ── ③ NEVER PRE-TICKED: issuing a link records NO consent. The click is what evidences it. ─────
    st = await consent_mod.consent_state(E1)
    ck("issuing a link records NO consent row (the mailbox click is the evidence, not the form)",
       st["marketing"] is False)

    # ── ④ sign-in mints EXACTLY ONE workspace ─────────────────────────────────────────────────────
    s1 = await demo_auth.sign_in(E1, ip="1.2.3.4", ua="vital/1", via="magic",
                                 marketing=True, text_shown=consent_mod.MARKETING_TEXT_ES,
                                 text_version=consent_mod.CONSENT_TEXT_VERSION,
                                 company=COMPANY, allow_live=False)
    slug = s1["workspace"]["slug"]
    ck("sign-in provisioned a workspace", s1["workspace"]["created"] is True and bool(slug))
    ck("sign-in minted a real sup_session (the panel's own)",
       bool(s1["session"]["raw"]) and s1["session"]["tenant_slug"] == slug)
    ctx = await sup_session.verify(s1["session"]["raw"])
    ck("that cookie resolves through sup_session.verify → the operator + their tenant",
       bool(ctx) and ctx["actor_email"] == E1 and ctx["tenant_slug"] == slug)

    async with db.get_pool().acquire() as con:
        n_t = await con.fetchval("select count(*) from tenants where slug = $1", slug)
        n_m = await con.fetchval(
            "select count(*) from team_members tm join operators o on o.id = tm.operator_id "
            "where o.email = $1", E1)
        row_t = await con.fetchrow("select name, status, seeded from tenants where slug = $1", slug)
        role = await con.fetchval(
            "select tm.role from team_members tm join operators o on o.id = tm.operator_id "
            "where o.email = $1", E1)
    ck("exactly ONE tenant", n_t == 1)
    ck("exactly ONE owner membership", n_m == 1 and role == "owner")
    ck("the tenant is status='test' (a real workspace, in test mode)", row_t["status"] == "test")
    ck("the tenant is NOT seeded=true (a real person's account is nobody's to reap)",
       not bool(row_t["seeded"]))
    ck("§17.56d③ the tenant is NAMED with the company they typed", row_t["name"] == COMPANY,
       row_t["name"])
    ck("«Demo — tus productos» never reaches an authed workspace",
       row_t["name"] != "Demo — tus productos")

    # ── ⑤ a SECOND sign-in resumes; it never mints a second tenant ────────────────────────────────
    s2 = await demo_auth.sign_in(E1, ip="5.6.7.8", ua="vital/2", via="google",
                                 marketing=None, company="Otro Nombre Distinto SL",
                                 allow_live=True)
    async with db.get_pool().acquire() as con:
        n_t2 = await con.fetchval(
            "select count(*) from team_members tm join operators o on o.id = tm.operator_id "
            "where o.email = $1", E1)
        name2 = await con.fetchval("select name from tenants where slug = $1", slug)
    ck("second sign-in RESUMES the same workspace", s2["workspace"]["slug"] == slug
       and s2["workspace"]["created"] is False)
    ck("still exactly ONE membership (never a second tenant for one operator)", n_t2 == 1)
    ck("a resume does NOT rename a workspace whose name the operator chose", name2 == COMPANY,
       name2)
    ck("the flow session is the SAME one, not a second world",
       s2["flow"]["sid"] == s1["flow"]["sid"])

    # an explicit rename DOES change it (the typo case §17.56d③ names)
    renamed = await provisioning.rename(slug, "  Cárnicas  Aldonza  SL  ")
    ck("an explicit rename corrects the typo", renamed == "Cárnicas Aldonza SL")
    ck("rename refuses an empty name rather than blanking the top bar",
       (await provisioning.rename(slug, "   ")) == "")

    # ── ⑥ the scope/tenant invariant, both worlds ─────────────────────────────────────────────────
    frow = await demo_flow.resolve(s1["flow"]["token"])
    ck("authed session → the OPERATOR's tenant, not a demo_ throwaway",
       demo_flow.tenant_of_row(frow) == slug)
    ck("authed scope resolves back to the same tenant (writer and reader agree)",
       tenancy.tenant_of(demo_flow.scope_of_row(frow)) == slug,
       demo_flow.scope_of_row(frow))
    ck("authed scope keeps the `test.` prefix (lineage=test — a demo never lands in a live queue)",
       demo_flow.scope_of_row(frow).startswith("test."))
    anon = {"sid": "abc123def456", "tenant_slug": None, "operator_email": None}
    ck("anonymous rung UNCHANGED: test.demo.<sid> → demo_<sid>",
       demo_flow.scope_of_row(anon) == "test.demo.abc123def456"
       and tenancy.tenant_of(demo_flow.scope_of_row(anon)) == "demo_abc123def456"
       and demo_flow.tenant_of_row(anon) == "demo_abc123def456")
    ck("a hyphenated slug survives the round trip (PG16 ltree label)",
       tenancy.tenant_of(tenancy.demo_scope("ff00", "casa-vega")) == "casa-vega")

    # ── ⑦ CONSENT IS NOT A GATE ───────────────────────────────────────────────────────────────────
    s3 = await demo_auth.sign_in(E2, ip="9.9.9.9", ua="vital/3", via="magic",
                                 marketing=False, text_shown=consent_mod.MARKETING_TEXT_ES,
                                 company="Distribuciones Refusenik", allow_live=False)
    ck("consent REFUSED → sign-in still succeeds", bool(s3["session"]["raw"]))
    ck("consent REFUSED → a workspace is still provisioned", bool(s3["workspace"]["slug"]))
    ck("consent REFUSED → the demo flow session still exists (upload + chat unaffected)",
       bool(s3["flow"]["token"]))
    view = await demo_flow.session_view(s3["flow"]["token"])
    ck("consent REFUSED → session_view answers normally", bool(view) and view["authed"] is True)
    ck("the refusal is RECORDED as a row, not as an absence "
       "(«we asked and they said no» ≠ «we never asked»)",
       any(h["kind"] == "marketing" and h["granted"] is False
           for h in await consent_mod.history(E2)))

    # ── ⑧ ordering: grant → withdraw → grant, and the latest wins ────────────────────────────────
    await consent_mod.record_consent(E2, "marketing", True, method="panel_switch")
    ck("a later GRANT wins over the earlier refusal",
       (await consent_mod.consent_state(E2))["marketing"] is True)
    await consent_mod.withdraw(E2, "marketing", method="email_unsubscribe")
    ck("a WITHDRAWAL wins over the earlier grant",
       (await consent_mod.consent_state(E2))["marketing"] is False)
    await consent_mod.record_consent(E2, "marketing", True, method="panel_switch")
    ck("and a grant after the withdrawal wins again (latest row, by monotonic id)",
       (await consent_mod.consent_state(E2))["marketing"] is True)
    async with db.get_pool().acquire() as con:
        n_rows = await con.fetchval(
            "select count(*) from consent_events where lower(operator_email) = $1", E2)
    ck("every act left its own row — nothing was overwritten", n_rows >= 4, f"{n_rows} rows")

    # ── ⑨ append-only at the DB level ─────────────────────────────────────────────────────────────
    upd_blocked = del_blocked = False
    async with db.get_pool().acquire() as con:
        try:
            await con.execute("update consent_events set granted = true "
                              "where lower(operator_email) = $1", E2)
        except Exception:
            upd_blocked = True
        try:
            await con.execute("delete from consent_events where lower(operator_email) = $1", E2)
        except Exception:
            del_blocked = True
    ck("consent_events UPDATE blocked (a withdrawal can only ever be a new row)", upd_blocked)
    ck("consent_events DELETE blocked (the trail cannot be tidied away)", del_blocked)

    # ── ⑩ the marketing gate, and the transactional exemption ─────────────────────────────────────
    E3 = f"vital.demo3.{STAMP}@nadie-ha-preguntado.es"
    ck("an address nobody ever asked → marketing REFUSED (no row is not consent)",
       (await consent_mod.may_send_marketing(E3)) is False)
    import brain.drip as drip
    ck("the drip ladder's gate refuses that address", (await drip._consent_ok(E3)) is False)
    await consent_mod.record_consent(E3, "marketing", True, method="signin_checkbox")
    ck("after a grant, the same gate allows it", (await drip._consent_ok(E3)) is True)
    await consent_mod.withdraw(E3, "marketing")
    ck("after a withdrawal, the gate refuses again", (await drip._consent_ok(E3)) is False)

    # TRANSACTIONAL MAIL IGNORES CONSENT — proved behaviourally, not by reading the source.
    import actions as _actions
    seen = {}
    _real = _actions.send_email
    async def _spy(to, subject, html, reply_to=None, headers=None):
        seen["to"] = to; seen["headers"] = headers
        return True
    _actions.send_email = _spy
    try:
        sent = await demo_auth._send_magic(E3, "tok", "es")   # E3 has WITHDRAWN marketing consent
    finally:
        _actions.send_email = _real
    ck("the magic link is sent to an address with NO marketing consent (it is transactional)",
       sent is True and seen.get("to") == E3)
    ck("and it carries NO List-Unsubscribe header (a sign-in link is not bulk mail)",
       not seen.get("headers"))

    # ── ⑪ one-click unsubscribe: signed, withdrawal-only, non-leaking ────────────────────────────
    t = consent_mod.unsubscribe_token(E3)
    ck("the unsubscribe token round-trips", consent_mod.verify_unsubscribe(t) == (E3, "marketing"))
    ck("a tampered token → None", consent_mod.verify_unsubscribe(t[:-3] + "aaa") is None)
    ck("garbage → None (same answer as a forged one)",
       consent_mod.verify_unsubscribe("nope") is None
       and consent_mod.verify_unsubscribe("") is None)
    hdrs = consent_mod.list_unsubscribe_headers(E3)
    ck("RFC 8058: both headers present, or providers ignore the pair",
       "List-Unsubscribe" in hdrs and hdrs.get("List-Unsubscribe-Post") == "List-Unsubscribe=One-Click")
    await consent_mod.record_consent(E3, "marketing", True, method="signin_checkbox")
    email, kind = consent_mod.verify_unsubscribe(t)
    await consent_mod.withdraw(email, kind, method="email_unsubscribe")
    ck("the signed link records a WITHDRAWAL (and can never record a grant)",
       (await consent_mod.may_send_marketing(E3)) is False)

    # ── ⑫ the wording cannot drift: what we serve is what we store ───────────────────────────────
    w = consent_mod.wording()
    ck("the served wording IS the constant the evidence is written from",
       w["text"]["marketing"]["es"] == consent_mod.MARKETING_TEXT_ES
       and w["version"] == consent_mod.CONSENT_TEXT_VERSION)
    h = [x for x in await consent_mod.history(E1) if x["kind"] == "marketing"]
    ck("the stored evidence carries the exact wording shown + its version",
       bool(h) and h[-1]["text_shown"] == consent_mod.MARKETING_TEXT_ES
       and h[-1]["text_version"] == consent_mod.CONSENT_TEXT_VERSION)
    ck("and the method it was given by", bool(h) and h[-1]["method"] == "signin_checkbox")

    # ── ⑬ the live-tenant fence: mailbox control does not open a company that is already running ──
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status = 'live' where slug = $1", slug)
        name_before = await con.fetchval("select name from tenants where slug = $1", slug)
    refused = ""
    try:
        await demo_auth.sign_in(E1, ip="1.2.3.4", ua="vital/4", via="magic",
                                company="Intento De Renombrado", allow_live=False)
    except Exception as ex:
        refused = getattr(ex, "error", "") or type(ex).__name__
    ck("the MAGIC door refuses an operator whose company is LIVE (§5.11.3: Google-only elevation)",
       refused == "oauth_required", refused)
    async with db.get_pool().acquire() as con:
        name_after = await con.fetchval("select name from tenants where slug = $1", slug)
    ck("a refused sign-in changed NOTHING (the fence runs before any write)",
       name_after == name_before, f"{name_before!r} → {name_after!r}")
    g = await demo_auth.sign_in(E1, ip="1.2.3.4", ua="vital/5", via="google", allow_live=True)
    ck("GOOGLE lets that same operator in — to THEIR OWN workspace, never a demo tenant",
       g["workspace"]["slug"] == slug and g["workspace"]["created"] is False
       and g["workspace"]["status"] == "live")
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status = 'test' where slug = $1", slug)

    # ══════════════════════════════════════════════════════════════════════════════════════════════
    # §21/§22 · THE OPEN MINT IS CLOSED, AND THE RESUME IS NOT (Peter, 2026-08-28)
    #
    # «the /entrar demo-mint door CLOSES (existing accounts resume; unknown emails get the closed
    # message, behind a reopenable config switch)». The whole risk of a closure is that it takes
    # more than it was asked for, so this block asserts the two halves of that sentence against the
    # real database — a stranger is refused AND leaves no trace, Carlos signs in unchanged — and
    # then proves the switch itself by reopening the door and watching the mint come back.
    # ══════════════════════════════════════════════════════════════════════════════════════════════
    print("\n§21 the open mint is closed (WEBSITE-COMMERCIAL-MODEL.md §21/§22)")
    STRANGER = f"desconocido.{STAMP}@nadie-vital-{STAMP}.es"
    _open_was = config.DEMO_PROVISION_OPEN
    try:
        config.DEMO_PROVISION_OPEN = False
        refused_by = {}
        for door, live in (("magic", False), ("google", True)):
            try:
                await demo_auth.sign_in(STRANGER, ip="1.2.3.4", ua="vital/21", via=door,
                                        company="Ninguna SL", allow_live=live)
                refused_by[door] = None
            except Exception as ex:
                refused_by[door] = ex
        for door in ("magic", "google"):
            ex = refused_by[door]
            ck(f"§21: the {door} door REFUSES an address that owns no workspace",
               getattr(ex, "error", "") == "demo_closed",
               str(getattr(ex, "error", ex))[:60])
            # FAIL-SOFT, NOT A CRASH: `sup_api._sup_api_handler` ships this as
            # `{ok:false, error, detail}` under the status, which is the grammar demo/api.ts parses.
            ck(f"§21: …as a 403 the client can read, never a 500 ({door})",
               getattr(ex, "status", 0) == 403, str(getattr(ex, "status", 0)))
        ck("§21: the refusal carries Peter's own sentence, verbatim",
           getattr(refused_by["magic"], "detail", "") == demo_auth.closed_sentence("es"),
           str(getattr(refused_by["magic"], "detail", ""))[:70])
        ck("§21: and an English link is answered in English",
           demo_auth.closed_sentence("en") != demo_auth.closed_sentence("es")
           and demo_auth.closed_sentence("en").startswith("The open demo has closed."))
        # A REFUSAL MUST CHANGE NOTHING — the same law the live-tenant fence follows. If the check
        # had been made on what `resume_or_provision` RETURNS, the world would already exist.
        async with db.get_pool().acquire() as con:
            n_op = await con.fetchval(
                "select count(*) from operators where lower(email) = $1", STRANGER)
            n_tm = await con.fetchval(
                "select count(*) from team_members tm join operators o on o.id = tm.operator_id "
                "where lower(o.email) = $1", STRANGER)
        ck("§21: a refused sign-in left NOTHING behind — no operator seat, no membership, no world",
           n_op == 0 and n_tm == 0, f"operators={n_op} memberships={n_tm}")

        # THE DOOR ANSWERS EVERYBODY THE SAME, AND MAILS THEM DIFFERENT TRUTHS. Issuance must stay
        # the non-leaking 200 it has always been (portal.py's law), and the mail must stop promising
        # «Ya puedes entrar en Rocoto» to somebody the sign-in is about to refuse.
        _real_send21 = _actions.send_email
        posted: list = []

        async def _spy21(to, subject, html, reply_to=None, headers=None, **kw):
            posted.append({"to": to, "subject": subject, "html": html})
            return True

        _actions.send_email = _spy21
        try:
            out_closed = await demo_auth.issue_magic(STRANGER, ip="1.2.3.4", ua="vital/21",
                                                     marketing=False, company="Ninguna SL")
            out_known = await demo_auth.issue_magic(E1, ip="1.2.3.5", ua="vital/21",
                                                    marketing=False)
        finally:
            _actions.send_email = _real_send21
        ck("§21: issuance answers the SAME ok for a known and an unknown address "
           "(never an existence oracle)",
           out_closed.get("ok") is True and out_known.get("ok") is True,
           f"{out_closed} / {out_known}")
        ck("§21: …and mails the CLOSURE, not a single-use link nobody could use",
           len(posted) == 2 and posted[0]["subject"] == demo_auth._CLOSED_MAIL["es"]["subject"]
           and "/demo/entrar?t=" not in posted[0]["html"], str(posted[0]["subject"]))
        ck("§21: …carrying the door out to the Plans story",
           demo_auth._PLANS_URL in posted[0]["html"])
        ck("§21: an address that HAS a workspace still gets its sign-in link",
           posted[1]["to"] == E1 and "/demo/entrar?t=" in posted[1]["html"],
           posted[1]["subject"])

        # THE OTHER HALF, AND IT IS THE ONE THAT MATTERS ON A LIVE PRODUCT: an address that already
        # owns a workspace signs in exactly as it did the day before, with the door shut.
        r21 = await demo_auth.sign_in(E1, ip="1.2.3.4", ua="vital/21b", via="magic",
                                      allow_live=False)
        ck("§21: an operator who ALREADY has a workspace resumes with the door closed "
           "(«maybe somehow keep it live for Carlos»)",
           r21["workspace"]["slug"] == slug and r21["workspace"]["created"] is False,
           str(r21["workspace"].get("slug")))
        ck("§21: …and it is a real session and a real flow, not a consolation screen",
           bool(r21["session"]["raw"]) and bool(r21["flow"]["token"]))
        ck("§21: …resumed into the SAME flow session, so nothing they had is lost",
           r21["flow"]["sid"] == s1["flow"]["sid"])

        # AND THE SWITCH IS REAL, not a constant somebody would have to edit and deploy to move.
        config.DEMO_PROVISION_OPEN = True
        reopened = await demo_auth.sign_in(STRANGER, ip="1.2.3.4", ua="vital/21c", via="magic",
                                           company="Reapertura Vital SL", allow_live=False)
        ck("§21: DEMO_PROVISION_OPEN=1 reopens the mint — a fair or a push costs a restart, "
           "never a code change", reopened["workspace"]["created"] is True,
           str(reopened["workspace"].get("created")))
    finally:
        config.DEMO_PROVISION_OPEN = _open_was
    # the reopened world is this block's own litter
    async with db.get_pool().acquire() as con:
        await con.execute("update sup_session set revoked_at = now() where actor_email = $1",
                          STRANGER)
        await con.execute("delete from demo_sessions where lower(operator_email) = $1", STRANGER)
        await con.execute("delete from demo_magic_links where lower(email) = $1", STRANGER)
        litter = await con.fetch(
            "select tm.tenant_slug from team_members tm join operators o on o.id = tm.operator_id "
            "where lower(o.email) = $1", STRANGER)
        await con.execute("delete from team_members tm using operators o "
                          "where o.id = tm.operator_id and lower(o.email) = $1", STRANGER)
        await con.execute("delete from operators where lower(email) = $1", STRANGER)
        for r in litter:
            await con.execute("delete from tenants where slug = $1", r["tenant_slug"])

    # ══════════════════════════════════════════════════════════════════════════════════════════════
    # ⑭ THE 2026-08-09 SECURITY REMEDIATION. One block per finding in the adversarial review, each
    #    asserting that the ATTACK now fails — not that the fix is present.
    # ══════════════════════════════════════════════════════════════════════════════════════════════
    print("\n⑭ security remediation (F1 · F2 · F3 · F4 · F5 · F7 · F8 · F10 · F11)")
    import app as _app  # noqa: E402 — the routes' gates live here
    import sup_api as _sa  # noqa: E402
    from brain import skuparse as _sk  # noqa: E402
    from brain import teams as _teams  # noqa: E402

    # ── F1 · THE OPERATOR-ID COLLISION. Two DIFFERENT companies, the SAME local part. ────────────
    LOCAL = f"pedidos{STAMP}"
    A = f"{LOCAL}@evil-vital-{STAMP}.tld"           # the attacker's own domain
    B = f"{LOCAL}@carnicas-vital-{STAMP}.es"        # the victim's real one
    async with db.get_pool().acquire() as con:
        pa = await provisioning.provision(con, A, company="Squatter SL")
        pb = await provisioning.provision(con, B, company="Cárnicas Reales SL")
    ck("F1: two addresses sharing a local part get DIFFERENT operator ids "
       "(the derivation no longer discards the domain)",
       pa["op_id"] != pb["op_id"], f"{pa['op_id']} vs {pb['op_id']}")
    ck("F1: and DIFFERENT workspaces", pa["slug"] != pb["slug"])
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select o.email, tm.tenant_slug from team_members tm "
            "join operators o on o.id = tm.operator_id where o.email = any($1) "
            "order by o.email", [A, B])
        a_at = await con.fetchval("select active_tenant from operators where email = $1", A)
    memb = {r["email"]: r["tenant_slug"] for r in rows}
    ck("F1: the memberships are DISJOINT — neither address is an owner in the other's workspace",
       len(rows) == 2 and memb.get(A) == pa["slug"] and memb.get(B) == pb["slug"], str(memb))
    ck("F1: provisioning the second address did NOT repoint the first one's active_tenant "
       "(the `on conflict (id) do update` that handed over the row is gone)",
       a_at == pa["slug"], f"{a_at!r}")

    # the founder seat, which `ensure_seed` mints on every boot and `coalesce` cannot repair
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into operators(id, email, name, is_founder, active_tenant) "
            "values('op_peter', $1, 'Peter', true, 'rocoto') on conflict (id) do nothing",
            f"founder.vital.{STAMP}@leo.casa")
        seat_before = await con.fetchval(
            "select active_tenant from operators where id = 'op_peter'")
        PETER = f"peter@atacante-vital-{STAMP}.tld"
        p3 = await provisioning.provision(con, PETER, company="No Soy Peter SL")
        seat_after = await con.fetchval(
            "select active_tenant from operators where id = 'op_peter'")
        squat = await con.fetchval(
            "select count(*) from team_members where operator_id = 'op_peter' "
            "and tenant_slug = $1", p3["slug"])
    ck("F1: registering `peter@<anything-i-own>` does NOT seize the founder seat",
       p3["op_id"] != "op_peter", p3["op_id"])
    ck("F1: the founder's active_tenant is untouched", seat_after == seat_before,
       f"{seat_before!r} → {seat_after!r}")
    ck("F1: and no founder membership was minted in the attacker's tenant", squat == 0)

    # an EXISTING id under a DIFFERENT email must RAISE, never silently update
    raised = ""
    async with db.get_pool().acquire() as con:
        try:
            async with con.transaction():
                await con.execute(
                    "insert into operators(id, email, name) values($1,$2,'x')",
                    pa["op_id"], f"otro.{STAMP}@ninguna-parte.tld")
        except Exception as ex:
            raised = type(ex).__name__
    ck("F1: the operators PK still refuses a second row under an existing id "
       "(so a mint collision raises rather than taking over)", bool(raised), raised)

    ck("F1: the minted id carries the unguessable tail brain/teams._mint_id exists for",
       pa["op_id"].startswith(f"op_{LOCAL}"[:23]) and len(pa["op_id"].rsplit("_", 1)[-1]) == 6,
       pa["op_id"])
    ck("F1: and it is the SAME minting function, not a third scheme",
       _teams._mint_id("x@y.z").startswith("op_x_"))

    # membership_of is DETERMINISTIC now (earliest membership, matching resolve_membership)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into team_members(operator_id, tenant_slug, role, created_at) "
            "values($1,$2,'staff', now() + interval '1 hour')", pa["op_id"], pb["slug"])
        picks = {await provisioning.membership_of(con, A) for _ in range(6)}
        await con.execute("delete from team_members where operator_id=$1 and tenant_slug=$2",
                          pa["op_id"], pb["slug"])
    ck("F1: `membership_of` is deterministic — the EARLIEST membership, every time",
       picks == {pa["slug"]}, str(picks))

    # ── F2 · THE ANONYMOUS DOOR IS GONE, not gated ───────────────────────────────────────────────
    ck("F2: demo_flow.create_session no longer exists",
       not hasattr(demo_flow, "create_session"))
    ck("F2: demo_flow.set_email (the resume mail) no longer exists",
       not hasattr(demo_flow, "set_email"))
    ck("F2: demo_flow._send_magic_link no longer exists",
       not hasattr(demo_flow, "_send_magic_link"))
    routes = {getattr(r, "path", "") for r in _app.app.routes}
    ck("F2: POST /api/demo/session is not routed at all",
       "/api/demo/session" not in routes)
    ck("F2: POST /api/demo/session/{token}/email is not routed at all",
       "/api/demo/session/{token}/email" not in routes)
    refused = ""
    try:
        await demo_flow.session_for_operator("", "")
    except Exception as ex:
        refused = type(ex).__name__
    ck("F2: the ONE remaining mint fails closed without an operator AND a tenant",
       refused == "ValueError", refused)

    # ── F3 · LOGIN CSRF: the consume is bound to the browser that asked ──────────────────────────
    NONCE = _s.token_urlsafe(24)
    tok_n = _s.token_urlsafe(32)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into demo_magic_links(token_hash, email, nonce_hash, expires_at) "
            "values($1,$2,$3, now() + interval '15 minutes')",
            demo_auth._hash(tok_n), E1, demo_auth._hash(NONCE))
    ck("F3: consuming WITHOUT the requester nonce is refused "
       "(the cross-site form has no way to send it)",
       (await demo_auth.consume_magic(tok_n, "")) is None)
    ck("F3: consuming with the WRONG nonce is refused",
       (await demo_auth.consume_magic(tok_n, _s.token_urlsafe(24))) is None)
    async with db.get_pool().acquire() as con:
        still_live = await con.fetchval(
            "select consumed_at is null from demo_magic_links where token_hash = $1",
            demo_auth._hash(tok_n))
    ck("F3: and a refused attempt did NOT burn the link — the victim's pending sign-in survives "
       "(the nonce is in the WHERE, not in an `if` after it)", still_live is True)
    got = await demo_auth.consume_magic(tok_n, NONCE)
    ck("F3: the browser that asked for it gets in", got is not None and got["email"] == E1)
    ck("F3: and only once", (await demo_auth.consume_magic(tok_n, NONCE)) is None)

    class _Req:
        def __init__(self, headers=None, peer="127.0.0.1", cookies=None):
            self.headers = headers or {}
            self.cookies = cookies or {}
            self.client = type("C", (), {"host": peer})()
    ck("F3: a cross-site form POST is refused on Sec-Fetch-Site alone",
       not demo_auth._same_site_post(_Req({"sec-fetch-site": "cross-site",
                                           "origin": "https://evil.tld"})))
    ck("F3: an Origin we do not own is refused when the browser sends no Sec-Fetch-Site",
       not demo_auth._same_site_post(_Req({"origin": "https://evil.tld"})))
    ck("F3: a request with NEITHER header (curl, a DLP proxy replaying a scraped link) is refused",
       not demo_auth._same_site_post(_Req({})))
    ck("F3: our own SPA's same-origin POST is allowed",
       demo_auth._same_site_post(_Req({"sec-fetch-site": "same-origin"}))
       and demo_auth._same_site_post(_Req({"origin": "https://app.soyrocoto.com"})))

    # ── F4 · CAPABILITY + THE status='test' FENCE ────────────────────────────────────────────────
    ck("F4: a repartidor holds `deliver` and NOTHING the demo writes need",
       sup_session.can("repartidor", "deliver")
       and not sup_session.can("repartidor", "read")
       and not sup_session.can("repartidor", "act")
       and not sup_session.can("repartidor", "admin:rocoto"))
    fenced_slug = pb["slug"]
    frow2 = await demo_flow.session_for_operator(B, fenced_slug)
    row2 = await demo_flow.resolve(frow2["token"])
    await demo_api._demo_test_world(row2)                      # test tenant → passes
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status='live' where slug=$1", fenced_slug)
    code = 0
    try:
        await demo_api._demo_test_world(row2)
    except Exception as ex:
        code = getattr(ex, "status_code", 0)
    ck("F4: a LIVE tenant is fenced off the demo surface entirely (409)", code == 409, str(code))
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status='test' where slug=$1", fenced_slug)

    # the cookie gate refuses a cap the role does not hold, and refuses no-cookie outright
    async def _gate(cap, ctx_role=None, method="POST", csrf_ok=True):
        real = sup_session.verify
        if ctx_role is not None:
            async def _fake(_raw, rotate=False):
                return {"session_id": "s", "actor_email": B, "tenant_slug": fenced_slug,
                        "role": ctx_role, "csrf": "CSRF", "fresh_raw": None, "remaining": 9}
            sup_session.verify = _fake
        try:
            req = _Req({"x-sup-csrf": "CSRF" if csrf_ok else "nope"},
                       cookies={_sa.SUP_COOKIE: "x.y"})
            req.method = method
            return await demo_api._demo_cookie(req, cap)
        except Exception as ex:
            return getattr(ex, "status_code", 0)
        finally:
            sup_session.verify = real
    ck("F4: no cookie → 401, before the token is even resolved", (await _gate("read")) == 401)
    ck("F4: a repartidor is refused `read` on the demo (403)",
       (await _gate("read", "repartidor")) == 403)
    ck("F4: a repartidor is refused the catalogue write (403)",
       (await _gate("admin:rocoto", "repartidor")) == 403)
    ck("F4: an owner passes", isinstance(await _gate("admin:rocoto", "owner"), dict))
    ck("F4: a missing CSRF header still refuses an owner's write (403)",
       (await _gate("admin:rocoto", "owner", csrf_ok=False)) == 403)
    ck("F4: the commit route no longer honours a client-supplied `override` "
       "(the count guard is not the caller's to waive)",
       "override_guard=False" in inspect.getsource(demo_api.demo_catalog_commit))

    # ── F5 · THE PARSE IS OFF THE EVENT LOOP, AND THE EXCEL WALK IS BOUNDED ──────────────────────
    ck("F5: the blocking extraction is a separate SYNC function the coroutine threads out",
       callable(getattr(_sk, "_extract_file_sync", None)))
    import tempfile as _tf
    big = "\n".join(f"COD{i};Producto vital {i};kg;{1 + i % 9},50" for i in range(60000))
    with _tf.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as fh:
        fh.write("codigo;nombre;unidad;precio\n" + big)
        big_path = fh.name
    _real_many = _sk._extract_many_sync
    # offline: no model, and no heuristic rescue either. `_extract_many_sync` now answers
    # (rows, batches that ran out of answer room), so the stub answers in that shape.
    _sk._extract_many_sync = lambda header, chunks: ([], 0)
    lag = 0.0
    try:
        async def _heartbeat():
            nonlocal lag
            while True:
                t0 = time.monotonic()
                await asyncio.sleep(0.01)
                lag = max(lag, time.monotonic() - t0)
        hb = asyncio.create_task(_heartbeat())
        parsed = await _sk.parse_catalogue(big_path, "tarifa.csv")
        hb.cancel()
    finally:
        _sk._extract_many_sync = _real_many
        os.unlink(big_path)
    # WITH THE MODEL STUBBED OUT, THE ANSWER IS AN HONEST FAILURE — and that is the assertion now
    # (2026-08-09). This line used to read «a 60 000-row file still parses» and passed on the
    # HEURISTIC column scan, which is exactly the path that shipped `name="35", price=40.00` from a
    # price-less PDF. `_finish` discards those rows and says so instead, so a green here would mean
    # the fabrication path had come back. What F5 is really about — the event loop — is the next line.
    ck("F5: a 60 000-row file read with no model available FAILS honestly (never heuristic rows)",
       parsed.get("ok") is False and not parsed.get("skus"), str(parsed.get("error"))[:60])
    ck("F5: and the event loop stayed responsive while it did "
       "(max scheduling lag under 500 ms — this used to block for the whole parse)",
       lag < 0.5, f"{lag*1000:.0f} ms")
    ck("F5: the excel walk has a row ceiling and a cell ceiling",
       _sk._EXCEL_MAX_ROWS > 0 and _sk._EXCEL_MAX_CELLS > 0)
    _rows_cap, _cells_cap = _sk._EXCEL_MAX_ROWS, _sk._EXCEL_MAX_CELLS
    try:
        _sk._EXCEL_MAX_ROWS = 5
        import openpyxl as _ox
        from openpyxl import Workbook as _WB
        wb = _WB(); ws = wb.active
        for i in range(40):
            ws.append([f"C{i}", f"Producto {i}", "kg", 1.5])
        buf = io.BytesIO(); wb.save(buf)
        warns: list = []
        m = _sk._excel_matrix(buf.getvalue(), warns)
        ck("F5: an oversized sheet is CLIPPED at the ceiling", m is not None and len(m) == 5,
           str(len(m or [])))
        ck("F5: and the clip is ANNOUNCED, never silent (§5.10.2)",
           any(w.get("code") == "excel_clipped" for w in warns), str(warns))
    except ImportError:
        ck("F5: openpyxl absent — excel ceiling not exercised here", True, "skipped")
    finally:
        _sk._EXCEL_MAX_ROWS, _sk._EXCEL_MAX_CELLS = _rows_cap, _cells_cap
    from brain import onboarding as _ob
    ck("F5: concurrent parses are bounded by a semaphore",
       _ob._intake_gate()._value <= _ob._INTAKE_CONCURRENCY and _ob._INTAKE_CONCURRENCY >= 1,
       str(_ob._INTAKE_CONCURRENCY))

    # ── F7 · X-Forwarded-For is only believed from a trusted hop, and never leftmost ─────────────
    ck("F7: a forged XFF from an UNTRUSTED peer is ignored — the socket peer wins",
       _sa._client_ip(_Req({"x-forwarded-for": "6.6.6.6", "x-real-ip": "9.9.9.9"},
                           peer="203.0.113.7")) == "203.0.113.7")
    ck("F7: from the trusted hop, the RIGHTMOST entry (the one the proxy appended) is taken — "
       "never the leftmost, which is the only one a client can write",
       _sa._client_ip(_Req({"x-forwarded-for": "6.6.6.6, 198.51.100.4"},
                           peer="127.0.0.1")) == "198.51.100.4")
    ck("F7: X-Real-IP is the fallback from the trusted hop (Caddy SETS it)",
       _sa._client_ip(_Req({"x-real-ip": "198.51.100.9"}, peer="127.0.0.1")) == "198.51.100.9")
    ck("F7: and with no forwarded headers at all, the peer",
       _sa._client_ip(_Req({}, peer="127.0.0.1")) == "127.0.0.1")
    ck("F7: app.py's twin is the SAME function, not a second copy",
       _app._client_ip(_Req({"x-forwarded-for": "6.6.6.6"}, peer="203.0.113.7")) == "203.0.113.7")

    # ── F8 · THE REAPER EXISTS AND ACTUALLY DELETES ──────────────────────────────────────────────
    DEAD_SID = "deadbeef" + STAMP.rjust(6, "0")[:6] + "aa"
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into demo_sessions(token,sid,operator_email,tenant_slug,expires_at) "
            "values($1,$2,$3,$4, now() - interval '1 day')",
            "dead-" + STAMP, DEAD_SID, E2, pb["slug"])
        await con.execute(
            "insert into demo_magic_links(token_hash,email,expires_at) "
            "values($1,$2, now() - interval '3 days')", "deadhash" + STAMP, E2)
        await con.execute(
            "insert into tenants(slug,name,status,seeded,created_at) "
            "values($1,'Demo — tus productos','test',true, now() - interval '90 days') "
            "on conflict (slug) do nothing", "demo_" + DEAD_SID)
    # THE UPLOADED PRICE LIST ON DISK — the most sensitive bytes this feature touches, and the ones
    # the published retention sentence is actually about (punch list P0#3: `voice_reply._sweep_dir`
    # does not recurse and MEDIA_DIR/intake IS a subdirectory, so these lived forever).
    # A PRIVATE INTAKE DIR FOR THIS RUN. `MEDIA_DIR` belongs to the BOX, not to the clone, so a
    # vital that wrote (or swept) the real `/opt/rocoto/media/intake` would be deleting production
    # bytes to prove a point. Redirected for the whole F8 block and restored below.
    import tempfile as _tf2
    from pathlib import Path as _P3

    from brain import onboarding as _ob2
    _real_intake_dir = _ob2._INTAKE_DIR
    _ob2._INTAKE_DIR = _P3(_tf2.mkdtemp(prefix="vital-intake-"))
    await _ob2.ensure_intake_schema()
    made = await _ob2.create_intake(pb["slug"], "vital", source_kind="paste",
                                    source_name="tarifa.txt",
                                    text="Chorizo picante;9,50\nQueso curado;12,00")
    iid = made.get("id") or ""
    async with db.get_pool().acquire() as con:
        ref = await con.fetchval("select raw_ref from catalogue_intake where id=$1", iid)
        await con.execute("update catalogue_intake set expires_at = now() - interval '1 day' "
                          "where id=$1", iid)
    from pathlib import Path as _P2
    bytes_dir = _P2(ref).parent if ref else None
    ck("F8: the uploaded bytes really are on disk before the sweep",
       bool(bytes_dir) and bytes_dir.is_dir(), str(bytes_dir))

    reaped = await demo_flow.reap(sweep_orphans=True)
    ck("F8: an EXPIRED intake row is reaped", reaped.get("intakes", 0) >= 1, str(reaped))
    ck("F8: and its RAW BYTES are unlinked from MEDIA_DIR/intake — the tarifa does not outlive "
       "the row that pointed at it", bool(bytes_dir) and not bytes_dir.exists(), str(bytes_dir))
    async with db.get_pool().acquire() as con:
        left_s = await con.fetchval("select count(*) from demo_sessions where sid=$1", DEAD_SID)
        left_l = await con.fetchval(
            "select count(*) from demo_magic_links where token_hash=$1", "deadhash" + STAMP)
        left_t = await con.fetchval("select count(*) from tenants where slug=$1",
                                    "demo_" + DEAD_SID)
        kept = await con.fetchval("select count(*) from tenants where slug=$1", pb["slug"])
    ck("F8: an EXPIRED session is reaped", left_s == 0, str(reaped))
    ck("F8: a long-dead magic link is reaped", left_l == 0)
    ck("F8: an orphan anonymous demo_ tenant is reaped", left_t == 0)
    ck("F8: a REAL provisioned workspace is NOT (seeded=false is what protects it)", kept == 1)
    async with db.get_pool().acquire() as con:
        aud = await con.fetch(
            "select action, target_id from sup_audit where action like 'demo.reap%' "
            "order by ts desc limit 5")
    ck("F8: every drop leaves an audit row — «did you delete it?» has an answer that is not "
       "a log line somebody rotated away",
       any(r["action"] == "demo.reap.tenant" and r["target_id"] == "demo_" + DEAD_SID for r in aud)
       and any(r["action"] == "demo.reap" for r in aud),
       str([(r["action"], r["target_id"]) for r in aud]))
    prev = await demo_flow.reap_preview()
    # `worlds` joined the shape on 2026-08-09: the dry run now NAMES the tenants it would drop, not
    # just how many. A count is not something a human can check before pressing a button that
    # deletes workspaces — see tests/vital_demo_reap.py, which asserts the named set exactly.
    ck("F8: the dry-run counter answers without deleting (`demo_reap --dry-run`)",
       isinstance(prev, dict)
       and set(prev) == {"sessions", "links", "intakes", "orphan_dirs", "tenants", "worlds"},
       str(prev))
    ck("F8: …and it NAMES the worlds it would take (a count is not checkable by a human)",
       isinstance(prev.get("worlds"), list) and len(prev["worlds"]) == prev["tenants"],
       str(prev.get("worlds"))[:120])

    # ORPHAN BYTES — a directory no row names. Measured on prod: 76 of them, against a
    # `catalogue_intake` table that does not exist in that database, so a row-driven sweep could
    # never have reached them. This is the leak the published retention sentence is about.
    orphan = _ob2._INTAKE_DIR / f"ing_vitalorphan{STAMP}"
    orphan.mkdir(parents=True, exist_ok=True)
    (orphan / "tarifa.txt").write_text("Chorizo;9,50", encoding="utf-8")
    old = time.time() - (int(_ob2.INTAKE_TTL_DAYS) + 2) * 86400
    os.utime(orphan, (old, old))
    n_before = (await demo_flow.reap_preview()).get("orphan_dirs", 0)
    ck("F8: the preview COUNTS an orphan directory", n_before >= 1, str(n_before))
    fresh = _ob2._INTAKE_DIR / f"ing_vitalfresh{STAMP}"
    fresh.mkdir(parents=True, exist_ok=True)
    await demo_flow.reap()
    ck("F8: the DEFAULT sweep leaves orphan bytes alone — a reaper pointed at a clone must never "
       "conclude that production's intake is unreferenced", orphan.exists())
    await demo_flow.reap(sweep_orphans=True)
    ck("F8: the opt-in sweep deletes it — bytes with no row are still somebody's price list",
       not orphan.exists(), str(orphan))
    ck("F8: a RECENT orphan survives it (an intake mid-parse must not be swept out from under it)",
       fresh.exists())
    import shutil as _sh2
    _sh2.rmtree(_ob2._INTAKE_DIR, ignore_errors=True)
    _ob2._INTAKE_DIR = _real_intake_dir

    # ── F10 · the rate-limit store is bounded on an attacker-chosen key ──────────────────────────
    _saved_rl = dict(sup_session._RL)
    sup_session._RL.clear()
    try:
        for i in range(sup_session._RL_MAX + 800):
            sup_session.rate_ok(f"demomagic:email:flood{i}@x.tld", 3, 900)
        ck("F10: the store never grows past its cap, whatever the caller names",
           len(sup_session._RL) <= sup_session._RL_MAX, f"{len(sup_session._RL)} buckets")
    finally:
        sup_session._RL.clear()
        sup_session._RL.update(_saved_rl)

    # and the ORDER: a saturated global must short-circuit before the email bucket is allocated
    sup_session._RL.pop("demomagic:GLOBAL", None)
    for _ in range(demo_auth.MAGIC_GLOBAL):
        sup_session.rate_ok("demomagic:GLOBAL", demo_auth.MAGIC_GLOBAL, demo_auth.MAGIC_IP_WINDOW_S)
    FLOOD = f"flood.{STAMP}@nadie.tld"
    out_t = await demo_auth.issue_magic(FLOOD, ip="1.1.1.1", ua="v", marketing=False,
                                        company="X SL")
    ck("F10: past the global ceiling, issuance is throttled…",
       out_t.get("throttled") is True)
    ck("F10: …and the attacker's address never allocated a bucket",
       f"demomagic:email:{FLOOD}" not in sup_session._RL)
    sup_session._RL.pop("demomagic:GLOBAL", None)

    # ── F11 · the absolute 24h spend ceiling ─────────────────────────────────────────────────────
    _cap = config.DEMO_SPEND_DAILY_CAP
    try:
        config.DEMO_SPEND_DAILY_CAP = 2
        demo_flow._SPENT_AT.clear()
        ck("F11: room at the start", demo_flow.spend_ok("llm"))
        demo_flow.spend_record("llm"); demo_flow.spend_record("llm")
        ck("F11: the ceiling REFUSES past the cap, whatever the session or the IP",
           not demo_flow.spend_ok("llm"))
        ck("F11: and the budgets are per-kind, so photos cannot starve the chat",
           demo_flow.spend_ok("media"))
    finally:
        config.DEMO_SPEND_DAILY_CAP = _cap
        demo_flow._SPENT_AT.clear()

    # ── F9 · the consent wording the SPA reads is the shape the backend serves ───────────────────
    w = consent_mod.wording()
    ck("F9: /config serves {version, text.marketing.<lang>} — the shape webapp/src/demo/api.ts "
       "`readConsentText` now parses (it read `text` as a string and `text_version` as a key, "
       "so it returned null on every path and the checkbox never rendered)",
       isinstance(w.get("version"), str) and w["version"]
       and isinstance(w.get("text"), dict)
       and isinstance(w["text"].get("marketing"), dict)
       and isinstance(w["text"]["marketing"].get("es"), str)
       and w["text"]["marketing"]["es"].strip() != "")
    _spa = _BACKEND.parent / "webapp" / "src" / "demo"
    if _spa.is_dir():
        srcs = {f.name: f.read_text(encoding="utf-8") for f in _spa.glob("*.tsx")}
        srcs.update({f.name: f.read_text(encoding="utf-8") for f in _spa.glob("*.ts")})
        blob = "\n".join(srcs.values())
        ck("F9: the misspelled `datos-y-seguridad.html` is gone from the SPA "
           "(the page is /datos-seguridad.html, as every other page in the repo links)",
           "datos-y-seguridad" not in blob)
        sis = srcs.get("SignInScreen.tsx", "")
        ck("F9: the privacy + security links render OUTSIDE the `{consent && …}` block, so a "
           "stranger sees them whether or not a checkbox does (Art. 13 at the moment of collection)",
           sis.count("datos-seguridad.html") >= 2
           and sis.rfind("{consent && (") < sis.find('className="dm-consent__foot"'))
        # CODE, not prose: api.ts explains the deletions in a comment, and a check that trips on
        # its own changelog would push the next person to delete the explanation.
        code = "\n".join(ln for ln in blob.splitlines()
                         if not ln.lstrip().startswith(("//", "*", "/*")))
        ck("F9: nothing in the SPA mints an anonymous session, stores a token, or reads `?s=`",
           "function ensureSession" not in code and "ensureSession(" not in code
           and "adoptToken" not in code and "call('/session'," not in code
           and "rocoto_demo_s" not in code and "get('s')" not in code)
        ck("F9: and the magic link has a landing route that actually POSTs the verify door",
           "postMagicVerify" in blob)
    else:
        ck("F9: SPA sources not present next to the backend — static checks skipped", True,
           "skipped")

    # ── cleanup for ⑭'s own rows ─────────────────────────────────────────────────────────────────
    async with db.get_pool().acquire() as con:
        for e_ in (A, B, PETER, FLOOD):
            await con.execute("update sup_session set revoked_at = now() where actor_email = $1", e_)
            await con.execute("delete from demo_sessions where lower(operator_email) = $1", e_)
            await con.execute("delete from demo_magic_links where lower(email) = $1", e_)
        gone = await con.fetch(
            "select tm.tenant_slug from team_members tm join operators o on o.id = tm.operator_id "
            "where o.email = any($1)", [A, B, PETER])
        await con.execute("delete from team_members tm using operators o "
                          "where o.id = tm.operator_id and o.email = any($1)", [A, B, PETER])
        await con.execute("delete from operators where email = any($1)", [A, B, PETER])
        for r in gone:
            await con.execute("delete from tenants where slug = $1", r["tenant_slug"])

    # ── cleanup: sessions + the provisioned test worlds. consent_events is append-only BY DESIGN
    # (like cr_audit) and is left behind; the rehearsal clone is ephemeral.
    async with db.get_pool().acquire() as con:
        await con.execute("update sup_session set revoked_at = now() where actor_email = any($1)",
                          [E1, E2])
        await con.execute("delete from demo_magic_links where lower(email) = any($1)", [E1, E2])
        await con.execute("delete from demo_sessions where lower(operator_email) = any($1)", [E1, E2])
        slugs = await con.fetch(
            "select tm.tenant_slug from team_members tm join operators o on o.id = tm.operator_id "
            "where o.email = any($1)", [E1, E2])
        await con.execute("delete from team_members tm using operators o "
                          "where o.id = tm.operator_id and o.email = any($1)", [E1, E2])
        await con.execute("delete from operators where email = any($1)", [E1, E2])
        for r in slugs:
            await con.execute("delete from tenants where slug = $1", r["tenant_slug"])

    print(f"\nvital_demo_auth: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
