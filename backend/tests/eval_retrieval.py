"""eval_retrieval.py — THE ENCODER MEASUREMENT (PRODUCT-SPEC §5.7a's binding order of work).

§5.7a: "swap the encoder → re-embed → measure recall@k and the margin distribution on real
mentions → only then set the doubt bands. Thresholds chosen before that are guesses dressed as
calibration." This file is the *measure* step, kept in the repo so the same numbers can be produced
again by anyone, on demand, instead of living in a chat log.

WHAT IT MEASURES, and why each number is here:
  * recall@1 / recall@5 through the FULL matcher (alias ∪ dense ∪ sparse → rerank) — the number the
    product actually experiences.
  * DENSE-ONLY recall@1/@5 — the encoder's own contribution, isolated by calling the exact dense
    stage `matcher.dense_search()` that `match()` calls. This is where an encoder swap can win or
    lose; the full-matcher number is diluted by the alias fast-path and the FTS floor.
  * the top1−top2 MARGIN distribution on the rerank score — the signal `doubt.py` gates on.
  * THE VERDICT-KIND COUNT: every case run through the real `doubt.classify_line()`, so the
    deliverable is "how many mentions changed doubt KIND (resolved↔ambiguous↔thin↔unknown)".
    A swap that improves cosine and changes no verdict has bought the product nothing.

THE LABELLED SET is not invented here — it is read from the artefacts that already document their
own planted cases, so it cannot drift away from the seed:
  * tests/fixtures/recall_phrases.json — 65 positives (paraphrase / code-switch / near-dup) + 8
    out-of-catalogue negatives.
  * seed/catalogue.json — `_dimension_pairs` (14, must stay DIMENSIONLESS), `_near_duplicates`
    (two_candidate=true ⇒ a real two-way choice; false ⇒ ties wider than two rows ⇒ UNKNOWN by
    §5.7a's 3-button law, NOT ambiguous), `_learnable_mentions` (4), `_gaps` (5, must ground to
    nothing).
  * tests/fixtures/golden_cases.json — pipeline-level (they need the LLM extractor, a standing
    basket and a DB write, and `tests/test_golden.py` owns them). What is measurable HERE without a
    model is the MENTION each case turns on, so those mentions are listed in `GOLDEN_DERIVED` with
    the case they come from written next to them. Derived, and labelled as derived — not silently
    passed off as the golden fixture itself.

READ-ONLY except for the explicit `reembed` subcommand, which refuses any database whose name is
not the `_rehearsal` clone (§ the standing law: never write the live `rocoto` catalogue).

    set -a && . /opt/rocoto/.env && set +a
    export EVAL_DSN="$(echo "$DATABASE_URL" | sed 's|/rocoto$|/rocoto_rehearsal|')"
    python -m tests.eval_retrieval snapshot --tag bge-large --out /tmp/before.json
    python -m tests.eval_retrieval reembed              # after flipping BRAIN_EMBED_MODEL
    python -m tests.eval_retrieval snapshot --tag bge-m3 --out /tmp/after.json
    python -m tests.eval_retrieval compare /tmp/before.json /tmp/after.json
"""
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import statistics
import sys
from typing import Any, Dict, List, Optional

import asyncpg

import config
import db
import doubt
from brain import matcher

# ── RUNNING IT ON A LOADED BOX (added 2026-07-27) ────────────────────────────────────────────────
# The encoder (bge-m3, ~1.5 GB resident) and the cross-encoder (~1.2 GB) are both live for every
# case, and the peak is ~2.8 GB. On a shared box that is enough for earlyoom to take the process at
# case 40 and leave no snapshot at all. `EVAL_QVEC_CACHE=<path>` memoises QUERY vectors to disk, so
# the run can be done in two passes that each hold ONE model:
#     warm      -> loads only the encoder, fills the cache
#     snapshot  -> loads only the cross-encoder, reads the cache
# The cache stores the model name and is IGNORED WHOLESALE if it does not match the loaded model, so
# it can never silently serve vectors from a different encoder — the exact failure `verify` exists to
# catch. Vectors are the model's own output, bit for bit; the measurement is unchanged.
_QCACHE: Dict[str, List[float]] = {}
_QCACHE_PATH: Optional[str] = None
_QCACHE_DIRTY = False


def _qcache_install() -> None:
    global _QCACHE, _QCACHE_PATH, _QCACHE_DIRTY
    _QCACHE_PATH = os.environ.get("EVAL_QVEC_CACHE") or None
    if not _QCACHE_PATH:
        return
    from brain import embed
    if os.path.exists(_QCACHE_PATH):
        with open(_QCACHE_PATH, encoding="utf-8") as f:
            blob = json.load(f)
        if blob.get("model") == config.BRAIN_EMBED_MODEL:
            _QCACHE = blob.get("vectors") or {}
        else:
            print(f"qvec cache ignored: built with {blob.get('model')!r}, "
                  f"loaded model is {config.BRAIN_EMBED_MODEL!r}", file=sys.stderr)
    _real = embed.aembed_query

    async def _cached(text: str):
        global _QCACHE_DIRTY
        v = _QCACHE.get(text)
        if v is None:
            v = await _real(text)
            _QCACHE[text] = v
            _QCACHE_DIRTY = True
            # Flush as we go. The reason this run needs a cache at all is that the box may kill it;
            # a cache only written at exit is exactly the thing that does not survive being killed.
            if len(_QCACHE) % 20 == 0:
                _qcache_flush()
        return v

    embed.aembed_query = _cached


