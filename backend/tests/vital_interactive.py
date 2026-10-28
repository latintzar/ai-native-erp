"""vital_interactive.py — THE ONE-TAP (INTERACTIVE) CONTRACT on the DB (2026-07-26).

The honest replacement for polls: Rocoto asks a CLOSED question, the human answers with ONE TAP, and
that tap comes back bound to the exact question it answers.

  A. LIMITS ARE ENFORCED IN CODE, never silently truncated (whatsapp_cloud): 4 buttons → error,
     11 rows across sections → error, a 21-char button title → error — all raised BEFORE any Graph
     call. A cropped option is a changed question.
  B. THE SURFACE CHOICE BELONGS TO THE CODE: ≤3 short options → reply BUTTONS, >3 → a LIST. The mind
     never thinks about Meta's UI limits.
  C. OUTBOUND is evented (msg.sent kind=interactive WITH the offered option set — the fold/why-trace
     must answer "what did we put in front of them?"), projected into whatsapp_messages (so the app
     and the CR render it), and sandbox-honoured (EGRESS_SANDBOX ⇒ zero egress).
  D. INBOUND: a button_reply webhook stores a REAL message row (the chosen title as the body, quoted
     under the question) and WAKES THE MIND through the ordinary text-ingest path, carrying the
     chosen OPTION ID + the wamid we asked with. A Meta re-delivery writes ZERO new rows.
  E. THE GATE STILL RULES: a priced body PARKS (action row, needs_human, money) and NOTHING is sent —
     a price on a button is a quote like any other sentence.
  F. THE MIND'S HAND is exactly one tool, `ask_options`, and Meta's UI limits are not in its schema.
  G. PIN — the capability Meta's API KNOWS and our WABA will not execute (131000). Built, INERT, and
     WATCHED: the flag is off by default, both senders refuse before building a payload, the shape is
     the validated one, and the weekly probe (brain/pin_watch) costs nothing while it is off, cannot
     spam (durable gate), records a 131000 as "still closed" but a real fault as a FAULT, and on the
     day it opens flips a durable flag, tells Peter, and burns itself.
  H. THE DOOR TELLS THE TRUTH: an inbound type nothing handles is dead-lettered, not vanished — and
     it never wakes the mind.

Run on the rehearsal clone (prod box):
  source deploy/harness/rehearsal_env.sh && PYTHONPATH=. $PY tests/vital_interactive.py
SAFETY: hard-refuses a live `rocoto` DATABASE_URL — this vital writes rows.
"""
import asyncio
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

_dbname = (urlparse(os.environ.get("DATABASE_URL", "")).path or "").lstrip("/")
if _dbname == "rocoto":
    raise SystemExit("REFUSED: DATABASE_URL points at the LIVE rocoto DB — source rehearsal_env.sh first.")

import gatelib  # noqa: E402

import actions as rt_actions  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402,F401
import runtime
import whatsapp_cloud as wc  # noqa: E402

PHONE = "+34999001078"
# The scope is built the way the RUNTIME builds it — with the tenant. Passing it makes this line
# correct in BOTH modes: with ROCOTO_SCOPE_PATHED off `scope_of` ignores the tenant and returns the
# flat path exactly as before; with it on, this test reads the same owned path the webhook writes.
# (Before, it hardcoded the flat shape and so read an empty scope once the writer was flipped —
# events=0, and the tap looked broken when it was fine. WP-A1 phase M.)
SCOPE = runtime.scope_of(PHONE, config.BRAIN_TENANT)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _cleanup():
    async with db.scoped_tx(SCOPE) as con:
        # actions FIRST: action.opened_by_event references event(id).
        await con.execute("delete from action where scope=$1::ltree", SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("delete from pending_turn where scope=$1::ltree", SCOPE)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)


async def _raises_limit(coro) -> str:
    """Run an awaitable that MUST raise InteractiveLimitError. Returns the message ('' if it didn't)."""
    try:
        await coro
        return ""
    except wc.InteractiveLimitError as e:
        return str(e)
    except Exception as e:  # any other error means the guard did NOT fire first
        return f"!WRONG-ERROR:{type(e).__name__}:{e}"


