#!/usr/bin/env python3
"""THE RESOLVER EXAM — run the app's real `paintingFor` against names it will actually be asked.

A GATE THAT CANNOT GO RED IS NOT A GATE, so this one runs the SHIPPED function rather than a
Python restatement of it: painting-map.ts is generated, so its type annotations are known and
stripped mechanically, and the result is imported into node. If the generator changes shape the
strip fails loudly instead of quietly testing nothing.

It has already gone red twice on real defects, which is the only evidence that it works:
  · «Manzana starking argentina» came back a GRANNY SMITH. The kind rung ties every variety and
    then picked the longest NAME, so a query with no painted variety got a green apple for a red
    one. Fixed by preferring the kind-level row, and the plainest name where the kind exists only
    as its varieties.
  · «Marisco» came back the commissioned COMBINATION painted for one two-shelf supplier. A
    commission is addressed by slug from the card it was made for and must never be reachable by
    resolving a word; it now carries `combo: 1` and sits outside the search.

  python3 exam_map.py          -> run it; exits non-zero on any miss
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

H = Path(__file__).resolve().parent
MAP = H.parents[1] / "app" / "src" / "prototypes" / "cedar" / "painting-map.ts"

# name asked -> painting expected. `None` means «no painting, keep the line icon», which is a
# real answer and has to be examined too: a resolver that always finds something is a resolver
# that will dress a tin of chickpeas as a cow.
CASES = [
    ("Merluza", "merluza"),
    ("MERLUZA DE PINCHO FRESCA", "merluza"),          # a sort resolves onto its kind
    ("Pechuga de pavo asada", "pechuga-de-pavo"),      # longest match beats array order
    ("Carne picada de ternera", "carne-picada-de-ternera"),
    ("Tomate raf", "tomate-raf"),                      # a look-distinct L2 keeps its own face
    ("Pescado y marisco", "pescado-y-marisco"),        # the family face, by its own name
    ("Pescado blanco", "pescado-blanco"),
    ("Cefalópodos", "cefalopodos"),
    ("Pescado de crianza", "pescado-de-crianza"),
    ("Vacuno", "vacuno"),
    ("Aves", "aves"),
    ("Queso manchego curado", "queso-manchego"),
    ("Zzzz producto que no existe", None),
]

STRIP = [
    (r"const fold = \(s: string\): string =>", "const fold = (s) =>"),
    (r"const visualKey = \(v: string\) =>", "const visualKey = (v) =>"),
    (r"const said = \(key: string, n: string\): boolean =>", "const said = (key, n) =>"),
    (r"const spread = \(p: Painting\): number =>", "const spread = (p) =>"),
    (r"const fragmentOf = \(key: string, written: string\): boolean =>", "const fragmentOf = (key, written) =>"),
    (r"const edge = \(character: string \| undefined\) =>", "const edge = (character) =>"),
    (r"\(hits: Painting\[\]\): Painting \| undefined =>", "(hits) =>"),
    (r"\(fn: \(set: Painting\[\]\) => Painting \| undefined\): Painting \| undefined =>", "(fn) =>"),
    (r"const SUPPRESSED_PAINTINGS = new Set<string>\(", "const SUPPRESSED_PAINTINGS = new Set("),
    (r"const KIND_STANDS_FOR = new Map<string, string>\(", "const KIND_STANDS_FOR = new Map("),
    (r"const CURATED_EXACT_SKU_ALIASES = new Map<string, string>\(", "const CURATED_EXACT_SKU_ALIASES = new Map("),
    (r"const PAINTING_ALIASES: Array<\[string, string\]> = \[", "const PAINTING_ALIASES = ["),
    (r"\] as Array<\[string, string\]>\)\)", "]))"),
    (r"export function suppressedPaintingFor\(name: string\): string \| null \{",
     "export function suppressedPaintingFor(name) {"),
    (r"export function paintingFor\(name: string\): string \| null \{", "export function paintingFor(name) {"),
    (r"export function exactPaintingFor\(name: string\): string \| null \{",
     "export function exactPaintingFor(name) {"),
]


def as_js():
    src = MAP.read_text(encoding="utf-8")
    marker = "export const PAINTINGS: Painting[] = ["
    if marker not in src:
        raise SystemExit(f"EXAM CANNOT RUN: {MAP.name} no longer starts its array with {marker!r}")
    body = "export const PAINTINGS = [" + src.split(marker, 1)[1]
    for pat, rep in STRIP:
        body, n = re.subn(pat, rep, body)
        if not n:
            raise SystemExit(f"EXAM CANNOT RUN: type annotation {pat!r} not found — the generator "
                             f"changed shape and the strip would silently test nothing")
    if re.search(r":\s*(Painting|string|number)\b", body):
        raise SystemExit("EXAM CANNOT RUN: type annotations survived the strip")
    return body


def main():
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / "pm.mjs").write_text(as_js(), encoding="utf-8")
        (d / "exam.mjs").write_text(
            "import { paintingFor, PAINTINGS } from './pm.mjs';\n"
            f"const cases = {json.dumps(CASES)};\n"
            "const out = cases.map(([q, want]) => [q, paintingFor(q), "
            "want === null ? null : `/paintings/${want}.webp`]);\n"
            "console.log(JSON.stringify({ rows: PAINTINGS.length, out }));\n",
            encoding="utf-8")
        r = subprocess.run([("node"), str(d / "exam.mjs")], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"EXAM CANNOT RUN: node failed\n{r.stderr}")
    res = json.loads(r.stdout)
    bad = 0
    for q, got, want in res["out"]:
        ok = got == want
        bad += not ok
        print(f"{'ok  ' if ok else 'FAIL'}  {q}  ->  {got}" + ("" if ok else f"   (wanted {want})"))
    print(f"\n{res['rows']} rows · {len(CASES) - bad}/{len(CASES)} pass")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
