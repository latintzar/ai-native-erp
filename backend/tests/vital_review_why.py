"""vital_review_why.py — THE QUEUE ALWAYS ANSWERS «¿POR QUÉ ESTÁ ESTO DELANTE DE MÍ?» (§5.8 / §5.8a).

`vital_review_rule.py` proves the RULE — three sources, one door, a clock that is a timer. This file
proves the READ: that every row `runtime.review_list` hands the comercial carries EXACTLY ONE reason,
that the reason is the most specific thing anybody knew, and that no writer reaches the sheet without
being named in the rule.

WHAT IT WAS BUILT FOR (found 2026-07-27). Four action kinds were writing `needs_human=true` rows —
`send_outbound` (worker ×3, golive), `wa_delivery_failed` (app ×3), `order_review` (learn.py) and
`voice.aside` (voice_protocol) — and NONE of them was in `review._KIND_SOURCE`. Every read of the
queue logged an ERROR for each such row and answered with the CATEGORY line, so «un WhatsApp no ha
llegado» and «una concesión de precio» read identically: «hace falta tu visto bueno antes de prometer
nada». The rule said the set was closed; the sheet said otherwise.

  Y1  EVERY WRITER IS IN THE RULE      — no live `needs_human` kind falls through to the ERROR branch.
  Y2  ONE REASON, NEVER A LIST         — `why` is a single sentence, and the losing checks stay facts.
  Y3  THE WRITER'S OWN SENTENCE WINS   — stock/range/order-value/doubt reach the sheet VERBATIM.
  Y4  NO ROW IS EVER BLANK OR GENERIC  — a kind with no sentence of its own still names its matter.
  Y5  `why_kind` IS THE CATEGORY       — grouping and explaining are different jobs, two fields.
  Y6  A FOURTH REASON STILL RAISES     — the closed set is not widened by any of the above.

Y1–Y6 pure. The DB half (real rows, read back through `runtime.review_list`) needs a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_review_why.py
Without REHEARSAL_DSN the DB half SKIPS cleanly. SAFETY: refuses the live `rocoto` DB; it writes and
deletes its own invented party's rows and nothing else.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)
try:
    for _l in (Path("/opt/rocoto/.env").read_text().splitlines()
               if Path("/opt/rocoto/.env").exists() else []):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _, _v = _l.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())
except PermissionError:
    pass

import review  # noqa: E402
from brain import (
    pipeline,  # noqa: E402
    validators,  # noqa: E402
)
from brain import range as rng  # noqa: E402
from brain import stock as stock_m  # noqa: E402

R, SKIPPED = [], []
# Invented, never a real company (LOCKED LAW).
PHONE = "+34900000731"
SCOPE = "wa.34900000731"


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


# ── THE FOUR REAL REASONS, produced by the modules that own them (never hand-written here) ────────
STOCK_V = stock_m.verdict(
    [{"sku_id": "sku-paleta", "qty": 12, "unit": "kg"}],
    {"sku-paleta": {"sku_id": "sku-paleta", "name": "PALETA COCIDA", "qty": 4.0, "unit": "kg"}},
    inventory_enabled=True)
RANGE_V = rng.verdict({"set": True, "range_kind": rng.RADIUS, "range_km": 25,
                       "depot_lat": 40.3900, "depot_lon": -3.6300},   # Mercamadrid
                      40.6800, -3.6300)                                # ~32 km north
_PAST = {"lines": [{"sku_id": "sku-paleta", "qty": 10, "unit": "kg", "price": 9.0}]}   # ~90 € each
NORM_V = validators.validate_order(
    [{"sku_id": "sku-paleta", "qty": 200, "unit": "kg", "price": 9.0}], [],   # ~1.800 € — 20×
    {"recent_orders": [dict(_PAST) for _ in range(6)]})
DOUBT_V = {"lines": [{"kind": "unknown", "mention": "manzana rara",
                      "reason": "no hay nada en el catálogo que encaje"}], "ask": []}


def main_pure():
    print("── Y1–Y6 · the read path, pure ──────────────────────────────────────────────────────")

    # ── Y1 · every live writer is in the rule ────────────────────────────────────────────────────
    # The kinds are read off the SOURCE, not a list kept here: a new `insert into action(... 'x' ...)`
    # with needs_human must show up in this check on the day it is written, not the day someone
    # remembers to update a test.
    import re
    back = Path(__file__).resolve().parent.parent
    kinds, offenders = set(), []
    for py in list(back.glob("*.py")) + list((back / "brain").glob("*.py")):
        src = py.read_text(encoding="utf-8")
        for m in re.finditer(r"values\(\$1::ltree,'([a-z_.]+)'", src):
            head = src[max(0, m.start() - 400):m.start()]
            if "insert into action" in head and "needs_human" in head:
                kinds.add(m.group(1))
    for k in sorted(kinds):
        if k not in review._KIND_SOURCE:
            offenders.append(f"{k}")
    ck("Y1 EVERY action kind written to the sheet is named in the rule (no ERROR branch in prod)",
       not offenders, f"unmapped={offenders}" if offenders else f"kinds={sorted(kinds)}")
    ck("Y1 …and each maps to one of the closed three",
       all(review._KIND_SOURCE[k] in review.SOURCES for k in review._KIND_SOURCE),
       str(sorted(set(review._KIND_SOURCE.values()))))

    # ── Y3 · the writer's own sentence survives to the sheet, VERBATIM ───────────────────────────
    park = pipeline.park_decision(doubt_verdict={}, stock_verdict=STOCK_V,
                                  range_verdict={}, order_norm={})
    row = review.annotate({"kind": "review", "payload": {"review_source": park["source"],
                                                         "text": park["reason"]}})
    ck("Y3 STOCK — the shortfall reaches the comercial in stock.py's own words",
       row["why"] == STOCK_V["reason"] and row["review_source"] == review.LOW_STOCK
       and "PALETA COCIDA" in row["why"], row["why"])

    park = pipeline.park_decision(range_verdict=RANGE_V)
    row = review.annotate({"kind": "review", "payload": {"review_source": park["source"],
                                                         "text": park["reason"]}})
    ck("Y3 RANGE — a distance, and only a distance (never a claim about a zone)",
       row["why"] == RANGE_V["reason"] and row["review_source"] == review.FLAG
       and "km" in row["why"] and "zona" not in row["why"].lower(), row["why"])

    park = pipeline.park_decision(order_norm=NORM_V)
    row = review.annotate({"kind": "review", "payload": {"review_source": park["source"],
                                                         "text": park["reason"]}})
    ck("Y3 ORDER VALUE — «muy grande para este cliente», the validator's own sentence",
       row["why"] == NORM_V["reason"] and row["review_source"] == review.FLAG
       and "×" in row["why"], row["why"])

    park = pipeline.park_decision(doubt_verdict=DOUBT_V)
    row = review.annotate({"kind": "review", "payload": {"review_source": park["source"],
                                                         "text": park["reason"]}})
    ck("Y3 DOUBT — the catalogue gap is named as OURS, not as the customer's fault",
       row["why"] == pipeline.park_reason(DOUBT_V) and row["review_source"] == review.FLAG
       and "manzana rara" in row["why"], row["why"])

    # ── Y2 · ONE reason, never a list ────────────────────────────────────────────────────────────
    all_four = pipeline.park_decision(doubt_verdict=DOUBT_V, stock_verdict=STOCK_V,
                                      range_verdict=RANGE_V, order_norm=NORM_V)
    row = review.annotate({"kind": "review", "payload": {"review_source": all_four["source"],
                                                         "text": all_four["reason"]}})
    ck("⚑ Y2 FOUR CHECKS FIRE, ONE SENTENCE ARRIVES — the comercial reads what to decide, not "
       "everything the system noticed",
       row["why"] in (STOCK_V["reason"], RANGE_V["reason"], NORM_V["reason"],
                      pipeline.park_reason(DOUBT_V))
       and "\n" not in row["why"] and row["why"].count("·") == 0,
       f"cause={all_four['cause']} why={row['why'][:60]}")

    # ── Y4 · no row is ever blank, and none of them is the category line any more ────────────────
    generic = set(review.WHY.values())
    blanks, generics = [], []
    for kind in sorted(review._KIND_SOURCE):
        if kind == "review":
            continue          # the one door always carries the writer's own text (asserted above)
        r = review.annotate({"kind": kind, "payload": {}})
        if not (r.get("why") or "").strip():
            blanks.append(kind)
        elif r["why"] in generic:
            generics.append(kind)
    ck("⚑ Y4 A ROW WITH NO SENTENCE OF ITS OWN STILL NAMES ITS MATTER — never blank, never the "
       "name of the drawer it is in",
       not blanks and not generics, f"blank={blanks} generic={generics}")
    ck("Y4 …and those lines are es-ES, boss-facing, one sentence each",
       all("\n" not in v and 10 < len(v) < 90 for v in review.KIND_WHY.values()),
       f"n={len(review.KIND_WHY)}")

    # ── Y5 · explaining and grouping are two fields ──────────────────────────────────────────────
    r = review.annotate({"kind": "wa_delivery_failed", "payload": {}})
    ck("Y5 `why` explains the ROW, `why_kind` names the CATEGORY — one string cannot do both jobs",
       r["why"] == review.KIND_WHY["wa_delivery_failed"]
       and r["why_kind"] == review.WHY[review.FLAG] and r["why"] != r["why_kind"],
       f"why={r['why']!r}")

    # ── Y6 · the set is still closed ─────────────────────────────────────────────────────────────
    unknown = review.annotate({"kind": "algo_nuevo", "payload": {}})
    ck("Y6 an UNCLASSIFIED kind is still reported as FLAG and still logs LOUD (the fourth-reason smell)",
       unknown["review_source"] == review.FLAG
       and unknown["why"] == review.WHY[review.FLAG])
    ck("Y6 exactly three sources, and `is_source` refuses everything else",
       review.SOURCES == ("low_stock", "flag", "timeout")
       and not review.is_source("porque_si") and not review.is_source(None))


async def main_db():
    print("\n── the sheet, read back off REAL rows on the clone ───────────────────────────────────")
    if not _DSN:
        skip("the review sheet round-trip", "no REHEARSAL_DSN")
        return
    import db
    import runtime
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    async def wipe():
        # the RUNTIME role under RLS, not ctrl: `rocoto_ctrl` is a read tier and has no DELETE on
        # `action` — a vital that cleans up through it fails on the clone and would have to be
        # cleaned up by hand on prod.
        async with db.scoped_tx(SCOPE) as con:
            for t in ("action", "event", "scope_node"):
                await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)

    await wipe()
    async with db.scoped_tx(SCOPE) as con:
        await con.execute(
            "insert into scope_node(scope,tier,label,lineage) values($1::ltree,'customer',$2,'live') "
            "on conflict do nothing", SCOPE, "Bar Lumbre (vital)")

    # 1) the four order-brain reasons, through the ONE DOOR, exactly as `_settle_review` parks them
    parks = [pipeline.park_decision(stock_verdict=STOCK_V),
             pipeline.park_decision(range_verdict=RANGE_V),
             pipeline.park_decision(order_norm=NORM_V),
             pipeline.park_decision(doubt_verdict=DOUBT_V)]
    for p in parks:
        await review.hold_for_review(SCOPE, p["source"], text=p["reason"],
                                     detail={"cause": p["cause"]})
    # 2) the machinery writers, in their own shapes — the rows nobody had classified
    async with db.scoped_tx(SCOPE) as con:
        await con.execute(
            "insert into action(scope,kind,payload,state,reason,needs_human,money) "
            "values($1::ltree,'send_outbound',$2,'pending',$3,true,false)",
            SCOPE, {"sentence": "Buenos días — ¿te preparo lo de siempre?", "origin": "timer"},
            "email send failed / no email endpoint for scope")
        await con.execute(
            "insert into action(scope,kind,payload,state,reason,needs_human,money) "
            "values($1::ltree,'wa_delivery_failed',$2,'pending',$3,true,false)",
            SCOPE, {"sid": "SMvital", "error_code": "63112", "to": PHONE},
            "WhatsApp delivery failed (error 63112) — the mouth may be down")
        await con.execute(
            "insert into action(scope,kind,payload,state,reason,needs_human,money) "
            "values($1::ltree,'order_review',$2,'pending',$3,true,true)",
            SCOPE, {"said": "ponme dos de eso", "confidence": {"avg": 0.42}},
            "audio poco fiable — a revisión")
        await con.execute(
            "insert into action(scope,kind,payload,state,reason,needs_human,money) "
            "values($1::ltree,'concession',$2,'pending','money_concession',true,true)",
            SCOPE, {"draft": "te lo dejo a 8,50 el kilo"})

    # the ERROR branch is the fourth-reason smell — a clean read must not trip it once
    errs = []

    class _Catch(logging.Handler):
        def emit(self, rec):
            if rec.levelno >= logging.ERROR:
                errs.append(rec.getMessage())
    _h = _Catch()
    logging.getLogger("rocoto.review").addHandler(_h)
    try:
        items = [i for i in await runtime.review_list(200) if i["scope"] == SCOPE]
    finally:
        logging.getLogger("rocoto.review").removeHandler(_h)

    print(f"\n  {len(items)} rows on the sheet:")
    for i in items:
        print(f"    · {i['kind']:20s} [{i['review_source']:9s}] {i['why']}")
    print()

    ck("all eight writers reached the sheet", len(items) == 8, f"n={len(items)}")
    ck("⚑ EVERY ROW ANSWERS «¿por qué está esto delante de mí?» — one non-empty sentence, always",
       bool(items) and all((i.get("why") or "").strip() for i in items),
       f"blank={[i['kind'] for i in items if not (i.get('why') or '').strip()]}")
    ck("⚑ NO ROW FALLS BACK TO THE CATEGORY LINE — the sheet never answers with the name of a drawer",
       bool(items) and not [i for i in items if i["why"] in set(review.WHY.values())],
       f"generic={[i['kind'] for i in items if i['why'] in set(review.WHY.values())]}")
    ck("every row carries exactly one of the closed three",
       bool(items) and all(i.get("review_source") in review.SOURCES for i in items),
       str(sorted({i["review_source"] for i in items})))
    ck("reading the queue logs NO error — every writer is inside the rule",
       not errs, f"errors={errs[:2]}")
    ck("the four order-brain reasons arrived VERBATIM (stock · range · order value · doubt)",
       {STOCK_V["reason"], RANGE_V["reason"], NORM_V["reason"],
        pipeline.park_reason(DOUBT_V)} <= {i["why"] for i in items},
       f"missing={sorted({STOCK_V['reason'], RANGE_V['reason'], NORM_V['reason'], pipeline.park_reason(DOUBT_V)} - {i['why'] for i in items})}")
    ck("the shortfall is the only LOW_STOCK row; everything else is FLAG (nothing is a timeout here)",
       [i["kind"] for i in items if i["review_source"] == review.LOW_STOCK] == ["review"]
       and review.TIMEOUT not in {i["review_source"] for i in items},
       str(sorted({i["review_source"] for i in items})))
    ck("no row ever carries two reasons (one sentence, no list, no newline)",
       all("\n" not in (i["why"] or "") for i in items))

    await wipe()


def run():
    print(__doc__.splitlines()[0])
    main_pure()
    asyncio.run(main_db())
    ok = sum(1 for r in R if r)
    print(f"\n  {ok}/{len(R)} checks pass" + (f"  ({len(SKIPPED)} skipped)" if SKIPPED else ""))
    sys.exit(0 if ok == len(R) else 1)


if __name__ == "__main__":
    run()
