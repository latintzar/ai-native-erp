"""vital_context.py — THE §4.1.1 CONTEXT-COMPONENT VITAL (BLOCK B1 (a); Peter 2026-07-25 "ultra solid").

THE AUDIT DISCIPLINE, MADE MECHANICAL. SPEC §4.1.1 declares the canonical fold checklist: "Every
full-reasoning turn's context is EXACTLY these, both mouths (chat + voice pin), no silent omissions ...
each component is either VERIFIED-IN-BYTES (a vital asserts it appears in the assembled fold on BOTH
paths) or it is a bug."  This file IS that vital. It asserts, for a CREATOR scope and a PROSPECT scope,
that every component of the checklist appears in the ASSEMBLED BYTES of BOTH mouths:

  · chat  — `assemble.assemble(...)["rendered"]` (the exact bytes runtime.run_turn folds into SYSTEM);
  · voice — the ring-time pin (`app._build_voice_pin`) AND the R1 turn's USER grounding bytes
            (`voice_protocol._grounding_block` as actually passed to the model).

THE COMPONENTS (SPEC §4.1.1, verbatim order) and their fold header (EN — §0.11 LANGUAGE LAW: the
model-facing fold section headers are English; the CONTENT stays es-ES for customers/suppliers):
  1. Profile card ................ ### PROFILE CARD
  2. Lifecycle stage ............. ### LIFECYCLE      (stage + the §6 CHECKBOX SET)
  3. Event history ............... ### RECENT HISTORY (7 days OR back to the oldest open tab's ORIGIN)
  4. Open-tab reasoning outputs .. ### OPEN TABS      (each tab's latest verdict/recommendation/
                                                      process result rides ON its line)
  5. Supplier card ............... ### SUPPLIER CARD  (tenant card [+ the CATALOGUE sub-block ONLY
                                                      once the skus_uploaded box is ticked])
  6. Hybrid recall ............... ### RECALL
  + the frame that wraps them:     ### FRAME (MARCO: quien/canal/situacion) · ### RIGHT NOW (AHORA
    MISMO) · ### MESSAGE (the utterance) · ### STANDING INSTRUCTIONS (L2) · ### ORDER STATE (the live
    order draft + pending-gate state).

Locks:
  1. REGISTRY — assemble.COMPONENTS is the ONE list; this file's checklist matches it exactly.
  2. CHAT/PROSPECT + 3. VOICE/PROSPECT — every component present in the assembled bytes.
  4. CHAT/CREATOR + 5. VOICE/CREATOR — the same, on the founder scope.
  6. WINDOW RULE — an event 20 days old is OUT of a plain 7-day window but IN when an open tab's
     ORIGIN event reaches back that far; both mouths agree; the clock is PINNED; no 12-row cap.
  7. TAB REASONING — a reasoning output bound to a tab renders ON that tab's line in BOTH mouths,
     and order_brain IS registered on the fabric (no docstring drift).
  8. CHECKBOX SPLICING (SPEC §6) — pre-`skus_uploaded` the CATALOGUE listing is ABSENT and its
     absence is KNOWN-STATE; post-upload the listing rides. The stage brief names the next box.
  9. SUPPLIER BOTH-CASES — caller IS the supplier vs caller is their CUSTOMER.
 10. STANDING INSTRUCTIONS — an L2 rule renders in both mouths.
 11. ORDER STATE — a live draft + a parked (pending-gate) money action render in both mouths.
 12. retrieve() — the known-unknown tool is exposed to the mind.

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_context.py
"""
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import app as app_mod  # noqa: E402
import assemble as assemble_mod  # noqa: E402
import db  # noqa: E402
import directory as directory_mod  # noqa: E402
import lifecycle  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import voice_protocol  # noqa: E402

