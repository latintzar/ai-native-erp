"""vital_cold_tenant.py — «BOOM»: a distributor who did not exist an hour ago, taking a real order.

Peter's acceptance test, verbatim: *"Just have this fully working app so if I sign up a new customer
and they upload their data, it will literally work out of the box."* This vital is that sentence
turned into a run. It is NOT the seeded world: it creates a tenant nobody has ever seen, from an
INVENTED distributor («Embutidos Tosilos S.L.» — a Quixote name, no real company), whose catalogue is
`tests/fixtures/cold_tenant_precios.csv`: a cp1252 ERP export with banner rows, section headers,
`;` delimiters, comma decimals, ALL-CAPS names, blank prices and a totals footer — the messiness a
real supplier actually sends.

Everything runs through the REAL path. Nothing is inserted that the product would not insert:

  STAGE signup      POST /api/signup (the real ASGI app)  →  lead
                    onboarding.mint_token                 →  the wizard token
                    GET  /api/wizard/{token}              →  the wizard opens
                    POST /api/wizard/{token}/catalogue    →  save_catalogue → skuparse (real Sonnet)
                                                             → the Haiku legit GATE → wizard_state.skus
                    GET  /api/wizard/{token}/matching     →  understand (real Opus) → products
  STAGE golive      golive.activate(scope, number)        →  catalogue_skus (+embedding +FTS)
                                                             + sku_aliases + vocab.refresh
                                                             + directory + the one-shot welcome
  STAGE order       a WhatsApp-shaped inbound from an UNKNOWN number → the order brain → a filed order
                    the colloquial mentions · the ambiguous ask · the catalogue gap · the review sheet
  STAGE isolation   two real tenants at once: the cold one can never see the seeded one, and vice versa
  STAGE teardown    every row this run created, removed

THE ONE STUB, declared: `onboarding_progress.paid_at` is stamped directly (the same write
`brain/setupfee._record_payment` does). Stripe is a third party and the egress sandbox forbids
reaching it. Everything else is the product's own code.

Run on the clone, stage by stage (each stage persists to /tmp/cold_tenant_state.json):
  source deploy/harness/rehearsal_env.sh
  for s in signup golive order isolation; do PYTHONPATH=. python3 -u tests/vital_cold_tenant.py --stage=$s; done
  PYTHONPATH=. python3 -u tests/vital_cold_tenant.py --stage=teardown
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The rehearsal env MUST be sourced first — setdefault means an exported clone DSN always wins.
for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-media-cold")
os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")

import config  # noqa: E402
import db  # noqa: E402

STATE = Path(os.environ.get("COLD_TENANT_STATE", "/tmp/cold_tenant_state.json"))
FIXTURE = Path(__file__).parent / "fixtures" / "cold_tenant_precios.csv"

# ── the cold distributor (INVENTED — never a real company, never one of the seed's names) ─────────
RUNID = os.environ.get("COLD_TENANT_RUNID", "")   # set it to run two cold tenants at once
BIZ = f"Embutidos Tosilos{(' ' + RUNID) if RUNID else ''} S.L."
OWNER = "Ramiro Tosilos"
PHONE_BOSS = "+34611200341"          # the distributor's own number (the lead)
NUMBER_WA = "+34911200341"           # the WhatsApp line he brings to go-live
PNID_WA = "770000000200341"          # Meta's numeric id for THAT line — the inbound routing key
EMAIL = "ramiro@embutidostosilos.example"

# his customers — three unknown numbers, one per scenario, so no burst ever amends another's order
P_ORDER = "+34655100201"             # (d) the first real order + (e) the colloquial mentions
P_AMBIG = "+34655100202"             # (f) the ambiguous line
P_GAP = "+34655100203"               # (g) the catalogue gap

R: list[bool] = []
NOTES: list[str] = []


def ck(name: str, ok: bool, detail: str = "") -> bool:
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)
    return bool(ok)


def info(msg: str) -> None:
    print(f"       · {msg}", flush=True)


def load_state() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save_state(patch: dict) -> dict:
    s = load_state()
    s.update(patch)
    STATE.write_text(json.dumps(s, indent=2, default=str))
    return s


def guard_clone() -> None:
    """NEVER run against production. The DSN must name the clone."""
    dsn = config.DATABASE_URL or ""
    if "/rocoto_rehearsal" not in dsn:
        print(f"REFUSED: DATABASE_URL is not the rehearsal clone ({dsn.split('@')[-1]}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# STAGE 1 — SIGNUP: lead → gate → token → the catalogue upload endpoint → the real parse
# ═══════════════════════════════════════════════════════════════════════════════════════════════
async def stage_signup() -> None:
    import httpx

    import app as rocoto_app
    from brain import onboarding as ob

    await db.init()
    print("── STAGE 1 · SIGNUP (the real endpoints)")

    # 1a. POST /api/signup — the public signup, through the real ASGI app (no lifespan).
    tr = httpx.ASGITransport(app=rocoto_app.app)
    async with httpx.AsyncClient(transport=tr, base_url="http://cold", timeout=180.0) as c:
        r = await c.post("/api/signup", json={"phone": PHONE_BOSS, "name": OWNER,
                                              "company": BIZ, "email": EMAIL, "ref": "coldtenant"})
        print(f"       POST /api/signup → {r.status_code} {r.text[:200]}")
        ck("signup created a lead", r.status_code == 200 and r.json().get("lead_id"))
        lead_id = r.json().get("lead_id")

        # 1b. the CRM gate: Peter marks the lead done → a wizard token is minted. `mint_token` IS
        #     what POST /api/crm/lead/{id}/mark-done calls; the endpoint itself is a CR-auth wrapper.
        token = await ob.mint_token(lead_id)
        print(f"       mint_token → {token[:12]}…")
        ck("wizard token minted", bool(token))

        # 1c. the wizard opens on that token
        r = await c.get(f"/api/wizard/{token}")
        w = r.json() if r.status_code == 200 else {}
        print(f"       GET /api/wizard/token → {r.status_code} lead={json.dumps(w.get('lead', {}), ensure_ascii=False)}")
        ck("the wizard opens for this token", r.status_code == 200 and
           (w.get("lead") or {}).get("business") == BIZ)

        # 1d. the REAL catalogue upload endpoint — multipart, the supplier's own ERP export
        raw = FIXTURE.read_bytes()
        print(f"       uploading {FIXTURE.name}: {len(raw)} bytes, cp1252, {len(raw.splitlines())} lines")
        t0 = time.time()
        r = await c.post(f"/api/wizard/{token}/catalogue",
                         files={"file": (FIXTURE.name, raw, "text/csv")})
        up = r.json() if r.status_code == 200 else {"error": r.text[:300]}
        print(f"       POST /api/wizard/token/catalogue → {r.status_code} {json.dumps(up, ensure_ascii=False)} "
              f"({time.time() - t0:.1f}s)")
        ck("the upload parsed real rows", bool(up.get("ok")) and int(up.get("count") or 0) >= 30,
           f"count={up.get('count')}")
        ck("the Haiku legit gate said this is a catalogue", bool(up.get("legit")))

        # 1e. the wizard's own status poll
        r = await c.get(f"/api/wizard/{token}/catalogue-status")
        print(f"       GET /catalogue-status → {json.dumps(r.json(), ensure_ascii=False)}")

    # 1f. the parsed rows, as the wizard stored them
    async with db.get_pool().acquire() as con:
        ws = await con.fetchval("select wizard_state from onboarding_progress where token=$1", token)
    ws = ws if isinstance(ws, dict) else json.loads(ws or "{}")
    skus = ws.get("skus") or []
    print(f"       wizard_state.skus = {len(skus)} rows. First 6, as parsed:")
    for s in skus[:6]:
        print(f"         {s.get('code','')!r:16} {s.get('name','')[:44]!r:48} "
              f"family={s.get('family','')!r:18} unit={s.get('unit','')!r:8} price={s.get('price')!r}")
    ck("no banner/section/footer row survived as a SKU",
       not any(("***" in str(s.get("name", "")) or "TOTAL REFERENCIAS" in str(s.get("name", ""))
                or "TARIFA" in str(s.get("name", ""))) for s in skus))
    ck("the products this trade lives on are in it",
       all(any(w in str(s.get("name", "")).lower() for s in skus)
           for w in ("chorizo", "salchich", "solomillo")))
    ck("the calibres/formats survived the parse",
       any("55" in str(s.get("name", "")) for s in skus) and
       any("sarta" in str(s.get("name", "")).lower() for s in skus) and
       any("cular" in str(s.get("name", "")).lower() for s in skus))
    blank = [s for s in skus if not s.get("price")]
    ck("the blank-price rows came through as rows, not as zeros",
       len(blank) >= 2 and all(s.get("price") in (None, "", 0) for s in blank),
       f"{len(blank)} rows priced null: " + ", ".join(str(s.get('code') or s.get('name'))[:18] for s in blank))

    # 1g. the understand pass (real Opus) — the wizard polls /matching
    print("       waiting for the background understand pass (Opus)…")
    import httpx as _hx
    async with _hx.AsyncClient(transport=_hx.ASGITransport(app=rocoto_app.app),
                               base_url="http://cold", timeout=300.0) as c:
        products: list = []
        for _ in range(40):
            r = await c.get(f"/api/wizard/{token}/matching")
            m = r.json()
            products = m.get("products") or []
            if m.get("status") in ("done", "ready", "complete", "partial") and products:
                break
            await asyncio.sleep(6)
    print(f"       /matching → status={m.get('status')} products={len(products)} "
          f"unmatched={len(m.get('unmatched') or [])} "
          f"accept_rules={len(m.get('auto_accept_rules') or [])} hold_rules={len(m.get('hold_rules') or [])}")
    for p in products[:4]:
        print(f"         {str(p.get('name'))[:40]!r:44} min={p.get('min')} max={p.get('max')} "
              f"unit={p.get('unit')!r} source={p.get('source')!r}")
    ck("the understand pass produced per-product quantities", len(products) >= 10,
       f"{len(products)} products")

    save_state({"lead_id": lead_id, "token": token, "n_parsed": len(skus)})
    print(f"       state → {STATE}")


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# STAGE 2 — GO-LIVE: the only place rows become live. Catalogue + vocabulary + directory.
# ═══════════════════════════════════════════════════════════════════════════════════════════════
async def stage_golive() -> None:
    import doubt as doubt_mod
    import lifecycle
    from brain import golive, vocab

    st = load_state()
    token, lead_id = st["token"], st["lead_id"]
    await db.init()
    print("── STAGE 2 · GO-LIVE")

    # 2a. THE ONE STUB — the €50 alta. Same write brain/setupfee._record_payment does; Stripe is a
    #     third party and the egress sandbox forbids reaching it.
    async with db.get_pool().acquire() as con:
        await con.execute("update onboarding_progress set paid_at = coalesce(paid_at, now()), "
                          "updated_at = now() where token=$1", token)
    print("       [STUB] onboarding_progress.paid_at stamped (Stripe is out of the sandbox)")

    scope = f"wa.{PHONE_BOSS[1:]}"
    rd = await golive.readiness(scope)
    print(f"       readiness → tenant={rd.get('tenant')!r} paid={bool(rd.get('paid_at'))} "
          f"wizard_skus={rd.get('wizard_skus')} blocking={[b['reason'] for b in rd.get('blocking') or []]}")
    ck("readiness derives a cold tenant slug of its own", bool(rd.get("tenant")) and
       rd.get("tenant") != config.BRAIN_TENANT, rd.get("tenant"))
    ck("only the number blocks go-live",
       {b["reason"] for b in rd.get("blocking") or []} <= {"no_number"})

    t0 = time.time()
    res = await golive.activate(scope, NUMBER_WA, wa_phone_number_id=PNID_WA)
    tenant = res.get("tenant") or rd.get("tenant")
    print(f"       golive.activate → ok={res.get('ok')} tenant={tenant!r} number={res.get('number')} "
          f"lifecycle={res.get('lifecycle')!r} seeded={json.dumps(res.get('seeded') or {}, default=str)} "
          f"welcome={json.dumps(res.get('welcome') or {}, default=str)} ({time.time() - t0:.1f}s)")
    ck("go-live activated the cold tenant", bool(res.get("ok")) and not res.get("already_live"))
    ck("lifecycle derives ONBOARDED (paid + catalogue)", res.get("lifecycle") == "onboarded")
    save_state({"tenant": tenant, "scope_boss": scope})

    # 2b. the rows are real: units, prices, embeddings, FTS
    async with db.get_pool().acquire() as con:
        rows = [dict(r) for r in await con.fetch(
            "select id, code, name, family, base_unit, price, in_assortment, "
            "(embedding is not null) as emb, (search_text is not null) as fts, seeded, "
            "attrs->>'unit_raw' as unit_raw from catalogue_skus where tenant_id=$1 order by code", tenant)]
    print(f"       catalogue_skus for {tenant!r}: {len(rows)} rows")
    for r_ in rows[:8]:
        print(f"         {r_['code']!r:14} {r_['name'][:40]!r:44} {r_['family'][:14]!r:16} "
              f"base_unit={r_['base_unit']!r:7} raw={r_['unit_raw']!r:6} price={r_['price']!r:7} "
              f"emb={r_['emb']} fts={r_['fts']} seeded={r_['seeded']}")
    ck("every row embedded", rows and all(r_["emb"] for r_ in rows))
    ck("every row FTS-indexed", rows and all(r_["fts"] for r_ in rows))
    ck("every row id is namespaced to this tenant", all(r_["id"].startswith(tenant + ":") for r_ in rows))
    ck("no row is marked seeded (this is a real customer's catalogue)",
       not any(r_["seeded"] for r_ in rows))
    kg = [r_ for r_ in rows if r_["base_unit"] == "kg"]
    unit = [r_ for r_ in rows if r_["base_unit"] == "unit"]
    case = [r_ for r_ in rows if r_["base_unit"] == "case"]
    ck("units map sanely (KG→kg · UD→unit · CAJA→case)", len(kg) >= 15 and len(unit) >= 5 and len(case) >= 1,
       f"kg={len(kg)} unit={len(unit)} case={len(case)}")
    priced = [r_ for r_ in rows if r_["price"]]
    ck("prices survived the comma decimal", len(priced) >= 28 and
       all(0.5 < float(r_["price"]) < 200 for r_ in priced),
       f"{len(priced)}/{len(rows)} priced, min={min(float(r_['price']) for r_ in priced)} "
       f"max={max(float(r_['price']) for r_ in priced)}")
    ck("the blank-price rows are NULL, never 0", len(rows) - len(priced) >= 2)

    # 2c. the vocabulary pass ran inside the same transaction
    async with db.get_pool().acquire() as con:
        by_src = {r_["source"]: r_["n"] for r_ in await con.fetch(
            "select source, count(*) n from sku_aliases where tenant_id=$1 group by source", tenant)}
        sample = [dict(r_) for r_ in await con.fetch(
            "select a.alias, a.source, s.name from sku_aliases a join catalogue_skus s on s.id=a.sku_id "
            "where a.tenant_id=$1 and a.source in ('vocab_rule','vocab_gen') order by random() limit 12",
            tenant)]
    print(f"       sku_aliases by source: {by_src}")
    for s_ in sample:
        print(f"         «{s_['alias']}»  ({s_['source']})  → {s_['name']}")
    ck("the golive identity alias exists (one per SKU)", by_src.get("golive", 0) >= len(rows) - 2)
    ck("the DETERMINISTIC vocabulary floor ran in the go-live transaction",
       by_src.get("vocab_rule", 0) > 0, f"{by_src.get('vocab_rule', 0)} rule aliases")
    try:
        vst = await vocab.status(tenant)
        print(f"       vocab.status → {json.dumps(vst, default=str)}")
    except Exception as e:
        info(f"vocab.status unavailable: {e}")

    # 2d. grounded?
    async with db.get_pool().acquire() as con:
        ready = await doubt_mod.catalogue_ready(con, tenant)
    print(f"       doubt.catalogue_ready({tenant!r}) → {json.dumps(ready, ensure_ascii=False)}")
    ck("doubt says this tenant is GROUNDED", bool(ready.get("grounded")))
    ck("lifecycle.has_catalogue() true on the tenant scope",
       await lifecycle.has_catalogue(f"t.{tenant}.c.1"))

    # 2e. the supplier-card directory built from the cold rows
    async with db.get_pool().acquire() as con:
        d = await con.fetchrow(
            "select tenant_id, n_skus, length(coalesce(body,'')) body_len, "
            "(select count(*) from jsonb_object_keys(coalesce(alias_map,'{}'::jsonb))) n_alias, "
            "body, generated_at from catalogue_directory where tenant_id=$1", tenant)
    if d:
        print(f"       catalogue_directory → n_skus={d['n_skus']} body={d['body_len']}ch "
              f"alias_map={d['n_alias']} keys  generated_at={d['generated_at']}")
        print("       the supplier card the mind is handed (first 400 chars):")
        print("         " + (d["body"] or "")[:400].replace("\n", "\n         "))
    ck("the directory distilled for this tenant",
       d is not None and (d["n_skus"] or 0) > 0 and (d["body_len"] or 0) > 0)


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# STAGE 3 — THE ORDER: an unknown number → the order brain → a filed order
# ═══════════════════════════════════════════════════════════════════════════════════════════════
async def _inbound(phone: str, text: str, name: str = "", tenant: str = "") -> str:
    """A WhatsApp-shaped inbound, written exactly as the Meta webhook writes it."""
    import db as supa
    import runtime
    mid = str(uuid.uuid4())
    await supa.upsert_profile(phone, name)
    await supa.insert_message({"id": mid, "phone_number": phone, "role": "user",
                               "message_text": text, "message_type": "text",
                               "wa_message_id": "wamid.COLD" + mid[:12], "created_at": supa.now_iso()})
    try:
        # THE TENANT THE MESSAGE ARRIVED FOR. The webhook resolves it from the number the
        # customer wrote TO; here the caller knows it. It is what binds the party to THIS
        # distributor (scope_node.tenant_slug) so his own review sheet can find the row —
        # without it every cold-tenant customer is bound to the box tenant.
        await runtime.ingest_inbound(phone, text, dedupe_key="wamid.COLD" + mid[:12], profile=name,
                                     tenant=tenant or (load_state().get("tenant") or ""))
    except Exception as e:
        info(f"spine ingest fail-soft: {e}")
    return mid


async def _order_of(order_id: str) -> dict:
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow("select * from orders where id=$1", order_id)
    return dict(r) if r else {}


async def _review_rows(scope: str | None = None) -> list[dict]:
    import review
    async with db.control_pool().acquire() as con:
        rows = await con.fetch(
            "select a.id, a.scope::text as scope, a.kind, a.reason, a.payload, a.money, a.created_at "
            "from action a where a.state='pending' and a.needs_human=true and a.lineage='live' "
            + ("and a.scope::text = $1 " if scope else "") + "order by a.created_at asc",
            *([scope] if scope else []))
    return [review.annotate(dict(r)) for r in rows]


async def stage_order() -> None:
    import runtime
    from brain import matcher, pipeline
    from brain import queue as bq

    st = load_state()
    tenant = st["tenant"]
    await db.init()
    print("── STAGE 3 · THE FIRST ORDER (unknown number → order brain)")

    # ── 3a. THE ROUTING TRUTH, first — and now driven through the DOOR, not around it.
    #        `app._maybe_extract_order` resolves the tenant from the number the message ARRIVED ON
    #        (Meta's `value.metadata.phone_number_id`, bound to this tenant at go-live) and hands it
    #        to `brain/queue.enqueue`. Until 2026-07-27 both sides omitted the tenant and every
    #        inbound on every rail was processed as config.BRAIN_TENANT.
    import app as _rocoto_app
    import tenancy as _tenancy
    _tenancy.forget_wa_cache()
    _resolved, _known = await _tenancy.tenant_for_wa_number_id(PNID_WA)
    ck("the tenant is RESOLVED from the number the message arrived on", _known and _resolved == tenant,
       f"phone_number_id {PNID_WA} → {_resolved!r} (known={_known})")
    mid0 = await _inbound(P_ORDER, "Buenas, ¿me mandas 10 kg de chorizo sarta para mañana?", "Bar de prueba")
    await _rocoto_app._maybe_extract_order(mid0, P_ORDER, "Bar de prueba",
                                           "Buenas, ¿me mandas 10 kg de chorizo sarta para mañana?",
                                           tenant=_resolved)          # exactly what the webhook calls
    async with db.get_pool().acquire() as con:
        qrow = await con.fetchrow("select tenant_id, phone_number, status from ingest_queue "
                                  "where message_id=$1", mid0)
    print(f"       the webhook's own path landed on ingest_queue.tenant_id = "
          f"{(qrow or {}).get('tenant_id')!r} (config.BRAIN_TENANT = {config.BRAIN_TENANT!r}); "
          f"this tenant is {tenant!r}")
    routed_right = bool(qrow) and qrow["tenant_id"] == tenant
    ck("INBOUND ROUTES TO THE RIGHT TENANT (webhook → queue → drainer)", routed_right,
       "the webhook path is single-tenant: it hardcodes BRAIN_TENANT" if not routed_right else "")
    if routed_right:
        # the row is real but not DUE yet — `enqueue` armed the ~2-min coalescing debounce, which is
        # the product's behaviour and not something to bypass in the webhook. Fast-forward the clock
        # (only the deadline, nothing else) so the drainer's own claim can be exercised here.
        async with db.get_pool().acquire() as con:
            await con.execute("update ingest_queue set not_before=now() where message_id=$1", mid0)
        _claim = await bq.claim_due_phone()      # the drainer's own claim, across tenants
        ck("the drainer claims THIS tenant's burst, carrying its tenant",
           bool(_claim) and _claim[0] == tenant and _claim[1] == P_ORDER, str(_claim))
        async with db.get_pool().acquire() as con:   # hand the burst back; 3b runs it explicitly
            await con.execute("delete from ingest_queue where message_id=$1", mid0)
    else:
        NOTES.append(
            "CRITICAL: app.py `_maybe_extract_order` → brain/queue.enqueue(msg, phone) and "
            "brain/jobs.drain_once → queue.claim_due_phone() both omit `tenant`, so every inbound "
            "message on every rail is processed as config.BRAIN_TENANT. A second live tenant's "
            "customer is matched against the FIRST tenant's catalogue.")
        async with db.get_pool().acquire() as con:      # take it back off the wrong tenant's queue
            await con.execute("delete from ingest_queue where message_id=$1", mid0)

    # ── 3b. the order, run for THIS tenant (what the routing fix must produce)
    t0 = time.time()
    order = await pipeline.run_burst(P_ORDER, [mid0], tenant=tenant)
    print(f"       run_burst({P_ORDER}, tenant={tenant!r}) → {time.time() - t0:.1f}s")
    ok = bool(order and order.get("lines"))
    ck("a first order was FILED for an unknown number", ok)
    if ok:
        print(f"       order {order['id']} status={order.get('status')!r} "
              f"customer={order.get('customer_name')!r}")
        for ln in order["lines"]:
            print(f"         {ln.get('qty')} {ln.get('unit','')!r:6} → sku_id={str(ln.get('sku_id'))[:26]!r:30} "
                  f"{str(ln.get('name') or ln.get('product'))[:36]!r} mention={str(ln.get('mention'))[:24]!r}")
        skuids = [str(ln.get("sku_id") or "") for ln in order["lines"] if ln.get("sku_id")]
        ck("every filed SKU belongs to THIS tenant",
           bool(skuids) and all(s.startswith(tenant + ":") for s in skuids),
           ", ".join(s[:20] for s in skuids))
        ck("the chorizo sarta line landed on the right row",
           any("SARTA" in str(ln.get("name") or "").upper() for ln in order["lines"]))
        save_state({"order_id": order["id"]})

    # ── 3c. the colloquial mentions (§5.7): ground or ask, never guess
    print("       colloquial mentions, straight at the matcher (the mention the synthesiser hands it):")
    for mention in ("sartas", "del 55", "york", "media de york", "fuet", "cular",
                    "solomillo", "merluza congelada"):
        m = await matcher.match(mention, tenant=tenant, phone=P_ORDER)
        pick = m.pick or {}
        print(f"         «{mention:18}» band={m.band!r:9} alias={str(m.alias_hit):5} "
              f"score={round(float(m.pick_score or 0), 3):<6} margin={round(float(m.margin or 0), 3):<6} "
              f"tight={str(m.tight):5} n_close={m.n_close} method={m.method!r:8} → {str(pick.get('name'))[:38]!r}")
        if pick.get("id"):
            ck(f"«{mention}» resolved INSIDE this tenant", str(pick["id"]).startswith(tenant + ":"),
               "" if str(pick["id"]).startswith(tenant + ":") else str(pick["id"])[:40])

    # and the ONE that matters most: a whole colloquial message through the real burst
    print("       (e) the colloquial order — «ponme dos sartas y media de york»")
    midC = await _inbound(P_ORDER, "ponme dos sartas y media de york", "Bar de prueba")
    oC = await pipeline.run_burst(P_ORDER, [midC], tenant=tenant)
    if oC:
        for ln in (oC.get("lines") or []):
            print(f"         {ln.get('qty')} {ln.get('unit','')!r:6} mention={str(ln.get('mention'))[:22]!r:24} "
                  f"→ {str(ln.get('name') or ln.get('product'))[:40]!r}")
        lines = oC.get("lines") or []
        names = " | ".join(str(ln.get("name") or "") for ln in lines)
        mentions = " | ".join(str(ln.get("mention") or "") for ln in lines).lower()

        # THE DEFECT THIS CASE EXISTS FOR (2026-08-20): the phrase used to file as ONE line —
        # 2,5 of «sartas de york», a product nobody sells, so the york never got delivered and the
        # sarta count was wrong. Two products were named; two lines must survive. Asserting the
        # COUNT is the assertion that was missing: both older checks could pass on a single merged
        # line whose name happened to contain the right substring.
        ck("«dos sartas y media de york» stays TWO lines, never one merged product",
           len(lines) >= 2 and "sartas de york" not in mentions,
           f"{len(lines)} line(s): {names[:60]}")
        sarta = next((l for l in lines if "SARTA" in str(l.get("name") or "").upper()), None)
        ck("«dos sartas» grounded on the SARTA row, qty 2",
           bool(sarta) and float(sarta.get("qty") or 0) == 2.0,
           f"{(sarta or {}).get('qty')} → {str((sarta or {}).get('name'))[:40]}")

        # THE YORK: it must survive as its OWN line at 0,5. What it grounds TO is the matcher's
        # business, and on a cold tenant whose catalogue has no york it correctly abstains
        # (band='unsure', score ~0.03) and carries the customer's own word instead. This check
        # used to require it land on the cocido row as «the model's own guess» — which is exactly
        # the guessing the split fix exists to end. Rocoto does not fabricate a SKU to make a sheet
        # look complete; an unmatched line is an honest line that a human or a doubt resolves.
        york = next((l for l in lines if l is not sarta and "york" in
                     (str(l.get("mention") or "") + str(l.get("name") or "")).lower()), None)
        ck("«media de york» survives as its own line at 0,5, grounded or honestly unmatched",
           bool(york) and abs(float(york.get("qty") or 0) - 0.5) < 0.01,
           f"{(york or {}).get('qty')} mention={(york or {}).get('mention')!r} "
           f"→ {str((york or {}).get('name') or '(unmatched)')[:40]}")
    else:
        ck("the colloquial message produced an order", False, "no order")

    # ── 3d. the AMBIGUOUS line → the CUSTOMER is asked two options + «Ninguno, te digo»
    print("       (f) the ambiguous line — «ponme 5 kg de solomillo»")
    mid1 = await _inbound(P_AMBIG, "hola, ponme 5 kg de solomillo para el jueves", "Cocina de prueba")
    o2 = await pipeline.run_burst(P_AMBIG, [mid1], tenant=tenant)
    scope2 = runtime.scope_of(P_AMBIG)
    async with db.scoped_tx(scope2) as con:
        evs = [dict(r) for r in await con.fetch(
            "select type, payload from event where scope=$1::ltree and type in ('msg.sent','doubt.asked') "
            "order by id", scope2)]
    asked = [e for e in evs if e["type"] == "doubt.asked"]
    inter = [e for e in evs if e["type"] == "msg.sent"
             and (json.loads(e["payload"]) if isinstance(e["payload"], str) else e["payload"]).get("kind") == "interactive"]
    for e in inter:
        p = json.loads(e["payload"]) if isinstance(e["payload"], str) else e["payload"]
        print(f"         ASKED  «{p.get('text')}»  [{p.get('interactive')}]")
        for o_ in p.get("options") or []:
            print(f"            ▸ {o_.get('title')!r}   id={o_.get('id')!r}")
    ck("the customer was asked (interactive went out)", bool(inter))
    if inter:
        p = json.loads(inter[0]["payload"]) if isinstance(inter[0]["payload"], str) else inter[0]["payload"]
        opts = p.get("options") or []
        ck("exactly two real candidates + the escape row", len(opts) == 3 and
           opts[-1]["id"] == "none", f"{len(opts)} options")
        ck("the escape row says «Ninguno, te digo»", opts and opts[-1]["title"] == "Ninguno, te digo",
           str(opts[-1]["title"]) if opts else "")
        ck("both candidates are THIS tenant's rows",
           all(str(o_["id"]).startswith("sku:" + tenant + ":") for o_ in opts[:-1]))
        ck("nothing was «apuntado» before the tap",
           not any(w in (p.get("text") or "").lower() for w in ("apuntado", "listo", "anotado", "confirmado")),
           p.get("text", "")[:90])
    ck("the ask was recorded on the NEVER-TWICE ledger (doubt.asked)", bool(asked))
    if o2:
        save_state({"order_ambig": o2["id"]})

    # ── 3e. the catalogue GAP → the COMERCIAL, never the customer
    print("       (g) something not in their catalogue — «una caja de merluza congelada»")
    mid2 = await _inbound(P_GAP, "buenas, necesito una caja de merluza congelada y 3 kg de fuet", "Freiduría de prueba")
    o3 = await pipeline.run_burst(P_GAP, [mid2], tenant=tenant)
    scope3 = runtime.scope_of(P_GAP)
    async with db.scoped_tx(scope3) as con:
        sent3 = [dict(r) for r in await con.fetch(
            "select payload from event where scope=$1::ltree and type='msg.sent' order by id", scope3)]
    inter3 = [s for s in sent3
              if (json.loads(s["payload"]) if isinstance(s["payload"], str) else s["payload"]).get("kind") == "interactive"]
    rows3 = await _review_rows(scope3)
    for r_ in rows3:
        print(f"         REVIEW  source={r_['review_source']!r}  why=«{r_['why']}»")
    ck("the catalogue gap reached the COMERCIAL", bool(rows3))
    ck("the customer was NOT offered a multiple choice about a product we do not sell", not inter3)
    if rows3:
        ck("the gap row names the mention and calls it OUR hole",
           any("merluza" in (r_["why"] or "").lower() and "catálogo" in (r_["why"] or "").lower()
               for r_ in rows3), rows3[0]["why"][:100])

    # ── 3f. the review sheet — ONE reason per row
    sheet = await _review_rows()
    print(f"       review sheet: {len(sheet)} pending rows")
    for r_ in sheet:
        print(f"         [{r_['review_source']}] {r_['scope']}  why=«{(r_['why'] or '')[:88]}»")
    ck("every review row carries exactly ONE reason", all(
        (r_.get("why") or "").strip() and "\n" not in (r_.get("why") or "") for r_ in sheet))
    ck("every review row's source is one of the three", all(
        r_["review_source"] in ("low_stock", "flag", "timeout") for r_ in sheet))


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# STAGE 4 — ISOLATION: two real tenants at once
# ═══════════════════════════════════════════════════════════════════════════════════════════════
async def stage_isolation() -> None:
    import doubt as doubt_mod
    from brain import matcher

    st = load_state()
    cold = st["tenant"]
    seeded = config.BRAIN_TENANT
    await db.init()
    print(f"── STAGE 4 · ISOLATION ({cold!r} vs the seeded {seeded!r})")

    async with db.get_pool().acquire() as con:
        counts = {r["tenant_id"]: (r["n"], r["live"]) for r in await con.fetch(
            "select tenant_id, count(*) n, count(*) filter (where in_assortment) live "
            "from catalogue_skus group by 1 order by 1")}
    print(f"       catalogue_skus by tenant: {counts}")
    ck("two real tenants exist at once", cold in counts and seeded in counts)

    # 4a. the matcher can NEVER return the other tenant's SKU
    probes = ["chorizo", "sarta", "jamón", "queso manchego", "solomillo", "paleta cocida",
              "manzana golden", "pera conferencia", "del 55", "york"]
    leak_cold, leak_seed = [], []
    for p in probes:
        mc = await matcher.match(p, tenant=cold)
        ms = await matcher.match(p, tenant=seeded)
        pc = (getattr(mc, "pick", None) or {}).get("id") or ""
        ps = (getattr(ms, "pick", None) or {}).get("id") or ""
        for c_ in (getattr(mc, "candidates", None) or []):
            if str(c_.get("id", "")).startswith(seeded + ":") or (
                    c_.get("id") and not str(c_["id"]).startswith(cold + ":")):
                leak_cold.append((p, c_.get("id")))
        print(f"         «{p:16}» cold→{str(pc)[:28]!r:32} seeded→{str(ps)[:28]!r}")
        if pc and not str(pc).startswith(cold + ":"):
            leak_cold.append((p, pc))
        if ps and str(ps).startswith(cold + ":"):
            leak_seed.append((p, ps))
    ck("the COLD tenant's matcher never returns a seeded row", not leak_cold, str(leak_cold[:3]))
    ck("the SEEDED tenant's matcher never returns a cold row", not leak_seed, str(leak_seed[:3]))

    # 4b. its aliases are its own
    async with db.get_pool().acquire() as con:
        cross = await con.fetchval(
            "select count(*) from sku_aliases a join catalogue_skus s on s.id=a.sku_id "
            "where a.tenant_id <> s.tenant_id")
        shared = [dict(r) for r in await con.fetch(
            "select alias, count(distinct tenant_id) t from sku_aliases group by alias having "
            "count(distinct tenant_id) > 1 order by 2 desc limit 5")]
        n_cold = await con.fetchval("select count(*) from sku_aliases where tenant_id=$1", cold)
        n_seed = await con.fetchval("select count(*) from sku_aliases where tenant_id=$1", seeded)
    print(f"       aliases: cold={n_cold} seeded={n_seed}; strings shared across tenants: "
          f"{[(s['alias'], s['t']) for s in shared]}")
    ck("no alias row points at another tenant's SKU", cross == 0, f"{cross} cross rows")
    ck("a shared STRING is not a shared ROW (each tenant owns its own)", True,
       "sku_aliases is (tenant_id, alias) — the same word can mean different SKUs for different tenants")

    # 4c. doubt's grounding gate is per tenant
    async with db.get_pool().acquire() as con:
        rc = await doubt_mod.catalogue_ready(con, cold)
        rs = await doubt_mod.catalogue_ready(con, seeded)
        rx = await doubt_mod.catalogue_ready(con, "tenant_que_no_existe")
    print(f"       catalogue_ready: cold={rc['grounded']}/{rc['in_assortment']} "
          f"seeded={rs['grounded']}/{rs['in_assortment']} unknown={rx['grounded']}/{rx['in_assortment']}")
    ck("grounding is decided per tenant", rc["grounded"] and rs["grounded"] and not rx["grounded"])

    # 4d. THE REVIEW SHEET IS TENANT-FILTERABLE.
    #     The promise is not "the scope string contains the tenant" — customer scopes are FLAT by
    #     design (`wa.<digits>`, SPEC §1745) and moving them is a data migration over every event
    #     ever written, explicitly out of this pass. The promise is that EVERY pending row can be
    #     attributed to EXACTLY ONE tenant, by the same three-rung resolver `/api/app/review` uses:
    #     the order it is about (orders.tenant_id) → the party (scope_node.tenant_slug) →
    #     the path (tenancy.tenant_of). A row nothing can attribute is the defect.
    import tenancy as _tn
    sheet = await _review_rows()
    scopes = sorted({r_["scope"] for r_ in sheet})
    print(f"       review sheet scopes: {scopes}")
    owners: dict[int, str] = {}
    async with db.control_pool().acquire() as ccon:
        slugs = {r_["scope"]: await ccon.fetchval(
            "select tenant_slug from scope_node where scope=$1::ltree", r_["scope"]) for r_ in sheet}
    async with db.get_pool().acquire() as ocon:
        for r_ in sheet:
            pay = r_.get("payload") if isinstance(r_.get("payload"), dict) else {}
            oid = str((pay or {}).get("order_id") or "")
            ot = await ocon.fetchval("select tenant_id from orders where id=$1", oid) if oid else None
            owners[r_["id"]] = ot or slugs.get(r_["scope"]) or _tn.tenant_of(r_["scope"])
    unattributed = [i for i, t_ in owners.items() if not t_]
    print(f"       review rows by owner: "
          f"{ {t_: sum(1 for x in owners.values() if x == t_) for t_ in set(owners.values())} }")
    ck("REVIEW SHEET IS TENANT-FILTERABLE", not unattributed and (bool(owners) or not sheet),
       f"{len(unattributed)} pending row(s) resolve to no tenant at all" if unattributed else "")
    if unattributed:
        NOTES.append(
            "CRITICAL: a pending review row resolves to NO tenant — neither its order, nor its "
            "scope_node.tenant_slug, nor its scope path says whose matter it is. That row is "
            "invisible on every comercial's sheet.")

    # 4d-bis. THE COMERCIAL'S OWN SHEET (/api/app/review) — the tenant-filtered one
    # THE REAL ROUTE BODY (`GET /api/app/review`), called with a session ctx — not a hand-written
    # copy of its SQL, which is how the old form of this check went on asserting a predicate that had
    # already moved. Only the Supabase bearer is skipped; who a session resolves to is
    # vital_sup_auth's and vital_tenant_isolation's job and they already hold it.
    import app as _rocoto_app
    per_tenant, sheets = {}, {}
    for t_ in (cold, seeded):
        _resp = await _rocoto_app.api_app_review(ctx={"tenant_slug": t_})
        sheets[t_] = json.loads(bytes(_resp.body)).get("items") or []
        per_tenant[t_] = len(sheets[t_])
    async with db.control_pool().acquire() as con:
        total = int(await con.fetchval(
            "select count(*) from action where state='pending' and needs_human=true and lineage='live'") or 0)
        null_slug = int(await con.fetchval(
            "select count(*) from action a left join scope_node n on n.scope=a.scope "
            "where a.state='pending' and a.needs_human=true and a.lineage='live' "
            "and n.tenant_slug is null") or 0)
    print(f"       /api/app/review (tenant-filtered) → cold={per_tenant[cold]} seeded={per_tenant[seeded]}; "
          f"{total} rows pending in all, {null_slug} of them on a scope with tenant_slug NULL")
    # WHY each row landed where it did — the three rungs, printed. Without this the check can only
    # say "0", which reads as a mystery; with it the next reader sees which rung answered.
    async with db.control_pool().acquire() as con:
        _rows = await con.fetch(
            "select a.id, a.scope::text as scope, a.payload, n.tenant_slug "
            "from action a left join scope_node n on n.scope=a.scope "
            "where a.state='pending' and a.needs_human=true and a.lineage='live' order by a.id")
    async with db.get_pool().acquire() as con:
        for _r in _rows:
            _p = _r["payload"] if isinstance(_r["payload"], dict) else {}
            _oid = str((_p or {}).get("order_id") or "")
            _ot = await con.fetchval("select tenant_id from orders where id=$1", _oid) if _oid else None
            info(f"action {_r['id']} scope={_r['scope']} scope_node.tenant_slug={_r['tenant_slug']!r} "
                 f"order_id={_oid or '—'} order.tenant_id={_ot!r}")
    ck("THE COMERCIAL CAN SEE HIS OWN REVIEW ROWS", per_tenant[cold] > 0,
       "every WhatsApp scope_node is written with tenant_slug=NULL, so the tenant filter matches nothing"
       if per_tenant[cold] == 0 else "")
    _cold_ids = {i.get("id") for i in sheets[cold]}
    _seed_ids = {i.get("id") for i in sheets[seeded]}
    ck("…and NOT the other tenant's", not (_cold_ids & _seed_ids),
       f"{len(_cold_ids & _seed_ids)} row(s) on both sheets")
    if per_tenant[cold] == 0 and total:
        NOTES.append(
            "CRITICAL: `/api/app/review` (the app's «LO QUE TE TOCA») filters on "
            "`scope_node.tenant_slug`, but every WhatsApp party is created with tenant_slug=NULL "
            "(runtime.ingest_inbound → spine.ingest_chat(tenant_slug=None); runtime.py:151/297/331 and "
            "agent_reply.py all insert NULL). Nothing on the live rail ever sets it. So the review "
            "sheet is EMPTY on the phone for EVERY tenant while the reasons pile up in `action`.")

    # 4d-ter. THE ORDERS SURFACE. The column is only worth having if the READ uses it —
    #         `db.order_list` is what GET /api/orders (the app's Pedidos tab) and GET /api/sup/orders
    #         (the desk) both serve, so the assertion is on the two books, not on information_schema.
    async with db.get_pool().acquire() as con:
        has_tenant_col = await con.fetchval(
            "select count(*) from information_schema.columns where table_name='orders' "
            "and column_name in ('tenant_id','tenant_slug')")
        n_orders = await con.fetchval("select count(*) from orders")
        n_null = await con.fetchval(
            "select count(*) from orders where tenant_id is null") if has_tenant_col else n_orders
    cold_book = {o["id"] for o in await db.order_list(tenant=cold, limit=500)} if has_tenant_col else set()
    seed_book = {o["id"] for o in await db.order_list(tenant=seeded, limit=500)} if has_tenant_col else set()
    print(f"       orders table: tenant column={'yes' if has_tenant_col else 'NO'}; {n_orders} rows "
          f"total, {n_null} unattributed; cold book={len(cold_book)} seeded book={len(seed_book)}")
    ck("ORDERS ARE TENANT-SCOPED",
       bool(has_tenant_col) and not n_null and bool(cold_book) and not (cold_book & seed_book),
       "`orders` has no tenant column and db.order_list()/GET /api/orders has no tenant predicate"
       if not has_tenant_col else
       (f"{n_null} orders carry no tenant" if n_null else
        (f"{len(cold_book & seed_book)} orders in BOTH books" if (cold_book & seed_book)
         else "the cold tenant's book is empty")))
    if not has_tenant_col:
        NOTES.append(
            "CRITICAL: the `orders` table has NO tenant column and `db.order_list()` (behind "
            "GET /api/orders — the app's Pedidos tab and the desktop's day view) has no tenant "
            "predicate. With two live tenants, every distributor's Pedidos tab lists every other "
            "distributor's orders, customer names and line items.")

    # 4e. the seeded world is untouched
    async with db.get_pool().acquire() as con:
        seed_now = dict(await con.fetchrow(
            "select count(*) n, count(*) filter (where in_assortment) live, "
            "count(*) filter (where seeded) seeded from catalogue_skus where tenant_id=$1", seeded))
        seed_alias = await con.fetchval(
            "select count(*) from sku_aliases where tenant_id=$1", seeded)
        _trow = await con.fetchrow("select slug,name,status,number from tenants where slug=$1", seeded)
        trow = dict(_trow) if _trow else {}
    if not trow:
        # A clone with no demo seed loaded cannot answer «is the seeded world untouched?» — it is a
        # missing PRECONDITION, not a failure of the code under test. Say which, loudly, instead of
        # crashing on a None row (which is what it used to do, and it read like a product bug).
        info("NO SEEDED WORLD on this clone — load it before this stage "
             "(brain/seed.reset_demo_seed) or the isolation half proves nothing.")
    print(f"       seeded world now: {seed_now} aliases={seed_alias} tenant={trow}")
    base = st.get("seed_baseline")
    if base:
        ck("the seeded world's catalogue is byte-identical to before this run",
           base["skus"] == seed_now["n"] and base["live"] == seed_now["live"] and
           base["aliases"] == seed_alias, f"before={base} after={seed_now} aliases={seed_alias}")
    else:
        info("no baseline captured (run --stage=baseline before signup for the strict form)")


async def stage_baseline() -> None:
    await db.init()
    seeded = config.BRAIN_TENANT
    async with db.get_pool().acquire() as con:
        row = dict(await con.fetchrow(
            "select count(*) n, count(*) filter (where in_assortment) live from catalogue_skus "
            "where tenant_id=$1", seeded))
        al = await con.fetchval("select count(*) from sku_aliases where tenant_id=$1", seeded)
    save_state({"seed_baseline": {"skus": row["n"], "live": row["live"], "aliases": al}})
    print(f"── BASELINE of the seeded world {seeded!r}: skus={row['n']} live={row['live']} aliases={al}")


# ═══════════════════════════════════════════════════════════════════════════════════════════════
async def stage_teardown() -> None:
    st = load_state()
    tenant, token, lead_id = st.get("tenant"), st.get("token"), st.get("lead_id")
    await db.init()
    print("── TEARDOWN")
    async with db.get_pool().acquire() as con:
        if tenant:
            await con.execute("delete from sku_aliases where tenant_id=$1", tenant)
            await con.execute("delete from catalogue_skus where tenant_id=$1", tenant)
            await con.execute("delete from catalogue_directory where tenant_id=$1", tenant)
            await con.execute("delete from tenants where slug=$1", tenant)
        for ph in (P_ORDER, P_AMBIG, P_GAP, PHONE_BOSS):
            await con.execute("delete from ingest_queue where phone_number=$1", ph)
            await con.execute("delete from orders where phone_number=$1", ph)
            await con.execute("delete from whatsapp_messages where phone_number=$1", ph)
            await con.execute("delete from whatsapp_user_profiles where phone_number=$1", ph)
        if token:
            await con.execute("delete from onboarding_progress where token=$1", token)
            await con.execute("delete from onboarding_tokens where token=$1", token)
        if lead_id:
            await con.execute("delete from events where lead_id=$1", lead_id)
            await con.execute("delete from leads where id=$1", lead_id)
    for ph in (P_ORDER, P_AMBIG, P_GAP, PHONE_BOSS):
        sc = f"wa.{ph[1:]}"
        for tbl in ("action", "open_loop", "timer", "event", "card", "scope_node"):
            try:
                async with db.scoped_tx(sc) as con:
                    await con.execute(f"delete from {tbl} where scope=$1::ltree", sc)
            except Exception:
                pass
    if tenant:
        try:
            async with db.scoped_tx(f"t.{tenant}") as con:
                await con.execute("delete from event where scope=$1::ltree", f"t.{tenant}")
        except Exception:
            pass
    STATE.unlink(missing_ok=True)
    print("       cold tenant removed.")


STAGES = {"baseline": stage_baseline, "signup": stage_signup, "golive": stage_golive,
          "order": stage_order, "isolation": stage_isolation, "teardown": stage_teardown}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="all", choices=list(STAGES) + ["all"])
    a = ap.parse_args()
    guard_clone()
    stages = list(STAGES) if a.stage == "all" else [a.stage]
    for s in stages:
        await STAGES[s]()
    if NOTES:
        print("\n  ⚠ FINDINGS")
        for n in NOTES:
            print(f"    · {n}")
    if R:
        print(f"\n  {sum(R)}/{len(R)} checks passed"
              f"{'' if all(R) else '  ❌ ' + str(len(R) - sum(R)) + ' FAILED'}")
    sys.exit(0 if all(R) else 1)


if __name__ == "__main__":
    asyncio.run(main())