def _qcache_flush() -> None:
    global _QCACHE_DIRTY
    if _QCACHE_PATH and _QCACHE_DIRTY:
        tmp = _QCACHE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"model": config.BRAIN_EMBED_MODEL, "vectors": _QCACHE}, f)
        os.replace(tmp, _QCACHE_PATH)      # atomic: a kill mid-write must not corrupt the cache
        _QCACHE_DIRTY = False
        print(f"qvec cache: {len(_QCACHE)} vectors -> {_QCACHE_PATH}", file=sys.stderr)

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
RECALL_FIXTURE = os.path.join(_HERE, "fixtures", "recall_phrases.json")
CATALOGUE = os.path.join(_BACKEND, "seed", "catalogue.json")

# ── the mentions the golden cases turn on ────────────────────────────────────────────────────────
# Derived by hand from tests/fixtures/golden_cases.json: the literal product mention an extractor
# emits for that message, with the case it came from. Cases that resolve through a STANDING BASKET
# or a prior order ("lo de siempre", "lo mismo que el jueves") are deliberately absent — no encoder
# is involved in those, the reference resolver is, and inventing a mention for them would measure
# nothing. `kind` is the doubt kind the golden case asserts; `sku` the row it asserts.
GOLDEN_DERIVED: List[Dict[str, Any]] = [
    {"phrase": "chorizo fresco", "qty": 8, "unit": "kg", "sku": "sku-chorizo-fresco",
     "case": "implicit/mándame el chorizo fresco y el tocino", "expect_kind": None},
    {"phrase": "tocino", "sku": "sku-tocino-iberico",
     "case": "implicit/mándame el chorizo fresco y el tocino"},
    {"phrase": "secreto", "sku": "sku-secreto-iberico",
     "case": "implicit/mándame el secreto"},
    {"phrase": "oreja", "qty": 8, "unit": "kg", "expect_kind": doubt.AMBIGUOUS,
     "case": "implicit/8 kg de oreja para mañana"},
    {"phrase": "langostinos cocidos", "expect_kind": doubt.UNKNOWN,
     "case": "grounding/¿me puedes mandar 5 kg de langostinos cocidos?"},
    {"phrase": "callos ya limpios", "qty": 10, "unit": "kg", "sku": "sku-callos-ternera",
     "case": "grounding/10 kilos de los callos esos ya limpios"},
    {"phrase": "bacon en lonchas", "qty": 8, "unit": "pack", "sku": "sku-bacon-lon",
     "case": "grounding/8 packs de bacon en lonchas"},
    {"phrase": "panceta adobada", "qty": 10, "sku": "sku-panceta-adobada-pieza",
     "case": "discourse/10 de panceta adobada y 6 de lomo adobado"},
    {"phrase": "lomo adobado", "qty": 8, "sku": "sku-lomo-adobado",
     "case": "discourse/…el lomo ponme 8 mejor"},
    {"phrase": "salchichón del 55", "qty": 8, "unit": "kg", "sku": "sku-salchichon-vela-55",
     "case": "change/ponme 6 kilos de salchichón del 55… no, que sean 8"},
    {"phrase": "oreja cocida", "qty": 6, "sku": "sku-oreja-cocida",
     "case": "change/6 de oreja cocida, 40 manitas y 5 de morro"},
    {"phrase": "manitas", "qty": 40, "sku": "sku-manita-cerdo",
     "case": "change/…40 manitas…"},
    {"phrase": "morro", "qty": 5, "sku": "sku-morro-cerdo",
     "case": "change/…5 de morro"},
    {"phrase": "sartas", "qty": 20, "expect_kind": doubt.DIMENSIONLESS,
     "case": "doubt/ponme 20 sartas"},
    {"phrase": "lomo", "expect_kind": doubt.UNKNOWN,
     "case": "doubt/mándame el lomo (ties wider than two rows ⇒ UNKNOWN, §5.7a)"},
    {"phrase": "anchoas del cantábrico", "expect_kind": doubt.UNKNOWN,
     "case": "doubt/40 sobres de serrano y unas anchoas del cantábrico"},
    {"phrase": "el jamoncito", "qty": 3, "unit": "kg", "sku": "sku-jamon-cocido-pieza",
     "case": "doubt/ponme también el jamoncito, 3 kg (alias already learned ⇒ no_doubt)"},
    {"phrase": "morcilla de burgos", "qty": 12, "unit": "kg", "sku": "sku-morcilla-burgos",
     "case": "doubt/y ponme 12 kilos de morcilla de burgos"},
    {"phrase": "velas", "qty": 2, "expect_kind": doubt.AMBIGUOUS,
     "case": "doubt/…y un par de velas"},
    {"phrase": "sobres de serrano", "qty": 40, "sku": "sku-jamon-serrano-lon",
     "case": "discourse/40 sobres de serrano y otros tantos de cular"},
]

# The regression §5.7a's build note is about, kept as its own set so it can never be lost in an
# average: the seed intends this line UNAMBIGUOUS and the run of 2026-07-27 returned AMBIGUOUS
# (CHORIZO CRIOLLO PARRILLA 0.866 vs CHORIZO FRESCO SARTA 0.863).
REGRESSIONS: List[Dict[str, Any]] = [
    {"phrase": "8 kg de chorizo fresco", "qty": 8, "unit": "kg", "sku": "sku-chorizo-fresco",
     "expect_kind": None, "case": "§5.7a build note — must resolve, not ask"},
    {"phrase": "chorizo fresco", "qty": 8, "unit": "kg", "sku": "sku-chorizo-fresco",
     "expect_kind": None, "case": "§5.7a build note — the mention the extractor emits"},
]


