"""vital_demo_learn.py — A CORRECTION WRITES A REAL MEMORY, AND THE SAME WORDS THEN LAND RIGHT.

THE CLAIM THIS GATES (§17.57, Peter 2026-08-09): «the majority of this stuff is to see how it
captures, but also how it learns from mistakes.» That sentence is the argument that closes a
distributor, and it is a sentence about the DATABASE, not about a toast: the demo says «Guardado en
la memoria» only when a row exists that the matcher will hit on its next run. So this file drives
the loop end to end and asserts the row and the hit, in that order.

  ① THE CUSTOMER'S OWN WORD SURVIVES THE MATCH. `orders_tool.draft_order` keeps `mention` on the
    grounded line. Without it a correction has nothing to learn FROM — an alias is «what they said»
    → «what it is», and «what they said» used to be discarded the instant the matcher picked.
  ② THE CORRECTION IS AN EVENT, AND THE BOARD FOLDS IT. `order.corrected` lands beside the draft
    (append-only: the wrong reading stays, because «it was wrong once» is half the demo), and
    `demo_flow.board` draws the corrected sheet.
  ③ IT WRITES THE RUNTIME'S OWN MEMORY, not a demo-only one: a `sku_aliases` row through
    `brain/learn._write_alias` — the same function `resolve_doubt_tap` and `brain/events.edit_order`
    call — under the NORMALISED mention, against THIS tenant, with the address the next draft will
    match with. Plus the `learned_patterns` habit and the recall `fact` in THIS world's scope.
  ④ THE SECOND PASS IS RIGHT. This is the product claim itself, asserted twice: `matcher.match` of
    the same word now returns the corrected sku with `alias_hit`, and re-running the REAL
    `draft_order` over the same sentence drafts the corrected article.
  ⑤ «Vaciar pedidos y reenviar» EMPTIES THE BOARD AND KEEPS THE MEMORY — that difference is the
    whole of §17.57 ③, so it is a gate and not a detail.
  ⑥ «Reiniciar chat y memoria» TAKES THE MEMORY AND LEAVES THE PRICE LIST, and re-opens the turn
    counter — a reset that cannot be typed into afterwards is the dead end it exists to remove.

THE MIND IS NOT CALLED. Only `orders_tool._extract_mentions` is stubbed — the one step that is an
LLM. Everything below it is the real thing: the real matcher, the real event append, the real
learner, the real alias fast path. A vital that needed a model key would not be in the gate, and a
claim that is not in the gate is a document (`DEMO.md`'s own rule).

SAFETY: refuses the live `rocoto` DB. Point it at a rehearsal clone.
Run on prod as root:  PYTHONPATH=. venv/bin/python tests/vital_demo_learn.py
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

import config  # noqa: E402
import db  # noqa: E402
import demo_flow  # noqa: E402
import orders_tool  # noqa: E402
import tenancy  # noqa: E402
from brain import golive, matcher  # noqa: E402
from brain import learn as brain_learn  # noqa: E402

TEN = "vitaldemolearn"             # ltree label — letters only, no hyphen
R = []

SKUS = [
    {"code": "CH-01", "name": "Chorizo sarta dulce", "family": "embutidos", "unit": "kg", "price": 8.40},
    {"code": "CH-02", "name": "Chorizo sarta picante", "family": "embutidos", "unit": "kg", "price": 8.90},
    {"code": "QM-03", "name": "Queso manchego curado", "family": "quesos", "unit": "ud", "price": 12.00},
]
# THE MESSY MESSAGE. «el sarta del rojo» is the word a customer really uses and the catalogue does
# not contain; the matcher lands it on ONE of the two sartas, and which one is the point of the
# demo — it is a guess a human then corrects.
SAID = "ponme 2 kg del sarta del rojo"
MENTION = "el sarta del rojo"


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_clone() -> None:
    """NEVER against production. This vital WRITES events, aliases and facts."""
    tail = (config.DATABASE_URL or "").rsplit("/", 1)[-1].split("?")[0]
    if tail == "rocoto" or "rehearsal" not in tail:
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


async def _cleanup():
    async with db.get_pool().acquire() as con:
        sids = [r["sid"] for r in await con.fetch(
            "select sid from demo_sessions where tenant_slug=$1", TEN)]
        await con.execute("delete from demo_sessions where tenant_slug=$1", TEN)
        for t in ("sku_aliases", "learned_patterns", "catalogue_skus"):
            try:
                await con.execute(f"delete from {t} where tenant_id=$1", TEN)
            except Exception:
                pass
    for sid in sids:
        scope = tenancy.demo_scope(sid, TEN)
        try:
            async with db.scoped_tx(scope) as con:
                for t in ("timer", "action", "open_loop", "fact", "card", "summary",
                          "sweep_state", "scope_state", "pending_turn", "event", "scope_node"):
                    await con.execute(f"delete from {t} where scope <@ $1::ltree", scope)
        except Exception:
            pass


async def _alias_rows(alias: str) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select alias, sku_id, phone_number, source, weight from sku_aliases "
            "where tenant_id=$1 and alias=$2", TEN, alias)
    return [dict(r) for r in rows]


async def main():
    guard_clone()
    print("VITAL: demo learning loop (§17.57 — a correction teaches, and the resend proves it)")
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB")
    print(f"  (db={dbname})")

    await demo_flow.ensure_demo_schema()
    await _cleanup()
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants(slug,name,status,seeded,country) "
            "values($1,$2,'test',true,'ES') on conflict (slug) do update set status='test'",
            TEN, "Vital — demo learning")
    seeded = await golive.seed_catalogue(TEN, SKUS)
    ck("setup: the vital price list is in", bool(seeded.get("ok")), str(seeded)[:120])

    email = f"vital.learn.{secrets.token_hex(4)}@{TEN}.es"
    sess = await demo_flow.session_for_operator(email, TEN)
    token = sess["token"]
    # THE ROW, not the mint's answer. `session_for_operator` returns {token, sid, authed,
    # catalog_reset} and carries no `tenant_slug`, so `scope_of_row` on it falls back to the legacy
    # anonymous shape (`test.demo.<sid>` → tenant `demo_<sid>`) and everything downstream grounds
    # against an empty world. Cost an hour the first time; `resolve` is the only honest reader.
    row = await demo_flow.resolve(token)
    assert row is not None
    scope = demo_flow.scope_of_row(row)
    ck("setup: the session's scope names THIS tenant",
       tenancy.tenant_of(scope) == TEN, f"{scope} → {tenancy.tenant_of(scope)}")
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set catalog_ready=true where token=$1", token)
    async with db.scoped_tx(scope) as con:
        await con.execute(
            "insert into scope_node(scope,tier,tenant_slug,lineage) "
            "values($1::ltree,'customer',$2,'test') on conflict (scope) do nothing", scope, TEN)

    # THE ONLY STUB: the extraction step, which is the one LLM call on this path.
    real_extract = orders_tool._extract_mentions

    async def _stub(_text):
        return [{"mention": MENTION, "qty": 2, "unit": "kg"}]

    orders_tool._extract_mentions = _stub          # type: ignore[assignment]
    try:
        # ══ ① THE CUSTOMER'S OWN WORD SURVIVES THE MATCH ═════════════════════════════════════════
        print("\n① the grounded line keeps the mention it came from")
        sheet = await orders_tool.draft_order(scope, SAID)
        lines = sheet.get("lines") or []
        ck("the real draft_order grounded the messy word onto a real article",
           len(lines) == 1,
           f"{len(lines)} line(s), unmatched={[u.get('reason') for u in (sheet.get('unmatched') or [])]}")
        if not lines:
            raise SystemExit("cannot continue: nothing was grounded")
        ck("…and the line carries the CUSTOMER'S word, not only our catalogue name",
           lines[0].get("mention") == MENTION, repr(lines[0].get("mention")))
        # ids are minted (`<tenant>:<hash>`), never the supplier's code — so the two sartas are
        # named here the way every other reader names them: by looking them up
        async with db.get_pool().acquire() as con:
            by_code = {r["code"]: r["id"] for r in await con.fetch(
                "select code, id from catalogue_skus where tenant_id=$1", TEN)}
        first_sku = str(lines[0].get("sku") or "")
        # the correction goes to the OTHER sarta, whichever one it guessed
        target = by_code["CH-02"] if first_sku != by_code["CH-02"] else by_code["CH-01"]
        ck("the guess is one of the two sartas (so correcting it is a real correction)",
           first_sku in (by_code["CH-01"], by_code["CH-02"]), first_sku)

        board = await demo_flow.board(token)
        ck("the board shows the drafted order", len(board["orders"]) == 1, str(len(board["orders"])))
        ref = board["orders"][0]["ref"]

        # ══ ② THE CORRECTION IS AN EVENT, AND THE BOARD FOLDS IT ══════════════════════════════════
        print("\n② the correction lands as an event and the board draws it")
        out = await demo_flow.correct_line(token, ref, 0, sku_id=target)
        ck("correct_line answered ok", bool(out.get("ok")), str(out)[:160])
        async with db.scoped_tx(scope) as con:
            n_draft = int(await con.fetchval(
                "select count(*) from event where scope <@ $1::ltree and type='order.drafted'",
                scope) or 0)
            n_fix = int(await con.fetchval(
                "select count(*) from event where scope <@ $1::ltree and type=$2",
                scope, demo_flow.CORRECTED_EVENT) or 0)
        ck("APPEND-ONLY: the wrong reading is still there, with one correction beside it",
           n_draft == 1 and n_fix == 1, f"drafted={n_draft} corrected={n_fix}")
        board = await demo_flow.board(token)
        ck("the board shows ONE order (the correction folds, it does not duplicate)",
           len(board["orders"]) == 1, str(len(board["orders"])))
        ck("…and it shows the CORRECTED article",
           board["orders"][0]["lines"][0].get("sku") == target,
           str(board["orders"][0]["lines"][0].get("sku")))

        # ══ ③ IT WRITES THE RUNTIME'S OWN MEMORY ═════════════════════════════════════════════════
        print("\n③ the memory is the runtime's, not a demo-only one")
        ck("the organ REPORTS that it learned (this is what the screen's tick is gated on)",
           bool(out.get("learned")), str(out.get("learned")))
        norm = matcher.normalize(MENTION)
        rows = await _alias_rows(norm)
        ck("exactly one sku_aliases row, under the NORMALISED customer word",
           len(rows) == 1, f"{len(rows)} row(s) for {norm!r}")
        if rows:
            ck("…pointing at the corrected article", rows[0]["sku_id"] == target, str(rows[0]["sku_id"]))
            ck("…written by brain/learn._write_alias (source='edit', weight=2)",
               rows[0]["source"] == "edit" and int(rows[0]["weight"]) == 2, str(dict(rows[0])))
            party = await demo_flow._party_phone(scope)
            ck("…against the ADDRESS THE NEXT DRAFT WILL MATCH WITH (the write and the read agree)",
               rows[0]["phone_number"] == party,
               f"alias={rows[0]['phone_number']!r} draft={party!r}")
        # AND IT IS THE CUSTOMER'S WORDS, not our annotation of them. Measured on the live drive:
        # once an alias exists the extractor resolves in place and returns
        # «sarta del rojo (chorizo sarta dulce)», so the NEXT correction used to mint an alias with
        # our own catalogue name inside it — filed, real, and never typed by anyone again.
        ck("an alias is never minted with our own catalogue name inside it",
           all("chorizo sarta" not in r["alias"] or r["alias"] == norm for r in rows), norm)
        ck("…and the annotation stripper is narrow enough to leave a customer's own brackets alone",
           brain_learn.customer_words("jamón (el bueno)", "Jamón bellota") == "jamón (el bueno)"
           and brain_learn.customer_words("x (chorizo sarta dulce)", "Chorizo sarta dulce") == "x")
        async with db.get_pool().acquire() as con:
            habits = int(await con.fetchval(
                "select count(*) from learned_patterns where tenant_id=$1 and pattern_type='alias'",
                TEN) or 0)
        ck("the habit half of learn_from_edit ran too", habits >= 1, str(habits))
        async with db.scoped_tx(scope) as con:
            recall = await con.fetchval(
                "select text from fact where scope <@ $1::ltree and kind='RELATION' "
                "order by created_at desc limit 1", scope)
        ck("the RECALL fact is in THIS world's scope (the ficha reads it from here)",
           bool(recall) and MENTION.split()[-1] in str(recall), str(recall)[:110])

        # ══ ④ THE SECOND PASS IS RIGHT ═══════════════════════════════════════════════════════════
        print("\n④ the same words, the second time")
        # the address the DRAFT will present, verbatim — the whole point of `_party_phone` is that
        # there is one reader, so the test must not invent a second spelling either
        res = await matcher.match(MENTION, phone=await demo_flow._party_phone(scope),
                                  unit_hint="kg", qty=2, tenant=TEN)
        d = res.as_dict()
        ck("the matcher's ALIAS FAST PATH fires on the corrected word",
           bool(d.get("alias_hit")), str(d.get("method")))
        ck("…and it returns the article the human chose",
           str((d.get("pick") or {}).get("sku_id") or "") == target,
           str((d.get("pick") or {}).get("sku_id")))
        again = await orders_tool.draft_order(scope, SAID)
        ck("A RESEND OF THE SAME TEXT DRAFTS THE CORRECTED ARTICLE — the product claim",
           len(again.get("lines") or []) == 1
           and str(again["lines"][0].get("sku")) == target,
           str([l.get("sku") for l in (again.get("lines") or [])]))
    finally:
        orders_tool._extract_mentions = real_extract      # type: ignore[assignment]

    # ══ ⑤ «Vaciar pedidos y reenviar» ════════════════════════════════════════════════════════════
    print("\n⑤ clearing the board keeps what was learned")
    cleared = await demo_flow.clear_orders(token)
    board = await demo_flow.board(token)
    ck("the board is empty", len(board["orders"]) == 0, str(cleared))
    ck("…and the memory is still there", len(await _alias_rows(matcher.normalize(MENTION))) == 1)

    # ══ ⑥ «Reiniciar chat y memoria» ═════════════════════════════════════════════════════════════
    print("\n⑥ the reset takes the memory and leaves the price list")
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set turns=99, closed=true where token=$1", token)
    counts = await demo_flow.reset_world(token)
    ck("reset_world ran", counts is not None, str(counts)[:140])
    ck("the learned alias is gone", len(await _alias_rows(matcher.normalize(MENTION))) == 0)
    async with db.get_pool().acquire() as con:
        skus_left = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1", TEN) or 0)
        vocab_left = int(await con.fetchval(
            "select count(*) from sku_aliases where tenant_id=$1 "
            "and source = any($2::text[])", TEN, ["seed", "golive", "create"]) or 0)
        sess_row = await con.fetchrow(
            "select turns, closed from demo_sessions where token=$1", token)
    ck("their price list survives", skus_left == len(SKUS), str(skus_left))
    ck("…and so does the vocabulary the price list itself produced", vocab_left > 0, str(vocab_left))
    # PEDIDOS-PRICING-BUILD.md §6 — Peter, 2026-08-11. This assertion used to read "NO DEAD END: the
    # turn counter re-opens, so they can type again", and it was right while the demo was free and
    # uncapped. It is wrong now: `reset_world` zeroing `turns` made the 30-message cap decorative,
    # because anyone could click «Reiniciar» for an unlimited demo. The reset still clears the world —
    # the learned alias, the events, the board, all checked above — the meter is simply no longer part
    # of what it clears. The way past the wall is Checkout, not the reset button.
    ck("THE METER SURVIVES THE RESET: «Reiniciar» clears the world, it never buys messages",
       sess_row is not None and int(sess_row["turns"]) == 99 and bool(sess_row["closed"]),
       str(dict(sess_row) if sess_row else None))
    async with db.scoped_tx(scope) as con:
        left = int(await con.fetchval(
            "select count(*) from event where scope <@ $1::ltree", scope) or 0)
    ck("the conversation's events are gone", left == 0, f"{left} left")

    await _cleanup()
    print(f"\nvital_demo_learn: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
