# THE PAPER SPEC — our own paper, read back

**Authority:** FEED-IA §198 and §199 (E196.10 · E196.11 · E196.12 · E196.20–22 · E196.30 · E196.31 ·
E196.50 · E196.51), standing on §191.1 — «A later paper photo may use that locator to align reviewed
final weights/prices».

**What this document owns.** The whole road for paper THIS HOUSE PRINTED: the packing sheet and its
four marks, the layout manifest recorded at print time, the registration of a photograph onto that
geometry, the classification of every box as written or untouched, the handwriting reader, the
answer's contract, the review a person accepts against, and the floor all of it was measured at.

**What it hands to its neighbours.**

| Neighbour | What it owns |
|---|---|
| [THE-PARSING-SPEC](THE-PARSING-SPEC.md) | paper somebody ELSE printed — a supplier's albarán, a catalogue, a stock sheet — through Parsewise (`/api/parse`), and the latency of that road |
| [THE-QR-SPEC](THE-QR-SPEC.md) | the mark itself: payload, symbol, placement, the register of marks issued, the mark's own degradation floor, and the corner marks' geometry (QR-07) |
| [THE-RUNTIME-SPEC](THE-RUNTIME-SPEC.md) | the service the three paper endpoints live in — CORS, secrets, journal discipline, deploy |
| [THE-SOURCE-PRIVACY-SPEC](THE-SOURCE-PRIVACY-SPEC.md) | custody of anything the house sends outside itself |