# ── THE CHECKLIST (SPEC §4.1.1) — the literal markers the assembled bytes must carry ─────────────
CHECKLIST = {
    "frame":        "### FRAME",
    "profile_card": "### PROFILE CARD",
    "lifecycle":    "### LIFECYCLE",
    "standing":     "### STANDING INSTRUCTIONS",
    "window":       "### RECENT HISTORY",
    "tabs":         "### OPEN TABS",
    "supplier":     "### SUPPLIER CARD",
    "order_state":  "### ORDER STATE",
    "right_now":    "### RIGHT NOW",
    "recall":       "### RECALL",
    "message":      "### MESSAGE",
}
# the §6 checkbox set, in canonical order
BOXES = ("call_done", "skus_uploaded", "flow_done", "interview_done", "fee_paid", "number_bound", "live")

PROSPECT_PHONE = "+34999004411"
PROSPECT_SCOPE = runtime.scope_of(PROSPECT_PHONE)
CUSTOMER_SCOPE = "t.vitalctxsup.c.9001"
TENANT = "vitalctxsup"

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))


class _FakeResp:
    def __init__(self, text):
        class B:
            type = "text"
        b = B(); b.text = text
        self.content = [b]


class FakeR1:
    def __init__(self, script=()):
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


def _sys_of(kw):
    s = kw.get("system", "")
    if isinstance(s, str):
        return s
    return "\n\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in (s or []))


async def _clean(scope):
    async with db.scoped_tx(scope) as con:
        for t in ("action", "timer", "wake", "pending_turn", "open_loop", "event",
                  "fact", "summary", "card", "scope_state", "scope_node", "assembly_snapshot",
                  "standing_instruction"):
            try:
                await con.execute("delete from %s where scope=$1::ltree" % t, scope)
            except Exception:
                pass
    app_mod._VOICE_PINS.pop(scope, None)
    app_mod._VOICE_LOCKS.pop(scope, None)


