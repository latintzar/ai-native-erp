"""vital_choco.py — §17.49: a Choco link is an order (WP-G5).

Fixture-driven — choco.com is NEVER fetched here. Guards:
  ① link detection (and non-links stay untouched);
  ② the structured ladder reads a __NEXT_DATA__ cart into lines, deduped;
  ③ enrich_row persists transcript + choco_tried ONCE (a second call is a no-op — no refetch
     loops on dead links);
  ④ the transcript reads like the customer's own words (what _combine hands the pipeline);
  ⑤ a page with no lines writes NO transcript, marks tried, invents NOTHING.

SAFETY: refuses the live `rocoto` DB.
"""
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

for _l in (Path("/opt/rocoto/.env").read_text().splitlines()
           if Path("/opt/rocoto/.env").exists() else []):
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

import db  # noqa: E402
from brain import (
    choco,  # noqa: E402
    pipeline,  # noqa: E402
)

R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


FIXTURE = """<html><head>
<script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"cart":{"items":[
  {"productName":"Alitas de pollo","quantity":6,"unit":"kg"},
  {"productName":"Chorizo sarta extra","quantity":4,"unit":"kg"},
  {"productName":"Alitas de pollo","quantity":6,"unit":"kg"}
]}}}}
</script></head><body>compra</body></html>"""

EMPTY_PAGE = "<html><body><p>Página no encontrada</p></body></html>"


async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run against the LIVE 'rocoto' DB")
    print(f"  (db={dbname})")

    # ① detection
    ck("detects an m.choco.com link",
       choco.find_link("mira https://m.choco.com/c/AbC123 porfa") == "https://m.choco.com/c/AbC123")
    ck("a plain order text has no link", choco.find_link("6 kg de alitas") is None)

    # ② the structured ladder
    lines = choco.extract_structured(FIXTURE)
    ck("reads the __NEXT_DATA__ cart, deduped", len(lines) == 2
       and lines[0]["name"] == "Alitas de pollo" and lines[0]["qty"] == 6.0,
       f"lines={lines}")

    # ③④ enrich persists ONCE, transcript in the customer's shape
    mid = f"vitalchoco-{uuid.uuid4().hex[:10]}"
    phone = "+34600999777"
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, message_type, seeded) "
            "values ($1,$2,'user','pide esto https://m.choco.com/c/VitalX','text',true)", mid, phone)
        row = dict(await con.fetchrow("select * from whatsapp_messages where id=$1", mid))
    landed = await choco.enrich_row(row, html=FIXTURE)
    async with db.get_pool().acquire() as con:
        r2 = dict(await con.fetchrow("select * from whatsapp_messages where id=$1", mid))
    meta = r2["transcript_meta"] if isinstance(r2["transcript_meta"], dict) else json.loads(r2["transcript_meta"] or "{}")
    ck("enrich lands the transcript", landed and (r2["transcript"] or "").startswith("Pedido del enlace Choco"),
       (r2["transcript"] or "")[:60])
    ck("both lines transcribed as the customer's words",
       "6 kg Alitas de pollo" in r2["transcript"] and "4 kg Chorizo sarta extra" in r2["transcript"])
    ck("choco_tried marked", meta.get("choco_tried") is True and meta.get("choco_lines") == 2)
    again = await choco.enrich_row(r2, html=FIXTURE)
    ck("a second pass is a no-op (no refetch loops)", again is False)
    combined, _ = pipeline._combine([r2])
    ck("_combine hands the pipeline the LINES, not the url",
       "Alitas de pollo" in combined and "pide esto" not in combined)

    # ⑤ a lineless page invents nothing
    mid2 = f"vitalchoco-{uuid.uuid4().hex[:10]}"
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, message_type, seeded) "
            "values ($1,$2,'user','https://m.choco.com/c/Dead','text',true)", mid2, phone)
        row2 = dict(await con.fetchrow("select * from whatsapp_messages where id=$1", mid2))
    # force the deterministic-only path: an empty page with no ANTHROPIC key path would still
    # try the LLM — inject a page whose visible text is too short for rung ② to even fire
    landed2 = await choco.enrich_row(row2, html=EMPTY_PAGE[:60])
    async with db.get_pool().acquire() as con:
        r3 = dict(await con.fetchrow("select * from whatsapp_messages where id=$1", mid2))
    meta3 = r3["transcript_meta"] if isinstance(r3["transcript_meta"], dict) else json.loads(r3["transcript_meta"] or "{}")
    ck("a lineless page → NO transcript, tried marked, nothing invented",
       (not landed2) and r3["transcript"] is None and meta3.get("choco_tried") is True)

    async with db.get_pool().acquire() as con:
        await con.execute("delete from whatsapp_messages where id in ($1,$2)", mid, mid2)

    n = sum(R)
    print(f"\nvital_choco: {n}/{len(R)} {'PASS' if n == len(R) else 'FAIL'}")
    if n != len(R):
        raise SystemExit(1)


asyncio.run(main())
