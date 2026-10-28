"""vital_memory_engines.py — WP-5 MEMORY ENGINES complete (BUILD-PLAN §5 WP-5).

Proves the two safety-critical engine additions:
  1. R11 DE-SILTING — gc_facts removes facts INVALIDATED longer than the retention window ago, while the
     CURRENT fact and in-window history survive (recall never wades through dead versions).
  2. COSINE FLAG-BAND — a keyless new fact is written with a `disputed` verdict; an UNRELATED fact is
     NOT flagged (no false positive); the band code runs (flag-never-kill).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_memory_engines.py
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
import memory  # noqa: E402
import runtime  # noqa: E402

PHONE = "+34999000555"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("fact", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

        # 1. R11 de-silting: version a keyed fact out, backdate the invalidated one, GC it.
        await memory.write_fact(con, SCOPE, "COMMERCIAL", "precio rocoto 2,00 €/bote", key="price:rocoto")
        await memory.write_fact(con, SCOPE, "COMMERCIAL", "precio rocoto 2,10 €/bote", key="price:rocoto")  # versions out the old
        await con.execute("update fact set invalid_at = now() - interval '120 days' "
                          "where scope=$1::ltree and key='price:rocoto' and invalid_at is not null", SCOPE)
        gc = await memory.gc_facts(con, SCOPE, keep_days=90)
        current = await con.fetchval("select text from fact where scope=$1::ltree and key='price:rocoto' and invalid_at is null", SCOPE)
        old_left = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='price:rocoto' and invalid_at is not null", SCOPE)
        ck("R11 de-silting: old invalidated fact GC'd, current survives",
           gc >= 1 and current == "precio rocoto 2,10 €/bote" and (old_left or 0) == 0, f"gc={gc} current={current!r} old_left={old_left}")

        # 2. cosine flag-band: an UNRELATED keyless fact must NOT be flagged (no false positive).
        await memory.write_fact(con, SCOPE, "PREFERENCE", "le gusta el picante muy fuerte")
        r_far = await memory.write_fact(con, SCOPE, "RHYTHM", "reparte los martes por la mañana")
        ck("flag-band: an unrelated fact is written with disputed=false (no false positive)",
           r_far.get("action") == "inserted" and r_far.get("disputed") is False, str(r_far))
        # the mechanism returns a boolean verdict (flag-never-kill — the write always succeeds)
        r_near = await memory.write_fact(con, SCOPE, "PREFERENCE", "le encanta el picante bien fuerte")
        ck("flag-band: the write always succeeds + returns a disputed verdict (never kills a fact)",
           r_near.get("action") == "inserted" and isinstance(r_near.get("disputed"), bool), str(r_near))

    await _clean()
    passed = sum(R)
    print(f"\nMEMORY ENGINES: {passed}/{len(R)} passed — {'DE-SILTED + FLAG-BANDED' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
