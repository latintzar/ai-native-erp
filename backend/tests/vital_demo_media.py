"""vital_demo_media.py — §17.56 build-order ⑤: /demo HEARS, SEES, and HANDS OFF TO A PHONE.

The floor under the three inputs a stranger actually uses. Asserts, against a real DB, with the
TRANSCRIBERS STUBBED (a vital must not spend Deepgram credit or depend on a network to prove wiring)
but the MIND REAL — because the one claim worth proving here is about the mind's output:

  ① THE PURE GUARDS, with nothing running: magic-byte sniffing (the declared type is a claim, the
     bytes are the evidence), the duration reader, the phone token's signature round trip, its
     tamper and expiry answers, and its REDUCED CAPABILITY SET as a set, not as a comment.
  ② THE PHONE CREDENTIAL against the DB: mint · reuse · rotate · claim-on-first-open · the sliding
     window under the hard cap · revoke — and ONE answer for unknown ≡ forged ≡ expired ≡ revoked.
  ③ A VOICE NOTE PRODUCES THE ORDER A TYPED SENTENCE PRODUCES. Two sessions, one catalogue, the same
     words — one typed, one spoken. Same lines, or the demo is lying about what it is showing.
  ④ A PHOTO PRODUCES LINES + «Para revisar». The off-catalogue item is HELD, not guessed.
  ⑤ THE FENCES: an oversized upload is refused before the body is read AND before the transcriber is
     touched; a phone token is not a session token and a session token is not a phone token; a phone
     token cannot write settings; an expired phone token is refused indistinguishably from garbage.
  ⑥ A DEMO MEDIA TURN CANNOT EGRESS: run_turn is called with egress_stub=True on a `test.` scope
     that resolves to THIS session's tenant (never BRAIN_TENANT), and the event row it writes is
     lineage='test'.
  ⑦ RETRIES ARE IDEMPOTENT: the same client_id replays the stored answer — no second transcription,
     no second turn, no second order on the visitor's screen.

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal.
Run on prod as root:  REHEARSAL_DSN=… PYTHONPATH=. venv/bin/python tests/vital_demo_media.py
"""
import asyncio
import io
import os
import secrets
import struct
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import config  # noqa: E402
import db  # noqa: E402
import demo_flow  # noqa: E402
import demo_media  # noqa: E402
import demo_phone  # noqa: E402
import runtime  # noqa: E402
import tenancy  # noqa: E402
import transcribe as tx  # noqa: E402
from brain import golive  # noqa: E402

TEN = "vitaldemomedia"             # ltree label — hex/letters only, no hyphen
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


SKUS = [
    {"code": "CH-01", "name": "Chorizo picante casero", "family": "embutidos", "unit": "kg", "price": 9.5},
    {"code": "QM-02", "name": "Queso manchego curado", "family": "quesos", "unit": "ud", "price": 12.0},
    {"code": "TS-03", "name": "Tomate seco en aceite", "family": "conservas", "unit": "caja", "price": 4.0},
]

# The SAME words, typed and spoken. Catalogue names verbatim so the comparison in ③ measures the
# INPUT RAIL and not the matcher's tolerance for nicknames (that is vital_codes' job, not this one).
SENTENCE = "ponme 3 kg de chorizo picante casero y 2 cajas de tomate seco en aceite"
PHOTO_TEXT = ("PEDIDO VIERNES\n"
              "4 kg chorizo picante casero\n"
              "1 caja tomate seco en aceite\n"
              "2 kg percebes")          # the last line is off-catalogue → «Para revisar»


# ── fixtures a browser could actually send ────────────────────────────────────────────────────────