**Where it lives.** `mock-api/app/paper.py` (the endpoints and the contract as types),
`mock-api/app/register.py` (the geometry and the classification), `mock-api/app/handwriting.py` (the
reader seam), `app/src/prototypes/cedar/paper-manifest.ts` (the print's own measurement),
`app/src/prototypes/cedar/packing-output.ts` (the register of marks), `app/src/prototypes/cedar/print-view.tsx` (the
sheet), `app/src/prototypes/cedar/paper-read.ts` and `paper-read-back.tsx` (the review and the accept),
`tools/paper-harness.py` (the end-to-end proof). PAP-10 maps every file.

---

## PAP-00 · The law

### PAP-00.1 · §198 — flawless, and proven with no printer (Peter, 2026-09-04)

> for the parsing and qr shit, which should work flawlessly (we're way past the dawn of the era of
> IoT and machine recognisable documents and QR codes to make shit work, like fucking lime bikes and
> shit are on a QR basis for a decade so like yeah i expect this to be fully working when we wire
> everything, as long as you design it all well, spec it well etc so that when you build and test
> it's piss play cos you can even test it by exporting and downresolutioning and even muddling or
> adding fake dirt to the image and then running it through scanning all programmatically without
> requiring me to print and test) not sure what youre using. i have no idea. maybe we need an api.
> idk. maybe use parsewise so its solid cos like im not sure that for the tabular data if claude ocr
> will bebest. how do u set it o recognise standard formats and stuff? and the qr code generation
> and reading is a spec in its own, but i expect us to handle it all alongside eveyrthing else.
>
> /goal just do the job ok?no need to ask me shit. choose the best approach

### PAP-00.2 · §199 — read our own paper back (Peter, 2026-09-04 evening, voice, transcribed)

> Imagine these people taking half-assed photos of documents. They might be okay, but imagine they're half-assed, and we need to exactly match it to the stuff that they found it in. Meaning, the stuff they found it in, we need to exactly match it to write it in.

> Meaning, everything they have to do: if they're printing out a document and then they handwrite on it, and then they take a half-assed photo at a wrong angle with bad lighting, we need to automate it perfectly to the actual data that they handwrote (because a human is able to do that). We want to cut that out completely.

> That's the thing that's absolutely what we need to do too. That's why we said the QR thing, so we can match it well, but then there's the stuff inside of that. One QR code isn't going to have a single order on the paper. There are multiple orders on the same paper, so how do you make sure that we actually match them together? That's why one is knowing the format that we ended up printing, so that the document is comparing some known thing rather than just it being essentially new data for it. In this case, we would know: in that part of the paper, there would be something about this project, and in that part of the paper, something about that project.

> I don't know how. Once it's our data, it should be able to be recognized far better than anything else. If it's in that part of the sheet, it's probably about this project, and all of that shit.

**Read as law (FEED-IA §199.1 · §199.2 · §199.3, verbatim):**

- **§199.1 · Our paper is read against what we printed, never as a stranger's document.** Parsewise (§196.5) stays for paper we did not print — a supplier's albarán, a catalogue, a stock sheet. For OUR packing list the pipeline is different in kind: the print already carries the mark (THE-QR-SPEC) and the house remembers what it put on the paper (QR-06); from now on it also remembers **where** — a layout manifest per page in millimetres (every order block, every line row, every cell, the QR and three corner marks). The photo is registered onto that geometry (QR + corner marks → homography → rectified page), each known cell is cropped where the manifest says it is, cells that carry new ink are read as handwriting with the printed context in hand («the final-weight cell of line “Merluza · 12 kg”»), and the reading lands on the exact line id. Multiple orders on one sheet are matched by position, which is the manifest's job, not the reader's guess.
- **§199.2 · Half-assed is the design point.** Wrong angle, bad light, shadow, blur, a phone-downscaled JPEG: the harness (§198) prints the real paper from the kit, writes into the cells with many hands, ruins the photo on purpose, reads it back and asserts the exact handwritten values per cell. The floors are pinned and fail closed.
- **§199.3 · The reader.** Handwriting cells are read by a vision model behind one provider seam: Gemini 2.5 Flash reads today (the key the house holds answers); Claude is the first choice the moment the API credit exists. Every reading carries its crop as evidence, so the person accepts against the ink, never against a number alone.

### PAP-00.3 · The answer, in one paragraph

Our paper is read against what we printed. The packing sheet records, at the moment it is drawn, the
millimetre rectangle of every box it put on the page, and hands that record to the runtime. A
photograph of that sheet then has to answer ONE question — where is the page in this picture — and
every cell after that has an address rather than a hypothesis. The reader is asked «what is written
in this 18 × 6 mm box», with the row's own product and printed amount beside it. Paper this house
did not print takes the other road: `POST /api/parse`, Parsewise, [THE-PARSING-SPEC](THE-PARSING-SPEC.md).
A photograph whose code names no sheet this runtime holds is answered **422** with the sentence that
opens that road.

| The paper | The road | What it answers |
|---|---|---|
| ours, printed through the kit | **`POST /api/paper/read`** — this spec | which box, exactly, and what is written in it |
| anybody's — a supplier's albarán, a price list | **`POST /api/parse`** — THE-PARSING-SPEC | what the table says, inferred |

---

## PAP-01 · The paper we print

### PAP-01.1 · The packing list

One block per order, one row per line, drawn by `print-view.tsx` and paginated by `el papel`'s own
arithmetic. The one-column sheet carries a **Final weight** column — 88 px wide, the albarán's own
width, printed EMPTY, its head naming what belongs in it and the row's own hairline as the line to
write on. No box is drawn inside the cell: a printed rule is ink a vision model then has to tell
apart from a person's (QR-07.4).

**The two-lane sheet keeps its six columns.** Two columns is a density choice — twice the picking on
one sheet — and eight tracks on A5 would leave a goods lane 48 px wide. Its manifest reports rows
with their printed amount and **no** `finalWeight` rectangle, which tells a reader this paper is for
picking rather than for writing on (QR-07.4).

Both papers: **A4 210 × 297 mm** and **A5 148 × 210 mm** (`PAGE_MM` in `paper-manifest.ts`).

### PAP-01.2 · The mark

THE-QR-SPEC governs it whole and nothing here changes it. What this road uses:

| Parameter | Value | Source |
|---|---|---|
| Payload | `rocoto:document/packing/v1/<token>`, token `^[a-z0-9]{1,13}$` | QR-01 |
| Version | 3 — **29 × 29 modules** | QR-02 |
| Error correction | level **M**, 15 % recovery | QR-02.1 |
| Quiet zone | **4 modules**, drawn INSIDE the mark's own box | QR-02 |
| Drawn box | 29 + 2 × 4 = **37 modules**, 76 CSS px, **20.1 mm** on the printed sheet | QR-02, measured by `drive-196-paper-manifest.py` at `20.10 × 20.10 mm` |
| Module | **0.54 mm** on A4 and A5 alike | QR-02 |
| Place | the top right of the packing masthead | QR-03 |
| Pages | page one only — the mark lives in the masthead | QR-07.6 |

### PAP-01.3 · The three corner marks

| Parameter | Value | Why |
|---|---|---|
| Shape | a filled square | Nothing to decode and nothing to orient. Its centroid is stable under threshold, which is the only property the homography uses. |
| Side | **6 mm** | 11 px at 300 dpi print, about 20 px in a 12 MP phone frame of a whole A4. Small enough to live in the paper's margin, large enough that a centroid survives σ 3 blur. |
| Inset | **5 mm** from each of its two edges | Inside the sheet's own 10.6 mm margin, so a mark stays out of the text measure. |
| Corners | **`tl` · `bl` · `br`** | The mark holds the top right, so the squares take the other three. |
| Colour | `contentPrimary` on `backgroundPrimary` | The same ink as the rest of the sheet; the theme gate enforces it. |
| Pages | **every page** | A photograph of page two is a photograph of a page. |
| Papers | A4 and A5 alike | 5 mm is 5 mm, and the sheet's margin is 40 px on both. |

Constants: `REGISTRATION = { sizeMm: 6, insetMm: 5, corners: ['tl', 'bl', 'br'] }` in
`app/src/prototypes/cedar/paper-manifest.ts`.

**Why four points.** One mark gives a reader one corner and a scale. A page photographed at arm's
length over a bench is seen through a perspective — near edge longer than far edge, tilt in two axes
at once. Recovering that needs a **homography**, and a homography needs **four** point
correspondences. Four points at the extremes of the sheet are the best-conditioned four a page can
offer: the further apart the points, the less a pixel of detection error moves the rectified grid.

**Why `tl` and not `tr`.** Spread. With the mark at the top right, `tl · bl · br` place the four
points across the whole sheet; `tr` would put two of them 13 mm apart and leave the left-hand edge
unconstrained. ⚠ **The clear-paper argument QR-07.2 offers alongside it does not survive
measurement, and the code wins.** The verifier measured the gap between the mark's right edge
(178.0 mm) and a `tr` square at the spec'd inset (199.0 mm) at **21.0 mm** — more than the one
mark-width of white QR-10.4 reads 24/24 at — then drew the square and watched QR-10.4's own
assertion stay green with it standing there (`report-verify-e196-1.md` §4). The spread argument is
the real one. QR-07.2's clear-paper sentence is owed a rewrite (PAP-09).

**Print safety, as a number.** A consumer laser printer refuses the outermost ~4–6.35 mm of a sheet.
A mark runs from 5 mm to 11 mm from the edge, so its **centroid sits 8 mm in**, and the reader's own
detection is centroid-based for exactly that reason.

**What the marks are NOT.** They carry no information at all — same square, same size, same place on
every page of every run. They are geometry.

---

## PAP-02 · The manifest

### PAP-02.1 · Recorded at print time, measured off the page

`measurePackingManifest` in `app/src/prototypes/cedar/paper-manifest.ts` reads the geometry off the **rendered
print DOM** at the moment the mark is issued, through five inert attributes:
`data-paper-sheet · data-paper-mark · data-paper-order · data-paper-name · data-paper-cell`.

**Why measured rather than computed.** `el papel` paginates by arithmetic and must: a page count has
to be stable without a browser. But where a CELL lands is the browser's own answer — grid tracks, a
wrapping name, a sub-line, a two-line customer. A manifest computed from constants would be a
second, quieter layout engine, and it would disagree with the page the first time type wrapped.

**Why a preview may record it.** The sheet is drawn at life size and transformed into its stage, so
every measurement is taken as a fraction of the sheet's own rendered box and multiplied by the
paper's real millimetres. A preview at 60 % and the print host at 100 % therefore produce the SAME
manifest — asserted at ±0.1 mm by `drive-196-paper-manifest.py`.

**When it answers nothing.** No sheet, no mark, an unmeasurable box, or a run whose pages drew no
rows: the function returns `undefined` rather than a half-manifest. A manifest describing a page
that was never drawn would send a reader cropping at coordinates nothing was printed at.

### PAP-02.2 · The contract, exactly

```
{ version: 1,
  locator: "rocoto:document/packing/v1/<token>",
  token: "<token>",
  day: "YYYY-MM-DD",
  paper: "A4" | "A5",
  pageMm: { w, h },
  marks: { qr:      { x, y, size },
           corners: [{ id, x, y, size }, …3] },
  pages: [{ index,
            blocks: [{ sale, number, customer,
                       rows: [{ line, product,
                                printed: { qty, unit },
                                cells:   { finalWeight: {x,y,w,h},
                                           qty?:        {x,y,w,h},
                                           unit?:       {x,y,w,h} } }] }] }] }
```

All geometry is **millimetres from the page's own top-left**, page-local, rounded to two decimals by
the kit (`mm()`).

| Field | What it is | Units and caps |
|---|---|---|
| `version` | the contract's own generation | literal `1` |
| `locator` · `token` | the payload the paper prints and its typed half | token `^[a-z0-9]{1,13}$`, lower case; the locator spells out its own token |
| `day` | the day the run was drawn | ISO `YYYY-MM-DD`, parsed with `date.fromisoformat` |
| `paper` · `pageMm` | the named paper and its own millimetres | must agree to **5 mm** |
| `marks.qr` | the mark **as drawn**, quiet zone included | `size` 20.1 mm on the kit's sheet; a producer reporting the symbol alone reads too (PAP-03.2) |
| `marks.corners` | the three squares, page-local | exactly **three**, each with its own id from `tl · tr · bl · br`, side 6 mm |
| `pages[].index` | the page's position in the run, **from 0** | the folio printed on the paper says `index + 1` |
| `blocks` | one per order ON THAT PAGE, with the order's number and customer | an order running over a page break has a block on each page, each holding only that page's rows. **This is the answer to «multiple orders on the same paper»: position, recorded.** |
| `rows[].line` | **the kit's own line id, carried whole** | a string (`l1`) or a number, unchanged both ways |
| `rows[].product` · `printed` | the goods and the amount AS PRINTED | so a reading is asked for in the paper's own words |
| `cells` | the rectangles to crop | `finalWeight` required; `qty` and `unit` optional. A cell the paper does not carry is **absent** — a rectangle where there is no cell would have a reader cropping blank paper and answering about it. |

**⚠ `line` IS THE KIT'S OWN ID AND IT TRAVELS UNCHANGED.** The kit prints `l1 · l2 · l3` and its
`ManifestRow.line` is a string. The first runtime typed it `int` and every POST came back
`422 line: Input should be a valid integer`. Found the first time both halves stood in one tree
(`report-verify-harness.md` §1.7(1)). It arrives as it was printed and comes back on every reading as
it was printed.

### PAP-02.3 · What the runtime refuses, by name

`Manifest` in `mock-api/app/paper.py`, validated with pydantic against the way the read will use it.

| The rule | Why it is a rule and not a preference |
|---|---|
| the locator spells out its own token | one string, two places to disagree |
| the token is `^[a-z0-9]{1,13}$` | QR-01 · QR-05.4 — the grammar the paper prints and `parsePackingLocator` accepts |
| `day` is a calendar day | it is answered back as `matched.day` |
| `paper` and `pageMm` agree to **5 mm** | A4 declared with A5 millimetres is 87 mm of silent error; 5 mm forgives rounding |
| exactly **three** corner marks, each at its own corner | three plus the mark is four points, and four is what a homography needs |
| every mark and every cell stands on the page (+0.5 mm) | a cell off the paper is a crop of nothing |
| **`(sale, line)` is unique across the whole document** | it is the address a reading comes back on |
| at least one line to read | a manifest of nothing describes nothing |
| `finalWeight` is present on every row | it is the box the sheet goes out to have filled in |

`qty` and `unit` are optional, and **extra fields are carried rather than refused** — RUN-02's rule,
that a producer may state more than a consumer reads.

**AND THREE NAMED FIELDS DEFAULT TO EMPTY RATHER THAN BEING REQUIRED**, which the table above owes
its reader explicitly: `Block.number`, `Block.customer` and `Row.product` are listed in the contract
and a manifest may omit any of them. They are printed on the paper for a PERSON, and the reading
comes back on `(sale, line)` — so a sheet whose template prints no order number is still a sheet
whose boxes can be read, and refusing it would refuse real paper for a caption. The tolerance lives
in the pydantic model's own defaults; it is written here so nobody has to read the model to find it.

**`line` IS A STRING OR A NUMBER, AND IT TRAVELS UNCHANGED.** The kit prints `l1 · l2 · l3` and the
runtime types `line: str | int` with a validator; the reading comes back on exactly the characters
the paper carried. The first tree that held both halves refused every manifest with «line: Input
should be a valid integer», which is why the type is written here rather than guessed twice.

**`cells.finalWeight` IS REQUIRED ON BOTH SIDES.** A row with no final-weight rectangle is not
readable paper — that box is the reason the sheet goes out — so `measurePackingManifest` DROPS such a
row rather than posting a manifest the runtime is right to refuse, and a page left holding no rows
records no manifest at all. Settled at RELEASE-195, after the kit typed it optional and the runtime
required it: the sheet in a person's hand would have gone silently unreadable on the first template
that printed no final-weight column.

**All four corner ids are accepted, and exactly three are required.** The paper uses `tl · bl · br`
today. The geometry comes from each mark's own millimetres, never from its name, so a sheet marked at
either top corner reads (`CORNER_IDS` in `paper.py`).

### PAP-02.4 · Where it is kept

**In the runtime.** `POST /api/paper/manifest` stores it by token under `settings.manifests_dir()`,
one JSON file per token, stamped `storedAt`. `GET /api/paper/manifest/<token>` gives one back, and
`404 manifest_unknown` where nothing is held.

**Retention: 30 days** (`ROCOTO_PAPER_MANIFEST_DAYS`, `store.sweep_manifests`), swept by file mtime on
every write. It describes a sheet somebody is holding this week; a reprint starts that life again,
because the sweep is by mtime rather than by day.

**In the browser.** `packing-output.ts` keeps the register of marks this house has issued:
**200 locators** (`MARK_CEILING`) and the layout of the most recent **20** (`MANIFEST_CEILING`). A
browser gives one origin about five megabytes and a busy morning's manifest is tens of kilobytes; the
house needs to RECOGNISE two hundred papers and to READ the ones still in circulation. An older paper
still resolves by its mark, and its layout is the runtime's copy to hold.

### PAP-02.5 · Offline, and the retry a warehouse actually performs

A kit with no runtime in front of it still prints, still issues the mark and still keeps the layout.
`sendPackingManifest` journals which of the two is standing, in a sentence about where the layout IS
(`MANIFEST_SAID`):

- `sent` — «The runtime holds the layout of this paper.»
- `held` — «This device holds the layout of this paper, ready for the runtime.»

A held copy is offered again the next time the same paper is drawn, which is the retry a warehouse
actually performs: it prints the sheet again. The journal is `rocoto-paper-manifest-journal-v1`, 200
entries, and a journal that cannot be written costs the sentence rather than the manifest.

### PAP-02.6 · The re-record rule — a re-drawn paper re-records

A locator is a fold of the sale REVISIONS, so it does not name the paper. An operator who previews on
A4 and then switches to A5 in **Paper & copies** was therefore keeping the A4 geometry, on the device
and at the runtime: proved twice by the verifier, with the sheet in the person's hand at 148 × 210
over two pages while both copies held a one-page 210 × 297 record whose every crop rectangle
described a page that was never printed (`report-verify-e196-1.md` §3).

**The rule the repair makes:** `rememberPackingMark` is idempotent on the SAME drawing and replaces
the layout on a DIFFERENT one — the journal is keyed on the manifest's own content rather than on the
token alone, and the hour the mark was issued at survives every re-drawing, because the mark is the
same mark. A drawing that measured nothing leaves a layout already held standing.

⚠ **This repair lives on `codex/english-e196` (commit `e354378d1`) and is not on this branch.** It is
the merge this spec expects; PAP-09 carries it as owed until then.

### PAP-02.7 · What is opaque, and what is not

§191.1 fixes what the browser's register may hold, and `drive-198-parsing-qr.py:391` asserts it:
**no goods, no customer, no money.** When E196.11 put the manifest into that register, the register
started carrying the words — dumped from a real run by the verifier:

```
BLOCK IDENTITY {"sale": "d3-can-ferrer", "number": "2508-2144", "customer": "Can Ferrer"}
FIRST ROW      {"line": "l1", "product": "Pulpo", "printed": {"qty": "8", "unit": "kg"}, …}
WORDLIST HITS  {'merluza': True, 'pulpo': True, 'price': False, '€': False}
```

The release suite went **294 → 280 GREEN / 14 RED**, and causality was proved by disabling only
`measurePackingManifest`'s return in a copied bundle and watching it come back to 294/0
(`report-verify-e196-1.md` §2).

**THE DECISION: the browser's copy is geometry and ids; the words live in the runtime's copy.**
`opaquePaperManifest` is the projection that keeps §191.1, and `layoutWithoutWords` drops whole any
layout an earlier build wrote with the paper's words in it — the next drawing of that paper measures
a fresh one. The runtime's copy carries `product`, `printed`, `number` and `customer`, because that
is what a reader is given as context and it travels from the house's own kit to the house's own
runtime. `drive-198-parsing-qr.py` reads the whole register back looking for a word.

⚠ **This repair lives on `codex/english-e196` (commit `e354378d1`) and is not on this branch.** The
second half of that finding — `drive-198`'s stub answering `POST /api/paper/manifest` so the kit's own
new traffic stops logging a 404 — belongs with it.

---

## PAP-03 · The photograph, and the page inside it

`register.register(photo, manifest, qr)` in `mock-api/app/register.py`. Nothing here retains anything:
the photograph is a numpy array for the length of one request.

### PAP-03.1 · Decode the mark

A ladder ordered by cost. Every rung maps its answer back into the ORIGINAL photograph's pixels, so a
mark found in an upscaled tile is still four points on the photo, which is what the homography needs.

| Rung | What it is for | Guard |
|---|---|---|
| `raw` | the photograph as it arrived — nearly always enough | — |
| `contrast` | CLAHE (clip 3.0, 8 × 8) on the luminance: a sheet under one strip light with half in shadow | — |
| `binary` | Otsu: a washed-out phone photo that local averaging smears | — |
| `sharpened` | a 5-centre unsharp cross. **It alone brings back a mark under gaussian σ 2.0** | — |
| `upscaled` | 2× the whole frame, for a sheet photographed from far away | frame ≤ 4000 px |
| `sharp-upscaled` | sharpened and tripled. **Reads down to 1.9 px per module where every rung above stops at 2.3** | frame ≤ 2600 px |
| `tile` | 2× each of five overlapping half-frames: a wide shot of a crate with the sheet in one corner | — |

The rung that answered is carried on `QrRead.road` and lands in the journal.

### PAP-03.2 · Find the three squares

Grayscale → adaptive threshold → contours → solid near-square blobs of the size the manifest implies.

| Filter | Value | Why it is loose |
|---|---|---|
| `MARK_SIZE_TOLERANCE` | `(0.35, 3.20)` of the expected side | the size is read off the mark, which sits at ONE corner, so on a leaning page the far marks are genuinely smaller and the near ones bigger — measured 2.3× on the harness's steepest sheet |
| `MARK_FILL_MIN` | `0.72` of its own bounding rectangle | a solid square fills its box |
| `MARK_ASPECT` | `(0.40, 2.55)` | at 41° a 6 mm square photographs as a 59 × 109 px trapezoid, an aspect of 0.55; a tighter bound threw away two true marks |
| `MARK_CANDIDATES_PER_CORNER` | `6` → **216 combinations, exhaustive** | cheaper than sampling, and the SCORE decides rather than a distance cut-off |

**The mark's own guess RANKS the candidates; it rules none out.** A homography fitted to a 20 mm
square and asked about a point 290 mm away lands **415–435 px** out on the harness's own sheet, and
every cut-off tried on that number threw away true marks somewhere else on the sweep.

⚠ **That guess is a SIMILARITY — a turn, a scale and a shift — and it used to be a projective fit,
which was a defect.** On a 1600 px photograph of an A4 sheet the mark's symbol measures 77 px and the
decoder reports its corners rounded to whole pixels. Fitting eight degrees of freedom to four points
of a 77 px square turns one pixel of rounding into a perspective term. A similarity cannot invent
perspective, so its worst error over a page is the mark's own scale error: about one per cent, 3 mm
at the far corner. **On a FLAT, undamaged photograph the pre-fix code refused a clean page**
(`report-verify-harness.md` §1.7(2), reproduced: `2400 tilt 0 register NONE` before, `marks 4 err
0.16mm` after).

⚠ **AND THE CAUSE IS NOT WHAT THE OLD PARAGRAPH SAID.** The verifier measured the prediction error at
**420 px (85 mm) projective against 342 px (69 mm) similarity** — the shortlist tolerates both, and
flipping only the anchor back does not re-break it. **The refusal came from the page self-check**
(PAP-03.4), which read `verify 0.165` against a floor of 0.45. Right fix, wrong reason: a future
reader tuning the shortlist would tune the wrong knob.

**Two honest readings of `marks.qr.size`, and the runtime needs neither.** QR-02 draws the quiet zone
INSIDE the mark's box, so 20.1 mm is 37 modules and the symbol is the middle 29 of them; a producer
reporting the symbol alone would be equally defensible. Both conventions (`drawn` and `symbol`) are
tried and the one that fits is kept. The final homography is fitted from **four mark CENTRES**, and a
centre is the same point under either reading.

### PAP-03.3 · Score, and the match gate

Two things must agree for a triple to be accepted: the fitted homography puts the mark's own four
corners back where the decoder found them — compared **scale-free, about the centre**, so the size
reading above cannot pollute the score — and each blob is the size a 6 mm square would be at that
spot.

**`MARK_MATCH_ACCEPT_MM = 1.5`, and it fails closed.** ⚠ Without it the search returned the least-bad
triple it could find: on a low-resolution sheet it picked three blobs that were not the marks,
reported «four marks found», and produced a homography **54 mm out** — a confident answer addressed to
the wrong boxes, which is the one failure a person cannot catch by looking. A triple that misses the
gate drops to the code-only road.

⚠ **The separation quoted for that gate has two measurements and they differ.** `register.py`'s own
docstring says a true triple lands at **0.61–0.67 mm** and a false one at **3.3–9.9 mm**; the prose
this spec inherits says **0.43–0.69 mm** against **7.9–68.6 mm**. Both put 1.5 mm between the two
populations, and the code's number is the one measured against the code. PAP-09 carries the
re-measurement.

### PAP-03.4 · The page checks itself, with no ground truth

After rectification the three squares either ARE at their manifest positions or the registration is
wrong. One measurement catches every route to being wrong at once: a mis-decoded mark, a blob that was
not a mark, a homography fitted to the right blobs in the wrong order.

| Reading | Constant | What happens |
|---|---|---|
| dark share inside a mark's box, against 55 % of the paper's own 90th-percentile brightness | `VERIFY_DARK = 0.55` | the measurement |
| ≥ **0.70** | `VERIFY_GOOD` | the page stands |
| 0.45 – 0.70 | | it is read, `confidence_scale` drops to **0.45**, and it SAYS «read off a page that lay at an angle; check each crop against the paper» |
| < **0.45** | `VERIFY_REFUSE` | nothing is read |

⚠ **A mark the homography puts OUTSIDE the photograph is skipped rather than failed.** Somebody who
photographed half a sheet cropped the corners away, and rectification fills that region with white
paper. That is a partial photo, and a page where none could be asked is a page this check has nothing
to say about — which is the code-only road, standing on its own.

### PAP-03.5 · The code-only road

With the three squares out of frame the page is still located from the mark's own four corners — four
points on the same plane. Measured, that road lands cells **0.9 to 8.9 mm** out, which is more than a
row is tall. So it multiplies every written reading's confidence by **0.4** and says, in `check`:
«read from the code alone; a photo showing all four marks places every box exactly». It is a
fallback; four marks is the plan.

### PAP-03.6 · Rectify, and report quality

The page is warped to a canonical raster at **`PX_PER_MM = 8.0`** — **203 dpi**, above the density at
which a 2 mm pen stroke closes up, and a quarter of the memory of a 16 px/mm page for a reader that
gains nothing from it. A 20 × 6 mm final-weight box becomes 160 × 48 px, which is a legible crop on
its own.

`Registration.quality` carries three numbers:

- `tiltDeg` — from the homography under an **assumed** focal length (`max(h, w)`), so it is honest
  about magnitude rather than about the third decimal. Named as an estimate.
- `blurScore` — variance of the Laplacian over the rectified page.
- `lightScore` — the 5th-to-95th percentile spread over 255.

### PAP-03.7 · Which page

One token covers every sheet of a run, so the mark names the DOCUMENT. `choose_page` picks the sheet
by how well each page's rendered printed values explain the ink actually found, and `evidence.page`
states the choice with its margin. A single-page document skips the question.

**A thin margin is a fact a person is told.** Below **0.05** every reading carries «the page was
identified from its printed values and a second page scored close» and its confidence is multiplied
by **0.85**.

⚠ **On the kit's glyph-tight printed cells that score saturates.** Every page's band covers its whole
cell, so a photo of page one scores 1.000 against BOTH pages and the choice falls to the first —
which is the page the mark is on and the only readable one today. The day a fourth mark lands on
later pages (QR-07.6, owed in QR-09), `choose_page` has to discriminate for real, and on glyph-tight
cells it cannot. The manifest change PAP-09 already owes — a printed value's COLUMN as well as its
ink — is what would give it something to measure.

### PAP-03.8 · The refusal

A photograph whose mark will not decode, or whose token names no manifest this runtime holds, is
answered **422 `paper_unknown`**:

> The code on the packing sheet names the page this reads. Photograph the sheet with its code in the
> frame, or send the page to the document reader.

The kit reads that as an answer rather than a fault (`RuntimeRefused`) and opens the Parsewise road.
The same sentence answers a photograph of **page two**, which carries the three squares and no code:
a page with no code names no document, and this endpoint reads nothing it cannot address.

---

## PAP-04 · Written, or untouched

`register.observe(registration, page, floor)`. Two kinds of box, two rules, and **every threshold is
asked of the page in hand**.

### PAP-04.1 · How a box is looked at

- The reader's crop takes **`CROP_MARGIN_MM = 1.5`** of paper around the box: a pen leaves the box,
  and 1.5 mm brings back the tail of a 7 and the top of a 4 without dragging in the neighbouring row.
- The ink is measured **`INK_INSET_MM = 0.8`** INSIDE the box, which clears the printed rule on its
  edge and the compression halo around it. ⚠ **On a printed value the inset is applied DOWN the box
  only.** Sideways it would eat a 2.64 mm-wide printed cell alive: the value renders into eight
  pixels, `expected` collapses, and the belt fires on every untouched row — measured, **eleven phantom
  corrections on one page**.
- Ink is an adaptive threshold over the rectified page: a Gaussian window of `INK_BLOCK_MM = 6.0`
  (wide enough to hold a whole glyph) at `INK_BIAS = 10` grey levels below the local mean.

### PAP-04.2 · A box printed empty — the learned floor

The final weight is written when its ink beats a floor read off **this page's own** untouched boxes:

```
base  = 20th percentile of every finalWeight cell's ink share on this page
floor = max(base + 0.010, base × 2.5 + 0.004)      clamped to [0.006, 0.030]
```

`FLOOR_STEP = 0.010 · FLOOR_FACTOR = 2.5 · FLOOR_BASE = 0.004 ·
FLOOR_ABSOLUTE_MIN = 0.006 · FLOOR_ABSOLUTE_MAX = 0.030`.

A fixed threshold would be wrong on every photograph, because paper, exposure and JPEG quality all
move what a blank box measures. **The clamps hold both ends.** Below 0.006, JPEG speckle reads as a
pen. Above 0.030, a sheet where every box was filled in would learn its own handwriting as the
baseline and **report a blank page** — the failure that matters most, because nobody would notice it.

⚠ **AND WHAT THE LEARNING BUYS IS SMALLER THAN AN EARLIER DRAFT CLAIMED. Here is the measurement.**
On every clean, blurred, darkened, JPEG-crushed AND DIRTY page this harness makes, a bare constant of
**0.010 classifies identically** to the floor read off the page — token by token, mistake for
mistake, at 0 · 0.0005 · 0.001 · 0.002 · 0.004 · 0.006 specks per pixel on three sheets. The
learning is not what makes those pages read, and an earlier draft's «two mistakes against five on a
dirty sheet» was measured before the band and outside-ink belts were repaired; it does not survive
them. What the RANGE still buys is real and is asserted: on a dirty page the floor climbs to its
0.030 clamp and reads **four** boxes wrong where the range's own bottom (0.006) reads **five**.

So the floor read off the page is a **POSTURE** for photographs this harness has not produced —
paper, exposure and compression do move what a blank box measures — bounded at both ends so it can
never do worse than the constants it sits between. The clamp is where it earns its place: a sheet
somebody filled in completely, where the percentile IS a handwritten box.

### PAP-04.3 · The area floor — two square millimetres of ink

⚠ **A SHARE OF A BOX IS NOT A MEASURE OF A PEN.** The same handwritten «2» is 12 % of a narrow box
and 3 % of a 23 mm one. Measured on the harness: on a sheet where every final-weight box was filled
in — the case the 0.030 ceiling exists for — the learned floor sat AT that ceiling and a thin «2» in a
23 × 5.3 mm box measured **0.0295**. It was reported untouched by five parts in ten thousand, and
that line would have gone out with no weight on it.

**`MIN_INK_MM2 = 2.0`** is one small digit's worth of stroke. JPEG speckle over that same 123 mm² box
measures 0.6 %, which is 0.7 mm² — a factor of three apart, in a unit that does not move when the
column does. So the floor a cell actually faces is:

```
here = max(FLOOR_ABSOLUTE_MIN, min(page_floor, MIN_INK_MM2 / cell_area_mm2))
```

### PAP-04.4 · A box printed with a value — read in its SEAT

⚠ **A PRINTED VALUE IS READ IN ITS SEAT, NOT IN ITS GLYPHS.** The kit measures a printed value's
rectangle as the value's own ink — «8» is **2.64 mm** wide (`print-view.tsx`'s `amountSeats`) —
because that is what lets a reader be asked about the number apart from the unit beside it. A hand
correcting that number does not write inside 2.64 mm; it writes 10 to 16 mm of digits across the seat.
Reading each glyph's own box got both directions wrong at once on one page: **two real corrections
invisible** and **three phantom ones** on rows nobody touched.

