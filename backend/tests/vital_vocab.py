"""vital_vocab.py — THE VOCABULARY PASS vital (PRODUCT-SPEC §5.7 / §5.7a · brain/vocab.py).

A new tenant's catalogue must arrive with its OWN vocabulary. Before this, a real customer's upload
got exactly one alias per SKU — the full catalogue name — while the demo tenant grounded well only
because 216 phrases were written BY HAND into seed/catalogue.json.

  PURE (no DB, no model):
   1. RULES ARE RULES — plan_row is exactly reproducible; the code, the name minus its format tail,
      the calibre as the trade says it, the plurals and elisions all appear.
   2. THE COLLISION GUARD — a phrase two rows of the SAME catalogue answer to is dropped from BOTH.
      That is not a safety net: it is §5.7a's AMBIGUOUS case, and writing it would silently choose.
   3. THE GENERATED FILTER — an invented number, a marketing sentence and the row's own full name
      never survive; a generated phrase that collides goes through the same guard.

  DB (needs Postgres + pgvector; the matcher arms also need the encoder):
   4. WRITE — refresh() writes vocab_rule rows, global, weight 1 (< learned's 2).
   5. IDEMPOTENT — refresh twice is byte-identical; no duplicates, ever.
   6. NEVER CLOBBERS LEARNED — a learned/edit alias survives a refresh, and we never write a
      competing row for a string the customer taught us (§5.7's loop must be able to overrule us).
   7. CACHE — generated phrases cached on the row materialise; a STALE hash is ignored.
   8. SEEDED WORLD UNTOUCHED — the demo's withheld mentions stay withheld.
   9. GO-LIVE WIRING — golive.seed_catalogue leaves the vocabulary committed WITH the catalogue,
      and a re-upload adds the new rows' vocabulary without duplicating the old.
  10. THE CUSTOMER STILL WINS — matcher resolves a learned customer-scoped alias over our guess.

Run:          PYTHONPATH=. python3 tests/vital_vocab.py
Cold measure: one process per stage (the encoder + cross-encoder do not co-exist with much else on
              leo-dev, and a half-dead arm is worse than no number) —
                for s in setup off rules gen teardown; do
                  PYTHONPATH=. python3 -u tests/vital_vocab.py --stage=$s
                done
              `gen` spends real model calls; skip it to measure the deterministic pass alone.
"""
import asyncio
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import doubt  # noqa: E402
from brain import matcher, vocab  # noqa: E402

TEN = "vitalvocab"
COLD = "vocabcold"
R = []