async def main():
    await db.init()
    import app as app_mod  # noqa: E402 — the webhook organ (heavy import; fine on the clone)
    await _cleanup()

    # ── A. the limits are OURS, enforced before any Graph call ───────────────────────────────
    posted = []

    async def _no_post(payload, **kw):
        # `**kw` on purpose: this doubles `whatsapp_cloud._post_messages`, whose signature carries
        # OPTIONAL keywords (`from_id`, the number a send must leave from). A double pinned to the
        # exact arity turns every such addition into a red gate that says «unexpected keyword
        # argument» and nothing about the product — the second time that has cost a deploy today
        # (fake_dg/keyterms was the first). What this vital asserts is that NOTHING is posted; that
        # claim does not care how many optional keywords the call carries.
        posted.append(payload)
        return "wamid.SHOULD.NOT.HAPPEN"

    _orig_post, wc._post_messages = wc._post_messages, _no_post
    try:
        e1 = await _raises_limit(wc.send_interactive_buttons(
            PHONE, "¿Qué día?", [{"id": f"o{i}", "title": f"Op {i}"} for i in range(4)]))
        ck("A1 4 reply buttons → InteractiveLimitError, ZERO egress",
           e1.startswith("4 reply buttons") and not posted, f"err={e1!r} posts={len(posted)}")

        e2 = await _raises_limit(wc.send_interactive_list(
            PHONE, "¿Qué día?", "Ver días",
            [{"title": "A", "rows": [{"id": f"a{i}", "title": f"A{i}"} for i in range(6)]},
             {"title": "B", "rows": [{"id": f"b{i}", "title": f"B{i}"} for i in range(5)]}]))
        ck("A2 11 rows across 2 sections → InteractiveLimitError (the TOTAL cap, not per-section)",
           "11 list rows" in e2 and not posted, f"err={e2!r} posts={len(posted)}")

        e3 = await _raises_limit(wc.send_interactive_buttons(
            PHONE, "¿Qué día?", [{"id": "o1", "title": "A" * 21}, {"id": "o2", "title": "Ok"}]))
        ck("A3 21-char button title → InteractiveLimitError (never silently truncated)",
           "is 21 chars" in e3 and not posted, f"err={e3!r} posts={len(posted)}")

        e4 = await _raises_limit(wc.send_interactive_list(
            PHONE, "¿Qué día?", "Ver días",
            [{"rows": [{"id": "x" * 257, "title": "Mañana"}, {"id": "b", "title": "Jueves"}]}]))
        ck("A4 a 257-char option id → InteractiveLimitError", "is 257 chars" in e4 and not posted,
           f"err={e4!r}")

        e5 = await _raises_limit(wc.send_interactive_buttons(
            PHONE, "¿Qué día?", [{"id": "same", "title": "Mañana"}, {"id": "same", "title": "Jueves"}]))
        ck("A5 duplicate option ids → InteractiveLimitError (a tap must be unambiguous)",
           "duplicate button id" in e5 and not posted, f"err={e5!r}")

        # a legal call DOES post, and the payload is Meta's exact shape.
        ok_wamid = await wc.send_interactive_buttons(
            PHONE, "¿Qué día te va mejor?",
            [{"id": "opt1", "title": "Mañana"}, {"id": "opt2", "title": "Jueves"}], footer="Rocoto")
        p = posted[-1] if posted else {}
        ia = (p.get("interactive") or {})
        btns = ((ia.get("action") or {}).get("buttons") or [])
        ck("A6 a legal buttons call posts Meta's exact shape (type=interactive/button, reply objects)",
           len(posted) == 1 and p.get("type") == "interactive" and ia.get("type") == "button"
           and (ia.get("body") or {}).get("text") == "¿Qué día te va mejor?"
           and len(btns) == 2 and btns[0].get("reply", {}).get("id") == "opt1"
           and (ia.get("footer") or {}).get("text") == "Rocoto"
           and ok_wamid == "wamid.SHOULD.NOT.HAPPEN",
           f"payload_keys={sorted(p.keys())}")
    finally:
        wc._post_messages = _orig_post

    # ── B/C. the send path: auto surface choice + evented + projected + sandboxed ─────────────
    sent_btn, sent_list = [], []

    async def _spy_btn(addr, body, buttons, header=None, footer=None):
        sent_btn.append((addr, body, buttons))
        return f"wamid.IA.BTN.{len(sent_btn)}"   # unique per send: two sends never share a wamid

    async def _spy_list(addr, body, label, sections, header=None, footer=None):
        sent_list.append((addr, body, label, sections))
        return f"wamid.IA.LIST.{len(sent_list)}"

    _ob, _ol = wc.send_interactive_buttons, wc.send_interactive_list
    wc.send_interactive_buttons, wc.send_interactive_list = _spy_btn, _spy_list
    _sand = config.EGRESS_SANDBOX
    try:
        # C1 — sandboxed: evented + projected, NOTHING reaches Meta.
        config.EGRESS_SANDBOX = True
        res = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Qué día te va mejor la entrega?",
            [{"title": "Mañana"}, {"title": "Jueves"}, {"title": "El lunes"}])
        async with db.scoped_tx(SCOPE) as con:
            evs = await con.fetch("select payload from event where scope=$1::ltree and type='msg.sent' "
                                  "and payload->>'kind'='interactive'", SCOPE)
        async with db.get_pool().acquire() as con:
            proj = await con.fetch("select message_text, message_type from whatsapp_messages "
                                   "where phone_number=$1 and role='assistant'", PHONE)
        ev_opts = [o.get("title") for o in (evs[0]["payload"].get("options") or [])] if evs else []
        ck("C1 sandboxed ask: msg.sent kind=interactive WITH the option set + projection row, ZERO egress",
           res.get("ok") and res.get("sid") == "SANDBOX-interactive" and len(evs) == 1
           and ev_opts == ["Mañana", "Jueves", "El lunes"]
           and evs[0]["payload"].get("interactive") == "button"
           and len(proj) == 1 and proj[0]["message_type"] == "interactive"
           and "▸ Jueves" in (proj[0]["message_text"] or "")
           and not sent_btn and not sent_list,
           f"res={res.get('reason')} events={len(evs)} proj={len(proj)} egress={len(sent_btn) + len(sent_list)}")

        # B1 — 3 short options → BUTTONS on the real rail.
        config.EGRESS_SANDBOX = False
        r_btn = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Qué día?", [{"title": "Mañana"}, {"title": "Jueves"}, {"title": "El lunes"}])
        ck("B1 ≤3 short options → reply BUTTONS (code's choice, ids generated for the mind)",
           r_btn.get("kind") == "button" and r_btn.get("sid") == "wamid.IA.BTN.1"
           and len(sent_btn) == 1 and not sent_list
           and [b["id"] for b in sent_btn[0][2]] == ["opt1", "opt2", "opt3"],
           f"kind={r_btn.get('kind')} btn={len(sent_btn)} list={len(sent_list)}")

        # B2 — 5 options → LIST, all rows in ONE section (the 10-row total cap is respected).
        r_list = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Qué formato quieres?",
            [{"title": f"Caja {i}"} for i in range(1, 6)])
        rows = sent_list[0][3][0]["rows"] if sent_list else []
        ck("B2 >3 options → LIST message (one section, 5 rows)",
           r_list.get("kind") == "list" and r_list.get("sid") == "wamid.IA.LIST.1"
           and len(sent_list) == 1 and len(rows) == 5 and len(sent_btn) == 1,
           f"kind={r_list.get('kind')} rows={len(rows)}")

        # B3 — 3 options but a title too long for a BUTTON (>20) and fine for a ROW (≤24): the code
        # switches surface rather than cropping the question.
        n_list = len(sent_list)
        r_sw = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Cuál prefieres?",
            [{"title": "Caja de doce unidades"}, {"title": "Media caja"}, {"title": "Suelto"}])
        ck("B3 a title too long for a button switches to a LIST (never crops the option)",
           r_sw.get("kind") == "list" and len(sent_list) == n_list + 1, f"kind={r_sw.get('kind')}")

        # B4 — fewer than 2 options is not a closed question at all.
        r_one = await rt_actions.send_interactive_as_rocoto(SCOPE, "¿Sí?", [{"title": "Vale"}])
        ck("B4 <2 options refused before any egress", not r_one.get("ok")
           and r_one.get("reason") == "needs_at_least_2_options")

        # ── E. THE GATE: a priced question parks and NOTHING is sent ──────────────────────────
        n_btn, n_list2 = len(sent_btn), len(sent_list)
        r_gate = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "Te lo dejo a 1,80 € el kilo, ¿te lo mando?",
            [{"title": "Sí, mándalo"}, {"title": "No, gracias"}])
        async with db.scoped_tx(SCOPE) as con:
            parked = await con.fetch(
                "select kind, state, needs_human, money, payload from action "
                "where scope=$1::ltree and state='pending' and money", SCOPE)
            ev_after = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='msg.sent' "
                "and payload->>'kind'='interactive'", SCOPE)
        ck("E1 a priced body PARKS at the gate: no send, no msg.sent, one needs_human money action",
           (not r_gate.get("ok")) and r_gate.get("parked")
           and len(sent_btn) == n_btn and len(sent_list) == n_list2
           and len(parked) == 1 and parked[0]["needs_human"] and parked[0]["money"]
           and int(ev_after) == 4,
           f"res={r_gate.get('reason')} parked={len(parked)} sent_events={ev_after}")

        # E2 — a concession hidden in an OPTION TITLE parks too (a button is speech).
        n_btn2, n_list3 = len(sent_btn), len(sent_list)
        r_gate2 = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Cómo lo hacemos?",
            [{"title": "Con descuento"}, {"title": "Precio normal"}])
        ck("E2 a concession in an OPTION TITLE parks too (a button is speech)",
           (not r_gate2.get("ok")) and r_gate2.get("parked")
           and len(sent_btn) == n_btn2 and len(sent_list) == n_list3,
           f"res={r_gate2.get('reason')}")
    finally:
        wc.send_interactive_buttons, wc.send_interactive_list = _ob, _ol
        config.EGRESS_SANDBOX = _sand

    # ── D. INBOUND: the tap is a real answer — row + wake, carrying the option id + our wamid ──
    await _cleanup()
    entry = {"entry": [{"changes": [{"value": {
        "contacts": [{"wa_id": PHONE.lstrip("+"), "profile": {"name": "Vital Tester"}}],
        "messages": [{
            "from": PHONE.lstrip("+"), "id": "wamid.TAP.D1", "type": "interactive",
            "context": {"id": "wamid.WEASKED.D0"},
            # Meta's verified shape: the chosen object is keyed BY interactive.type.
            "interactive": {"type": "button_reply",
                            "button_reply": {"id": "opt2", "title": "Jueves"}},
        }],
    }}]}]}

    class _Req:
        """Signed the way Meta signs — the door verifies always now (WP-E)."""

        def __init__(self):
            import json as _j
            self._raw = _j.dumps(entry).encode()
            self.headers = gatelib.sign_meta(self._raw)

        async def body(self):
            return self._raw

    _txt = config.ROCOTO_TEXT_REPLY_ENABLED
    woke = []

    async def _spy_wake(mid):
        woke.append(mid)

    import voice_reply as _vr
    _orig_wake = _vr.maybe_reply_to_text
    _vr.maybe_reply_to_text = _spy_wake
    try:
        config.ROCOTO_TEXT_REPLY_ENABLED = True
        await app_mod.meta_wa_webhook(_Req())
        await app_mod.meta_wa_webhook(_Req())   # Meta RE-DELIVERY — must write zero new rows
        await asyncio.sleep(0.4)                # the wake + notify are create_task'd
    finally:
        _vr.maybe_reply_to_text = _orig_wake
        config.ROCOTO_TEXT_REPLY_ENABLED = _txt

    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, role, message_text, message_type, wa_message_id, reply_to_wa_id "
            "from whatsapp_messages where phone_number=$1 and role='user'", PHONE)
    ck("D1 a button_reply webhook stores ONE real message row — the chosen TITLE as the body, "
       "typed 'text' (the thread reads naturally), quoted under the question we asked; "
       "a re-delivery writes 0",
       len(rows) == 1 and rows[0]["message_text"] == "Jueves"
       and rows[0]["message_type"] == "text" and rows[0]["wa_message_id"] == "wamid.TAP.D1"
       and rows[0]["reply_to_wa_id"] == "wamid.WEASKED.D0",
       f"rows={len(rows)}")

    async with db.scoped_tx(SCOPE) as con:
        evs = await con.fetch("select payload from event where scope=$1::ltree and type='message' "
                              "and lane='world' order by id", SCOPE)
        armed = await con.fetchval("select state from pending_turn where scope=$1::ltree", SCOPE)
    ia = (evs[0]["payload"].get("interactive") or {}) if evs else {}
    ck("D2 the tap ingests ONE inbound 'message' event carrying the chosen OPTION ID + the wamid we "
       "asked with (idempotent on the tap's own wamid)",
       len(evs) == 1 and evs[0]["payload"].get("text") == "Jueves"
       and ia.get("option_id") == "opt2" and ia.get("asked_wamid") == "wamid.WEASKED.D0"
       and ia.get("reply_type") == "button_reply",
       f"events={len(evs)} interactive={ia}")
    ck("D3 the tap WAKES THE MIND like a normal reply (debounce armed + the text-reply hook fired "
       "with the stored row) — it is the open-loop answer path, not presence",
       armed == "armed" and len(woke) == 1 and rows and woke[0] == rows[0]["id"],
       f"pending_turn={armed} wake_calls={len(woke)} woke={woke}")

    # ── F. THE MIND'S HAND: one tool, `ask_options`, and it reaches the rail ──────────────────
    await _cleanup()
    import agent_reply  # noqa: E402

    tool = next((t for t in agent_reply._tools() if t["name"] == "ask_options"), None)
    props = ((tool or {}).get("input_schema") or {}).get("properties") or {}
    opts_schema = props.get("opciones") or {}
    ck("F1 the mind has exactly ONE interactive hand, `ask_options` (question + 2..10 options; "
       "Meta's UI limits are NOT in its schema)",
       bool(tool) and set(props) == {"pregunta", "opciones"}
       and opts_schema.get("minItems") == 2 and opts_schema.get("maxItems") == 10
       and "button" not in (tool or {}).get("description", "").lower(),
       f"props={sorted(props)}")

    # drive the real mind loop with a stubbed Anthropic client: turn 1 calls ask_options, turn 2 is
    # silent — the question already went out, so a trailing "hecho" would be a second, dumber message.
    class _Blk:
        def __init__(self, **kw):
            self.__dict__.update(kw)

    class _Resp:
        def __init__(self, content):
            self.content = content

    _calls = []

    class _FakeMessages:
        async def create(self, **kw):
            _calls.append(kw)
            if len(_calls) == 1:
                return _Resp([_Blk(type="tool_use", id="tu_1", name="ask_options", input={
                    "pregunta": "¿Qué día te viene mejor la entrega?",
                    "opciones": [{"titulo": "Mañana"}, {"titulo": "Jueves"}, {"titulo": "El lunes"}]})])
            return _Resp([])

    class _FakeClient:
        def __init__(self, **kw):
            self.messages = _FakeMessages()

        async def close(self):
            return None

    _oc = agent_reply.anthropic.AsyncAnthropic
    agent_reply.anthropic.AsyncAnthropic = _FakeClient
    try:
        out = await agent_reply._run_mind(PHONE, "sys", [{"role": "user", "content": "vale"}],
                                          {"name": "Tester"}, "es")
    finally:
        agent_reply.anthropic.AsyncAnthropic = _oc

    async with db.scoped_tx(SCOPE) as con:
        f_evs = await con.fetch("select payload from event where scope=$1::ltree and type='msg.sent' "
                                "and payload->>'kind'='interactive'", SCOPE)
    f_act = next((a["ask_options"] for a in (out.get("actions") or []) if "ask_options" in a), None)
    ck("F2 the mind's ask_options reaches the rail: the question is SENT (evented kind=interactive, "
       "surface chosen by the code) and the mind stays SILENT after it — no trailing 'hecho' under "
       "its own question",
       bool(f_act) and f_act.get("ok") and f_act.get("kind") == "button" and f_act.get("n") == 3
       and len(f_evs) == 1
       and (f_evs[0]["payload"].get("options") or [{}])[1].get("title") == "Jueves"
       and (out.get("text") or "") == "",
       f"action={f_act} events={len(f_evs)} text={out.get('text')!r}")

    # ── G. PIN: built, refused, inert — and watched, so we learn the day it opens ─────────────
    await _cleanup()
    from brain import pin_watch  # noqa: E402

    ck("G1 pinning is OFF by default — ROCOTO_WA_PIN_ENABLED is the ONE switch, and nothing in this "
       "process can put a pin on the wire while it is off",
       config.ROCOTO_WA_PIN_ENABLED is False, f"flag={config.ROCOTO_WA_PIN_ENABLED}")

    pin_posts = []

    async def _pin_post(payload):
        pin_posts.append(payload)
        return "wamid.PIN.OK"

    _orig_post, wc._post_messages = wc._post_messages, _pin_post
    _flag = config.ROCOTO_WA_PIN_ENABLED
    try:
        disabled = ""
        try:
            await wc.pin_message(PHONE, "wamid.TARGET.G", 30)
        except wc.PinDisabledError as e:
            disabled = str(e)
        ck("G2 with the flag off pin_message REFUSES before building a payload (zero egress)",
           "ROCOTO_WA_PIN_ENABLED is off" in disabled and not pin_posts, f"err={disabled[:60]!r}")

        config.ROCOTO_WA_PIN_ENABLED = True
        await wc.pin_message(PHONE, "wamid.TARGET.G", 7)
        p_pin = pin_posts[-1]
        ck("G3 the pin payload is Meta's VALIDATED shape "
           "(type=pin, pin{type,message_id,expiration_days})",
           p_pin.get("type") == "pin" and p_pin.get("messaging_product") == "whatsapp"
           and p_pin.get("pin") == {"type": "pin", "message_id": "wamid.TARGET.G",
                                    "expiration_days": 7},
           f"payload={p_pin}")

        await wc.unpin_message(PHONE, "wamid.TARGET.G")
        p_unpin = pin_posts[-1]
        ck("G4 unpin carries NO expiration_days (we send only what we have seen accepted)",
           p_unpin.get("pin") == {"type": "unpin", "message_id": "wamid.TARGET.G"},
           f"payload={p_unpin.get('pin')}")

        n_posts = len(pin_posts)
        bad = []
        for label, coro in (
            ("expiration 0", wc.pin_message(PHONE, "wamid.T", 0)),
            ("expiration 31", wc.pin_message(PHONE, "wamid.T", 31)),
            ("expiration '30'", wc.pin_message(PHONE, "wamid.T", "30")),
            ("a Twilio SID target", wc.pin_message(PHONE, "SM_NOT_A_WAMID", 30)),
        ):
            try:
                await coro
                bad.append(label)
            except wc.PinLimitError:
                pass
            except Exception as e:  # noqa: BLE001
                bad.append(f"{label}->{type(e).__name__}")
        ck("G5 out-of-range / wrongly-typed / non-wamid pin arguments raise PinLimitError before any "
           "Graph call — never coerced (a clamped expiration pins for a duration nobody asked for)",
           not bad and len(pin_posts) == n_posts, f"unguarded={bad} posts={len(pin_posts) - n_posts}")
    finally:
        wc._post_messages = _orig_post
        config.ROCOTO_WA_PIN_ENABLED = _flag

    ck("G6 131000 is the ONLY error read as 'still closed' — anything else stays a real fault",
       wc.is_pin_not_enabled_error(RuntimeError("cloud send failed 400: {\"code\":131000}"))
       and not wc.is_pin_not_enabled_error(RuntimeError("cloud send failed 401: bad token")))

    # the watcher itself: inert while the flag is off, and PROVABLY so. Counters, not exceptions —
    # run_probe_once is fail-soft, so a raising spy would be swallowed and the check would pass for
    # the wrong reason.
    touched: list[str] = []

    async def _count_flag(key):
        touched.append(f"db:{key}")
        return ""

    async def _count_pin(*a, **kw):
        touched.append("rail:pin")
        return "wamid.SHOULD.NOT.HAPPEN"

    _of, _op, _ou = pin_watch._flag_get, wc.pin_message, wc.unpin_message
    pin_watch._flag_get, wc.pin_message = _count_flag, _count_pin
    try:
        n_inert = await pin_watch.run_probe_once()
    finally:
        pin_watch._flag_get, wc.pin_message = _of, _op
    ck("G7 with the flag off the weekly probe is FREE: zero DB reads, zero network, returns 0",
       n_inert == 0 and not touched, f"probed={n_inert} touched={touched}")

    # arm the watcher against OUR OWN test thread (never the founder's) and give it a safe target.
    _peter, pin_watch.PETER_PHONE = pin_watch.PETER_PHONE, PHONE
    _sand2 = config.EGRESS_SANDBOX

    async def _clear_flags():
        async with db.get_pool().acquire() as con:
            await con.execute("delete from system_flags where key = any($1::text[])",
                              [pin_watch.FLAG_AVAILABLE, pin_watch.FLAG_PROBE_LAST])

    try:
        await _clear_flags()
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into whatsapp_messages(id,phone_number,role,message_text,message_type,"
                "wa_message_id,created_at) values($1,$2,'assistant','ok','text',$3,"
                "now() - interval '2 days')",
                str(uuid.uuid4()), PHONE, "wamid.PROBE.TARGET")

        config.ROCOTO_WA_PIN_ENABLED = True
        config.EGRESS_SANDBOX = False

        # G8 — the CLOSED door: Meta answers 131000. Recorded as "still closed", nothing claimed.
        async def _still_closed(*a, **kw):
            raise wc.CloudSendError('cloud send failed 400: {"error":{"code":131000}}')

        wc.pin_message = _still_closed
        try:
            n1 = await pin_watch.run_probe_once()
            n2 = await pin_watch.run_probe_once()   # immediately again — the durable weekly gate
        finally:
            wc.pin_message = _op
        async with db.scoped_tx(SCOPE) as con:
            probes = await con.fetch("select payload from event where scope=$1::ltree "
                                     "and type='ops.pin_probe'", SCOPE)
        avail = await pin_watch.is_pin_available()
        ck("G8 a 131000 probe: ONE attempt, evented ops.pin_probe result=not_enabled, the capability "
           "flag stays FALSE, and an immediate second scan does NOT probe again (durable weekly gate)",
           n1 == 1 and n2 == 0 and len(probes) == 1
           and probes[0]["payload"].get("result") == "not_enabled" and avail is False,
           f"n1={n1} n2={n2} probes={len(probes)} available={avail}")

        # G9 — a REAL fault is never laundered into "still closed".
        await _clear_flags()

        async def _dead_mouth(*a, **kw):
            raise wc.CloudSendError("cloud send failed 401: invalid access token")

        wc.pin_message = _dead_mouth
        try:
            res_err = await pin_watch.probe_once()
        finally:
            wc.pin_message = _op
        async with db.scoped_tx(SCOPE) as con:
            errs = await con.fetch("select payload from event where scope=$1::ltree "
                                   "and type='ops.pin_probe' and payload->>'result'='error'", SCOPE)
        ck("G9 a non-131000 failure is reported as the FAULT it is (result=error), never as "
           "'not enabled yet' — an auth failure read as 'still closed' hides a dead rail for weeks",
           res_err.get("probed") and "401" in (res_err.get("error") or "") and len(errs) == 1,
           f"res={res_err}")

        # G10 — THE DAY IT OPENS.
        await _clear_flags()
        unpinned, surfaced = [], []

        async def _pin_ok(phone, wamid, expiration_days=30):
            return "wamid.PINNED"

        async def _unpin_ok(phone, wamid):
            unpinned.append(wamid)
            return "wamid.UNPINNED"

        import ops as _ops
        _osp = _ops.record_alert

        async def _spy_surface(cls, detail, ref_scope=None):
            surfaced.append((cls, detail))
            return {"class": cls, "via": "test", "alert_id": 0}

        wc.pin_message, wc.unpin_message, _ops.record_alert = _pin_ok, _unpin_ok, _spy_surface
        try:
            res_ok = await pin_watch.run_probe_once()
            burned = await pin_watch.run_probe_once()   # the watcher must now stop, forever
        finally:
            wc.pin_message, wc.unpin_message = _op, _ou
            _ops.record_alert = _osp
        async with db.scoped_tx(SCOPE) as con:
            opened = await con.fetch("select payload from event where scope=$1::ltree "
                                     "and type='ops.pin_available'", SCOPE)
        avail2 = await pin_watch.is_pin_available()
        ck("G10 the day it opens: the flag flips DURABLY, the probe leaves no residue (it unpins), "
           "Peter is told, ops.pin_available is evented, and the watcher burns itself",
           res_ok == 1 and burned == 0 and avail2 is True and len(opened) == 1
           and unpinned == ["wamid.PROBE.TARGET"] and len(surfaced) == 1
           and "pin" in surfaced[0][1].lower(),
           f"probed={res_ok} burned={burned} available={avail2} unpinned={unpinned} "
           f"surfaced={len(surfaced)}")
    finally:
        pin_watch.PETER_PHONE = _peter
        config.ROCOTO_WA_PIN_ENABLED = _flag
        config.EGRESS_SANDBOX = _sand2
        await _clear_flags()

    async with db.scoped_tx("peter") as con:
        tool_row = await con.fetchrow(
            "select enabled, config from manifest_tool where scope='peter'::ltree "
            "and name='pin_message'")
    ck("G11 pin_message is REGISTERED AND DISABLED in the manifest — declared so nobody rebuilds it, "
       "disabled so no mind can reach for a hand that cannot work (Peter's switch, not ours)",
       tool_row is not None and tool_row["enabled"] is False,
       f"row={'missing' if tool_row is None else dict(tool_row)}")

    # ── H. the sensing door never swallows an inbound it does not understand ──────────────────
    await _cleanup()
    async with db.get_pool().acquire() as con:
        await con.execute("delete from dead_letter where source='meta' and raw::text like $1",
                          "%UNHANDLED.H1%")
    unknown = {"entry": [{"changes": [{"value": {
        "contacts": [{"wa_id": PHONE.lstrip("+"), "profile": {"name": "Vital Tester"}}],
        "messages": [{"from": PHONE.lstrip("+"), "id": "wamid.UNHANDLED.H1", "type": "location",
                      "location": {"latitude": 41.38, "longitude": 2.17}}],
    }}]}]}

    class _Req2:
        def __init__(self):
            import json as _j
            self._raw = _j.dumps(unknown).encode()
            self.headers = gatelib.sign_meta(self._raw)

        async def body(self):
            return self._raw

    woke2 = []

    async def _spy_wake2(mid):
        woke2.append(mid)

    _vr.maybe_reply_to_text = _spy_wake2
    try:
        await app_mod.meta_wa_webhook(_Req2())
        await asyncio.sleep(0.2)
    finally:
        _vr.maybe_reply_to_text = _orig_wake

    async with db.get_pool().acquire() as con:
        dl = await con.fetch("select reason, problem from dead_letter where source='meta' "
                             "and raw::text like $1", "%UNHANDLED.H1%")
        n_msgs = await con.fetchval(
            "select count(*) from whatsapp_messages where phone_number=$1", PHONE)
        await con.execute("delete from dead_letter where source='meta' and raw::text like $1",
                          "%UNHANDLED.H1%")
    ck("H1 an inbound type nothing handles is DEAD-LETTERED with its reason (not vanished), stores no "
       "message row, and never wakes the mind",
       len(dl) == 1 and dl[0]["reason"] == "unhandled_type:location"
       and int(n_msgs) == 0 and not woke2,
       f"dead_letter={len(dl)} msgs={n_msgs} wakes={len(woke2)}")

    await _cleanup()
    passed = sum(R)
    print(f"\nINTERACTIVE: {passed}/{len(R)} passed — "
          f"{'ONE TAP: ASKED, LIMITED, GATED, SENSED, WOKEN' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