def _load_cases() -> List[Dict[str, Any]]:
    """Build the labelled set from the artefacts that document their own planted cases."""
    cases: List[Dict[str, Any]] = []
    with open(RECALL_FIXTURE, encoding="utf-8") as f:
        fx = json.load(f)
    for c in fx["positives"]:
        cases.append({"set": "recall_pos", "phrase": c["phrase"], "sku": c["sku"]})
    for c in fx["negatives"]:
        cases.append({"set": "recall_neg", "phrase": c["phrase"], "expect_kind": doubt.UNKNOWN})

    with open(CATALOGUE, encoding="utf-8") as f:
        cat = json.load(f)
    for m in cat["_gaps"]["mentions"]:
        cases.append({"set": "gaps", "phrase": m, "expect_kind": doubt.UNKNOWN})
    for p in cat["_near_duplicates"]["pairs"]:
        # two_candidate=false ⇒ the mention ties across MORE than two rows, and §5.7a's 3-button law
        # makes that UNKNOWN (comercial), not a three-way question to the customer.
        cases.append({"set": "near_dup", "phrase": p["say"],
                      "expect_kind": doubt.AMBIGUOUS if p["two_candidate"] else doubt.UNKNOWN,
                      "pair": [p["a"], p["b"]], "two_candidate": p["two_candidate"]})
    for m in cat["_learnable_mentions"]["mentions"]:
        cases.append({"set": "learnable", "phrase": m["say"], "sku": m["true_sku"],
                      "expect_kind": m["kind"], "against": m["against"]})
    for c in GOLDEN_DERIVED:
        cases.append({"set": "golden_derived", **c})
    for c in REGRESSIONS:
        cases.append({"set": "regression", **c})
    return cases


def _rank_of(cands: List[Dict[str, Any]], sku_id: str) -> int:
    for i, c in enumerate(cands, start=1):
        if c.get("sku_id") == sku_id or c.get("id") == sku_id:
            return i
    return 10 ** 6


def _prod_query(phrase: str) -> str:
    """The exact text `matcher.match()` hands the encoder — FOLLOWED, not copied, so the dense arm
    can never drift from production. `item_form` (calibre-preserving) replaced `strip_qty` on
    2026-07-27; the getattr keeps this harness able to snapshot an older matcher for a before/after,
    and a pair that spans that change is comparing two different query texts — which is the change."""
    form = getattr(matcher, "item_form", None) or matcher.strip_qty
    return form(phrase) or matcher.normalize(phrase) or phrase


async def _dense_only(con, phrase: str, k: int = 10) -> List[Dict[str, Any]]:
    """The encoder's own recall, isolated: the SAME dense stage `matcher.match()` runs, with no
    alias fast-path, no FTS union and no reranker on top. This is the number an encoder swap moves
    directly; the full-matcher number is diluted by the other two rails."""
    from brain import embed
    qvec = await embed.aembed_query(_prod_query(phrase))
    rows = await matcher.dense_search(con, qvec, config.BRAIN_TENANT, k)
    return [{"sku_id": r["id"], "name": r["name"], "score": float(r["score"])} for r in rows]


async def _run_case(con, case: Dict[str, Any]) -> Dict[str, Any]:
    res = await matcher.match(case["phrase"], unit_hint=case.get("unit"), qty=case.get("qty"))
    md = res.as_dict()
    line = {"mention": case["phrase"], "qty": case.get("qty"), "unit": case.get("unit"),
            "price": (res.pick or {}).get("price"), "match": md}
    verdict = doubt.classify_line(line)
    dense = await _dense_only(con, case["phrase"])

    sku = case.get("sku")
    out = {
        "set": case["set"], "phrase": case["phrase"], "sku": sku,
        "expect_kind": case.get("expect_kind", "__unset__") if "expect_kind" in case else "__unset__",
        "case": case.get("case"),
        "band": res.band, "tight": res.tight, "alias_hit": res.alias_hit, "method": res.method,
        "n_close": getattr(res, "n_close", None), "dims": getattr(res, "dims", []),
        "dim_note": getattr(res, "dim_note", ""), "query": _prod_query(case["phrase"]),
        "pick": (res.pick or {}).get("sku_id"), "pick_name": (res.pick or {}).get("name"),
        "pick_score": round(res.pick_score, 4), "margin": round(res.margin, 4),
        "dense_of_pick": round((res.pick or {}).get("dense", 0.0), 4),
        "runner_up": (res.runner_up or {}).get("name"),
        "runner_score": round((res.runner_up or {}).get("score", 0.0), 4) if res.runner_up else None,
        "n_cands": len(res.candidates),
        "kind": verdict["kind"] or "resolved",
        "direction": verdict["direction"],
        "top5": [c.get("name") for c in res.candidates[:5]],
        "dense_top5": [d["name"] for d in dense[:5]],
        "dense_top1_score": round(dense[0]["score"], 4) if dense else None,
    }
    if sku:
        out["rank"] = _rank_of(res.candidates, sku)
        out["dense_rank"] = _rank_of(dense, sku)
        out["correct1"] = out["rank"] <= 1
        out["correct5"] = out["rank"] <= 5
    return out


# ── THE SANITY GATE (added 2026-07-27, after it bit twice) ───────────────────────────────────────
# A snapshot silently produced NOISE — dense@1 88% -> 1%, every rerank score near zero — on code and
# data that were both provably fine when probed by hand a minute later. The signature is an ONNX
# session that came up without its external-weights blob: the graph loads, the shapes are right, and
# every number is meaningless. `brain/embed.py` names exactly this class of failure ("silently bad
# rather than loudly broken") and guards the DIMENSION; nothing guarded the VALUES, so the harness
# wrote a 110-case snapshot of noise and the compare table read it as a catastrophic regression.
#
# So before a single case runs, both stages are asked a question whose answer is not in doubt. Two
# inferences, and "the harness wrote a file" stops being evidence that it measured anything.
_PROBE_Q = "salchichon vela 55"
_PROBE_DOCS = ["SALCHICHON VELA 40 MM. embutido curado.", "SALCHICHON VELA 55 MM. embutido curado."]


