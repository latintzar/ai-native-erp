# THE QR SPEC — the mark on the packing paper, and reading it back

**Authority:** FEED-IA §196.5 (E193.05) — «the qr code generation and reading is a spec in its own,
but i expect us to handle it all alongside everything else» — standing on §191.1, which fixed what
the mark may contain. **Where the numbers live:** `PACKING_QR` in `app/src/prototypes/cedar/packing-output.ts`,
so the paper that draws the mark and the drive that reads it cannot disagree.

---

## QR-00 · The law the mark exists under

§191.1, verbatim: «Packing sheets carry a machine-readable QR with only an opaque
document/revision/geometry locator. A later paper photo may use that locator to align reviewed
final weights/prices, but the QR holds **no customer, product, quantity, price or lot data** and
does not prove OCR occurred.»

Everything below is downstream of that sentence. The mark is an ADDRESS. A picking sheet blows
around a cold room, gets photographed by a driver, gets left on a crate; a mark that carried the
order would be a customer's prices lying on a pallet.

## QR-01 · The payload

```
rocoto:document/packing/v1/<token>
└──────── scheme ────────┘└ 1–13 chars, [a-z0-9] ┘
```

| Part | Rule |
|---|---|
| Scheme | `rocoto:document/packing/v1/` — **self-describing on purpose.** A generic scanner app in a warehouse shows a person a string they can recognise as ours, and a `rocoto:` scheme is not a URL, so no scanner opens a browser at it. |
| Token | Opaque. **Production:** an unguessable server-issued token bound to the immutable output revision. **Kit:** a deterministic 53-bit fold of the run's own revisions, base-36 — so the same preview keeps the same mark across reloads without pretending a server issued it. |
| Length | 27 + ≤ 11 = **≤ 38 characters.** This is the number every symbol decision below is made against. |
| Case | Emitted lower-case; read case-insensitively, because a person typing it off paper is not a machine. |

**What the token folds.** `packingRevisionOf(sale)` — the goods, the allocations, the instructions,
the customer, the day. Deliberately NOT the workflow ticks or the delivery-note price snapshot,
because those are not packing content. So a run whose content is unchanged keeps its mark, and a
run whose content moved gets a different one — which is exactly the signal QR-06 reads.

## QR-02 · The symbol

| Parameter | Value | Why |
|---|---|---|
| Symbology | QR, ISO/IEC 18004 | |
| Encoding | Byte mode, the encoder's choice | 38 mixed-case-and-punctuation characters are not alphanumeric-mode material |
| Version | **3 (29 × 29 modules)** | The smallest that holds 38 bytes at level M (capacity 42) |
| Error correction | **M — 15 % recovery** | See the arithmetic below; it is a decision, not a default |
| Quiet zone | **4 modules**, the ISO minimum, drawn INSIDE the mark's own box | A quiet zone left to the page's margin is a quiet zone a tight masthead crops |
| Drawn size | **76 CSS px** at 96 dpi ⇒ 37 modules across (29 + 2 × 4) | |
| Module | **0.54 mm** on A4 and A5 alike | Both papers are 3.78 px/mm, so one number really is both papers |
| Floor | A module may never fall below **0.5 mm** | Below it, phone capture of laser print starts failing at an angle |
| Colour | `contentPrimary` on `backgroundPrimary` | The mark re-themes with everything else; the theme gate enforces it |

### QR-02.1 · Why M and not Q — the arithmetic, stated rather than asserted

Level Q recovers 25 % instead of 15 %, and for a paper handled in a wet cold room that is the
attractive number. It costs a symbol version: 38 bytes needs version 4 (33 × 33) at Q, because a
version-3 symbol at Q holds only 32. The mark's printed footprint is fixed by the packing
masthead's budget — a mark that grows pushes the last rows of page one under the folio — so at a
fixed 76 px, Q would draw **41 modules across at 0.49 mm each**, under the floor.

So the trade is real and it is: **15 % recovery at 0.54 mm, or 25 % recovery at 0.49 mm.** Module
size is the parameter a phone camera actually fails on; recovery is the parameter a smudge fails
on. M wins at this footprint, and QR-08 makes the choice evidence rather than argument by damaging
the real generated mark until it stops decoding.

**The production fork, stated so nobody re-derives it:** a house printing packing lists on paper
that gets wet or greasy should move to **Q at 96 px** (26 mm, 0.63 mm/module) — which needs 20 px
of masthead budget and is therefore a layout change, not a constant change.

## QR-03 · On paper

| Paper | Mark | Module | Quiet zone |
|---|---|---|---|
| A4, 96 dpi preview | 76 px = 20.1 mm | 0.54 mm | 2.2 mm |
| A5, 96 dpi preview | 76 px = 20.1 mm | 0.54 mm | 2.2 mm |
| A4 at 300 dpi print | 238 px | 0.54 mm | 2.2 mm |

The mark sits at the top right of the packing masthead, in the head's own `auto` column, with
«Scan after packing» and **the token in words** beside it (QR-05.3). It is never rotated, never
placed inside a border, never printed across a fold.

### QR-03.1 · The clear paper the mark reads on — the rule, and what the sheet gives it

QR-10.4 measured what clear ground buys: with **one mark-width, 20.1 mm, of clean sheet on every
side of the symbol** zxing-cpp read 24 of 24 locators; with noise up to the symbol's edge it read
**9 of 24**. That is the rule the mark wants.

**The printed sheet does not give it, and this is the measurement rather than an estimate.**
`drive-196-paper-manifest.py` reads the rendered packing sheet at every viewport on both papers and
reports the clear paper around the symbol:

| Side | A4 | A5 | What stands there |
|---|---:|---:|---|
| left | **5.3 mm** | **5.4 mm** | the document's identity column — «Packing list», «4 orders · 11 lines», «Monday 25.08» |
| right | **4.3 mm** | **4.3 mm** | the mark's own caption — «Scan after packing» and the token (QR-05.3) |
| above | — | — | nothing; the sheet's top margin |
| below | **20.7 mm** | **20.7 mm** | the table's first rule |

So on two sides the mark has about a quarter of the ground QR-10.4 read 24/24 on. **What that
costs is not known**, because QR-10.4's harness renders the mark on blank paper and surrounds it
with noise on ALL sides — a masthead neighbour on one side at 5 mm is a condition it never
measured. QR-09 owns that debt («the mark inside its real masthead»); the numbers above are what it
is a debt about. The drive pins them, so a masthead that crowds the mark further goes red.

## QR-04 · Generation

`print-view.tsx`'s `PackingCaptureMark` draws `QRCodeSVG` from `qrcode.react` (already in the
bundle) with `value = packingDocumentLocator(sales)` and every other parameter read from
`PACKING_QR`. It is an **SVG**, not a raster: it scales to any printer without a resampling step,
and the drive can read its module matrix out of the path data.

## QR-05 · Reading

`qr-read.tsx` owns the reading. It exposes ONE ladder, stated on the surface as `data-road`, so
what the browser can do is a fact on the page rather than a guess:

| `data-road` | What it is | Where it stands |
|---|---|---|
| `native` | The browser's own `BarcodeDetector`, `formats: ['qr_code']` | Chrome on Android and macOS — which is the phone in the cold room, i.e. the case that matters |
| `library` | jsQR, carried in the bundle behind a lazy chunk and bound through `provideQrLibrary()` | **iOS Safari — every iPhone — and desktop Chrome on Linux.** Built E200.09; QR-05.5 states which decoder and why. |
| `typed` | The person reads the token off the paper and types it | **Every** browser, with no camera and no permission at all |

