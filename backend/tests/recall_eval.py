"""Stage-1 grounding gate: recall@k of the matcher against the catalogue.

Runs the FULL matcher (alias -> dense+sparse -> rerank -> gate) on ~50 paraphrase/code-switch/
near-dup phrases + out-of-assortment negatives, and asserts the bar. Run on the box where the
models + DB live:

  cd /opt/sancho/backend && set -a && . /opt/sancho/.env && set +a && venv/bin/python -m tests.recall_eval
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

import config
import db
from brain import matcher, seed

_HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(_HERE, "fixtures", "recall_phrases.json")

# The bar (the #1 risk is retrieval recall: a missed SKU can't be reranked back).
BAR = {"recall@5": 0.95, "recall@1": 0.85, "neg_abstain": 0.80}


def _rank_of(res: matcher.MatchResult, sku_id: str) -> int:
    for i, c in enumerate(res.candidates, start=1):
        if c.get("sku_id") == sku_id or c.get("id") == sku_id:
            return i
    return 10**6


async def run() -> int:
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
    if not n:
        print("catalogue empty -> loading seed catalogue")
        print("loaded:", await seed.load_catalogue())

    with open(FIXTURES, encoding="utf-8") as f:
        fx = json.load(f)
    pos, neg = fx["positives"], fx["negatives"]

    r1 = r3 = r5 = 0
    mrr = 0.0
    misses, misranked = [], []
    bands = {"clean": 0, "note": 0, "unsure": 0}
    for case in pos:
        res = await matcher.match(case["phrase"])
        rk = _rank_of(res, case["sku"])
        bands[res.band] = bands.get(res.band, 0) + 1
        if rk <= 1: r1 += 1
        if rk <= 3: r3 += 1
        if rk <= 5: r5 += 1
        if rk < 10**6: mrr += 1.0 / rk
        if rk > 5:
            misses.append((case["phrase"], case["sku"], rk,
                           res.pick.get("name") if res.pick else None, round(res.pick_score, 3)))
        elif rk > 1:
            misranked.append((case["phrase"], case["sku"], rk,
                              res.pick.get("name") if res.pick else None, res.band))

    neg_ok = 0
    neg_fail = []
    for case in neg:
        res = await matcher.match(case["phrase"])
        ok = res.abstain or res.pick is None  # negatives must NOT fill clean — flag as unsure
        if ok:
            neg_ok += 1
        else:
            neg_fail.append((case["phrase"], res.pick.get("name") if res.pick else None,
                             round(res.pick_score, 3), res.band))

    np_, nn = len(pos), len(neg)
    score = {
        "recall@1": r1 / np_, "recall@3": r3 / np_, "recall@5": r5 / np_,
        "mrr": mrr / np_, "neg_abstain": neg_ok / nn,
    }

    print("\n===== Stage-1 recall scorecard =====")
    print(f"positives={np_}  negatives={nn}")
    for k, v in score.items():
        print(f"  {k:12s} {v:.3f}")
    print(f"  positive bands: {bands}  (unsure = filled-best + flagged; learns to clean on confirm)")
    if misranked:
        print("\n-- correct SKU not at rank 1 (still in top-5) --")
        for ph, want, rk, got, bd in misranked:
            print(f"  '{ph}' want={want} rank={rk} got={got} band={bd}")
    if misses:
        print("\n-- recall MISSES (correct SKU not in top-5) --")
        for ph, want, rk, got, sc in misses:
            print(f"  '{ph}' want={want} rank={rk} got={got} score={sc}")
    if neg_fail:
        print("\n-- negatives that filled CLEAN (silent-wrong risk) --")
        for ph, got, sc, bd in neg_fail:
            print(f"  '{ph}' got={got} score={sc} band={bd}")

    passed = all(score[k] >= BAR[k] for k in BAR)
    print("\nBAR:", BAR)
    print("RESULT:", "PASS ✅" if passed else "FAIL ❌")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