def wav_bytes(seconds: float = 3.0, rate: int = 8000) -> bytes:
    """A real, minimal PCM WAV. Chosen over a webm blob on purpose: WAV is the one container
    `audio_seconds` can read exactly, so the fixture exercises the pre-flight duration guard as well
    as the sniff."""
    n = int(rate * seconds)
    data = b"\x00\x00" * n
    return (b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
            + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", len(data)) + data)


def jpeg_bytes(w: int = 900, h: int = 1200) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (240, 236, 229)).save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def dg_fixture(text: str, dur: float = 6.0) -> dict:
    """Deepgram nova-3's shape, as `transcribe.parse_utterances` + `confidence.classify` read it."""
    return {"metadata": {"duration": dur},
            "results": {"utterances": [{"speaker": 0, "transcript": text, "start": 0.0,
                                        "end": dur, "confidence": 0.97,
                                        "words": [{"confidence": 0.97}] * 8}]}}


async def _cleanup():
    async with db.get_pool().acquire() as con:
        sids = [r["sid"] for r in await con.fetch(
            "select sid from demo_sessions where tenant_slug=$1", TEN)]
        await con.execute("delete from demo_media where sid = any($1::text[])", sids or [""])
        await con.execute("delete from demo_phone_link where sid = any($1::text[])", sids or [""])
        await con.execute("delete from demo_sessions where tenant_slug=$1", TEN)
        await con.execute("delete from sku_aliases where tenant_id=$1", TEN)
        await con.execute("delete from catalogue_skus where tenant_id=$1", TEN)
        await con.execute("delete from catalogue_directory where tenant_id=$1", TEN)
    for sid in sids:
        for scope in (tenancy.demo_scope(sid, TEN), tenancy.demo_scope(sid)):
            try:
                async with db.scoped_tx(scope) as con:
                    for t in ("timer", "open_loop", "action", "fact", "card", "event", "scope_node"):
                        await con.execute(f"delete from {t} where scope=$1::ltree", scope)
            except Exception:
                pass
    # 2026-08-09: the anonymous rung is gone, so `_session` no longer mints a `demo_<sid>` tenant on
    # the way past. The delete stays because a clone rebuilt from an older run may still hold them,
    # and it names only the sids THIS run touched — never a sweep over everybody else's worlds.
    try:
        async with db.get_pool().acquire() as con:
            await con.execute("delete from tenants where slug = any($1::text[]) and seeded",
                              ["demo_" + s for s in sids] or [""])
    except Exception:
        pass


async def _session(catalog_ready: bool = True) -> dict:
    """A flow session pointed at the vital's ONE tenant — the §17.56c AUTHED shape
    (`test.demo.t.<slug>.<sid>`), so ③ can compare two sessions against one catalogue instead of
    seeding (and embedding) the same three SKUs twice.

    Minted through `session_for_operator`, which is now the ONLY mint (the anonymous
    `create_session` this used to call was deleted in the 2026-08-09 remediation). A second call for
    the same address would RESUME rather than mint, so each session gets its own address."""
    email = f"vital.media.{secrets.token_hex(4)}@{TEN}.es"
    out = await demo_flow.session_for_operator(email, TEN)
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set catalog_ready=$2 where token=$1",
                          out["token"], catalog_ready)
    return await demo_flow.resolve(out["token"])


def _names(order) -> list:
    return sorted((str(l.get("name") or "").strip().lower())
                  for l in ((order or {}).get("lines") or []))


