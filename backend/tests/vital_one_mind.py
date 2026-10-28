"""vital_one_mind.py — BLOCK B3: ONE MIND, OR THE CALL FAILS (Peter's order, 2026-07-26).

The 2026-07-26 incident: our mind was dead and calls STILL answered — in the landing demo ConvAI
agent's voice, with its lead-qualification greeting. A hard crash arrived disguised as mediocre
behaviour, and nothing alerted. B3 deletes the fallback outright. This vital locks the two halves of
that law, so it cannot grow back:

  A. NO REACHABLE CODE PATH SELECTS A NON-RUNTIME AGENT.
     - `voice_toggle` has no mode file, no `mode()/set_mode()`, no `demo_agent_id()`, no toggle link.
     - `runtime_agent_id()` RAISES `NoVoiceMind` rather than returning some other id.
     - `ELEVENLABS_DEMO_AGENT_ID` exists nowhere in the backend; `GET /api/voice/toggle` is gone.
     - every `ElevenBridge(...)` on the call path is constructed with an explicit `agent_id=`, and the
       bridge itself REFUSES an empty one (it used to default to the non-runtime template agent).
     - the scripted demo/lead-qual greeting and the neutral "¡Hola! Soy Rocoto." opener fallback are gone.
     - the Polly «Hola, soy Rocoto. Dime tu pedido…» TwiML — Rocoto's name with no mind behind it — can
       no longer be emitted at all, on the inbound OR the outbound leg (no per-customer toggle picks it).

  B. A FORCED PIN/OPENER FAILURE SURFACES + ERRORS RATHER THAN DEGRADING.
     - a broken fold assembly makes `_build_voice_pin` RAISE (it used to `log.debug` and return an
       empty pin, which is precisely how a dead mind kept taking calls);
     - `_ring_pin_or_fail` turns that — and an empty opener — into `VoiceMindUnavailable`
       AND an `ops.record_alert` alert;
     - `_require_voice_mind` does the same when no runtime agent is cached.

SCOPE NOTE (honest): this locks the PHONE-CALL path. `el_convai.py` mints a separate ElevenLabs agent
for the Android "customize your agent" voice session — a different surface, never dialled on a call,
deliberately out of scope here.

No DB fixtures, no network, no model: every failure is injected. Run:
  PYTHONPATH=. venv/bin/python tests/vital_one_mind.py
"""
import ast
import asyncio
import inspect
import os
from pathlib import Path

os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import app as app_mod  # noqa: E402
import config  # noqa: E402
import demo_call  # noqa: E402
import eleven as el_bridge  # noqa: E402
import ops  # noqa: E402
import soul  # noqa: E402
import voice as voice_mod  # noqa: E402
import voice_toggle  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent
R = []


def _strip_comments(src: str) -> str:
    """Source minus its comment lines — so a check cannot pass/fail on the prose that EXPLAINS a
    deletion. (The B3 comments necessarily name the things they deleted.)"""
    return "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))


def _emittable_strings(src: str) -> list[str]:
    """Every string literal the module could actually put on the wire — docstrings excluded."""
    tree = ast.parse(src)
    docs = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", None) or []
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                docs.add(id(body[0].value))
    return [n.value for n in ast.walk(tree)
            if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs]


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ── the alert probe: every fail-loud seam must reach ops.record_alert ────────────────────────
class _AlertProbe:
    """Replaces ops.record_alert and records what was surfaced (the alert is a task — wait for it)."""

    def __init__(self):
        self.calls = []
        self.hit = asyncio.Event()

    async def __call__(self, cls, detail, ref_scope=None):
        self.calls.append({"class": cls, "detail": detail, "scope": ref_scope})
        self.hit.set()
        return {"class": cls, "via": "probe", "alert_id": 0}

    async def wait(self, timeout=2.0) -> bool:
        try:
            await asyncio.wait_for(self.hit.wait(), timeout)
            return True
        except asyncio.TimeoutError:
            return False

    def reset(self):
        self.calls.clear()
        self.hit = asyncio.Event()


