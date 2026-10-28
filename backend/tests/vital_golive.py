"""vital_golive.py — THE CATALOGUE→GROUNDING BRIDGE vital (M1M2 WP-1) — part 1: seed_catalogue.
  1. SEED — wizard-shaped SKUs land in catalogue_skus: rows embedded + FTS'd, units mapped,
     has_catalogue() true on the tenant scope, the debounced directory rebuild armed.
  2. GROUND — the matcher grounds against the seeded catalogue (alias clean + fuzzy pick).
  3. DIRECTORY — the distill builds from the seeded rows; catalogue_seeded on the spine.
  4. RE-RUN IDEMPOTENT — same set → zero re-embeds, no new rows, spine event dedupe-swallowed.
  5. RE-UPLOAD — a dropped SKU flips in_assortment=false (row survives); its return flips it back
     WITHOUT a re-embed.
  6. 0-SKU REFUSED — an empty upload can never wipe a live catalogue (and bad tenants refuse).
  7. NO CROSS-TENANT CLOBBER — same-content catalogues on two tenants stay fully isolated.
  8. ADAPTER — seed_from_wizard reads the lead's latest LIVE wizard_state.skus (test rows ignored).
— part 2: the WP-2 go-live step (readiness + activate) —
  9. READINESS — the block a paid+catalogued lead surfaces: only no_number blocks (the input satisfies
     it); a derived slug appears when the token has none.
 10. BLOCKING — each typed reason surfaces with es-ES copy: not_paid · no_catalogue · bad_number ·
     number_taken · no_lead.
 11. GOLIVE — paid+catalogue+number → onboarded (derived) + tenant live/number bound/golive_at set +
     catalogue seeded + welcome sent ONCE (egress-stubbed) + msg.sent/onboarding.golive on the spine.
 12. ONE-SHOT — golive×2 → second is {ok, already_live}, still exactly one welcome.
Run on the clone: PYTHONPATH=. venv/bin/python tests/vital_golive.py
"""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import db
import directory  # noqa: E402
from brain import golive, matcher  # noqa: E402

TEN_A, TEN_B, TEN_C = "vitalgla", "vitalglb", "vitalglc"
TEN_D, TEN_X = "vitalgld", "vitalglx"            # part 2: the golive tenant + the number-taken decoy
TENANTS = (TEN_A, TEN_B, TEN_C, TEN_D, TEN_X)
# part-2 leads (phones live on the unique leads.phone index — vital-reserved range, cleaned both ends)
P_OK, P_UNPAID, P_NOCAT = "+34600111222", "+34600111223", "+34600111224"
SCOPE_OK = "wa." + P_OK[1:]
NUM_OWN = "+34600999888"                         # the number Peter binds at golive
R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

SKUS = [
    {"code": "CH-01", "name": "Chorizo picante casero", "family": "embutidos", "unit": "kg", "price": 9.5},
    {"code": "", "name": "Queso manchego curado", "family": "quesos", "unit": "ud", "price": 12},
    {"code": "TO-77", "name": "Tomate seco en aceite", "family": "conservas", "unit": "caja", "price": None},
]

async def _rows(tenant):
    async with db.get_pool().acquire() as con:
        return [dict(r) for r in await con.fetch(
            "select id, code, name, base_unit, in_assortment, (embedding is not null) as embedded, "
            "(search_text is not null) as fts, attrs->>'row_hash' as row_hash "
            "from catalogue_skus where tenant_id=$1 order by name", tenant)]

