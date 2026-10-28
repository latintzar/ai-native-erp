"""vital_incall.py — THE IN-CALL RUNTIME vital (IN-CALL-RUNTIME-DESIGN §9.2). Deterministic (stubbed R1).

Drives the REAL /api/voice/chat endpoint function across MULTIPLE turns — awaiting the off-path
background tasks between turns so the pin refresh actually runs (the surface where review C1 lived).
No phone, no ElevenLabs, no live model: voice_protocol._anthropic is monkeypatched to a scripted
client that also CAPTURES the grounding each turn (so continuity can be asserted on what the mind SAW).

Scenarios (each maps to a confirmed review finding; 2026-07-25 job-brief rework: the canned nc-pitch
branches are RETIRED — stage behaviour is the JOB BRIEF's, riding the R1 SYSTEM slot):
  1. NO-REPEAT (C1)      — 3 order-ish turns, no catalogue, empty R1: no canned stage text, the CADETE
                            brief rides the SYSTEM slot, nothing repeats verbatim — ACROSS the pin rebuild.
  2. GATED REJOIN (C2)   — an aside.resolved whose answer carries an off-book price: the euro figure is
                            NEVER voiced; aside.delivered records gated=true.
  3. TAB-SAFE FOLD       — an open tab (dict, price: entity_key) rides the fold: no crash, no fallback.
  4. CROSS-CALL RESET(H1)— call.ended re-arms the per-call guards (last_reply) for the NEXT call.
  5. CONTINUITY (§15)    — a WhatsApp message mid-call reaches the NEXT voice turn's grounding as
                            AHORA MISMO; the chat fold carries the live-call block.
  6. FAULT INJECTION     — a broken R1 client still yields a non-empty holding line (never dead air).
  7. CREATOR OPENER (T1) — the ring-time pin resolves tier=creator + loads the CARD; turn-1 opener is the
                            creator ROLE-BLOCK line ('probamos'), never the demo lead-qual framing.
  8. CREATOR TURN (T1)   — DRIVEN THROUGH THE REAL ENDPOINT with a creator caller: the SYSTEM slot carries
                            the CREADOR-Y-FUNDADOR role-block + FOUNDER brief; the creator turns never sell.
  9. NO-CAT PROSPECT(T2) — order dictation with no catalogue: the CADETE brief + no-catalogue note ride the
                            SYSTEM slot, a BLUFFED off-book € is gate-parked (never voiced), no dead air,
                            and the grounding never fabricates a catalogue block.
 10. PROCESS-MONEY (C2)  — a background PROCESS (fabric) whose result carries an off-book € is gated at the
                            mouth: the figure never reaches the next turn (the fabric/process form of C2;
                            Scenario 2 covers the aside-rejoin form).
 11. CALL-END REFLEXES   — driven through the REAL call-end seams: presence_call.call_ended fires the binder
                            → report_call debrief tab OPENS (callreport:{call_id}, r1_debrief armed); the
                            call-end path's call.promise sense → follow_up tab OPENS (r1_chase armed).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_incall.py
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

import app as app_mod  # noqa: E402
import assemble as assemble_mod  # noqa: E402
import db  # noqa: E402
import presence_call  # noqa: E402
import spine  # noqa: E402
import voice_fabric  # noqa: E402
import voice_protocol  # noqa: E402

PHONE = "+34999000788"
DIGITS = "34999000788"
SCOPE = f"wa.{DIGITS}"
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _user_of(call_kw):
    """The USER grounding text of a captured FakeR1 request (never the system prompt — SOUL vocabulary
    lives in the system overlay, so 'catálogo'/etc. there must not fool a grounding assertion)."""
    for m in (call_kw.get("messages") or []):
        if m.get("role") == "user":
            return str(m.get("content") or "")
    return ""


def _sys_of(call_kw):
    """The SYSTEM slot as TEXT — the prompt-cache wiring passes a list of blocks (str before it);
    str(list) would repr-escape newlines and break multi-line assertions."""
    s = call_kw.get("system", "")
    if isinstance(s, str):
        return s
    return "\n\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in (s or []))


# ── the scripted R1 client: deterministic replies + captured grounding ─────────────────────────
class _FakeResp:
    def __init__(self, text):
        class B:  # one text block, the shape _r1_classify_reply reads
            type = "text"
        b = B(); b.text = text
        self.content = [b]


class FakeR1:
    """Replays a script; records every request's system+user content for grounding assertions."""
    def __init__(self, script):
        self.script = list(script)
        self.calls = []

        class _M:
            def __init__(self, outer): self._o = outer
            async def create(self, **kw):
                self._o.calls.append(kw)
                txt = self._o.script.pop(0) if self._o.script else "Vale, dime."
                return _FakeResp(txt)
        self.messages = _M(self)


