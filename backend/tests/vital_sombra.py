"""vital_sombra.py — BLOCK B6: MODO SOMBRA (SPEC §5.5).

Peter's principle, in his words: "replying and FOLLOWING are separate powers. A supplier can turn
the mouth OFF while the mind keeps running — Rocoto follows every event exactly as always (one
runtime, same spine), he just doesn't speak."

Before B6 there were FOUR half-toggles that each meant some version of "don't speak here" —
`scope_state.muted`, `scope_state.takeover_active` (literally the same bit, written twice by the same
statement), the per-customer autopilot endpoint, and `elevenlabs_autoreply_enabled` (which after B3
decided nothing at all). None of them knew about the others, none of them stopped a reaction, a
typing bubble or a call, and none of them left a trace of what he WOULD have said. This vital is the
standing proof that there is now exactly ONE field and that it governs the whole mouth.

What it locks, in the order the machinery runs:
  S1  ONE FIELD           — `scope_state.mode` exists and is constrained; `muted`/`takeover_active`
                            are GONE from the schema (a stale reader fails loud, never half-true)
  S2  THE RESOLUTION      — no rows → auto · app-wide sombra is inherited · a per-customer override
                            beats the app-wide default IN BOTH DIRECTIONS · clearing it re-inherits
  S3  THE MIND STILL RUNS — a sombra turn ingests the sense, assembles the fold, runs the mind,
                            persists its facts, REBUILDS THE CARD and parks the extracted order for
                            review — and emits ZERO msg.sent
  S4  THE MOUTH IS SHUT   — message · media · reaction · one-tap question · typing/read-receipts ·
                            voice note · text rail · outbound call, each held with the rail SPIED
  S5  THE DRAFT           — the sentence he would have sent is on the review sheet verbatim
                            (action kind='draft', needs_human) and in the log (`sombra.held`)
  S6  A PROACTIVE RUNG    — the worker's timer chase is held too, through the REAL worker tick, and
                            the ladder still climbs (sombra pauses the mouth, not the follow-up)
  S7  THE HUMAN'S MOUTH   — the §15.4 override rail (CR / supplier «Enviar como Rocoto») still ships
  S8  FLIP MID-CONVO      — auto → sends; flip to sombra → the very next turn is held; flip back →
                            sends again, with no restart and no cache to go stale
  S9  FAIL-CLOSED         — a mode read that cannot answer answers SOMBRA (a held send is
                            recoverable; a sent one is not)
  S10 LEGACY = VIEWS      — takeover, the per-customer autopilot endpoint and the voice toggle all
                            move THE mode; `is_muted` and reach's mute are reads of it

WHAT THIS VITAL DOES NOT OWN: whether the mind writes the RIGHT order from a conversation (that is
the order-brain's own gates) — S3 stubs the mind so the claim under test is "sombra changes nothing
upstream of the mouth", measured through the real run_turn, the real fact/card writers and the real
`orders_tool.place_order` park path.

Run on prod as root, against the rehearsal clone (phase 2, RLS-ON):
    source deploy/harness/rehearsal_env.sh
    PYTHONPATH=. venv/bin/python tests/vital_sombra.py
"""
import asyncio
import json
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import actions as rt_actions  # noqa: E402
import agent_reply  # noqa: E402
import db  # noqa: E402
import demo_call  # noqa: E402
import duties  # noqa: E402
import gate  # noqa: E402
import orders_tool  # noqa: E402
import presence  # noqa: E402
import reach  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import twilio_wa  # noqa: E402
import voice_reply  # noqa: E402
import whatsapp_cloud as wc  # noqa: E402
import worker  # noqa: E402

PHONE = "+34999006010"          # the party in sombra
PHONE_B = "+34999006011"        # the party used to prove the override direction
# a REAL-shaped ES mobile: place_call_to validates the number before anything else, so the call lock
# needs a number that would genuinely dial (the +34999… test range never parses as valid).
PHONE_C = "+34611000902"
SCOPE = runtime.scope_of(PHONE)
SCOPE_B = runtime.scope_of(PHONE_B)
SCOPE_C = runtime.scope_of(PHONE_C)
APP = gate.app_scope("")        # the app-wide default's own row
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


