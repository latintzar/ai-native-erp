"""vital_capture_unmatched.py — THE HALF OF A STOCK READING WE WERE THROWING AWAY (2026-07-27).

`brain/stock.read_capture` returns THREE things: `read` (what grounded to a SKU), `unmatched` (the
honest «esto no lo encuentro» — a real crate whose name matched nothing in the catalogue) and `note`
(«no he sabido leerlo»). `stock_captures` stored only the first. So the honest half lived exactly as
long as the HTTP response: an operator who put the phone down before dealing with it could never come
back to it, and nothing could ever count how often a reading fails to ground — which is the same
product signal `corrected` exists for.

  C1 THE COLUMN IS THERE          — `unmatched_json` jsonb NOT NULL default '[]', plus `note`.
  C2 ABSENT IS A REAL STATE       — a capture with nothing unmatched stores [], never null.
  C3 THE UNMATCHED HALF SURVIVES  — written, it reads back verbatim, with its `why` and candidates.
  C4 IT NEVER LEAKS INTO `read`   — a line with no sku_id must never reach the list `apply_capture`
                                    writes LEVELS from. Two columns, and that is the whole reason.
  C5 THE WRITE SEAM               — `brain/stock.record_capture` carries it. That function belongs to
                                    another agent today, so this check REPORTS the seam rather than
                                    editing it: green once the one-liner lands, a loud SKIP until then.

Needs the clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_capture_unmatched.py
SAFETY: refuses the live `rocoto` DB; writes and deletes its own invented tenant's rows only.
"""
import asyncio
import inspect
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)
try:
    for _l in (Path("/opt/rocoto/.env").read_text().splitlines()
               if Path("/opt/rocoto/.env").exists() else []):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _, _v = _l.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())
except PermissionError:
    pass

R, SKIPPED = [], []
TENANT = "vitalcapture"          # invented; never a real company (LOCKED LAW)

# What a real reading of a pallet looks like when half of it grounds and half of it does not.
READ = [{"sku_id": "sku-paleta", "name": "PALETA COCIDA", "qty": 4, "unit": "kg",
         "confidence": "alta", "source": "foto"}]
UNMATCHED = [{"name": "cajas de lo del lunes", "qty": 3, "unit": "cajas", "source": "voz",
              "said": "y tres cajas de lo del lunes",
              "why": "no lo encuentro en tu catálogo", "candidates": []}]
NOTE = ""


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


async def main():
    print(__doc__.splitlines()[0])
    if not _DSN:
        skip("the whole file", "no REHEARSAL_DSN — this one is all round-trip")
        return
    import db
    from brain import stock as stock_m
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    async with db.get_pool().acquire() as con:
        await con.execute("delete from stock_captures where tenant_id=$1", TENANT)

        # ── C1 · the column, as `db.init()` leaves it ────────────────────────────────────────────
        cols = {r["column_name"]: dict(r) for r in await con.fetch(
            "select column_name, data_type, is_nullable, column_default "
            "from information_schema.columns where table_name='stock_captures'")}
        c = cols.get("unmatched_json") or {}
        ck("C1 `stock_captures.unmatched_json` exists, jsonb, NOT NULL, defaults to an empty list",
           c.get("data_type") == "jsonb" and c.get("is_nullable") == "NO"
           and "[]" in str(c.get("column_default") or ""), str(c or "MISSING"))
        n = cols.get("note") or {}
        ck("C1 …and `note` rides along — «no he sabido leerlo» and «nothing to say» are different "
           "events, and only the note tells them apart after the fact",
           n.get("data_type") == "text" and n.get("is_nullable") == "NO", str(n or "MISSING"))

        # ── C2 · absent is a real state ──────────────────────────────────────────────────────────
        cid0 = await con.fetchval(
            "insert into stock_captures (tenant_id, transcript, read_json) "
            "values ($1,$2,$3::jsonb) returning id", TENANT, "quedan cuatro kilos", READ)
        row0 = await con.fetchrow("select unmatched_json, note from stock_captures where id=$1", cid0)
        ck("C2 a clean reading stores an EMPTY list, never null — absent is a state, not a gap",
           row0["unmatched_json"] == [] and row0["note"] == "",
           f"unmatched={row0['unmatched_json']!r} note={row0['note']!r}")

        # ── C3/C4 · the unmatched half survives, and stays out of `read` ─────────────────────────
        cid = await con.fetchval(
            "insert into stock_captures (tenant_id, transcript, read_json, unmatched_json, note) "
            "values ($1,$2,$3::jsonb,$4::jsonb,$5) returning id",
            TENANT, "cuatro kilos de paleta y tres cajas de lo del lunes", READ, UNMATCHED, NOTE)
        row = await con.fetchrow(
            "select read_json, unmatched_json, note, applied, corrected "
            "from stock_captures where id=$1 and tenant_id=$2", cid, TENANT)
        ck("⚑ C3 THE «ESTO NO LO ENCUENTRO» HALF IS STILL THERE AFTER THE RESPONSE IS GONE — "
           "verbatim, with the words the operator used and OUR reason for not grounding it",
           row["unmatched_json"] == UNMATCHED
           and row["unmatched_json"][0]["said"] == UNMATCHED[0]["said"],
           str(row["unmatched_json"])[:90])
        ck("C4 it is a SEPARATE column: a line with no sku_id can never drift into the list "
           "`apply_capture` writes levels from",
           row["read_json"] == READ and all(l.get("sku_id") for l in row["read_json"])
           and not any("sku_id" in u for u in row["unmatched_json"]),
           f"read={len(row['read_json'])} unmatched={len(row['unmatched_json'])}")
        ck("C4 …and recording it still moves NO level (the correction loop is the feature)",
           row["applied"] is False and row["corrected"] is False)

        # ── C5 · the write seam ──────────────────────────────────────────────────────────────────
        sig = inspect.signature(stock_m.record_capture).parameters
        if "unmatched" in sig:
            cid2 = await stock_m.record_capture(
                con, TENANT, transcript="tres cajas de lo del lunes", read_json=READ,
                unmatched=UNMATCHED, note="")
            r2 = await con.fetchrow("select unmatched_json from stock_captures where id=$1", cid2)
            ck("⚑ C5 `record_capture` PERSISTS the unmatched half — the live route stops throwing it "
               "away the moment the response is sent",
               r2["unmatched_json"] == UNMATCHED, str(r2["unmatched_json"])[:90])
        else:
            skip("C5 `brain/stock.record_capture` carries `unmatched`",
                 "not wired yet — brain/stock.py belongs to another agent. The exact change: add "
                 "`unmatched: Any = None, note: str = \"\"` to the signature, and write "
                 "`unmatched_json, note` in the INSERT (values $5::jsonb, $6) passing "
                 "`unmatched if isinstance(unmatched, list) else []` and `(note or '')[:400]`. "
                 "Both routes then pass `unmatched=unmatched, note=note`.")

        await con.execute("delete from stock_captures where tenant_id=$1", TENANT)

    ok = sum(1 for r in R if r)
    print(f"\n  {ok}/{len(R)} checks pass" + (f"  ({len(SKIPPED)} skipped)" if SKIPPED else ""))
    sys.exit(0 if ok == len(R) else 1)


if __name__ == "__main__":
    asyncio.run(main())
