"""vital_founder.py — FOUNDER MODE (Peter 2026-07-23, after the live founder-call bug).

Locks the three fixes from the real 07-23 call where Rocoto treated its OWN founder as a cold prospect:
  1. lifecycle.notes(founder) OWNS behaviour — it must NOT append the prospect/no-catalogue gating
     (no "dado de alta", no "OFRÉCELE agendar ... con PETER"). It IS Peter; don't pitch him.
  2. voice no-catalogue turn for the FOUNDER never speaks the PROSPECT_PITCH ("el fundador de Rocoto"
     spoken TO Peter was the bug) — his request/role-play stands.
  3. runtime.post_call_followup(founder) is a NO-OP — the founder is not a lead: no "sin seguimiento"
     lead-qualification reasoning about the boss.

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_founder.py
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("="); os.environ.setdefault(_k.strip(), _v.strip())

import db
import lifecycle
import runtime
import voice_protocol

PHONE = next(iter(runtime._CREATOR))          # the founder number (ROCOTO_CREATOR_NUMBERS)
SCOPE = "wa." + "".join(c for c in PHONE if c.isdigit())
R = []
def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


class _FakeResp:
    def __init__(self, text):
        class B: type = "text"
        b = B(); b.text = text; self.content = [b]
class FakeR1:                                   # empty reply → the no-catalogue branch decides
    def __init__(self):
        class _M:
            async def create(self, **kw): return _FakeResp("")
        self.messages = _M()


async def main():
    await db.init()

    # ── 1. lifecycle.notes(founder) must not carry prospect/no-cat gating ──────────────────────
    st = {"tier": "creator", "stage": "founder", "is_founder": True, "has_catalogue": False,
          "has_had_first_call": True, "onboarded": False, "n_events": 5}
    n = lifecycle.notes(st)
    ck("founder notes name him ('ES PETER')", "ES PETER" in n)
    ck("founder notes DO NOT tell him to register ('dado de alta')", "dado de alta" not in n, n[-80:])
    ck("founder notes DO NOT pitch a call with Peter ('OFRÉCELE agendar' absent)", "OFRÉCELE agendar" not in n)

    # A REAL prospect (no catalogue) MUST still get the onboarding gating — the fix is founder-only.
    pst = {"tier": "prospect", "stage": "prospect", "is_founder": False, "has_catalogue": False,
           "has_had_first_call": True, "onboarded": False, "n_events": 3}
    pn = lifecycle.notes(pst)
    ck("prospect STILL gets the no-catalogue onboarding gating (not broken)",
       ("dado de alta" in pn) or ("OFRÉCELE agendar" in pn) or ("catálogo" in pn.lower()))

    # ── 2. voice no-catalogue FOUNDER turn never speaks the PROSPECT_PITCH ─────────────────────
    async with db.scoped_tx(SCOPE) as con:
        for t in ("event", "action", "open_loop", "scope_state"):
            try: await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
            except Exception: pass
    voice_protocol._anthropic = lambda: FakeR1()
    ctx = {"lang": "es", "lifecycle": {"is_founder": True, "has_catalogue": False}, "lc_notes": "",
           "card": "", "tabs": [], "persona": "", "call_context": "", "window": "", "recall": [],
           "call_state": {}}
    out = await voice_protocol.in_call_turn(SCOPE, "quiero dos cajas de tomate y tres kilos de queso", ctx)
    rep = (out.get("reply") or "")
    ck("FOUNDER no-cat reply is NOT the prospect pitch", "el fundador de Rocoto" not in rep and "dado de alta" not in rep, f"reply={rep[:90]!r}")
    ck("FOUNDER no-cat reply is non-empty (no dead air)", bool(rep.strip()))

    # ── 3. post_call_followup(founder) is a NO-OP (no lead-qualification about the boss) ───────
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("delete from event where scope=$1::ltree and type='reasoning'", SCOPE)
    dec = await runtime.post_call_followup(PHONE, summary="prueba técnica", transcript="hola", name="Peter")
    ck("founder post-call returns no follow-up", dec.get("follow_up") is False)
    async with db.scoped_tx(SCOPE) as con:
        bad = await con.fetchval("select count(*) from event where scope=$1::ltree and type='reasoning' "
                                 "and payload->>'text' like '%sin seguimiento%'", SCOPE)
    ck("founder post-call wrote NO 'sin seguimiento' lead-qual reasoning", (bad or 0) == 0, f"rows={bad}")

    # ── residue hygiene (them-into-us, run_all_vitals' own discipline): the founder provisioning
    # this vital exercises writes an UNSEEDED tenant_range default for BRAIN_TENANT. On a real box
    # that row is legitimate; on the rehearsal clone it is residue that makes vital_seedworld's
    # world-switch (correctly) refuse to own the radius. Clean it — clone only, never the live DB.
    try:
        import os
        dsn = os.environ.get("REHEARSAL_DSN", "") or os.environ.get("DATABASE_URL", "")
        if "rocoto_rehearsal" in dsn:
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "delete from tenant_range where tenant_id=$1 and coalesce(seeded,false)=false",
                    config.BRAIN_TENANT)
    except Exception:
        pass

    print(f"\nvital_founder: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
