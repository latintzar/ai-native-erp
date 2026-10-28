"""control_room.py — Rocoto's Control Room (SPEC §15): Peter's real CRM cockpit, desktop-first.

A WINDOW over rows the runtime + funnel already keep — nothing is a second system:
  * board          — every contact/tenant Rocoto knows (runtime scopes ⊎ leads ⊎ demo_leads),
                     paid state, open-tab count, stage, send-onboarding.
  * fractal drill  — one scope's world (§15.2): the CARD as the mind sees it · open TABS + timers ·
                     bi-temporal FACTS (invalidated struck-through) · SUMMARIES · the append-only
                     EVENT LOG (thought-tier toggle) · the WhatsApp + call TRANSCRIPTS · CHILDREN
                     (a tenant's restaurant-customers). Same shape at every level.
  * actions        — send personalised onboarding · send-as-Rocoto (override.outbound) ·
                     the PERSONA console (roleplay a fake customer INTO the real agentic runtime,
                     lineage=test, egress-stubbed) · create a test world · clone-anonymize.

Data reads: the runtime tables cross-scope via the tier-P pool (db.control_pool); the legacy funnel
(leads/demo_leads/whatsapp_messages) via the owner pool. Fail-soft per section. The page + tokens are
in control_room_ui.py (served by the same routes).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

import db
import tenancy

log = logging.getLogger("rocoto.control_room")


def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


def _phone_of_scope(scope: str) -> Optional[str]:
    return tenancy.phone_of_scope(scope) or None   # both scope shapes (WP-A1)


async def board_data() -> dict[str, Any]:
    """The board: every contact/tenant Rocoto knows + the funnel, unified. Newest activity first."""
    out: dict[str, Any] = {"generated_at": datetime.now(timezone.utc).isoformat(), "contacts": [], "stats": {}, "test_worlds": []}
    pool, cpool = db.get_pool(), db.control_pool()

    # runtime scopes with a card (people/tenants Rocoto has a memory of) + their open-tab counts.
    runtime: dict[str, dict] = {}
    try:
        async with cpool.acquire() as con:
            cards = await con.fetch(
                "select c.scope::text scope, n.tier, n.tenant_slug, n.lineage, c.version, c.regenerated_at "
                "from card c left join scope_node n on n.scope=c.scope order by c.regenerated_at desc nulls last limit 500")
            tabcounts = dict([(r["scope"], r["n"]) for r in await con.fetch(
                "select scope::text scope, count(*) n from open_loop where status='open' group by scope")])
            for c in cards:
                sc = c["scope"]
                if c["lineage"] == "test":
                    continue
                runtime[sc] = {"scope": sc, "tier": c["tier"] or "prospect", "tenant_slug": c["tenant_slug"],
                               "card_version": c["version"], "open_tabs": tabcounts.get(sc, 0),
                               "last_at": _iso(c["regenerated_at"]), "phone": _phone_of_scope(sc)}
    except Exception:
        log.exception("board: runtime scan failed")

    # funnel: leads + demo_leads, keyed by phone → merge with runtime scope wa.<digits>.
    by_phone: dict[str, dict] = {}
    try:
        async with pool.acquire() as con:
            leads = await con.fetch(
                "select id,phone,name,business,status,cal_booking_start,created_at,updated_at "
                "from leads where coalesce(is_test,false)=false order by updated_at desc nulls last limit 400")
            demos = await con.fetch(
                "select phone,name,business,summary,status,created_at,ended_at from demo_leads order by created_at desc limit 300")
            for l in leads:
                ph = (l["phone"] or "").strip()
                if not ph:
                    continue
                by_phone[ph] = {"phone": ph, "lead_id": str(l["id"]), "name": l["name"] or "", "business": l["business"] or "",
                                "stage": l["status"] or "nuevo", "booked": bool(l["cal_booking_start"]),
                                "last_at": _iso(l["updated_at"] or l["created_at"]), "summary": "", "source": "lead"}
            for d in demos:
                ph = (d["phone"] or "").strip()
                if not ph:
                    continue
                p = by_phone.setdefault(ph, {"phone": ph, "lead_id": None, "name": "", "business": "", "stage": "prospecto",
                                             "booked": False, "last_at": None, "summary": "", "source": "demo"})
                p["name"] = p["name"] or (d["name"] or "")
                p["business"] = p["business"] or (d["business"] or "")
                p["summary"] = p["summary"] or (d["summary"] or "")
                p["took_demo"] = True
                w = _iso(d["ended_at"] or d["created_at"])
                if w and (not p["last_at"] or w > p["last_at"]):
                    p["last_at"] = w
    except Exception:
        log.exception("board: funnel scan failed")

    # unify: attach runtime scope + tabs to each funnel person; add runtime-only scopes not in the funnel.
    for ph, p in by_phone.items():
        sc = tenancy.scope_of(ph)                  # WP-A1
        rt = runtime.pop(sc, None)
        p["scope"] = sc
        p["open_tabs"] = rt["open_tabs"] if rt else 0
        p["has_memory"] = bool(rt)
    contacts = list(by_phone.values())
    for sc, rt in runtime.items():   # runtime scopes with no funnel row (tenants, direct chats)
        contacts.append({"scope": sc, "phone": rt["phone"], "name": "", "business": rt.get("tenant_slug") or "",
                         "stage": rt["tier"], "booked": False, "last_at": rt["last_at"], "summary": "",
                         "open_tabs": rt["open_tabs"], "has_memory": True, "source": "runtime"})
    contacts.sort(key=lambda x: x.get("last_at") or "", reverse=True)
    out["contacts"] = contacts

    # test worlds (lineage=test scopes)
    try:
        async with cpool.acquire() as con:
            tw = await con.fetch("select scope::text scope, label, tier from scope_node where lineage='test' order by created_at desc limit 50")
            out["test_worlds"] = [dict(r) for r in tw]
    except Exception:
        pass

    out["stats"] = {"contacts": len(contacts),
                    "with_memory": sum(1 for c in contacts if c.get("has_memory")),
                    "open_tabs": sum(c.get("open_tabs", 0) for c in contacts),
                    "booked": sum(1 for c in contacts if c.get("booked"))}
    return out


async def drill_data(scope: str) -> dict[str, Any]:
    """One scope's full world (§15.2). Reads runtime cross-scope via tier-P + transcripts from the funnel."""
    out: dict[str, Any] = {"scope": scope, "card": "", "facts": [], "summaries": [], "tabs": [],
                           "log": [], "children": [], "transcript": [], "person": {}}
    cpool, pool = db.control_pool(), db.get_pool()
    try:
        async with cpool.acquire() as con:
            out["card"] = await con.fetchval("select body from card where scope=$1::ltree", scope) or ""
            # bi-temporal facts (current + invalidated struck-through)
            out["facts"] = [{"kind": r["kind"], "text": r["text"], "key": r["key"],
                             "valid_at": _iso(r["valid_at"]), "invalid_at": _iso(r["invalid_at"]),
                             "dead": r["invalid_at"] is not None}
                            for r in await con.fetch(
                "select kind,text,key,valid_at,invalid_at from fact where scope=$1::ltree order by (invalid_at is not null), valid_at desc limit 80", scope)]
            out["summaries"] = [{"text": r["text"], "ts": _iso(r["ts"])}
                                for r in await con.fetch("select text,ts from summary where scope=$1::ltree order by ts desc limit 30", scope)]
            tabs = await con.fetch(
                "select id,kind,text,contingencies,due_at,status from open_loop where scope=$1::ltree and status='open' order by opened_at desc limit 20", scope)
            for t in tabs:
                timers = await con.fetch("select fires_at,branch_id,state from timer where loop_id=$1 and state='armed'", t["id"])
                out["tabs"].append({"id": t["id"], "kind": t["kind"], "text": t["text"],
                                    "due_at": _iso(t["due_at"]), "contingencies": t["contingencies"],
                                    "timer": (_iso(timers[0]["fires_at"]) if timers else None)})
            # event log (world + reasoning lanes; the UI toggles reasoning)
            out["log"] = [{"id": r["id"], "type": r["type"], "source": r["source"], "lane": r["lane"],
                           "payload": r["payload"], "ts": _iso(r["ts"])}
                          for r in await con.fetch(
                "select id,type,source,lane,payload,ts from event where scope=$1::ltree order by ts desc, id desc limit 120", scope)]
            out["log"].reverse()
            # children: sub-scopes one level down (a tenant's customers)
            kids = await con.fetch(
                "select scope::text scope, label, tier from scope_node where scope <@ $1::ltree and scope != $1::ltree "
                "and nlevel(scope) = nlevel($1::ltree)+1 order by created_at desc limit 60", scope)
            out["children"] = [dict(r) for r in kids]
    except Exception:
        log.exception("drill: runtime read failed for %s", scope)

    # transcripts — the WhatsApp thread + any demo-call transcript for this scope's phone
    phone = _phone_of_scope(scope)
    if phone:
        try:
            async with pool.acquire() as con:
                msgs = await con.fetch(
                    "select role, message_text, transcript, created_at from whatsapp_messages "
                    "where phone_number=$1 order by created_at desc limit 60", phone)
                out["transcript"] = [{"role": m["role"], "text": (m["message_text"] or m["transcript"] or ""), "ts": _iso(m["created_at"])}
                                     for m in reversed(msgs)]
                d = await con.fetchrow("select name,business,summary,lines,status from demo_leads where phone=$1 order by created_at desc limit 1", phone)
                if d:
                    out["person"] = {"name": d["name"], "business": d["business"], "summary": d["summary"], "demo_status": d["status"]}
                    out["call_lines"] = d["lines"]
                lead = await con.fetchrow("select id,name,business,status,email from leads where phone=$1 and coalesce(is_test,false)=false order by created_at desc limit 1", phone)
                if lead:
                    out["person"].update({"name": out["person"].get("name") or lead["name"], "business": out["person"].get("business") or lead["business"],
                                          "stage": lead["status"], "lead_id": str(lead["id"]), "email": lead["email"]})
        except Exception:
            log.exception("drill: transcript read failed")
    return out