The road is a live fact, not a boot-time memo: a chunk that fails to arrive drops the surface to
`typed` and `data-road` says so. A ladder that claims a rung it cannot stand on is worse than one
rung fewer.

And on either reading road there are TWO WAYS IN — the live camera, and a photo already taken
(QR-05.6). The photo matters most exactly where the camera is hardest: a phone told to keep its
camera to itself still has a camera roll, and the sheet was photographed on the way out of the bay.

### QR-05.1 · The camera

`getUserMedia({ video: { facingMode: 'environment' } })`, one stream, one 320 ms interval, both
released when the panel closes. The detector is handed the `<video>` element directly on the
native road; the library road draws the frame to an offscreen canvas (`willReadFrequently`, so the
browser keeps it where it can be read back) and hands over the `ImageData`. **A frame is looked at
and dropped.** Nothing is stored, nothing is uploaded, no still is kept — a scan is not a capture.

**ONE PASS PER FRAME, deliberately.** The library road decodes a camera frame at the frame's own
size and moves on. Frames arrive three times a second, so the ladder here is TIME, and a person
moving the phone half a centimetre does more than a resample would; a second pass inside a 320 ms
interval would only make the loop late. The scale ladder in QR-05.6 belongs to a still photo, where
there is one frame and somebody waiting on it.

### QR-05.2 · The states, and their words

| State | The sentence |
|---|---|
| `opening` | «Opening the camera…» |
| `watching` | «Point the camera at the code on the packing list.» |
| `denied` | «Camera access sits with the browser. Type the code printed under the mark instead.» |
| `typed` | «Type the code printed under the mark on the packing list.» |
| `reading` | «Reading the photo…» |
| `unread` | «That photo came back unread. Type the code under the mark instead.» |
| unknown code | «That code is still unmatched in this house. Check the code under the mark.» |

Every one of them says what IS and what to do next. A refused camera is not an error state; it is
the typed road, which was standing there the whole time.

### QR-05.3 · The typed road is only a road because the paper carries the token

`print-view.tsx` prints the token in words under the mark (`packing-document-code`). Without it,
«type the code» is an instruction with nothing to type. This is the reason that line exists and it
may not be removed without removing the road.

### QR-05.4 · What is accepted

`parsePackingLocator` takes what the camera or the hand gave, forgives surrounding space, forgives
case, accepts the token with or without its scheme, and returns a normalised locator — or nothing.
`^[a-z0-9]{1,13}$` is the whole grammar. Anything else names nothing and is told so.

### QR-05.5 · WHICH DECODER, AND WHY — measured, not chosen (E200.09)

⚠ **The 128-frame sweep below was a ONE-OFF MEASUREMENT and no runner survives it.** The numbers
were taken once, on this box, with a throwaway harness; `tools/qr-harness.py` and `tools/degrade.py`
are unchanged and neither reproduces the table. Treat every figure in this section as a recorded
observation rather than a re-runnable proof — and re-measure from scratch, with a committed runner,
the day the mark, the clearspace or the decoder moves.

QR-09 named `jsqr` as «the candidate» and left it there. The candidate is now the answer, and it is
the answer because of a measurement rather than because it was the name in the paragraph.

**THE TWO CANDIDATES.** `zxing-wasm` — the zxing-cpp C++ core compiled to WebAssembly, the same
engine Android's ML Kit and most scanner apps carry — and `jsQR` (Apache-2.0, pure JavaScript, no
dependencies). Both were run over the SAME 128 frames: the kit's own mark, at the kit's own
`PACKING_QR` parameters, drawn with the app's own encoder, placed on an A4 sheet at its true
20.11 mm of 210 mm, photographed at **1600 px** and at **800 px** wide — which gives the symbol
**153 px** and **77 px**, the two ends of the range QR-08 already quotes — and then damaged through
`tools/degrade.py`: 25° tilt, σ1 blur, JPEG 30, 2 % sensor noise, harsh uneven light, a strong
perspective skew, and the 05:40 combination. Eight locators per case, both grounds.

| Decoder | Read | at 1600 px · mark 153 px | at 800 px · mark 77 px |
|---|---|---|---|
| zxing-cpp 3.1.1 — the core `zxing-wasm` carries | **92 / 128** | 52 / 64 | 40 / 64 |
| jsQR 1.4.0, one pass | 88 / 128 | 57 / 64 | 31 / 64 |
| **jsQR 1.4.0 with the scale ladder** | **99 / 128** | **59 / 64** | 40 / 64 |

**THE LADDER IS WHY.** One pass loses to zxing; the pass at 2× wins it back and then some. The case
it turns is exact — an 800 px photograph tilted 25° went **0/8 to 8/8** — and the reason is
arithmetic rather than luck. jsQR binarises in 8 × 8 blocks; at 800 px the mark is **2.08 px per
module**, so one block spans four modules and a rotation's resampling smears them into each other.
Resampling UP first gives the binariser room per module the photograph never had. The same ladder
took the 05:40 combination at 1600 px from 1/8 to 3/8.

**AND THE SECOND HALF OF THE ANSWER IS WHAT A DECODER COSTS TO CARRY.** `zxing-wasm` is a
WebAssembly binary that arrives either from a CDN — and the kit fetches nothing from a network it
does not serve, so a cold room's signal would decide whether the mark reads, and the drive that
proved it would be proving a CDN's uptime — or as about a megabyte committed to a repo whose whole
app bundle is smaller. jsQR is 253 KB of readable JavaScript that the build emits as a **130 KB
chunk**, fetched ONCE, from the kit's own origin, and only where the browser brought no detector of
its own. It decodes more of the same frames for a fifth of the weight.

**AND THE MASTHEAD COST NOTHING, MEASURED.** QR-09 left «the mark inside its real masthead» as a
debt of unknown cost. Both decoders were run over both grounds — the mark on blank paper, and the
mark with E196.1's measured neighbours drawn at 5.3 mm left and 4.3 mm right — and **every cell of
the table is identical between them**, for both decoders, at both widths, on all eight axes. At
these densities the masthead's neighbours cost nothing. The debt QR-09 states is narrowed to the
ONE thing this did not measure: a neighbour standing closer than 4.3 mm.

**HOW IT WAS INSTALLED, AND WHY THAT IS PART OF THE ANSWER.** It was not installed. `node_modules`
on the build box is one tree shared by every concurrent build of the kit, and QR-09 says in as many
words that adding a dependency mid-round rewrites that tree under the other builds. So the decoder
is VENDORED: `app/src/prototypes/cedar/vendor/jsqr.js` is jsqr@1.4.0's published `dist/jsQR.js` byte for byte
between two marked lines — plus the one newline that puts the closing marker on a line of its own,
because the published file ends without one, so a `sha256sum` of the marked region answers with the
digest of `dist/jsQR.js` + `\n` rather than the file's own (sha256 `bc40c8a1…`, npm shasum
`8efb8d0a…`), with four lines added at the
head and three at the foot that hand its CommonJS door a real `module` so the bundler can carry it
as an ES module and code-split it. The licence text stands beside it at
`vendor/jsqr-LICENSE.txt` and the row is in `LICENSES-AND-ATTRIBUTION.md`.

### QR-05.6 · The photo road, and the scale ladder it runs (E200.09)

