#!/usr/bin/env python3
"""GENERATE app/painting-map.ts from the manifest — the painted library's face in the app.

The manifest is the record of what was MADE; painting-map.ts is what the app can resolve onto.
Only rows with a normalized tile in set/ are emitted, so a slug that is queued, failed or
recorded as a defect can never ship a broken image reference.

TWO KINDS OF ROW, AND THE ORDER MATTERS. A product row is a thing on a bench. A CATEGORY row is
the big face for a whole shelf — «Carne», «Fruta», «Queso» — and those names are short words that
sit inside hundreds of product names. Left in one flat list they would win by accident: «Carne
picada de ternera» contains «carne», and a cow in a pasture is not a tray of mince. So the flag
rides into the map and `paintingFor` consults product rows first at every rung, reaching the
category faces only when nothing more specific matched. That is also what the supplier-forwarding
picker wants: it asks with the node's own name, which IS the category name, and gets the face.
"""
import argparse
import json
import re
from pathlib import Path

H = Path(__file__).resolve().parent
OUT = H.parents[1] / "app" / "src" / "prototypes" / "cedar" / "painting-map.ts"

HEAD = '''/* GENERATED FILE — do not hand-edit. Rebuild with `python3 library/paintings/build_map.py`.
 *
 * THE PAINTED LIBRARY'S FACE IN THE APP (THE-DENSE-BRIEF §B/§C). Generated from
 * library/paintings/manifest.json — the ladder-labeled set the pipeline produced, filtered to the
 * slugs that actually have a normalized tile in library/paintings/set/.
 *
 * `paintingFor(name)` resolves a product's WORD to a painting the way the router resolves words
 * to nodes: exact name, then the look-distinct sort (L2), then the kind (L1). A miss returns
 * null and the caller keeps its line icon — the painting is a face, never a requirement.
 *
 * `cat: 1` marks a CATEGORY FACE (§35.8) — the creature or the shelf that stands for a whole
 * category. Those names are short and would otherwise win inside longer product names by
 * accident, so every rung tries product rows first and falls back to the faces.
 */
export type Painting = {
  slug: string;
  es: string;
  l1: string;
  l2: string;
  l3: string;
  /** a category face, consulted only when no product row matched */
  cat?: 1;
  /** a commissioned COMBINATION (§35.8) — addressed by slug from the partner card it was
   *  commissioned for, never reached by resolving a product's word. */
  combo?: 1;
};

export const PAINTINGS: Painting[] = [
'''

TAIL = '''];

const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

const PRODUCTS = PAINTINGS.filter((p) => !p.cat && !p.combo);
const FACES = PAINTINGS.filter((p) => p.cat && !p.combo);

export function paintingFor(name: string): string | null {
  const n = fold(name);
  /* LONGEST MATCH WINS at every rung (the never-surprised exam caught «PECHUGA DE PAVO
     ASADA» wearing the whole-turkey painting because first-in-array beat the longer
     «pechuga de pavo» — array order is not a matching rule). */
  const longest = (hits: Painting[]): Painting | undefined =>
    hits.sort((a, b) => fold(b.es).length - fold(a.es).length)[0];

  /* A PRODUCT ALWAYS OUTRANKS A SHELF at the same rung. «Carne picada de ternera» contains
     «carne», and the beef category's face is a cow in a pasture — a real answer for the shelf
     and a wrong one for a tray of mince. */
  const rung = (fn: (set: Painting[]) => Painting | undefined): Painting | undefined =>
    fn(PRODUCTS) ?? fn(FACES);

  /* THE LAST RUNG IS THE KIND, SO IT ANSWERS WITH THE KIND. Falling back on l1 alone, every
     variety of that kind ties, and `longest` then hands back the most specific NAME — «Manzana
     starking argentina» was answered with a granny smith, which is a green apple for a red one.
     A kind-level row (no l2) wins outright; where the kind exists only as its varieties, the
     plainest name is the least wrong stand-in. */
  const kindly = (hits: Painting[]): Painting | undefined => {
    const plain = hits.filter((p) => !p.l2);
    return (plain.length ? plain : hits).sort(
      (a, b) => fold(a.es).length - fold(b.es).length,
    )[0];
  };

  const hit =
    rung((s) => s.find((p) => fold(p.es) === n)) ??
    rung((s) => longest(s.filter((p) => p.l2 && n.includes(fold(p.l2)) && n.includes(fold(p.l1))))) ??
    rung((s) => longest(s.filter((p) => n.includes(fold(p.es))))) ??
    rung((s) => longest(s.filter((p) => fold(p.es).includes(n) && n.length > 3))) ??
    rung((s) => kindly(s.filter((p) => n.includes(fold(p.l1)))));
  return hit ? `/paintings/${hit.slug}.webp` : null;
}
'''