async def _seed_world(scope, *, tier, with_skus, now, tenant="", old_days=20):
    """Seed ONE party world that exercises every §4.1.1 component."""
    import memory
    out = {}
    async with db.scoped_tx(scope) as con:
        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,$2,$3) "
                          "on conflict (scope) do update set tier=excluded.tier, "
                          "tenant_slug=excluded.tenant_slug", scope, tier, tenant or None)
        await con.execute("insert into card(scope,body,version) values($1::ltree,$2,0) "
                          "on conflict (scope) do update set body=excluded.body",
                          scope, "FICHA · Bar Contexto (Nuria) · cliente\n"
                                 "— Seguridad: sin gluten en la cocina [fijo]")
        # (1) an OLD event (outside a plain 7-day window) an open tab's ORIGIN reaches back to
        old_id, _ = await spine.append_event(con, scope, "message", "wa",
                                             {"text": "ORIGENVIEJO: se rompio la caja de burrata"},
                                             lane="world")
        await con.execute("update event set ts=$2 where id=$1", old_id, now - timedelta(days=old_days))
        # (2) a fresh event inside the 7-day tail
        await spine.append_event(con, scope, "message", "wa",
                                 {"text": "RECIENTE: manana te confirmo el pedido"}, lane="world")
        # (3) the open tab whose ORIGIN is that old event
        tab_id = await con.fetchval(
            "insert into open_loop(scope,kind,text,status,opened_at,opened_by_event,entity_key) "
            "values($1::ltree,'issue','ASUNTOVIVO: reclamacion de la burrata rota','open',$2,$3,"
            "'issue:burrata') returning id", scope, now - timedelta(days=old_days - 1), old_id)
        out["tab_id"], out["old_event_id"] = int(tab_id), int(old_id)
        # (4) a tab REASONING OUTPUT (the advisor slot): a process result bound to that tab
        await spine.append_event(con, scope, "process.completed", "voice",
                                 {"process": "order_brain", "loop_id": int(tab_id), "money": False,
                                  "say": "VEREDICTOTAB: le corresponde abono de 2 unidades",
                                  "fold": {"advice": "VEREDICTOTAB: le corresponde abono de 2 unidades"}},
                                 lane="reasoning")
        # (5) recall fodder — a current fact the hybrid pre-pass must surface for the burst
        await memory.write_fact(con, scope, "RHYTHM", "MEMORIAVIEJA: Nuria dobla la burrata en Navidad")
        # (6) the live order DRAFT + the parked (pending-gate) action
        await spine.append_event(con, scope, "order.drafted", "runtime",
                                 {"lines": [{"qty": 6, "unit": "kg", "name": "Burrata 125g"}],
                                  "unmatched": [{"mention": "queso raro"}], "total": 42.0},
                                 lane="world")
        await con.execute(
            "insert into action(scope,kind,payload,state,reason,needs_human) "
            "values($1::ltree,'send_outbound',$2::jsonb,'pending',$3,true)",
            scope, json.dumps({"sentence": "PARKEADO: te lo dejo a 2,80 el kilo"}), "off_book_price")
        # (7) AHORA MISMO — a live call on this scope
        await spine.append_event(con, scope, "call.started", "voice",
                                 {"call_id": "CTX%d" % (abs(hash(scope)) % 10 ** 6), "caller": scope},
                                 lane="world")
    # (8) the L2 STANDING INSTRUCTION (boss-write path)
    import install
    _rule = "REGLAL2: con Nuria, nunca cierres sin confirmar por escrito."
    try:
        await install.teach_instruction_scoped(scope, _rule, binding=True)
    except Exception:
        # pre-B1 store (an INSTRUCTION fact, dark to assembly, phone-keyed only) — the instrument
        # still MEASURES rather than crashing: the missing slot surfaces as a red component.
        if scope.startswith("wa."):
            try:
                await install.teach_instruction("+" + scope.split(".", 1)[1], _rule)
            except Exception:
                pass
    # (9) the supplier world (tenant row + optionally its catalogue)
    if tenant:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "insert into tenants(slug,name,status,number) values($1,$2,'live','+34910000001') "
                "on conflict (slug) do update set name=excluded.name, number=excluded.number",
                tenant, "Quesos Contexto SL")
            await con.execute("delete from catalogue_skus where tenant_id=$1", tenant)
            await con.execute("delete from catalogue_directory where tenant_id=$1", tenant)
            if with_skus:
                await directory_mod.ensure_schema(con)
                rows = [("Burrata 125g", "lacteo", "unit", 2.1), ("Queso manchego", "lacteo", "kg", 14.5)]
                for i, (n, f, u, p) in enumerate(rows):
                    await con.execute(
                        "insert into catalogue_skus(id,tenant_id,name,family,base_unit,price) "
                        "values($1,$2,$3,$4,$5,$6) on conflict (id) do update set name=excluded.name",
                        "vitalctx:%d" % i, tenant, n, f, u, p)
        if with_skus:
            await directory_mod.build(tenant, force=True)
    return out


async def _chat_bytes(scope, burst, now):
    async with db.scoped_tx(scope) as con:
        a = await assemble_mod.assemble(con, scope, burst, assembled_at=now)
    return a.get("rendered", "")


async def _voice_bytes(phone, scope, utterance):
    """Ring the voice mouth for real: build the pin, drive api_voice_chat with a stubbed R1, and return
    (pin, R1 user grounding bytes, R1 system bytes) — the ACTUAL bytes the model received."""
    app_mod._VOICE_PINS.pop(scope, None)
    pin = await app_mod._build_voice_pin(phone, scope, "es")
    app_mod._VOICE_PINS[scope] = pin
    fake = FakeR1(["Claro, dime.", "Claro, dime."])
    orig = voice_protocol._anthropic
    voice_protocol._anthropic = lambda: fake
    try:
        for _ in range(2):
            resp = await app_mod.api_voice_chat({"messages": [{"role": "user", "content": utterance}],
                                                 "caller": phone, "stream": False})
            _ = json.loads(bytes(resp.body))
            if fake.calls:
                break
    finally:
        voice_protocol._anthropic = orig
    if not fake.calls:
        return pin, "", ""
    return pin, _user_of(fake.calls[0]), _sys_of(fake.calls[0])