A camera is one way to hand the reader a mark. A photograph already taken is the other, and on the
road this section exists for it is often the ONLY one: an iPhone whose owner kept the camera to
itself still has the sheet in its camera roll from the bay door.

`qr-library.ts` owns it. The still is drawn into a canvas and decoded, and where the first pass
comes back with nothing the same still is decoded again at another scale:

| | Rung | What it is for |
|---|---|---|
| 1 | **1×** | the base frame — where nearly every readable photograph reads |
| 2 | **2×** | the marginal density: ~2 px per module, where jsQR's 8 × 8 binarising blocks span four modules |
| 3 | **0.5×** | a photograph so large that noise is finer than the modules |

**THE BASE FRAME IS CAPPED AT 1600 px ON ITS LONG EDGE.** That is both the density the numbers in
QR-05.5 are quoted at and what bounds the cost: a 4032 px phone photograph of an A4 sheet carries
the mark at 386 px, and bringing it to 1600 px leaves the mark at 153 px — plenty — while making
the first pass six times cheaper.

**WHAT ACTUALLY BOUNDS THE CANVAS IS THE 1600 px BASE CLAMP ABOVE.** `base = Math.min(1, 1600 /
natural)` is applied FIRST, so the long edge entering the ladder is at most 1600 px and the 2× rung
tops out at 3200 px and 10.24 Mpx — inside iOS Safari's 4096 px / 16,777,216 px ceiling on every
possible input. The ceiling clamp is therefore DEFENCE IN DEPTH: it is written, it is tested, and
on today's ladder it never fires. It stays because a canvas over the cap on iOS comes back BLANK
rather than raising, so the day somebody raises the base edge the platform this road exists for
keeps reading instead of silently returning nothing.

Between rungs the frame is handed back to the browser for a tick: three passes in a row on a phone
is tens of milliseconds each of main thread, and a person feels that as the page freezing.

**WHAT THE PHOTO ROAD DOES ON THE NATIVE ROAD.** The same door, the browser's own detector under
it: `BarcodeDetector.detect(bitmap)` reads a still as happily as a video element, so a phone with a
detector never pays for the chunk or the ladder. One door, two decoders, one landing.

## QR-06 · What a read resolves to

`resolvePackingLocator(locator, runs, printed, sector)` answers in one of three ways:

1. **A run whose current fold matches the locator** → `{ day, sales, current: true }`. «This paper
   says what the run says.»
2. **A run whose CONFIRMED-PRINTED revisions fold to the locator** → `{ …, current: false }`. «The
   run moved after this paper was printed. Check it against the lines.» This is the case the mark
   was built for: the locator is one-way, so a changed run can only be recognised through the
   output history, and the output history is exactly where `packing-output.ts` keeps each confirmed
   revision.
3. **Nothing** → the code names no packing list of this house.

A reading opens no document and writes nothing by itself. It STATES which paper is in the hand;
aligning reviewed weights onto those lines is the paper-review road (§191.1), and it may only
start from a paper the app has identified.

## QR-07 · The corner marks, and the layout the print remembers

**What this section owns, and what it hands on.** The marks are the mark's business: their shape,
size, inset, corners and pages, and the layout record the print measures at the moment the mark is
issued. **What those marks are FOR** — registering a photograph onto that geometry, cropping every
cell, reading the handwriting and landing it on the line — is
[THE-PAPER-SPEC](THE-PAPER-SPEC.md) (PAP-01 · PAP-02 · PAP-03), which also carries the floor all of
it was measured at.

**Authority:** FEED-IA §199.1 (E196.10 · E196.11). Peter, 2026-09-04 evening, verbatim:

> if they're printing out a document and then they handwrite on it, and then they take a half-assed
> photo at a wrong angle with bad lighting, we need to automate it perfectly to the actual data that
> they handwrote (because a human is able to do that)… One QR code isn't going to have a single
> order on the paper. There are multiple orders on the same paper, so how do you make sure that we
> actually match them together? That's why one is knowing the format that we ended up printing.

QR-06 says the house remembers WHAT it put on the paper. This section says it also remembers
**WHERE**, and gives the photograph four points to stand on while it does.

### QR-07.1 · Why one mark is not enough

The mark in the masthead gives a reader ONE corner and a scale. A page photographed at arm's length
over a bench is not a scaled page: it is a page seen through a perspective — near edge longer than
far edge, tilt in two axes at once. Recovering that needs a **homography**, and a homography needs
**four** point correspondences. One mark and three assumptions is not four points; it is one point
and a hope.

So the bay's paper carries three more: solid squares at the three corners the mark does not hold.
Four points at the extremes of the sheet are the best-conditioned four a page can offer — the
further apart the points, the less a pixel of detection error moves the rectified grid.

### QR-07.2 · The marks, exactly

| Parameter | Value | Why |
|---|---|---|
| Shape | a filled square | Nothing to decode, nothing to orient, nothing to get wrong under blur. Its centroid is stable under threshold, which is the only property the homography uses. |
| Side | **6 mm** | 11 px at 300 dpi print and about 20 px in a 12 MP phone frame of a whole A4 — enough that a centroid survives σ 3 blur, small enough to live in the paper's margin. |
| Inset | **5 mm** from each of its two edges | Inside the sheet's own 10.6 mm margin, so a mark never enters the text measure. |
| Corners | **`tl` · `bl` · `br`** | The mark holds the top right (QR-03), so the squares take the other three. |
| Ids | one of **`tl` · `tr` · `bl` · `br`** | The four compass corners. The three drawn are the three the mark's own corner leaves free. |
| Colour | `contentPrimary` on `backgroundPrimary` | The same ink as the rest of the sheet; the theme gate enforces it. |
| Pages | **every page** | A photograph of page two is a photograph of a page, and it registers the same way. |
| Papers | A4 and A5 alike | 5 mm is 5 mm. The sheet's margin is 40 px on both, so both have room. |

**Why `tl` and not `tr`, said once so nobody re-derives it — and measured, because the first
version of this paragraph was wrong.** A homography is conditioned by how far apart its four
correspondences are, so the choice is a measurement. With the mark in the top right of the masthead
and the squares at `tl · bl · br`, the four points enclose **48,484 mm² — 77.7 % of an A4** — and the
closest two of them stand **160.5 mm** apart. Move the third square to `tr` and two points bunch
along the top edge: the hull falls to **30,793 mm² (49.4 %)**, the closest pair to **36.4 mm**, and
the sheet's left edge carries no point at all. On A5 the same two arrangements read **69.0 % /
98.8 mm** against **49.1 % / 36.4 mm**. `drive-196-paper-manifest.py` measures both every run, on
every page and both papers, and prints them side by side — the choice is on the record rather than
in this sentence.

**The mark's clear paper allows `tr`; the spread is what rules it out.** QR-10.4 measured the
reading itself: with one mark-width of clean sheet around the symbol zxing-cpp read **24 of 24**
locators, and with noise to the symbol's edge **9 of 24**. A square at `tr` stands **23.2 mm** from
the symbol's right edge — past that mark-width — so it would keep the ground the mark reads on. An
earlier version of this section claimed the opposite and it did not survive measurement. The corner
is free, which is also what makes QR-09's fourth square on later pages a possibility rather than a
collision.

