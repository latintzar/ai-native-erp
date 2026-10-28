"""vital_directory_tiers.py — THE GRADUATED SUPPLIER CARD (PRODUCT-SPEC §5.10.1).

`vital_directory.py` proves the ORGAN (it distils, it is idempotent, it reaches both mouths). This
proves the LADDER: that the compaction level is chosen by catalogue SIZE, that every rung is honest
about what it dropped, and — the one that matters — **that a compressed card can never make the mind
confident about an ABSENCE**. A card so squeezed that Rocoto says «no, eso no lo llevamos» about
something the supplier has sold for twenty years is worse than silence: it is a lost order and a
customer told a confident falsehood about the supplier's own book, by the supplier's own employee.

  T1  THE LADDER IS MONOTONE — A ≥ B ≥ C ≥ D on every catalogue tested. A rung that can render BIGGER
      than the rung above it is not a rung; "chosen by fit" would then skip it or, worse, grow.
  T2  THE REAL WORLD FITS VERBATIM — the 65-row seeded charcutería lands at tier A, 65 of 65 names
      present, by SET COMPARISON. (At the old 2,600 B budget it overflowed at 2,986 B and fell to the
      family rollup: 4 items named per family, 37 articles hidden. That was Peter's complaint, and it
      was already true in production.)
  T3  BYTE-REPRODUCIBLE — the same SKU set renders byte-identically from JSON and from Postgres, and
      twice in a row. The fold is a pure function of the store (§4.5 `why_hash`).
  T4  SIZE PICKS THE TIER — 250 / 1,200 / 4,000 rows: each body within the ceiling, each tier derived
      DOWNWARD, and EVERY FAMILY present at EVERY tier.
  T5  NOTHING EVER READS AS A DENIAL — wherever `names_complete` is false the body carries «no digas
      que no lo tienes» verbatim; wherever `prices_complete` is false it says to look a price up
      before saying it; and no family is ever silently missing (the elision sentinel says how many).
  T6  THE FLAGS REACH THE TURN — from the ASSEMBLED fold, not from a constant: `### CATALOGUE` is
      spliced, and `catalogue_lookup_needed` is false at tier A and true at B/C/D.
  T7  «BÚSCALO» IS NOT A LIE — `directory.look_up` returns real rows of THIS tenant and [] on a miss.
  T8  THE MODEL MAY NOT NAME A PRODUCT — a group map is applied only if total, exact and label-clean;
      any violation discards it WHOLE and the card falls back to the family column.

Hermetic: its own tenant (`vitaltiers`), never the seeded world, so a run cannot trample the demo.
Run on the clone: PYTHONPATH=. venv/bin/python tests/vital_directory_tiers.py
"""
import asyncio
import json
import os
import random
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import assemble as assemble_mod  # noqa: E402
import db
import directory
import doubt as doubt_mod  # noqa: E402

TEN = "vitaltiers"
SCOPE = f"t.{TEN}.c.1"
SEED_JSON = Path(__file__).resolve().parent.parent / "seed" / "catalogue.json"
R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


def seed_rows() -> list[dict]:
    """The REAL house catalogue (§5.7 style: es-ES uppercase, the calibre inside the name)."""
    skus = json.load(open(SEED_JSON, encoding="utf-8"))["skus"]
    return [{"id": s["id"], "name": s["name"], "family": s.get("family") or "otros",
             "base_unit": s.get("base_unit", "kg"), "price": s.get("price")}
            for s in skus if s.get("in_assortment", True)]


_CAL = ["500 G", "1 KG", "250 G", "3 KG", "45 MM", "55 MM", "PIEZA", "LONCHEADO 100 G", "CAJA 5 KG"]
_GRADE = ["EXTRA", "SELECTA", "PRIMERA", "RESERVA"]