async def _sanity(con) -> Optional[str]:
    """None = both stages are sane. A string = what is wrong; the caller must NOT write a snapshot."""
    from brain import embed, rerank
    if rerank._get() is None:
        return "the cross-encoder did not load — every score would silently be the fused dense prelim"
    sc = rerank.rerank(_PROBE_Q, _PROBE_DOCS)
    if not sc or len(sc) != 2 or sc[1] <= sc[0]:
        return (f"cross-encoder puts the query closer to the 40 MM row than to the 55 MM row "
                f"({sc}) — it loaded without its weights")
    qv = await embed.aembed_query(_PROBE_Q)
    top = await con.fetchrow(
        """select name, 1 - (embedding <=> $1) as s from catalogue_skus
             where tenant_id=$2 and embedding is not null order by embedding <=> $1 limit 1""",
        qv, config.BRAIN_TENANT)
    if not top or float(top["s"]) < 0.30:
        return (f"nearest neighbour of the probe query is {top and top['name']!r} at "
                f"{top and round(float(top['s']), 4)} — the query vectors and the stored vectors did "
                f"not come from the same encoder")
    return None


async def _dimension_pairs(con) -> List[Dict[str, Any]]:
    """§5.7a / the seed's own `_dimension_pairs`: the 14 planted pairs must classify DIMENSIONLESS.
    Verified by calling the REAL `doubt._same_product` on the REAL catalogue rows (never a copy of
    its logic), exactly as tests/vital_seedworld.py does."""
    with open(CATALOGUE, encoding="utf-8") as f:
        cat = json.load(f)
    out = []
    for a, b in cat["_dimension_pairs"]["pairs"]:
        ra = await con.fetchrow("select id, name from catalogue_skus where id=$1", a)
        rb = await con.fetchrow("select id, name from catalogue_skus where id=$1", b)
        ok = bool(ra and rb) and doubt._same_product(dict(ra), dict(rb))
        out.append({"a": a, "b": b, "same_product": ok,
                    "names": [ra["name"] if ra else None, rb["name"] if rb else None]})
    return out


def _pct(xs: List[float], p: float) -> Optional[float]:
    if not xs:
        return None
    xs = sorted(xs)
    i = min(len(xs) - 1, max(0, int(round(p * (len(xs) - 1)))))
    return round(xs[i], 4)


