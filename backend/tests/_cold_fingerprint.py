import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

for l in Path("/opt/rocoto/.env").read_text().splitlines():
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, _, v = l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import config
import db
from brain import golive, vocab

COLD = sys.argv[1] if len(sys.argv) > 1 else "embutidos_tosilos_s_l_1014"
SEED = config.BRAIN_TENANT


async def fingerprint(con, t):
    rows = await con.fetch(
        "select id, code, name, base_unit, price::text, in_assortment, seeded, "
        "md5(embedding::text) e from catalogue_skus where tenant_id=$1 order by id", t)
    al = await con.fetch(
        "select alias, sku_id, source, weight, coalesce(phone_number,'') p "
        "from sku_aliases where tenant_id=$1 order by alias, sku_id, source", t)
    dirr = await con.fetchval(
        "select md5(coalesce(body,'')||coalesce(alias_map::text,'')) "
        "from catalogue_directory where tenant_id=$1", t)
    blob = ("|".join(map(str, [tuple(r) for r in rows])) + "##" +
            "|".join(map(str, [tuple(r) for r in al])) + "##" + str(dirr))
    return {"skus": len(rows), "aliases": len(al), "dir": (dirr or "")[:8],
            "sha": hashlib.sha256(blob.encode()).hexdigest()[:24]}


async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        before = await fingerprint(con, SEED)
    print("SEEDED WORLD BEFORE :", json.dumps(before))
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select code, name, family, attrs->>'unit_raw' u, price::float8 p "
            "from catalogue_skus where tenant_id=$1", COLD)
    if not rows:
        print("!! cold tenant has no rows — nothing to write"); return
    skus = [{"code": r["code"], "name": r["name"], "family": r["family"],
             "unit": r["u"], "price": r["p"]} for r in rows]
    res = await golive.seed_catalogue(COLD, skus)
    print("cold re-seed        :", json.dumps({k: res.get(k) for k in
                                               ("ok", "skus", "embedded", "unchanged", "removed")}))
    g = await vocab.generate(COLD)
    print("cold vocab.generate :", json.dumps({k: g.get(k) for k in
                                               ("ok", "pending", "generated", "reason")}))
    async with db.get_pool().acquire() as con:
        after = await fingerprint(con, SEED)
        cold_fp = await fingerprint(con, COLD)
    print("SEEDED WORLD AFTER  :", json.dumps(after))
    print("COLD TENANT         :", json.dumps(cold_fp))
    print("VERDICT             :",
          "SEEDED WORLD BYTE-IDENTICAL ACROSS A FULL COLD-TENANT WRITE CYCLE"
          if before == after else "!! SEEDED WORLD CHANGED !!  before=%s after=%s" % (before, after))

asyncio.run(main())