`_seat(row, name)` builds the paper a printed cell is actually read in:

| Step | Constant | What it does |
|---|---|---|
| join | — | every printed cell of the row, joined into one rectangle |
| widen | `HAND_REACH_MM = 30.0` | «8 kg» is 11.6 mm and «6,25» in the same hand is another 9; 30 mm is the joined amount plus a correction on either side |
| stop | `NEIGHBOUR_GAP_MM = 0.5` | half a millimetre short of any other cell the manifest names, so a weight written in the final-weight box is never read as a correction to the quantity |
| rebalance | — | **what one side cannot give, the other may**: an amount with a cell hard against its right has all its room on the left, and that is where the hand goes |

A row with no room stays exactly as it was drawn.

### PAP-04.5 · The band, and the paper's own furniture

`_seat_band` renders each printed value in its OWN rectangle inside the seat — across the box, the
union of the three horizontal alignments, because a short value in a wide box leaves real gaps and a
hand writing «14» beside a printed «12» writes in one; down the box, full height, because vertical
placement is exactly what the manifest does not state and a one-millimetre difference read as
handwriting the first time this ran.

| Masked with the values | Constant | Why |
|---|---|---|
| 1 mm around each printed cell's edges | `PRINTED_BAND_DILATE_MM = 1.0` | a house that rules its boxes draws a hairline on the very line the manifest reports. On the runtime's own fixture that hairline stood as a one-pixel column in the middle of a seat and called an untouched quantity corrected. |
| any gap of 4 mm or less between two printed cells of one amount | `SEAT_GAP_MM = 4.0` | «12 kg» is one thing on the paper. A wider gap is real paper and stays visible, because a hand may use it. |

