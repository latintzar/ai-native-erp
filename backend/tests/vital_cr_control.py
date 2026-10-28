"""vital_cr_control.py — WP-9 cr-control: account · refund · GDPR erase/anonymize.

The money/data gate, hardened per the threat model. Deterministic; stripe.Refund.create is STUBBED (no
network). Asserts: the account card shows the shared Rocoto number + the refundable setup-fee payment;
refund resolves the payment_intent SERVER-SIDE (never a client value), passes a Stripe idempotency_key,
writes a WRITE-AHEAD 'pending' audit row BEFORE the call, updates the refund ledger, and refuses a
second (over-)refund past charged−already; export returns the subject's data; erase REJECTS a non-leaf
scope and, on a leaf, wipes the FULL manifest (scope runtime rows + endpoint + entity_map + legacy
leads/whatsapp) leaving zero subject rows, with a 'data.erase.complete' audit; anonymize scrubs PII
in place.
"""
import asyncio
import os
import sys
import types
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import cr_control  # noqa: E402
import db
import spine

A = "wa.34600111222"; PA = "+34600111222"
B = "wa.34600333444"; PB = "+34600333444"
R = []; _CALLS = []; FAILS = []
def ck(n, ok, d=""):
    R.append(bool(ok))
    if not ok: FAILS.append(n)
    print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

# ── stub Stripe (cr_control.refund does `import stripe` lazily → picks this up) ──
class _FakeRefund:
    @staticmethod
    def create(**kw):
        _CALLS.append(kw)
        return type("R", (), {"id": "re_test", "amount": kw.get("amount", 0)})()
sys.modules["stripe"] = types.SimpleNamespace(Refund=_FakeRefund, api_key=None, max_network_retries=0)

async def _seed(scope, phone, name):
    async with db.scoped_tx(scope) as con:
        await con.execute("insert into scope_node(scope,tier,label,lineage) values($1::ltree,'prospect',$2,'live') on conflict do nothing", scope, name)
        await con.execute("insert into card(scope,body) values($1::ltree,$2) on conflict (scope) do update set body=excluded.body", scope, f"nombre: {name}")
        cid = await con.fetchval("insert into contact(scope,display_name,tier) values($1::ltree,$2,'prospect') returning id", scope, name)
        await con.execute("insert into endpoint(contact_id,kind,addr) values($1,'wa',$2) on conflict do nothing", cid, phone)
        await spine.append_event(con, scope, "message", "twilio_wa", {"text": f"hola soy {name}"}, lane="world", actor="human")
    async with db.get_pool().acquire() as con:
        lid = await con.fetchval("insert into leads(id,phone,name,business) values(gen_random_uuid()::text,$1,$2,'Bar') returning id", phone, name)
        tok = f"vctl-{phone}"
        await con.execute("insert into onboarding_tokens(token,lead_id,status) values($1,$2,'active')", tok, lid)
        await con.execute("insert into onboarding_progress(token,step,paid_at,stripe_payment_intent,amount_total) "
                          "values($1,5,now(),'pi_ctl_'||$2,5000)", tok, phone.replace('+',''))
        await con.execute("insert into whatsapp_messages(id,phone_number,role,message_text,created_at) values($1,$2,'user','hola',now())", "vctl-"+phone, phone)

async def _clean(scope, phone):
    async with db.scoped_tx(scope) as con:
        await con.execute("delete from endpoint where contact_id in (select id from contact where scope=$1::ltree)", scope)
        for t in ("event", "card", "contact", "scope_node", "summary", "open_loop", "timer", "entity_map"):
            await con.execute(f"delete from {t} where scope=$1::ltree", scope)
    async with db.get_pool().acquire() as con:
        # anonymize rewrites phone/name to the DETERMINISTIC pseudonym — a stale anon row from a prior
        # run collides on the next anonymize (unique phone) and hides raw-PII reads. Purge BOTH forms.
        pseud = cr_control._pseudonym(phone)
        await con.execute("delete from whatsapp_messages where phone_number like $1 or phone_number=$2 or id=$3",
                          phone[:8] + "%", pseud, "vctl-" + phone)
        await con.execute("delete from leads where phone=$1", pseud)
        await con.execute("delete from demo_leads where phone=$1", pseud)
        await con.execute("delete from onboarding_progress where token like $1", "vctl-%")
        await con.execute("delete from onboarding_tokens where token like $1", "vctl-%")
        await con.execute("delete from leads where phone like $1", phone[:8] + "%")

