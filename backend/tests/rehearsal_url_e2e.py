"""rehearsal_url_e2e.py — THE PASTED LINK, ALL THE WAY DOWN, AGAINST A REAL DATABASE.

`vital_demo_url.py` proves the guards with a mocked network. This one proves the PRODUCT: Solobuey's
real 21-page catalogue, fetched over the real internet from the address a director would paste, run
through the one intake road every other door uses — `create_intake` → `run_intake` → `skuparse` →
`get_intake` — and landing as the payload the confirm screen renders.

What it is looking for, in Peter's words: real article names, and `price: null` everywhere, because
that catalogue states a price nowhere and inventing one is the bug this whole pass exists to close.

⚠️ REHEARSAL CLONE ONLY. It writes a tenant, an intake and (with --commit) a catalogue. It refuses
to run against a database called `rocoto`.

Run from a development checkout after the isolated database setup in backend/README.md:
  ROCOTO_EGRESS_SANDBOX=1 PYTHONPATH=backend .venv/bin/python backend/tests/rehearsal_url_e2e.py

DATABASE_URL, RUNTIME_DATABASE_URL and CONTROL_DATABASE_URL must explicitly select the same
rehearsal database. Provider sandbox credentials come from the supplied environment. --commit
also writes the parsed catalogue into that disposable database.
"""
import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rehearsal_config import require_rehearsal  # noqa: E402

require_rehearsal()

import db  # noqa: E402
import urlfetch  # noqa: E402
from brain import onboarding as ob  # noqa: E402

URL = "https://www.solobuey.net/PDF/Catalogos/Catalogo_de_Productos.pdf"
OUT = os.getenv("ROCOTO_E2E_OUT", "/tmp/url_e2e_intake.json")


def guard_clone() -> None:
    require_rehearsal()


async def main() -> int:
    guard_clone()
    slug = f"demo_url_{int(time.time())}"

    print(f"\n① FETCH  {URL}")
    t0 = time.monotonic()
    got = await urlfetch.fetch(URL)
    print(f"   kind={got['kind']}  name={got['filename']}  "
          f"bytes={len(got['data'] or b'')}  in {time.monotonic() - t0:.1f}s")

    print("\n② INTAKE — the same create_intake the file door and the paste door call")
    await db.init()
    await ob.ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants (slug, name, status, seeded) values ($1,$2,'test',true) "
            "on conflict (slug) do nothing", slug, "Solobuey (rehearsal)")
    res = await ob.create_intake(slug, "demo", source_kind=got["kind"],
                                 source_name=got["filename"], raw_bytes=got["data"],
                                 text=got["text"])
    assert res.get("ok"), res
    iid = res["id"]
    print(f"   intake={iid}  tenant={slug}")

    print("\n③ PARSE — pdfium extraction, then the model, batched")
    t0 = time.monotonic()
    await ob.run_intake(iid)
    print(f"   done in {time.monotonic() - t0:.0f}s")

    print("\n④ THE CONFIRM SCREEN'S OWN PAYLOAD")
    out = await ob.get_intake(iid, slug)
    rows = out.get("rows") or []
    priced = [r for r in rows if r.get("price") is not None]
    print(f"   state        : {out.get('state')}")
    print(f"   source_name  : {out.get('source_name')}")
    print(f"   count        : {out.get('count')}")
    print(f"   source_rows  : {out.get('source_rows')}")
    print(f"   rows w/ price: {len(priced)}")
    for w in out.get("warnings") or []:
        print(f"   warning      : [{w.get('code')}] {w.get('detail')}")
    print("   first 12 articles as the table will draw them:")
    for r in rows[:12]:
        print(f"      {str(r.get('n')):>4}  {r.get('name','')[:58]:<58} "
              f"{r.get('unit','')[:12]:<12} {r.get('price')}")
    print("   last 4:")
    for r in rows[-4:]:
        print(f"      {str(r.get('n')):>4}  {r.get('name','')[:58]:<58} "
              f"{r.get('unit','')[:12]:<12} {r.get('price')}")

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, default=str)
    print(f"\n   payload written to {OUT} ({os.path.getsize(OUT)} bytes)")

    ok = (out.get("state") == "ready" and (out.get("count") or 0) > 100 and not priced
          and any(w.get("code") == "no_price" for w in out.get("warnings") or []))

    if "--commit" in sys.argv and out.get("state") == "ready":
        print("\n⑤ COMMIT — golive.seed_catalogue, the ONE writer")
        done = await ob.commit_intake(iid, slug, carry_over=[], override_guard=False)
        async with db.get_pool().acquire() as con:
            n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", slug)
            npx = await con.fetchval(
                "select count(*) from catalogue_skus where tenant_id=$1 and price is not null", slug)
        # `catalogue_skus` is SMALLER than `count` by exactly the duplicates golive merges
        # (last-row-wins) — the `merged` warning names them, so this is the expected shape, not a
        # loss. What must hold is that the commit landed and that no price was invented on the way.
        merged = next((w for w in (out.get("warnings") or []) if w.get("code") == "merged"), {})
        print(f"   commit ok={done.get('ok')}  catalogue_skus={n}  of which priced={npx}  "
              f"(merged duplicates: {merged.get('n', 0)})")
        ok = ok and bool(done.get("ok")) and n > 100 and npx == 0

    print("\n" + ("END TO END: GREEN — real articles, every price left for the operator"
                  if ok else "END TO END: LOOK AT IT — the shape is not what was expected"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