def ck(n, ok, d=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


def _sku(i, name, code="", family="emb", base_unit="kg"):
    return {"id": f"{TEN}-{i}", "name": name, "code": code, "family": family, "base_unit": base_unit}


# ══════════════════════════════════════════════════════════════════════════════════════════════
# PART 1 — pure: the rules and the guard
# ══════════════════════════════════════════════════════════════════════════════════════════════

def part1_pure():
    print("\n① RULES + COLLISION GUARD (pure — no DB, no model)")

    sarta = _sku(1, "CHORIZO SARTA EXTRA 500 G", "EMB-CHS-050", base_unit="unit")
    vela55 = _sku(2, "SALCHICHÓN VELA 55 MM", "EMB-SAV-055")
    vela40 = _sku(3, "SALCHICHÓN VELA 40 MM", "EMB-SAV-040")
    fuet = _sku(4, "FUET EXTRA 170 G", "EMB-FUE-017", base_unit="unit")
    cabeza = _sku(5, "QUESO CABEZA PIEZA", "COC-QCA-PZA")

    a_sarta = vocab.plan_row(sarta)
    ck("1.1 reproducible — same row, same list, twice", vocab.plan_row(sarta) == a_sarta)
    ck("1.2 the article CODE and its compact variant",
       "emb chs 050" in a_sarta and "embchs050" in a_sarta)
    ck("1.3 the name minus its measure/grade tail",
       "chorizo sarta extra" in a_sarta and "chorizo sarta" in a_sarta, str(a_sarta[:6]))

    a55 = vocab.plan_row(vela55)
    ck("1.4 the calibre the way the trade says it — «vela 55» · «del 55» · «salchichón del 55»",
       {"vela 55", "del 55", "salchichon del 55"} <= set(a55), str(a55))
    ck("1.4b the CALIBRE-PRESERVING name — «salchichón vela 55» (matcher tries this form FIRST)",
       "salchichon vela 55" in a55)
    a_fuet = vocab.plan_row(fuet)
    ck("1.5 plural + the weight form — «fuets» · «fuet de 170»",
       "fuets" in a_fuet and "fuet de 170" in a_fuet, str(a_fuet))
    a_cab = vocab.plan_row(cabeza)
    ck("1.6 the elision — «queso de cabeza»", "queso de cabeza" in a_cab, str(a_cab))
    ck("1.7 never a bare measure/grade word as an alias",
       not ({"extra", "pieza", "500", "g", "mm"} & set(a_sarta + a55 + a_cab)))

    # ── the guard ──
    plan = vocab.plan_catalogue([vela55, vela40])
    kept = {a for a, _ in plan["rule"]}
    ck("2.1 AMBIGUOUS phrase dropped from BOTH rows — «salchichón vela» belongs to neither",
       "salchichon vela" not in kept and "salchichon vela" in plan["dropped_ambiguous"])
    ck("2.2 what DISAMBIGUATES survives — «del 55» and «del 40» both kept",
       {"del 55", "del 40"} <= kept)
    owners = {}
    for a, s in plan["rule"]:
        owners.setdefault(a, set()).add(s)
    ck("2.3 no surviving alias claims two rows", all(len(v) == 1 for v in owners.values()))

    plan_taken = vocab.plan_catalogue([vela55], taken={"del 55": {"someone-else"}})
    ck("2.4 a string already claimed elsewhere (learned/seed/golive) is never written",
       "del 55" not in {a for a, _ in plan_taken["rule"]} and "del 55" in plan_taken["dropped_taken"])

    # ── the generated filter ──
    keep = vocab.filter_generated(vela55, [
        "vela gorda", "del 55", "SALCHICHÓN VELA 55 MM",
        "salchichón del 70",                                  # a calibre the row does not have
        "el mejor salchichón artesano de nuestra tierra",     # marketing + too long
        "de",                                                 # stop word
    ])
    ck("3.1 a generated phrase with an INVENTED number is dropped", "salchichon del 70" not in keep)
    ck("3.2 the row's own full name is not re-written", "salchichon vela 55 mm" not in keep)
    ck("3.3 marketing / stop words dropped",
       not any(k.startswith("el mejor") for k in keep) and "de" not in keep)
    ck("3.4 the real trade phrases survive", {"vela gorda", "del 55"} <= set(keep), str(keep))

    gplan = vocab.plan_catalogue(
        [vela55, vela40], extra={vela55["id"]: ["york"], vela40["id"]: ["york"]})
    ck("3.5 a GENERATED phrase claimed by two rows goes through the same guard",
       "york" not in {a for a, _ in gplan["gen"]} and "york" in gplan["dropped_ambiguous"])
    gplan2 = vocab.plan_catalogue([vela55, vela40], extra={vela55["id"]: ["la gorda"]})
    ck("3.6 an unambiguous generated phrase is kept, tagged vocab_gen",
       ("la gorda", vela55["id"]) in gplan2["gen"])


# ══════════════════════════════════════════════════════════════════════════════════════════════
# PART 2 — the DB projection
# ══════════════════════════════════════════════════════════════════════════════════════════════

SKUS_A = [
    {"code": "EMB-CHS-050", "name": "CHORIZO SARTA EXTRA 500 G", "family": "embutido_curado",
     "unit": "ud", "price": 4.2},
    {"code": "EMB-SAV-055", "name": "SALCHICHÓN VELA 55 MM", "family": "embutido_curado",
     "unit": "kg", "price": 9.1},
    {"code": "COC-PAC-PZA", "name": "PALETA COCIDA PIEZA", "family": "cocidos",
     "unit": "kg", "price": 5.4},
]
SKUS_B = SKUS_A + [
    {"code": "QUE-CAB-100", "name": "QUESO CABRA RULO 1 KG", "family": "quesos",
     "unit": "ud", "price": 8.0},
]


async def _aliases(con, tenant, source=None):
    q = "select alias, sku_id, source, weight, phone_number from sku_aliases where tenant_id=$1"
    args = [tenant]
    if source:
        q += " and source=$2"
        args.append(source)
    return [dict(r) for r in await con.fetch(q + " order by alias, sku_id, source", *args)]


async def _cleanup(con, *tenants):
    for t in tenants:
        await con.execute("delete from sku_aliases where tenant_id=$1", t)
        await con.execute("delete from catalogue_skus where tenant_id=$1", t)


async def part2_db(db, golive):
    print("\n② THE PROJECTION (real Postgres)")
    pool = db.get_pool()
    async with pool.acquire() as con:
        await _cleanup(con, TEN)

    r = await golive.seed_catalogue(TEN, SKUS_A)
    ck("4.1 go-live seeded the catalogue", r.get("ok") and r.get("skus") == 3, str(r.get("reason", "")))

    async with pool.acquire() as con:
        rule = await _aliases(con, TEN, vocab.SRC_RULE)
        ck("4.2 THE VOCABULARY IS COMMITTED WITH THE CATALOGUE — vocab_rule rows exist right after "
           "seed_catalogue returns", len(rule) > 0, f"{len(rule)} aliases")
        ck("4.3 global (phone null) and weight 1 — strictly below a learned alias's 2",
           all(a["phone_number"] is None and a["weight"] == 1 for a in rule))
        by_alias = {}
        for a in rule:
            by_alias.setdefault(a["alias"], set()).add(a["sku_id"])
        ck("4.4 no alias in the table claims two SKUs", all(len(v) == 1 for v in by_alias.values()))
        ck("4.5 the trade's own words are there — «del 55» · «paleta cocida»",
           {"del 55", "paleta cocida"} <= set(by_alias), str(sorted(by_alias)[:12]))

        before = await _aliases(con, TEN)
        await vocab.refresh(con, TEN)
        after = await _aliases(con, TEN)
        ck("5.1 IDEMPOTENT — a second refresh changes nothing at all", before == after,
           f"{len(before)} → {len(after)}")
        await vocab.refresh(con, TEN)
        ck("5.2 …and a third", await _aliases(con, TEN) == after)

        # ── the customer teaches us something that clashes with a rule alias ──
        sku_paleta = [a["sku_id"] for a in rule if a["alias"] == "paleta cocida"][0]
        sku_vela = [a["sku_id"] for a in rule if a["alias"] == "del 55"][0]
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               values ($1,'york',$2,'+34600111999','learned',2)""", TEN, sku_paleta)
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               values ($1,'del 55',$2,null,'edit',2)""", TEN, sku_paleta)   # deliberately the WRONG sku
        await vocab.refresh(con, TEN)
        rows = await _aliases(con, TEN)
        learned = [a for a in rows if a["source"] in ("learned", "edit")]
        ck("6.1 a learned/edit alias survives the rebuild untouched", len(learned) == 2)
        clash = [a for a in rows if a["alias"] == "del 55" and a["source"] == vocab.SRC_RULE]
        ck("6.2 we NEVER write a competing row for a string the customer taught us",
           clash == [], str(clash))
        ck("6.3 …and the taught row is the only «del 55» left",
           [a["source"] for a in rows if a["alias"] == "del 55"] == ["edit"])
        await con.execute("delete from sku_aliases where tenant_id=$1 and source in ('learned','edit')", TEN)
        await vocab.refresh(con, TEN)
        ck("6.4 when the taught alias goes away the rule alias comes back",
           any(a["alias"] == "del 55" and a["source"] == vocab.SRC_RULE
               for a in await _aliases(con, TEN)))

        # ── the generated cache ──
        row = await con.fetchrow(
            "select id, code, name, family, base_unit from catalogue_skus where id=$1", sku_paleta)
        good = {"h": vocab.row_hash(dict(row)), "gen": ["york", "el jamoncito"], "at": "t", "model": "m"}
        await con.execute(
            "update catalogue_skus set attrs = attrs || jsonb_build_object('vocab',$2::jsonb) "
            "where id=$1", sku_paleta, good)
        await vocab.refresh(con, TEN)
        gen = await _aliases(con, TEN, vocab.SRC_GEN)
        ck("7.1 cached generated phrases materialise as vocab_gen",
           {"york", "el jamoncito"} <= {a["alias"] for a in gen}, str([a["alias"] for a in gen]))
        ck("7.2 …at weight 1, below anything learned", all(a["weight"] == 1 for a in gen))
        stale = dict(good, h="deadbeefdeadbeef")
        await con.execute(
            "update catalogue_skus set attrs = attrs || jsonb_build_object('vocab',$2::jsonb) "
            "where id=$1", sku_paleta, stale)
        await vocab.refresh(con, TEN)
        ck("7.3 a STALE cache (the row's content changed) is ignored, not written",
           await _aliases(con, TEN, vocab.SRC_GEN) == [])

        st = await vocab.status(TEN)
        ck("7.4 status() reports the floor as ready", st.get("floor_ready") is True, str(st))

    # ── re-upload ──
    n_before = len(rule)
    r2 = await golive.seed_catalogue(TEN, SKUS_B)
    async with pool.acquire() as con:
        rows2 = await _aliases(con, TEN, vocab.SRC_RULE)
        dupes = [a for a, n in Counter((x["alias"], x["sku_id"]) for x in rows2).items() if n > 1]
        ck("9.1 a re-upload adds the new rows' vocabulary", len(rows2) > n_before,
           f"{n_before} → {len(rows2)}")
        ck("9.2 …with no duplicates of the old", dupes == [], str(dupes[:4]))
        ck("9.3 the new product's own words are there — «queso de cabra»",
           "queso de cabra" in {a["alias"] for a in rows2}, str(r2.get("skus")))
        r3 = await golive.seed_catalogue(TEN, SKUS_B)
        ck("9.4 seeding the SAME catalogue again is a no-op for the vocabulary too",
           await _aliases(con, TEN, vocab.SRC_RULE) == rows2 and r3.get("ok"))

        # ── the customer still wins at lookup time ──
        sku_vela = [a["sku_id"] for a in rows2 if a["alias"] == "del 55"][0]
        sku_paleta = [a["sku_id"] for a in rows2 if a["alias"] == "paleta cocida"][0]
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               values ($1,'del 55',$2,'+34600111999','learned',2)""", TEN, sku_paleta)
    m_us = await matcher.match("del 55", tenant=TEN)
    m_them = await matcher.match("del 55", tenant=TEN, phone="+34600111999")
    ck("10.1 our guess grounds for everyone else", m_us.alias_hit and m_us.pick["sku_id"] == sku_vela)
    ck("10.2 THE CUSTOMER'S OWN WORD BEATS OUR GUESS for the customer who taught it",
       m_them.alias_hit and m_them.pick["sku_id"] == sku_paleta)

    async with pool.acquire() as con:
        await _cleanup(con, TEN)


async def part3_seeded(db):
    """The demo world's withheld mentions must stay withheld (seed/catalogue.json §_learnable_mentions)."""
    print("\n③ THE SEEDED DEMO WORLD IS NOT TOUCHED")
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into catalogue_skus (id, tenant_id, code, name, family, base_unit, seeded)
               values ($1,$2,'X-1','PALETA COCIDA PIEZA','cocidos','kg',true)
               on conflict (id) do update set seeded=true""", f"{TEN}-seeded", TEN)
        res = await vocab.refresh(con, TEN)
        ck("8.1 a seeded row contributes no vocabulary by default",
           res.get("rows") == 0 and await _aliases(con, TEN, vocab.SRC_RULE) == [], str(res))
        res2 = await vocab.refresh(con, TEN, include_seeded=True)
        ck("8.2 …unless a caller explicitly asks for it", res2.get("rows") == 1)
        await _cleanup(con, TEN)


# ══════════════════════════════════════════════════════════════════════════════════════════════
# PART 4 — THE COLD-TENANT MEASUREMENT (--measure)
# ══════════════════════════════════════════════════════════════════════════════════════════════

def _gold_mentions():
    """Held-out colloquial mentions + their true SKU.

    Source: seed/catalogue.json's hand-authored `aliases` (216 phrases) and `_learnable_mentions`
    (4). NEITHER is visible to this pass — `golive.seed_catalogue` takes only code/name/family/unit/
    price off a wizard row and drops everything else — so as a test set they are genuinely held out.
    """
    d = json.load(open(Path(__file__).resolve().parent.parent / "seed" / "catalogue.json"))
    by_seed_id = {s["id"]: s for s in d["skus"]}
    rows = [{"code": s.get("code", ""), "name": s["name"], "family": s.get("family", ""),
             "unit": s.get("base_unit", "kg"), "price": s.get("price"), "_seed_id": s["id"]}
            for s in d["skus"]]

    def cold_id(code, name, unit):
        ident = code if code else f"{matcher.normalize(name)}|{unit}"
        return COLD + ":" + hashlib.sha256(f"{COLD}|{ident}".encode()).hexdigest()[:16]

    seed_to_cold = {s["id"]: cold_id(s.get("code", ""), s["name"], s.get("base_unit", "kg"))
                    for s in d["skus"]}
    mentions = []
    for s in d["skus"]:
        for a in (s.get("aliases") or []):
            mentions.append({"say": a, "gold": seed_to_cold[s["id"]], "set": "aliases",
                             "name": s["name"], "price": s.get("price")})
    for m in (d.get("_learnable_mentions") or {}).get("mentions", []):
        if m.get("true_sku") in by_seed_id:
            mentions.append({"say": m["say"], "gold": seed_to_cold[m["true_sku"]],
                             "set": "learnable", "name": by_seed_id[m["true_sku"]]["name"],
                             "price": by_seed_id[m["true_sku"]].get("price")})
    return rows, mentions


async def _arm(label, mentions, resume=None):
    """Run every mention through the REAL matcher + the REAL doubt classifier.

    `resume` is a scratch path: each mention's verdict is appended as it lands, so a process the box
    kills half-way (leo-dev is shared and the encoder is 2 GB) resumes instead of starting over.
    Nothing about the measurement changes — the same mention always produces the same verdict."""
    done = {}
    if resume and os.path.exists(resume):
        for ln in open(resume):
            try:
                r = json.loads(ln)
                done[r["say"]] = r
            except Exception:
                pass
    fh = open(resume, "a") if resume else None
    hits = 0
    kinds, methods, bands = Counter(), Counter(), Counter()
    for m in mentions:
        r = done.get(m["say"])
        if r is None:
            res = await matcher.match(m["say"], tenant=COLD)
            line = {"mention": m["say"], "qty": 5, "unit": None, "price": m.get("price"),
                    "match": res.as_dict()}
            r = {"say": m["say"], "pick": (res.pick or {}).get("sku_id"),
                 "method": res.method, "band": res.band,
                 "kind": doubt.classify_line(line)["kind"] or "resolved"}
            if fh:
                fh.write(json.dumps(r) + "\n")
                fh.flush()
        hits += int(r["pick"] == m["gold"])
        methods[r["method"]] += 1
        bands[r["band"]] += 1
        kinds[r["kind"]] += 1
    if fh:
        fh.close()
    n = len(mentions) or 1
    print(f"\n   ── {label} ──")
    print(f"   recall@1            {hits}/{len(mentions)} = {100.0*hits/n:.1f}%")
    print(f"   grounding method    {dict(methods)}")
    print(f"   matcher band        {dict(bands)}")
    print(f"   doubt KIND          {dict(kinds)}")
    return {"label": label, "recall": hits / n, "hits": hits, "n": len(mentions),
            "kinds": dict(kinds), "methods": dict(methods), "bands": dict(bands)}


async def measure_stage(stage):
    """ONE stage of the cold measurement, as its own process.

    Split deliberately: the encoder + the cross-encoder together do not fit alongside the other
    agents on this box, and an arm that dies half-way is worse than no number at all. Each stage
    prints a `RESULT <json>` line the driver collects.

      setup    load the cold catalogue (no vocabulary at all)
      off      arm A — what a real customer got before this work
      rules    arm B — deterministic pass on
      gen      run the model pass, then arm C
      teardown drop the tenant
    """
    import db
    from brain import golive
    await db.init()
    pool = db.get_pool()
    rows, mentions = _gold_mentions()

    if stage == "setup":
        async with pool.acquire() as con:
            await _cleanup(con, COLD)
        r = await golive.seed_catalogue(COLD, rows)
        async with pool.acquire() as con:
            # ARM A baseline: strip the vocabulary the go-live hook just wrote, leaving exactly what
            # a real customer used to get — golive's one full-name alias per row.
            await con.execute("delete from sku_aliases where tenant_id=$1 and source = any($2::text[])",
                              COLD, list(vocab.OUR_SOURCES))
            n = await con.fetchval("select count(*) from sku_aliases where tenant_id=$1", COLD)
        print("RESULT " + json.dumps({"stage": "setup", "ok": bool(r.get("ok")), "rows": len(rows),
                                      "mentions": len(mentions), "aliases": int(n)}))
        return

    if stage == "rules":
        async with pool.acquire() as con:
            res = await vocab.refresh(con, COLD)
        print("   deterministic pass: +%s aliases, %s phrases refused as AMBIGUOUS "
              "within this catalogue" % (res.get("rule"), res.get("ambiguous")))
        print("   refused sample:", res.get("ambiguous_sample"))

    if stage == "gen":
        g = await vocab.generate(COLD)
        async with pool.acquire() as con:
            n_gen = await con.fetchval(
                "select count(*) from sku_aliases where tenant_id=$1 and source=$2",
                COLD, vocab.SRC_GEN)
        print("   generated pass: %s model calls over %s rows → %s phrases proposed, "
              "%s survived the guard" % (g.get("batches"), g.get("pending"),
                                         g.get("generated"), n_gen))

    if stage == "teardown":
        async with pool.acquire() as con:
            await _cleanup(con, COLD)
        return

    async with pool.acquire() as con:
        n = await con.fetchval("select count(*) from sku_aliases where tenant_id=$1", COLD)
    out = await _arm(f"{stage.upper()} ({n} aliases)", mentions,
                     resume=os.environ.get("VOCAB_RESUME_DIR", "/tmp") + f"/vocab_arm_{stage}.jsonl")
    out["aliases"] = int(n)
    print("RESULT " + json.dumps(out))


async def main():
    for a in sys.argv[1:]:
        if a.startswith("--stage="):
            await measure_stage(a.split("=", 1)[1])
            return
    part1_pure()
    import db
    from brain import golive
    await db.init()
    await part2_db(db, golive)
    await part3_seeded(db)
    ok = sum(R)
    print(f"\n{ok}/{len(R)} checks passed")
    sys.exit(0 if ok == len(R) else 1)


if __name__ == "__main__":
    asyncio.run(main())
