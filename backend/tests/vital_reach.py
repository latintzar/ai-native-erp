"""vital_reach.py — WP-6b THE PROACTIVE-REACH ENGINE (BUILD-PLAN §5 WP-6b).

The employee must never fire a doomed freeform into a closed WhatsApp window (a silent 63016), and must
pick a DELIVERABLE hand instead. Proves the decision ladder:
  window OPEN → freeform · CLOSED+template → template · CLOSED+urgent → call · CLOSED+email → email ·
  CLOSED+nothing → hold · muted/opted-out → hold.

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_reach.py
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import db  # noqa: E402
import reach  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402

PHONE = "+34999000777"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("event", "fact", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def _set_inbound_age(hours):
    """Ensure exactly one inbound message event, aged `hours` old (or delete all if None)."""
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("delete from event where scope=$1::ltree and type='message'", SCOPE)
        if hours is not None:
            await spine.append_event(con, SCOPE, "message", "wa", {"text": "hola"})
            await con.execute("update event set ts = now() - ($2 || ' hours')::interval "
                              "where scope=$1::ltree and type='message'", SCOPE, str(hours))


async def _choose(**kw):
    async with db.scoped_tx(SCOPE) as con:
        return await reach.choose_channel(con, SCOPE, **kw)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    await _set_inbound_age(2)      # window OPEN (2h ago)
    ck("window OPEN → freeform", (await _choose())["channel"] == "freeform")

    await _set_inbound_age(30)     # window CLOSED (30h ago)
    ck("window CLOSED + nothing deliverable → hold (never a silent 63016)", (await _choose())["channel"] == "hold")
    ck("window CLOSED + approved template fits → template", (await _choose(template_available=True))["channel"] == "template")
    ck("window CLOSED + higher-touch intent → call", (await _choose(intent="urgent"))["channel"] == "call")
    ck("window CLOSED + email on file → email", (await _choose(has_email=True))["channel"] == "email")

    # muted → hold even with the window open
    await _set_inbound_age(1)
    await runtime.set_takeover(SCOPE, True)
    ck("muted (human took over) → hold", (await _choose(template_available=True))["channel"] == "hold")
    await runtime.set_takeover(SCOPE, False)

    await _clean()
    passed = sum(R)
    print(f"\nPROACTIVE REACH: {passed}/{len(R)} passed — {'CHANNEL-AWARE OUTREACH' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
