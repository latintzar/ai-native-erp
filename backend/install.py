"""install.py — WP-10 SENTIENT SELF-CONFIGURATION (SPEC §16.3): the employee configures ITSELF by
writing manifest rows + standing instructions in the NORMAL turn — no wizard, no special mode. A new
situation the boss describes becomes a manifest_duty ROW the employee writes itself (situations are
data). Tier-gated to creator/boss upstream; every install is flight-recorded as an event.
"""
from __future__ import annotations

import db
import spine


async def install_duty_row(scope: str, name: str, cfg: dict, *, created_by: str = "L2") -> dict:
    """THE ROW WRITE (BLOCK C): a whole `gate_policy` → one `manifest_duty` row on `scope`, bound by
    the generic binder from the next matching sense onward — ZERO Python for the situation itself.

    This is the single write behind BOTH self-configuration paths: the WP-10 shorthand below (a simple
    chase, four arguments) and the BLOCK C tracker registry (`trackers.build_policy`, a watch the mind
    designed from the real hooks). Re-installing the SAME name UPDATES the row (a tracker the boss
    edits is the same tracker — `on conflict do nothing` would have silently kept the stale watch and
    told him it worked). Flight-recorded, and the duty cache is dropped so the next turn sees it.

    THE JSONB PARAM IS A DICT — never `json.dumps(...)::jsonb` (duties.py's standing warning). Every
    pooled connection carries a jsonb codec, so dumping first stored the whole policy as a jsonb
    *string scalar*: `duties._asjson` quietly re-parsed it, so binding worked and nobody noticed, but
    the column could not be QUERIED as JSON (`gate_policy ? 'tracker'` matched nothing) — which is
    exactly what the BLOCK C registry reads. Fixed here, at the one write."""
    async with db.scoped_tx(scope) as con:
        await con.execute(
            "insert into manifest_duty(scope,name,gate_policy,enabled,created_by) "
            "values($1::ltree,$2,$3,true,$4) "
            "on conflict (scope, name) do update set gate_policy=excluded.gate_policy, enabled=true",
            scope, name, cfg, created_by)
        await spine.append_event(con, scope, "install.duty", "runtime", {"name": name},
                                 lane="reasoning")
    try:
        import duties
        duties.invalidate_cache(scope)
    except Exception:
        pass
    return {"ok": True, "name": name, "scope": scope}


async def install_duty(phone: str, name: str, opens_event: str, resolve_event: str,
                       tab_text: str, chase_sentence: str, after: str = "1d", tier: str = "customer") -> dict:
    """Install a NEW situation as a manifest_duty ROW (the employee writes its own row). Bound by the
    generic binder the next time `opens_event` arrives — ZERO Python. Flight-recorded."""
    import runtime
    scope = runtime.scope_of(phone)
    cfg = {
        "opens_on": {"event": opens_event, "key": f"{name}:{{entity}}"},
        "resolves_on": {"event": resolve_event, "branch_id": "done"},
        "tab": {"kind": "pending", "answer_shape": "free", "money": False, "text": tab_text},
        "rungs": [{"branch_id": "r1", "after": after, "gated": False,
                   "trigger": f"{name} follow-up", "sentence": chase_sentence}],
        "lifecycle": {"prefix": f"{name}.", "initial": "open", "terminal": ["done"],
                      "transitions": {resolve_event: "done"}},
        "soul": {"tier": tier, "label": name.upper().replace("_", " ")},
    }
    return await install_duty_row(scope, name, cfg, created_by="L2")


async def teach_instruction_scoped(scope: str, text: str, *, binding: bool = False,
                                   priority: int = 100, created_by: str = "L2") -> dict:
    """THE L2 STANDING-INSTRUCTION WRITE (SPEC §4.1 ledger row 2 · §16.2 level L2) — the store the
    assembly's STANDING INSTRUCTIONS slot reads, on BOTH mouths.

    A standing instruction is NOT a fact: a fact says what is TRUE about a party and is invalidated by
    a newer observation; an instruction says how the employee must BEHAVE and is only ever REVOKED by
    the boss. Different lifecycles → its own table (`standing_instruction`), scope-keyed like
    everything else so a rule about one customer can never leak into another's fold.
    `binding=True` marks a rule the §4.1 slot budget may NEVER cut. Flight-recorded."""
    text = (text or "").strip()
    if not text:
        return {"ok": False, "reason": "empty"}
    async with db.scoped_tx(scope) as con:
        rid = await con.fetchval(
            "insert into standing_instruction(scope,text,binding,priority,created_by) "
            "values($1::ltree,$2,$3,$4,$5) returning id", scope, text, bool(binding), int(priority),
            created_by)
        await spine.append_event(con, scope, "install.instruction", "runtime",
                                 {"text": text[:200], "binding": bool(binding), "id": int(rid)},
                                 lane="reasoning")
    return {"ok": True, "id": int(rid)}


async def revoke_instruction(scope: str, instruction_id: int) -> dict:
    """Revoke a standing instruction (the boss changed his mind). Never deleted — revoked, so the
    log still explains why the employee behaved as it did last month."""
    async with db.scoped_tx(scope) as con:
        n = await con.execute("update standing_instruction set revoked_at=now() "
                              "where scope=$1::ltree and id=$2 and revoked_at is null",
                              scope, int(instruction_id))
        await spine.append_event(con, scope, "install.instruction_revoked", "runtime",
                                 {"id": int(instruction_id)}, lane="reasoning")
    return {"ok": n.endswith("1")}


async def teach_instruction(phone: str, text: str, *, binding: bool = False) -> dict:
    """Phone-keyed convenience over `teach_instruction_scoped` (the conversational boss-write path:
    "a partir de ahora, con Manolo, ..."). Flight-recorded."""
    import runtime
    return await teach_instruction_scoped(runtime.scope_of(phone), text, binding=binding)


async def declare_stakeholder(phone: str, role: str, name: str = "") -> dict:
    """Declare a stakeholder (a manifest_stakeholder row) — who matters in this world and their role."""
    import runtime
    scope = runtime.scope_of(phone)
    async with db.scoped_tx(scope) as con:
        import json as _json
        await con.execute(
            "insert into manifest_stakeholder(scope,role,config,created_by) "
            "values($1::ltree,$2,$3::jsonb,'L2')", scope, role, _json.dumps({"name": name}))
        await spine.append_event(con, scope, "install.stakeholder", "runtime", {"role": role, "name": name}, lane="reasoning")
    return {"ok": True, "role": role}