def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")



OPEN = "export const PAINTINGS: Painting[] = [\n"
CLOSE = "\n];\n"


def rebuild(rows_text: str) -> str:
    """REPLACE THE ROWS, KEEP EVERYTHING ELSE — the file's own header says so.

    `painting-map.ts` is generated ABOVE the fold and REVIEWED below it. The rows come from the
    manifest; `paintingFor`, `PAINTING_ALIASES`, `CURATED_EXACT_SKU_ALIASES`, `KIND_STANDS_FOR`,
    `SUPPRESSED_PAINTINGS` and `exactPaintingFor` are Product Sheet evidence somebody wrote and
    reviewed (THE-PRODUCT-SHEET-SPEC §16.1.8). Regenerating the WHOLE file from a template in this script would delete them — and
    every SKU whose tenant name reaches its painting through a curated alias would quietly lose its
    face, which is the exact defect FEED-IA §200.2 exists to close.

    So the generator writes into the existing file between the array's own two markers and leaves
    the rest byte for byte. A fresh checkout with no file yet falls back to the templates below.
    """
    if not OUT.exists():
        return HEAD + rows_text + TAIL
    current = OUT.read_text(encoding="utf-8")
    start = current.find(OPEN)
    if start < 0:
        raise SystemExit(f"build_map: {OUT} holds no PAINTINGS array to rebuild")
    end = current.find(CLOSE, start)
    if end < 0:
        raise SystemExit(f"build_map: {OUT}'s PAINTINGS array has no end")
    return current[: start + len(OPEN)] + rows_text.rstrip("\n") + current[end:]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUT,
                        help="write a review copy; reviewed resolver source always comes from app/src/prototypes/cedar/painting-map.ts")
    args = parser.parse_args()
    m = json.loads((H / "manifest.json").read_text(encoding="utf-8"))
    rows = []
    for slug, e in sorted(m.items()):
        if e.get("defect") or e["status"] not in ("done", "probe"):
            continue
        if not (H / "set" / f"{slug}.webp").exists():
            continue
        rows.append((e["L0_family"], slug, e))

    # family order keeps the file readable; the resolver never depends on array order
    order = {f: i for i, f in enumerate(
        ["fish", "shellfish", "meat", "dairy", "fruit", "vegetable", "herb-fungus",
         "pantry", "category"])}
    rows.sort(key=lambda r: (order.get(r[0], 99), r[2]["priority"], r[1]))

    body = []
    last = None
    for fam, slug, e in rows:
        if fam != last:
            body.append(f"  /* ── {fam} ── */")
            last = fam
        cat = ", cat: 1" if fam == "category" else ""
        if e["L1_kind"].startswith("combo-"):
            cat += ", combo: 1"
        body.append(
            f"  {{ slug: '{slug}', es: '{esc(e['es_name'])}', l1: '{e['L1_kind']}', "
            f"l2: '{e['L2_sort'] or ''}', l3: '{e['L3_form']}'{cat} }},")
    rows_text = "\n".join(body) + "\n"
    args.output.write_text(rebuild(rows_text), encoding="utf-8")
    n_cat = sum(1 for r in rows if r[0] == "category")
    print(f"painting-map.ts: {len(rows)} rows ({n_cat} category faces) -> {args.output}")


if __name__ == "__main__":
    main()