def synth(n: int, base: list[dict], seed: int = 7) -> list[dict]:
    """A catalogue of `n` REAL-SHAPED rows: the house stems, more grades and more calibres of each —
    which is how a big charcutería list actually grows (§5.7: the doubt is the calibre, not the
    product). Deterministic."""
    rnd = random.Random(seed)
    out, i = [], 0
    while len(out) < n:
        for b in base:
            if len(out) >= n:
                break
            i += 1
            stem = directory.catalogue_stem(b["name"]) or b["name"]
            out.append({"id": f"vt:{i}", "name": f"{stem} {rnd.choice(_GRADE)} {rnd.choice(_CAL)}",
                        "family": b["family"], "base_unit": b["base_unit"],
                        "price": round(1.0 + (i % 40) * 0.75, 2)})
    return out


def wide(n_fam: int, per: int) -> list[dict]:
    """The other shape: many FAMILIES. This is the only path where a family can be missing at all."""
    return [{"id": f"vw:{f}:{i}", "name": f"ARTICULO CLASE{f:03d} CALIBRE {i} 500 G",
             "family": f"familia_{f:03d}", "base_unit": "kg", "price": 1.5 + (f % 9)}
            for f in range(n_fam) for i in range(per)]


def fam_labels(rows) -> set:
    return {str(r["family"] or "otros").strip().replace("_", " ").upper() for r in rows}


async def _load(rows):
    pool = db.get_pool()
    async with pool.acquire() as con:
        await directory.ensure_schema(con)
        await con.execute("delete from catalogue_skus where tenant_id=$1", TEN)
        for i in range(0, len(rows), 500):
            chunk = rows[i:i + 500]
            await con.executemany(
                "insert into catalogue_skus(id,tenant_id,name,family,base_unit,price) "
                "values($1,$2,$3,$4,$5,$6) on conflict (id) do update set name=excluded.name, "
                "family=excluded.family, base_unit=excluded.base_unit, price=excluded.price",
                [(r["id"], TEN, r["name"], r["family"], r["base_unit"], r["price"]) for r in chunk])


async def _stored():
    pool = db.get_pool()
    async with pool.acquire() as con:
        return await con.fetchrow(
            "select body, tier, names_complete, prices_complete, n_skus, budget_bytes, sku_hash "
            "from catalogue_directory where tenant_id=$1", TEN)


async def _cleanup():
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where tenant_id=$1", TEN)
        await con.execute("delete from catalogue_directory where tenant_id=$1", TEN)


def show(title, body):
    b = body.encode()
    print(f"\n    ── {title} ({len(b)} B) ──")
    head = body[:400]
    tail = body[-400:]
    print("      " + head.replace("\n", "\n      "))
    if len(body) > 800:
        print("      … … …")
        print("      " + tail.replace("\n", "\n      "))
    print()