def _summarise(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    labelled = [r for r in rows if r.get("sku")]
    non_alias = [r for r in labelled if not r["alias_hit"]]
    margins = [r["margin"] for r in rows if not r["alias_hit"] and r["n_cands"] > 1]

    def rate(sub, key):
        return round(sum(1 for r in sub if r.get(key)) / len(sub), 4) if sub else None

    kinds: Dict[str, int] = {}
    for r in rows:
        kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
    bands: Dict[str, int] = {}
    for r in rows:
        bands[r["band"]] = bands.get(r["band"], 0) + 1

    dense_lab = [r for r in labelled if r.get("dense_rank") is not None]
    return {
        "n_cases": len(rows),
        "n_labelled": len(labelled),
        "recall@1": rate(labelled, "correct1"),
        "recall@5": rate(labelled, "correct5"),
        "recall@1_non_alias": rate(non_alias, "correct1"),
        "recall@5_non_alias": rate(non_alias, "correct5"),
        "dense_recall@1": round(sum(1 for r in dense_lab if r["dense_rank"] <= 1) / len(dense_lab), 4) if dense_lab else None,
        "dense_recall@5": round(sum(1 for r in dense_lab if r["dense_rank"] <= 5) / len(dense_lab), 4) if dense_lab else None,
        "alias_hits": sum(1 for r in rows if r["alias_hit"]),
        "margin": {"n": len(margins), "min": _pct(margins, 0.0), "p10": _pct(margins, 0.10),
                   "p25": _pct(margins, 0.25), "median": _pct(margins, 0.5),
                   "p75": _pct(margins, 0.75), "max": _pct(margins, 1.0),
                   "mean": round(statistics.fmean(margins), 4) if margins else None,
                   "tight_lt_%.2f" % matcher.MARGIN_TIGHT: sum(1 for m in margins if m < matcher.MARGIN_TIGHT)},
        "bands": bands,
        "kinds": kinds,
    }


# ── SWEEP: N versions of the two modules, ONE process, ONE model load ────────────────────────────
# `snapshot` measures whatever is on disk. That is the right shape for an ENCODER swap (the thing it
# was written for — you flip an env var and re-run), and the wrong shape for a CODE change: proving
# a matcher/doubt fix needs the OLD code and the NEW code measured against the same catalogue, and
# on this box the honest way to do that is not four processes.
#
# Two reasons it is one process and not a loop over `snapshot`:
#   * COST — the encoder (~1.5 GB) and the cross-encoder (~1.2 GB) load per process. Four snapshots
#     is four loads on a 2-core box that is also serving production.
#   * FAIRNESS — same pool, same warm models, same catalogue rows, same order. A before/after where
#     the two halves ran hours apart against a catalogue somebody re-embedded in between is not a
#     measurement, and nothing in the artefact would say so.
#
# A variant is `tag=<matcher path>,<doubt path>`; an EMPTY path means the working tree's own module,
# so `after=,` is always the current code and needs no copy of it lying around. The modules are
# loaded under private names, so the tree's `matcher`/`doubt` stay importable and unshadowed for
# everything else in the process (`db`, `config` and the two model singletons are deliberately
# SHARED — that is the point).
def _load_variant_module(name: str, path: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if not spec or not spec.loader:
        raise SystemExit(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _sweep_query_texts(cases: List[Dict[str, Any]], variants: List[str],
                       tree_matcher) -> List[str]:
    """Every distinct text the encoder will be asked for, across every variant. Derived from
    `_prod_query` — the same function the run uses — so the warm pass cannot fill the cache with
    something the measurement will then miss."""
    texts: List[str] = []
    g = globals()
    keep = g["matcher"]
    try:
        for spec in variants:
            tag, _, paths = spec.partition("=")
            mpath = paths.partition(",")[0]
            g["matcher"] = _load_variant_module(f"_w_matcher_{tag}", mpath) if mpath.strip() else tree_matcher
            for c in cases:
                t = _prod_query(c["phrase"])
                if t not in texts:
                    texts.append(t)
    finally:
        g["matcher"] = keep
    return texts


async def cmd_sweep(args) -> int:
    _qcache_install()
    dsn = os.environ.get("EVAL_DSN") or config.DATABASE_URL
    db._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=4, init=db._init_conn)
    cases = _load_cases()
    os.makedirs(args.outdir, exist_ok=True)
    tree_matcher, tree_doubt = matcher, doubt

    # ONE MODEL RESIDENT AT A TIME. Peak is the sum of the two (encoder ~1.5 GB + cross-encoder
    # ~1.2 GB) only because both are alive at once, and on a box that is also running production
    # that sum is the difference between a measurement and an OOM. So: embed EVERY query text first
    # (the encoder is the only model needed for that), flush the cache, drop the encoder, and let
    # the measurement load the cross-encoder into the space it just freed. Same numbers — the
    # vectors are the model's own output, cached bit for bit — at roughly half the peak.
    if args.two_pass:
        if not os.environ.get("EVAL_QVEC_CACHE"):
            print("--two-pass needs EVAL_QVEC_CACHE=<path>", file=sys.stderr)
            return 2
        from brain import embed
        # `_PROBE_Q` rides along: the sanity gate runs AFTER the encoder is dropped, so leaving its
        # text uncached would force a reload of a 1.5 GB model next to the freshly-loaded 1.2 GB
        # cross-encoder — which is the very memory-pressure load that produces silently bad vectors.
        # Warming it here also means the gate tests the SAME encoder instance every case used.
        texts = _sweep_query_texts(cases, args.variant, tree_matcher) + [_PROBE_Q]
        todo = [t for t in texts if t not in _QCACHE]
        print(f"warm: {len(todo)} of {len(texts)} query texts not cached", file=sys.stderr)
        for i, t in enumerate(todo):
            await embed.aembed_query(t)
            if args.verbose and (i + 1) % 25 == 0:
                print(f"  warm {i + 1}/{len(todo)}", file=sys.stderr)
        _qcache_flush()
        embed._model = None          # noqa: SLF001 — deliberate, and the whole point of the pass
        embed._dim = None            # noqa: SLF001
        import gc
        gc.collect()
        print("warm done; encoder dropped", file=sys.stderr)

    written: List[str] = []
    for spec in args.variant:
        tag, _, paths = spec.partition("=")
        mpath, _, dpath = paths.partition(",")
        g = globals()
        g["matcher"] = _load_variant_module(f"_v_matcher_{tag}", mpath) if mpath.strip() else tree_matcher
        g["doubt"] = _load_variant_module(f"_v_doubt_{tag}", dpath) if dpath.strip() else tree_doubt
        rows: List[Dict[str, Any]] = []
        async with db._pool.acquire() as con:
            n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
            emb = await con.fetchval("select count(embedding) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
            dim = await con.fetchval(
                "select vector_dims(embedding) from catalogue_skus where tenant_id=$1 and embedding is not null limit 1",
                config.BRAIN_TENANT)
            bad = await _sanity(con)
            if bad:
                print(f"REFUSING TO MEASURE: {bad}", file=sys.stderr)
                return 4
            pairs = await _dimension_pairs(con)
            for i, c in enumerate(cases):
                rows.append(await _run_case(con, c))
                if args.verbose and (i + 1) % 10 == 0:
                    print(f"  [{tag}] {i + 1}/{len(cases)}", file=sys.stderr)
        out = os.path.join(args.outdir, f"{tag}.json")
        snap = {
            "tag": tag,
            "variant": {"matcher": mpath or "<tree>", "doubt": dpath or "<tree>"},
            "embed_model": config.BRAIN_EMBED_MODEL,
            "rerank_model": config.BRAIN_RERANK_MODEL,
            "dsn_db": dsn.rsplit("/", 1)[-1],
            "catalogue_rows": n, "embedded_rows": emb, "vector_dims": dim,
            "thresholds": {"RERANK_CLEAR": g["matcher"].RERANK_CLEAR,
                           "RERANK_UNSURE": g["matcher"].RERANK_UNSURE,
                           "MARGIN_TIGHT": g["matcher"].MARGIN_TIGHT},
            "summary": _summarise(rows),
            "by_set": {s: _summarise([r for r in rows if r["set"] == s])
                       for s in sorted({r["set"] for r in rows})},
            "dimension_pairs": pairs,
            "rows": rows,
        }
        with open(out, "w", encoding="utf-8") as f:
            json.dump(snap, f, ensure_ascii=False, indent=1)
        written.append(out)
        print(f"[{tag}] recall@1={snap['summary']['recall@1']} recall@5={snap['summary']['recall@5']} "
              f"kinds={json.dumps(snap['summary']['kinds'], ensure_ascii=False)} -> {out}")
        _qcache_flush()
    globals()["matcher"], globals()["doubt"] = tree_matcher, tree_doubt
    print("\n".join(written))
    return 0


async def cmd_warm(args) -> int:
    """Fill the query-vector cache and NOTHING else. NOT a measurement — the cross-encoder is
    deliberately switched off (so it is never loaded), which means the bands and verdicts this pass
    would produce are meaningless and are therefore thrown away. Its only output is the cache."""
    if not os.environ.get("EVAL_QVEC_CACHE"):
        print("warm needs EVAL_QVEC_CACHE=<path>", file=sys.stderr)
        return 2
    from brain import rerank
    rerank._failed = True          # never load the cross-encoder in this pass
    _qcache_install()
    dsn = os.environ.get("EVAL_DSN") or config.DATABASE_URL
    db._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=4, init=db._init_conn)
    cases = _load_cases()
    async with db._pool.acquire() as con:
        for i, c in enumerate(cases):
            await _run_case(con, c)
            if args.verbose:
                print(f"  warm {i + 1}/{len(cases)}", file=sys.stderr)
    _qcache_flush()
    return 0


async def cmd_snapshot(args) -> int:
    _qcache_install()
    dsn = os.environ.get("EVAL_DSN") or config.DATABASE_URL
    db._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=4, init=db._init_conn)
    cases = _load_cases()
    rows: List[Dict[str, Any]] = []
    async with db._pool.acquire() as con:
        n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
        emb = await con.fetchval("select count(embedding) from catalogue_skus where tenant_id=$1", config.BRAIN_TENANT)
        dim = await con.fetchval(
            "select vector_dims(embedding) from catalogue_skus where tenant_id=$1 and embedding is not null limit 1",
            config.BRAIN_TENANT)
        bad = await _sanity(con)
        if bad:
            print(f"REFUSING TO MEASURE: {bad}", file=sys.stderr)
            return 4
        pairs = await _dimension_pairs(con)
        for i, c in enumerate(cases):
            rows.append(await _run_case(con, c))
            if args.verbose:
                print(f"  {i + 1}/{len(cases)} {c['phrase'][:40]!r}", file=sys.stderr)
    snap = {
        "tag": args.tag,
        "embed_model": config.BRAIN_EMBED_MODEL,
        "rerank_model": config.BRAIN_RERANK_MODEL,
        "dsn_db": dsn.rsplit("/", 1)[-1],
        "catalogue_rows": n, "embedded_rows": emb, "vector_dims": dim,
        "thresholds": {"RERANK_CLEAR": matcher.RERANK_CLEAR, "RERANK_UNSURE": matcher.RERANK_UNSURE,
                       "MARGIN_TIGHT": matcher.MARGIN_TIGHT},
        "summary": _summarise(rows),
        "by_set": {s: _summarise([r for r in rows if r["set"] == s])
                   for s in sorted({r["set"] for r in rows})},
        "dimension_pairs": pairs,
        "rows": rows,
    }
    _qcache_flush()
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: snap[k] for k in ("tag", "embed_model", "catalogue_rows", "vector_dims", "summary")},
                     ensure_ascii=False, indent=1))
    print(f"\nwrote {args.out}")
    return 0