async def override_send(scope: str, text: str) -> dict:
    """Send-as-Rocoto (SPEC §15.4): the message ships AND appends as override.outbound (the mind knows
    Peter spoke through it). The §5 gate runs (warn-and-confirm handled client-side)."""
    import actions
    # override=True (B6, SPEC §5.5): MODO SOMBRA shuts ROCOTO's mouth, never the human's — the
    # override rail IS the human speaking, and it is the one hand the boss keeps while in sombra.
    sid = await actions.send_whatsapp_as_rocoto(scope, text, override=True)
    try:
        async with db.scoped_tx(scope) as con:
            # tier-P override on a LIVE party: the identity row must still carry its tenant, or the
            # comercial's own review sheet loses the scope the boss just spoke on.
            import tenancy as _tn
            await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'prospect',$2) on conflict do nothing",
                              scope, _tn.tenant_of(scope))
            import spine
            await spine.append_event(con, scope, "override.outbound", "override", {"text": text, "by": "peter"})
            await con.execute("update pending_turn set state='cancelled' where scope=$1::ltree", scope)
    except Exception:
        log.exception("override_send: event append failed")
    return {"ok": bool(sid), "sid": sid}


async def persona_send(fake_phone: str, text: str) -> dict:
    """THE PERSONA CONSOLE (SPEC §13.4): roleplay a fake customer INTO the real agentic runtime. The
    message hits the SAME agent_reply Rocoto uses live, but on a lineage=test scope with EGRESS STUBBED
    (nothing sends to a real person). Returns Rocoto's actual reply + the actions he took."""
    scope = "test.persona." + re.sub(r"[^0-9]", "", fake_phone) or "test.persona.x"
    # egress sandbox: stub the real call so a persona 'llámame' never dials a real number.
    async def _stub_call(phone, lang="es", name=""):
        return {"token": "test", "sid": "TEST-STUB", "status": "would_call"}
    try:
        # mark the test scope so its facts/events carry lineage=test (via scope_node).
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug,lineage) values($1::ltree,'customer',null,'test') on conflict do nothing", scope)
            await con.execute("insert into card(scope,body,version,lineage) values($1::ltree,'',0,'test') on conflict do nothing", scope)
        # THE REAL event-sourced cycle, pinned to the TEST scope with egress STUBBED (SPEC §13 / CSO #2):
        # nothing reaches a real person — the mind, memory, tabs, gate all run for real on lineage=test.
        import runtime
        out = await runtime.run_turn(fake_phone, text, place_call_fn=_stub_call,
                                     scope_override=scope, egress_stub=True)
        reply = out.get("text", "")
        for a in out.get("actions", []):
            for k in ("send_booking_link", "send_signup_link"):
                if a.get(k) and a[k] not in reply:
                    reply = (reply + "\n" + a[k]).strip()
        return {"ok": True, "reply": reply, "actions": out.get("actions", []), "force_text": out.get("force_text")}
    except Exception as e:  # noqa: BLE001
        log.exception("persona_send failed")
        return {"ok": False, "error": str(e)}


