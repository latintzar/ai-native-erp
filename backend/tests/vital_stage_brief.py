"""vital_stage_brief.py — THE PER-STAGE JOB BRIEFS reach BOTH mouths as SYSTEM bytes (Peter 2026-07-25).

Peter's behaviour spec: "map the stages like JOB DESCRIPTIONS — the prospect-stage employee is a cadet
sent to be at the mercy of these distributors". The rework: lifecycle.BRIEFS is the ONE organ that owns
per-stage behaviour (SITUATIONS ARE DATA — data rows, no runtime branches); lifecycle.notes(st) renders
the brief and BOTH mouths carry it in the SYSTEM slot:
  · chat  — runtime.run_turn appends it to the assembled soul head;
  · voice — the ring-time pin (app._build_voice_pin) pins it; voice_protocol passes it (with the
            persona) into the R1 pass's `system` param — never as counterparty-adjacent user data.

Locks:
  1. DATA — each (stage, tier) renders ITS brief: founder/fresh/prospect(EL CADETE)/onboarded_unpaid/
     onboarded.boss/onboarded.customer/onboarded.colleague; conduct (anti-myopia) on every non-founder
     stage; the no-catalogue note whenever the catalogue is missing.
  2. CHAT — the run_turn system prompt carries the stage brief (prospect → EL CADETE; boss → EMPLEADO
     DE CONFIANZA), byte-identical to lifecycle.notes(status).
  3. VOICE — the ring-time pin carries the brief; the R1 SYSTEM slot carries brief + persona; the USER
     grounding does NOT carry the persona (the 2026-07-25 slot fix).
  4. FOUNDER ON A CALL — a creator-number pin resolves the FOUNDER brief even with no scope_node tier
     (the rt_tier→tier fix in _build_voice_pin).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_stage_brief.py
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

import agent_reply  # noqa: E402
import app as app_mod  # noqa: E402
import db  # noqa: E402
import lifecycle  # noqa: E402
import runtime  # noqa: E402
import voice_protocol  # noqa: E402

PHONE = "+34999001717"
SCOPE = runtime.scope_of(PHONE)
BOSS_PHONE = "+34999001718"
BOSS_SCOPE = runtime.scope_of(BOSS_PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


class _FakeResp:
    def __init__(self, text):
        class B:
            type = "text"
        b = B(); b.text = text
        self.content = [b]


class FakeR1:
    def __init__(self, script):
        self.script = list(script)
        self.calls = []

        class _M:
            def __init__(self, outer): self._o = outer
            async def create(self, **kw):
                self._o.calls.append(kw)
                return _FakeResp(self._o.script.pop(0) if self._o.script else "Vale, dime.")
        self.messages = _M(self)


def _user_of(kw):
    for m in (kw.get("messages") or []):
        if m.get("role") == "user":
            return str(m.get("content") or "")
    return ""


def _sys_text(kw):
    """The R1 system as TEXT — the prompt-cache wiring passes a list of blocks, a plain string before
    it; str(list) would repr-escape newlines and break verbatim-bytes assertions."""
    s = kw.get("system", "")
    if isinstance(s, str):
        return s
    return "\n\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in (s or []))


async def _clean(scope):
    async with db.scoped_tx(scope) as con:
        for t in ("action", "timer", "wake", "pending_turn", "open_loop", "event",
                  "fact", "summary", "card", "scope_state", "scope_node"):
            await con.execute(f"delete from {t} where scope=$1::ltree", scope)
    app_mod._VOICE_PINS.pop(scope, None)
    app_mod._VOICE_LOCKS.pop(scope, None)


async def main():
    await db.init()

    # ── 1. DATA: each (stage, tier) renders ITS job brief (pure — no DB) ────────────────────────
    def st(tier, stage, cat, founder=False):
        return {"tier": tier, "stage": stage, "is_founder": founder, "has_catalogue": cat,
                "has_had_first_call": True, "onboarded": stage.startswith("onboarded"), "n_events": 3}

    n_f = lifecycle.notes(st("creator", "founder", False, founder=True))
    n_fresh = lifecycle.notes(st("prospect", "fresh", False))
    n_p = lifecycle.notes(st("prospect", "prospect", False))
    n_u = lifecycle.notes(st("prospect", "onboarded_unpaid", True))
    n_b = lifecycle.notes(st("boss", "onboarded", True))
    n_c = lifecycle.notes(st("customer", "onboarded", False))
    n_col = lifecycle.notes(st("colleague", "onboarded", True))
    ck("founder → FOUNDER brief (ES PETER + banco de pruebas), no gating, no conduct suffix",
       "ES PETER" in n_f and "BANCO DE PRUEBAS" in n_f and "dado de alta" not in n_f
       and "OFRÉCELE agendar" not in n_f)
    ck("fresh → EL CADETE + PRIMER CONTACTO", "EL CADETE" in n_fresh and "PRIMER CONTACTO" in n_fresh)
    ck("prospect → EL CADETE (the four openings)", "EL CADETE" in n_p and "cuatro" in n_p.lower())
    ck("onboarded_unpaid → founding-offer brief (500 € credit against commission)",
       "OFERTA FUNDADORA" in n_u and "500" in n_u and "comisi" in n_u.lower())
    ck("onboarded boss → EMPLEADO DE CONFIANZA DEL JEFE", "EMPLEADO DE CONFIANZA DEL JEFE" in n_b)
    ck("onboarded customer → EL EMPLEADO QUE LE ATIENDE", "EL EMPLEADO QUE LE ATIENDE" in n_c)
    ck("onboarded colleague → COMPAÑERO DE EQUIPO", "COMPAÑERO DE EQUIPO" in n_col)
    ck("anti-myopia CONDUCT binds every non-founder stage",
       all("CONDUCTA" in n and "TE ATA" in n for n in (n_fresh, n_p, n_u, n_b, n_c, n_col)))
    ck("no-catalogue note appended exactly when the catalogue is missing",
       ("NO TIENES SU CATÁLOGO" in n_p) and ("NO TIENES SU CATÁLOGO" in n_c)
       and ("NO TIENES SU CATÁLOGO" not in n_b) and ("NO TIENES SU CATÁLOGO" not in n_u))

    # ── 2. CHAT MOUTH: run_turn's system prompt carries the stage brief, byte-identical ─────────
    await _clean(SCOPE)
    seen = {}
    orig_mind = agent_reply._run_mind

    async def _mind(phone, system, msgs, person, lang, place_call_fn=None, egress_stub=False, **kw):
        seen["system"] = system
        return {"text": "vale", "force_text": False, "actions": [], "pending_facts": [], "reasoning": ""}

    agent_reply._run_mind = _mind
    try:
        await runtime.run_turn(PHONE, "hola, ¿qué tal?", egress_stub=True)
        chat_sys_prospect = seen.get("system", "")
        exp_prospect = lifecycle.notes(await lifecycle.status(SCOPE, "prospect"))
        ck("chat(prospect): system carries EL CADETE + the no-catalogue note",
           "EL CADETE" in chat_sys_prospect and "NO TIENES SU CATÁLOGO" in chat_sys_prospect)
        ck("chat(prospect): the brief bytes are lifecycle.notes VERBATIM (one organ, one render)",
           exp_prospect in chat_sys_prospect, f"brief_bytes={len(exp_prospect)}")

        await _clean(BOSS_SCOPE)
        async with db.scoped_tx(BOSS_SCOPE) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'boss',null) "
                              "on conflict (scope) do update set tier='boss'", BOSS_SCOPE)
        await runtime.run_turn(BOSS_PHONE, "hola", egress_stub=True)
        ck("chat(boss): system carries the boss job brief",
           "EMPLEADO DE CONFIANZA DEL JEFE" in seen.get("system", ""))
    finally:
        agent_reply._run_mind = orig_mind

    # ── 3. VOICE MOUTH: pin carries the brief; R1 SYSTEM slot carries brief+persona; user does NOT ─
    await _clean(SCOPE)
    pin = await app_mod._build_voice_pin(PHONE, SCOPE, "es")
    ck("voice pin: lc_notes carries the CADETE brief", "EL CADETE" in (pin.get("lc_notes") or ""))
    ck("voice pin: lc_notes is lifecycle.notes VERBATIM for the pinned lifecycle",
       pin.get("lc_notes") == lifecycle.notes(pin.get("lifecycle") or {}))
    fake = FakeR1(["Claro, cuéntame.", "Claro, dime."])
    voice_protocol._anthropic = lambda: fake
    for _attempt in range(2):   # one retry: a transient turn error must not mask the slot wiring
        resp = await app_mod.api_voice_chat({"messages": [{"role": "user", "content": "hola, ¿qué sabes hacer?"}],
                                             "caller": PHONE, "stream": False})
        _ = json.loads(bytes(resp.body))
        if fake.calls:
            break
    vsys = _sys_text(fake.calls[0]) if fake.calls else ""
    vuser = _user_of(fake.calls[0]) if fake.calls else ""
    ck("voice(prospect): R1 SYSTEM slot carries the stage brief (EL CADETE)", "EL CADETE" in vsys)
    ck("voice(prospect): R1 SYSTEM slot carries the persona (QUIÉN ERES Y CON QUIÉN HABLAS)",
       "QUIÉN ERES Y CON QUIÉN HABLAS" in vsys and "PROSPECTO" in vsys)
    ck("voice(prospect): the USER grounding does NOT carry the persona (slot fix)",
       "QUIÉN ERES Y CON QUIÉN HABLAS" not in vuser)
    ck("both mouths carry the SAME brief bytes (the lifecycle.BRIEFS row, verbatim, in both SYSTEM slots)",
       lifecycle.BRIEFS["prospect"] in chat_sys_prospect and lifecycle.BRIEFS["prospect"] in vsys
       and (pin.get("lc_notes") or "") in vsys,
       f"chat={lifecycle.BRIEFS['prospect'] in chat_sys_prospect} "
       f"voice={lifecycle.BRIEFS['prospect'] in vsys} "
       f"pin_notes_in_voice={(pin.get('lc_notes') or '') in vsys} vsys_bytes={len(vsys)}")

    # ── 4. FOUNDER ON A CALL: creator number → FOUNDER brief in the pin (rt_tier→tier fix) ──────
    creator_phone = next(iter(runtime._CREATOR)) if runtime._CREATOR else ""
    if creator_phone:
        c_scope = runtime.scope_of(creator_phone)
        app_mod._VOICE_PINS.pop(c_scope, None)
        c_pin = await app_mod._build_voice_pin(creator_phone, c_scope, "es")
        ck("voice pin(creator number): FOUNDER brief pinned even with no scope_node tier",
           "ES PETER" in (c_pin.get("lc_notes") or "") and c_pin.get("tier") == "creator",
           f"tier={c_pin.get('tier')}")
        app_mod._VOICE_PINS.pop(c_scope, None)
    else:
        ck("voice pin(creator number): SKIP — no ROCOTO_CREATOR_NUMBERS", True)

    await _clean(SCOPE)
    await _clean(BOSS_SCOPE)
    print(f"\nvital_stage_brief: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
