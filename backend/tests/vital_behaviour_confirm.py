"""vital_behaviour_confirm.py — `behaviour.confirm` GOVERNS ONE MESSAGE AND NOTHING ELSE.

PUNCH LIST B0, and the finding is about the LIVE product, not the demo. `behaviour.confirm` is
labelled «cuándo sale la tarjeta ¿Es correcto?» and is flippable in production through
`POST /api/sup/behaviour`. Setting it to `never` returned from `_settle_review` before
`ask_order_confirm` — and `ask_order_confirm`'s «Sí» branch was the ONLY caller of
`_offer_portal_link`. So a supplier who decided one message was noise silently switched off the
RECEIPT RAIL for every one of their customers, permanently, with nothing logged and nothing on the
label to say so. §17.55j's exact failure mode: a setting that promises one effect and delivers two.

`PRODUCT-SPEC.md:6465` says «vitals gate the wiring» for these branches. They did not — which is
how B0 shipped. This is that gate, and it asserts the pair in BOTH directions, because the fix is
only correct if it does not also start double-sending:

  ① confirm='always' (THE DEFAULT, and every untouched tenant) — the card is asked, and NO link
    goes out on the filing. The link is the «Sí» tap's job here, exactly as before.
  ② confirm='never' — no card, AND THE RECEIPT STILL GOES OUT.
  ③ confirm='doubt' with nothing doubtful — no card, receipt goes out.
  ④ confirm='doubt' WITH something doubtful — the card is asked, no link on the filing.
  ⑤ ONCE PER CUSTOMER, enforced by the spine (`portal.link_sent`) and not by the branch: a second
    filed order for the same customer sends no second link, under any setting.
  ⑥ the vocabulary itself still round-trips through `behaviour.set/get`.

Nothing reaches WhatsApp: `actions.send_whatsapp_as_rocoto` and `portal.link_for` are stubbed, and
the class-E egress sandbox is on in the harness anyway.

SAFETY: refuses the live `rocoto` DB.
Run on prod as root:  PYTHONPATH=. venv/bin/python tests/vital_behaviour_confirm.py
"""
import asyncio
import os
import secrets
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

import behaviour  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402

R = []
STAMP = secrets.token_hex(3)
TEN = f"vitalconfirm{STAMP}"


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_clone() -> None:
    dsn = config.DATABASE_URL or ""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0]
    if tail == "rocoto" or "rehearsal" not in tail:
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


DOUBTED = {"lines": [{"kind": "UNKNOWN", "mention": "percebes"}]}
CLEAN: dict = {"lines": []}


