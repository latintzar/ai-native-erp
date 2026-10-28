"""vital_confidence.py — TRANSCRIPTION CONFIDENCE GATING + LEARNING LOOP (Peter 2026-07-22).

Proves: (1) confidence.classify separates dirty audio from clean; (2) learn.gate_audio_order routes a
DIRTY-audio order to human REVIEW (never auto-acts) and a CLEAR-but-unmatched order to a LEARNING tab;
(3) learn.reconcile writes a per-tenant learned alias from what the human confirmed.
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import confidence
import db
import learn
import runtime  # noqa: E402

PHONE = "+34999001717"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("action", "timer", "open_loop", "event", "fact", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    clean_utts = [{"confidence": 0.97, "min_word_confidence": 0.88, "low_word_frac": 0.0}]
    dirty_utts = [{"confidence": 0.48, "min_word_confidence": 0.20, "low_word_frac": 0.4}]
    ck("confidence.classify: clean audio → not review", confidence.classify(clean_utts)["review"] is False, str(confidence.classify(clean_utts)["level"]))
    ck("confidence.classify: dirty audio → review", confidence.classify(dirty_utts)["review"] is True, str(confidence.classify(dirty_utts)["level"]))
    ck("confidence.classify: no signal → review (fail-safe)", confidence.classify([])["review"] is True)

    # dirty audio order → a needs_human review action (never auto-acts)
    r1 = await learn.gate_audio_order(PHONE, "quiero no sé qué cosa", confidence.classify(dirty_utts), ["cosa"])
    async with db.control_pool().acquire() as con:
        act = await con.fetchval("select count(*) from action where scope=$1::ltree and kind='order_review' and needs_human and state='pending'", SCOPE)
    ck("DIRTY audio order → parked for human REVIEW", r1["route"] == "review" and act >= 1, f"route={r1['route']} actions={act}")

    # clean but unmatched → a learning tab
    r2 = await learn.gate_audio_order(PHONE, "ponme dos de lo del morro", confidence.classify(clean_utts), ["lo del morro"])
    async with db.control_pool().acquire() as con:
        tab = await con.fetchval("select count(*) from open_loop where scope=$1::ltree and kind='aprender' and status='open'", SCOPE)
    ck("CLEAR-but-unmatched order → a LEARNING tab (reconciles later)", r2["route"] == "learning" and tab >= 1, f"route={r2['route']} tabs={tab}")

    # perception note: dirty → a fold-ready warning BEFORE the mind; clean → empty (no prompt noise)
    n_d = confidence.perception_note(confidence.classify(dirty_utts))
    n_c = confidence.perception_note(confidence.classify(clean_utts))
    ck("perception_note: dirty audio → a pre-reasoning fold warning (ask to repeat, order→review)",
       "PERCEPCIÓN" in n_d and "revisión" in n_d, n_d[:60])
    ck("perception_note: clean audio → empty (no prompt noise)", n_c == "")

    # reconcile: learn the alias from what they confirmed
    await learn.reconcile(PHONE, "lo del morro", "morro de cerdo 5kg")
    async with db.control_pool().acquire() as con:
        learned = await con.fetchval("select count(*) from fact where scope=$1::ltree and kind='RELATION' and text ilike '%se refiere a%' and invalid_at is null", SCOPE)
        evt = await con.fetchval("select count(*) from event where scope=$1::ltree and type='learn.alias'", SCOPE)
    ck("reconcile: learns the alias «said»→«confirmed» from the confirmed order", learned >= 1 and evt >= 1, f"facts={learned} events={evt}")

    await _clean()
    passed = sum(R)
    print(f"\nCONFIDENCE + LEARNING: {passed}/{len(R)} passed — {'DIRTY→REVIEW, SLANG→LEARN' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
