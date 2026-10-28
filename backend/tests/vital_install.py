"""vital_install.py — WP-10 SENTIENT SELF-CONFIGURATION (BUILD-PLAN §5 WP-10 / SPEC §16.3).

No wizard: the employee configures itself in the normal turn. Proves talk→ROW→binds:
  install_duty writes a manifest_duty ROW that then BINDS (opens a tab on its opens_on sense — zero
  Python); teach_instruction stores an L2 standing instruction; declare_stakeholder writes a row.
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import db
import duties
import install
import runtime
import spine  # noqa: E402

PHONE = "+34999001111"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event", "fact", "manifest_duty", "manifest_stakeholder",
                  "standing_instruction", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    # 1. install_duty — the employee writes a NEW situation as a ROW
    await install.install_duty(PHONE, "holiday_cover", "holiday.start", "holiday.end",
                               "Cobertura de vacaciones para {entity}", "¿Necesitas que cubra algo mientras no estás?")
    duties.invalidate_cache(SCOPE)
    async with db.control_pool().acquire() as con:
        row = await con.fetchval("select count(*) from manifest_duty where scope=$1::ltree and name='holiday_cover' and enabled", SCOPE)
    ck("install_duty writes a manifest_duty ROW (the employee configures itself)", row == 1, f"rows={row}")

    # ...and it BINDS: the opens_on sense opens a tab (zero Python)
    async with db.scoped_tx(SCOPE) as con:
        eid, _ = await spine.append_event(con, SCOPE, "holiday.start", "test", {"entity": "Manolo"})
        await duties.react_to_sense(con, SCOPE, "holiday.start", {"entity": "Manolo"})
    async with db.control_pool().acquire() as con:
        tab = await con.fetchval("select count(*) from open_loop where scope=$1::ltree and entity_key='holiday_cover:Manolo' and status='open'", SCOPE)
        armed = await con.fetchval("select count(*) from timer t join open_loop l on l.id=t.loop_id where l.scope=$1::ltree and t.state='armed'", SCOPE)
    ck("the installed row BINDS: holiday.start → a tab + a pre-armed chase (zero Python)", (tab or 0) >= 1 and (armed or 0) >= 1, f"tab={tab} armed={armed}")

    # 2. teach_instruction — the L2 STANDING-INSTRUCTION store (B1: its own table, not the fact shelf:
    #    a fact says what is TRUE about a party and is invalidated by a newer observation; an
    #    instruction says how the employee must BEHAVE and is only ever REVOKED) + the assembly SLOT.
    RULE = "A partir de ahora, confirma siempre por escrito antes de cerrar un pedido grande."
    await install.teach_instruction(PHONE, RULE, binding=True)
    async with db.control_pool().acquire() as con:
        instr = await con.fetchval(
            "select count(*) from standing_instruction where scope=$1::ltree and revoked_at is null "
            "and binding", SCOPE)
    ck("teach_instruction stores an L2 STANDING INSTRUCTION row (binding)", (instr or 0) >= 1, f"instr={instr}")
    import assemble as _assemble
    async with db.scoped_tx(SCOPE) as con:
        slot = await _assemble.standing_block(con, SCOPE)
        fold = await _assemble.assemble(con, SCOPE, "hola")
    ck("the L2 rule reaches the mind: it renders in the STANDING INSTRUCTIONS slot of the fold",
       RULE in slot and RULE in fold.get("rendered", "") and "[obligatorio]" in slot)
    async with db.control_pool().acquire() as con:
        rid = await con.fetchval("select id from standing_instruction where scope=$1::ltree "
                                 "order by id desc limit 1", SCOPE)
    await install.revoke_instruction(SCOPE, int(rid))
    async with db.scoped_tx(SCOPE) as con:
        slot2 = await _assemble.standing_block(con, SCOPE)
    ck("a REVOKED rule leaves the fold (revoked, never deleted — the log still explains last month)",
       RULE not in slot2)

    # 3. declare_stakeholder
    await install.declare_stakeholder(PHONE, "colleague", "Lucía (reparto)")
    async with db.control_pool().acquire() as con:
        sh = await con.fetchval("select count(*) from manifest_stakeholder where scope=$1::ltree and role='colleague'", SCOPE)
    ck("declare_stakeholder writes a manifest_stakeholder row", (sh or 0) >= 1, f"stakeholders={sh}")

    await _clean()
    passed = sum(R)
    print(f"\nSELF-CONFIG: {passed}/{len(R)} passed — {'THE EMPLOYEE CONFIGURES ITSELF' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