async def create_test_world(sentence: str) -> dict:
    """SPEC §13.1/§15.5 — a full seeded TEST WORLD from one sentence: a test tenant + its PRODUCT
    catalogue + restaurant customers with facts, all lineage=test on an ISOLATED tenant id (t.test_<n>,
    so tenancy.tenant_of returns test_<n> and the catalogue never touches a real tenant). The distilled
    directory is built so the whole order/voice loop is exercisable on the fake world."""
    import json as _json

    import anthropic

    import config
    import directory as _dir
    import memory
    num = str(abs(hash(sentence)) % 9000 + 1000)
    tenant = "test_" + num
    slug = "t." + tenant
    try:
        client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, timeout=40)
        r = await client.messages.create(model=config.VOICE_CHAT_MODEL, max_tokens=1100,
            system=("Genera un MUNDO DE PRUEBA para el CRM de un proveedor de alimentacion espanol. "
                    "Devuelve SOLO JSON: {boss:{name,business}, products:[{name,family,unit,price}] (6-12), "
                    "customers:[{name,business,fact}] (3-6 restaurantes/tiendas)}."),
            messages=[{"role": "user", "content": sentence}])
        txt = "".join(getattr(b, "text", "") for b in r.content)
        data = _json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
        boss = data.get("boss", {}) or {}
        async with db.scoped_tx(slug) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug,label,lineage) values($1::ltree,'boss',$2,$3,'test') on conflict do nothing",
                              slug, tenant, boss.get("business", "test"))
            await con.execute("insert into card(scope,body,version,lineage) values($1::ltree,$2,0,'test') on conflict do nothing", slug,
                              "FICHA - " + str(boss.get("name", "?")) + " - " + str(boss.get("business", "")))
        pool = db.get_pool()
        async with pool.acquire() as ocon:
            for k, p in enumerate(data.get("products", [])[:12]):
                await ocon.execute(
                    "insert into catalogue_skus(id,tenant_id,name,family,base_unit,price,seeded) "
                    "values($1,$2,$3,$4,$5,$6,true) on conflict (id) do nothing",
                    "test:" + tenant + ":" + str(k), tenant, p.get("name", "Producto " + str(k)),
                    p.get("family", ""), p.get("unit", "kg"), float(p.get("price") or 0) or None)
        await _dir.build(tenant, force=True)
        async with db.scoped_tx(slug) as con:
            for i2, cu in enumerate(data.get("customers", [])[:6]):
                cs = slug + ".c." + str(i2 + 1)
                await con.execute("insert into scope_node(scope,tier,tenant_slug,label,lineage) values($1::ltree,'customer',$2,$3,'test') on conflict do nothing", cs, tenant, cu.get("name", ""))
                await con.execute("insert into card(scope,body,version,lineage) values($1::ltree,$2,0,'test') on conflict do nothing", cs, "FICHA - " + str(cu.get("name", "")) + " - " + str(cu.get("business", "")))
                if cu.get("fact"):
                    await memory.write_fact(con, cs, "RELATION", cu["fact"])
        return {"ok": True, "scope": slug, "tenant": tenant,
                "products": len(data.get("products", [])), "customers": len(data.get("customers", []))}
    except Exception as e:  # noqa: BLE001
        log.exception("create_test_world failed")
        return {"ok": False, "error": str(e)}


