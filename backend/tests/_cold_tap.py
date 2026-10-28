import asyncio
import json
import os
from pathlib import Path

for l in Path("/opt/rocoto/.env").read_text().splitlines():
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, _, v = l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import db
import runtime
from brain import matcher, pipeline

COLD = "embutidos_tosilos_s_l_1014"
P = "+34655100202"          # the customer who was asked about «solomillo»


async def main():
    await db.init()
    scope = runtime.scope_of(P)
    async with db.scoped_tx(scope) as con:
        row = await con.fetchrow(
            "select payload from event where scope=$1::ltree and type='doubt.asked' "
            "order by id desc limit 1", scope)
    p = row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"])
    print("the question we asked :", p.get("question"))
    print("ask_key (wamid)       :", p.get("ask_key"))
    opts = p.get("options") or []
    for o in opts:
        print("   option:", o.get("title"), "->", o.get("sku_id") or o.get("id"))

    before = await matcher.match("solomillo", tenant=COLD, phone=P)
    print("BEFORE the tap        :", before.band, before.alias_hit,
          (before.pick or {}).get("name"), "n_close=", before.n_close)

    pick = opts[1]      # «DE CERDO FRESCO» — the customer taps the second button
    res = await pipeline.resolve_doubt_tap(P, asked_wamid=p.get("ask_key") or "",
                                           option_id=pick["id"], option_title=pick["title"],
                                           tenant=COLD)
    print("resolve_doubt_tap     :", json.dumps(res, ensure_ascii=False, default=str))

    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select a.alias, a.source, a.weight, a.phone_number, s.name from sku_aliases a "
            "join catalogue_skus s on s.id=a.sku_id "
            "where a.tenant_id=$1 and a.phone_number is not null order by a.alias", COLD)
    for r in rows:
        print(f"   LEARNED «{r['alias']}» ({r['source']}, w={r['weight']}, "
              f"phone={r['phone_number']}) → {r['name']}")

    after = await matcher.match("solomillo", tenant=COLD, phone=P)
    other = await matcher.match("solomillo", tenant=COLD, phone="+34655100999")
    print("AFTER  (this phone)   :", after.band, "alias_hit=", after.alias_hit,
          "→", (after.pick or {}).get("name"))
    print("AFTER  (another phone):", other.band, "alias_hit=", other.alias_hit,
          "→", (other.pick or {}).get("name"))

asyncio.run(main())