async def _wipe(scope):
    async with db.scoped_tx(scope) as con:
        # children of `event` first (B2's pursuit tab references the transition that opened it)
        for t in ("assembly_snapshot", "timer", "open_loop", "action", "fact", "summary",
                  "wake", "pending_turn", "event", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", scope)
        await con.execute("delete from scope_node where scope=$1::ltree", scope)


async def _count(scope, sql, *args):
    async with db.control_pool().acquire() as con:
        return await con.fetchval(sql, scope, *args) or 0


async def _msg_sent(scope):
    return await _count(scope, "select count(*) from event where scope=$1::ltree and type='msg.sent'")


async def _held_events(scope):
    async with db.control_pool().acquire() as con:
        rows = await con.fetch("select payload from event where scope=$1::ltree and type='sombra.held' "
                               "order by id", scope)
    return [_js(r["payload"]) for r in rows]


async def _drafts(scope):
    async with db.control_pool().acquire() as con:
        rows = await con.fetch("select id, payload, reason, needs_human, money, state from action "
                               "where scope=$1::ltree and kind='draft' order by id", scope)
    return [dict(r) | {"payload": _js(r["payload"])} for r in rows]


# ── the mind stub: exactly what §5.5 says the mind KEEPS doing in sombra ──────────────────────────
_MIND_CALLS = []
DRAFTED = "Te confirmo: 12 kg de rocoto para el jueves. ¿Te va bien por la mañana?"


async def _stub_mind(phone, system, msgs, person, lang, place_call_fn=None, egress_stub=False, **kw):
    """The mind, minus the model. It does the world-writing half for real — it extracts the order
    from the human's own message and parks it for review through the REAL orders_tool, and it hands
    back a fact to persist — so S3 measures the actual pipeline, not a mock of it."""
    _MIND_CALLS.append(phone)
    scope = runtime.scope_of(phone)
    await orders_tool.place_order(
        scope,
        {"lines": [{"sku": "sku_rocoto_500", "name": "Rocoto en tarro 500g", "qty": 12,
                    "unit": "kg", "price": 4.2, "line_total": 50.4}],
         "total": 50.4, "currency": "eur"},
        approved=False)
    return {"text": DRAFTED, "actions": [], "force_text": False,
            "pending_facts": ["No les queda salsa de rocoto picante hasta la semana que viene."],
            "reasoning": "sombra-stub: extraje el pedido y lo dejé en revisión"}


# ── rail spies: nothing may reach a rail while the mouth is shut ──────────────────────────────────
class Rails:
    def __init__(self):
        self.calls = []

    def _spy(self, name):
        async def f(*a, **kw):
            self.calls.append((name, a, kw))
            return f"SPY-{name}"
        return f

    def install(self):
        self._orig = {
            "twa.send_whatsapp": twilio_wa.send_whatsapp,
            "twa.send_typing_indicator": twilio_wa.send_typing_indicator,
            "twa.start_outbound_call": twilio_wa.start_outbound_call,
            "wc.send_reaction": wc.send_reaction,
            "wc.send_typing_indicator": wc.send_typing_indicator,
            "wc.send_interactive_buttons": wc.send_interactive_buttons,
            "wc.send_interactive_list": wc.send_interactive_list,
            "vr.tts_ogg": voice_reply.tts_ogg,
        }
        twilio_wa.send_whatsapp = self._spy("twa.send_whatsapp")
        twilio_wa.send_typing_indicator = self._spy("twa.send_typing_indicator")
        twilio_wa.start_outbound_call = self._spy("twa.start_outbound_call")
        wc.send_reaction = self._spy("wc.send_reaction")
        wc.send_typing_indicator = self._spy("wc.send_typing_indicator")
        wc.send_interactive_buttons = self._spy("wc.send_interactive_buttons")
        wc.send_interactive_list = self._spy("wc.send_interactive_list")
        voice_reply.tts_ogg = self._spy("vr.tts_ogg")
        return self

    def restore(self):
        twilio_wa.send_whatsapp = self._orig["twa.send_whatsapp"]
        twilio_wa.send_typing_indicator = self._orig["twa.send_typing_indicator"]
        twilio_wa.start_outbound_call = self._orig["twa.start_outbound_call"]
        wc.send_reaction = self._orig["wc.send_reaction"]
        wc.send_typing_indicator = self._orig["wc.send_typing_indicator"]
        wc.send_interactive_buttons = self._orig["wc.send_interactive_buttons"]
        wc.send_interactive_list = self._orig["wc.send_interactive_list"]
        voice_reply.tts_ogg = self._orig["vr.tts_ogg"]

    def reset(self):
        self.calls.clear()
        return self


async def main():
    await db.init()
    duties.invalidate_cache()
    await _wipe(SCOPE)
    await _wipe(SCOPE_B)
    await _wipe(SCOPE_C)
    await gate.set_mode(APP, None)

    async with db.scoped_tx(SCOPE) as con:
        await spine.resolve_chat_scope(con, None, "wa", PHONE, display_name="Bar Sombra",
                                       scope_override=SCOPE)
    async with db.scoped_tx(SCOPE_B) as con:
        await spine.resolve_chat_scope(con, None, "wa", PHONE_B, display_name="Bar Luz",
                                       scope_override=SCOPE_B)

    # ══ S1 — ONE FIELD ═══════════════════════════════════════════════════════════════════════════
    print("\n── S1 · one field, not five ──")
    async with db.control_pool().acquire() as con:
        cols = {r["column_name"] for r in await con.fetch(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='scope_state'")}
    ck("scope_state carries `mode`", "mode" in cols, f"cols={sorted(cols)}")
    ck("`muted` is GONE (a stale reader fails loud, never half-true)", "muted" not in cols)
    ck("`takeover_active` is GONE (it was the same bit written twice)", "takeover_active" not in cols)

    bad = None
    try:
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("insert into scope_state(scope,mode) values($1::ltree,'quiet') "
                              "on conflict (scope) do update set mode='quiet'", SCOPE)
    except Exception as e:  # noqa: BLE001
        bad = type(e).__name__
    ck("the DATABASE refuses a mode outside {auto,sombra}", bad is not None, f"raised={bad}")
    ck("gate.normalize_mode refuses it too, and reads '' as inherit",
       gate.normalize_mode("") is None and gate.normalize_mode("sombra") == "sombra"
       and _raises(lambda: gate.normalize_mode("quiet")))

    # ══ S2 — THE RESOLUTION ══════════════════════════════════════════════════════════════════════
    print("\n── S2 · app-wide default, per-customer override, per-customer wins ──")
    await gate.set_mode(SCOPE, None)
    v = await gate.effective_mode(SCOPE)
    ck("no rows anywhere → auto (the employee speaks by default)",
       v["mode"] == gate.AUTO and v["source"] == "default", str(v))

    await gate.set_app_mode(gate.SOMBRA)
    v = await gate.effective_mode(SCOPE)
    vb = await gate.effective_mode(SCOPE_B)
    ck("app-wide sombra is INHERITED by every party with no override of its own",
       v["mode"] == gate.SOMBRA and v["source"] == "app"
       and vb["mode"] == gate.SOMBRA and vb["source"] == "app", f"{v['source']}/{vb['source']}")

    await gate.set_mode(SCOPE_B, gate.AUTO)
    vb = await gate.effective_mode(SCOPE_B)
    ck("a per-customer 'auto' BEATS an app-wide sombra (this one customer still gets answered)",
       vb["mode"] == gate.AUTO and vb["source"] == "customer", str(vb))

    await gate.set_app_mode(gate.AUTO)
    await gate.set_mode(SCOPE, gate.SOMBRA)
    v = await gate.effective_mode(SCOPE)
    ck("a per-customer 'sombra' BEATS an app-wide auto (the override wins in BOTH directions)",
       v["mode"] == gate.SOMBRA and v["source"] == "customer", str(v))

    await gate.set_mode(SCOPE_B, None)
    await gate.set_app_mode(gate.SOMBRA)
    vb = await gate.effective_mode(SCOPE_B)
    ck("clearing an override RE-INHERITS (it is a different state from pinning 'auto')",
       vb["mode"] == gate.SOMBRA and vb["source"] == "app" and vb["own"] is None, str(vb))
    await gate.set_app_mode(gate.AUTO)

    # ══ S3 — THE MIND STILL RUNS ═════════════════════════════════════════════════════════════════
    print("\n── S3 · in sombra the mind runs FULLY; only the mouth stops ──")
    rails = Rails().install()
    real_mind = agent_reply._run_mind
    agent_reply._run_mind = _stub_mind
    try:
        await gate.set_mode(SCOPE, gate.SOMBRA)
        _MIND_CALLS.clear()
        out = await runtime.run_turn(PHONE, "ponme 12 kg de rocoto para el jueves",
                                     dedupe_key="vital-sombra-in-1")
        ck("the turn reports itself SUPPRESSED and hands back no text",
           out.get("suppressed") is True and out.get("text") == "", str(out.get("text"))[:60])
        ck("the MIND ran (it was not short-circuited upstream — sombra is not a mute of the brain)",
           _MIND_CALLS == [PHONE], str(_MIND_CALLS))

        inbound = await _count(SCOPE, "select count(*) from event where scope=$1::ltree "
                                      "and type='message' and lane='world'")
        ck("the inbound SENSE was ingested as always", inbound >= 1, f"message events={inbound}")

        snap = await _count(SCOPE, "select count(*) from assembly_snapshot where scope=$1::ltree")
        ck("the FOLD was assembled and snapshotted (the why-trace is intact in sombra)", snap >= 1)

        async with db.control_pool().acquire() as con:
            fact = await con.fetchval(
                "select text from fact where scope=$1::ltree and invalid_at is null "
                "and text ilike '%salsa de rocoto%' limit 1", SCOPE)
            card = await con.fetchval("select body from card where scope=$1::ltree", SCOPE)
        ck("the FACT the mind learned was persisted (§5.5's own example: a stock/assortment fact)",
           bool(fact), (fact or "")[:60])
        ck("the CARD was rebuilt from it (cards/facts/tabs keep moving)",
           bool(card) and "rocoto" in (card or "").lower(), (card or "")[:70].replace("\n", " | "))

        async with db.control_pool().acquire() as con:
            parked = await con.fetchrow(
                "select id, payload, needs_human, state from action where scope=$1::ltree "
                "and kind='place_order' order by id desc limit 1", SCOPE)
            order_ev = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='order.parked'", SCOPE)
        ck("the ORDER extracted from the human's own message is on the review sheet, reviewable",
           parked is not None and parked["needs_human"] is True and parked["state"] == "pending",
           f"action={parked['id'] if parked else None}")
        ck("…and it is EVENTED (order.parked) — the boss can see it happened, not just infer it",
           order_ev >= 1, f"order.parked={order_ev}")

        review = [a for a in await runtime.review_list(200) if a["scope"] == SCOPE]
        ck("both the order AND the held draft surface on the SAME review sheet",
           any(a["kind"] == "place_order" for a in review) and any(a["kind"] == "draft" for a in review),
           f"kinds={sorted({a['kind'] for a in review})}")

        sent = await _msg_sent(SCOPE)
        ck("ZERO outbound events on the scope (no msg.sent — he did not speak)", sent == 0, f"msg.sent={sent}")
        ck("ZERO rail calls (nothing reached WhatsApp/Twilio at all)", rails.calls == [],
           str([c[0] for c in rails.calls]))

        # ══ S5 — THE DRAFT ═══════════════════════════════════════════════════════════════════════
        print("\n── S5 · a draft is produced, and not sent ──")
        d = await _drafts(SCOPE)
        ck("exactly one draft row, needs_human, not money",
           len(d) == 1 and d[0]["needs_human"] is True and d[0]["money"] is False, f"n={len(d)}")
        ck("the draft carries the sentence VERBATIM (the boss can read/tap what he would have said)",
           bool(d) and d[0]["payload"].get("draft") == DRAFTED,
           (d[0]["payload"].get("draft", "") if d else "")[:60])
        ck("the draft names WHY it was held (customer override vs app-wide)",
           bool(d) and d[0]["payload"].get("mode_source") == "customer",
           d[0]["payload"].get("mode_source") if d else "")
        h = await _held_events(SCOPE)
        ck("the LOG says he decided to speak and was held (`sombra.held`, reasoning lane)",
           len(h) == 1 and h[0].get("draft") == DRAFTED, f"held events={len(h)}")

        # ══ S4 — THE WHOLE MOUTH ═════════════════════════════════════════════════════════════════
        print("\n── S4 · the whole mouth, not just prose ──")
        rails.reset()
        before = await _msg_sent(SCOPE)

        sid = await rt_actions.send_whatsapp_as_rocoto(SCOPE, "un mensaje que no debe salir")
        ck("message: send_whatsapp_as_rocoto returns no SID (none was earned) and hits no rail",
           sid is None and rails.calls == [], f"sid={sid} rails={[c[0] for c in rails.calls]}")

        sid_m = await rt_actions.send_whatsapp_as_rocoto(SCOPE, "mira esto",
                                                        media_url="https://x/y.jpg")
        ck("media: the same door holds a photo/document send", sid_m is None and rails.calls == [])

        rx = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.WHATEVER.1", "👍")
        ck("reaction: PRESENCE is speech too (§5.5 'no messages, no reactions')",
           rx.get("ok") is False and rx.get("reason", "").startswith("sombra") and rails.calls == [],
           str(rx.get("reason")))

        ia = await rt_actions.send_interactive_as_rocoto(
            SCOPE, "¿Te lo llevo el jueves?", [{"title": "Sí"}, {"title": "Mejor el viernes"}])
        ck("one-tap question: held BEFORE the money gate, nothing offered",
           ia.get("ok") is False and str(ia.get("reason", "")).startswith("sombra") and rails.calls == [],
           str(ia.get("reason")))

        _typing_flag = getattr(__import__("config"), "ROCOTO_TYPING_INDICATOR_ENABLED", False)
        __import__("config").ROCOTO_TYPING_INDICATOR_ENABLED = True
        await voice_reply._fire_typing("wamid.INBOUND.1", PHONE)
        __import__("config").ROCOTO_TYPING_INDICATOR_ENABLED = _typing_flag
        ck("typing + blue ticks: a '…escribiendo' bubble is a promise he must not make",
           rails.calls == [], str([c[0] for c in rails.calls]))

        vn = await voice_reply.send_voice_reply(PHONE, "esto tampoco sale")
        ck("voice note: held BEFORE TTS (a held send costs no ElevenLabs generation)",
           vn is None and rails.calls == [], str([c[0] for c in rails.calls]))

        tr = await voice_reply.send_text_reply(PHONE, "ni por el raíl de texto")
        ck("text rail: the last door on the direct path is shut too",
           tr is None and rails.calls == [], str([c[0] for c in rails.calls]))

        await gate.set_mode(SCOPE_C, gate.SOMBRA)
        call_err = None
        try:
            await demo_call.place_call_to(PHONE_C)
        except Exception as e:  # noqa: BLE001
            call_err = str(e)
        ck("call: place_call_to RAISES so the mind is TOLD (it must stop promising a call)",
           call_err == "modo_sombra" and rails.calls == [], f"err={call_err}")
        ck("…and the refused call is on ITS party's review sheet as a draft too",
           len(await _drafts(SCOPE_C)) == 1, f"drafts={len(await _drafts(SCOPE_C))}")

        after = await _msg_sent(SCOPE)
        ck("across the WHOLE mouth: still zero msg.sent events on the scope",
           after == before == 0, f"before={before} after={after}")
        n_drafts = len(await _drafts(SCOPE))
        ck("every held send left a reviewable draft behind (nothing vanished silently)",
           n_drafts == 7, f"drafts={n_drafts} (turn + message + media + reaction + interactive "
                          f"+ voice + text; typing leaves none — there is no gesture to review)")

        # ══ S7 — THE HUMAN'S MOUTH ═══════════════════════════════════════════════════════════════
        print("\n── S7 · sombra silences ROCOTO, never the boss ──")
        rails.reset()
        ov = await rt_actions.send_whatsapp_as_rocoto(SCOPE, "te escribo yo, el jefe", override=True)
        ck("the §15.4 override rail SHIPS in sombra (the human's own mouth is untouched)",
           ov is not None and any(c[0] == "twa.send_whatsapp" for c in rails.calls),
           f"sid={ov} rails={[c[0] for c in rails.calls]}")

        # ══ S8 — FLIP MID-CONVERSATION ═══════════════════════════════════════════════════════════
        print("\n── S8 · a flip mid-conversation is respected on the very next turn ──")
        rails.reset()
        await gate.set_mode(SCOPE_B, None)
        await gate.set_app_mode(gate.AUTO)
        out1 = await runtime.run_turn(PHONE_B, "hola, ¿me lo traes mañana?", dedupe_key="vs-b-1")
        ck("turn 1 in AUTO speaks", out1.get("suppressed") is False and out1.get("text") == DRAFTED,
           str(out1.get("suppressed")))

        await gate.set_mode(SCOPE_B, gate.SOMBRA)
        out2 = await runtime.run_turn(PHONE_B, "y añádeme dos cajas", dedupe_key="vs-b-2")
        ck("flip → SOMBRA: the NEXT turn is held, no restart, no cache to go stale",
           out2.get("suppressed") is True and out2.get("text") == "")

        await gate.set_mode(SCOPE_B, gate.AUTO)
        out3 = await runtime.run_turn(PHONE_B, "vale, ¿y el precio?", dedupe_key="vs-b-3")
        ck("flip back → AUTO: he speaks again on the next turn",
           out3.get("suppressed") is False and out3.get("text") == DRAFTED)
        sent_b = await _msg_sent(SCOPE_B)
        ck("exactly the two auto turns are on the log as msg.sent (the sombra one is not)",
           sent_b == 2, f"msg.sent={sent_b}")
        held_b = await _held_events(SCOPE_B)
        ck("…and exactly one sombra.held marks the turn he was held", len(held_b) == 1, f"held={len(held_b)}")

        # ══ S6 — A PROACTIVE RUNG ════════════════════════════════════════════════════════════════
        print("\n── S6 · the proactive chase is held too, and the ladder still climbs ──")
        await _rung_check(rails, ck)

        # ══ S10 — LEGACY = VIEWS ═════════════════════════════════════════════════════════════════
        print("\n── S10 · the old half-toggles are VIEWS of the one field ──")
        await gate.set_mode(SCOPE, None)
        await gate.set_app_mode(gate.AUTO)
        await runtime.set_takeover(SCOPE, True)
        v = await gate.effective_mode(SCOPE)
        ck("takeover ON writes THE mode (a human holding the thread == this scope is in sombra)",
           v["mode"] == gate.SOMBRA and v["own"] == gate.SOMBRA, str(v))
        ck("runtime.is_muted is a READ of it, not a column", await runtime.is_muted(SCOPE) is True)
        async with db.scoped_tx(SCOPE) as con:
            dec = await reach.choose_channel(con, SCOPE, intent="nudge")
        ck("reach's ladder holds on it too (no proactive touch chosen while the mouth is shut)",
           dec["channel"] == "hold" and dec["muted"] is True, str(dec["reason"]))

        await runtime.set_takeover(SCOPE, False)
        v = await gate.effective_mode(SCOPE)
        ck("handback CLEARS the override (falls back to the app-wide default, never pins 'auto')",
           v["own"] is None and v["mode"] == gate.AUTO, str(v))
        wakes = await _count(SCOPE, "select count(*) from wake where scope=$1::ltree and reason='takeover_end'")
        ck("…and still arms the takeover_end wake (WP-1 behaviour preserved)", wakes >= 1, f"wakes={wakes}")

        await db.set_elevenlabs_enabled(PHONE, False)
        v = await gate.effective_mode(SCOPE)
        ck("the per-customer voice toggle moves THE mode (it decided nothing at all after B3)",
           v["mode"] == gate.SOMBRA and v["own"] == gate.SOMBRA, str(v))
        ck("…and reads back through it", await db.get_elevenlabs_enabled(PHONE) is False)
        st = await db.get_customer_settings(PHONE)
        ck("the customer-settings read the app renders reports mode + WHY",
           st["elevenlabs_autoreply_enabled"] is False and st["mode"] == gate.SOMBRA
           and st["mode_source"] == "customer", str({k: st[k] for k in ("mode", "mode_source")}))
        await db.set_elevenlabs_enabled(PHONE, True)
        ck("flipping it back re-opens the mouth",
           (await gate.effective_mode(SCOPE))["mode"] == gate.AUTO)

        # ══ S9 — FAIL-CLOSED ═════════════════════════════════════════════════════════════════════
        print("\n── S9 · a mode we cannot read is SOMBRA, loudly ──")
        real_read = gate._read_mode

        async def _broken(scope, con=None):
            raise RuntimeError("db down")

        gate._read_mode = _broken
        try:
            v = await gate.effective_mode(SCOPE)
            b = await gate.blocked(SCOPE, "message")
        finally:
            gate._read_mode = real_read
        ck("an unreadable mode answers SOMBRA (a held send is recoverable; a sent one is not)",
           v["mode"] == gate.SOMBRA and v["source"] == "fail_closed" and b is not None, str(v))
        ck("…and the normal answer comes straight back once the read works",
           (await gate.effective_mode(SCOPE))["mode"] == gate.AUTO)
    finally:
        agent_reply._run_mind = real_mind
        rails.restore()
        await gate.set_mode(APP, None)

    passed = sum(R)
    print(f"\nMODO SOMBRA (B6): {passed}/{len(R)}")
    return 0 if passed == len(R) else 1


def _raises(fn):
    try:
        fn()
        return False
    except Exception:
        return True


async def _rung_check(rails, ck):
    """The worker's proactive chase, through the REAL tick: open a follow-up tab via the generic
    binder, pull its first rung due, put the scope in sombra, run one worker pass. The rung must be
    HELD (drafted, no rail) and the ladder must still REARM — sombra pauses the mouth, not the
    follow-up."""
    rails.reset()
    await gate.set_mode(SCOPE, gate.SOMBRA)
    before = await _msg_sent(SCOPE)   # S7's override legitimately wrote one — measure the DELTA
    payload = {"promise_key": "vital-sombra-rung", "name": "Bar Sombra",
               "promise": "pasarte el pedido cerrado con precios"}
    async with db.scoped_tx(SCOPE) as con:
        eid, _ = await spine.append_event(con, SCOPE, "call.promise", "postcall", payload)
        await duties.react_to_sense(con, SCOPE, "call.promise", payload, opened_by_event=eid)
        tab = await con.fetchrow(
            "select l.id, t.id as timer_id from open_loop l join timer t on t.loop_id=l.id "
            "and t.state='armed' where l.scope=$1::ltree and l.entity_key=$2 and l.status='open'",
            SCOPE, "followup:vital-sombra-rung")
    if tab is None:
        ck("worker rung: a follow-up tab with an armed rung exists to fire", False, "no tab opened")
        return
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("update timer set fires_at = now() - interval '1 minute' where id=$1",
                          tab["timer_id"])

    orig = (worker._verify_branch, reach.choose_channel, presence.quiet_now)

    async def _verify(con, **kw):
        return True

    async def _freeform(con, scope, intent="nudge", has_email=False, **kw):
        return {"channel": "freeform"}

    worker._verify_branch = _verify
    reach.choose_channel = _freeform
    presence.quiet_now = lambda now=None: False
    try:
        fired = await worker.run_once(db.control_pool())
    finally:
        worker._verify_branch, reach.choose_channel, presence.quiet_now = orig

    sent = await _msg_sent(SCOPE) - before
    async with db.control_pool().acquire() as con:
        rearmed = await con.fetchval(
            "select count(*) from timer where loop_id=$1 and state='armed'", tab["id"]) or 0
        drafted = await con.fetchval(
            "select count(*) from action where scope=$1::ltree and kind='draft' "
            "and payload->>'origin'='timer'", SCOPE) or 0
    ck("worker rung: the timer FIRED (the tick ran for real)", fired >= 1, f"fired={fired}")
    ck("worker rung: nothing reached the rail and no NEW msg.sent was written",
       not any(c[0] == "twa.send_whatsapp" for c in rails.calls) and sent == 0,
       f"rails={[c[0] for c in rails.calls]} new msg.sent={sent}")
    ck("worker rung: the chase sentence is on the review sheet as a draft", drafted >= 1,
       f"timer drafts={drafted}")
    ck("worker rung: the LADDER still climbed (sombra pauses the mouth, not the follow-up)",
       rearmed >= 1, f"armed timers on the tab={rearmed}")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