**THE BAND'S OWN WIDTH IS MEASURED, and re-measured on the merged tree at RELEASE-195.** Six sheets
(`k3m9x2p7qa1 · f4y8s3n6wm1 · dl1bl2ur3mx · ii1jj2kk3ll · aa1bb2cc3dd · zz9yy8xx7ww`), three hands
each, the constant moved and the boxes that come back wrong counted:

| `PRINTED_BAND_DILATE_MM` | σ 1.3 | σ 1.8 | σ 2.0 |
|---|---:|---:|---:|
| 0.0 (ungrown) | 5 | 5 | 5 |
| 0.25 | 0 | 1 | 1 |
| **1.0 — shipped** | **0** | **0** | **0** |

Identical on all six sheets. **σ 2.1 is left out of the table on purpose**: two of these sheets do
not REGISTER at that blur, so a count taken there is a count taken on a sheet that got lucky, and
PAP-08's own floor is σ 2.0.

⚠ **AN EARLIER DRAFT SAID «ungrown, the count runs 0 · 1 · 2 · 3 as the blur goes σ 1.3 · 1.8 · 2.0
· 2.1» AND «from 0.25 mm up every box is right at every one of them».** Neither survives this tree:
the ungrown count is five and flat, and a quarter-millimetre band still misses one box at σ 1.8. The
old sequence was taken on ONE sheet written by ONE hand, before the outside-ink belts were repaired.

**Ink outside all of that is masked with the band's own halo — `PRINTED_OUTSIDE_HALO_MM = 0.25`.**

⚠ **IT IS A STATED MARGIN, NOT A MEASURED SAVE — and so was the erosion it replaced.** Both were
written to stop a blur halo reading as a pen, and neither has been watched doing it:

- **The halo mask, measured with nobody writing on the page:** phantoms **0 of 18** under the shipped
  mask, under no mask at all, and under the old 3 × 3 erosion alike, on both fixtures, at σ 1.3, 1.8
  and 2.0 and at JPEG 45 and 85. Nothing committed goes red if `PRINTED_OUTSIDE_HALO_MM` is deleted.
  Whatever σ 1.8 once did is covered today by the furniture mask, the area floor (`MIN_INK_MM2`) and
  the saturated stand-down; `register.py`'s docstring says exactly that.
- **The 0.25 mm EROSION it replaced did measurable harm**, which is why it is gone. On the kit's real
  sheet it erased a real correction on a SHARP photograph — a hand struck the printed «2 kg» and
  wrote «126» beside it:

  | level | raw ink outside band | after erosion | floor | verdict |
  |---|---:|---:|---:|---|
  | clean | 0.05216 | 0.01121 | 0.01260 | untouched |
  | mild | 0.04986 | 0.00920 | 0.01260 | untouched |
  | half-assed | 0.06437 | 0.02428 | 0.01260 | **written** |

  The raw signal is four to five times the floor every time. The mark survived only at half-assed,
  where motion blur and JPEG had thickened the strokes — **the better the photograph, the more likely
  the correction disappeared**, and it landed on the quantity column. It repeated across seeds:
  Caveat lost a correction on four of its twelve A4 clean-and-mild runs, and on A5 at seed 199 a
  single-digit «2» beside the printed amount was invisible at every level. There was no phantom
  anywhere in that sweep: the direction was always the dangerous one. Thickness cannot tell a halo
  from a biro; distance can, and it costs a real hand nothing.

PAP-08 states what the floor table therefore says, and PAP-09 carries the fix.

### PAP-04.6 · One correction is one answer

A seat holds the amount and the unit that denominates it, so «6,25» written beside «20 kg» is ink
outside the band for BOTH. `_belongs` attributes the mark to the printed value nearest its own
**centre of ink** and the other cell keeps its «untouched». Without it, every corrected quantity
produced a phantom correction to its unit — flipped and measured: **2 phantom corrections, both units
of corrected quantities**.

### PAP-04.7 · The second belt — a hand that writes OVER the value

A correction written straight over the printed value leaves nothing outside the band to attribute. The
signal is how much more ink the value's own rectangle holds than one rendering of it — and the
threshold is **learned from the page**, the same way the blank floor is.

```
baseline = 40th percentile of every printed cell's observed / rendered ratio   clamped to [1.0, 3.5]
over     = ink > rendered_fill × baseline × PRINTED_EXCESS_RATIO               (1.6)
```

The 40th percentile rather than the median, because a written-over cell is an outlier ABOVE and should
not pull the baseline up after it. This file renders in ITS typeface at ITS guess of the size and the
paper set it in the house's, so an untouched printed cell already carries more ink than the rendering:
measured at gaussian σ 1.8, between **1.93 and 2.38 times**, against a baseline of 2.17 — 0.89× to
1.10×. A cell with «5» written beside a printed «4» sits at **2.6×**.

⚠ **A FIXED MULTIPLE MISSED A REAL CORRECTION, AND THAT IS WHY THE BELT IS RELATIVE.** At 3.2×
absolute, a «5» in a light hand over a printed «4» came back untouched on a live end-to-end read: the
writing sat inside the band, so the band could not see it, and a thin stroke did not triple the ink.

⚠ **AND ON A SATURATED BOX THE BELT STANDS DOWN.** `BAND_SATURATED = 0.85`: when one rendering of the
printed value already covers 85 % of its own box, the box IS the glyph and the belt is measuring the
distance between two typefaces rather than the presence of a pen. Measured on the kit's own sheet at
«half-assed»: untouched printed boxes ran **3.5 to 6.5** times their rendering while the two boxes a
hand had written straight over sat at **6.2 and 7.2** — inside the same range. No threshold separates
those, and one chosen anyway called **twenty-three untouched rows corrected**. So the belt is not
applied there, the seat beside it is the road, and the blind spot is stated (PAP-09) rather than
papered over. A saturated box also sets no baseline, so the belt's own scale stays honest.

### PAP-04.8 · The classification proof

Flipped one constant at a time in a scratch copy, scored against the same «half-assed» photograph,
whose baseline is **51 cells, 0 misclassified**. Every row was independently reproduced by the
verifier, naming the same cells (`report-verify-harness.md` §1.6).

| flip | what it breaks | result |
|---|---|---|
| `MARK_MATCH_ACCEPT_MM 1.5 → 0.0001` | no triple of blobs is ever accepted | **marks 4 → 0**, the registration column empties, at clean and at half-assed |
| `MIN_INK_MM2 2.0 → 200.0` | no pen can reach the area floor | **2 misclassified** — the thin «2» and a corrected quantity go untouched |
| `HAND_REACH_MM 30.0 → 0.1` | the seat collapses onto the printed glyphs | **2 misclassified** — both quantity corrections invisible |
| `BAND_SATURATED 0.85 → 1.10` | the over-writing belt is applied to saturated boxes again | **6 phantom corrections** on rows nobody touched |
| `_belongs` removed | a mark is attributed to every printed cell of its seat | **2 phantom corrections**, both units of corrected quantities |

Each observation also carries its own confidence:
`clip(0.5 + 0.5 × min(1, |measured − floor| / floor), 0.5, 1.0) × registration.confidence_scale`.

---

## PAP-05 · The reader

`handwriting.read_cells(page_png, crops, house_units) → {id: {value, confidence, check}}` in
`mock-api/app/handwriting.py`. It is the only place in the runtime that shows a person's handwriting to
a model.

### PAP-05.1 · The seam

`HANDWRITING_READER` picks between two implementations and the default is **gemini**. Neither name
appears anywhere else in the service.

| Reader | Model | Call | State on 2026-09-05 |
|---|---|---|---|
| `gemini` | `gemini-2.5-flash` (`GEMINI_MODEL`) | generativelanguage **v1beta** `:generateContent`, inline PNG parts, `temperature 0`, `responseMimeType: application/json` | **answering.** Five handwritten crops, five exact values, live from this box |
| `anthropic` | `claude-fable-5-1` (`ANTHROPIC_MODEL`) | messages API, `anthropic-version: 2023-06-01`, base64 image blocks, `max_tokens 4096`, `temperature 0` | the key is live — `GET /v1/models` lists the model with `image_input` — and the account answers «Your credit balance is too low». Implemented whole and unit-tested against a constructed answer shape; the live half waits for credit, and neither fact is dressed as the other |

**The word the answer carries.** `reader_word()` follows the CONFIGURED model for gemini, because
evidence that kept saying «gemini-2.5-flash» while another model did the reading would be a false line
in the one field a person consults to decide whether to trust a number. With the default configured it
is the contract's own word, exactly.

⚠ **The two halves of that rule are asymmetric, and the code wins.** `MODEL_WORD["anthropic"] =
"claude"` is a fixed word: an anthropic box pointed at another model still answers «claude». PAP-09
carries it.

### PAP-05.2 · One request per page, every crop labelled

The first request carries **every crop on the page**, each labelled `id: <sale>·<line>·<cell> —
<product> · line <line> · printed «<value>»`. A reader that sees the whole page's hand at once is a
better reader of any one cell on it.

