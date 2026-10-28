"""Calibration diagnostic: dense cosine + rerank score per phrase, so the abstain floors
are set on real numbers, not guessed. Run on the box."""
from __future__ import annotations

import asyncio
import json
import os

import config
import db
from brain import matcher, seed

_HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(_HERE, "fixtures", "recall_phrases.json")


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
    if not n:
        await seed.load_catalogue()
    fx = json.load(open(FIXTURES, encoding="utf-8"))

    print(f"{'kind':4} {'dense':>6} {'rerank':>7} {'alias':>5}  phrase -> pick")
    pos_dense, pos_rr, neg_dense, neg_rr = [], [], [], []
    for case in fx["positives"]:
        r = await matcher.match(case["phrase"])
        dn = (r.pick or {}).get("dense", 0.0); rr = r.pick_score
        if not r.alias_hit:
            pos_dense.append(dn); pos_rr.append(rr)
        print(f"POS  {dn:6.3f} {rr:7.3f} {str(r.alias_hit):>5}  {case['phrase']!r} -> {(r.pick or {}).get('name')}")
    for case in fx["negatives"]:
        r = await matcher.match(case["phrase"])
        dn = (r.pick or {}).get("dense", 0.0); rr = r.pick_score
        neg_dense.append(dn); neg_rr.append(rr)
        print(f"NEG  {dn:6.3f} {rr:7.3f} {str(r.alias_hit):>5}  {case['phrase']!r} -> {(r.pick or {}).get('name')}  abstain={r.abstain}")

    def mm(xs): return (min(xs), max(xs)) if xs else (None, None)
    print("\nnon-alias POS dense range", mm(pos_dense), "rerank range", mm(pos_rr))
    print("NEG dense range", mm(neg_dense), "rerank range", mm(neg_rr))


if __name__ == "__main__":
    asyncio.run(run())