def cmd_compare(args) -> int:
    with open(args.before, encoding="utf-8") as f:
        b = json.load(f)
    with open(args.after, encoding="utf-8") as f:
        a = json.load(f)
    bi = {(r["set"], r["phrase"]): r for r in b["rows"]}
    ai = {(r["set"], r["phrase"]): r for r in a["rows"]}
    keys = [k for k in bi if k in ai]

    print(f"BEFORE  {b['tag']}  ({b['embed_model']}, dims={b['vector_dims']})")
    print(f"AFTER   {a['tag']}  ({a['embed_model']}, dims={a['vector_dims']})\n")

    def line(label, x, y, pct=True):
        fx = "—" if x is None else (f"{x * 100:5.1f}%" if pct else f"{x}")
        fy = "—" if y is None else (f"{y * 100:5.1f}%" if pct else f"{y}")
        d = ""
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            d = f"   {'+' if y - x >= 0 else ''}{(y - x) * 100:.1f}pp" if pct else f"   {y - x:+.4f}"
        print(f"  {label:<24} {fx:>8} -> {fy:>8}{d}")

    print("OVERALL")
    for k in ("recall@1", "recall@5", "recall@1_non_alias", "recall@5_non_alias",
              "dense_recall@1", "dense_recall@5"):
        line(k, b["summary"][k], a["summary"][k])
    mb, ma = b["summary"]["margin"], a["summary"]["margin"]
    for k in ("min", "p10", "p25", "median", "p75", "max", "mean"):
        line("margin " + k, mb[k], ma[k], pct=False)
    # The key CARRIES the threshold ("tight_lt_0.12"), so a run that moved MARGIN_TIGHT has a
    # differently-named key — which is the one comparison you most want to be able to make. Look it
    # up on each side and print both names.
    tkb = [k for k in mb if k.startswith("tight_lt")][0]
    tka = [k for k in ma if k.startswith("tight_lt")][0]
    label = f"margin {tkb}" + (f" -> {tka}" if tka != tkb else "")
    print(f"  {label:<24} {mb[tkb]:>8} -> {ma[tka]:>8}   {ma[tka] - mb[tkb]:+d}")
    print(f"  {'bands':<24} {json.dumps(b['summary']['bands'])} -> {json.dumps(a['summary']['bands'])}")
    print(f"  {'kinds':<24} {json.dumps(b['summary']['kinds'], ensure_ascii=False)}")
    print(f"  {'':<24} {json.dumps(a['summary']['kinds'], ensure_ascii=False)}")

    print("\nPER SET (recall@1 / recall@5 on labelled cases)")
    for s in sorted(set(b["by_set"]) | set(a["by_set"])):
        sb, sa = b["by_set"].get(s, {}), a["by_set"].get(s, {})
        print(f"  {s:<16} n={sb.get('n_labelled', 0):>2}  "
              f"{str(sb.get('recall@1')):>6} -> {str(sa.get('recall@1')):>6}   "
              f"{str(sb.get('recall@5')):>6} -> {str(sa.get('recall@5')):>6}")

    changed = [k for k in keys if bi[k]["kind"] != ai[k]["kind"]]
    print(f"\nVERDICT-KIND CHANGES: {len(changed)} of {len(keys)} mentions")
    better = worse = neutral = 0
    for k in changed:
        rb, ra = bi[k], ai[k]
        exp = ra.get("expect_kind")
        verdict = ""
        if exp not in (None, "__unset__"):
            was, now = rb["kind"] == exp, ra["kind"] == exp
            verdict = "  ✔ FIXED" if (now and not was) else ("  ✘ BROKE" if (was and not now) else "")
        elif exp is None:
            was, now = rb["kind"] == "resolved", ra["kind"] == "resolved"
            verdict = "  ✔ FIXED" if (now and not was) else ("  ✘ BROKE" if (was and not now) else "")
        if "FIXED" in verdict:
            better += 1
        elif "BROKE" in verdict:
            worse += 1
        else:
            neutral += 1
        print(f"  [{rb['set']}] «{rb['phrase']}»: {rb['kind']} -> {ra['kind']}{verdict}")
        print(f"        before: {rb['pick_name']} {rb['pick_score']} (m={rb['margin']}, "
              f"n_close={rb.get('n_close')}) vs {rb['runner_up']}")
        print(f"        after : {ra['pick_name']} {ra['pick_score']} (m={ra['margin']}, "
              f"n_close={ra.get('n_close')}) vs {ra['runner_up']}")
    print(f"  => fixed={better} broke={worse} lateral={neutral}")

    # THE PICK ITSELF, not just the verdict kind: a mention that resolves cleanly to a DIFFERENT row
    # is the most consequential change this harness can report (it is a wrong order, not a wrong
    # question), and a kinds-only diff is blind to it — «SALCHICHÓN VELA 55» was `resolved` before
    # and `resolved` after.
    moved = [k for k in keys if bi[k]["pick"] != ai[k]["pick"]]
    print(f"\nPICK CHANGES: {len(moved)} of {len(keys)} mentions")
    for k in moved:
        rb, ra = bi[k], ai[k]
        want = rb.get("sku")
        mark = ""
        if want:
            mark = "  ✔ NOW CORRECT" if ra["pick"] == want else (
                "  ✘ NOW WRONG" if rb["pick"] == want else "")
        print(f"  [{rb['set']}] «{rb['phrase']}»: {rb['pick_name']} -> {ra['pick_name']}{mark}")
        print(f"        query {rb.get('query')!r} -> {ra.get('query')!r}   "
              f"method {rb['method']} -> {ra['method']}  dim_note={ra.get('dim_note')!r}")

    print("\nRANK CHANGES (labelled cases whose full-matcher rank moved)")
    for k in keys:
        rb, ra = bi[k], ai[k]
        if rb.get("rank") is not None and rb.get("rank") != ra.get("rank"):
            print(f"  [{rb['set']}] «{rb['phrase']}» rank {rb['rank']} -> {ra['rank']}   "
                  f"(dense {rb.get('dense_rank')} -> {ra.get('dense_rank')})  want {rb['sku']}")

    print("\nPLANTED LAWS")
    bp = {(p["a"], p["b"]): p["same_product"] for p in b["dimension_pairs"]}
    ap = {(p["a"], p["b"]): p["same_product"] for p in a["dimension_pairs"]}
    print(f"  dimension pairs DIMENSIONLESS: {sum(bp.values())}/{len(bp)} -> {sum(ap.values())}/{len(ap)}")
    for s, want in (("gaps", doubt.UNKNOWN), ("recall_neg", doubt.UNKNOWN)):
        okb = sum(1 for k in keys if bi[k]["set"] == s and bi[k]["kind"] == want)
        oka = sum(1 for k in keys if ai[k]["set"] == s and ai[k]["kind"] == want)
        tot = sum(1 for k in keys if bi[k]["set"] == s)
        print(f"  {s} -> {want}: {okb}/{tot} -> {oka}/{tot}")
    wide = [k for k in keys if bi[k]["set"] == "near_dup" and bi[k].get("expect_kind") == doubt.UNKNOWN]
    okb = sum(1 for k in wide if bi[k]["kind"] == doubt.UNKNOWN)
    oka = sum(1 for k in wide if ai[k]["kind"] == doubt.UNKNOWN)
    print(f"  wide-tie near-dups -> unknown: {okb}/{len(wide)} -> {oka}/{len(wide)}")
    for k in keys:
        if bi[k]["set"] == "regression":
            print(f"  REGRESSION «{bi[k]['phrase']}»: {bi[k]['kind']} -> {ai[k]['kind']}  "
                  f"({bi[k]['pick_name']} m={bi[k]['margin']} -> {ai[k]['pick_name']} m={ai[k]['margin']})")
    return 0