async def main():
    # ══ A. NO REACHABLE NON-RUNTIME AGENT ════════════════════════════════════════════════════════
    print("\n── A · no reachable code path selects a non-runtime agent ──")

    gone = [n for n in ("mode", "set_mode", "demo_agent_id", "toggle_link", "toggle_token")
            if hasattr(voice_toggle, n)]
    ck("voice_toggle: mode/set_mode/demo_agent_id/toggle_link/toggle_token are DELETED", not gone,
       f"still present: {gone}" if gone else "")
    ck("voice_toggle: no .voice_mode state file is referenced",
       "_MODE_FILE" not in dir(voice_toggle) and ".voice_mode" not in Path(voice_toggle.__file__).read_text())
    ck("voice_toggle: exposes runtime_agent_id + NoVoiceMind (the fail-loud contract)",
       callable(getattr(voice_toggle, "runtime_agent_id", None))
       and issubclass(getattr(voice_toggle, "NoVoiceMind", type(None)), Exception))

    ck("config: ELEVENLABS_DEMO_AGENT_ID is DELETED", not hasattr(config, "ELEVENLABS_DEMO_AGENT_ID"))

    srcs = {p.name: p.read_text() for p in BACKEND.glob("*.py")}
    users = sorted(n for n, t in srcs.items() if "ELEVENLABS_DEMO_AGENT_ID" in t
                   and not t.split("ELEVENLABS_DEMO_AGENT_ID")[0].rstrip().endswith("#"))
    live_users = sorted(n for n, t in srcs.items()
                        if any("ELEVENLABS_DEMO_AGENT_ID" in ln and not ln.strip().startswith("#")
                               for ln in t.splitlines()))
    ck("no backend module READS a demo/fallback agent id", not live_users,
       f"reads in: {live_users}" if live_users else f"(mentions only in comments: {users})")

    # every ElevenBridge on the call path must be handed OUR agent id explicitly
    tree = ast.parse(srcs["app.py"])
    bridges = [n for n in ast.walk(tree)
               if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
               and n.func.attr == "ElevenBridge"]
    no_agent = [n.lineno for n in bridges if not any(k.arg == "agent_id" for k in n.keywords)]
    ck("every ElevenBridge(...) on the call path passes an explicit agent_id",
       bool(bridges) and not no_agent, f"{len(bridges)} construction(s); bare at lines {no_agent}")

    # the bridge itself must be unable to dial an unnamed (→ config.ELEVENLABS_AGENT_ID) mind
    _ap = inspect.signature(el_bridge.ElevenBridge.__init__).parameters.get("agent_id")
    ck("ElevenBridge: agent_id is a REQUIRED keyword (no '' default → no template-agent fallback)",
       _ap is not None and _ap.default is inspect.Parameter.empty,
       f"default={_ap.default!r}" if _ap is not None else "missing")
    try:
        el_bridge.ElevenBridge(lambda *_a, **_k: None, agent_id="")
        bare_ok = True
    except ValueError:
        bare_ok = False
    ck("ElevenBridge(agent_id='') REFUSES to construct", not bare_ok)
    try:
        await el_bridge._signed_ws_url("")
        url_ok = True
    except ValueError:
        url_ok = False
    ck("_signed_ws_url('') REFUSES (it used to fall back to config.ELEVENLABS_AGENT_ID)", not url_ok)

    # the Polly 'Hola, soy Rocoto' TwiML — Rocoto's name with no mind behind it — must not be emitable
    ck("voice.incoming_twiml has no `eleven` switch left (there is one path)",
       "eleven" not in inspect.signature(voice_mod.incoming_twiml).parameters)
    # scan the CODE, not the prose: the deletion is explained in docstrings, so a raw text search would
    # match its own tombstone. Only string literals the module could actually EMIT count.
    ck("voice.py can no longer emit the Polly second-mind greeting",
       not [t for t in _emittable_strings(srcs["voice.py"])
            if "Dime tu pedido" in t or "Polly." in t])
    _tw = voice_mod.incoming_twiml("+34999000911", eleven_wss_url="wss://x/eleven-stream")
    ck("every answered call gets the <Connect> bridge to the one mind, never a <Say>+<Start> fork",
       "<Connect" in _tw and "<Say" not in _tw and "<Start>" not in _tw, _tw[:70])

    # the OUTBOUND leg is the inbound seam's twin: no per-customer toggle chooses who answers
    _out = inspect.getsource(app_mod.voice_outgoing)
    ck("outbound /twilio/voice/outgoing refuses when the mind is down (fail TwiML, not Polly)",
       "_VOICE_MIND_FAIL_TWIML" in _out and "voice_toggle.available()" in _out)
    ck("...and no longer consults the per-customer elevenlabs_autoreply_enabled toggle",
       "elevenlabs_autoreply_enabled" not in _strip_comments(_out))

    # Included APIRouters can be lazy; inspect the composed HTTP contract.
    routes = app_mod.app.openapi()["paths"]
    ck("GET /api/voice/toggle is DELETED", "/api/voice/toggle" not in routes)
    ck("GET /api/voice/mode is DELETED (there are no modes)", "/api/voice/mode" not in routes)
    ck("GET /api/voice/mind reports the one mind", "/api/voice/mind" in routes)

    # the greetings the incident actually put on the wire
    _sess = demo_call.Session("tok", "+34999000911", "es", "Ana")
    _ov = (demo_call.demo_config_override(_sess) or {}).get("agent") or {}
    ck("demo_config_override returns LANGUAGE ONLY — no first_message key at all",
       "first_message" not in _ov and _ov.get("language") == "es", str(_ov))
    ck("demo_call has no scripted demo/lead-qual greeting left",
       "¿qué negocio tienes?" not in srcs["demo_call.py"]
       and "what kind of business do you run" not in srcs["demo_call.py"])
    ck("place_call_to takes no `greeting` override",
       "greeting" not in inspect.signature(demo_call.place_call_to).parameters)
    pin_src = inspect.getsource(app_mod._build_voice_pin)
    ck("_build_voice_pin has NO neutral-hello opener fallback",
       "¡Hola! Soy Rocoto." not in pin_src and "Hi! It's Rocoto." not in pin_src)
    ck("inbound TwiML no longer degrades to the canned Polly 'soy Rocoto' line",
       "Dime tu pedido después del tono" not in srcs["app.py"])

    # the opener must genuinely exist for every tier, so the raise below is a real guard, not a trap
    tiers = ("creator", "boss", "colleague", "customer", "prospect")
    empty = [(t, lg) for t in tiers for lg in ("es", "en")
             if not (soul.voice_opener(t, {"name": "Ana"}, {"stage": "fresh"}, lg) or "").strip()]
    ck("soul.voice_opener yields a role-block opener for EVERY tier × language", not empty, str(empty))

    # ══ B. FORCED FAILURE SURFACES + ERRORS ══════════════════════════════════════════════════════
    print("\n── B · a forced pin/agent failure surfaces + errors, never degrades ──")
    probe = _AlertProbe()
    real_surface = ops.record_alert
    ops.record_alert = probe

    # B1 — no runtime agent cached → the call is refused at the agent-selection seam
    real_cached = voice_toggle.cached_runtime_agent
    voice_toggle.cached_runtime_agent = lambda: ""
    try:
        try:
            voice_toggle.runtime_agent_id()
            raised = None
        except voice_toggle.NoVoiceMind as e:
            raised = e
        ck("runtime_agent_id() RAISES NoVoiceMind when our agent is missing (no substitute id)",
           raised is not None, str(raised or ""))

        probe.reset()
        try:
            app_mod._require_voice_mind("wa.34999000911")
            refused = False
        except app_mod.VoiceMindUnavailable:
            refused = True
        ck("_require_voice_mind refuses the call (VoiceMindUnavailable)", refused)
        ck("...and surfaces it to Peter", await probe.wait(),
           str(probe.calls[:1]))
        ck("...as a stop-class alert naming the voice mind",
           bool(probe.calls) and probe.calls[0]["class"] == "F"
           and "VOICE MIND UNAVAILABLE" in probe.calls[0]["detail"],
           probe.calls[0]["detail"][:80] if probe.calls else "")
    finally:
        voice_toggle.cached_runtime_agent = real_cached

    # B2 — the FOLD cannot be assembled → _build_voice_pin RAISES (it used to log.debug and continue)
    class _Boom:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): raise RuntimeError("injected: fold unreachable")
        async def __aexit__(self, *a): return False

    real_tx = app_mod.supa.scoped_tx
    app_mod.supa.scoped_tx = _Boom
    probe.reset()
    try:
        try:
            await app_mod._build_voice_pin("+34999000911", "wa.34999000911", "es")
            pin_raised = False
        except Exception:
            pin_raised = True
        ck("_build_voice_pin RAISES when the fold/persona cannot be built (no empty-pin degrade)",
           pin_raised)

        probe.reset()
        try:
            await app_mod._ring_pin_or_fail("+34999000911", "wa.34999000911", "es")
            ring_raised = False
        except app_mod.VoiceMindUnavailable:
            ring_raised = True
        ck("_ring_pin_or_fail turns it into VoiceMindUnavailable (the call dies at ring time)", ring_raised)
        ck("...and surfaces the pin-build failure to Peter", await probe.wait(),
           probe.calls[0]["detail"][:90] if probe.calls else "no alert")
    finally:
        app_mod.supa.scoped_tx = real_tx

    # B3 — a pin WITHOUT a role-block opener is a failed call, not a scripted hello
    real_build = app_mod._build_voice_pin

    async def _openerless(caller, scope, lang):
        return {"t": 0, "card": "", "tabs": [], "persona": "p", "opener": ""}

    app_mod._build_voice_pin = _openerless
    probe.reset()
    try:
        try:
            await app_mod._ring_pin_or_fail("+34999000911", "wa.34999000911", "es")
            op_raised = False
        except app_mod.VoiceMindUnavailable:
            op_raised = True
        ck("an EMPTY role-block opener fails the call (no scripted greeting substitutes)", op_raised)
        ck("...and surfaces the missing opener to Peter", await probe.wait(),
           probe.calls[0]["detail"][:90] if probe.calls else "no alert")
    finally:
        app_mod._build_voice_pin = real_build
        ops.record_alert = real_surface

    print(f"\nvital_one_mind: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
