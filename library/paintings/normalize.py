#!/usr/bin/env python3
"""THE BOUNDING-BOX RULE (Peter, 2026-08-24).

«The only thing: if they are all in a certain bounding box, it gives control over their
size — chips and things.»

No asset ships at whatever size Ideogram happened to paint it. Every raw painting is trimmed
to its own content and re-placed inside one fixed box, so the whole set carries the same
visual weight at any size — a chip, a row icon, a card.

  1  READ THE GROUND, don't assume it. Ideogram's "pure white" comes back a warm cream —
     (250, 251, 246) is typical, and the blue channel dips to 239. A fixed near-white
     threshold reads that ground as ink and trims nothing, so the box is measured from the
     border ring and the image is lifted until the ground IS 255.
  2  ink = distance from white above TOL, counted per row and per column, and a row only
     counts as ink once MIN_RUN pixels agree — one stray dark pixel in the ground can
     otherwise drag the box to the frame edge. Ink that stands alone is paper: connected
     marks under MIN_BLOB are ignored, because a fleck the size of a full stop passes both
     the neighbour test and MIN_RUN and then measures the frame instead of the painting.
  3  scale so the LONGEST side of that box is BOX_RATIO of the canvas
  4  paste centred on a fresh pure-white square, export at CANVAS px

The shadow stays inside the box on purpose. It is part of the painting's weight; excluding it
would float every subject a few pixels high and the set would read misaligned in a list.

  normalize.py            all raw/ -> set/
  normalize.py SLUG...    just those
  normalize.py --report   trim ratios worst-first. 1.00 means nothing was trimmed — a grey
                          ground, a full-bleed miss, or a subject that really does bleed.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

H = Path(__file__).resolve().parent
RAW, SET = H / "raw", H / "set"

CANVAS = 1024
BOX_RATIO = 0.75      # the founder's «about three quarters»
RING = 10             # px of border sampled to learn the ground colour
TOL = 9               # a pixel this far below white (after the lift) is ink
MIN_RUN = 4           # px of ink needed before a row/column counts — kills speckle
MIN_NEIGHBOURS = 3    # ink neighbours a pixel needs to be real ink and not paper speckle
MIN_BLOB = 32         # px of connected ink below which a mark is a fleck of paper, not subject
PAD_GUARD = 3         # px of slack, so an antenna tip or a tail fin is never shaved
NOISE_CAP = 28        # the measured ground floor can be poisoned by a subject that
                      # touches the frame; above this it is ink, not paper


def lift_to_white(a: np.ndarray):
    """learn the ground from the border ring and scale each channel until it is 255"""
    ring = np.concatenate([
        a[:RING].reshape(-1, 3), a[-RING:].reshape(-1, 3),
        a[:, :RING].reshape(-1, 3), a[:, -RING:].reshape(-1, 3),
    ])
    # the ground is the bright mode of the ring; the median would be dragged down by a
    # subject that touches the frame, so take a high percentile instead
    ground = np.percentile(ring, 75, axis=0)
    ground = np.clip(ground, 200, 255)
    lifted = a.astype(np.float32) * (255.0 / ground)
    return np.clip(lifted, 0, 255), ground


def denoise(ink: np.ndarray):
    """drop isolated specks, keep continuous thin lines.

    A prawn's antenna is one or two pixels wide and must survive — it is the whole point of
    the bounding box being honest. But a dozen stray dark specks in the paper texture, one of
    them near a corner, will drag the box to the frame edge and the trim measures nothing.
    A pixel is kept only if it has at least MIN_NEIGHBOURS ink neighbours: a speck has none,
    a point on a continuous stroke has two or more.
    """
    p = np.pad(ink, 1)
    n = sum(
        p[1 + dy: 1 + dy + ink.shape[0], 1 + dx: 1 + dx + ink.shape[1]]
        for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx)
    )
    return ink & (n >= MIN_NEIGHBOURS)


def solid(ink: np.ndarray):
    """drop ink that stands ALONE — a fleck of paper is not a subject.

    `denoise` asks each pixel about its eight neighbours, so it kills a single speck and keeps a
    stroke. It cannot see a fleck the size of a full stop: five or six pixels agreeing with each
    other pass the neighbour test, and four of them landing in one row pass MIN_RUN too. Then the
    box measures the flecks instead of the painting.

    THE MEASUREMENT THAT WROTE THE RULE was a `patata-monalisa` render that no longer exists here
    (E197.25, replaced in E197.26). It came back on a grainy paper carrying 130 dark flecks of 21 px
    and under, scattered to every corner; the trim read 982 x 989 — the whole frame — so the potato
    would have shipped at four fifths of the weight every other tile carries, which is the exact
    thing the bounding-box law exists to hold. Ignoring connected ink under MIN_BLOB, that same
    painting measured 830 x 356: the tuber and its shadow.

    IT KEEPS WHAT A SUBJECT IS MADE OF. The frozen prawn is the tile that tests it: its ice flakes
    sit apart from the shell as their own islands of 33 to 352 px — thirteen of them — and every one
    is kept. The floor is a judgement about SIZE, so a subject that genuinely is a scatter of grains
    wants its box looked at by a person.

    AND WHAT IT DROPS AT THE EDGE IT ALSO CROPS. The crop is the measured box plus PAD_GUARD, so a
    fleck the rule ignores OUTSIDE the box is not merely unmeasured — it is cut off the tile. Same
    prawn, measured: two specks of 31 px and 20 px lie past the ice, the box goes 812 x 386 -> 791 x
    386, and the 20 px one (x 937-942, against a right crop edge at 924) leaves the picture. At the
    placed size that speck is four pixels of ice and nobody will miss it; the sentence is here so
    that the day it matters, somebody looks at the box before blaming the render.

    AND 118 TILES OF THE 794 WOULD TIGHTEN UNDER IT — 29 by more than 5%, 6 by more than 20%, `mora`
    by 1.55x (longest side over longest side). They carry the same defect the old potato did and they
    are NOT re-normalized here: a painting joins this library after a person has looked at it beside
    its siblings, and 118 of those is its own round. The measurement is in notes/PAINTINGS-TRACKER.md
    so the round can be planned rather than discovered. Until then this rule reaches the tiles
    somebody normalizes from now on.

    Eight-connected components, in numpy alone — this package's tools import numpy and Pillow and
    nothing else, and a labelling that costs forty lines does not earn a new dependency.
    """
    height = ink.shape[0]
    parent: list[int] = []
    size: list[int] = []

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    labels = np.full(ink.shape, -1, dtype=np.int32)
    previous: list[tuple[int, int, int]] = []
    for y in range(height):
        padded = np.concatenate(([False], ink[y], [False]))
        edges = np.flatnonzero(padded[1:] != padded[:-1])
        current = []
        for start, end in zip(edges[0::2], edges[1::2]):
            label = len(parent)
            parent.append(label)
            size.append(int(end - start))
            labels[y, start:end] = label
            # touching diagonally is touching, which is what «8-connected» means
            for before_start, before_end, before_label in previous:
                if before_start - 1 < end and start - 1 < before_end:
                    union(label, before_label)
            current.append((int(start), int(end), label))
        previous = current

    if not parent:
        return ink
    roots = np.array([find(label) for label in range(len(parent))], dtype=np.int64)
    area = np.bincount(roots, weights=np.array(size, dtype=np.float64), minlength=len(parent))
    big = area[roots] >= MIN_BLOB
    keep = np.zeros(ink.shape, dtype=bool)
    drawn = labels >= 0
    keep[drawn] = big[labels[drawn]]
    return keep


def ground_noise(dist: np.ndarray):
    """how far the GROUND ITSELF strays from white.

    Several of these paintings come back on a visibly textured paper rather than a flat
    white — the ground wanders a few levels either way. A fixed tolerance reads that texture
    as ink, the trim finds nothing, and the asset ships as a small subject marooned on a grey
    square. So the tolerance is measured from the border ring rather than assumed.

    AND IT IS CAPPED, because a measured floor can be poisoned. `curados` came back a good
    painting of a ham on a hook whose BEAM ran off the top edge. Real ink sitting in the border
    ring dragged the 99.5th percentile to near-black, every pixel then read as ground, and the
    normalizer wrote a blank tile over a painting that was fine — silently, because a trim that
    finds nothing looks exactly like a trim that had nothing to do. Two guards now: measure the
    floor at the 98th percentile (a texture is everywhere in the ring, a subject's edge is not),
    and never let it exceed NOISE_CAP, which is far above any paper texture and far below any
    subject. `normalize()` also refuses to write a tile that came out empty.
    """
    ring = np.concatenate([
        dist[:RING].ravel(), dist[-RING:].ravel(),
        dist[:, :RING].ravel(), dist[:, -RING:].ravel(),
    ])
    return min(float(np.percentile(ring, 98)), NOISE_CAP)


def ink_box(lifted: np.ndarray):
    """bbox of everything meaningfully darker or more saturated than the white ground"""
    dist = 255.0 - lifted.min(axis=2)          # how far the darkest channel falls from white
    tol = max(TOL, ground_noise(dist) + 5.0)
    ink = dist > tol
    ink = solid(denoise(ink))
    cols = ink.sum(axis=0)
    rows = ink.sum(axis=1)
    xs = np.flatnonzero(cols >= MIN_RUN)
    ys = np.flatnonzero(rows >= MIN_RUN)
    if xs.size == 0 or ys.size == 0:
        return None, tol
    return (int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1), tol


def normalize(slug: str, write=True):
    im = Image.open(RAW / f"{slug}.webp").convert("RGB")
    a = np.asarray(im).astype(np.float32)
    lifted, ground = lift_to_white(a)
    box, tol = ink_box(lifted)
    if box is None:
        return slug, None, "BLANK — no ink found"

    # SNAP THE GROUND TO PURE WHITE. Trimming alone leaves the paper texture that survived
    # inside the box, and against the app's white that reads as a grey tile edge. Anything
    # within the measured noise floor becomes 255, so every asset sits on the same ground.
    dist = 255.0 - lifted.min(axis=2)
    flat = dist <= tol
    lifted = lifted.copy()
    lifted[flat] = 255.0

    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - PAD_GUARD), max(0, y0 - PAD_GUARD)
    x1, y1 = min(im.width, x1 + PAD_GUARD), min(im.height, y1 + PAD_GUARD)
    cw, ch = x1 - x0, y1 - y0
    ratio = max(cw / im.width, ch / im.height)

    src = Image.fromarray(lifted.astype(np.uint8), "RGB").crop((x0, y0, x1, y1))
    target = int(CANVAS * BOX_RATIO)
    scale = target / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    src = src.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    canvas.paste(src, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))

    # A TILE THAT CAME OUT EMPTY IS NEVER WRITTEN. The failure this catches is not «the model
    # painted nothing» — it is «the trim measured nothing and wrote white over a good painting».
    covered = float((np.asarray(canvas).min(axis=2) < 245).mean())
    if covered < 0.02:
        return slug, ratio, f"EMPTY after trim — only {covered:.3%} ink, raw kept"
    if write:
        SET.mkdir(exist_ok=True)
        canvas.save(SET / f"{slug}.webp", "WEBP", quality=92, method=6)
    return slug, ratio, None


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    report = "--report" in sys.argv
    slugs = args or sorted(p.stem for p in RAW.glob("*.webp"))
    rows, bad = [], []
    for s in slugs:
        try:
            slug, ratio, err = normalize(s, write=not report)
        except Exception as e:
            bad.append((s, repr(e)))
            continue
        (bad if err else rows).append((s, err) if err else (ratio, slug))
    rows.sort(reverse=True)
    if report:
        print(f"{'trim ratio':>11}  slug")
        for r, s in rows:
            print(f"{r:>11.3f}  {s}")
    print(f"\n{'measured' if report else 'normalized'} {len(rows)} -> {SET}")
    for s, e in bad:
        print(f"  BAD {s}: {e}")
