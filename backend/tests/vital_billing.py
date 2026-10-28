"""vital_billing.py — M1M2 WP-4: the €500 credit ledger + the 0,3% GMV meter (brain/billing.py).

Proves the whole money loop with Stripe MOCKED (the `billing._invoice_creator` seam):

  1. value snapshot rule (eng F1): line.price → tenant catalogue price → flag unpriced;
     frozen SET-ONCE on the order row (a re-dispatch never rewrites billed history);
  2. setup fee paid → +50000 'setup_fee_credit' ledger row (unique per tenant — a replayed
     webhook adopts, never doubles) + stripe_customer_id persisted (eng F7);
  3. the meter on seeded snapshot orders computes 0.3% EXACTLY, buckets by Europe/Madrid
     calendar month (eng F12 — the 23:30-UTC-on-the-30th order lands where Madrid says),
     debits credit FIRST and never below zero, and emits billing.meter_run every pass (dx F4);
  4. crash-rerun at EACH state (eng F3): a pre-existing 'computed' row keeps its frozen figures;
     a pre-inserted commission ledger row is ADOPTED (no double-debit); a failed invoice parks at
     'debited' with a typed error and the rerun invoices ONCE (no lost, no duplicate invoice);
  5. payment_failed webhook (metadata kind='rocoto_commission') → the chase_salary tab opens
     (the friendly-dunning ladder that already exists); invoice_paid resolves it;
  6. GET /api/agent/billing serves the balance (unit-suffixed *_cents ints, defaults on all);
  7. billing figures ride the keyed-read path: COMMERCIAL facts on the boss scope put the euro
     amounts into gate.standing_prices, so «12,40 € de comisión» never false-parks (eng F10).

SAFETY: refuses the live `rocoto` DB. Usage:  REHEARSAL_DSN=… python tests/vital_billing.py
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

from datetime import datetime, timezone  # noqa: E402

import app as app_mod  # noqa: E402  (the /api/agent/billing endpoint)
import config  # noqa: E402
import db  # noqa: E402
import duties  # noqa: E402
import gate  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
from brain import billing, setupfee  # noqa: E402

TEN = config.BRAIN_TENANT                       # GMV attributes to BRAIN_TENANT (the named shortcut)
PHONE = "+34999444555"
SCOPE = runtime.scope_of(PHONE)                 # our boss scope (newest tier='boss' → facts land here)
TSCOPE = f"t.{TEN}"
TOKEN = "vitalbill-token-1"
LEAD = "vitalbill-lead-1"
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _mad(y, mo, d, hh=12, mi=0):
    return datetime(y, mo, d, hh, mi, tzinfo=billing.TZ)


async def _cleanup():
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id like 'vitalbill-%'")
        await con.execute("delete from catalogue_skus where id like 'vitalbill:%'")
        await con.execute("delete from billing_run where tenant_id=$1", TEN)
        # credit_ledger is append-only for app roles; the vital's owner pool bypasses the trigger?
        # NO — the trigger binds every role. Delete is blocked, so the vital NEVER reuses reasons
        # across runs on a dirty clone; the harness rebuilds the clone fresh each phase. Belt: if
        # rows from a previous ad-hoc run exist, we fail loud below rather than silently adapt.
        await con.execute("delete from onboarding_progress where token=$1", TOKEN)
        await con.execute("delete from onboarding_tokens where token=$1", TOKEN)
        await con.execute("delete from leads where id=$1", LEAD)
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event", "fact"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)
    async with db.scoped_tx(TSCOPE) as con:
        await con.execute("delete from event where scope=$1::ltree and type='billing.meter_run'", TSCOPE)


async def main():
    await db.init()
    duties.invalidate_cache()

    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"VITAL: billing (db={dbname}, tenant={TEN})")

    # a fresh clone has no credit_ledger rows for TEN; a dirty ad-hoc DB would break the arithmetic —
    # fail loud up front (the ledger is append-only by design, we cannot wipe it).
    async with db.get_pool().acquire() as con:
        pre = int(await con.fetchval(
            "select count(*) from credit_ledger where tenant_id=$1", TEN) or 0)
    if pre:
        raise SystemExit(f"credit_ledger already has {pre} row(s) for {TEN} — rebuild the rehearsal "
                         f"clone (the ledger is append-only; this vital needs a clean one)")

    await _cleanup()

    # ── setup: our boss scope (facts + dunning land here) + the live tenant row ──
    async with db.scoped_tx(SCOPE) as con:
        await spine.resolve_chat_scope(con, None, "wa", PHONE, display_name="Boss Billing",
                                       scope_override=SCOPE, tier_override="boss")
        await con.execute("update scope_node set tier='boss' where scope=$1::ltree", SCOPE)
    async with db.get_pool().acquire() as con:
        prior = await con.fetchrow("select status, golive_at from tenants where slug=$1", TEN)
        await con.execute(
            "insert into tenants (slug, name, status, golive_at) values ($1,$1,'live',$2) "
            "on conflict (slug) do update set status='live', golive_at=$2, updated_at=now()",
            TEN, _mad(2026, 6, 5))

    try:
        # ═══ 0 · pure billing math ═══
        ck("commission = 0.3% exactly, integer half-up (413300 → 1240; 167 → 1; 100 → 0)",
           billing.commission_cents(413300) == 1240 and billing.commission_cents(167) == 1
           and billing.commission_cents(100) == 0)
        b = datetime(2026, 6, 30, 22, 30, tzinfo=timezone.utc)     # = 2026-07-01 00:30 Madrid
        ck("Madrid month boundary: 30-Jun 22:30 UTC is period 2026-07",
           billing.period_of(b) == "2026-07", billing.period_of(b))
        ck("elapsed periods bill only FULLY-closed Madrid months",
           billing.elapsed_periods(_mad(2026, 6, 5), _mad(2026, 7, 10)) == ["2026-06"]
           and billing.elapsed_periods(_mad(2026, 5, 20), _mad(2026, 7, 1, 0, 5))
           == ["2026-05", "2026-06"])

        # ═══ 1 · the value snapshot rule + SET-ONCE ═══
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into catalogue_skus (id, tenant_id, name, base_unit, price, in_assortment) "
                "values ('vitalbill:sku1', $1, 'Chorizo vital', 'kg', 5.5, true) "
                "on conflict (id) do nothing", TEN)
            await con.execute(
                "insert into orders (id, phone_number, status, lines) values ($1,$2,'approved','[]')",
                "vitalbill-s1", PHONE)
        o = {"id": "vitalbill-s1", "phone_number": PHONE, "lines": [
            {"item": "tomate", "qty": 3, "unit": "kg", "price": 2.0},                       # stated → 600
            {"item": "chorizo", "qty": 2, "unit": "kg", "sku_id": "vitalbill:sku1"},        # catalogue → 1100
            {"item": "lo de siempre", "qty": 1, "unit": "ud"},                              # unpriced → flag
        ]}
        r = await billing.snapshot_dispatch_values([o])
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select value_snapshot_cents, value_snapshot from orders where id='vitalbill-s1'")
        det = row["value_snapshot"] if isinstance(row["value_snapshot"], dict) else \
            json.loads(row["value_snapshot"] or "{}")
        srcs = [ln["source"] for ln in det.get("lines", [])]
        ck("snapshot rule: stated → catalogue → flag unpriced (600+1100, 1 line flagged)",
           r["written"] == 1 and int(row["value_snapshot_cents"]) == 1700
           and srcs == ["stated", "catalogue", "unpriced"] and det.get("unpriced_lines") == 1,
           f"cents={row['value_snapshot_cents']} srcs={srcs}")
        o2 = dict(o)
        o2["lines"] = [{"item": "tomate", "qty": 3, "unit": "kg", "price": 9.99}]
        r2 = await billing.snapshot_dispatch_values([o2])
        async with db.get_pool().acquire() as con:
            cents2 = int(await con.fetchval(
                "select value_snapshot_cents from orders where id='vitalbill-s1'"))
        ck("snapshot is SET-ONCE: a re-dispatch with new prices never rewrites billed history",
           r2["skipped"] == 1 and cents2 == 1700, f"cents={cents2}")

        # ═══ 2 · setup fee paid → +50000 credit row + saved customer (eng F7) ═══
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into leads (id, phone, name, business) values ($1,$2,'Vital Boss','Bar Vital') "
                "on conflict (id) do nothing", LEAD, PHONE)
            await con.execute(
                "insert into onboarding_tokens (token, lead_id, tenant_slug, status) "
                "values ($1,$2,$3,'active')", TOKEN, LEAD, TEN)
            await con.execute(
                "insert into onboarding_progress (token) values ($1)", TOKEN)
        session = {"id": "cs_vital", "payment_intent": "pi_vital", "invoice": "in_vital",
                   "amount_total": 50000, "currency": "eur", "customer": "cus_vital"}
        await setupfee._record_payment(TOKEN, session)
        await setupfee._record_payment(TOKEN, session)      # the replay/race — must adopt, not double
        async with db.get_pool().acquire() as con:
            led = await con.fetch(
                "select delta_cents, reason from credit_ledger where tenant_id=$1", TEN)
            cust = await con.fetchval(
                "select stripe_customer_id from onboarding_progress where token=$1", TOKEN)
        bal = await billing.credit_balance_cents(TEN)
        ck("paid setup → ONE +50000 'setup_fee_credit' row (replay adopts) + customer persisted",
           len(led) == 1 and int(led[0]["delta_cents"]) == 50000
           and led[0]["reason"] == "setup_fee_credit" and cust == "cus_vital" and bal == 50000,
           f"rows={[(int(x['delta_cents']), x['reason']) for x in led]} cust={cust}")

        # ═══ 3 · the meter: seeded snapshot orders, Madrid buckets, credit-first ═══
        async def _seed_order(oid, when, cents):
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "insert into orders (id, phone_number, status, lines, dispatched_at, "
                    "value_snapshot_cents, value_snapshot) values ($1,$2,'sent','[]',$3,$4,'{}')",
                    oid, PHONE, when, cents)

        await _seed_order("vitalbill-a1", _mad(2026, 6, 10), 400000)
        await _seed_order("vitalbill-a2", _mad(2026, 6, 20), 13200)
        # 31-May 22:30 UTC = 1-Jun 00:30 Madrid → counts in June; 30-Jun 22:30 UTC = July → excluded.
        await _seed_order("vitalbill-a3", datetime(2026, 5, 31, 22, 30, tzinfo=timezone.utc), 100)
        await _seed_order("vitalbill-a4", datetime(2026, 6, 30, 22, 30, tzinfo=timezone.utc), 99999)

        _invoices = []

        async def _mock_invoice(tenant, period, cents, customer_id, is_test, boss_scope):
            _invoices.append({"tenant": tenant, "period": period, "cents": cents,
                              "customer": customer_id})
            return {"ok": True, "invoice_id": f"in_mock_{period}"}

        billing._invoice_creator = _mock_invoice

        scan = await billing.run_meter_once(now=_mad(2026, 7, 10))
        mine = [p for p in scan["processed"] if p["tenant"] == TEN]
        async with db.get_pool().acquire() as con:
            run = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period='2026-06'", TEN)
            n_comm = await con.fetch(
                "select delta_cents, ref_event from credit_ledger where tenant_id=$1 "
                "and reason='commission_2026-06'", TEN)
        bal = await billing.credit_balance_cents(TEN)
        ck("meter scan bills the closed Madrid month: GMV=413300 (boundary in/out) → 0.3% = 1240",
           run is not None and int(run["gmv_cents"]) == 413300
           and int(run["commission_cents"]) == 1240,
           f"gmv={run and run['gmv_cents']} comm={run and run['commission_cents']}")
        ck("credit debited FIRST, card untouched (state=invoiced, invoiced 0, balance 48760)",
           run["state"] == "invoiced" and int(run["credit_debited_cents"]) == 1240
           and int(run["invoiced_cents"]) == 0 and bal == 48760 and not _invoices
           and len(mine) == 1, f"state={run['state']} bal={bal} invoices={_invoices}")
        async with db.scoped_tx(TSCOPE) as con:
            ev = await con.fetchrow(
                "select payload from event where scope=$1::ltree and type='billing.meter_run' "
                "order by id desc limit 1", TSCOPE)
        pay = ev["payload"] if ev and isinstance(ev["payload"], dict) else \
            (json.loads(ev["payload"]) if ev else {})
        ck("billing.meter_run rides the spine (all 5 figures) and the ledger row REFS it (dx F4)",
           ev is not None and pay.get("period") == "2026-06" and pay.get("gmv_cents") == 413300
           and pay.get("commission_cents") == 1240 and pay.get("credit_debited_cents") == 1240
           and pay.get("invoiced_cents") == 0
           and len(n_comm) == 1 and n_comm[0]["ref_event"] is not None,
           f"payload={pay} ledger_ref={n_comm and n_comm[0]['ref_event']}")

        rescan = await billing.run_meter_once(now=_mad(2026, 7, 10))
        async with db.get_pool().acquire() as con:
            n_comm2 = int(await con.fetchval(
                "select count(*) from credit_ledger where tenant_id=$1 "
                "and reason='commission_2026-06'", TEN))
        ck("rerun of an invoiced period is a no-op (no double-debit, one commission row)",
           not [p for p in rescan["processed"] if p["tenant"] == TEN and p["period"] == "2026-06"]
           and n_comm2 == 1 and await billing.credit_balance_cents(TEN) == 48760)

        # ═══ 4 · crash-rerun at each state (eng F3) ═══
        # (a) crash AFTER compute: a 'computed' row already exists with FROZEN figures → the rerun
        # keeps them (never recomputes GMV, which would be 0 for 2026-03) and debits exactly once.
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into billing_run (tenant_id, period, state, gmv_cents, commission_cents) "
                "values ($1,'2026-03','computed',1000000,3000)", TEN)
        ra = await billing.process_run(TEN, "2026-03")
        async with db.get_pool().acquire() as con:
            rowa = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period='2026-03'", TEN)
        ck("crash-after-compute rerun keeps the FROZEN figures + debits once (3000 → bal 45760)",
           ra.get("state") == "invoiced" and int(rowa["commission_cents"]) == 3000
           and int(rowa["credit_debited_cents"]) == 3000
           and await billing.credit_balance_cents(TEN) == 45760,
           f"ra={ra} comm={rowa['commission_cents']}")

        # (b) crash AFTER the ledger insert (before the state flip): the pre-existing commission row
        # is ADOPTED via unique(tenant_id, reason) — no second debit, billing_run adopts its value.
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into billing_run (tenant_id, period, state, gmv_cents, commission_cents) "
                "values ($1,'2026-02','computed',500000,1500)", TEN)
            await con.execute(
                "insert into credit_ledger (tenant_id, delta_cents, reason) "
                "values ($1,-1500,'commission_2026-02')", TEN)
        rb = await billing.process_run(TEN, "2026-02")
        async with db.get_pool().acquire() as con:
            rowb = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period='2026-02'", TEN)
            nb = int(await con.fetchval(
                "select count(*) from credit_ledger where tenant_id=$1 "
                "and reason='commission_2026-02'", TEN))
        ck("crash-after-debit rerun ADOPTS the existing ledger row (one row, no double-debit)",
           rb.get("state") == "invoiced" and nb == 1
           and int(rowb["credit_debited_cents"]) == 1500
           and await billing.credit_balance_cents(TEN) == 44260,
           f"n={nb} debited={rowb['credit_debited_cents']} bal={await billing.credit_balance_cents(TEN)}")

        # (c) the remainder invoice: drain credit to 100, July commission=300 → debit 100 (NEVER
        # negative), remainder 200 on the card. First attempt FAILS (stripe down) → parks at
        # 'debited' with a typed error; the rerun invoices ONCE (idempotent, no lost invoice).
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into credit_ledger (tenant_id, delta_cents, reason, detail) "
                "values ($1,-44160,'vital_drain','{}')", TEN)
        ck("drain: balance now 100", await billing.credit_balance_cents(TEN) == 100)

        async def _boom(tenant, period, cents, customer_id, is_test, boss_scope):
            return {"ok": False, "error": "stripe:boom"}

        billing._invoice_creator = _boom
        rc1 = await billing.process_run(TEN, "2026-07")
        async with db.get_pool().acquire() as con:
            rowc = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period='2026-07'", TEN)
        ck("invoice failure parks at 'debited' with a typed error (credit already 100, never < 0)",
           rc1.get("state") == "debited" and rowc["state"] == "debited"
           and rowc["error"] == "stripe:boom" and int(rowc["credit_debited_cents"]) == 100
           and int(rowc["commission_cents"]) == 300
           and await billing.credit_balance_cents(TEN) == 0,
           f"rc1={rc1} err={rowc['error']}")

        billing._invoice_creator = _mock_invoice
        rc2 = await billing.process_run(TEN, "2026-07", force=True)   # force past the 6h retry pacing
        rc3 = await billing.process_run(TEN, "2026-07", force=True)   # and once more — must be a no-op
        async with db.get_pool().acquire() as con:
            rowc2 = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period='2026-07'", TEN)
            nc = int(await con.fetchval(
                "select count(*) from credit_ledger where tenant_id=$1 "
                "and reason='commission_2026-07'", TEN))
        ck("the rerun invoices the remainder ONCE on the saved card (200 to cus_vital; no re-debit)",
           rc2.get("state") == "invoiced" and rc3.get("skipped")
           and rowc2["state"] == "invoiced" and int(rowc2["invoiced_cents"]) == 200
           and rowc2["stripe_invoice_id"] == "in_mock_2026-07"
           and len(_invoices) == 1 and _invoices[0]["cents"] == 200
           and _invoices[0]["customer"] == "cus_vital" and nc == 1
           and await billing.credit_balance_cents(TEN) == 0,
           f"invoices={_invoices} state={rowc2['state']}")

        # ═══ 5 · payment_failed → the chase_salary tab (the existing dunning ladder) ═══
        obj = {"metadata": {"kind": "rocoto_commission", "tenant": TEN, "period": "2026-07",
                            "invoice_key": f"comm-{TEN}-2026-07", "tenant_scope": SCOPE},
               "total": 20000}
        f1 = await billing.on_stripe_invoice_event(obj, "invoice.payment_failed")
        f2 = await billing.on_stripe_invoice_event(obj, "invoice.payment_failed")   # replay → dedup
        async with db.scoped_tx(SCOPE) as con:
            tab = await con.fetchrow(
                "select id, status, money from open_loop where scope=$1::ltree and entity_key=$2",
                SCOPE, f"salary:comm-{TEN}-2026-07")
        ck("payment_failed (kind=rocoto_commission) → chase_salary tab OPENS once (money tab)",
           f1.get("handled") and f2.get("dedup") and tab is not None and tab["status"] == "open"
           and bool(tab["money"]),
           f"f1={f1.get('handled')} f2_dedup={f2.get('dedup')} tab={tab and dict(tab)}")
        p1 = await billing.on_stripe_invoice_event(obj, "invoice.paid")
        async with db.scoped_tx(SCOPE) as con:
            tstat = await con.fetchval(
                "select status from open_loop where scope=$1::ltree and entity_key=$2",
                SCOPE, f"salary:comm-{TEN}-2026-07")
        ck("invoice.paid resolves the salary tab", p1.get("handled") and tstat == "resolved",
           f"status={tstat}")
        ck("a non-commission invoice is ignored (setup-fee path untouched)",
           (await billing.on_stripe_invoice_event({"metadata": {"token": "x"}}, "invoice.paid"))
           .get("ignored") == "not_commission")

        # ═══ 6 · the endpoint serves the balance (unit-suffixed ints, defaults on all) ═══
        resp = await app_mod.api_agent_billing(None)
        body = json.loads(resp.body)
        cents_keys = [k for k in body if k.endswith("_cents")]
        ck("GET /api/agent/billing: *_cents all ints with defaults; balance + last run served",
           body.get("tenant") == TEN and body.get("credit_cents") == 0
           and len(cents_keys) >= 7 and all(isinstance(body[k], int) for k in cents_keys)
           and body.get("last_billed_period") == "2026-07"
           and body.get("last_invoiced_cents") == 200,
           f"body={ {k: body[k] for k in sorted(body)} }")

        # ═══ 7 · in-chat awareness: the amounts ride keyed facts → never false-park (eng F10) ═══
        async with db.scoped_tx(SCOPE) as con:
            facts = {r["key"]: r["text"] for r in await con.fetch(
                "select key, text from fact where scope=$1::ltree and kind='COMMERCIAL' "
                "and invalid_at is null and key like 'billing:%'", SCOPE)}
            sp = await gate.standing_prices(con, SCOPE)
        v_ok = gate.check_outbound("La comisión de junio son 12,40 € en total.", sp)
        v_park = gate.check_outbound("La comisión de junio son 99,99 € en total.", sp)
        ck("billing keyed facts exist on the boss scope (billing:credit + billing:comision:…)",
           "billing:credit" in facts and any(k.startswith("billing:comision:") for k in facts),
           f"keys={sorted(facts)}")
        ck("«12,40 € de comisión» matches standing prices (no false-park); an off-book 99,99 parks",
           12.4 in sp and not v_ok.get("needs_approval") and v_park.get("needs_approval"),
           f"sp={sorted(set(sp))} ok={v_ok.get('reason')} park={v_park.get('reason')}")

    finally:
        billing._invoice_creator = billing._default_invoice_creator
        # restore the tenant row + drop our rows (the ledger is append-only — the clone rebuild
        # owns its removal; everything else is cleaned here).
        async with db.get_pool().acquire() as con:
            if prior is not None:
                await con.execute("update tenants set status=$2, golive_at=$3 where slug=$1",
                                  TEN, prior["status"], prior["golive_at"])
            else:
                await con.execute("delete from tenants where slug=$1", TEN)
        await _cleanup()

    passed = sum(R)
    print(f"\nBILLING: {passed}/{len(R)} passed — "
          f"{'CREDIT-FIRST, EXACT, CRASH-SAFE, AUTO-CHARGE' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
