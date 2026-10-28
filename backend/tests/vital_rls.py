"""vital_rls.py — the isolation-floor canary (BUILD-PLAN 1.6 / SPEC §12.2, §15.7).

Proves the DB itself refuses cross-tenant access:
  * rocoto_rt scoped to tenant A sees A's rows, NOT B's;
  * rocoto_rt cannot WRITE a row outside its scope (WITH CHECK rejects);
  * an unset scope is fail-CLOSED (sees nothing);
  * rocoto_ctrl (tier-P) sees ALL scopes.

Needs two DSNs (both against rocoto_rehearsal): CTRL_DSN (role rocoto_ctrl) and RT_DSN (role
rocoto_rt). Exit != 0 on any failure — the isolation-floor CI gate.
"""
from __future__ import annotations

import asyncio
import os
import sys

import asyncpg

CTRL_DSN = os.environ.get("CTRL_DSN", "")
RT_DSN = os.environ.get("RT_DSN", "")

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def run() -> int:
    if not CTRL_DSN or not RT_DSN:
        print("need CTRL_DSN and RT_DSN", file=sys.stderr)
        return 2

    # ── seed as the OWNER within a broad scope (tier-P ctrl can no longer write derived memory —
    # that IS the §15.7 fix). scope='t' (nlevel>0) admits all t.* writes under FORCE RLS; a superuser
    # owner bypasses anyway. Two isolated tenants + a customer subtree row.
    setup_dsn = os.environ.get("SETUP_DSN") or os.environ.get("REHEARSAL_DSN") or ""
    setup = await asyncpg.connect(setup_dsn)
    try:
        await setup.execute("select set_config('rocoto.scope','t',false)")
        await setup.execute("delete from fact where key in ('canary:a','canary:b','canary:ac')")
        for s in ("t.ta", "t.tb", "t.ta.c.5"):
            await setup.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'boss',$2) "
                                "on conflict (scope) do nothing", s, s.split(".")[1])
        await setup.execute("insert into fact(scope,kind,text,key) values('t.ta'::ltree,'COMMERCIAL','A secret','canary:a')")
        await setup.execute("insert into fact(scope,kind,text,key) values('t.tb'::ltree,'COMMERCIAL','B secret','canary:b')")
        await setup.execute("insert into fact(scope,kind,text,key) values('t.ta.c.5'::ltree,'COMMERCIAL','A customer','canary:ac')")
    finally:
        await setup.close()

    # tier-P (rocoto_ctrl) sees ALL (read).
    ctrl = await asyncpg.connect(CTRL_DSN)
    try:
        seen_all = await ctrl.fetchval("select count(*) from fact where key in ('canary:a','canary:b','canary:ac')")
        check("tier-P (rocoto_ctrl) sees all scopes", seen_all == 3, f"saw {seen_all}/3")
    finally:
        await ctrl.close()

    # ── tenant A runtime — scoped to t.ta.
    rt = await asyncpg.connect(RT_DSN)
    try:
        await rt.execute("select set_config('rocoto.scope', 't.ta', false)")
        a_secret = await rt.fetchval("select count(*) from fact where key='canary:a'")
        b_secret = await rt.fetchval("select count(*) from fact where key='canary:b'")
        a_cust = await rt.fetchval("select count(*) from fact where key='canary:ac'")
        check("tenant A sees its own row", a_secret == 1)
        check("tenant A CANNOT see tenant B's row (cross-tenant blocked)", b_secret == 0, f"saw {b_secret}")
        check("tenant A sees rows in its customer subtree (ltree <@)", a_cust == 1)

        # tenant A cannot WRITE outside its scope — WITH CHECK must reject a t.tb insert.
        wrote_cross = False
        try:
            await rt.execute("insert into fact(scope,kind,text,key) values('t.tb'::ltree,'COMMERCIAL','poison','canary:x')")
            wrote_cross = True
        except asyncpg.PostgresError:
            wrote_cross = False
        check("tenant A CANNOT write a row into tenant B (WITH CHECK rejects)", wrote_cross is False)
    finally:
        await rt.close()

    # ── fail-closed: a fresh runtime connection with NO scope set sees NOTHING.
    rt2 = await asyncpg.connect(RT_DSN)
    try:
        n = await rt2.fetchval("select count(*) from fact where key in ('canary:a','canary:b','canary:ac')")
        check("unset scope is fail-CLOSED (sees nothing)", n == 0, f"saw {n}")
    finally:
        await rt2.close()

    # ── empty-string scope must ALSO be fail-closed (the nlevel>0 guard, not just the unset/NULL case).
    rt3 = await asyncpg.connect(RT_DSN)
    try:
        await rt3.execute("select set_config('rocoto.scope', '', false)")
        n = await rt3.fetchval("select count(*) from fact where key in ('canary:a','canary:b','canary:ac')")
        check("empty-string scope is fail-CLOSED (nlevel>0 guard)", n == 0, f"saw {n}")
    finally:
        await rt3.close()

    # ── tier-P (rocoto_ctrl) WRITE surface fenced to override.*/approval (SPEC §15.7).
    ctrl2 = await asyncpg.connect(CTRL_DSN)
    try:
        blocked_evt = False
        try:
            await ctrl2.execute("insert into event(scope,type,source) values('t.ta'::ltree,'message','wa')")
        except asyncpg.PostgresError:
            blocked_evt = True
        check("tier-P cannot append a non-override event (trigger fences it)", blocked_evt is True)

        blocked_fact = False
        try:
            await ctrl2.execute("insert into fact(scope,kind,text) values('t.ta'::ltree,'COMMERCIAL','forged')")
        except asyncpg.PostgresError:
            blocked_fact = True
        check("tier-P cannot forge a fact (no INSERT grant on derived memory)", blocked_fact is True)

        ok_override = False
        try:
            await ctrl2.execute("insert into event(scope,type,source) values('t.ta'::ltree,'override.outbound','override')")
            ok_override = True
        except asyncpg.PostgresError:
            ok_override = False
        check("tier-P CAN append an override.* event", ok_override is True)
    finally:
        await ctrl2.close()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nRLS canary: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