**The ids, settled with the E196 contract.** `corners[].id` is one of the four compass corners, and
the three the paper draws are **the three the mark's own corner leaves free**. QR-03 puts the mark
at the top right, so today the paper draws `tl · bl · br`; the E196 contract's enum was written
`tr | bl | br` from the same arithmetic read the other way round. The enum is the four names; the
drawn set is the complement of the mark's corner. **A reader matches marks by POSITION and reads
the id as a label** — `marks.qr` stands in the same record, on the same page, in the same
millimetres, so which corner the mark holds is measurable rather than assumed. A reader that
hard-codes one of the four strings is reading the record wrong. The drive asserts it on every copy
of every manifest: the three drawn ids plus the corner the mark holds are exactly
`bl · br · tl · tr`.

**Print safety, stated as a number.** A consumer laser printer refuses to print the outermost
~4–6.35 mm of a sheet. A mark runs from 5 mm to 11 mm from the edge, so its **centroid sits 8 mm
in** — clear of the worst of that band. A printer that clips the outer sliver of a square leaves the
centre the homography is taken from, and the reader's own detection is centroid-based for exactly
this reason.

**What the marks are NOT.** They carry no information at all — same square, same size, same place on
every page of every run. Nothing about the order, the day, the house or the goods can be read off
one. They are geometry, and §191.1's rule about what a mark may hold does not have a second case to
answer.

### QR-07.3 · The layout manifest

At the moment the mark is issued (QR-06), the print MEASURES itself and records what it drew. One
record per printed run, in millimetres from each page's own top-left:

```
{ version: 1, locator, token, day, paper: "A4"|"A5", pageMm: {w, h},
  marks: { qr: {x, y, size}, corners: [{id, x, y, size}] },
  pages: [{ index, blocks: [{ sale, number, customer,
            rows: [{ line, product, printed: {qty, unit},
                     cells: { qty: {x,y,w,h}, unit: {…}, finalWeight: {…} } }] }] }] }
```

| Field | What it is |
|---|---|
| `locator` · `token` | QR-01's payload and its typed half, so the manifest and the paper name each other. |
| `pageMm` | the paper's own millimetres — 210 × 297 or 148 × 210. Every other number in the record is inside that box. |
| `marks.qr` | the mark **as drawn**, quiet zone included: 20.11 mm across 37 modules. A decoder reports the SYMBOL, which is inset by 4 modules — **2.17 mm** on each side — and measures **15.77 mm** on a side. The arithmetic is stated here so a reader converts rather than guesses. |
| `marks.corners` | the three squares, page-local. They stand at the same three places on every page, so the run records one set. |
| `pages[].index` | the page's position in the run, **from 0**. The folio printed on the paper says `index + 1`. |
| `blocks` | one per order ON THAT PAGE, carrying the order's own number and customer. An order whose lines run over a page break has a block on each page, each holding only that page's rows. **This is the answer to «multiple orders on the same paper»: position, recorded, rather than a reader's guess.** |
| `rows[].product` · `printed` | the goods and the amount AS PRINTED, so a reading is asked for in the paper's own words — «the final-weight cell of line "Merluza · 12 kg"». |
| `cells` | the rectangles to crop. A cell the paper does not carry is **absent**, never invented: a rectangle where there is no cell would have a reader cropping blank paper and answering about it. |

**Where the numbers live.** `REGISTRATION` and `PAGE_MM` in `app/src/prototypes/cedar/paper-manifest.ts`,
next to the measurement itself, exactly as `PACKING_QR` holds QR-02's.

**The shape above is the RUNTIME's copy.** The browser's own register keeps the same record with
`number`, `customer`, `product` and `printed` left out — geometry, sale ids and line ids (QR-07.5).

**Why it is measured and not computed.** `el papel` paginates by arithmetic and must: a page count
has to be stable without a browser. But where a CELL lands is the browser's own answer — grid
tracks, a wrapping name, a sub-line, a two-line customer. A manifest computed from constants would
be a second, quieter layout engine, and it would disagree with the page the first time type wrapped.
So the geometry is read off the rendered print DOM in the same commit that draws the paper.

**Why the preview may record it.** The sheet is drawn at life size and transformed into its stage,
so every measurement is taken as a fraction of the sheet's own rendered box and multiplied by the
paper's real millimetres. A preview at 60 % and the print host at 100 % therefore produce the SAME
manifest — asserted, not assumed, in `drive-196-paper-manifest.py`.

### QR-07.4 · The seat the bay writes in

A manifest with nowhere to write is a map of an empty room. So the one-column packing sheet carries
a **Final weight** column — 88 px, the albarán's own width, empty ink, its head naming what belongs
in it and the row's own hairline as the line to write on. No box is drawn inside the cell: a printed
rule is ink a vision model then has to tell apart from a person's.

**The two-lane sheet keeps its six columns and says so.** Two columns is a DENSITY choice — twice
the picking on one sheet — and eight tracks on A5 would leave a goods lane 48 px wide. Its manifest
reports rows with their printed amount and **no** final-weight rectangle, which tells a reader there
is nowhere to write on this paper rather than sending it to crop a place that was never there.

### QR-07.5 · Where the manifest goes, and what happens when there is nowhere to send it

`POST /api/paper/manifest` carries it to the runtime, which keeps manifests by token;
`GET /api/paper/manifest/<token>` gives one back, and `POST /api/paper/read` reads a photograph
against it. `runtime-client.ts` is the only place the kit names those routes.

A kit with no runtime in front of it still prints, still issues the mark and still keeps the layout
in the mark's own record. A small journal says which of the two is standing, in a sentence about
where the layout IS: «The runtime holds the layout of this paper» or «This device holds the layout
of this paper, ready for the runtime». A held copy is offered again the next time the same paper is
drawn — which is the retry a warehouse actually performs.

**Two copies, and they are not the same record (§191.1 · QR-11).** The RUNTIME's copy carries the
paper's own words — the customer, the order number, the goods, the printed amount — because that is
the context a handwriting reader is handed: «the final-weight cell of line "Merluza · 12 kg"». The
copy the BROWSER keeps carries geometry and ids and nothing else: rectangles in millimetres, the
sale id and the line id each one belongs to. §191.1 fixes what may stand in `localStorage` beside a
mark, a bay laptop is shared and borrowed and left logged in, and the kit already holds the orders
themselves in the session that drew them — so it can say «Merluza» whenever it has the right to and
simply never writes it down there. `opaquePaperManifest` is the projection that keeps that promise;
`drive-198-parsing-qr.py` reads the whole register back looking for a word, and
`drive-196-paper-manifest.py` asserts both halves — the absence here, the presence there — so the
opacity reads as a decision rather than as a missing field.

**A re-drawn paper re-records, on both sides.** The locator folds the sale revisions and nothing
else, so a run printed on A4 in the morning and on A5 in the afternoon carries ONE token over two
layouts. The register therefore replaces the layout it holds whenever a new drawing measures a
different one, and the journal is keyed on WHAT WAS DRAWN — a short fold of the record that was
offered — rather than on the token alone. Keyed on the token, the second drawing would have been
skipped as «already sent», and both this device and the runtime would have gone on holding a
one-page 210 × 297 record for a two-page 148 × 210 sheet, with every crop landing on blank paper.
The switch with a manifest already standing is a leg of its own in the drive, because every other
leg starts from an empty register and cannot see it.