async def main():
    guard_clone()
    print("VITAL: behaviour.confirm (one setting, one effect — punch list B0)")
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB")
    print(f"  (db={dbname})")

    import actions
    import portal
    import runtime as rt
    from brain import pipeline

    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants(slug,name,status,seeded,country) "
            "values($1,'Vital confirm','test',true,'ES') on conflict (slug) do nothing", TEN)

    sent: list[str] = []
    asked: list[str] = []
    parked: list[str] = []

    async def _stub_send(scope, text, **kw):
        sent.append(str(text))
        return {"ok": True}

    async def _stub_link(phone, tenant=""):
        return {"url": f"https://soyrocoto.com/p/{STAMP}"}

    async def _spy_card(phone, order_id, tenant):
        asked.append(str(order_id))
        return {"ok": True}

    async def _stub_checks(phone, tenant, lines):
        return {"ok": True, "inventory": False}, {"known": False}

    async def _stub_hold(scope, source, text="", detail=None):
        parked.append(str(source))
        return {"ok": True}

    async def _stub_doubt_q(*a, **kw):
        return {"ok": True}

    import review
    real = (actions.send_whatsapp_as_rocoto, portal.link_for, pipeline.ask_order_confirm,
            pipeline.order_checks, review.hold_for_review, pipeline.ask_doubt_question)
    actions.send_whatsapp_as_rocoto = _stub_send
    portal.link_for = _stub_link
    pipeline.ask_order_confirm = _spy_card
    pipeline.order_checks = _stub_checks
    review.hold_for_review = _stub_hold
    pipeline.ask_doubt_question = _stub_doubt_q

    async def _clear(phone):
        """A fresh customer for each case — the receipt is once per SCOPE, so reusing one would make
        every case after the first pass for the wrong reason."""
        scope = rt.scope_of(phone)
        async with db.scoped_tx(scope) as con:
            await con.execute("insert into scope_node(scope,tier,tenant_slug,lineage) "
                              "values($1::ltree,'customer',$2,'live') on conflict do nothing",
                              scope, TEN)
            await con.execute("delete from event where scope=$1::ltree", scope)
        return scope

    async def _run(setting: str, verdict: dict, phone: str):
        await behaviour.set_keys(TEN, confirm=setting)
        sent.clear(); asked.clear()
        await pipeline._settle_review(
            phone, {"_doubt": verdict, "lines": [], "_order_norm": {}},
            f"ord_{secrets.token_hex(3)}", TEN)
        return list(sent), list(asked)

    try:
        # ══ ① THE DEFAULT ════════════════════════════════════════════════════════════════════════
        print("\n① confirm='always' — nothing changes for an untouched tenant")
        p1 = "+34600" + STAMP + "01"
        await _clear(p1)
        s, a = await _run("always", CLEAN, p1)
        ck("the ¿Es correcto? card is asked", len(a) == 1, str(a))
        ck("…and NO portal link went out on the filing (the «Sí» tap still owns it)",
           not s, str(s))

        # ══ ② THE BUG ════════════════════════════════════════════════════════════════════════════
        print("\n② confirm='never' — no card, BUT THE RECEIPT STILL GOES OUT")
        p2 = "+34600" + STAMP + "02"
        scope2 = await _clear(p2)
        s, a = await _run("never", CLEAN, p2)
        ck("no card is asked (which is what the supplier actually asked for)", not a, str(a))
        ck("B0: THE CUSTOMER STILL GETS THEIR PORTAL LINK", len(s) == 1 and "soyrocoto" in s[0],
           str(s)[:120])
        async with db.scoped_tx(scope2) as con:
            n = await con.fetchval("select count(*) from event where scope=$1::ltree "
                                   "and type='portal.link_sent'", scope2)
        ck("…and the spine recorded it, so «did we ever send them one?» is answerable",
           int(n or 0) == 1, str(n))

        # ══ ③ / ④ THE MIDDLE SETTING ═════════════════════════════════════════════════════════════
        print("\n③④ confirm='doubt' — the card follows the doubt, the receipt follows the filing")
        p3 = "+34600" + STAMP + "03"
        await _clear(p3)
        s, a = await _run("doubt", CLEAN, p3)
        ck("nothing doubtful → no card…", not a, str(a))
        ck("…and the receipt goes out", len(s) == 1, str(s)[:80])

        p4 = "+34600" + STAMP + "04"
        await _clear(p4)
        s, a = await _run("doubt", DOUBTED, p4)
        ck("something doubtful → the card IS asked…", len(a) == 1, str(a))
        ck("…and no link on the filing (the tap will do it)", not s, str(s))

        # ══ ⑤ ONCE PER CUSTOMER ══════════════════════════════════════════════════════════════════
        print("\n⑤ once per customer, enforced by the spine")
        s, a = await _run("never", CLEAN, p2)          # p2 already has its link
        ck("a SECOND filed order for the same customer sends no second link", not s, str(s))
        async with db.scoped_tx(scope2) as con:
            n = await con.fetchval("select count(*) from event where scope=$1::ltree "
                                   "and type='portal.link_sent'", scope2)
        ck("…and still exactly one `portal.link_sent` event", int(n or 0) == 1, str(n))

        # ══ ⑥ THE VOCABULARY ═════════════════════════════════════════════════════════════════════
        print("\n⑥ the setting itself")
        for v in ("always", "doubt", "never"):
            await behaviour.set_keys(TEN, confirm=v)
            ck(f"confirm={v} round-trips through behaviour.set_keys/get",
               (await behaviour.get(TEN)).get("confirm") == v)
        refused = False
        try:
            await behaviour.set_keys(TEN, confirm="nonsense")
        except ValueError:
            refused = True
        ck("an unrecognised value is REFUSED loudly at the writer (never silently stored)", refused)
        ck("…and the stored value is untouched by the refusal",
           (await behaviour.get(TEN)).get("confirm") == "never",
           str((await behaviour.get(TEN)).get("confirm")))
    finally:
        (actions.send_whatsapp_as_rocoto, portal.link_for, pipeline.ask_order_confirm,
         pipeline.order_checks, review.hold_for_review, pipeline.ask_doubt_question) = real
        for p in ("01", "02", "03", "04"):
            sc = rt.scope_of("+34600" + STAMP + p)
            try:
                async with db.scoped_tx(sc) as con:
                    await con.execute("delete from event where scope=$1::ltree", sc)
                    await con.execute("delete from scope_node where scope=$1::ltree", sc)
            except Exception:
                pass
        async with db.get_pool().acquire() as con:
            await con.execute("delete from tenants where slug=$1", TEN)

    print(f"\nvital_behaviour_confirm: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