async def main():
    print("VITAL: demo media (voice · photo · the QR phone handoff)")

    # ══ ① THE PURE GUARDS — no DB, no network, no keys ═══════════════════════════════════════════
    print("\n① pure guards")
    ck("sniff: JPEG · PNG · GIF · WEBP",
       demo_media.sniff_mime(b"\xff\xd8\xff\xe0" + b"0" * 20) == "image/jpeg"
       and demo_media.sniff_mime(b"\x89PNG\r\n\x1a\n" + b"0" * 20) == "image/png"
       and demo_media.sniff_mime(b"GIF89a" + b"0" * 20) == "image/gif"
       and demo_media.sniff_mime(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp")
    ck("sniff: a real Pillow JPEG", demo_media.sniff_mime(jpeg_bytes(40, 40)) == "image/jpeg")
    ck("sniff: WAV · OGG · WEBM · MP3 · M4A",
       demo_media.sniff_mime(wav_bytes(0.1)) == "audio/wav"
       and demo_media.sniff_mime(b"OggS" + b"\x00" * 30) == "audio/ogg"
       and demo_media.sniff_mime(b"\x1a\x45\xdf\xa3" + b"\x00" * 20) == "audio/webm"
       and demo_media.sniff_mime(b"ID3\x04" + b"\x00" * 20) == "audio/mpeg"
       and demo_media.sniff_mime(b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 8) == "audio/mp4")
    ck("sniff: HEIC is RECOGNISED (so it earns its own sentence, not a generic refusal)",
       demo_media.sniff_mime(b"\x00\x00\x00\x18ftypheic" + b"\x00" * 8) == "image/heic")
    ck("sniff: an .exe renamed .jpg is NOT an image",
       demo_media.sniff_mime(b"MZ\x90\x00" + b"\x00" * 40) == "")
    ck("sniff: too short to be anything → '' (never a guess)",
       demo_media.sniff_mime(b"\xff\xd8") == "")

    secs = demo_media.audio_seconds("audio/wav", wav_bytes(3.0))
    ck("duration: a 3 s WAV reads as 3 s", secs is not None and abs(secs - 3.0) < 0.05, str(secs))
    ck("duration: an unreadable container answers None, never a guess",
       demo_media.audio_seconds("audio/webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 40) is None)

    # the signature: round trip, tamper, expiry — consent.unsubscribe_token's discipline
    exp = int(time.time()) + 600
    tok = demo_phone.sign("abc123def456", "nonce-1", exp)
    ck("phone token: round trips", demo_phone.unsign(tok) == ("abc123def456", "nonce-1", exp))
    bad_body = ("A" + tok[1:]) if tok[0] != "A" else ("B" + tok[1:])
    ck("phone token: a flipped PAYLOAD byte → None", demo_phone.unsign(bad_body) is None)
    body, _, sig = tok.partition(".")
    ck("phone token: a flipped SIGNATURE byte → None",
       demo_phone.unsign(f"{body}.{('A' + sig[1:]) if sig[0] != 'A' else ('B' + sig[1:])}") is None)
    ck("phone token: no signature at all → None", demo_phone.unsign(body) is None)
    ck("phone token: empty / absurd → None (one answer)",
       demo_phone.unsign("") is None and demo_phone.unsign("x" * 500) is None)
    ck("phone token: EXPIRED → None, the same None as forged (non-leaking)",
       demo_phone.unsign(demo_phone.sign("abc123def456", "n", int(time.time()) - 1)) is None)
    ck("phone token: the hard cap is IN the signature (not re-derivable by the holder)",
       demo_phone.unsign(tok, now=exp + 1) is None)
    # domain separation: consent's key ladder can land on the same machine key
    import consent as consent_mod
    ck("phone token: a consent unsubscribe token does NOT verify here (domain-separated)",
       demo_phone.unsign(consent_mod.unsubscribe_token("a@b.es")) is None)

    ck("caps: the phone can send text, voice and photos",
       all(demo_phone.has_cap(c) for c in ("chat", "voice", "photo", "board", "seeds", "view")))
    ck("caps: the phone CANNOT write settings, touch the catalogue, the email or consent",
       not any(demo_phone.has_cap(c) for c in ("persona", "catalog", "email", "consent", "admin")))
    ck("caps: the phone CANNOT mint another phone link (no re-delegation)",
       not demo_phone.has_cap("qr") and not demo_phone.has_cap("phone"))
    ck("caps: the two sets do not overlap (a cap cannot be both)",
       not (demo_phone.PHONE_CAPS & demo_phone.DESK_ONLY_CAPS))

    # ══ DB from here ═════════════════════════════════════════════════════════════════════════════
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    await demo_flow.ensure_demo_schema()
    await demo_media.ensure_schema()
    await demo_phone.ensure_schema()
    await _cleanup()

    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants(slug,name,status,seeded,country) "
            "values($1,$2,'test',true,'ES') on conflict (slug) do nothing",
            TEN, "Vital — demo media")
    seeded = await golive.seed_catalogue(TEN, SKUS)
    ck("setup: the vital catalogue is in", seeded.get("ok") and seeded.get("skus") == 3, str(seeded))

    # ══ ② THE PHONE CREDENTIAL, against the DB ═══════════════════════════════════════════════════
    print("\n② the phone link")
    srow = await _session()
    sid = srow["sid"]
    link1 = await demo_phone.mint(sid)
    ck("mint: a link, an absolute URL on the panel domain, and a hard cap",
       link1["ok"] and link1["url"].endswith("/demo/phone/" + link1["token"])
       and link1["hard_until"], link1["url"][:70])
    link2 = await demo_phone.mint(sid)
    ck("mint: a HEALTHY link is REUSED, never re-cut (re-rendering must not kill a code mid-scan)",
       link2["token"] == link1["token"] and link2["fresh"] is False)
    link3 = await demo_phone.mint(sid, rotate=True)
    ck("rotate: a new nonce, and the OLD token is dead the same instant (the revocation)",
       link3["token"] != link1["token"]
       and (await demo_phone.claim_and_resolve(link1["token"], "devA"))[1] == "dead")

    row, err = await demo_phone.claim_and_resolve(link3["token"], "devA")
    ck("claim: the first device in gets the session", err == "" and row and row["sid"] == sid)
    _r2, err2 = await demo_phone.claim_and_resolve(link3["token"], "devB")
    ck("claim: a SECOND device is refused by name (§17.20 — a QR on a screen is not a door)",
       err2 == "claimed" and _r2 is None)
    _r3, err3 = await demo_phone.claim_and_resolve(link3["token"], "")
    ck("claim: dropping the device cookie does NOT bypass the claim", err3 == "claimed")
    row_again, err4 = await demo_phone.claim_and_resolve(link3["token"], "devA")
    ck("claim: the claiming device keeps working", err4 == "" and row_again is not None)

    async with db.get_pool().acquire() as con:
        await con.execute("update demo_phone_link set expires_at = now() + interval '30 seconds' "
                          "where sid=$1", sid)
        shrunk = await con.fetchval("select expires_at from demo_phone_link where sid=$1", sid)
    await demo_phone.claim_and_resolve(link3["token"], "devA")
    async with db.get_pool().acquire() as con:
        after = await con.fetchval("select expires_at from demo_phone_link where sid=$1", sid)
        hard = await con.fetchval("select hard_until from demo_phone_link where sid=$1", sid)
    ck("sliding TTL: phone activity extends the window", after > shrunk, f"{shrunk} → {after}")
    ck("sliding TTL: an extension can never reach past the hard cap", after <= hard,
       f"{after} vs {hard}")

    st = await demo_phone.link_state(sid)
    ck("presence: with no desk stream open, the phone is told so honestly (loss never implied)",
       st["desk_watching"] is False and "no está mirando" in st["sentence"], st["sentence"])
    await demo_phone.desk_seen(sid)
    st2 = await demo_phone.link_state(sid)
    ck("presence: a live desk channel flips the sentence",
       st2["desk_watching"] is True and "lo está viendo" in st2["sentence"], st2["sentence"])

    await demo_phone.revoke(sid)
    _r5, err5 = await demo_phone.claim_and_resolve(link3["token"], "devA")
    ck("revoke: «I put that QR on a projector» kills every outstanding link", err5 == "dead")
    ck("revoke: a revoked link is refused IDENTICALLY to an unknown one (non-leaking)",
       (await demo_phone.claim_and_resolve("garbage.garbage", "devA")) == (_r5, err5))
    st3 = await demo_phone.link_state(sid)
    ck("revoke: the desk's own state doc says «not linked», not «error»", st3["linked"] is False)

    # a session that DIED under an open phone: the phone must meet the desk's answer, not a stale ok
    dead_sess = await _session()
    dlink = await demo_phone.mint(dead_sess["sid"])
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set expires_at = now() - interval '1 minute' "
                          "where sid=$1", dead_sess["sid"])
    _r6, err6 = await demo_phone.claim_and_resolve(dlink["token"], "devZ")
    ck("the session expired while the phone was open → the ONE dead-link answer", err6 == "dead")

    # ══ ③ A VOICE NOTE PRODUCES THE ORDER A TYPED SENTENCE PRODUCES ══════════════════════════════
    print("\n③ spoken == typed")
    calls = {"dg": 0, "ocr": 0, "turns": 0}
    real_dg, real_polish, real_ocr = tx.deepgram_diarize, tx.polish_sync, tx.ocr_image_sync
    real_run_turn = runtime.run_turn
    seen_kwargs = []

    async def fake_dg(audio, content_type, **kw):
        # `**kw` on purpose: this doubles a real organ whose signature grows OPTIONAL arguments
        # (2026-08-19: `keyterms`, the catalogue-derived domain prior). A double that pins the
        # exact 2-argument shape turns every such addition into a red gate that says
        # «TypeError: unexpected keyword argument» rather than anything about the product — which
        # is what it did. What this vital is asserting is that Deepgram is asked ONCE and what it
        # heard comes back, and neither claim cares how many optional knobs the call carries.
        calls["dg"] += 1
        calls.setdefault("dg_keyterms", 0)
        calls["dg_keyterms"] = len(kw.get("keyterms") or [])
        return dg_fixture(SPOKEN["text"], SPOKEN["dur"])

    def fake_ocr(image_bytes, mime, caption="", **kw):
        calls["ocr"] += 1
        SPOKEN["ocr_mime"] = mime
        SPOKEN["ocr_bytes"] = len(image_bytes)
        return PHOTO_TEXT

    async def spy_run_turn(*a, **kw):
        calls["turns"] += 1
        seen_kwargs.append(kw)
        return await real_run_turn(*a, **kw)

    SPOKEN = {"text": SENTENCE, "dur": 6.0}
    tx.deepgram_diarize = fake_dg
    tx.polish_sync = lambda raw: raw            # the polish is a model call; the wiring is what we test
    tx.ocr_image_sync = fake_ocr
    runtime.run_turn = spy_run_turn
    try:
        typed_row = await _session()
        typed = await demo_flow.chat(token=typed_row["token"], text=SENTENCE, ip="10.0.0.1")
        ck("typed: the control turn drafted an order", bool(typed.get("order")), str(typed)[:200])

        voice_row = await _session()
        spoken = await demo_media.voice(row=voice_row, audio=wav_bytes(6.0),
                                        content_type="audio/wav", ip="10.0.0.2",
                                        origin="phone", client_id="c-voice-1")
        ck("voice: Deepgram was asked exactly once", calls["dg"] == 1)
        ck("voice: the TRANSCRIPT comes back to the UI (what it heard is most of the trust)",
           spoken.get("transcript") == SENTENCE, str(spoken.get("transcript"))[:120])
        ck("voice: the confidence classified AT THE SENSE rides along",
           isinstance(spoken.get("confidence"), dict) and spoken["confidence"].get("level"),
           str(spoken.get("confidence"))[:80])
        ck("voice: it drafted an order", bool(spoken.get("order")), str(spoken)[:200])
        ck("③ THE CLAIM: a spoken order == the same order typed",
           _names(spoken.get("order")) == _names(typed.get("order")) and _names(spoken.get("order")),
           f"spoken={_names(spoken.get('order'))} typed={_names(typed.get('order'))}")

        # ══ ④ A PHOTO PRODUCES LINES + «Para revisar» ═════════════════════════════════════════════
        print("\n④ a photo of a handwritten note")
        photo_row = await _session()
        shot = await demo_media.photo(row=photo_row, image=jpeg_bytes(), content_type="image/jpeg",
                                      ip="10.0.0.3", caption="pa mañana", origin="phone",
                                      client_id="c-photo-1")
        ck("photo: the vision organ was asked exactly once", calls["ocr"] == 1)
        ck("photo: it was handed a mime the vision call actually accepts (HEIC never reaches it)",
           SPOKEN.get("ocr_mime") in demo_media.VISION_MIMES, str(SPOKEN.get("ocr_mime")))
        ck("photo: EXIF is stripped by re-encoding — the bytes sent are NOT the bytes received",
           SPOKEN.get("ocr_bytes") not in (None, len(jpeg_bytes())))
        ck("photo: the read text comes back", (shot.get("transcript") or "").startswith("PEDIDO"))
        ck("photo: it produced order lines", bool(shot.get("order")), str(shot)[:200])
        ck("④ the off-catalogue line is HELD, not guessed",
           any("percebe" in str(u.get("mention") or "").lower()
               for u in (shot.get("unmatched") or [])),
           str(shot.get("unmatched"))[:200])
        board = await demo_flow.board(photo_row["token"])
        ck("④ the board shows the photo's order and its review tail (one screen, one truth)",
           bool(board and board["orders"]) and bool(board and board["review"]))

        # ══ ⑥ NO EGRESS, AND THE WRITE IS test LINEAGE ════════════════════════════════════════════
        print("\n⑥ a demo media turn cannot egress")
        media_kw = next((k for k in seen_kwargs if str(k.get("source") or "") == "demo_voz"), {})
        ck("run_turn was called with egress_stub=True (the HTTP response IS the delivery)",
           media_kw.get("egress_stub") is True, str(media_kw.get("egress_stub")))
        sc = str(media_kw.get("scope_override") or "")
        ck("the media turn ran on a `test.` scope (lineage=test by construction)",
           sc.startswith("test."), sc)
        ck("that scope resolves to THIS session's tenant, never BRAIN_TENANT",
           tenancy.tenant_of(sc) == TEN and TEN != config.BRAIN_TENANT, tenancy.tenant_of(sc))
        ck("the media turn's source names the rail it came in on",
           str(media_kw.get("source") or "") in ("demo_voz", "demo_foto"),
           str(media_kw.get("source")))
        vscope = demo_flow.scope_of_row(voice_row)
        async with db.scoped_tx(vscope) as con:
            lin = await con.fetchval(
                "select lineage from event where scope=$1::ltree and type='message' "
                "order by id desc limit 1", vscope)
            # `action.state`, not `action.status` — the column has never been called `status`, so
            # this query raised UndefinedColumn and took the whole vital down with it before it
            # could reach ⑥ or ⑦. Pre-dates the 2026-08-09 remediation (verified against a pristine
            # HEAD checkout); fixed here because a vital that cannot finish is not a gate.
            n_actions = await con.fetchval(
                "select count(*) from action where scope=$1::ltree and coalesce(state,'') "
                "in ('sent','sending')", vscope)
        ck("the event the voice note wrote is lineage='test' (invisible to every live sheet)",
           lin == "test", str(lin))
        ck("nothing on that scope was actually sent anywhere", int(n_actions or 0) == 0,
           str(n_actions))

        # ══ ⑦ RETRIES ARE IDEMPOTENT ══════════════════════════════════════════════════════════════
        print("\n⑦ the same photo, retried")
        dg_before, turns_before = calls["dg"], calls["turns"]
        again = await demo_media.photo(row=photo_row, image=jpeg_bytes(), content_type="image/jpeg",
                                       ip="10.0.0.3", caption="pa mañana", origin="phone",
                                       client_id="c-photo-1")
        ck("a retry REPLAYS the stored answer", again.get("replayed") is True)
        ck("a retry costs no second read and no second turn",
           calls["dg"] == dg_before and calls["turns"] == turns_before,
           f"dg={calls['dg']} turns={calls['turns']}")
        async with db.get_pool().acquire() as con:
            n_rows = await con.fetchval(
                "select count(*) from demo_media where sid=$1 and client_id='c-photo-1'",
                photo_row["sid"])
        ck("a retry never stacks a second slot (the unique index IS the idempotency)",
           int(n_rows or 0) == 1, str(n_rows))

        # ══ ⑤ THE FENCES ══════════════════════════════════════════════════════════════════════════
        print("\n⑤ the fences")
        dg_before = calls["dg"]
        big = b"\x00" * (config.DEMO_VOICE_MAX_BYTES + 1)
        over = await demo_media.voice(row=voice_row, audio=big, content_type="audio/wav",
                                      ip="10.0.0.9", client_id="c-over-1")
        ck("oversize: refused, with a sentence a person can act on",
           over.get("ok") is False and over.get("error") == "too_big_voice"
           and "corta" in over.get("reply", ""), over.get("reply", "")[:80])
        ck("oversize: refused BEFORE the transcriber is touched", calls["dg"] == dg_before)
        async with db.get_pool().acquire() as con:
            n_over = await con.fetchval(
                "select count(*) from demo_media where client_id='c-over-1'")
        ck("oversize: no row, no slot, no state to clean up", int(n_over or 0) == 0)

        junk = await demo_media.voice(row=voice_row, audio=b"MZ\x90\x00" + b"\x00" * 200,
                                      content_type="audio/wav", ip="10.0.0.9",
                                      client_id="c-junk-1")
        ck("a declared audio/wav that is really a PE binary is refused (bytes beat the claim)",
           junk.get("ok") is False and junk.get("error") == "bad_audio")

        SPOKEN["text"] = "   "
        turns_before = calls["turns"]
        silent = await demo_media.voice(row=voice_row, audio=wav_bytes(2.0),
                                        content_type="audio/wav", ip="10.0.0.9",
                                        client_id="c-silence-1")
        ck("silence gets its own honest sentence, and never runs the mind on ''",
           silent.get("ok") is False and silent.get("error") == "silence"
           and calls["turns"] == turns_before, silent.get("reply", "")[:60])
    finally:
        tx.deepgram_diarize, tx.polish_sync, tx.ocr_image_sync = real_dg, real_polish, real_ocr
        runtime.run_turn = real_run_turn

    # the two credentials cannot be confused for one another
    plink = await demo_phone.mint(voice_row["sid"], rotate=True)
    ck("a PHONE token is not a session token (demo_flow.resolve never matches one)",
       (await demo_flow.resolve(plink["token"])) is None)
    ck("a SESSION token is not a phone token (no signature → the one dead answer)",
       (await demo_phone.claim_and_resolve(voice_row["token"], "devQ")) == (None, "dead"))

    # the media state doc — §17.20's «events are hints; state is truth»
    doc = await demo_media.state(voice_row["sid"])
    ck("the state doc lists this session's captures in the one vocabulary",
       doc["ok"] and all(m["state"] in demo_media.STATES for m in doc["media"]),
       str([m["state"] for m in doc["media"]]))
    ck("the state doc NEVER carries bytes or a URL to them (nothing was stored to serve)",
       all("url" not in m and "data" not in m for m in doc["media"]))
    cur = await demo_media.cursor(voice_row["sid"])
    ck("the live channel's extra cursor moves with the capture state", bool(cur), cur)

    n = await demo_media.reap(days=0)
    ck("reaping: media rows do not outlive their session (bounded delete, real count)",
       n >= 1, f"{n} rows")

    await _cleanup()
    passed = sum(R)
    print(f"\nDEMO MEDIA: {passed}/{len(R)} — "
          f"{'GREEN' if passed == len(R) else 'A MEDIA RAIL IS BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