**Retention, kit-side.** The register keeps 200 locators and the layout of the most recent 20. A
browser gives one origin about five megabytes and a busy morning's manifest is tens of kilobytes;
the house needs to RECOGNISE two hundred papers and to READ the ones still in circulation. An older
paper still resolves by its mark; its layout is the runtime's copy to hold.

### QR-07.6 · What this section does not claim

- **A page after the first registers on three points, not four.** The mark is in the masthead, so
  pages two and up carry the three corner squares alone — enough for an affine rectification, short
  of a full homography. A fourth square in the top right of later pages is the honest next step and
  is recorded in QR-09 rather than half-built here.
- **The reading itself is not this section's.** QR-07 puts the geometry on the paper and in the
  record. Registering a photograph onto it, cropping the cells and reading the handwriting is the
  paper-read road (FEED-IA §199.1–§199.3), specified whole in
  [THE-PAPER-SPEC](THE-PAPER-SPEC.md) and proven there.

### QR-07.7 · The proof

`drives/drive-196-paper-manifest.py` measures the rendered sheet rather than trusting the source:
the three marks, in millimetres, to **±0.5 mm**, on every page, at six viewports and on both papers;
that no mark touches a printed word, read in PIXELS on the printed sheet at life size; that the four
registration points span the sheet, and span more of it than a square in the mark's own corner would;
that no corner square stands in the mark-width of clear paper QR-10.4 measured the reading on, and
what clear paper the sheet DOES give the symbol on each of its four sides (QR-03.1); that the three
corner ids plus the corner the mark holds are the four compass corners; that every line of every order has a final-weight seat;
that the rows walk down the page and never overlap; that the manifest reaching
`POST /api/paper/manifest` answers this contract field by field **against the sheet actually
standing**, read off the DOM and confirmed by its own proportion; that the register's copy carries
the same geometry and none of the words; that switching A4 → A5 with a manifest already standing
re-records the layout and offers the new one; and that the preview and the print record the same
millimetres.

## QR-11 · Privacy

*(This section was «QR-07» until E196. The number moved so the corner marks could take the seat a
reader of this spec expects them in; not one word of the content changed.)*