class BrokenR1:
    class _M:
        async def create(self, **kw):
            raise RuntimeError("scripted R1 failure")
    def __init__(self): self.messages = self._M()


async def _clean_scope(scope):
    """Wipe the 10 runtime tables for ONE scope + drop its process-local voice pin/lock (so a new
    scenario seeds a truly empty world — the empty clone helps, but a leaked tab/timer would bleed
    into a later scenario's counts)."""
    async with db.scoped_tx(scope) as con:
        for t in ("action","timer","wake","pending_turn","open_loop","event","fact","summary","card","scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", scope)
    app_mod._VOICE_PINS.pop(scope, None)
    app_mod._VOICE_LOCKS.pop(scope, None)


async def _clean():
    await _clean_scope(SCOPE)


async def _drive(utterance, caller=PHONE):
    """One REAL endpoint turn + await the off-path tasks (pin rebuild, recall-ahead, telemetry).
    `caller` lets a scenario drive a DIFFERENT party scope (e.g. a creator-tier turn)."""
    before = set(asyncio.all_tasks())
    resp = await app_mod.api_voice_chat({"messages": [{"role": "user", "content": utterance}],
                                         "caller": caller, "stream": False})
    pend = [t for t in (asyncio.all_tasks() - before) if t is not asyncio.current_task() and not t.done()]
    if pend:
        await asyncio.gather(*pend, return_exceptions=True)
    body = json.loads(bytes(resp.body))
    return body["choices"][0]["message"]["content"]