The prompt's rules, verbatim in `INSTRUCTION`:

- Report the handwriting alone. Printed text that was already on the paper is context, not an answer.
- A number keeps its digits exactly as written. Read a comma as a decimal point: 12,5 is 12.5.
- Where a box holds two numbers and one of them has a line drawn through it, the answer is the number
  WITHOUT the line. A crossed-out number is the one the person decided against; report the one they
  wrote instead, and report it alone.
- Report a value only when you can see it. Where the writing is unclear, give your best reading and a
  low confidence.
- Answer with JSON alone, in this shape: `{"cells": {"<id>": {"value": "<what is written>", "confidence": 0.0}}}`

**The struck-through rule earned its place.** Adding it took Caveat at half-assed from **58 % to
89 %** exact.

### PAP-05.3 · The whole-page cross-check

A second request carries the WHOLE rectified page and asks the same ids again, where the row's product
and printed quantity stand beside the box.

| What the two looks did | Confidence | `check` |
|---|---|---|
| agree | `min(1.0, (crop + page) / 2 + 0.15)` | silent |
| disagree | `min(crop, page) × 0.5` | «the box reads «X» and the whole page reads «Y»» |
| the page look answered for other boxes | `crop × 0.8` | «read from the box; the whole-page look answered for the other boxes» |
| the page look failed entirely | `crop × 0.85` | «read from the box alone; a second look at the whole page would confirm it» |
| the value is not an amount | `crop × 0.5` | «the reader saw «X»; this box takes an amount» |

**The cross-check is a second opinion, not a gate.** A page look that fails leaves the crop reading
standing with a check; losing the whole answer because the belt broke would be the worse trade.

### PAP-05.4 · What the reader never does

- **A missing key is a `503 handwriting_missing`** with a name on it, never a plausible answer.
  `GET /api/health` states `handwriting: {reader, key}` — beside `providers` rather than inside it,
  since the kit types that record as exactly four names.
- **An answer that names none of the boxes asked about is a named failure.** Measured on the harness:
  one model answered 200 twice with no JSON in it at all — thinking had spent the response — and
  every cell came back «written, value null», which reads on the surface as an illegible pen nineteen
  times over. That is the worst kind of wrong answer, because it looks like an answer. It raises
  `502 handwriting_failed` instead.
- **One retry, on «ask again» and nothing else.** `429 · 500 · 502 · 503 · 504` are asked once more
  after a **4 s** pause. Every other status stands as it came: a wrong key or a spent balance is an
  answer, and asking again would only spend the wait. Measured live: a per-minute quota turned a
  complete read into a 502 one second in, taking the whole registration with it.

### PAP-05.5 · What a value has to survive

- **A comma is a decimal point.** `normalise_number` reads «12,5», «12.5», «12,5 kg» and «kg 12,5» as
  `12.5`, folds thousands separators, and answers **nothing** for a `finalWeight` or `qty` that is not
  an amount — PAR-03.4's rule, one field down.
- **A unit comes back in the house's own word.** The vocabulary is *the manifest itself* — the units
  that sheet prints — plus the trade's starter words (`kg · g · l · ml · caja · pieza · bandeja ·
  saco · manojo · bote · ud · unidad`), matched accent-blind and plural-blind. A word the sheet does
  not print is kept as written and named in `check`.

### PAP-05.6 · Cost, latency and the free-tier boundary

Measured on this box, per page, live:

| Reader | Crops | Time a page | Where |
|---|---|---:|---|
| `gemini-2.5-flash` | 5 | **7 171 ms** | the local end-to-end run, `evidence.ms` |
| `gemini-2.5-flash-lite` | 19 | **6.1 s** | the harness sweep, 2026-09-05 |
| `gemini-3-flash-preview` | 19 | **19 s to 225 s** | the same photographs — it thinks, and it is exact for it |
| `gemini-3.5-flash` | 19 | 69–177 s, and once no JSON at all | tried and rejected |

**`HANDWRITING_TIMEOUT_SECONDS = 240`** — four minutes. It was 90 s, and a current flash model spent
**69 to 90 seconds** on a page of 19 crops and had its finished work thrown away twice
(`http 500 … ReadTimeout` at `ms 90569` and `ms 90561`). A read cut at the wire costs the request AND
the answer.

**The free-tier boundary is 20 requests per project per model per day on the key the house holds**
(`report-verify-harness.md` §6.1). A page is TWO requests — the crops and the whole page — so one key
answers about ten pages a model a day before it returns 429. `gemini-flash-latest` shares
`gemini-2.5-flash`'s bucket. This is why the harness lives outside the release gate (PAP-08.6) and why
a spent quota makes the drive go red rather than pass quietly.

---

## PAP-06 · The answer

### PAP-06.1 · The three endpoints

| Endpoint | In | Out |
|---|---|---|
| `POST /api/paper/manifest` | the manifest of PAP-02.2, JSON | `{ok, token, locator, pages, cells, storedAt}` |
| `GET /api/paper/manifest/<token>` | the token the paper prints | the manifest as it was recorded, or `404 manifest_unknown` |
| `POST /api/paper/read` | multipart `file` — a photograph | the body below, or `422 paper_unknown` |

Refusals by name: `empty_upload` (400) · `too_large` (413, `ROCOTO_MAX_UPLOAD_BYTES`, 40 MB default) ·
`bad_image` (400) · `paper_unknown` (422) · `manifest_unknown` (422 on a read, 404 on a fetch) ·
`reader_missing` (503) · `handwriting_missing` (503) · `handwriting_failed` (502).

### PAP-06.2 · The read's body

```
{ locator: "rocoto:document/packing/v1/<token>",
  token:   "<token>",
  matched: { day: "YYYY-MM-DD", sales: ["<sale id>", …] } | null,
  pages:   [{ index,
              quality:  { tiltDeg, blurScore, lightScore },
              readings: [{ sale, line, cell, written, value, confidence, crop, check }] }],
  evidence: { reader, ms, marksFound } }