- The payload carries no business data (QR-00). The drive proves the absence by word list.
- The token is opaque. In production it is unguessable, and possession of a token is **not**
  authorisation: resolving one is an authenticated, tenant-scoped act, and a token from another
  tenant resolves to nothing (SRC-PRIV-02's fail-closed rule).
- Camera frames are transient (QR-05.1).
- The mark does not prove OCR occurred (§191.1). It proves which document a photograph is of.
- **The manifest (QR-07.3) is a different object from the payload and lives under a different
  rule.** It never rides the paper: it goes from the house's own kit to the house's own runtime,
  keyed by the token, and it carries the order number and the customer name because a reading has to
  land on the right block. What is printed on the sheet is unchanged; what the QR holds is
  unchanged.

## QR-08 · The proof

`drives/drive-198-parsing-qr.py` renders the app's OWN mark and reads it with a real decoder — the
system `libzbar`, through a small read-only ctypes binding, no package and no network provider:

- the payload matches `rocoto:document/packing/v1/[a-z0-9]+` and contains none of a prohibited word
  list (customer, product, quantity, price, lot, currency);
- the symbol is a valid QR: an odd module count of the form 21 + 4k, three intact finder patterns,
  and a quiet zone of at least 4 clear modules on every side;
- it decodes at 96 dpi (76 px), at A5 300 dpi (168 px) and at A4 300 dpi (238 px);
- it decodes after a 7° rotation, after contrast loss and resampling, and **after occlusion** —
  the damage sweep that turns QR-02.1's ECC choice into evidence;
- the printed token under the mark equals the payload's token, so the typed road is a road;
- the reader's ladder is real: with no `BarcodeDetector` the surface stands at `data-road="library"`
  and the typed token still resolves the run; with a detector present the surface stands at
  `data-road="native"` and the camera loop consumes what the detector returns.
  ⚠ **RE-PINNED BY E200.09.** Until the bundle carried a decoder that first road was `typed`, and
  the leg asserted the typed sentence and NO camera preview. The same browser now stands on the
  `library` road, opens the camera it was granted and draws the preview; drive-198 states the three
  moved values in its own docstring, and everything only the library road can reach — the refused
  camera, the photo, a chunk that fails to arrive — is `drive-200-qr-library.py`'s.

**What it came back with, on the bundle this spec was written against: 264 GREEN / 0 RED**, and the
occlusion sweep is the number QR-02.1 was arguing about — the real mark decoded with **2 %, 4 %,
6 %, 8 % and 10 %** of its own area blacked out and failed at 14 %. Level M's 15 % budget, met
almost exactly, by measurement rather than by citation. **Six source flips, 33 deliberate reds**
proved the claims can go red; flip 4 (`marginSize={0}`) is the one worth remembering, because
taking the quiet zone away dropped the surviving occlusion from five steps to three: **a quiet zone
is error correction**, not decoration.

⚠ **What the browser leg does NOT claim.** Headless Chromium on Linux has no `BarcodeDetector`, so
the native leg is driven with a stub that returns a string **a real decoder read from the app's own
rendered mark** in the same run. The chain is honest and is labelled as what it is: zbar decoded
the real QR; the stub carried that decoding into the page; the page's own resolution of it is what
is under test. No leg of this drive claims that Chromium decoded a QR.

### QR-08.1 · The library road's own proof (E200.09)

`drives/drive-200-qr-library.py`. The chain it proves on is the reason to believe it: the packing
sheet is PRINTED in the browser under test, and the drive PHOTOGRAPHS it — `[data-paper-sheet]`
screenshotted at `device_scale_factor=2`, the page found by measuring its own proportion and the
mark's share of it off the DOM, then resized with PIL's LANCZOS filter to the width a photograph
gives it and tilted 25° by `tools/degrade.py`. The chunk the build emitted decodes that picture,
and the app resolves what it read into the run it was printed over.

`window.BarcodeDetector` is DELETED in the init script, so the native road cannot answer and no leg
can pass by accident on a Chromium that grows one. Two numbers are MEASURED off the DOM rather than
assumed: the sheet's proportion (**1.414**, so the photograph is of a page) and the mark's share of
it (**0.0957**, against the 20.11 / 210 = 0.0958 this spec states). An earlier version of the leg
picked its element by shape, photographed the pane behind the sheet along with it, and came back
with a share of 0.6363 — which is why both are asserted.

⚠ **And where the fixture is harder than reality, stated.** The preview draws the sheet at 472 CSS
px and the capture doubles it, so the symbol leaves the browser at about 90 px and is resized UP to
the 153 px a 1600 px photograph gives it. Upscaling adds no information, so that frame carries LESS
module detail than a real photograph of a 300 dpi print at the same width — harder than the thing
it stands for, never easier. The 800 px frame's 77 px is a downscale of the same 90 px and is
honest as it stands. **The camera is refused by not existing** — the
browser is launched with no fake device, which is the answer an iPhone gives when its owner keeps
the camera to themselves — so the refusal posture is a real refusal rather than a stub. One leg
launches a second browser WITH a fake device, to show the camera and the photo standing as two
roads rather than one.

What it asserts, at 1366 × 768 and 390 × 844:

- the road is `library`, the refusal posture says what the person CAN do, and that sentence carries
  no negative construction (§198-A, asserted by a regex over the sentence itself);
- a **1600 px** photograph of the sheet reads to its own run, and an **800 px** one where the mark
  is 77 px across;
- both again **at 25°**, which is the rung the ladder exists for — the 800 px tilt is the case that
  reads on the 2× pass and nowhere else;
- a photograph with no mark in it lands `unread`, hands over the typed road and invents no document;
- the typed road resolves the run exactly as it did before;
- every control on the reader clears the 44 px floor (INTX-03);
- and, with the chunk aborted at the network, the surface DROPS to `data-road="typed"`, the photo
  door goes with it, and the typed road still resolves — the ladder is honest about a rung it
  cannot stand on.

**41 GREEN / 0 RED** on the candidate. **RED-PROVED against the published kit** — the same drive at
`ROCOTO_URL=https://kit.soyrocoto.com/app.html` ends **4 GREEN / 2 RED** and stops. The four greens
are the fixture chain agreeing with the published build (the same locator, the same 1.414 page, the
same 0.0957 share), which says the photographs are of the paper the kit really prints. The two reds
are `data-road` standing at `typed` and the photo door absent; then `data-state="denied"` times out,
because a reader with no decoder to open a camera for never opens one. Three facts, one absence.

`drive-198-parsing-qr.py` holds at its **330** pin with the three values QR-08 names re-pinned;
`drive-201-degradation.py` is **32 GREEN / 0 RED**, untouched — it reads `PACKING_QR` and boots no
browser, so nothing in this package can reach it.

## QR-09 · What is owed

- ~~**A decoder in the bundle** for the `library` road.~~ **BUILT — E200.09.** `jsQR` 1.4.0
  (Apache-2.0, not MIT as this line said) is VENDORED at `app/src/prototypes/cedar/vendor/jsqr.js` rather
  than installed, because `node_modules` is still one tree shared by concurrent builds — a file in
  the repo is a dependency nobody else's install can move. `qr-library.ts` is the adapter, it loads
  behind `import()` so the 130 KB chunk reaches only the browsers that need it, and it carries the
  scale ladder QR-05.6 measures. iOS Safari and desktop Chrome on Linux now SCAN. Which decoder and
  why is QR-05.5; the proof is `drives/drive-200-qr-library.py`.
- **The alignment road itself** — a photographed marked-up packing sheet whose weights land on the
  lines the locator names. QR-06 identifies the paper; §191.1's alignment is the paper-review
  surface's own work and this package did not build it.
- **Production tokens.** The kit's deterministic fold is honest for a preview and wrong for
  production, where the token must be unguessable and server-issued (QR-01).
- **A fourth point on pages after the first (QR-07.6).** The mark lives in the masthead, so page two
  carries three corner squares and registers on an affine fit rather than a full homography. The
  work is one more square in the top right of later pages plus the manifest entry that names it; it
  is a change to the printed sheet and to the shape both sides of the contract read, so it belongs
  to the round that holds the manifest contract alone. **The corner is free** — QR-07.2 measures a
  `tr` square standing 23.2 mm from the symbol's edge, past the mark-width QR-10.4 read 24/24 on —
  so this is a page-one question about spread and a later-page question about having any fourth
  point at all, which are two different arguments.

**Added by QR-10 (E193.23), each with its measured number attached rather than a hunch:**

- **The production footprint move, now priced.** QR-02.1 recommended «Q at 96 px» for a house
  printing on paper that gets wet. QR-10.6 measured it and the recommendation CHANGES: the gain
  comes from millimetres, not from parity, and Q costs a version. **`M at 96 px`** buys one 3 mm
  ink blot 17/24 → 20/24 and three of them 12/24 → 18/24 with no resolution cost; `Q at 120 px`
  reaches 24/24 on one blot. Q at the CURRENT 76 px is the one option to avoid — it drops the
  module to 0.490 mm and takes the resolution floor from 24/24 to 0/24. It is 20 px of masthead
  budget and therefore a layout change, which is why it did not happen this round.
- ~~**A `library` decoder, and QR-10 sharpens why.**~~ **BUILT — E200.09.** The floor QR-10 measures
  was measured on decoders the kit did not carry; it now carries one, and QR-05.5 measures the
  floor AGAIN on that exact decoder, at the two photo densities a phone gives, so the numbers and
  the shipped code are about the same software. **What is still owed here is one column:** QR-10's
  full sixty-axis sweep is quoted on zxing-cpp and libzbar, and jsQR's own column on that sweep
  would say where the two disagree. QR-05.5 measured eight axes; the other fifty are unmeasured on
  the decoder that actually ships.
- **A photo road on the NATIVE detector, proven.** `BarcodeDetector.detect(bitmap)` is what the
  photo door calls where the browser brought its own decoder (QR-05.6), and `drive-200` proves the
  door on the LIBRARY road only — headless Chromium has no detector to prove the other half with,
  and stubbing one would be stubbing the very thing under test. It is one leg on a real Android
  Chrome, and it is the shape of thing a person with a phone settles in a minute.
- **The mark inside its real masthead — now with the numbers it is a debt about.** QR-10.4 measures
  clear paper around the mark and QR-10.4's own warning states the limit: the harness renders the
  mark on blank paper, so it cannot measure what the quiet zone actually holds off, which is the
  masthead's neighbours. E196.1 measured what the printed sheet actually gives the symbol —
  **5.3 mm left** (the identity column) and **4.3 mm right** (the mark's own caption), against the
  20.1 mm that read 24/24 — so this is a shortfall of about four fifths on two sides, of unknown
  cost. The honest next step is to degrade the WHOLE rendered packing sheet — `drive-198` already
  screenshots it — rather than the mark alone, and to measure the same batch with a neighbour on
  one side only. `drive-196-paper-manifest.py` pins the four distances every run so the sheet
  cannot quietly crowd the mark further while that work waits.
- **A second capture density.** Everything above is quoted at 300 dpi print. A phone photographing
  a sheet from 60 cm at 12 MP is close to it; a scan at 150 dpi is not. One more column.

---

# QR-10 · THE DEGRADATION FLOOR — how much damage the mark survives, measured

**Authority:** FEED-IA §198 (E193.23). Peter, 2026-09-04, verbatim:

> for the parsing and qr shit, which should work flawlessly (we're way past the dawn of the era of
> IoT and machine recognisable documents and QR codes… i expect this to be fully working when we
> wire everything, as long as you design it all well, spec it well etc so that when you build and
> test it's piss play cos you can even test it by exporting and downresolutioning and even muddling
> or adding fake dirt to the image and then running it through scanning all programmatically
> without requiring me to print and test)

QR-08 proved the mark decodes. This section answers the harder question — **how far down does it
still decode** — with numbers, on every axis a cold room damages paper along, and no printer and no
person were involved in getting them.

**Measured 2026-09-04.** The command, verbatim:

```
python3 -m venv --system-site-packages /dev/shm/e193-harness-venv
/dev/shm/e193-harness-venv/bin/pip install -r tools/requirements-harness.txt
ROCOTO_DIST=<a built kit> python3 tools/qr-harness.py --anchor --sweep --clearspace --batch 24
```

## QR-10.0 · What the number is a number ABOUT

| | |
|---|---|
| **The symbol** | the app's own. `--anchor` boots the built kit in headless Chromium, walks to the packing sheet and reads the real `PackingCaptureMark` — its locator, and its module matrix out of the SVG path data. |
| **The batch** | **24 different locators**, tokens the app's own 53-bit fold mints (10–11 base-36 characters, so the 38-character payload budget is used in full). Not one lucky symbol. |
| **The capture** | the mark as PRINTED on A4 at 300 dpi: 20.11 mm across 37 modules ⇒ **0.543 mm and 6.41 px per module** — which is also, within a few per cent, what a 12 MP phone gets of an A4 sheet held to fill the frame. Every «×0.5 resolution» below is 0.5 **of that**. |
| **The page** | the mark with one mark-width of white paper on each side, because that is where a mark on a masthead actually sits (QR-10.4). |
| **The decoders** | **zxing-cpp 3.1.1**, the C++ core Android's ML Kit and most scanner apps carry — and the system **libzbar** as a second opinion. Where the two disagree by a lot, the result is a library's property and not the symbol's, and this section says so rather than quoting the scarier number. |
| **A FLOOR** | the harshest step at which **every one of the 24** decodes to its exact payload. Not «most». A packing sheet that reads nine times in ten is a sheet somebody stops trusting. |

## QR-10.1 · The floor, by axis

**zxing-cpp alone** is the conservative reading — one library, one still frame, its own defaults.
**either** is the practical one: `qr-read.tsx`'s ladder is three roads, not one, and a camera loop
gets three frames a second.

| Axis | What the harshest surviving step is | zxing-cpp | either | Breaks at |
|---|---|---|---|---|
| **resolution** | **a fifth of the printed density — 1.28 px per module** | ✓ | ✓ | 0.15 (0.96 px/module) |
| **blur** | **gaussian σ 3**, about half a module wide | ✓ | ✓ | σ 4 |
| **JPEG** | **quality 30, forwarded three times** | ✓ | ✓ | — nothing tested broke it |
| **noise** (impulse, at print resolution) | **2 % salt-and-pepper** | ✓ | ✓ | 5 % (22/24) |
| **sensor noise** (impulse through a lens) | **5 %** | ✓ | ✓ | 10 % (23/24) |
| **rotation** | **45°** | ✓ | ✓ | — nothing tested broke it |
| **perspective skew** | **severe** (32 % of the width) | ✓ | ✓ | — nothing tested broke it |
| **lighting** | **contrast 0.22 under a steep ramp** | ✓ | ✓ | — nothing tested broke it |
| **grime** — fish water, translucent | **six 5 mm splashes** | ✓ | ✓ | — nothing tested broke it |
| **stain** — coffee, dark | **six 5 mm stains** | 19/24 | ✓ | — |
| **ring** — a coffee ring across the symbol | **2.4 % of the symbol wide** | 13/24 | ✓ | — |
| **blot** — opaque, proportional | **5 % of the symbol** | 14/24 | ✓ | 8 % (21/24) |
| **ink** — opaque, physical | **one 2 mm blot, anywhere** | 19/24 | ✓ | one 3 mm blot (23/24) |
| **dirt** — opaque blobs AND a ring together | **5 % plus a ring** | 16/24 | ✓ | 15 % plus a ring (14/24) |
| **the 05:40 morning** — blur + skew + crease + dirt + JPEG 50 twice | **the whole combination** | 11/24 | ✓ | the same with 15 % dirt (12/24) |

**49 of the 62 degradations decoded on every one of the 24 locators.** In 2,976 reads a damaged
mark **never once returned a different locator** — the failure is always «no read», never «the
wrong delivery note», which is the only failure mode that would matter.

**What this settles about the bar.** «Fails at 0.5 resolution or σ 1 blur» was the weakness test.
The mark clears **0.20 resolution and σ 3** — four to five times past it on the two axes a phone
camera actually fails on, and it reads the 05:40 morning photograph whole.

## QR-10.2 · What it does NOT survive, stated

**Opaque ink on a finder pattern.** One 3 mm blot took one locator in twenty-four; three 3 mm
blots took one; three 5 mm blots took nine. **No error-correction level fixes this and none ever
will:** ECC buys back damaged DATA modules, and a decoder that cannot FIND the symbol never gets
as far as correcting it. A marker pen through a corner of the mark is a destroyed mark.

**And the opacity of the dirt is what decides it, not the area.** The same three 5 mm drops:

| | zxing-cpp | libzbar | either |
|---|---:|---:|---:|
| translucent — fish water, brine, melted ice | 24/24 | 24/24 | **24/24** |
| a dark stain — coffee, dried blood | 21/24 | 24/24 | **24/24** |
| opaque — marker pen, fresh blood, a printer smear | 4/24 | 14/24 | 15/24 |

So the cold room's own dirt is the one the mark survives, and the stationery cupboard's is the one
it does not. **The answer to a destroyed mark is already built and it is QR-05.3's typed road** —
the token is printed under the mark in words, and a person reads eleven characters. That line is
not a courtesy; it is the recovery path for this exact failure, and it may not be removed.

## QR-10.3 · What the reading roads actually do — asked, not assumed

`qr-harness.py --anchor` asks the browser rather than repeating a claim:

- **Headless Chromium 145.0.7632.6 on Linux exposes NO `BarcodeDetector`.** `globalThis.BarcodeDetector`
  is `undefined`. QR-05's table said this; it is now a measurement with a version number on it.
- **Since E200.09 that browser stands at `data-road="library"` and decodes for real.** The same
  absence that used to make it type now makes it fetch the bundle's own chunk, which is exactly the
  iOS Safari case — so the proof box IS the platform under test rather than a stand-in for it.
  `drive-200-qr-library.py` deletes `window.BarcodeDetector` in its init script as well, so the leg
  cannot pass by accident on a Chromium that grows one.
- **One claim is still stubbed and stays labelled.** `drive-198`'s NATIVE leg drives a
  `BarcodeDetector` stub carrying a string a real decoder read from the app's own mark, because
  that road cannot exist on this browser at all. Nothing else is: `drive-200` decodes with the
  chunk the build emitted, and `drive-201` decodes with real decoders in Python and boots no
  browser.

## QR-10.4 · Clearspace — the mark needs white paper around it, and this is why

Measured on the same batch, zxing-cpp, varying only how much clear paper surrounds the mark:

| Clear paper on each side | 2 % sensor noise |
|---|---:|
| none — the mark cropped to its own box | 9/24 |
| 0.12 × the mark (≈ 2.4 mm) | 11/24 |
| 0.25 × the mark | 8/24 |
| 0.50 × the mark | 9/24 |
| **1.00 × the mark (≈ 20 mm)** | **24/24** |

ZXing's detector wants clear ground outside the finder patterns before it will commit to a symbol,
and noise right up to the symbol's edge denies it. **QR-03.1 is therefore a rule and not a
preference.**

⚠ **And the printed sheet does not meet it.** An earlier version of this paragraph said the
masthead «keeps its own clear ground around the mark… which is what gives it that ground today».
Measured (E196.1, `drive-196-paper-manifest.py`, every viewport, both papers), the mark has
**5.3 mm** of clear paper on its left, where the document's identity column stands, and **4.3 mm**
on its right, where its own caption stands — against the 20.1 mm above. The claim was wrong and it
is corrected here rather than softened. What that shortfall costs is unmeasured, for the reason in
the warning below, and it is QR-09's debt.

**E200.09 measured what that shortfall costs, and the answer is nothing at these densities.** The
decoder comparison in QR-05.5 ran its whole 128-frame sweep twice — once on blank paper, once with
E196.1's neighbours drawn at their measured 5.3 mm and 4.3 mm — and every cell of the table came
back IDENTICAL between the two grounds, for both decoders, at both photo widths, on all eight
axes. The 2 % sensor-noise row above is the one this table does not settle, because it is measured
on a bare crop rather than on a sheet; what stays open is narrower than QR-09 stated it: a
neighbour standing CLOSER than 4.3 mm.

⚠ **What this harness cannot measure about the quiet zone.** It renders the mark on blank paper,
so removing the 4-module quiet zone changes nothing it can see — with nothing beside the mark,
there is nothing for the quiet zone to hold off. The quiet zone's job is the masthead's
neighbours, and its proof stays where it is: `drive-198`'s geometry check, which reads the drawn
matrix and asserts four clear modules on every side.

## QR-10.5 · The equivalence proof, and the bug it caught on its first run

A 24-locator sweep cannot afford 24 Chromium boots, so the harness generates the batch itself —
and it is only allowed to because the anchor's matrix is compared **bit for bit** against its own
encoder's for the same payload. **A mismatch is fatal and the harness stops.**

It stopped. The first version generated with `segno` and the proof came back
**MISMATCH · 138 of 1369 modules differ**: two perfectly valid version-3-M symbols for the same
37-character payload — same mask, same format info, different data placement. Both scan. They are
not the same symbol, and the floor above would have been a number about a QR code Rocoto never
prints.

`print-view.tsx` draws with `qrcode.react@4.2.0`, which bundles **Nayuki's `qrcodegen`**. The
harness now generates with Nayuki's own Python port and the proof reads **IDENTICAL across 37 × 37
modules**. That is the difference between a measurement and a plausible-looking number, and it is
why the proof is a hard stop rather than a warning.

## QR-10.6 · Would a bigger mark or a stronger level help? — QR-02.1's fork, measured

`tools/qr-harness.py --geometry` re-runs the occlusion axes at nine geometries. The two levers are
different levers and the table separates them:

- **Error correction** buys back damaged data modules up to its budget, and buys **nothing** for a
  finder pattern.
- **Footprint** buys module SIZE, and module size is what decides how much of a finder pattern a
  three-millimetre drop covers. It is the lever that works on the failure we actually have.

Every cell is how many of the 24 locators decoded on **zxing-cpp** (the conservative column —
`either` is 24/24 for most of these rows and would hide the trend):

| ecc | px | mm/module | one 3 mm ink blot | three 3 mm | three 5 mm | ring-wide | 5% blot | 05:40 | 05:40 hard | ×0.20 res | σ3 blur |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **M** | **76** | **0.543** | **17** | **12** | **4** | **13** | **14** | **11** | **4** | **24** | **24** |
| Q | 76 | 0.490 | 19 | 13 | 9 | 13 | 11 | 9 | 5 | **0** | **9** |
| H | 76 | 0.447 | 19 | 15 | 7 | 14 | 11 | 9 | 5 | **0** | **0** |
| M | 96 | 0.686 | 20 | 18 | 9 | 12 | 15 | 8 | 12 | 24 | 24 |
| Q | 96 | 0.620 | 20 | 18 | 8 | 9 | 13 | 13 | 7 | 24 | 24 |
| H | 96 | 0.564 | 19 | 18 | 12 | 11 | 13 | 11 | 6 | 24 | 24 |
| M | 120 | 0.858 | 20 | 18 | 10 | 12 | 16 | 15 | 11 | 24 | 24 |
| Q | 120 | 0.774 | **24** | **22** | 13 | 10 | 13 | 14 | 9 | 24 | 24 |
| H | 120 | 0.706 | 21 | 21 | **14** | 12 | 12 | 14 | **16** | 24 | 24 |
| L | 76 | 0.543 | 17 | 12 | 4 | 13 | 14 | 11 | 4 | 24 | 24 |

**Three things this table settles.**

**1 · QR-02.1's argument was right, and here is the receipt.** Raising the level at the SAME
footprint buys occlusion and pays for it in module size — 38 bytes needs version 4 at Q and
version 5 at H, so the module falls to 0.490 mm and then 0.447 mm — and the resolution floor
**collapses from 24/24 to 0/24**, the blur floor with it. A mark that survives a fingerprint and
fails a photograph taken one step further back is a worse mark. **M at 76 px is the right corner
of this trade at this footprint**, and that is now a measurement rather than a capacity table.

**2 · Footprint is the lever that works on the failure we have.** Holding M and growing the mark
takes one 3 mm ink blot from 17/24 to 20/24 and three of them from 12/24 to 18/24 — with no
resolution cost at all, because a bigger mark at the same version has bigger modules. Q at 120 px
reaches 24/24 on one blot. Every gain in this table comes from millimetres, none from parity.

**3 · The mark cannot ship at level L, and nothing had noticed.** The L row is identical to the M
row because `qrcode.react` runs `qrcodegen` with `boostEcl` on: asking for L at a 38-character
payload returns a version-3 symbol at level **M**, since the version has room for it. Verified
directly — `encode_segments(…, Ecc.LOW, boost=True)` → `version 3, level M`. So the mark's floor
is protected by the encoder as well as by the spec, which is a good thing to know and a bad thing
to rely on: `PACKING_QR.ecc` still says M, `drive-201` still reds if it stops saying M, and a
longer payload one day would remove the accident.

**The decision.** The mark stays at **M, 76 px** for this round. It clears every floor in QR-10.1
with four to five times the margin the bar asked for, it reads the 05:40 morning whole, and the
one thing it does not survive — opaque ink over a finder pattern — is not bought back by either
lever at any size this masthead can hold. Changing `pagePx` is a masthead layout change (QR-02.1
already said so) that would move the printed sheet under seven concurrent builds; it is recorded
in QR-09 as the production move, now with its measured gain attached rather than as a hunch.

## QR-10.7 · The drive

`drives/drive-201-degradation.py` re-asserts this table offline in **19 seconds, 28 GREEN / 0 RED**
on 20 locators (a strict prefix of the 24, at the same seeds). It is fail-closed by construction:
it keeps no copy of the mark's parameters — `PACKING_QR` is read out of `packing-output.ts` and the
symbol is built from whatever is in there, with the app's own encoder.

**Proved red on purpose, in a throwaway copy of the tree:**

| Flip | What happened |
|---|---|
| `ecc: 'M'` → `'L'` | **1 red** — «the error-correction level is M or better» came back `L`. The floors themselves held, which is its own finding: at this footprint the occlusion floors are set by the DETECTOR finding the symbol, not by the ECC budget. |
| `pagePx: 76` → `56` | **9 reds** — the module fell to 0.400 mm under its own 0.50 mm floor, and with it the resolution floor (`0/20`), the blur floor (`0/20`), the sensor-noise floor (`1/20`), the stain floor, the 05:40 morning and two of the stated rates. This is the flip that shows the floor is load-bearing. |
| `quietModules: 4` → `0` | **1 red** — the parameter check. The sweep saw no difference, for the reason stated in QR-10.4. |

**A defect the harness found in itself, and the reason it is worth recording:** the first version
salted its random seeds with Python's built-in `hash()`, which for strings is seeded **per
process**. Two runs of the same drive, same seed, same variant, produced different dirt — 25 GREEN
on one run and 22 GREEN / 3 RED on the next. A degradation harness whose damage moves between runs
cannot state a floor at all: every red is «maybe the dice» and every green is «maybe the dice too».
It is `zlib.crc32` now, and the drive was re-run at three different `PYTHONHASHSEED`s to prove it.
