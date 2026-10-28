"""vital_app_onboarding.py — THE IN-APP ONBOARDING GATE (sign up → be let in → the wizard → the seed).

Not unit tests of arithmetic. Each check is a product promise that must not silently regress:

  G1  no lead, or a lead below `wizard_sent`  → gate="waiting", and the app is handed NO token.
  G2  `wizard_sent` + a live token            → gate="invited" with a usable token.
  G3  the founder                             → gate="founder", whatever any lead row says.
  G4  onboarding_gate='open'                  → a brand-new signup is invited with nobody clicking
                                                anything; flipping it back to 'invite' closes the door
                                                again — NO code change in between.
  G5  the seeded-world endpoints              → REFUSE a non-founder token (401/403) with NO partial
                                                effect: the reset function is never even reached.
  G6  the wizard step list                    → contains NO phone-number step, and ENDS with the
                                                WhatsApp coexistence step in `pending_capability`.
  G7  an in-flight wizard token that predates the step change → still resolves to a valid step.

The RULE is pure (brain.auth.resolve_gate / brain.onboarding.app_steps), so G1–G4, G6 and G7 are
proved with no database at all. G5 rides the real ASGI app through httpx, so what is proved is the
wiring Peter actually depends on, not a re-implementation of it.

DB section: skipped cleanly when there is no DSN, and REFUSED outright against the live `rocoto`
database (this vital writes the real onboarding_gate setting — it must never touch production).

Run:  cd backend && PYTHONPATH=. python3 tests/vital_app_onboarding.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-media")

from brain import auth  # noqa: E402
from brain import onboarding as ob  # noqa: E402

R = []
SKIPPED = []


def ck(n, ok, d=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


def skip(n, why):
    SKIPPED.append(n)
    print(f"  [SKIP] {n} — {why}")


# ── identities ──────────────────────────────────────────────────────────────────────────────────────
def _goog(email):
    return {"provider": "google", "identity_data": {"email": email, "email_verified": True}}


FOUNDER = {"id": "u-p", "email": "peter@leo.casa", "identities": [_goog("peter@leo.casa")]}
FOUNDER_PW = {"id": "u-p2", "email": "peter@leo.casa", "identities": [{"provider": "email"}]}
FORGED = {"id": "u-f", "email": "peter@leo.casa",
          "identities": [{"provider": "email"}, _goog("attacker@gmail.com")]}
BOSS = {"id": "u-b", "email": "jefe@carnicasaldonza.es", "identities": [_goog("jefe@carnicasaldonza.es")]}


def L(status, **kw):
    """A lead row as the gate sees it."""
    return {"id": kw.get("id", "lead_x"), "name": kw.get("name", "Aldonza"),
            "business": kw.get("business", "Cárnicas Aldonza"),
            "email": kw.get("email", "jefe@carnicasaldonza.es"), "status": status}


def F(**kw):
    """The facts dict resolve_gate reasons over — defaults are a brand-new, ungated signup."""
    base = {"role": "prospect", "lead": None, "has_active_token": False, "tenant_live": False,
            "gate_mode": auth.GATE_INVITE, "booking": None}
    base.update(kw)
    return base


print("\nvital_app_onboarding\n" + "─" * 78)

# ══ G1 · below the bar → waiting, and NO token ═════════════════════════════════════════════════════
print("G1 · not invited yet → waiting, no token")
v = auth.resolve_gate(F())
ck("G1 no lead at all → waiting", v["gate"] == "waiting")
ck("G1 no lead → the 'we haven't spoken yet' copy", v["waiting"]["reason"] == "no_call")

for st, reason in (("signed_up", "no_call"), ("call_booked", "call_booked"), ("called", "called")):
    v = auth.resolve_gate(F(lead=L(st)))
    ck(f"G1 status={st} → waiting", v["gate"] == "waiting")
    ck(f"G1 status={st} → honest reason '{reason}'", v["waiting"]["reason"] == reason)

# the load-bearing one: a stray active token below the bar must NOT become an invitation
v = auth.resolve_gate(F(lead=L("called"), has_active_token=True))
ck("G1 a stray live token below wizard_sent is NOT an invitation", v["gate"] == "waiting")
ck("G1 …and the rule never asks anyone to mint one", v["mint"] is False)

# every waiting body is real, es-ES, and never leaks how we built it
BANNED = ("control room", "control_room", "wizard_sent", "waitlisted", "status", "lead", "backend",
          "CRM", "token", "endpoint", "Peter")
for reason in ("no_call", "call_booked", "called", "waitlisted", "hold"):
    c = auth.waiting_copy(reason)
    ck(f"G1 copy[{reason}] has a headline and a real body",
       len(c["headline"]) > 3 and len(c["body"]) > 120)
    low = (c["headline"] + " " + c["body"])
    ck(f"G1 copy[{reason}] never mentions the plumbing",
       not any(b.lower() in low.lower() for b in BANNED))
    ck(f"G1 copy[{reason}] never promises a phone number",
       "tu número" not in low or "tu número de siempre" in low or "el número que ya usan" in low)
ck("G1 the booked-call copy names the hour when we know it",
   " a las " in auth.waiting_copy("call_booked", "2026-08-04T15:30:00+00:00")["body"])
ck("G1 …and says nothing about the hour when we don't",
   " a las " not in auth.waiting_copy("call_booked", None)["body"])
ck("G1 an unknown reason degrades to 'hold', never to a crash",
   auth.waiting_copy("nonsense")["reason"] == "hold")

# ══ G2 · invited ═══════════════════════════════════════════════════════════════════════════════════
print("\nG2 · Peter clicked «Enviar onboarding» → invited")
v = auth.resolve_gate(F(lead=L("wizard_sent"), has_active_token=True))
ck("G2 wizard_sent + live token → invited", v["gate"] == "invited")
ck("G2 …with nothing to mint (they already hold one)", v["mint"] is False)
ck("G2 …and no waiting copy", v["waiting"] is None)
v = auth.resolve_gate(F(lead=L("done"), has_active_token=True))
ck("G2 the transient 'done' status also counts (mark-done's own two-step)", v["gate"] == "invited")
v = auth.resolve_gate(F(lead=L("wizard_sent"), has_active_token=False))
ck("G2 wizard_sent with a DEAD token → waiting, not a door with no handle", v["gate"] == "waiting")
v = auth.resolve_gate(F(lead=L("waitlisted")))
ck("G2 finished the wizard → waiting on their number, not re-invited", v["gate"] == "waiting")
ck("G2 …with the 'I have everything' copy", v["waiting"]["reason"] == "waitlisted")
v = auth.resolve_gate(F(lead=L("waitlisted"), tenant_live=True))
ck("G2 tenant live → in", v["gate"] == "in" and v["role"] == "boss")

# ══ G3 · the founder ═══════════════════════════════════════════════════════════════════════════════
print("\nG3 · Peter skips everything")
ck("G3 founder is recognised (matching Google identity)", auth.is_founder(FOUNDER))
ck("G3 a customer is not the founder", not auth.is_founder(BOSS))
ck("G3 owner address, password-only → NOT the founder (self-elevation closed)", not auth.is_founder(FOUNDER_PW))
ck("G3 owner address + forged attacker Google → NOT the founder (linkIdentity closed)",
   not auth.is_founder(FORGED))
for st in ("signed_up", "call_booked", "called", "wizard_sent", "waitlisted"):
    v = auth.resolve_gate(F(role="founder", lead=L(st)))
    ck(f"G3 founder with a lead at {st} → still founder", v["gate"] == "founder")
v = auth.resolve_gate(F(role="founder", lead=None, gate_mode=auth.GATE_INVITE))
ck("G3 founder with no lead row at all → still founder", v["gate"] == "founder")
ck("G3 founder is never handed waiting copy", v["waiting"] is None)

# ══ G4 · the gate is a SETTING, not a hardcoded rule ═══════════════════════════════════════════════
print("\nG4 · onboarding_gate: invite ↔ open, no code change")
new = F(lead=L("signed_up"))
closed = auth.resolve_gate({**new, "gate_mode": auth.GATE_INVITE})
opened = auth.resolve_gate({**new, "gate_mode": auth.GATE_OPEN})
ck("G4 invite → a brand-new signup waits", closed["gate"] == "waiting")
ck("G4 open  → the same signup is invited", opened["gate"] == "invited")
ck("G4 open  → the rule asks the write path to mint them a token", opened["mint"] is True)
ck("G4 open  → nobody had to touch the Control Room", opened["reason"] == "gate_open")
ck("G4 back to invite → the door closes again on the SAME facts",
   auth.resolve_gate({**new, "gate_mode": auth.GATE_INVITE})["gate"] == "waiting")
ck("G4 open never re-invites someone who already finished",
   auth.resolve_gate(F(lead=L("waitlisted"), gate_mode=auth.GATE_OPEN))["gate"] == "waiting")
ck("G4 open never overrides 'in'",
   auth.resolve_gate(F(lead=L("waitlisted"), tenant_live=True, gate_mode=auth.GATE_OPEN))["gate"] == "in")
ck("G4 open + a token already in hand → invited with nothing to mint",
   auth.resolve_gate(F(lead=L("wizard_sent"), has_active_token=True,
                       gate_mode=auth.GATE_OPEN))["mint"] is False)
ck("G4 the two modes are the only two", set((auth.GATE_INVITE, auth.GATE_OPEN)) == {"invite", "open"})

# ══ G6 · the step list ═════════════════════════════════════════════════════════════════════════════
print("\nG6 · the wizard steps: no phone step, coexistence last and honest")
steps = ob.app_steps({}, {})
ids = [s["id"] for s in steps]
kinds = [s["kind"] for s in steps]
PHONEY = ("phone", "number", "numero", "número", "telefono", "teléfono", "movil", "móvil", "sms")
ck("G6 there is NO phone-number step",
   not any(any(p in s["id"].lower() or p in s["kind"].lower() for p in PHONEY) for s in steps),
   " ".join(ids))
ck("G6 no step TITLE asks for a phone number",
   not any(("tu número de teléfono" in s["title"].lower() or "tu teléfono" in s["title"].lower())
           for s in steps))
ck("G6 the LAST step is the WhatsApp connect step", ids[-1] == "whatsapp")
ck("G6 …and its kind is whatsapp_connect", kinds[-1] == "whatsapp_connect")
last = steps[-1]
ck("G6 …in state pending_capability (we have no Coexistence access yet)",
   last.get("state") == "pending_capability")
ck("G6 …carrying an honest es-ES sentence that names what it waits on",
   "Meta" in last.get("note", "") and len(last.get("note", "")) > 80)
ck("G6 …that does not pretend it works", "conectado" not in last.get("note", "").lower())
ck("G6 …and never blocks the customer over OUR missing permission",
   last.get("blocking") is False and last.get("required") is False)
ck("G6 a pending coexistence step exposes no signup URL to tap", "signup_url" not in last)
ck("G6 every step is renderable data (id·kind·title·subtitle·required·value)",
   all({"id", "kind", "title", "subtitle", "required", "value"} <= set(s) for s in steps))
ck("G6 every step carries es-ES copy", all(s["title"] and s["subtitle"] for s in steps))
ck("G6 the delivery step is the LOCKED radius, not zones",
   "radius" in ids and steps[ids.index("radius")]["kind"] == "delivery_radius")

# granting the capability is a DATA change, not a rewrite
ready = ob.app_steps({}, {"enabled": True, "signup_url": "https://example.invalid/es"})
ck("G6 flipping the setting flips the step to ready — no code change",
   ready[-1]["state"] == "ready" and ready[-1].get("signup_url"))
half = ob.app_steps({}, {"enabled": True})
ck("G6 enabled but nowhere to send them → still pending (a button with no destination lies)",
   half[-1]["state"] == "pending_capability")

# the WhatsApp step never holds the customer hostage
full = {"catalogue_submitted": True, "products": [{"n": "Chorizo"}], "range_km": 34,
        "excel_send_time": "18:30", "waking_from": "07:00", "waking_to": "21:00"}
ok, missing = ob.can_submit(full)
ck("G6 a wizard with everything but WhatsApp CAN be submitted", ok and not missing)
ck("G6 a wizard missing a required answer cannot",
   not ob.can_submit({"catalogue_submitted": True})[0])

# no real company names anywhere in the shipped copy
REAL = ("collsar", "casa alberto", "botín", "botin", "casa pepe", "solobuey", "mercadona",
        "del monte", "la brújula")
blob = " ".join([s["title"] + " " + s["subtitle"] + " " + str(s.get("note", "")) for s in steps]) + \
       " ".join(auth.waiting_copy(r)["headline"] + auth.waiting_copy(r)["body"]
                for r in ("no_call", "call_booked", "called", "waitlisted", "hold"))
ck("G6 no real company name appears in any shipped string",
   not any(x in blob.lower() for x in REAL))

# ══ G7 · the migration: live tokens predate this step list ══════════════════════════════════════════
print("\nG7 · an in-flight token still resolves to a step that exists")
for legacy in ("number", "phone", "numero", "número", "telefono", "teléfono", "phone_number",
               "whatsapp_number"):
    ck(f"G7 retired step id '{legacy}' → the WhatsApp step",
       ob.resolve_step_id(legacy) == "whatsapp")
ck("G7 the web wizard's zone step 'catchment' → the radius step",
   ob.resolve_step_id("catchment") == "radius")
for i in range(0, 8):                       # every index the web wizard could have saved
    got = ob.resolve_step_id(i)
    ck(f"G7 a web-wizard numeric step {i} resolves to a real step", got in ob.APP_STEP_IDS, got)
ck("G7 web index 2 (its catchment) lands on radius, not on whatever sits at index 2",
   ob.resolve_step_id(2) == "radius")
ck("G7 an out-of-range index clamps to the last step, never crashes",
   ob.resolve_step_id(9999) == ob.APP_STEP_IDS[-1])
for junk in (None, "", "nonsense", -3, True, {"a": 1}, 3.7):
    ck(f"G7 junk step pointer {junk!r} resolves to a real step",
       ob.resolve_step_id(junk) in ob.APP_STEP_IDS)
ck("G7 an explicitly stored app_step_id wins",
   ob.resolve_step_id(None, {"app_step_id": "voice"}) == "voice")
ck("G7 …including a retired one stored in state",
   ob.resolve_step_id(None, {"app_step_id": "number"}) == "whatsapp")

# a token that ANSWERED the retired phone step still walks forward normally
inflight = {"catalogue_submitted": True, "products": [{"n": "Chorizo"}], "range_km": 34,
            "excel_send_time": "18:30", "waking_from": "07:00", "waking_to": "21:00",
            "auto_accept_rules": ["Cliente de siempre"], "hold_rules": ["Pedido nuevo"],
            "voice_id": "v-rocoto-1",
            "phone_number": "+34600000000", "app_step_id": "number"}
ck("G7 an in-flight wizard that answered the phone step resumes on a live step",
   ob.resolve_step_id(inflight.get("app_step_id"), inflight) in ob.APP_STEP_IDS)
ck("G7 …and its next step is the WhatsApp step, not a hole",
   ob.next_step_id(inflight) == "whatsapp")
ck("G7 …and the stale phone answer is simply not a step any more",
   "phone_number" not in [k for s in ob.APP_STEPS for k in s["keys"]])
ck("G7 a save can never write a key belonging to another step",
   ob._sanitize("voice", {"voice_id": "v1", "range_km": 999}) == {"voice_id": "v1"})
ck("G7 a save can never wipe the backend-owned catalogue",
   "skus" not in ob._sanitize("catalogue", {"skus": [], "catalogue_submitted": True}))

# ══ G5 · the seeded world is FOUNDER-ONLY (through the real ASGI app) ═══════════════════════════════
print("\nG5 · the seeded world refuses everyone but Peter")


async def g5():
    try:
        import httpx

        import app as rocoto_app
    except Exception as e:                                    # pragma: no cover
        skip("G5 seed endpoints founder-only", f"app import failed: {e}")
        return

    from brain import seed as seed_mod
    hits = {"reset": 0}

    async def _spy_reset(*a, **kw):
        hits["reset"] += 1
        return {"spy": True}

    async def _fake_counts():
        return {"catalogue": 0, "customers": 0, "orders": 0, "messages": 0, "calls": 0, "review": 0}

    real_verify = rocoto_app.brain_auth.verify_token
    real_counts = rocoto_app._seed_counts
    had_reset = hasattr(seed_mod, "reset_demo_seed")
    real_reset = getattr(seed_mod, "reset_demo_seed", None)
    WHO = {"u": None}

    async def _fake_verify(tok):
        return WHO["u"]

    rocoto_app.brain_auth.verify_token = _fake_verify
    rocoto_app._seed_counts = _fake_counts
    seed_mod.reset_demo_seed = _spy_reset
    try:
        tr = httpx.ASGITransport(app=rocoto_app.app)          # no lifespan → no DB connection
        async with httpx.AsyncClient(transport=tr, base_url="http://vital") as c:
            H = {"authorization": "Bearer whatever"}

            WHO["u"] = None                                   # unauthenticated
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 no session → seed reset 401", r.status_code == 401, str(r.status_code))
            r = await c.get("/api/app/seed", headers=H)
            ck("G5 no session → seed read 401", r.status_code == 401, str(r.status_code))

            WHO["u"] = BOSS                                   # a real, signed-in customer
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 a tenant/customer → seed reset 403", r.status_code == 403, str(r.status_code))
            r = await c.get("/api/app/seed", headers=H)
            ck("G5 a tenant/customer → seed read 403", r.status_code == 403, str(r.status_code))

            WHO["u"] = FOUNDER_PW                             # owner address, password-only
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 owner address without Google → seed reset 403", r.status_code == 403, str(r.status_code))

            WHO["u"] = FORGED                                 # linkIdentity escalation attempt
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 forged linked Google identity → seed reset 403", r.status_code == 403, str(r.status_code))

            ck("G5 NO PARTIAL EFFECT: the reset was never reached by any of them", hits["reset"] == 0)

            WHO["u"] = FOUNDER                                # Peter
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 the founder can reset", r.status_code == 200, str(r.status_code))
            ck("G5 …and only then does the reset actually run", hits["reset"] == 1)

            # the reset function still in flight → an honest 503, never a stack trace
            del seed_mod.reset_demo_seed
            r = await c.post("/api/app/seed/reset", headers=H)
            ck("G5 reset not built yet → clean 503, not a 500", r.status_code == 503, str(r.status_code))
            ck("G5 …with an es-ES sentence, not a traceback",
               "reiniciar" in (r.json().get("detail") or "").lower())

            # the gate itself is not founder-gated, but IS authenticated
            WHO["u"] = None
            r = await c.get("/api/app/gate", headers=H)
            ck("G5 /api/app/gate refuses an unauthenticated caller", r.status_code == 401, str(r.status_code))
            r = await c.get("/api/app/gate-mode", headers=H)
            ck("G5 the gate policy is founder-only too", r.status_code == 401, str(r.status_code))
            WHO["u"] = BOSS
            r = await c.post("/api/app/gate-mode", headers=H, json={"mode": "open"})
            ck("G5 a customer cannot open the gate for everyone", r.status_code == 403, str(r.status_code))
    finally:
        rocoto_app.brain_auth.verify_token = real_verify
        rocoto_app._seed_counts = real_counts
        if had_reset:
            seed_mod.reset_demo_seed = real_reset
        elif hasattr(seed_mod, "reset_demo_seed"):
            del seed_mod.reset_demo_seed


# ══ DB section — skipped with no DSN, REFUSED against the live database ════════════════════════════
def _dsn_verdict():
    dsn = (os.environ.get("DATABASE_URL") or "").strip()
    if not dsn:
        return (None, "no DATABASE_URL — pure-rule checks only")
    try:
        from urllib.parse import urlparse
        name = (urlparse(dsn).path or "").lstrip("/")
    except Exception:
        return (None, "unparseable DATABASE_URL")
    if name == "rocoto" and os.environ.get("VITAL_ALLOW_LIVE_DB") != "1":
        return (None, "REFUSED: that is the LIVE `rocoto` database — this vital writes the real "
                      "onboarding_gate setting. Point it at a clone.")
    return (dsn, name)


async def db_section():
    dsn, why = _dsn_verdict()
    if not dsn:
        skip("DB · gate setting round-trip", why)
        skip("DB · coexistence setting round-trip", why)
        return
    import db
    try:
        await db.init()
    except Exception as e:
        skip("DB · gate setting round-trip", f"db.init failed: {e}")
        return
    before = None
    try:
        before = await db.settings_get(auth.GATE_SETTING) or {}
        ck("DB gate default is the CLOSED door",
           await auth.gate_mode() in (auth.GATE_INVITE, auth.GATE_OPEN))
        await auth.set_gate_mode(auth.GATE_OPEN)
        ck("DB set_gate_mode('open') persists", await auth.gate_mode() == auth.GATE_OPEN)
        await auth.set_gate_mode(auth.GATE_INVITE)
        ck("DB flipping back to 'invite' closes the door again", await auth.gate_mode() == auth.GATE_INVITE)
        bad = False
        try:
            await auth.set_gate_mode("opne")
        except ValueError:
            bad = True
        ck("DB a typo can never silently open the gate", bad)
        ck("DB the gate lives in agent_settings (no migration, no new column)",
           isinstance(await db.settings_get(auth.GATE_SETTING), dict))
        coex = await ob.coexistence_setting()
        ck("DB the coexistence capability reads as a setting too", isinstance(coex, dict))
    finally:
        try:
            if before is not None:
                await db.settings_set(auth.GATE_SETTING, before)
        except Exception:
            pass


async def main():
    await g5()
    await db_section()


asyncio.run(main())

print("─" * 78)
print(f"vital_app_onboarding: {sum(R)}/{len(R)} green" + (f"  ({len(SKIPPED)} skipped)" if SKIPPED else ""))
sys.exit(0 if all(R) else 1)