async def main():
    await db.init()
    # ── 1. NO-REPEAT across the off-path pin rebuild (C1: the 07-22 parrot) — 2026-07-25: the canned
    #      nc-pitch is RETIRED; behaviour is the JOB BRIEF's (system slot). Empty R1 → the neutral floor,
    #      and nothing repeats verbatim (the repetition guard), across the off-path pin rebuild. ───────
    await _clean()
    fake = FakeR1(["", "", ""])   # R1 returns empty → the structural floor decides (no canned stage script)
    voice_protocol._anthropic = lambda: fake
    r1 = await _drive("quiero un pedido de dos cajas de tomate")
    r2 = await _drive("ponme también tres kilos de queso")
    r3 = await _drive("y quiero otro pedido de cajas")
    ck("canned pitch is retired — no scripted stage text spoken by the runtime",
       all("me lo apunto todo" not in r.lower() for r in (r1, r2, r3)),
       f"lens={[len(x) for x in (r1, r2, r3)]}")
    ck("the CADETE job brief rides the R1 SYSTEM slot on every no-catalogue turn",
       fake.calls and all("EL CADETE" in _sys_of(c) for c in fake.calls),
       f"calls={len(fake.calls)}")
    ck("no verbatim repeat in consecutive turns", r1 != r2 and r2 != r3)
    async with db.scoped_tx(SCOPE) as con:
        n_started = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='ops.voice_turn' "
            "and payload->>'turn_seq' is not null", SCOPE)
    ck("telemetry carries turn_seq (decision trace live)", (n_started or 0) >= 3, f"rows={n_started}")

    # ── 2. GATED REJOIN (C2: money never leaves the mouth ungated) ─────────────────────────────
    await _clean()
    fake = FakeR1(["Vale, un segundo."])
    voice_protocol._anthropic = lambda: fake
    async with db.scoped_tx(SCOPE) as con:
        await spine.append_event(con, SCOPE, "aside.resolved", "voice",
                                 {"action_id": None, "answer": "te lo puedo dejar a 3,20 € el kilo",
                                  "delivered": False}, lane="reasoning")
    r = await _drive("hola, ¿qué tal?")
    ck("off-book euro figure NOT voiced on rejoin", "3,20" not in r, f"reply={r[:90]!r}")
    ck("rejoin still lands (Ya lo tengo)", "ya lo tengo" in r.lower())
    async with db.scoped_tx(SCOPE) as con:
        gated = await con.fetchval(
            "select payload->>'gated' from event where scope=$1::ltree and type='aside.delivered' "
            "order by id desc limit 1", SCOPE)
    ck("aside.delivered records gated=true", str(gated).lower() == "true", f"gated={gated}")

    # ── 3. TAB-SAFE FOLD (the tab-type fix: dict tabs ride the pin without crashing) ──────────
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await con.execute(
            "insert into open_loop(scope,kind,text,status,entity_key,opened_at) "
            "values($1::ltree,'invoice','factura 2026-1 pendiente','open','price:jamon',now())", SCOPE)
    fake = FakeR1(["Pues mira, el jamón lo tienes como siempre."])
    voice_protocol._anthropic = lambda: fake
    r = await _drive("¿a cuánto está el jamón?")
    ck("open-tab turn does NOT fall to the safe fallback",
       r and voice_protocol._SAFE_FALLBACK not in r, f"reply={r[:80]!r}")
    ck("grounding carried the tab (dict path)", any("factura 2026-1" in str(c) for c in fake.calls))

    # ── 4. CROSS-CALL RESET (H1: call.ended re-arms the per-call guards) — 2026-07-25: the guard that
    #      must re-arm is last_reply (repetition). Same empty-R1 turn in TWO calls: within one call the
    #      identical floor would trip the guard; across the call.ended boundary it must NOT (fresh state),
    #      so call 2 speaks the same floor line, not the 'como te acabo de decir' ack. ─────────────────
    await _clean()
    fake = FakeR1(["", ""])
    voice_protocol._anthropic = lambda: fake
    await presence_call.call_started(PHONE, "vitalcall-1")
    a1 = await _drive("quiero hacer un pedido de cajas")          # floor line (call 1)
    await presence_call.call_ended(PHONE, "vitalcall-1")          # boundary → guards re-arm
    await presence_call.call_started(PHONE, "vitalcall-2")
    a2 = await _drive("quiero hacer un pedido de cajas")          # fresh call → same floor, NOT the ack
    await presence_call.call_ended(PHONE, "vitalcall-2")
    ck("per-call guards re-arm on the NEXT call after call.ended (no cross-call repeat ack)",
       bool(a1.strip()) and a2 == a1 and "como te acabo de decir" not in a2.lower(),
       f"a1={a1[:50]!r} a2={a2[:50]!r}")
    async with db.scoped_tx(SCOPE) as con:
        ns = await con.fetchval("select count(*) from event where scope=$1::ltree and type='call.started'", SCOPE)
        ne = await con.fetchval("select count(*) from event where scope=$1::ltree and type='call.ended'", SCOPE)
    ck("call lifecycle events on the spine", ns == 2 and ne == 2, f"started={ns} ended={ne}")

    # ── 5. CONTINUITY (§15): mid-call WhatsApp reaches the voice fold; chat fold sees the call ─
    await _clean()
    fake = FakeR1(["Claro, dime.", "Sí, lo veo."])
    voice_protocol._anthropic = lambda: fake
    await presence_call.call_started(PHONE, "vitalcall-3")
    await _drive("hola")                                          # turn 1 (builds + refreshes the pin)
    async with db.scoped_tx(SCOPE) as con:                        # WhatsApp text lands MID-CALL
        await spine.append_event(con, SCOPE, "message", "twilio_wa",
                                 {"text": "oye y mándame también dos de burrata"}, lane="world",
                                 actor="human")
    await _drive("¿me has apuntado lo último?")                   # turn 2 rides the refreshed pin
    saw_ahora = any("RIGHT NOW" in str(c) and "burrata" in str(c) for c in fake.calls)
    ck("mid-call WhatsApp reaches the NEXT voice turn (RIGHT NOW / AHORA MISMO)", saw_ahora)
    async with db.scoped_tx(SCOPE) as con:
        fold = await assemble_mod.assemble(con, SCOPE, "hola")
    ck("chat fold carries the live-call block during the call",
       "### RIGHT NOW" in fold.get("rendered", "") and "EN LLAMADA" in fold.get("rendered", ""))
    await presence_call.call_ended(PHONE, "vitalcall-3")
    async with db.scoped_tx(SCOPE) as con:
        fold2 = await assemble_mod.assemble(con, SCOPE, "hola")
    ck("chat fold drops the block after call.ended", "EN LLAMADA" not in fold2.get("rendered", ""))

    # ── 6. FAULT INJECTION: a broken R1 never yields dead air ─────────────────────────────────
    await _clean()
    voice_protocol._anthropic = lambda: BrokenR1()
    r = await _drive("¿a cuánto está el jamón?")
    ck("broken R1 still speaks (holding line, never dead air)", bool(r and r.strip()), f"reply={r[:80]!r}")

    # ── 7. TRACK 1: creator turn-1 opener (WP5.1) — the ring-time pin loads the card + resolves the
    #      creator tier, and the turn-1 greeting is the creator ROLE-BLOCK opener ('probamos'), NOT the
    #      demo lead-qual line ('negocio tienes'). Proves D1 is dead on turn 1, mode-independent. ──────
    import runtime as _rt_mod
    import soul as _soul_mod
    CREATOR_PHONE = _rt_mod._CREATOR.copy().pop() if _rt_mod._CREATOR else "+12025550110"
    CREATOR_DIGITS = "".join(ch for ch in CREATOR_PHONE if ch.isdigit())
    CREATOR_SCOPE = f"wa.{CREATOR_DIGITS}"
    # tier is a PURE function of the number — no DB needed.
    ck("creator number resolves tier=creator", _rt_mod._tier_for(CREATOR_PHONE, {}, "") == "creator")
    # the opener is the role-block line, keyed to tier (situations-as-data).
    op_c = _soul_mod.voice_opener("creator", {}, None, "es")
    ck("creator opener is the role-block line ('probamos', not 'negocio tienes')",
       "probamos" in op_c.lower() and "negocio tienes" not in op_c.lower(), f"opener={op_c!r}")
    op_b = _soul_mod.voice_opener("boss", {}, None, "es")
    ck("boss opener is 'Dime, jefe.'", "jefe" in op_b.lower(), f"opener={op_b!r}")
    op_p = _soul_mod.voice_opener("prospect", {}, {"stage": "prospect"}, "es")
    ck("prospect opener is show-don't-pitch (NOT 'negocio tienes')",
       "negocio tienes" not in op_p.lower() and bool(op_p.strip()), f"opener={op_p!r}")
    # the ring-time pin loads the CARD + the creator opener (D1 dead: card present on turn 1).
    async with db.scoped_tx(CREATOR_SCOPE) as con:
        for t in ("card", "scope_node"):
            await con.execute(f"delete from {t} where scope=$1::ltree", CREATOR_SCOPE)
        await con.execute("insert into card(scope,body,version,regenerated_at) "
                          "values($1::ltree,$2,1,now()) on conflict (scope) do update set body=excluded.body",
                          CREATOR_SCOPE, "Es Peter, tu creador. Prueba el sistema a menudo.")
    app_mod._VOICE_PINS.pop(CREATOR_SCOPE, None)
    pin_c = await app_mod._build_voice_pin(CREATOR_PHONE, CREATOR_SCOPE, "es")
    ck("ring-time pin loads the card on turn 1 (D1 dead)", bool((pin_c.get("card") or "").strip()),
       f"card={pin_c.get('card','')[:40]!r}")
    ck("ring-time pin resolves tier=creator", pin_c.get("tier") == "creator", f"tier={pin_c.get('tier')}")
    ck("ring-time pin opener is the creator role-block line",
       "probamos" in (pin_c.get("opener") or "").lower()
       and "negocio tienes" not in (pin_c.get("opener") or "").lower(), f"opener={pin_c.get('opener')!r}")
    async with db.scoped_tx(CREATOR_SCOPE) as con:
        for t in ("card", "scope_node", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", CREATOR_SCOPE)
    app_mod._VOICE_PINS.pop(CREATOR_SCOPE, None)

    # ── 8. CREATOR TURN THROUGH THE REAL ENDPOINT (Track 1) — driving api_voice_chat with a CREATOR
    #      caller across TWO turns: the ring-time pin resolves tier=creator, so turn-1 grounding carries
    #      BOTH the CREADOR-Y-FUNDADOR role-block (soul._role_block) AND the pinned card; and the creator
    #      turns never sell (no onboarding pitch spoken TO Peter — the 07-23 founder-call bug). ─────────
    await _clean_scope(CREATOR_SCOPE)
    async with db.scoped_tx(CREATOR_SCOPE) as con:
        await con.execute("delete from scope_node where scope=$1::ltree", CREATOR_SCOPE)
        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'creator',null) "
                          "on conflict (scope) do nothing", CREATOR_SCOPE)
        await con.execute("insert into card(scope,body,version,regenerated_at) "
                          "values($1::ltree,$2,1,now()) on conflict (scope) do update set body=excluded.body",
                          CREATOR_SCOPE, "NEGOCIO: banco de pruebas del creador")
    app_mod._VOICE_PINS.pop(CREATOR_SCOPE, None)
    app_mod._VOICE_LOCKS.pop(CREATOR_SCOPE, None)
    fake = FakeR1(["Claro Peter, dime qué probamos.", "Perfecto, seguimos con la prueba."])
    voice_protocol._anthropic = lambda: fake
    c1 = await _drive("hola, ¿qué tienes hoy?", caller=CREATOR_PHONE)
    c2 = await _drive("vale, sigamos con la prueba", caller=CREATOR_PHONE)
    # 2026-07-25 slot fix: identity + the stage JOB BRIEF are SYSTEM bytes on a call (same slot as chat).
    ck("creator turn-1 SYSTEM slot carries the CREATOR role-block (CREADOR Y FUNDADOR)",
       any("CREADOR Y FUNDADOR" in _sys_of(c) for c in fake.calls))
    ck("creator turn-1 SYSTEM slot carries the FOUNDER job brief (ES PETER)",
       any("ES PETER" in _sys_of(c) for c in fake.calls))
    ck("creator turn-1 grounding loads the pinned CARD",
       any("banco de pruebas del creador" in _user_of(c) for c in fake.calls))
    ck("creator turns never sell (no onboarding pitch to the founder)",
       all(m not in (c1 + " " + c2).lower() for m in ("dado de alta", "el fundador de rocoto",
                                                       "me lo apunto todo")), f"c1={c1[:60]!r} c2={c2[:60]!r}")
    async with db.scoped_tx(CREATOR_SCOPE) as con:
        for t in ("card", "scope_node", "event", "open_loop", "timer"):
            await con.execute(f"delete from {t} where scope=$1::ltree", CREATOR_SCOPE)
    app_mod._VOICE_PINS.pop(CREATOR_SCOPE, None)
    app_mod._VOICE_LOCKS.pop(CREATOR_SCOPE, None)

    # ── 9. NO-CATALOGUE PROSPECT (Track 2): order dictation with no catalogue → the CADETE job brief +
    #      no-catalogue note ride the SYSTEM slot every turn (the brief scripts the behaviour; no canned
    #      runtime pitch); a BLUFFED off-book € reply on a money turn is gate-parked (never voiced); no
    #      dead air; and the grounding never fabricates a catalogue block. ──────────────────────────────
    await _clean()
    fake = FakeR1(["", "Te lo dejo a 2,50 € el kilo.", ""])   # t1 empty→floor; t2 a BLUFFED money reply
    voice_protocol._anthropic = lambda: fake                   # on a money turn (gate MUST park); t3 empty
    r1 = await _drive("quiero dos cajas de tomate y tres kilos de queso")
    r2 = await _drive("¿a cuánto me lo dejas la caja?")        # money-flagged (PRICE_Q '/a cuánto/')
    r3 = await _drive("y ponme otra caja")
    ck("the CADETE brief + no-catalogue note ride the SYSTEM slot on every order turn",
       fake.calls and all(("EL CADETE" in _sys_of(c)
                           and "NO TIENES SU CATÁLOGO" in _sys_of(c)) for c in fake.calls),
       f"calls={len(fake.calls)}")
    ck("no BLUFFED price is voiced (gate parks off-book money for a no-catalogue prospect)",
       all("2,50" not in r for r in (r1, r2, r3)), f"r2={r2[:70]!r}")
    ck("no dead air — every no-catalogue turn speaks inline",
       all(bool(r and r.strip()) for r in (r1, r2, r3)), f"lens={[len(x or '') for x in (r1, r2, r3)]}")
    ck("grounding never fabricates a catalogue block (no SKUs seeded → no CATALOGUE listing)",
       not any("### CATALOGUE" in _user_of(c) for c in fake.calls))

    # ── 10. GATE-ON-PROCESS-MONEY (C2, fabric/process form) — a background PROCESS returns an off-book €;
    #       the fabric mouth must gate it so the figure never reaches the next turn. (Scenario 2 covers the
    #       aside-rejoin form of C2; this covers the fabric/process form — mirrors vital_fabric §2.) ─────
    await _clean()
    async def _money_run(scope, utt, ctx, **kw):
        return {"say": "te lo dejo a 4,80 € el kilo", "money": True}
    voice_fabric.register("vital_money_check", trigger=lambda s, u, c: "oferta" in (u or ""),
                          run=_money_run, expected_ms=1000, stall="filler")
    fake = FakeR1(["Voy mirándolo.", "Dime."])
    voice_protocol._anthropic = lambda: fake
    await _drive("¿tienes alguna oferta esta semana?")         # fires vital_money_check in the background
    r2 = await _drive("¿y bien?")                              # its say would ride this turn — gate parks it
    ck("a PROCESS-produced euro figure PARKS at the gate — never voiced (C2 fabric form)",
       "4,80" not in r2, f"r2={r2[:70]!r}")
    voice_fabric._REGISTRY.pop("vital_money_check", None)

    # ── 11. THE TWO CALL-END REFLEXES FIRE (Track 3) — driven through the REAL call-end seams the live
    #       endpoint uses (app.py's WS finally block): presence_call.call_ended INVOKES the generic binder
    #       on `call.ended` → report_call OPENS; the call-end path emits `call.promise` via
    #       runtime.on_duty_sense → follow_up OPENS. Both are DATA (manifest_duty rows), zero situation
    #       code. RED here would mean Track 3's binder wiring regressed. ────────────────────────────────
    import runtime as _rt_reflex
    await _clean()
    CALL = "vitalcall-reflex"
    async with db.scoped_tx(SCOPE) as con:
        tabs_before = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and status='open' "
            "and (entity_key like 'callreport:%' or entity_key like 'followup:%')", SCOPE)
    fake = FakeR1(["Vale, te lo cierro."])
    voice_protocol._anthropic = lambda: fake
    await presence_call.call_started(PHONE, CALL)
    await _drive("quiero cerrar el pedido")                    # a real endpoint turn (utterances on the spine)
    # the REAL seams (NOT a direct react_to_sense) — exactly what app.py does at hangup:
    await presence_call.call_ended(PHONE, CALL, extra={"name": "Bar Pepe",
                                                       "summary": "pidió dos cajas de tomate",
                                                       "next_step": "confirmo stock y le digo"})
    await _rt_reflex.on_duty_sense(SCOPE, "call.promise",
                                   {"promise_key": CALL, "promise": "mandar el catálogo", "name": "Bar Pepe"},
                                   dedupe_key=f"promise:{CALL}", source="voice")
    async with db.scoped_tx(SCOPE) as con:
        rep_tab = await con.fetchrow(
            "select id from open_loop where scope=$1::ltree and entity_key=$2 and status='open'",
            SCOPE, f"callreport:{CALL}")
        rep_timer = await con.fetchval(
            "select branch_id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed' limit 1", SCOPE, f"callreport:{CALL}")
        fup_tab = await con.fetchrow(
            "select id from open_loop where scope=$1::ltree and entity_key=$2 and status='open'",
            SCOPE, f"followup:{CALL}")
        fup_timer = await con.fetchval(
            "select branch_id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed' limit 1", SCOPE, f"followup:{CALL}")
    ck("report_call debrief tab OPENS on call.ended (real presence_call seam) + arms r1_debrief",
       rep_tab is not None and rep_timer == "r1_debrief", f"tab={rep_tab['id'] if rep_tab else None} timer={rep_timer}")
    ck("follow_up tab OPENS on the call.promise sense + arms r1_chase",
       fup_tab is not None and fup_timer == "r1_chase", f"tab={fup_tab['id'] if fup_tab else None} timer={fup_timer}")
    ck("both reflexes fired from the call-end senses, not before",
       (tabs_before or 0) == 0 and rep_tab is not None and fup_tab is not None, f"before={tabs_before}")

    await _clean()
    print(f"\nvital_incall: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