async def cmd_reembed(args) -> int:
    """Re-embed catalogue_skus with the CURRENT config.BRAIN_EMBED_MODEL. Rehearsal clone only.

    The doc text is `brain.seed._doc_text` — the same text the loader embeds — so a re-embed here and
    a re-seed there cannot disagree. Dim is asserted against the live column before a single row is
    written: a mismatch STOPS, it never migrates a column nobody asked for.
    """
    dsn = os.environ.get("EVAL_DSN") or ""
    dbname = dsn.rsplit("/", 1)[-1].split("?")[0]
    if not dbname.endswith("_rehearsal") and not args.i_know:
        print(f"REFUSING: EVAL_DSN database is {dbname!r}, not a *_rehearsal clone.", file=sys.stderr)
        return 2
    from brain import embed
    from brain import seed as seedmod
    with open(CATALOGUE, encoding="utf-8") as f:
        cat = json.load(f)
    skus = cat["skus"]
    docs = [seedmod._doc_text(s) for s in skus]

    probe = embed.embed_passages([docs[0]])[0]
    print(f"model={config.BRAIN_EMBED_MODEL} produced dim={len(probe)}")
    db._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2, init=db._init_conn)
    async with db._pool.acquire() as con:
        col = await con.fetchval(
            "select atttypmod from pg_attribute where attrelid='catalogue_skus'::regclass and attname='embedding'")
        if col != len(probe):
            print(f"STOP: column vector({col}) != model dim {len(probe)}. Not migrating.", file=sys.stderr)
            return 3
        vecs = await embed.aembed_passages(docs)
        n = 0
        for s, v in zip(skus, vecs):
            n += bool(await con.execute("update catalogue_skus set embedding=$1 where id=$2 and tenant_id=$3",
                                        v, s["id"], config.BRAIN_TENANT))
        left = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and embedding is null", config.BRAIN_TENANT)
    print(f"re-embedded {len(vecs)} rows in {dbname}; rows still null: {left}")
    return 0