async def clone_anonymize(real_scope: str) -> dict:
    """SPEC §13.5 — CLONE a real customer's world into a fresh TEST scope, ANONYMIZED: an LLM invents a
    new identity and rewrites every fact stripping identifying info while keeping the commercial SHAPE
    (debts, rhythms, preferences) — a realistic-but-safe test subject. lineage=test."""
    import json as _json

    import anthropic

    import config
    import memory
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            card = await con.fetchval("select body from card where scope=$1::ltree", real_scope) or ""
            facts = await con.fetch("select kind, text from fact where scope=$1::ltree and invalid_at is null limit 40", real_scope)
        src = card + chr(10) + chr(10).join("[" + f["kind"] + "] " + f["text"] for f in facts)
        client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, timeout=40)
        r = await client.messages.create(model=config.VOICE_CHAT_MODEL, max_tokens=900,
            system=("ANONIMIZA este cliente para pruebas: inventa un nombre y negocio NUEVOS y reescribe "
                    "cada dato quitando TODO lo identificable (nombres, telefonos, direcciones, numeros de "
                    "factura reales) conservando la ESTRUCTURA comercial (deudas, ritmos, preferencias). "
                    "Devuelve SOLO JSON: {name, business, facts:[{kind,text}]}."),
            messages=[{"role": "user", "content": src or "cliente generico"}])
        txt = "".join(getattr(b, "text", "") for b in r.content)
        data = _json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
        num = str(abs(hash(real_scope + (data.get("name") or ""))) % 9000 + 1000)
        cs = "test.clone." + num
        async with db.scoped_tx(cs) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug,label,lineage) values($1::ltree,'customer',null,$2,'test') on conflict do nothing", cs, data.get("name", ""))
            await con.execute("insert into card(scope,body,version,lineage) values($1::ltree,$2,0,'test') on conflict do nothing", cs, "FICHA - " + str(data.get("name", "?")) + " - " + str(data.get("business", "")))
            for f in (data.get("facts", []) or [])[:40]:
                if f.get("text"):
                    await memory.write_fact(con, cs, (f.get("kind") or "RELATION").upper(), f["text"])
        return {"ok": True, "scope": cs, "facts": len(data.get("facts", []))}
    except Exception as e:  # noqa: BLE001
        log.exception("clone_anonymize failed")
        return {"ok": False, "error": str(e)}


