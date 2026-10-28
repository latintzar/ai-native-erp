#!/usr/bin/env python3
"""artwork-gate.py — every product carries artwork, and this is what says so (FEED-IA §200.2).

«Why doesn't one of the shrimps actually have an image for that?» (Peter, 2026-09-04). The answer
was that nothing in the house was watching. A painting is made once and then quietly stops being
found — a tenant renames the SKU, a variation is added, a tile is suppressed after review — and the
row falls back to its drawn family mark without anybody being told. So the house keeps a gate:

    every catalogue PRODUCT and every sellable VARIANT resolves to a painting the app can draw,
    and the file that painting names is on disk.

WHAT IT IS NOT. It is not a style review and it is not a matcher of its own. It reads the SAME
tables the app reads and resolves them through the SAME function the app calls — `exactPaintingFor`,
which is what `ProductFace` (the list row, the albarán line) and `SKUArtwork` (the Product Sheet)
use — by way of `app/tools/artwork-tables.mjs`. A gate that re-implemented the resolution would
pass while the app drew nothing, which is the failure it exists to catch.

THE THREE POPULATIONS, held apart on purpose:

  · PRODUCT   a row in a house's own catalogue (`cast.ts`). Artwork is required.
  · VARIANT   a reviewed sellable member of a family — an amendment carrying `sellable` or `hand`
              (`catalogue.ts`). It is a SKU with its own sheet and its own price, so artwork is
              required exactly as for a product.
  · WORDING   a customer's word that is not a SKU yet — an unreviewed amendment, a learned sort.
              It is reported and never gated: the honest picture of an unadopted word is the
              family's drawn mark, and painting one would claim a subject nobody has reviewed.

RUN, from docs/kit:

    python3 tools/artwork-gate.py            # human report; exit 1 while anything is missing
    python3 tools/artwork-gate.py --json     # the same reading as JSON, for a drive or a build
    python3 tools/artwork-gate.py --all      # include the wording rows in the listing
    python3 tools/artwork-gate.py --no-lock  # for a caller that already holds the build lock

PROVE IT RED BEFORE TRUSTING IT. Comment out a curated alias in `painting-map.ts` (or rename a tile
in `app/public/paintings/`), run the gate, watch it name that row and exit 1, put it back.

THE BUILD LOCK. The transpile step is `tsc`, which is heavy, so the gate takes the lock itself when
`flock` is on the box — nothing here may start a compile beside a build already running. That makes
the ordinary call a BARE one: wrapping the gate in another `flock` on the same file would have it
wait for a lock its own parent is holding. A caller that already holds the lock — `drive-197-artwork.py`,
which reads its expected row count from here and runs under `flock /dev/shm/e193-build.lock` — passes
`--no-lock` and keeps the one lock it took at the top.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASEWEB = ROOT / "app"
PUBLIC = BASEWEB / "public" / "paintings"
SET = ROOT / "library" / "paintings" / "set"
LOCK = "/dev/shm/e193-build.lock"
GATED = ("product", "variant")


def tables(lock: bool = True) -> list[dict]:
    """The catalogue's rows and the painting each one resolves to, read out of the app itself."""
    command = ["node", "tools/artwork-tables.mjs"]
    if lock and shutil.which("flock"):
        command = ["flock", LOCK] + command
    done = subprocess.run(command, cwd=BASEWEB, capture_output=True, text=True)
    if done.returncode != 0:
        sys.stderr.write(done.stderr)
        raise SystemExit(f"artwork-gate: the catalogue tables could not be read ({done.returncode})")
    return json.loads(done.stdout)["rows"]


def faults(row: dict) -> list[str]:
    """Why this row would draw no painting — stated as what is missing, one line each.

    TWO DEBTS, NAMED APART. A row without a painting is either a subject NOBODY HAS PAINTED YET, or
    a subject somebody painted and a reviewer REFUSED. They are fixed by different work — the first
    by the Ideogram road in §16.1, the second by repainting one tile — and reporting both as «no
    painting resolves for this name» sent a session to read the resolver when the fault was in the
    picture. `painting-map.ts` names the held-out tile, so this says which debt it is.
    """
    painting = row.get("exact")
    if not painting:
        held = row.get("suppressed")
        if held:
            return [f"{pathlib.Path(held).name} was painted and refused at review, so this row keeps "
                    f"its drawn mark until the repaint lands"]
        return ["no painting resolves for this name"]
    name = pathlib.Path(painting).name
    out = []
    shipped, source = PUBLIC / name, SET / name
    if not shipped.exists():
        out.append(f"public/paintings/{name} is absent, so the app draws a broken image")
    if not source.exists():
        out.append(f"assets/paintings/set/{name} is absent, so the shipped tile has no source")
    if shipped.exists() and source.exists() and shipped.read_bytes() != source.read_bytes():
        out.append(f"{name} differs between the shipped library and the reviewed set")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--json", action="store_true", help="print the reading as JSON")
    ap.add_argument("--all", action="store_true", help="list the wording rows as well")
    ap.add_argument("--no-lock", action="store_true",
                    help="skip the build lock, for a caller that already holds it")
    args = ap.parse_args()

    rows = tables(lock=not args.no_lock)
    for row in rows:
        row["faults"] = faults(row) if row["kind"] in GATED else []
    missing = [row for row in rows if row["faults"]]
    wording = [row for row in rows if row["kind"] == "wording" and not row.get("exact")]
    counted = {kind: sum(1 for row in rows if row["kind"] == kind) for kind in ("product", "variant", "wording")}

    if args.json:
        print(json.dumps({"rows": rows, "missing": missing, "counts": counted}, ensure_ascii=False, indent=1))
        return 1 if missing else 0

    print(f"artwork-gate · {counted['product']} products · {counted['variant']} sellable variants "
          f"· {counted['wording']} customer wordings")
    for row in missing:
        print(f"  MISSING  {row['sector']:6} {row['kind']:8} {row['id']:20} {row['name']}")
        for fault in row["faults"]:
            print(f"           {fault}")
    if args.all:
        for row in wording:
            print(f"  wording  {row['sector']:6} {'':8} {row['id']:20} {row['name']} "
                  f"— a word waiting to be adopted, drawn with its family's mark")
    if missing:
        print(f"\n{len(missing)} of {counted['product'] + counted['variant']} products and sellable "
              f"variants stand without artwork. §200.2: the house makes it — "
              f"THE-PRODUCT-SHEET-SPEC «Artwork» states the road.")
        return 1
    print(f"\nAll {counted['product'] + counted['variant']} products and sellable variants carry artwork.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