async def main():
    await db.init()
    # SAFETY GUARD — never the live rocoto DB (this vital writes leads/wa rows + fires CR controls).
    async with db.get_pool().acquire() as con:
        if await con.fetchval("select current_database()") == "rocoto":
            raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    for s, p in ((A, PA), (B, PB), (A + ".child", PA)):
        try: await _clean(s, p)
        except Exception: pass
    await _seed(A, PA, "Ana")

    # ── account ──
    acc = await cr_control.account_data(A)
    ck("account ok", acc.get("ok"))
    ck("account shows the shared Rocoto number", bool(acc.get("rocoto_number")))
    ck("account lists the refundable setup-fee payment", any((pp.get("payment_intent") or "").startswith("pi_ctl_") for pp in acc.get("payments", [])))

    # ── refund (server-resolved pi, stubbed Stripe, idempotency, write-ahead audit, ledger, cap) ──
    r1 = await cr_control.refund(A, 5000, "test", "peter@leo.casa", "1.2.3.4")
    ck("refund ok", r1.get("ok"), str(r1.get("error")))
    ck("refund resolved the payment_intent SERVER-SIDE", bool(_CALLS) and (_CALLS[0].get("payment_intent") or "").startswith("pi_ctl_"))
    ck("refund passed a Stripe idempotency_key", bool(_CALLS and _CALLS[0].get("idempotency_key")))
    first_idem = _CALLS[0].get("idempotency_key")
    async with db.get_pool().acquire() as con:
        ledger = await con.fetchval("select refunded_amount from onboarding_progress where token like 'vctl-%' and stripe_payment_intent like 'pi_ctl_%' order by refunded_amount desc limit 1")
        pend = await con.fetchval("select count(*) from cr_audit where action='refund' and result='pending' and target_scope=$1", A)
    ck("refund ledger updated to 5000", ledger == 5000, f"ledger={ledger}")
    ck("write-ahead 'pending' audit row landed before Stripe", pend >= 1)
    n_before = len(_CALLS)
    r2 = await cr_control.refund(A, 5000, "again", "peter@leo.casa", "1.2.3.4")
    ck("second full refund REFUSED (already fully refunded — no extra Stripe call)", (not r2.get("ok")) and len(_CALLS) == n_before)
    # idempotency determinism (#cso-2): simulate a post-Stripe ledger-write failure (refunded_amount stuck
    # at 0), then a retry MUST re-send the IDENTICAL idempotency_key so Stripe no-ops instead of double-refunding.
    async with db.get_pool().acquire() as con:
        await con.execute("update onboarding_progress set refunded_amount=0, refunded_at=null where stripe_payment_intent like 'pi_ctl_%'")
    _CALLS.clear()
    await cr_control.refund(A, 5000, "retry", "peter@leo.casa", "1.2.3.4")
    ck("refund idempotency_key is DETERMINISTIC across a retry (no double-refund)",
       len(_CALLS) == 1 and _CALLS[0].get("idempotency_key") == first_idem,
       f"retry_idem_matches={bool(_CALLS) and _CALLS[0].get('idempotency_key') == first_idem}")

    # ── export ──
    ex = await cr_control.export_data(A)
    ck("export ok + carries the card", ex.get("ok") and bool(ex.get("data", {}).get("card")))

    # ── anonymize (in place) ──
    an = await cr_control.erase(A, "peter@leo.casa", "1.2.3.4", mode="anonymize")
    ck("anonymize ok", an.get("ok"))
    pseud = cr_control._pseudonym(PA)
    async with db.scoped_tx(A) as con:
        body = await con.fetchval("select body from card where scope=$1::ltree", A)
        ev_pii = await con.fetchval("select count(*) from event where scope=$1::ltree and payload::text ilike '%Ana%'", A)
        cname = await con.fetchval("select display_name from contact where scope=$1::ltree order by id limit 1", A)
    async with db.get_pool().acquire() as con:
        orig_gone = await con.fetchval("select count(*) from leads where phone=$1", PA)          # phone scrubbed
        nm = await con.fetchval("select name from leads where phone=$1", pseud)                  # anonymised lead
        wam_ana = await con.fetchval("select count(*) from whatsapp_messages where phone_number=$1", PA)
    ck("anonymize scrubbed the card body", body == "[anonimizado]")
    ck("anonymize scrubbed the RAW EVENT payload (no original name survives)", ev_pii == 0, f"ev_pii={ev_pii}")
    ck("anonymize scrubbed the contact display_name", cname == "[anonimizado]", f"cname={cname!r}")
    ck("anonymize removed the raw phone + name from the lead", orig_gone == 0 and nm == "[anonimizado]", f"orig_gone={orig_gone} nm={nm!r}")
    ck("anonymize repointed the whatsapp messages off the raw phone", wam_ana == 0)

    # ── erase: leaf-only guard ──
    await _seed(B, PB, "Beto")
    async with db.scoped_tx(B + ".child") as con:
        await con.execute("insert into scope_node(scope,tier,label,lineage) values($1::ltree,'customer','C','live') on conflict do nothing", B + ".child")
    refused = await cr_control.erase(B, "peter@leo.casa", "1.2.3.4", mode="erase")
    ck("erase REFUSES a non-leaf (parent) scope", (not refused.get("ok")) and refused.get("error") == "not_a_leaf_scope")
    async with db.scoped_tx(B + ".child") as con:
        await con.execute("delete from scope_node where scope=$1::ltree", B + ".child")

    # ── erase: leaf → full-manifest wipe ──
    er = await cr_control.erase(B, "peter@leo.casa", "1.2.3.4", mode="erase")
    ck("erase ok on the leaf", er.get("ok"), str(er.get("error")))
    async with db.scoped_tx(B) as con:
        left = 0
        for t in ("event", "card", "contact", "scope_node"):
            left += await con.fetchval(f"select count(*) from {t} where scope=$1::ltree", B)
        endp = await con.fetchval("select count(*) from endpoint where addr=$1", PB)
    async with db.get_pool().acquire() as con:
        wam = await con.fetchval("select count(*) from whatsapp_messages where phone_number=$1", PB)
        lds = await con.fetchval("select count(*) from leads where phone=$1", PB)
        onp = await con.fetchval("select count(*) from onboarding_progress where token=$1", "vctl-" + PB)
        done = await con.fetchval("select count(*) from cr_audit where action='data.erase.complete' and target_scope=$1", B)
    ck("post-erase: scope runtime rows gone (event/card/contact/scope_node)", left == 0, f"left={left}")
    ck("post-erase: endpoint (raw phone) gone", endp == 0)
    ck("post-erase: legacy whatsapp + leads + onboarding gone", wam == 0 and lds == 0 and onp == 0)
    ck("erase left a 'data.erase.complete' audit", done >= 1)

    for s, p in ((A, PA), (B, PB), (A + ".child", PA)):
        try: await _clean(s, p)
        except Exception: pass
    print(f"\nvital_cr_control: {sum(R)}/{len(R)} green")
    if not all(R):
        print("FAILED_CKS: " + " || ".join(FAILS))
        raise SystemExit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except BaseException as _e:
        import traceback; traceback.print_exc()
        print(f"CRASHED: {type(_e).__name__}: {_e}")
        raise SystemExit(1)