async def cmd_verify(args) -> int:
    """Do the STORED vectors and the CURRENT model agree? Read-only.

    The one way to break this stack silently is to change BRAIN_EMBED_MODEL without re-embedding:
    dimensions still match, inserts still succeed, and every score is quietly meaningless because the
    query and the passages came from different encoders. So: re-embed a sample of rows with the model
    that is loaded right now and cosine them against what is in the column. ~1.0 = the catalogue was
    embedded by this model. Anything else = re-embed before serving an order.
    """
    dsn = os.environ.get("EVAL_DSN") or config.DATABASE_URL
    from brain import embed
    from brain import seed as seedmod
    with open(CATALOGUE, encoding="utf-8") as f:
        skus = {s["id"]: s for s in json.load(f)["skus"]}
    db._pool = await asyncpg.create_pool(dsn, min_size=1, max_size=2, init=db._init_conn)
    async with db._pool.acquire() as con:
        rows = await con.fetch(
            "select id from catalogue_skus where tenant_id=$1 and embedding is not null limit $2",
            config.BRAIN_TENANT, args.sample)
        sims = []
        for r in rows:
            s = skus.get(r["id"])
            if not s:
                continue
            fresh = embed.embed_passages([seedmod._doc_text(s)])[0]
            # cosine in Postgres, through the same `<=>` operator the matcher ranks on — no local
            # vector-type juggling, and it measures exactly what retrieval will measure.
            sims.append(float(await con.fetchval(
                "select 1 - (embedding <=> $1) from catalogue_skus where id=$2", fresh, r["id"])))
    if not sims:
        print("no rows to verify", file=sys.stderr)
        return 2
    mean = statistics.fmean(sims)
    ok = mean > 0.99
    print(f"model={config.BRAIN_EMBED_MODEL} sampled={len(sims)} mean_self_cosine={mean:.4f} "
          f"min={min(sims):.4f} -> {'MATCH' if ok else 'MISMATCH — RE-EMBED BEFORE SERVING'}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("snapshot", help="run the labelled set and write a JSON snapshot")
    s.add_argument("--tag", required=True)
    s.add_argument("--out", required=True)
    s.add_argument("--verbose", action="store_true")
    w = sub.add_parser("warm", help="fill EVAL_QVEC_CACHE (encoder only — not a measurement)")
    w.add_argument("--verbose", action="store_true")
    sw = sub.add_parser("sweep", help="N code variants, one process, one model load "
                                      "(--variant tag=<matcher.py>,<doubt.py>; empty path = this tree)")
    sw.add_argument("--variant", action="append", required=True)
    sw.add_argument("--outdir", required=True)
    sw.add_argument("--verbose", action="store_true")
    sw.add_argument("--two-pass", action="store_true", dest="two_pass",
                    help="embed every query text first, drop the encoder, then measure "
                         "(halves peak RSS; needs EVAL_QVEC_CACHE)")
    c = sub.add_parser("compare", help="before/after table + verdict-kind changes")
    c.add_argument("before")
    c.add_argument("after")
    r = sub.add_parser("reembed", help="re-embed catalogue_skus with the current model (clone only)")
    r.add_argument("--i-know", action="store_true", help="allow a non-rehearsal DSN (do not)")
    v = sub.add_parser("verify", help="are the STORED vectors from the CURRENT model? (read-only)")
    v.add_argument("--sample", type=int, default=12)
    args = ap.parse_args()
    if args.cmd == "snapshot":
        return asyncio.run(cmd_snapshot(args))
    if args.cmd == "warm":
        return asyncio.run(cmd_warm(args))
    if args.cmd == "sweep":
        return asyncio.run(cmd_sweep(args))
    if args.cmd == "reembed":
        return asyncio.run(cmd_reembed(args))
    if args.cmd == "verify":
        return asyncio.run(cmd_verify(args))
    return cmd_compare(args)


if __name__ == "__main__":
    sys.exit(main())