```

| Field | What it is |
|---|---|
| `matched` | the day the run was drawn and every sale on the page that was read. **`null` says the mark named the document and the page would not lie flat** — a real answer, with nothing invented to fill the gap |
| `readings[].sale` · `line` · `cell` | **the address**: the box it came from was that sale's, that line's, that column's. `cell` is `finalWeight` · `qty` · `unit` |
| `readings[].written` | whether the crop carries new ink at all. A blank box is a fact |
| `readings[].value` | the normalised reading, or `null` where the box was untouched |
| `readings[].confidence` | 0..1, rounded to three places, after every scale in PAP-03 and PAP-05 |
| `readings[].crop` | **the crop itself, as a `data:` URI** — so a person accepts against the ink rather than against a number |
| `readings[].check` | what wants an eye, in words, or `null` |
| `evidence.reader` | the model that actually read (PAP-05.1) |
| `evidence.marksFound` | 1 to 4 — the mark counts as one |

**One additive field, named so it is not mistaken for drift** (the move RUN-02 already makes for
`code` and `header`): `evidence.page = {index, score, margin}` appears where one token covers several
sheets, and states which sheet was read and how clear the choice was.

⚠ **The kit's type on this branch does not carry `evidence.page`.** `runtime-client.ts` types
`evidence` as `{reader, ms, marksFound}`; the extra key is ignored, which is the contract's own rule.
It belongs in the type on the merge (PAP-09).

### PAP-06.3 · The kit's copy of the contract

`app/src/prototypes/cedar/runtime-client.ts` is the only place the kit names these routes.

⚠ **Two branches type this contract under different names and the merge has to choose.** This branch
carries `PaperReadResult · PaperPageReading · PaperReading · PaperReadingCell · PaperManifestReceipt`.
`codex/english-e196-surface` carries `PaperRead · PaperPageRead · PaperReading · PaperCell ·
PaperRect · PaperManifest*`, plus `RuntimeRefused`, which carries the status and the service's own
reason so a 422 reads as an answer rather than a fault. The surface's set is the one the review is
built on and the one that names the refusal; PAP-09 carries the reconciliation.

### PAP-06.4 · What is kept

- **The photograph is never written to this disk.** It is a numpy array for the length of one
  request; the crops travel in the answer and live nowhere else. Proven: after a read, the state
  directory holds exactly one file, and it is the manifest.
- **The manifest is kept for 30 days** (PAP-02.4). This settles the manifest half of RUN-11.5;
  recording retention stays owed there.
- **The journal records counts and milliseconds**: marks found, cells looked at, cells written, which
  decode rung answered, which reader ran, and whether the two looks agreed. Never a value, never an
  image.
- **The prompt carries the row's own product word and the printed amount**, because that is the
  context a reading needs. It carries no customer name.

---

## PAP-07 · The review, and the accept road

`app/src/prototypes/cedar/paper-read.ts` (the read seam, the manifest fetch, the record) and
`paper-read-back.tsx` (`PaperReadBack` · `PaperReadBackDock`), docked in `detail.tsx` beside the paper
review and seated in `albaran-intake.tsx`'s extraction seat.

### PAP-07.1 · Five postures, and every one says what is

`reading` · `read` · `unmatched` · `unreachable` · `unavailable`. **`unmatched` is the honest one that
matters**: the runtime ANSWERED, and its answer was «this is not one of ours». That is a road, and it
is what sends the photo to Parsewise. Its sentence is «Read the lines from the photo.»

Nothing in `paper-read.ts` writes to a sale. A reading is a PROPOSAL until a person accepts it — the
law §191.1 gave the capture road: «a capture is not an OCR result… no field is silently invented».

### PAP-07.2 · The anatomy

- **The head names the paper.** «Your packing list · Friday 22.08 · truck 4 · 3 orders», with the run
  stated only where every order on the sheet agrees.
- **The evidence line states what read it.** «Read by Gemini · 2 pages · 4 of 4 marks found · 620 ms»
  — `paperEvidenceLine`, written to `parsing.ts`'s `evidenceLine` grammar so the two capture roads
  state their evidence in one voice.
- **One block per matched order, in the paper's own order. One row per line, per box.** A row is named
  by the line AND the box it came from, because one line can carry three readings.
- **The row carries, in fixed tracks:** the goods' name; what the box PRINTED under it («printed 4
  caja»); **the crop of the ink** at a 44 px floor, standing on the row's own ground with no chrome
  and pressable to enlarge; and the reading as a Figure in §192–§195's grammar — quantity then unit,
  tabular figures, one line, **the decimals the pen wrote**.
- **Type in place on the value**, in §192.2's own seat, with the caret already in it.
- **«left as printed»** where the box was untouched.
- **Silence is the resting state.** A confident reading of clear writing says nothing about itself. A
  reading that wants an eye says so in words UNDER the row, and after the accept that sentence becomes
  a real concern wearing the house's own red: the anxiety note as the row's own tab inside a 2 px
  boundary, Dismiss pinned at the right, and the dismissal clearing note, tab and red together
  (§192.4 · §196.3 · §128.1).

**The column plan is MEASURED off the review, not off the window.** A 1600 px desk hands this surface
a **664 px** column and a 1366 px desk **583**. Where the wide plan would crush the goods' name the
crop and the acts take their own line under the values (§194.2). The tracks, all in
`paper-read-back.tsx`: `INK_TRACK = 140`, `ACTS_TRACK = 168`, `VALUE_FLOOR = 112` (the narrowest a
value column is worth drawing — a different constant from the harness's `VALUE_FLOOR` table in
PAP-08.6), `IDENTITY_FLOOR = 148`.

### PAP-07.3 · What the accept writes

One primary act per document — **«Accept N readings»** — plus each row's own **Accept** and
**Dismiss**. Every one of them writes through `sale.ts`'s OWN verbs, `putFinalWeight` and `editLine`,
so a weight that arrived on paper is indistinguishable in the ledger, the trace and the export from
one a hand typed. There is one road into a document.

- **A reading lands ONCE.** The record answers it, the row then reads «On the line», and the
  document's one act LEAVES rather than standing greyed out at «Accept 0» — a control describing its
  own unavailability is a control that says nothing.
- **A dismissed row leaves the printed value standing** and offers one way back rather than two.
- **An untouched box writes nothing at all.**
- **The document journals it positively:** «Read from your paper · 7 of 9 lines · Gemini».

Proven by reading the day ledger back after the act: **seven `line` events, exactly the seven accepted
values, nothing else**; the dismissed and the untouched line carry no event.

### PAP-07.4 · Two housings, one element

- **Desk:** the review docks in the detail column, above the lines it is about.
- **Phone:** a full-height sheet that owns its own scrollport, with the act bar — Print, Accept — on
  the sheet's bottom edge where a thumb is, above every fixed strip the app draws. `SHEET_LAYER = 16`,
  because `detail.tsx`'s own phone act bar is fixed at `LAYER + 2` = 14 and the overlay ground is 8.
  The review had opened UNDER that bar, so a press meant for a row landed on «Print again».

⚠ **Two phone defects the verifier found, repair in flight on `codex/english-e196-surface`.** Both are
measured, both are being fixed in that worktree, and the design this section states is the intended
one:

1. **The enlarge card sat under the sheet.** Probed at 390 × 844: `ENLARGE {open: true, onTop: false,
   hit: "paper-read-name-p2-l2:Lubina de estero"}` — a press at the enlarged crop's own centre landed
   on a row name underneath it. At 1600 × 1000 the same probe reads `onTop: true`. The fix raises the
   card's own layer to `SHEET_LAYER + 1` rather than relying on the card alone.
2. **The act bar floated off the sheet's edge.** «Sticky bottom 0» lands on the scrollport's INNER
   bottom, which is the padding edge rather than the border edge. Measured at 360 × 800:
   `acts.bottom 766` against `sheet.bottom 776`, with «18,2 kg» printing through the 10 px strip
   between them; the same 10 px at 390 × 844 and 393 × 873. The fix gives the section's bottom padding
   up so the sticky edge and the sheet's edge are one line.

### PAP-07.5 · Offline, and the other doors

- **With no runtime the review draws nothing at all**, and every capture door keeps exactly the
  behaviour it already had. A surface that is absent has nothing to announce.
- **A photograph of our own paper takes this road alone** — it never also goes down the extraction
  road.
- **A sheet this house did not print opens no read-back**, and the photo goes down the Parsewise road
  instead (§196.5).
- The paper review keeps the card it has always had, and the manual road stands open beside it.

### PAP-07.6 · What the repair round settled, after a refuter drove the first build

Seven findings, each a rule rather than a patch (E196.3's second commit; the ledger's own record of
them was written as prose and lives here, where the road it is about is specified).

1. **A control that is DRAWN is not a control that can be PRESSED.** The enlargement of the ink
   opened on the overlay ground's own layer — the number Base raises for the menus a card opens,
   chosen when no card sat at sixteen — so on a phone it painted UNDER the review's sheet with a
   focus lock held on something nobody could see. A card opened from inside a sheet DECLARES the
   layer it opens in, above the sheet that opened it, and the drive asks `document.elementFromPoint`
   at the card's own centre — the only question that tells a drawn control from a pressable one.
2. **A sticky bar sticks to its scrollport's INNER bottom.** The phone act bar carried a negative
   bottom margin that pulled it out of the box it was sticking to, so it stood ten pixels above the
   sheet's edge with rows painting through the gap. The bar keeps its own padding and the section
   gives up its bottom padding instead; the two edges are one line, and the drive measures the strip
   between them.
3. **Enter, Escape and leaving are three different acts (§192.2).** Enter commits. Escape leaves it
   and the row goes back to WHAT IT CARRIED WHEN THE SEAT OPENED — never to the reading, because a
   correction a person already made must survive an edit they abandoned. Leaving commits a valid
   change and drops one a line cannot carry. **Escape is answered on the KEY-UP**, because Base's
   layer manager closes the topmost overlay on a document key-up and never looks at
   `defaultPrevented`: closing the seat on the key-down unmounted the field before that key-up
   existed, so one press cancelled the edit AND dismissed the whole phone sheet under it.
4. **The column plan is MEASURED once per document, off the longest reading on the sheet.** Three
   hard-coded track widths are not a plan; they are a bet that no sheet carries a six-digit quantity,
   and «12.500,5 unidades» collects on it. The value track comes from the sheet's own widest drawn
   figure through `row-plan.ts` — the albarán's own calibration of this type, moved out of
   `detail.tsx` so one measurement serves both surfaces — and the POSTURE follows the measurement
   rather than a width threshold: wide, stacked, or (at 360 with a forty-character name) every part
   on its own line. A value is never given less than it needs, because a Figure is `nowrap`: a short
   track does not shrink it, it paints over the goods' own name while every rect-based check passes.
5. **A count of readings is not a count of lines.** One line may carry a quantity, a unit and a final
   weight, and the runtime answers ONE PAGE PER PHOTOGRAPH — so a two-page sheet is two photographs
   against one token. The record keeps the UNION of the line keys the paper has shown, and the
   journal counts distinct lines on both sides of «8 of 10».
6. **A run is the sheet's only if every order on it is on one.** Dropping the orders with no round
   before counting printed «truck 4» over a sheet two thirds of which was going somewhere else.
7. **And the last denial in the paper review is gone.** «Photo reading unavailable.» said nothing the
   following sentence did not already say better; the card says only where the work is — «Enter the
   changes from your paper, then finish the review.»

---

## PAP-08 · The proof

### PAP-08.1 · The runtime suite

`backend/tests/paper_page.py` draws a real page from a real manifest — the mark at the spec'd size with
the spec'd error correction (**29 modules**, QR-02's version-3 arithmetic asserted rather than
trusted), three solid squares, printed rows, ruled boxes, and a slanted, dilated pen through some of
them — then leans it, rolls it, blurs it, lights it from one side and saves a JPEG. **It returns the
perspective matrix it used**, which is what turns «the geometry looks right» into a millimetre.

**The baseline photograph** — leaning 30 %, rolled 7°, σ 1.3 blur, lit from one side, JPEG 45: four
marks found, **every cell centre within 0.257 mm**, eighteen boxes classified exactly.

| Axis | Harshest step that still reads every box | Beyond it |
|---|---|---|
| **blur** | **gaussian σ 2.0** at 4.62 px/module (σ 2.0 needs the `sharpened` rung) | σ 2.2 — the mark goes |
| **resolution** | **4.62 px per module** | 3.23 and below — refused, never guessed |
| **JPEG** | **quality 6** | nothing tested broke it |
| **tilt** | **lean 45 %, roll 16°** — 34.5° reported | lean 55 %, roll 20° — refused |
| **lighting** | **a ramp from 0.25** of full exposure | nothing tested broke it |
| **dirt** | **none.** 0.0005 specks per pixel already costs boxes | 0.008 — the page no longer locates, and is refused |

Every entry BUT THE LAST is «every one of eighteen boxes classified correctly AND every cell centre
inside 0.7 mm», and **every degradation past the floor refuses rather than answering**. In this sweep
a damaged page never once returned a reading addressed to the wrong box.

⚠ **JPEG: «nothing tested broke it» is an over-read of the axis, and it is stated as one.** The
sweep was taken to quality 6. At quality 4 the page still registers (err 0.254 mm) and one box
classifies wrong, so the honest line is «tested to quality 6», with the failure past it unmeasured
rather than absent.

⚠ **DIRT IS THE AXIS WHERE THE CLASSIFIER FAILS BEFORE THE REGISTRATION DOES**, and it is stated
rather than smoothed over. **The marks are untroubled**: at 0.006 specks per pixel the page is still
located and every cell centre lands inside 0.3 mm; at 0.008 it no longer locates and is REFUSED
rather than read. **The boxes are not**: measured on three sheets at RELEASE-195, the count that
comes back wrong is 3 at 0.0005, **4 at 0.001**, 5 at 0.002 and 6 from 0.004 — and no floor inside
`[0.006, 0.030]` reaches zero.

**What makes that survivable rather than dangerous is the DIRECTION.** Every one of those mistakes
is a box **INVENTED** — «somebody wrote here» over an untouched box, which a person sees beside the
crop of the paper and rejects in a glance. Dirt never lost a correction somebody made, and never
landed a reading on a box the manifest did not name; both are asserted, not inferred from a count. A
missed correction would be silent; an invented one argues with the photograph standing next to it.
What is owed is a belt that tells a speck from a stroke, which is a question about SHAPE rather than
amount: a speck is round and isolated, a stroke is long and connected, and nothing in `register.py`
looks at either yet.

**The whole road, run locally.** A uvicorn on this box, the manifest POSTed, the photograph POSTed:
`health 200 · manifest 200 · read 200, 249,816 bytes, 1.14 s`, `marksFound: 4`, four written cells
found and fourteen untouched. **The state directory afterwards held one file, and it was the
manifest.** Against the live model the same road answered
`evidence {reader: gemini-2.5-flash, ms: 7171, marksFound: 4}` with `11.8 · 8.2 · 6.4` read exactly at
confidence 1.0, before the day's free quota was reached — after which the endpoint answered
`502 handwriting_failed «The handwriting reader answered 429.»`, which is the failure saying its own
name.

**The count, with the condition that makes it true.** On the merged RELEASE-195 tree the whole
runtime suite is **257 collected**, and what any machine reproduces with no key in the environment is:

```
$ env -u GEMINI_API_KEY -u GEMINI_API_KEY_HELLO python3 -m pytest -q
254 passed, 3 skipped in 37.14s
```

The three skips are the LIVE legs — the reader asked for real, and the chain §199.2 asks for. With
the key AND the day's free-tier quota they run; without either they skip.

⚠ **A SKIP CANNOT FAIL CLOSED**, and these are the only live checks on the reader seam. They are
written `except RuntimeError_ as exc: pytest.skip(…)`, so a spent quota and a genuine
`handwriting_failed` from a broken prompt read the same. PAP-09 carries it.

The three paper files are `test_paper_register.py` · `test_paper_endpoints.py` ·
`test_paper_handwriting.py`; the rest of the 257 predate this work or belong to the artwork, Copilot,
retention and parse roads that landed beside it in the same release.

### PAP-08.2 · The harness — our own paper, end to end

`tools/paper-harness.py`. No printer and no phone in it:

1. **PRINT.** Open the built kit in a real browser, put the seeded morning's packing paper on the
   stage, choose the truck carrying the most orders (**five orders, 17 lines, one A4 page** on the
   demo day), print the run, and screenshot the printed sheet at **300 dpi**. The device scale is
   3.125 over a life-size 96 dpi print, so **2481 × 3509 px IS the A4 page** — verified in pixels, with
   the three squares measuring 6 mm at 4.99 mm from their edges.
2. **FETCH THE MANIFEST BACK FROM THE RUNTIME by its token**, never a copy this file made. The geometry
   under test is the geometry the two halves actually exchanged.
3. **HANDWRITE.** Three faces fetched from google/fonts at run time and deleted afterwards —
   **Caveat · Kalam · Homemade Apple** — a value in every final-weight box, blue or black, pen widths
   0–2 above the face's own stroke, leaning **±8°**, **one in six** struck through and written again,
   **one in five** reaching outside the box, and **one quantity in eight** struck and corrected in the
   free paper beside it. The ground truth is kept per `(sale, line, cell)`.
4. **RUIN.** A real projective warp through a pinhole at 2.2 sheet-lengths, in both axes; a vignette
   plus a soft band across the paper at the angle a person stands; a tungsten cast; motion blur along
   the hand's own drift; downsample and JPEG. Everything deterministic from a seed, through the repo's
   own shared `tools/degrade.py`.
5. **READ.** POST to a LIVE runtime with a LIVE reader, and score: the mark decoded, the marks found,
   the millimetres of registration error at every cell centre, written-or-untouched exactly, and the
   VALUE exactly.

**The geometry is also measured in-process**, because the endpoint answers with crops and values and
never with its homography. The same `app.register` the endpoint uses is called on the same photograph
and compared against the projective matrix the file photographed the page with. That is a millimetre
rather than an adjective, and it costs no model call.

### PAP-08.3 · The levels

| level | tilt, two axes | motion blur | light | JPEG | pixels |
|---|---|---|---|---|---|
| clean | 0° | — | even | 85 | 1600 |
| mild | 15° / 15° | — | vignette | 85 | 1600 |
| **half-assed** | **25° / 25°** | **3 px** | **vignette + a shadow band** | **60** | **1600** |
| harsh | 35° / 35° | 6 px | vignette + shadow | 45 | 1600 |
| punishing | 45° / 45° | 9 px | vignette + shadow | 35 | 1600 |

«Half-assed» is §199.2's own words as a recipe.

### PAP-08.4 · The floor, measured — 2026-09-05, A4 and A5, three faces

| level | marks | registration at the cell centres | written-or-untouched | values exact |
|---|---|---|---|---|
| clean | **4** | 0.16 mm A4 · 0.28 mm A5 | 100 % A5 · **A4 Caveat 50 of 51** | 100 % · 100 % · 79 % |
| mild | **4** | 0.14 mm A4 · 0.31 mm A5 | 100 % A5 · **A4 Caveat 50 of 51** | 100 % · 95 % · 74 % |
| **half-assed** | **4** | **0.17 mm A4 · 0.33 mm A5** | **100 %** on the seed the gate runs | **89 % · 100 %** |
| harsh | — | the mark refuses | — | — |
| punishing | — | the mark refuses | — | — |

The three faces are Caveat · Kalam · Homemade Apple in that order; the values column is
`gemini-2.5-flash-lite`, live, 19 written boxes a page, **6.1 seconds a page**.

⚠ **THE CLASSIFICATION COLUMN IS CORRECTED HERE, AND THE CORRECTION IS THE POINT OF PAP-04.5.** The
first table claimed 100 % at every level up to half-assed, on both papers, in every face. Re-measured
against the committed code, A4 · Caveat classifies **50 of 51** at clean and at mild — a «126» written
beside a struck «2 kg» is reported untouched — and on A5 at seed 199 a «2» written beside the printed
amount is invisible at every level including half-assed. Kalam and Homemade Apple are 0 misclassified
at every level and every seed, and there is not one phantom anywhere in the 36-run sweep. The gate
passes because it runs one face at one level, and that level is the only one of the three where this
face holds. `written_share = 1.0` is therefore a seed-specific pin today (`report-verify-harness.md`
§2.2).

**A second reader, on the same photographs.** `gemini-3-flash-preview` at «half-assed» reads
**100 % · 100 % · 84 %** across the three faces, at 19 to 225 seconds a page, including every
struck-through correction in two of the three hands. The pipeline's own columns are identical under
both readers, which is the point: **what a value reads back as is the model's, and everything else is
ours.**

**Homemade Apple is the floor's own face.** Every reader loses the same kind of value on it — a
struck-through correction read as the value that was struck, and a «45,2» whose 4 the face draws like
a 1. It is in the sweep precisely because a floor measured on three easy hands would be a floor about
nothing.

### PAP-08.5 · The floor line, in one sentence

> *Our paper, photographed at 25° in two axes with 3 px of motion blur, a shadow across it, JPEG 60
> and 1600 px on the long side, reads back with all four marks found, every cell centre inside
> 0.33 mm, every box classified written-or-untouched exactly, and 89 to 100 % of the handwritten
> values exact — and at 35° it refuses.*

**What refusing looks like.** At «harsh» the mark stops decoding at 1600 px and the endpoint answers
**422 `paper_unknown`**, naming the document reader as the other road. Across every level and both
papers, a damaged page either read exactly or refused. Nothing was ever addressed to the wrong box.

### PAP-08.6 · The pins, and where they fail closed

`FLOORS` in `tools/paper-harness.py` — **marks, registration and classification are this repository's
own work, so they are pinned hard**:

```
level           "half-assed"      the harshest level the pin is asserted at
written_share   1.0               every box classified written-or-untouched exactly
registration_mm 0.45              worst cell centre — measured 0.33 (A5, half-assed)
marks           4                 the code and all three squares
```

`VALUE_FLOOR` — **what a value reads back as is the model's, so it is pinned PER READER and only for
readers measured on this box.** A run on an unmeasured reader proves nothing about values and says so
rather than passing quietly.

```
gemini-2.5-flash-lite   0.85
gemini-3-flash-preview  0.80
```

⚠ **The `gemini-2.5-flash-lite` row is one draw and it did not hold on a rerun.** The verifier re-ran
the pinned configuration on the builder's own recorded print — same paper, same hand, same crops, four
hours later — and measured **9 of 19 exact (47 %)** against a floor of 0.85, with the pipeline columns
byte-identical (marks 4, 0.17 mm, 51/51 classified, 0 false writes). Three of the ten misses were
plain unstruck values: every «14» in Caveat came back «7.4». PAP-09 carries it.

### PAP-08.7 · The drives

| Drive | What it proves | Count |
|---|---|---|
| `drive-196-paper-manifest.py` | the rendered sheet, measured rather than trusted: the three marks in millimetres to **±0.5 mm** on every page — six viewports on A4 and two (1600, 390) on A5; no mark touches a printed word; no mark enters the clear paper the mark reads on; every line of every order has a final-weight seat; the rows walk down the page and never overlap; the manifest reaching `POST /api/paper/manifest` answers this contract field by field; and **a stage at 60 % and a page at life size record the same millimetres** | **275 GREEN / 0 RED** |
| `drive-196-read-back.py` | the review and the accept, against a loopback server that serves the built kit AND answers the paper endpoints on its own origin. Fixture: 2 pages, 3 orders, 9 lines, 7 written `finalWeight` cells, 1 quantity correction, 1 check, real PNG crops. Six viewports: 1920 · 1600 · 1366 · 393 · 390 · 360 | **153 GREEN / 0 RED** (`codex/english-e196-surface`) |
| `drive-196-paper-harness.py` | the gate: the harness at its smallest setting — one paper, one face, one level — held to `FLOORS` | **15 GREEN / 0 RED** from a cold start on `gemini-3-flash-preview`; **8 GREEN / 1 RED** on its own default (PAP-09) |
| `run-196-manifest.py` | the offline manifest runner that holds the harness gate | pins `paper-harness: 15` |

**Why the harness is outside the public proof.** `run-193-public-proof.py` drives a DEPLOYED
`app.html` and asserts what a browser painted. The harness needs a runtime of its own on the box and it
spends a live model's daily quota, and a release gate that spends a quota is a release gate that one
day cannot run.

### PAP-08.8 · Proved red first

Every rule in PAP-04 was watched to fail against a deliberately broken source, one change at a time,
the file restored byte for byte after each — the table in PAP-04.8, every row independently
reproduced. The registration and endpoint rules were flipped the same way: **29 flips, 29 red** on
`codex/english-e196-read`'s rebuilt harness. Four of those flips found the tests themselves too weak
before they found anything else, which is the only reason the harness is worth running: **a gate
nobody has watched fail is not a gate.**

**And the gate itself was proved red.** Run with the reader's quota spent: **4 GREEN / 6 RED**, with
«the run photographed a level the floor is pinned at» red first. A run that cannot ask a reader proves
nothing about values and says so.

### PAP-08.9 · The five defects the harness found in the pipeline

Each measured before it was fixed and re-measured after, in order of what it would have cost a
delivery. Every pre-fix state was independently re-broken from the tree by the verifier.

1. **The manifest was refused whole.** The kit's line id is a string (`l1`), the runtime typed it as an
   integer, and every POST came back `422 line: Input should be a valid integer`. PAP-02.2.
2. **A clean photograph was refused** because the mark-only guess was a projective fit. PAP-03.2.
3. **A thin «2» in a wide box came back untouched** by five parts in ten thousand. PAP-04.3.
4. **Corrections to a printed quantity were invisible, and phantom ones appeared** — the seat, the
   furniture mask, the attribution and the saturated-box stand-down. PAP-04.4 to PAP-04.7.
5. **A reader that answers with no JSON at all** made nineteen boxes come back «written, value null».
   PAP-05.4.

And one number moved: the reader's own timeout, 90 s → **240 s**. PAP-05.6.

---

## PAP-09 · What is owed, honestly

### PAP-09.1 · The classification defects still open

- **The thin-pen erosion is CLOSED, and what replaced it is an unproven guard.** The 0.25 mm erosion
  erased a real correction on a SHARP photograph (0.0522 raw down to 0.0112 against a 0.0126 floor at
  clean, surviving only at half-assed at 0.0243); it is gone, replaced by masking the band's own halo
  — a question of DISTANCE from the printing rather than of stroke THICKNESS, which is the axis that
  can tell a halo from a biro. What is still owed is a test that catches the replacement's removal:
  measured with nobody writing on the page, phantoms are 0 of 18 under the halo mask, under no mask
  and under the old erosion alike, so no assertion in this suite goes red if
  `PRINTED_OUTSIDE_HALO_MM` is deleted. Either build the σ 1.8 phantom case that reddens without it,
  or the constant stays what its docstring now says it is: a conservative margin, kept for the
  photographs this harness has not made. PAP-04.5.
- **`evidence.marksFound` is 1 on the refusing branch, and it is hard-coded there.** When `register()`
  declines, `mock-api/app/paper.py` answers `marksFound: 1` — the QR alone, which is what certainly
  was found, because it is what named the sheet. Honest for the page under test (printed without its
  squares) and an under-report for a page refused by its own self-check AFTER three squares matched,
  against a contract that types `marksFound` as 0..4. What is owed is `register()` handing its count
  back on the refusing path too.
- **The runtime suite covers the wrong sheet for this case.** `backend/tests/paper_page.py` lays an
  **18 mm** quantity box with 21 mm of clear paper before the unit; the kit's real manifest gives
  `qty w = 5.48 mm · unit w = 4.89 mm` with 1.1 mm between them. Every belt the suite proves is proved
  on geometry the printer never makes, and the only covered correction is one written IN PLACE. The
  failing case — a correction written BESIDE a glyph-tight printed cell, rendered sharp — belongs in
  the suite, so a gate that runs one face at one level cannot hide it.
- **A hand that writes exactly over the printed value.** Both belts have a blind spot and it is narrow
  and stated: a correction written at the same size, in the same place, in a light stroke adds so
  little ink that a cell can carry LESS of it than an untouched two-digit cell beside it. Measured,
  that arrangement separates by 8 %, which is under the noise. The band reads a hand that writes BESIDE
  the printed value, which is what a person does with a pen and a box; a struck-through value is read
  today because striking through adds ink.
- **A printed value's COLUMN as well as its ink.** The manifest states where a printed value's glyphs
  stand; a hand needs the seat around them. The runtime reaches 30 mm because it has nothing better to
  go on, and on a denser sheet a product name could fall inside the reach and read as a correction. If
  the manifest stated the seat — or the product's own rectangle — the seat would stop exactly where the
  paper does, the saturated-box blind spot would close with it, and `choose_page` would have something
  real to discriminate on. A change to both halves of the contract, so it is written here rather than
  taken.
- **The hand the harness writes is placed where the runtime can reach.** `handwrite` puts a quantity
  correction at `qty.x − 13 mm` and `HAND_REACH_MM = 30` gives the seat about 16 mm of reach on that
  side. The two were tuned in the same session; a hand 20 mm out would be invisible. The reach and the
  hand need independent evidence.

### PAP-09.2 · The reader

- **The pinned floor for `gemini-2.5-flash-lite` is one draw and it did not reproduce**: 47 % against a
  pin of 0.85, on the identical photograph, four hours later. Either point the drive's default at
  `gemini-3-flash-preview` (independently reproduced at 19/19, 100 %, 203.6 s a page) or drop the
  flash-lite row from `VALUE_FLOOR` until it has been measured more than once. Until then
  `run-196-manifest.py` pins a count for a run that fails today.
- **The configured default has no measured row at all.** The floors are measured on
  `gemini-2.5-flash-lite` and `gemini-3-flash-preview`; `gemini-2.5-flash` is what ships, and its
  free-tier quota was spent by the workstream that proved the seam. One run of
  `tools/paper-harness.py --model gemini-2.5-flash` after the quota resets fills the row. What is owed
  is a value column, not a floor: the pipeline's own columns were identical under every reader that
  answered.
- **Gemini's model name follows the configuration and anthropic's does not.** `reader_word()` answers
  `settings.gemini_model` for gemini and the fixed word `"claude"` for anthropic, so an anthropic box
  pointed at another model reports the wrong thing in the one field a person consults to decide whether
  to trust a number. Make the two halves symmetric.
- **The anthropic reader's live half** is a credit balance and no code. The account answers «Your
  credit balance is too low».
- **The live reader test cannot fail.** `test_paper_handwriting.py:315` skips on ANY `RuntimeError_`,
  so a spent quota and a genuine `handwriting_failed` read the same — and this work's own empty-answer
  guard raises exactly that code. Skip only on 429 · 503 · `handwriting_missing`.
- **Provider deletion is unstated.** PAP-02.4 covers the manifest's own retention and the photograph is
  never written to this disk. What the reader's provider keeps of a crop it was sent, and for how long,
  is not in this spec and belongs beside THE-SOURCE-PRIVACY-SPEC's custody rules.

### PAP-09.3 · The evidence

- **Real pen samples.** Everything above is synthetic by design (§198 asked for exactly that), and
  synthetic paper has no crease, no thermal-printer banding and no fluorescent flicker. The floors are
  floors for this harness until a phone confirms them.
- **Real handwriting.** Caveat is a typeface, not a hand. PAR-07's corpus is still owed and this road
  adds a column to it: written cells, scored per field.
- **Page-two attribution.** The mark lives in the masthead, so pages two and up carry three squares and
  no code, and a photograph of one is refused by name. A fourth square in the top right of later pages
  plus its manifest entry is the honest next step (QR-07.6, QR-09) — and until it lands `choose_page`
  cannot discriminate on glyph-tight cells (PAP-03.7).
- **A second pass at the mark when the mark will not decode.** At 35° on a 1600 px photograph the mark
  goes and the page is refused while the three corner squares are still plainly there. On our own paper
  their size and inset are known without a manifest, so finding the squares first would rectify the
  page and let the mark be read off the flattened image. Measured refusal today; a road tomorrow.
- **Re-measure PAP-03.3's gate separation.** `register.py`'s docstring and the inherited prose give two
  different populations for the same measurement. One run settles it.
- **The gate reads its floors twice.** `drive-196-paper-harness.py` hardcodes `0.45` and `4` rather than
  importing `FLOORS` from `tools/paper-harness.py`. Change the floor in one place and the two disagree
  silently.

### PAP-09.4 · The merges this spec expected, and what RELEASE-195 did with them

Every branch this section listed as owed is MERGED and published as RELEASE-195 (`codex/english-r195`
into `main`). What each carried, and what the merge settled:

| What | Branch | Settled at the merge |
|---|---|---|
| the register stays opaque, and a re-drawn paper re-records (PAP-02.6 · PAP-02.7) | `codex/english-e196` | landed whole |
| the runtime repair round: three hands, the dirt axis, the measurements corrected | `codex/english-e196-read` | landed, and every number in this spec was RE-MEASURED on the merged classifier — the band table (PAP-04.5), the learned floor (PAP-04.2) and the dirt row (PAP-08) all moved, because the two repairs touched the same belts |
| the read-back review and the accept road (PAP-07), `paper-read.ts`, `RuntimeRefused` | `codex/english-e196-surface` | landed; `RuntimeRefused` is E195.21's, which reads the runtime's real `{error:{code,message}}` envelope rather than the `{reason}` this branch guessed |
| the day's paper as two thick tiles on a phone (§199.4) | `codex/english-e196-tiles` | landed, plus the verifier's fix: a standing-down tile shows its STATE and never a number for the act it is refusing |

**THE TWO TYPE VOCABULARIES ARE ONE** (PAP-06.3 asked for it). `runtime-client.ts` keeps E196.3's
names — `PaperRead` · `PaperPageRead` · `PaperCell` — because they are what the mounted surfaces
import, with E196.1's `PaperReadResult` · `PaperPageReading` · `PaperReadingCell` standing as
aliases so nothing that compiled has to be rewritten to say the same thing. `PaperManifest` has one
home, `./paper-manifest`, and `runtime-client.ts` re-exports it.

**AND `rows[].line` IS A STRING END TO END.** The kit prints `l1 · l2 · l3` and the runtime's `Row`
takes `str | int` with a validator; the first tree that held both halves refused every manifest with
«line: Input should be a valid integer», which is what put the type in the contract text rather than
in two independent guesses. **`cells.finalWeight` is REQUIRED on both sides now**: a row with no
final-weight rectangle is not readable paper, so `measurePackingManifest` drops it rather than
posting a manifest the runtime is right to refuse.

`THE-RUNTIME-SPEC` RUN-02 carries the three paper endpoints and `handwriting{reader, key}`.

## PAP-10 · The map

### PAP-10.1 · The runtime

| File | What it holds |
|---|---|
| `mock-api/app/paper.py` | the three endpoints, the manifest as pydantic types, the refusals by name, and the assembly of `readings` |
| `mock-api/app/register.py` | every constant in PAP-03 and PAP-04, the decode ladder, the corner search, the homography, the rectification, the seat, the two belts and `choose_page` |
| `mock-api/app/handwriting.py` | the reader seam, both providers, both prompts, the cross-check, the retry, and the normalisers |
| `mock-api/app/store.py` | manifest custody by token, `storedAt`, and the mtime sweep |
| `mock-api/app/config.py` | `HANDWRITING_READER · GEMINI_MODEL · ANTHROPIC_MODEL · HANDWRITING_TIMEOUT_SECONDS · ROCOTO_PAPER_MANIFEST_DAYS · ROCOTO_MAX_UPLOAD_BYTES`, and `settings.handwriting` |
| `mock-api/app/main.py` | `handwriting{reader, key}` on `/api/health`, beside `providers` |
| `mock-api/deploy/env-names.txt` | the key names the box is started with |

### PAP-10.2 · The kit

| File | What it holds |
|---|---|
| `app/src/prototypes/cedar/paper-manifest.ts` | `PAGE_MM`, `REGISTRATION`, `PAPER_ATTR`, `measurePackingManifest`, the manifest journal and `sendPackingManifest` |
| `app/src/prototypes/cedar/packing-output.ts` | `PACKING_QR`, `parsePackingLocator`, the register of marks issued, `MARK_CEILING`/`MANIFEST_CEILING`, and the opaque projection |
| `app/src/prototypes/cedar/print-view.tsx` | the packing sheet, the three corner marks, the final-weight column and `amountSeats` |
| `app/src/prototypes/cedar/runtime-client.ts` | the paper contract as types and the only place the kit names the three routes |
| `app/src/app/paper-read.ts` | the five postures, the keyed read, the manifest fetch, the copy and the record a document keeps *(`codex/english-e196-surface`)* |
| `app/src/app/paper-read-back.tsx` | the review, the row plan, the crop, type-in-place, the accept and the concern *(`codex/english-e196-surface`)* |
| `app/src/app/detail.tsx` · `albaran-intake.tsx` · `albaran-paper-review.tsx` | where the review is docked and seated *(`codex/english-e196-surface`)* |

### PAP-10.3 · Proofs

| File | What it runs |
|---|---|
| `backend/tests/paper_page.py` | draws a real page from a real manifest and photographs it badly, returning the matrix it used |
| `backend/tests/test_paper_register.py` | the geometry and the classification |
| `backend/tests/test_paper_endpoints.py` | the three endpoints and the contract's own shape |
| `backend/tests/test_paper_handwriting.py` | the seam, both providers, the normalisers, and the live legs |
| `tools/paper-harness.py` | print → handwrite → ruin → read → assert, `LEVELS`, `FLOORS`, `VALUE_FLOOR` |
| `tools/degrade.py` | the repo's shared damage library, reused rather than re-invented |
| `drives/drive-196-paper-manifest.py` | the printed sheet and the recorded manifest, 275/0 |
| `drives/drive-196-paper-harness.py` | the harness at its smallest, held to the floor |
| `drives/drive-196-read-back.py` | the review and the accept, 153/0 *(`codex/english-e196-surface`)* |
| `drives/drive-198-parsing-qr.py` | §191.1's opacity assertion over the register, and the mark's own road |
| `drives/run-196-manifest.py` | the offline manifest runner that pins the harness gate |

### PAP-10.4 · The record

| Where | What it says |
|---|---|
| FEED-IA §198 · §199 · «## E196 · Our paper, read back» | the law and the seven clauses the surface was built to |
| THE-ENGLISH-DESIGN-BACKLOG «## E196» | board rows E196.10 · .11 · .12 · .20 · .21 · .22 · .30 · .31 · .40 · .50 · .51 |
| [THE-QR-SPEC](THE-QR-SPEC.md) QR-07 | the corner marks and the manifest as the MARK's business |
| [THE-PARSING-SPEC](THE-PARSING-SPEC.md) PAR-11 | the pointer back to this document |
| `/home/peter/rocoto-e196-tmp/report-verify-e196-1.md` | the manifest workstream, refuted and repaired |
| `/home/peter/rocoto-e196-tmp/report-verify-harness.md` | the harness workstream, refuted on the gate and on the classification table |
| `/home/peter/rocoto-e196-tmp/report-read.md` | the runtime workstream's repair round, sixteen items |
| `/home/peter/rocoto-e196-tmp/report-surface.md` | the review and the accept, with five defects found by looking |