async def _n_events(tenant, etype):
    async with db.scoped_tx(f"t.{tenant}") as con:
        return int(await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type=$2", f"t.{tenant}", etype) or 0)

async def _n_events_scope(scope, etype):
    async with db.scoped_tx(scope) as con:
        return int(await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type=$2", scope, etype) or 0)

async def _cleanup():
    pool = db.get_pool()
    async with pool.acquire() as con:
        for t in TENANTS:
            await con.execute("delete from sku_aliases where tenant_id=$1 and source='golive'", t)
            await con.execute("delete from catalogue_skus where tenant_id=$1", t)
            await con.execute("delete from catalogue_directory where tenant_id=$1", t)
            await con.execute("delete from tenants where slug=$1", t)
        await con.execute("delete from onboarding_progress where token like 'vitalgl%'")
        await con.execute("delete from onboarding_tokens where token like 'vitalgl%'")
        await con.execute("delete from leads where id like 'vitalgl%'")
        await con.execute("delete from whatsapp_messages where phone_number = any($1::text[])",
                          [P_OK, P_UNPAID, P_NOCAT])
    for t in TENANTS:
        try:
            async with db.scoped_tx(f"t.{t}") as con:
                await con.execute("delete from event where scope=$1::ltree", f"t.{t}")
        except Exception:
            pass
        task = directory._PENDING.pop(t, None)
        if task and not task.done():
            task.cancel()
    for ph in (P_OK, P_UNPAID, P_NOCAT):
        try:
            async with db.scoped_tx("wa." + ph[1:]) as con:
                await con.execute("delete from action where scope=$1::ltree", "wa." + ph[1:])
                await con.execute("delete from event where scope=$1::ltree", "wa." + ph[1:])
        except Exception:
            pass


async def _mk_lead(lead_id, phone, tenant_slug, paid, skus, business=""):
    """A LIVE lead + token + wizard progress in one shot (part-2 fixtures)."""
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into leads (id, phone, name, business) values ($1,$2,$3,$4)",
            lead_id, phone, "Ana Prueba", business)
        await con.execute(
            "insert into onboarding_tokens (token, lead_id, tenant_slug, status) "
            "values ($1,$2,$3,'used')", "vitalgl_" + lead_id, lead_id, tenant_slug)
        await con.execute(
            "insert into onboarding_progress (token, wizard_state, step, version, paid_at) "
            "values ($1,$2,5,1,$3)", "vitalgl_" + lead_id, {"skus": skus},
            datetime.now(timezone.utc) if paid else None)

async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        await directory.ensure_schema(con)
    await _cleanup()

    # 1. SEED — rows embedded, has_catalogue true, debounce armed
    r1 = await golive.seed_catalogue(TEN_A, SKUS)
    rows = await _rows(TEN_A)
    ck("seed ok: 3 skus, 3 embedded", r1.get("ok") and r1.get("skus") == 3 and r1.get("embedded") == 3, str(r1))
    ck("rows embedded + FTS'd + tenant-prefixed ids",
       len(rows) == 3 and all(r["embedded"] and r["fts"] and r["id"].startswith(TEN_A + ":") for r in rows))
    by_name = {r["name"]: r for r in rows}
    ck("units mapped kg/ud/caja → kg/unit/case + code carried",
       by_name["Chorizo picante casero"]["base_unit"] == "kg"
       and by_name["Chorizo picante casero"]["code"] == "CH-01"
       and by_name["Queso manchego curado"]["base_unit"] == "unit"
       and by_name["Tomate seco en aceite"]["base_unit"] == "case")
    import lifecycle
    ck("has_catalogue() true on the tenant scope", await lifecycle.has_catalogue(f"t.{TEN_A}.c.34999000111"))
    armed = directory._PENDING.get(TEN_A)
    ck("debounced directory rebuild armed", armed is not None and not armed.done())

    # 2. GROUND — alias fast-path clean + fuzzy pick
    m1 = await matcher.match("Chorizo picante casero", tenant=TEN_A)
    ck("exact name grounds CLEAN via alias", m1.alias_hit and m1.band == "clean"
       and (m1.pick or {}).get("sku_id") == by_name["Chorizo picante casero"]["id"],
       f"band={m1.band} method={m1.method}")
    m2 = await matcher.match("chorizo", tenant=TEN_A)
    ck("fuzzy mention picks the right SKU",
       (m2.pick or {}).get("sku_id") == by_name["Chorizo picante casero"]["id"],
       f"band={m2.band} pick={(m2.pick or {}).get('name')}")

    # 3. DIRECTORY distills + the spine carries catalogue_seeded
    d = await directory.build(TEN_A)
    async with db.get_pool().acquire() as con:
        body = await con.fetchval("select body from catalogue_directory where tenant_id=$1", TEN_A) or ""
    ck("directory distills the seeded catalogue", d.get("built") and d.get("n_skus") == 3
       and "Chorizo picante casero" in body, str(d))
    ck("catalogue_seeded event on the tenant scope",
       await _n_events(TEN_A, "onboarding.catalogue_seeded") == 1)

    # 4. RE-RUN IDEMPOTENT — zero re-embeds, no new rows, event deduped
    r2 = await golive.seed_catalogue(TEN_A, SKUS)
    rows2 = await _rows(TEN_A)
    ck("re-run: 0 embedded, 3 unchanged, no new rows",
       r2.get("ok") and r2.get("embedded") == 0 and r2.get("unchanged") == 3 and len(rows2) == 3, str(r2))
    ck("re-run: spine event dedupe-swallowed", r2.get("event") == "dedup"
       and await _n_events(TEN_A, "onboarding.catalogue_seeded") == 1)
    ck("re-run: ids + hashes stable",
       {r["id"]: r["row_hash"] for r in rows} == {r["id"]: r["row_hash"] for r in rows2})

    # 5. RE-UPLOAD — dropped SKU flips in_assortment=false, returns without re-embed
    r3 = await golive.seed_catalogue(TEN_A, SKUS[:2])
    rows3 = {r["name"]: r for r in await _rows(TEN_A)}
    ck("dropped SKU flips in_assortment=false (row survives)",
       r3.get("removed") == 1 and len(rows3) == 3
       and rows3["Tomate seco en aceite"]["in_assortment"] is False
       and rows3["Chorizo picante casero"]["in_assortment"] is True, str(r3))
    r4 = await golive.seed_catalogue(TEN_A, SKUS)
    rows4 = {r["name"]: r for r in await _rows(TEN_A)}
    ck("returning SKU reactivates WITHOUT re-embed",
       r4.get("reactivated") == 1 and r4.get("embedded") == 0
       and rows4["Tomate seco en aceite"]["in_assortment"] is True, str(r4))

    # 6. REFUSALS — 0 SKUs / junk rows / bad tenant never touch the catalogue
    r0 = await golive.seed_catalogue(TEN_A, [])
    rj = await golive.seed_catalogue(TEN_A, [{"code": "X", "name": "   "}])
    rt = await golive.seed_catalogue("", SKUS)
    rows5 = await _rows(TEN_A)
    ck("0-SKU / junk / bad-tenant refused with typed reasons",
       r0 == {"ok": False, "reason": "no_skus"} and rj.get("reason") == "no_skus"
       and rt.get("reason") == "no_tenant")
    ck("refusal leaves the live catalogue intact",
       len(rows5) == 3 and all(r["in_assortment"] for r in rows5))

    # 7. NO CROSS-TENANT CLOBBER — same content on tenant B, then a B re-upload; A untouched
    rb = await golive.seed_catalogue(TEN_B, SKUS)
    await golive.seed_catalogue(TEN_B, SKUS[:1])          # B drops two — must not touch A
    rows_a = await _rows(TEN_A)
    rows_b = await _rows(TEN_B)
    ck("tenant B seeds its own rows (disjoint ids)", rb.get("ok")
       and {r["id"] for r in rows_a}.isdisjoint({r["id"] for r in rows_b}))
    ck("A untouched by B's seed + re-upload",
       len(rows_a) == 3 and all(r["in_assortment"] for r in rows_a)
       and sum(1 for r in rows_b if r["in_assortment"]) == 1)
    mb = await matcher.match("Queso manchego curado", tenant=TEN_A)
    ck("A still grounds clean after B's runs", mb.alias_hit and mb.band == "clean")

    # 8. ADAPTER — latest LIVE wizard state wins; test rows ignored; typed refusal on unknown lead
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into onboarding_tokens (token, lead_id, tenant_slug, status) "
            "values ('vitalgl_tok','vitalgl_lead',$1,'used')", TEN_C)
        await con.execute(
            "insert into onboarding_progress (token, wizard_state, step, version) "
            "values ('vitalgl_tok', $1, 5, 1)", {"skus": SKUS})
        await con.execute(
            "insert into onboarding_tokens (token, lead_id, tenant_slug, status, is_test) "
            "values ('vitalgl_tok_test','vitalgl_lead',$1,'used',true)", TEN_C)
        await con.execute(
            "insert into onboarding_progress (token, wizard_state, step, version, is_test, updated_at) "
            "values ('vitalgl_tok_test', $1, 5, 1, true, now() + interval '1 hour')",
            {"skus": [{"name": "TEST ROW — must never seed"}]})
    ra = await golive.seed_from_wizard("vitalgl_lead")
    rows_c = await _rows(TEN_C)
    ck("adapter seeds the lead's LIVE wizard skus under the token's tenant_slug",
       ra.get("ok") and ra.get("tenant") == TEN_C and len(rows_c) == 3
       and all("TEST ROW" not in r["name"] for r in rows_c), str(ra))
    rn = await golive.seed_from_wizard("vitalgl_nobody")
    ck("unknown lead → typed refusal", rn == {"ok": False, "reason": "no_wizard"})

    # ═══ PART 2 · the WP-2 go-live step ═══════════════════════════════════════════════════════════
    # egress-stubbed welcome: count every send instead of touching any rail (belt over EGRESS_SANDBOX)
    import twilio_wa
    SENT = []
    async def _fake_send(phone, text, media_url=None):
        SENT.append((phone, text)); return "VITAL-wa"
    _real_send = twilio_wa.send_whatsapp
    twilio_wa.send_whatsapp = _fake_send

    await _mk_lead("vitalgl2_ok", P_OK, TEN_D, paid=True, skus=SKUS, business="La Huerta Buena")
    await _mk_lead("vitalgl2_unpaid", P_UNPAID, None, paid=False, skus=SKUS, business="Bar Manolo")
    await _mk_lead("vitalgl2_nocat", P_NOCAT, "vitalglc2", paid=True, skus=[])

    # 9. READINESS — paid+catalogued lead: only no_number blocks; derived slug when the token has none
    rd = await golive.readiness(SCOPE_OK)
    ck("readiness: paid + wizard skus + only no_number blocking",
       rd.get("paid_at") and rd.get("wizard_skus") == 3 and not rd.get("active")
       and [b["reason"] for b in rd.get("blocking", [])] == ["no_number"], str(rd))
    rdu = await golive.readiness("wa." + P_UNPAID[1:])
    ck("readiness: unpaid lead surfaces not_paid + a DERIVED tenant slug",
       any(b["reason"] == "not_paid" for b in rdu.get("blocking", []))
       and (rdu.get("tenant") or "").startswith("bar_manolo_"), str(rdu))

    # 10. BLOCKING — every typed reason surfaces with es-ES copy
    a1 = await golive.activate("wa." + P_UNPAID[1:], NUM_OWN)
    ck("activate unpaid → not_paid (es-ES)", not a1.get("ok") and a1.get("reason") == "not_paid"
       and "pago" in (a1.get("message") or "").lower(), str(a1))
    a2 = await golive.activate("wa." + P_NOCAT[1:], NUM_OWN)
    ck("activate without catalogue → no_catalogue", not a2.get("ok")
       and a2.get("reason") == "no_catalogue" and "catálogo" in (a2.get("message") or "").lower())
    a3 = await golive.activate(SCOPE_OK, "612 345")
    ck("bad number → bad_number", not a3.get("ok") and a3.get("reason") == "bad_number")
    a4 = await golive.activate(SCOPE_OK, "")
    ck("missing number → no_number", not a4.get("ok") and a4.get("reason") == "no_number")
    async with db.get_pool().acquire() as con:
        await con.execute("insert into tenants (slug, name, status, number) values ($1,'Decoy','draft',$2)",
                          TEN_X, NUM_OWN)
    a5 = await golive.activate(SCOPE_OK, NUM_OWN)
    ck("number already bound elsewhere → number_taken", not a5.get("ok")
       and a5.get("reason") == "number_taken")
    a6 = await golive.activate("wa.34999888777", NUM_OWN)   # no such lead
    ck("unknown contact → no_lead", not a6.get("ok") and a6.get("reason") == "no_lead")
    ck("no welcome sent on any refusal", len(SENT) == 0)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from tenants where slug=$1", TEN_X)

    # 11. GOLIVE — the happy path: seed + bind + activate + welcome, spine carries it
    g1 = await golive.activate(SCOPE_OK, NUM_OWN)
    async with db.get_pool().acquire() as con:
        trow = await con.fetchrow("select status, number, golive_at from tenants where slug=$1", TEN_D)
        n_cat = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment", TEN_D)
    ck("golive ok: lifecycle derived onboarded", g1.get("ok") and not g1.get("already_live")
       and g1.get("lifecycle") == "onboarded", str({k: g1.get(k) for k in ("ok", "reason", "lifecycle")}))
    ck("tenant live + number bound + golive_at set",
       trow and trow["status"] == "live" and trow["number"] == NUM_OWN and trow["golive_at"] is not None)
    ck("catalogue seeded through the WP-1 bridge", int(n_cat or 0) == 3)
    ck("welcome sent ONCE to the boss with the app link",
       len(SENT) == 1 and SENT[0][0] == P_OK and "Rocoto" in SENT[0][1] and "http" in SENT[0][1])
    ck("readiness after: active, nothing blocking",
       (g1.get("readiness") or {}).get("active") and not (g1.get("readiness") or {}).get("blocking"))
    n_welcome = await _n_events_scope(SCOPE_OK, "msg.sent")
    ck("msg.sent welcome event on the wa scope", n_welcome == 1)
    ck("onboarding.golive event on the tenant scope",
       await _n_events(TEN_D, "onboarding.golive") == 1)

    # 12. ONE-SHOT — a second golive is a friendly no-op: no re-welcome, no re-activation
    g2 = await golive.activate(SCOPE_OK, NUM_OWN)
    ck("golive×2 → already_live no-op", g2.get("ok") and g2.get("already_live") is True)
    ck("still exactly one welcome + one msg.sent",
       len(SENT) == 1 and await _n_events_scope(SCOPE_OK, "msg.sent") == 1)

    twilio_wa.send_whatsapp = _real_send

    await _cleanup()
    print(f"\nvital_golive: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