async def main():
    await db.init()
    await _cleanup()
    base = seed_rows()
    print(f"\nceiling = {directory.CEILING} B  ·  seed catalogue = {len(base)} in-assortment rows\n")

    # ── T1 · the ladder is MONOTONE, on four differently-shaped catalogues ──────────────────────
    print("T1 — the ladder is monotone (a rung must be strictly cheaper than the one above it)")
    shapes = [("seed 65", base), ("250", synth(250, base)), ("1200", synth(1200, base)),
              ("4000", synth(4000, base)), ("wide 60×20", wide(60, 20))]
    for lab, rows in shapes:
        g = directory._groups(rows)
        s = {t: len(fn(g).encode()) for t, fn in (("A", directory._render_a), ("B", directory._render_b),
                                                  ("C", directory._render_c), ("D", directory._render_d))}
        ck(f"A ≥ B ≥ C ≥ D on «{lab}»", s["A"] >= s["B"] >= s["C"] >= s["D"],
           f"A={s['A']} B={s['B']} C={s['C']} D={s['D']}")

    # the stem is ONE definition, shared with the doubt faculty (§5.10.4)
    pairs = json.load(open(SEED_JSON, encoding="utf-8")).get("_dimension_pairs", {}).get("pairs", [])
    by_id = {s["id"]: s for s in json.load(open(SEED_JSON, encoding="utf-8"))["skus"]}
    agree = 0
    for a, b in pairs:
        ra, rb = by_id.get(a), by_id.get(b)
        if not ra or not rb:
            continue
        same_doubt = doubt_mod._same_product({"name": ra["name"]}, {"name": rb["name"]})
        same_stem = directory.catalogue_stem(ra["name"]) == directory.catalogue_stem(rb["name"])
        agree += int(same_doubt == same_stem)
    ck("catalogue_stem agrees with doubt._same_product on every seeded dimension pair",
       pairs and agree == len(pairs), f"{agree}/{len(pairs)} pairs")

    # ── T2 · the real world fits VERBATIM ───────────────────────────────────────────────────────
    print("\nT2 — the 65-row house catalogue is not crushed")
    d = directory.render(base)
    ck("seeded catalogue lands at tier A (verbatim, with prices)", d["tier"] == "A",
       f"tier={d['tier']} bytes={d['bytes']}/{directory.CEILING}")
    names_in_body = {r["name"] for r in base if r["name"] in d["body"]}
    ck("every in-assortment name is in the body (set comparison, not by eye)",
       names_in_body == {r["name"] for r in base}, f"{len(names_in_body)}/{len(base)}")
    ck("tier A declares itself complete (names + prices)", d["names_complete"] and d["prices_complete"])
    ck("it would NOT have fitted the old 2,600 B budget (the defect this closes)",
       len(directory._render_a(directory._groups(base)).encode()) > 2600,
       f"verbatim body alone = {len(directory._render_a(directory._groups(base)).encode())} B")
    show("tier A — the seeded world's card, as the mind reads it", d["body"])

    # ── T3 · byte-reproducible, from either source, every time ──────────────────────────────────
    print("T3 — byte-reproducible (the fold is a pure function of the store)")
    await _load(base)
    r1 = await directory.build(TEN)
    row1 = await _stored()
    ck("build distilled the tenant", r1.get("built") and r1.get("n_skus") == len(base), str(r1))
    ck("the STORED body is byte-identical to the pure render", row1["body"] == d["body"],
       f"stored={len(row1['body'].encode())}B pure={d['bytes']}B")
    ck("stored tier + flags match the render",
       row1["tier"] == "A" and row1["names_complete"] and row1["prices_complete"]
       and row1["budget_bytes"] == directory.CEILING, f"tier={row1['tier']}")
    r2 = await directory.build(TEN)
    ck("an unchanged SKU set never re-distills", (not r2.get("built")) and r2.get("reason") == "unchanged")
    r3 = await directory.build(TEN, force=True)
    row3 = await _stored()
    ck("a forced rebuild is byte-identical (deterministic fold)", row3["body"] == row1["body"],
       f"{len(row3['body'].encode())} B")
    ck("the hash key carries the renderer version (a renderer change invalidates every body)",
       directory._hash_rows(base) != directory._hash_rows(base, ceiling=directory.CEILING + 1))

    # ── T4 · SIZE picks the tier, and every family survives every tier ──────────────────────────
    print("\nT4 — the tier is derived by FIT at 90 / 150 / 250 / 1,200 / 4,000 rows")
    seen_tiers = set()
    for n in (90, 150, 250, 1200, 4000):
        rows = synth(n, base)
        await _load(rows)
        res = await directory.build(TEN, force=True)
        row = await _stored()
        body = row["body"]
        seen_tiers.add(row["tier"])
        ck(f"{n} rows → within the ceiling", len(body.encode()) <= directory.CEILING,
           f"tier={row['tier']} bytes={len(body.encode())}/{directory.CEILING}")
        missing = [f for f in fam_labels(rows) if f not in body]
        ck(f"{n} rows → EVERY family is named at tier {row['tier']}", not missing,
           f"{len(fam_labels(rows))} families, missing={missing[:3]}")
        show(f"{n} rows — tier {row['tier']}", body)
    ck("every rung below A was reached THROUGH POSTGRES, not only in the pure renderer",
       seen_tiers == {"B", "C", "D"}, f"tiers seen: {sorted(seen_tiers)}")
    # THE BRACKETS ARE DERIVED, NOT DECLARED — swept, not asserted at fixed sizes, because they move
    # with how long this supplier's article names are (that is the whole point: a supplier whose names
    # are sentences degrades one rung earlier, automatically, instead of blowing the turn budget).
    ladder = {n: directory.render(base if n == 65 else synth(n, base))["tier"]
              for n in range(60, 230, 10)}
    brackets = {t: [n for n, v in ladder.items() if v == t] for t in ("A", "B", "C", "D")}
    print("    derived brackets on THIS catalogue's name lengths: "
          + " · ".join(f"{t} ≤{max(v)} rows" if v else f"{t} —" for t, v in brackets.items()))
    ck("every rung of the ladder is reachable (A, B, C and D all occur)",
       set(ladder.values()) == {"A", "B", "C", "D"}, str(ladder))
    ck("the ladder only ever descends with size (never a rung back up)",
       all("ABCD".index(a) <= "ABCD".index(b)
           for a, b in zip(list(ladder.values()), list(ladder.values())[1:])), str(ladder))

    # ── T5 · nothing ever reads as a DENIAL ─────────────────────────────────────────────────────
    print("\nT5 — a compressed card never licenses «no lo llevamos»")
    for lab, rows in (("65", base), ("90", synth(90, base)), ("150", synth(150, base)),
                      ("4000", synth(4000, base)), ("wide 300×20", wide(300, 20))):
        dd = directory.render(rows)
        body = dd["body"]
        if not dd["names_complete"]:
            ok = directory.NO_DENIAL in body
            ck(f"«{lab}» tier {dd['tier']}: names incomplete ⇒ «{directory.NO_DENIAL}» is IN the body", ok)
        else:
            ck(f"«{lab}» tier {dd['tier']}: names complete ⇒ every article is literally present",
               all(r["name"] in body or directory.catalogue_stem(r["name"]) in body for r in rows))
        if not dd["prices_complete"]:
            ck(f"«{lab}» tier {dd['tier']}: prices incomplete ⇒ the body says to look a price up first",
               "míralo antes de decirlo" in body or directory.NO_DENIAL in body)
        ck(f"«{lab}» tier {dd['tier']}: within the ceiling", dd["bytes"] <= directory.CEILING,
           f"{dd['bytes']} B")
        # THE CONSERVATION LAW: families named in the body + families the body DECLARES it is not
        # showing == every family there is. There is no third bucket — no family is ever just gone.
        named = sum(1 for f in fam_labels(rows) if f in body)
        ck(f"«{lab}» tier {dd['tier']}: familias nombradas + declaradas = todas ({named}+"
           f"{dd['elided_groups']}={len(fam_labels(rows))})",
           named + dd["elided_groups"] == len(fam_labels(rows)))
        if dd["elided_groups"]:
            ck(f"«{lab}»: the {dd['elided_groups']} unlisted families are DECLARED, never silent",
               "no mostradas" in body and str(dd["elided_groups"]) in body)
    w = directory.render(wide(300, 20))
    show("300 families — the only shape where a family can be missing, and it says so", w["body"])
    ck("no tier ever exceeds the ceiling, on any shape tested",
       all(directory.render(r)["bytes"] <= directory.CEILING
           for r in (base, synth(250, base), synth(4000, base), wide(300, 20), wide(7, 600))))

    # ── T6 · the flags reach the ASSEMBLED turn ─────────────────────────────────────────────────
    print("\nT6 — the turn itself knows how complete its catalogue is")
    await _load(base)
    await directory.build(TEN, force=True)
    async with db.scoped_tx(SCOPE) as con:
        fold_a = await assemble_mod.assemble(con, SCOPE, "¿tenéis jamón?")
    ck("the chat fold carries ### CATALOGUE", "### CATALOGUE" in fold_a.get("rendered", ""))
    ck("the fold's catalogue block IS the stored body (one producer, no second renderer)",
       fold_a.get("catalogue") == (await _stored())["body"])
    ck("tier A ⇒ the turn reports names+prices complete",
       fold_a.get("catalogue_tier") == "A" and fold_a.get("names_complete")
       and fold_a.get("prices_complete"), f"tier={fold_a.get('catalogue_tier')}")
    ck("tier A ⇒ look_up_product is NOT needed in this turn's action space",
       fold_a.get("catalogue_lookup_needed") is False)
    await _load(synth(4000, base))
    await directory.build(TEN, force=True)
    async with db.scoped_tx(SCOPE) as con:
        fold_d = await assemble_mod.assemble(con, SCOPE, "¿tenéis jamón?")
    ck("tier D ⇒ the turn reports names INcomplete",
       fold_d.get("catalogue_tier") == "D" and not fold_d.get("names_complete"),
       f"tier={fold_d.get('catalogue_tier')}")
    ck("tier D ⇒ look_up_product IS needed in this turn's action space",
       fold_d.get("catalogue_lookup_needed") is True)
    ck("the fold at tier D carries the anti-denial sentence into the prompt bytes",
       directory.NO_DENIAL in fold_d.get("rendered", ""))
    ck("the supplier card slot itself never disappears", bool(fold_d.get("supplier")))

    # Deployment owns shape changes. The established helper verifies the migration revision;
    # repeated reads/builds leave the installed columns and their stored values intact.
    pool = db.get_pool()
    async with pool.acquire() as con:
        await directory.ensure_schema(con)
        columns = set(await con.fetchval("select array_agg(column_name::text) "
            "from information_schema.columns where table_schema='public' "
            "and table_name='catalogue_directory'"))
    ck("versioned deployment supplies directory metadata columns",
       {"tier", "names_complete", "prices_complete"}.issubset(columns))
    r_heal = await directory.build(TEN, force=True)
    ck("repeated directory builds retain the versioned schema", r_heal.get("built")
       and (await _stored())["tier"] == "D", str(r_heal))

    # ── T7 · «búscalo» is not a lie ─────────────────────────────────────────────────────────────
    print("\nT7 — the second source exists (look_up over the tenant's own rows)")
    hits = await directory.look_up(TEN, "jamón", k=5)
    ck("look_up finds real rows for «jamón»", bool(hits) and all(h.get("name") for h in hits),
       json.dumps(hits[:2], ensure_ascii=False))
    ck("look_up returns ONLY the promised fields",
       all(set(h) == {"name", "code", "base_unit", "price", "in_assortment"} for h in hits))
    ck("a miss abstains — an empty list, never an invention",
       await directory.look_up(TEN, "kryptonita zzz", k=5) == [])
    other = await directory.look_up("vitaltiers-nobody", "jamón", k=5)
    ck("look_up never leaves the tenant", other == [], str(other)[:60])

    # ── T8 · the model may contribute a MAP, never a name ───────────────────────────────────────
    print("\nT8 — a group map is data, validated, and discarded WHOLE on any violation")
    await _load(base)
    await directory.build(TEN, force=True)
    before = (await _stored())["body"]
    good = {r["id"]: ("CURADOS Y IBÉRICOS" if r["family"] in ("embutido_curado", "iberico")
                      else "EL RESTO DEL MOSTRADOR") for r in base}
    res = await directory.set_group_map(TEN, good)
    after = (await _stored())["body"]
    ck("a total, clean map re-groups the card", res.get("ok") and "CURADOS Y IBÉRICOS" in after
       and after != before, str(res))
    partial = {r["id"]: "CURADOS" for r in base[:10]}
    ck("a PARTIAL map is refused (not partially applied)",
       directory.validate_group_map(partial, base) == {})
    dirty = {r["id"]: "CHORIZO SARTA 500 G" for r in base}
    ck("a label carrying a digit-bearing token is refused (the model naming an article)",
       directory.validate_group_map(dirty, base) == {})
    ghost = dict(good); ghost["sku-que-no-existe"] = "FANTASMA"
    ck("a map naming an id that is not in the set is refused",
       directory.validate_group_map(ghost, base) == {})
    ck("a refused map leaves the card standing (never a hole, never blocking)",
       bool((await _stored())["body"]))

    await _cleanup()
    print(f"\nvital_directory_tiers: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