def _missing(blob, ids=None):
    ids = ids or list(CHECKLIST)
    return [k for k in ids if CHECKLIST[k] not in blob]


def _section(blob, comp_id):
    """The bytes of ONE component's slot — from its header to the next component header. A component
    is only VERIFIED-IN-BYTES if its CONTENT sits in ITS OWN slot: a fact that merely leaked into the
    recall block is not a standing-instruction slot, and a verdict floating in the window is not a
    tab's reasoning output riding its line."""
    head = CHECKLIST.get(comp_id, "\0")
    if head not in blob:
        return ""
    body = blob.split(head, 1)[1]
    cuts = [body.index(h) for h in CHECKLIST.values() if h in body]
    return body[:min(cuts)] if cuts else body


def _in(blob, comp_id, needle):
    return needle in _section(blob, comp_id)


async def main():
    await db.init()
    now = datetime.now(timezone.utc)

    # ── 1. REGISTRY — one list, no drift between the runtime and this instrument ────────────────
    reg = getattr(assemble_mod, "COMPONENTS", None)
    ck("assemble.COMPONENTS is the ONE §4.1.1 registry and matches this vital's checklist",
       isinstance(reg, dict) and dict(reg) == CHECKLIST,
       "runtime=%s" % (sorted(reg) if isinstance(reg, dict) else reg))

    # ── 2/3. PROSPECT scope, BOTH mouths ───────────────────────────────────────────────────────
    await _clean(PROSPECT_SCOPE)
    await _seed_world(PROSPECT_SCOPE, tier="prospect", with_skus=False, now=now)
    burst = "oye, que hacemos con la burrata de Navidad?"
    chat_p = await _chat_bytes(PROSPECT_SCOPE, burst, now)
    ck("CHAT/prospect: every §4.1.1 component is in the assembled bytes",
       not _missing(chat_p), "missing=%s" % _missing(chat_p))
    pin_p, vuser_p, vsys_p = await _voice_bytes(PROSPECT_PHONE, PROSPECT_SCOPE, burst)
    ck("VOICE/prospect: every §4.1.1 component is in the R1 grounding bytes",
       not _missing(vuser_p), "missing=%s" % _missing(vuser_p))
    ck("VOICE/prospect: the pin carries the component blocks (built once at ring time)",
       all(pin_p.get(k) for k in ("card", "standing", "supplier_card", "checkboxes")),
       "pin_keys=%s" % sorted(pin_p))

    # ── 4/5. CREATOR scope, BOTH mouths ────────────────────────────────────────────────────────
    creator_phone = next(iter(runtime._CREATOR)) if runtime._CREATOR else ""
    if creator_phone:
        c_scope = runtime.scope_of(creator_phone)
        await _clean(c_scope)
        await _seed_world(c_scope, tier="creator", with_skus=False, now=now)
        chat_c = await _chat_bytes(c_scope, burst, now)
        ck("CHAT/creator: every §4.1.1 component is in the assembled bytes",
           not _missing(chat_c), "missing=%s" % _missing(chat_c))
        _, vuser_c, _ = await _voice_bytes(creator_phone, c_scope, burst)
        ck("VOICE/creator: every §4.1.1 component is in the R1 grounding bytes",
           not _missing(vuser_c), "missing=%s" % _missing(vuser_c))
        await _clean(c_scope)
    else:
        ck("CHAT/creator: no ROCOTO_CREATOR_NUMBERS in env", False, "creator scope unavailable")
        ck("VOICE/creator: no ROCOTO_CREATOR_NUMBERS in env", False, "creator scope unavailable")

    # ── 6. THE WINDOW RULE — 7 days OR back to the oldest open tab's ORIGIN ─────────────────────
    ck("CHAT window reaches back to the open tab's ORIGIN event (20d old, outside the 7-day tail)",
       _in(chat_p, "window", "ORIGENVIEJO") and _in(chat_p, "window", "RECIENTE"))
    ck("VOICE window reaches back to the same ORIGIN event (one rule, both mouths)",
       _in(vuser_p, "window", "ORIGENVIEJO") and _in(vuser_p, "window", "RECIENTE"))
    async with db.scoped_tx(PROSPECT_SCOPE) as con:
        await con.execute("update open_loop set status='resolved' where scope=$1::ltree", PROSPECT_SCOPE)
    chat_narrow = await _chat_bytes(PROSPECT_SCOPE, burst, now)
    ck("with no open tab reaching back, the window is a plain 7 days (the 20d event drops out)",
       not _in(chat_narrow, "window", "ORIGENVIEJO") and _in(chat_narrow, "window", "RECIENTE"))
    async with db.scoped_tx(PROSPECT_SCOPE) as con:
        await con.execute("update open_loop set status='open' where scope=$1::ltree", PROSPECT_SCOPE)
    # PINNED CLOCK (SPEC §4.5 determinism rule 3): two assemblies at the SAME assembled_at over the
    # SAME store are byte-identical; a DIFFERENT assembled_at moves the rendered ages (proving the
    # pinned clock is genuinely the one being used, not decoration).
    a1 = await _chat_bytes(PROSPECT_SCOPE, burst, now)
    a2 = await _chat_bytes(PROSPECT_SCOPE, burst, now)
    a3 = await _chat_bytes(PROSPECT_SCOPE, burst, now + timedelta(days=3))
    ck("the window clock is PINNED (same assembled_at -> byte-identical fold; a different one moves it)",
       a1 == a2 and a3 != a1)
    ck("the voice window is NOT row-capped at 12 (the token budget binds, like the chat mouth)",
       12 not in (voice_protocol.pinned_window.__defaults__ or ()),
       "defaults=%s" % (voice_protocol.pinned_window.__defaults__,))

    # ── 7. TAB REASONING OUTPUTS ride WITH their tabs ──────────────────────────────────────────
    ck("CHAT: the tab's latest reasoning output renders ON its tab line (in the OPEN TABS slot)",
       _in(chat_p, "tabs", "VEREDICTOTAB"), "slot=%r" % _section(chat_p, "tabs")[:160])
    ck("VOICE: the same verdict rides the same tab line",
       _in(vuser_p, "tabs", "VEREDICTOTAB"), "slot=%r" % _section(vuser_p, "tabs")[:160])
    import voice_fabric
    ck("order_brain IS registered on the fabric (docstring-vs-bytes drift closed)",
       "order_brain" in voice_fabric.registered(), "registered=%s" % sorted(voice_fabric.registered()))

    # ── 8. CHECKBOX SPLICING (SPEC §6) ─────────────────────────────────────────────────────────
    _cbx = getattr(lifecycle, "checkboxes", None)
    boxes_p = (await _cbx(PROSPECT_SCOPE, "prospect")) if _cbx else {}
    ck("lifecycle.checkboxes returns the canonical §6 set, all derived",
       all(b in boxes_p for b in BOXES), "got=%s" % sorted(boxes_p))
    ck("CHAT: the checkbox set renders in the LIFECYCLE slot (every box, ticked or not)",
       all(_in(chat_p, "lifecycle", b) for b in BOXES),
       "missing=%s" % [b for b in BOXES if not _in(chat_p, "lifecycle", b)])
    ck("VOICE: the checkbox set renders in the LIFECYCLE slot",
       all(_in(vuser_p, "lifecycle", b) for b in BOXES),
       "missing=%s" % [b for b in BOXES if not _in(vuser_p, "lifecycle", b)])
    ck("pre-skus_uploaded: NO catalogue listing block is spliced in",
       "### CATALOGUE" not in chat_p and "### CATALOGUE" not in vuser_p)
    ck("pre-skus_uploaded: the absence is KNOWN-STATE, in words (never missing-data)",
       _in(chat_p, "lifecycle", "skus_uploaded")
       and _in(chat_p, "lifecycle", getattr(lifecycle, "KNOWN_STATE_MARK", "\0")),
       "mark=%r" % (getattr(lifecycle, "KNOWN_STATE_MARK", None),))
    ck("the stage brief READS the boxes (names the next box to tick)",
       "skus_uploaded" in lifecycle.notes(await lifecycle.status(PROSPECT_SCOPE, "prospect")))

    # ── 9. SUPPLIER CARD, BOTH CASES ───────────────────────────────────────────────────────────
    await _clean(CUSTOMER_SCOPE)
    await _seed_world(CUSTOMER_SCOPE, tier="customer", with_skus=True, now=now, tenant=TENANT)
    chat_cust = await _chat_bytes(CUSTOMER_SCOPE, burst, now)
    ck("caller is their CUSTOMER: the SUPPLIER CARD names the tenant they buy from",
       _in(chat_cust, "supplier", "Quesos Contexto SL"))
    ck("post-skus_uploaded: the CATALOGUE listing IS spliced in",
       "### CATALOGUE" in chat_cust and "Burrata" in chat_cust)
    sup_scope = "t." + TENANT
    await _clean(sup_scope)
    await _seed_world(sup_scope, tier="boss", with_skus=True, now=now, tenant=TENANT)
    chat_sup = await _chat_bytes(sup_scope, burst, now)
    self_mark = getattr(assemble_mod, "SUPPLIER_SELF_MARK", "\0")
    ck("caller IS the supplier: the SUPPLIER CARD is their OWN card (marked as such)",
       self_mark != "\0" and _in(chat_sup, "supplier", self_mark))
    ck("the two cases render DIFFERENT supplier blocks (a tenant-card object, not one collapsed string)",
       self_mark != "\0" and not _in(chat_cust, "supplier", self_mark))

    # ── 10. STANDING INSTRUCTIONS (L2) ─────────────────────────────────────────────────────────
    ck("CHAT: the L2 standing instruction renders in its OWN slot (not leaked via recall)",
       _in(chat_p, "standing", "REGLAL2"))
    ck("VOICE: the same L2 rule rides the pinned fold, in its own slot",
       _in(vuser_p, "standing", "REGLAL2"))

    # ── 11. ORDER STATE (draft + pending gate) ─────────────────────────────────────────────────
    ck("CHAT: the live order DRAFT + the parked money action are first-class fold components",
       _in(chat_p, "order_state", "Burrata") and _in(chat_p, "order_state", "off_book_price"),
       "slot=%r" % _section(chat_p, "order_state")[:160])
    ck("VOICE: the same order state rides the fold",
       _in(vuser_p, "order_state", "Burrata") and _in(vuser_p, "order_state", "off_book_price"))

    ck("CHAT: the hybrid recall hit lands in the RECALL slot",
       _in(chat_p, "recall", "MEMORIAVIEJA"), "slot=%r" % _section(chat_p, "recall")[:160])
    ck("VOICE: the same recall hit rides the pinned fold",
       _in(vuser_p, "recall", "MEMORIAVIEJA"))

    # ── 12. retrieve() is exposed to the mind ──────────────────────────────────────────────────
    ck("the retrieve() tool is exposed to the mind (SPEC §4.5 step 4, known-unknown path)",
       any(t.get("name") == "retrieve" for t in agent_reply._tools()),
       "tools=%s" % [t["name"] for t in agent_reply._tools()])
    # ── 13. the L2 boss-write path is TIER-GATED (SPEC §5.6: "customers can never reach them") ──
    boss_tools = [t["name"] for t in agent_reply._tools("boss")]
    cust_tools = [t["name"] for t in agent_reply._tools("customer")]
    ck("teach_rule is in the BOSS tool set and STRUCTURALLY absent from a customer's",
       "teach_rule" in boss_tools and "teach_rule" not in cust_tools,
       "boss=%s customer=%s" % ("teach_rule" in boss_tools, "teach_rule" in cust_tools))

    await _clean(PROSPECT_SCOPE)
    await _clean(CUSTOMER_SCOPE)
    await _clean("t." + TENANT)
    print("\nvital_context: %d/%d green" % (sum(R), len(R)))
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