async def alerts_data() -> dict:
    """The Rocoto→Peter INBOX (WP-8): open alerts (surface_to_peter + escalations), newest first, each
    carrying its ref_scope so the UI can deep-link Peter straight to that contact's world. Fail-soft."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                "select id, created_at, kind, detail, ref_scope, surfaced_via from alert "
                "where resolved_at is null order by id desc limit 60")
        return {"alerts": [{"id": r["id"], "ts": _iso(r["created_at"]), "kind": r["kind"],
                            "detail": r["detail"], "scope": r["ref_scope"], "via": r["surfaced_via"]}
                           for r in rows]}
    except Exception:
        log.exception("alerts_data failed")
        return {"alerts": []}


async def resolve_alert(alert_id: int) -> dict:
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute("update alert set resolved_at=now() where id=$1", int(alert_id))
        return {"ok": True}
    except Exception:
        log.exception("resolve_alert failed")
        return {"ok": False}


async def customer_card(scope: str) -> dict:
    """The APP's customer profile-card read (Track 4b · MVP-DEFINITION "customer profile cards"): one
    scope's CARD (the ficha as the mind holds it) + its bi-temporal FACTS + its open TABS (+ armed
    timer). DELIBERATELY NO event summaries / no event log — the app card is the supplier's clean
    control-room view of what Rocoto knows and is chasing, not a raw feed. A leaner sibling of
    `drill_data` (which the desktop CR uses); reads cross-scope via the tier-P pool. Fail-soft."""
    out: dict[str, Any] = {"scope": scope, "card": "", "facts": [], "tabs": []}
    try:
        cpool = db.control_pool()
        async with cpool.acquire() as con:
            out["card"] = await con.fetchval("select body from card where scope=$1::ltree", scope) or ""
            # bi-temporal facts — current first, invalidated ones flagged dead (struck-through in the UI).
            out["facts"] = [{"kind": r["kind"], "text": r["text"], "key": r["key"],
                             "valid_at": _iso(r["valid_at"]), "dead": r["invalid_at"] is not None}
                            for r in await con.fetch(
                "select kind,text,key,valid_at,invalid_at from fact where scope=$1::ltree "
                "order by (invalid_at is not null), valid_at desc limit 80", scope)]
            tabs = await con.fetch(
                "select id,kind,text,due_at,status from open_loop where scope=$1::ltree and status='open' "
                "order by opened_at desc limit 20", scope)
            for tb in tabs:
                timers = await con.fetch(
                    "select fires_at from timer where loop_id=$1 and state='armed' order by fires_at limit 1", tb["id"])
                out["tabs"].append({"id": tb["id"], "kind": tb["kind"], "text": tb["text"],
                                    "due_at": _iso(tb["due_at"]),
                                    "timer": (_iso(timers[0]["fires_at"]) if timers else None)})
    except Exception:
        log.exception("customer_card failed for %s", scope)
    return out


async def tab_dossier(scope: str, tab_id: int) -> dict:
    """SPEC §15.2 / WP-9 — the SHERLOCK DOSSIER for one tab: the tab itself, its pre-armed SCENARIOS
    (contingencies), the event that OPENED it and what CLOSED it, its timers, and the CASE — every
    event tied to it by entity_key / causal chain / loop reference, chronological. Owner pool. Fail-soft."""
    try:
        async with db.scoped_tx(scope) as con:
            t = await con.fetchrow(
                "select id, kind, text, status, contingencies, answer_shape, notes, due_at, entity_key, "
                "opened_at, opened_by_event, resolved_at, resolution, money, parent_loop_id, superseded_by "
                "from open_loop where id=$1 and scope=$2::ltree", int(tab_id), scope)
            if not t:
                return {"ok": False, "error": "not_found"}
            ek = t["entity_key"]
            opened_by = None
            if t["opened_by_event"]:
                opened_by = await con.fetchrow("select id, ts, type, source, payload from event where id=$1", int(t["opened_by_event"]))
            closed_by = await con.fetchrow(
                "select id, ts, type, source, payload from event where scope=$1::ltree "
                "and type in ('tab.resolved','tab.updated') and (payload->>'loop_id')::text=$2 "
                "order by id desc limit 1", scope, str(t["id"]))
            timers = await con.fetch("select fires_at, state from timer where loop_id=$1 order by fires_at", int(t["id"]))
            case = await con.fetch(
                "select id, ts, type, source, lane, payload from event where scope=$1::ltree and ("
                "  ($2::text is not null and payload->>'entity_key'=$2) "
                "  or id=$3 or caused_by=$3 or (payload->>'loop_id')::text=$4 "
                ") order by ts asc, id asc limit 60",
                scope, ek, int(t["opened_by_event"] or 0), str(t["id"]))
        def _ev(r):
            return {"id": r["id"], "ts": _iso(r["ts"]), "type": r["type"], "source": r["source"],
                    "lane": r["lane"] if "lane" in r else None,
                    "text": (r["payload"] or {}).get("text") if isinstance(r["payload"], dict) else None,
                    "payload": r["payload"]}
        conts = t["contingencies"] or []
        if isinstance(conts, str):
            import json as _j
            try: conts = _j.loads(conts)
            except Exception: conts = []
        return {"ok": True,
                "tab": {"id": t["id"], "kind": t["kind"], "text": t["text"], "status": t["status"],
                        "answer_shape": t["answer_shape"], "notes": t["notes"], "entity_key": ek,
                        "money": t["money"], "opened_at": _iso(t["opened_at"]),
                        "resolved_at": _iso(t["resolved_at"]), "resolution": t["resolution"]},
                "scenarios": conts,
                "opened_by": _ev(opened_by) if opened_by else None,
                "closed_by": _ev(closed_by) if closed_by else None,
                "timers": [{"fires_at": _iso(r["fires_at"]), "state": r["state"]} for r in timers],
                "case": [_ev(r) for r in case]}
    except Exception:
        log.exception("tab_dossier failed")
        return {"ok": False, "error": "read_failed"}


async def summary_sources(scope: str, summary_id: int) -> dict[str, Any]:
    """WP-9 (§15.2 expand-to-raw): the raw events a summary distilled (summary.source_event_ids).
    Cross-scope via the tier-P pool, like drill/tab_dossier. {ok, summary, events} | {ok:False,error}."""
    if not scope or not summary_id:
        return {"ok": False, "error": "bad_args"}
    def _ev(r):
        p = r["payload"]
        if isinstance(p, str):
            import json as _j
            try: p = _j.loads(p)
            except Exception: p = {}
        p = p if isinstance(p, dict) else {}
        return {"id": r["id"], "ts": _iso(r["ts"]), "type": r["type"], "source": r["source"],
                "lane": r["lane"], "text": p.get("text"), "payload": p}
    try:
        cpool = db.control_pool()
        async with cpool.acquire() as con:
            srow = await con.fetchrow(
                "select id, text, ts, source_event_ids from summary where id=$1 and scope=$2::ltree",
                int(summary_id), scope)
            if not srow:
                return {"ok": False, "error": "not_found"}
            ids = [int(x) for x in (srow["source_event_ids"] or [])]
            evs = []
            if ids:
                rows = await con.fetch(
                    "select id, ts, type, source, lane, payload from event "
                    "where scope=$1::ltree and id = any($2::bigint[]) order by ts asc, id asc", scope, ids)
                evs = [_ev(r) for r in rows]
            return {"ok": True, "summary": {"id": srow["id"], "text": srow["text"], "ts": _iso(srow["ts"])},
                    "events": evs}
    except Exception:
        log.exception("summary_sources failed")
        return {"ok": False, "error": "read_failed"}
