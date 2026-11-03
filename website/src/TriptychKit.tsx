import { useLayoutEffect, useRef, useState } from 'react'
import { useBeat, useEnter } from './motionkit'

/** ── THE MORPH · canon §37 (evolves §36's triptych) ──────────────────────────────────────────
 *
 *  «The gallery is all square — apart from the wide one with the WhatsApp voice-note/image to
 *   albarán… but maybe even that is an animation: FIRST the image/voice note to transcription,
 *   and THEN they MORPH to become the albarán generating. Better. Then we can even put that in
 *   the hero.» (Peter, 2026-08-29)
 *
 *  ══ ROUND 5 · TWO RUNS, TWO ORDERS ════════════════════════════════════════════════════════════
 *
 *  «make the order different in each. and make the transcript bigger font, no need for the extra
 *   space it has» (Peter, round 5).
 *
 *  HE IS NAMING A LIE THE BAND WAS TELLING. Round 4 alternated the INPUT — a voice note on one run,
 *  the photographed order pad on the next — while both runs read out the SAME fish order and built
 *  the SAME albarán. So the photo run boxed four handwritten lines that say `Costilla 8k · lomo 4
 *  cajas · chorizo 3k · morcilla 2` and then wrote «12 kg Merluza» out of them. The boxes were
 *  honest; everything downstream of them was not.
 *
 *    RUN A · THE VOICE NOTE  →  HOSTAL MONTSERRAT'S FISH ORDER, three lines, 887,77 €
 *    RUN B · THE PHOTO       →  CASA BERMEJO'S MEAT ORDER, four lines, 209,00 €
 *
 *  and run B's four lines are READ OFF THE PAD IN THE PHOTOGRAPH, line for line, in the order they
 *  are written on it. That is now the argument at full strength: two different customers send two
 *  different things in two different ways, and the same machine writes both documents.
 *
 *  ⚠️ WHERE RUN B'S FIGURES COME FROM — every one of them off a SHIPPED surface, not one filled in.
 *  `HowItWorks.tsx` carries Casa Bermejo's order verbatim from the app's own strings, five rows:
 *      Costillas 8 kg 76 € · Lomo 4 cajas 72 € · Panceta 5 kg 35 € · Chorizo 3 kg 33 € ·
 *      Morcilla 2 cajas 28 €
 *  and `ReviewCard.tsx` (lifted from strings.xml: `doc_lines`, `doc_what_they_sent`) carries the
 *  same house, the same customer and the first three of those rows with cents — `Costillas 8 kg
 *  76,00 €`, `Lomo 4 cajas 72,00 €`. THE PAD IS FOUR OF THOSE FIVE ROWS: the four the customer
 *  wrote down. Panceta is the fifth and it is NOT on the pad, so it is not on this albarán.
 *      76,00 + 72,00 + 33,00 + 28,00 = 209,00 — the document's own arithmetic over its own lines.
 *  · `Casa Bermejo` and `Friday` are ReviewCard's own header (`Viernes, 24 jul`).
 *  · The albarán's reference keeps the composer capture's own counter (`…-7000`) against this
 *    document's own day: `2407-7000`. The counter is CARRIED rather than invented — one house, one
 *    sequence — and it is stated here so a reviewer can see exactly what was derived.
 *  · `Tarifa 1` is the composer capture's own band, likewise carried.
 *  · The paintings are the app's own 793-file library (`situations/baseweb/public/paintings`):
 *    `costillar-de-cerdo` · `lomo-de-cerdo` · `chorizo` · `morcilla`, resized to the faces' 128 px.
 *
 *  ⚠️ AND RUN B'S DAY DOES NOT FLY, BECAUSE THE PAD HAS NO DAY ON IT. Look at the photograph: four
 *  products and four quantities, and nothing else. On run A `Friday 22.08` leaves the sentence and
 *  lands in the albarán's head, because the customer said it. On run B the head's `for ▒▒▒` bar is
 *  filled by ROCOTO, on the same beat as the paintings and the prices — one more thing the words
 *  could not carry (§33, «the KNOWING»). That is a stronger claim than the flight would have been,
 *  and it is the only one the picture supports.
 *
 *  ══ ROUND 4 · THE ALTERNATING LOOP, AND ONE INPUT AT A TIME ═══════════════════════════════════
 *
 *  «V44 needs improvement: voice note as the ONLY thing, everything centered — or a ROTATING
 *   animation: one run is a voice note → transcription; run it again and it's an IMAGE with little
 *   bounding boxes on it.» (Peter, round 4)
 *
 *    RUN A · THE VOICE NOTE, ALONE   the bubble plays and the transcript writes on ONE progress —
 *                                    filled bars, the 0:0N counter and the typed characters all
 *                                    track the same fraction.
 *    RUN B · THE PHOTO, ALONE        FOUR little bounding boxes snap onto the pad's four written
 *                                    lines, staggered, in the app's own accent — and then the read
 *                                    lines WRITE into the card, one box handing over as its line
 *                                    lands.
 *
 *  …and then BOTH runs morph into AN ALBARÁN, which is the entire argument: two different things
 *  arrive from two different customers and one kind of document comes out. The morph, the flight
 *  plan, the ghost rows, the development and the foot are shared code; nothing about stage two
 *  knows which run it is playing beyond the rows it was handed.
 *
 *  EVERYTHING IS CENTRED ON ONE AXIS. The media block is a FIXED 164px slot, its content centred
 *  and bottom-anchored, standing directly on top of the card — so the piece that was sent sits
 *  exactly where the reading of it is about to be written, and the card's box is reserved from
 *  frame one (it fades in; it never inserts). Nothing in stage one reflows.
 *
 *    THE MORPH               the card GROWS to the albarán's geometry, and the words the reader
 *                            just watched arrive TRANSPOSE into the document: each quantity flies
 *                            into its line's first chip and each name into its line's name.
 *    STAGE 2 · THE GENERATING what the words could NOT carry arrives after them, one line at a
 *                            time: the painting off the catalogue and the price off the tarifa.
 *                            That separation IS the argument (canon §33, «the KNOWING»).
 *
 *  HOW THE FLIGHT IS COMPUTED (and why it cannot drift): the two layers — the reading and the
 *  albarán — are both absolutely positioned inside the card, so their internal layout is FIXED
 *  whatever height the card currently holds. One layout pass measures every token against its
 *  destination and writes `--dx/--dy/--sc` onto the token; CSS then flies it on the app's own
 *  curve. Nothing is a hand-typed pixel, so a font swap or a re-theme moves source and target
 *  together. If a destination is ever missing the token simply fades where it stands.
 *
 *  ⚠️ RUN A's FIGURES, unchanged and each off a real capture (BEATS.md's one rule):
 *    · `Hostal Montserrat`, `2208-7000`, `for Friday 22.08 · at 09:45`, `Tarifa 1`, the map thumb
 *          — app-frames/comerciales-composer.png (BEATS.md §3, beat 3)
 *    · `Merluza` · `12 kg · class A · sin cabeza · lote` · `189,60 €`   — same capture
 *    · `Gamba roja de Palamós` · `6 kg · class A · lote` · `552,00 €`   — BEATS.md §3, beat 5
 *    · `Rape` · `7,5 kg · class A · lote` · `146,17 €`                  — app-frames/albaran-sheet.png
 *    · the transcript's own grammar `For <day>: <qty> <product>, …`     — app-frames/chat-voznota.png
 *    · the grey placeholder bar standing in for the day (`for ▒▒▒`) and the ghost line-rows are
 *      the app's OWN empty albarán — `composer-ghost-0/1/2` + `composer-dock-ghost` (BEATS §3,
 *      beat 1), never a loading skeleton.
 *  Its foot totals its own three lines (189,60 + 552,00 + 146,17 = 887,77).
 *
 *  §29 CHROMELESS throughout: a bare bubble, no phone; a bare document card, no pane or window.
 *  §36 DENSITY: ONE element above, ONE card below. Nothing else earns a place.
 */

const F = '/assets/app-motion/faces/'

/** THE STAGE — the island's own composed pixels. It is drawn at this size and scaled as a whole to
 *  whatever column it lands in (motionkit's rule: scale, never re-flow), so the gallery's square,
 *  a 390px phone column and a hero slot are all the SAME drawing.
 *
 *  ROUND 5 · 500 → 520 TALL, AND IT COSTS NOTHING. Run B's albarán carries FOUR lines, so its
 *  settled card is 79 px taller than run A's (94 head + 4×79 + 58 foot = 468 against 389). In the
 *  gallery's 1:1 box the fit is `min(availW / 536, availW / NH)` and 536 is the larger denominator,
 *  so any NH at or under the stage's own WIDTH is free — the scale stays width-bound at 536 and the
 *  taller run simply has room. 520 leaves the four-line card 26 px of air on each side for its
 *  shadow to stand in. */
const NW = 536
const NH = 520

/** ── THE TWO ORDERS ─────────────────────────────────────────────────────────────────────────────
 *  A line wears its own product cut-out painting, the chips it was written with, and its money.
 *  `qty` / `qual` are the INDEXES of the chips a word from the reading flies into — `-1` for none.
 */
type Line = {
  face: string; name: string; head: string; tail: string
  chips: string[]; qty: number; qual: number; int: string; dec: string
}

/** RUN A — Hostal Montserrat's fish order, off comerciales-composer.png + albaran-sheet.png */
/** «class A» is CHROME, not data — the grade letter is the fact, the word in front of it is the
 *  document's own label. The lines are module constants, so the word is carried as a sentinel and
 *  swapped for `L[lang].classA` where the chip is painted. */
const CLASS_A = '\u0000class'

const LINES_A: Line[] = [
  { face: F + 'merluza.webp', name: 'Merluza', head: 'Merluza', tail: '',
    chips: ['12 kg', CLASS_A, 'sin cabeza', 'lote'], qty: 0, qual: 2, int: '189', dec: ',60' },
  // ⚠️ THE TAIL'S LEADING SPACE IS A NBSP, WRITTEN AS AN ESCAPE. The half that completes the name is
  // an inline-block (it has to be, to open from zero width) and an inline-block eats a leading
  // ordinary space — «Gamba rojade Palamós» on the settled frame. Round 2 fixed this by pasting a
  // literal U+00A0 into the string, which is invisible in a diff and did not survive the next edit
  // of this file: the bug was back on the round-5 render. ` ` cannot be lost by an editor.
  { face: F + 'gamba-roja.webp', name: 'Gamba roja de Palamós', head: 'Gamba roja', tail: ' de Palamós',
    chips: ['6 kg', CLASS_A, 'lote'], qty: 0, qual: -1, int: '552', dec: ',00' },
  { face: F + 'rape.webp', name: 'Rape', head: 'Rape', tail: '',
    chips: ['7,5 kg', CLASS_A, 'lote'], qty: 0, qual: -1, int: '146', dec: ',17' },
]

/** RUN B — Casa Bermejo's meat order, the pad's own four lines in the pad's own order.
 *  THE UNIT IS THE THING ROCOTO ADDS. The pad says `8k`, `4 cajas`, `3k`, `2`; the document says
 *  `8 kg`, `4 cajas`, `3 kg`, `2 cajas` — HowItWorks' own rows. A shorthand flying into a written
 *  unit is the same move « de Palamós» makes on run A: the word completes as it lands.
 *  NO `class` CHIP HERE. `class A` is the fish counter's grading and it is on run A's capture; a
 *  grade asserted on chorizo would be a word this house has not said. The lot is universal — every
 *  albarán carries the trazabilidad — so the meat lines wear the quantity and `lote`. */
const LINES_B: Line[] = [
  { face: F + 'costillar.webp', name: 'Costillas', head: 'Costillas', tail: '',
    chips: ['8 kg', 'lote'], qty: 0, qual: -1, int: '76', dec: ',00' },
  { face: F + 'lomo.webp', name: 'Lomo', head: 'Lomo', tail: '',
    chips: ['4 cajas', 'lote'], qty: 0, qual: -1, int: '72', dec: ',00' },
  { face: F + 'chorizo.webp', name: 'Chorizo', head: 'Chorizo', tail: '',
    chips: ['3 kg', 'lote'], qty: 0, qual: -1, int: '33', dec: ',00' },
  { face: F + 'morcilla.webp', name: 'Morcilla', head: 'Morcilla', tail: '',
    chips: ['2 cajas', 'lote'], qty: 0, qual: -1, int: '28', dec: ',00' },
]

/** WHAT ARRIVED, in the app's own reading grammar — cut into the pieces that fly.
 *  `[text, key, group]`: a key of `null` is glue (it fades where it stands); `group` is the flight
 *  wave, so the lines leave the sentence in the order they land on the document — AND, on the photo
 *  run, the wave a bounding box hands its line over to. */
type Seg = [string, string | null, number]


/** RUN A · joined, exactly the sentence the triptych typed:
 *  «For Friday 22.08: 12 kg Merluza sin cabeza, 6 kg Gamba roja, 7,5 kg Rape» */
const SEGS_A_EN: Seg[] = [
  ['For ', null, 0],
  ['Friday 22.08', 'date', 0],
  [': ', null, 0],
  ['12 kg', 'q0', 1], [' ', null, 0], ['Merluza', 'p0', 1], [' ', null, 0], ['sin cabeza', 'x0', 1],
  [', ', null, 0],
  ['6 kg', 'q1', 2], [' ', null, 0], ['Gamba roja', 'p1', 2],
  [', ', null, 0],
  ['7,5 kg', 'q2', 3], [' ', null, 0], ['Rape', 'p2', 3],
]

/** THE SAME MESSAGE IN SPANISH — the customer's own words, which on the Spanish site are Spanish.
 *  ⚠️ The segments are the measure: `groupEnds` derives the hand-over offsets FROM this array, and
 *  `sayLines`/`h1` below are re-measured by the card's own pass, so a longer or shorter sentence
 *  cannot fall out of step with the boxes. The day token keeps its `date` key because it is the
 *  one that flies to the albarán's head — so `RUNS.day` has to read the same string. */
const SEGS_A_ES: Seg[] = [
  ['Para el ', null, 0],
  ['viernes 22.08', 'date', 0],
  [': ', null, 0],
  ['12 kg', 'q0', 1], [' ', null, 0], ['Merluza', 'p0', 1], [' ', null, 0], ['sin cabeza', 'x0', 1],
  [', ', null, 0],
  ['6 kg', 'q1', 2], [' ', null, 0], ['Gamba roja', 'p1', 2],
  [', ', null, 0],
  ['7,5 kg', 'q2', 3], [' ', null, 0], ['Rape', 'p2', 3],
]

/** RUN B · WHAT IS ACTUALLY WRITTEN ON THE PAD, in the pad's own shorthand and its own lower case —
 *  `Costilla 8k`, `lomo 4 cajas`, `chorizo 3k`, `morcilla 2`, one per boxed line. It reads as a
 *  reading of handwriting because it IS one; the albarán under it is where the words get spelled
 *  out, given units and priced. No day: the pad carries none (see the head note above). */
const SEGS_B: Seg[] = [
  ['Costilla', 'p0', 1], [' ', null, 0], ['8k', 'q0', 1],
  [', ', null, 0],
  ['lomo', 'p1', 2], [' ', null, 0], ['4 cajas', 'q1', 2],
  [', ', null, 0],
  ['chorizo', 'p2', 3], [' ', null, 0], ['3k', 'q2', 3],
  [', ', null, 0],
  ['morcilla', 'p3', 4], [' ', null, 0], ['2', 'q3', 4],
]

/** WHERE EACH GROUP FINISHES WRITING, as a character offset into the joined sentence. Derived from
 *  the segments rather than typed, so the boxes can never fall out of step with the sentence: box
 *  `g` hands over the moment the last word of wave `g` has landed on the page. */
function groupEnds(segs: Seg[], waves: number) {
  const ends = new Array(waves + 1).fill(0)
  let off = 0
  segs.forEach(([text, , g]) => { off += text.length; if (g > 0) ends[g] = off })
  return ends
}

/** ── THE BOUNDING BOXES, IN THE PHOTO'S OWN DISPLAYED PIXELS ─────────────────────────────────
 *  FOUR written lines on the pad, boxed the way a reader boxes what it found — round 5 added the
 *  fourth, because the pad has four lines and the order now carries all four. The <img> box is
 *  238 × 158 inside the bubble's 3px padding; `notebook.webp` is 728 × 461 and `object-fit: cover`
 *  scales it by 158/461 = 0.3427 and crops 5.75px off each side. These are that transform applied
 *  to each written line's ink box, measured on a render at 4× and corrected there.
 *
 *  ⚠️ THEY ARE ROTATED, AND THAT IS NOT DECORATION. The pad lies at an angle on the bench, so the
 *  writing falls ~6,5° across the frame: a line drops 23 displayed pixels from its first letter to
 *  its last. Axis-aligned boxes at that pitch either miss the end of every line (the first cut put
 *  `8k`, `cajas` and `3k` outside their own box, which reads as a broken overlay) or have to be
 *  half again as tall and swallow the line under them. Rotated to the writing's own angle they hug
 *  one line each — which is also what a real detector emits, a quad and not a rectangle. */
const BOXES = [
  { l: 80, t: 57, w: 80, h: 15, r: 6.5 },
  { l: 78, t: 73, w: 80, h: 15, r: 6.5 },
  { l: 73, t: 89, w: 69, h: 15, r: 6.0 },
  { l: 67, t: 105, w: 75, h: 15, r: 6.0 },
]

/** the destination's type size over THE READING'S own — the token shrinks INTO the document's own
 *  scale as it flies, which is what makes it read as becoming a line rather than moving.
 *  18 → 22 in round 1, 22 → 26 in round 2, 26 → 30 in round 5 («make the transcript bigger font»);
 *  the denominator is the one number that has to move with `.mo-said`'s font-size or every flight
 *  lands at the wrong size. */
const SAY_PX = 30
const TOKEN_SCALE: Record<string, number> = { date: 12.5 / SAY_PX, name: 15 / SAY_PX, chip: 13 / SAY_PX }
const KIND = (k: string) => (k === 'date' ? 'date' : k[0] === 'p' ? 'name' : 'chip')

/** ── UI CHROME, PER LANGUAGE ─────────────────────────────────────────────────────────────────
 *  Only the labels AROUND the seeded data localize. The data itself — products, customers, prices,
 *  the transcript's own words, the days that fly out of it — is the run tables above and stays put:
 *  run A's `Friday 22.08` is a token of the SENTENCE (its character count is measured into
 *  `sayLines`/`h1`, and the flight hands it to the head verbatim), so it belongs to the content
 *  layer, never to this table. */
const L = {
  es: {
    transcript: 'Transcripción · 0:04',
    photo: 'Leído de la foto',
    padAlt: 'El pedido escrito en la libreta',
    for: 'para',
    at: 'a las',
    lines: 'líneas',
    classA: 'clase A',
  },
  en: {
    transcript: 'Transcript · 0:04',
    photo: 'Read from the photo',
    padAlt: 'The order written on the pad',
    for: 'for',
    at: 'at',
    lines: 'lines',
    classA: 'class A',
  },
} as const

/** the waveform, fixed: a voice note is a recording, so its bars are the same every loop */
const WAVE = [
  18, 34, 26, 52, 41, 68, 47, 30, 22, 44, 61, 78, 55, 36, 24, 49, 72, 88, 63, 41,
  29, 20, 38, 57, 74, 92, 66, 45, 31, 23, 40, 59, 81, 70, 48, 33, 25, 42, 62, 51,
  35, 27, 19, 15,
]

/* ── THE TWO RUNS, AS DATA ───────────────────────────────────────────────────────────────────
   Everything that differs between the voice run and the photo run is in this table; the component
   below reads it and knows nothing else about which run it is playing.

   ⚠️ `say` IS A MEASURED RESERVE AND NOT A GUESS. `.mo-said` holds a fixed number of lines so the
   card cannot grow line by line while the words are typed (round 3's «the height keeps changing»),
   and round 5's verdict — «no need for the extra space it has» — is that the reserve must be the
   sentence's OWN line count and not a round number over it. At 30/40 in the card's 464 px measure,
   run A's 71 characters set on THREE lines and run B's 48 on TWO; both were read off the rendered
   frame at native size, not estimated. The card's stage-one height follows from it:
        20 (pad) + 16 (label) + 12 (gap) + lines × 40 + 22 (pad)
   which is 258 for run A and 218 for run B — and those are the `h1` literals, so the very first
   paint, before the measuring pass runs, is already the right box. */
const RUNS = [
  {
    shot: false, label: 'transcript', segs: { es: SEGS_A_ES, en: SEGS_A_EN }, lines: LINES_A, waves: 3,
    who: 'Hostal Montserrat', ref: '2208-7000', at: '09:45',
    day: { es: 'viernes 22.08', en: 'Friday 22.08' },
    dayFlies: true, tarifa: 'Tarifa 1', int: '887', dec: ',77',
    sayLines: 3, h1: 258, say: 620, morph: 2880,
  },
  {
    shot: true, label: 'photo', segs: { es: SEGS_B, en: SEGS_B }, lines: LINES_B, waves: 4,
    // no delivery hour: run A's `· at 09:45` is the composer capture's own slot for that order and
    // nothing states one for this house. 06:12 is when the PHOTO arrived, which is a different fact
    // and would read as a delivery time standing in that place.
    who: 'Casa Bermejo', ref: '2407-7000', at: '',
    day: { es: 'viernes 24.07', en: 'Friday 24.07' },
    dayFlies: false, tarifa: 'Tarifa 1', int: '209', dec: ',00',
    sayLines: 2, h1: 218, say: 1240, morph: 3760,
  },
] as const

/* ── THE TWO BEAT SCRIPTS, in milliseconds ───────────────────────────────────────────────────
   ONE LOOP LENGTH, TWO RUNS. `useBeat` runs a single clock, so both runs share `LOOP` and each
   holds its settled albarán for whatever is left — 3,3 s on the voice run and 2,2 s on the photo
   run, both over the two seconds a settled frame needs to be read.

   RUN A · THE VOICE NOTE
      0    the bubble arrives, centred, standing on the card's own slot
    620    the card fades up AND the note plays AND the reading writes, ONE progress: the filled
           bars, the 0:0N counter and the typed characters all track the same fraction (Peter:
           «the voice note animation needs to track with the transcript progress»). 72 characters
           at 26 ms each, so the sentence closes at 2492.
   2880    THE MORPH · three waves

   RUN B · THE PHOTO
      0    the photo arrives, centred, in the same slot at the same width
    380    BOX 1 snaps onto the first written line   (260 ms)
    600    BOX 2                                     — 220 ms apart, so the eye follows one at a
    820    BOX 3                                       time rather than watching four appear
   1040    BOX 4
   1240    the card fades up and the read lines WRITE, same 26 ms pace: 48 characters close at
           2488. Each box hands over as its own line lands — `groupEnds` is what ties them, so a
           box can never dim before the words it found are on the page.
   3760    THE MORPH · four waves

   ────── THE MORPH, IDENTICAL IN BOTH RUNS (offsets from that run's `morph`) ──────────────────
     +0    the card starts GROWING to the albarán's geometry (700 ms on the SMOOTH curve — the one
           Peter's «the morphing can be a bit smoother» asks for: a long ease-out with no snap at
           either end). The glue dissolves (200 ms); the albarán's own body comes up under it; the
           media LEAVES ENTIRELY — 480 ms to opacity 0 and to zero height, because «when the
           delivery note appears, it should be just it».
     +0    on run A `Friday 22.08` leaves for the albarán's head        (460 ms flight)
   +280    wave 1's words leave for line 1
   +560    wave 2's for line 2 · +840 wave 3's · +1120 wave 4's (run B only)
   +580    AND the document, a BLURRED ghost of itself while the words crossed it, DEVELOPS: the
           blur clears and the ink comes up over 560 ms — slower than anything else in the band on
           purpose (Peter: «it should come out of the ghosted much better»).
           At each landing the ghost row goes out, the real line comes on under the token, and the
           token hands over (160 ms). THEN what the words could not carry arrives: the painting at
           +110 ms and the price at +200 ms. That gap is the product's whole claim — and on run B
           the DAY arrives on the painting's beat too, because the pad never carried one.
  +1500    THE READING LAYER CLEARS OUTRIGHT — from here the frame carries the albarán and nothing
           else.
  +1800    the foot counts in — `Total · N lines  <amount>`
   ────── and then the settled hold ───────────────────────────────────────────────────────────
   8150    the whole band dissolves over 300 ms and the NEXT RUN starts — the other input, and the
           other order.                                                                       */
const T_MEDIA = 60
const B_BOX = [380, 600, 820, 1040]
const PER = 26
const FLIGHT = 460
/* ⏱ THE SETTLED HOLD IS LONGER THAN THE STORY (2026-08-30). Peter, on the phone hero: «this is
   not hero content. this is low level content» — he had glanced at the band mid-loop and caught a
   photo of a notepad. The band enters at REST (the finished albarán) and always did, but the
   input beats then ran for a third of every cycle, so a glance was a coin toss. The hold after
   the total now runs 2,5 s longer: the albarán is on screen for about 6 s of every 11, the story
   still plays in full, and the odds of a glance landing on the product rather than on its raw
   material go from roughly even to better than two in three. Only the TAIL moved — every beat up
   to `+1800 the foot counts in` is untouched. */
const T_FADE = 10650
const LOOP = 10950
/** settled: read, morphed, every line on, totalled — and it is RUN A's settled frame, because a
 *  static preview must hold a beat that is meaningful in the run it belongs to. */
const REST = 6400

export function TriptychKit({ lang = 'es', static: staticFrame = false }: { lang?: 'es' | 'en'; static?: boolean }) {
  const T = L[lang]
  const [s, root] = useBeat(LOOP, REST, staticFrame, (t, loop) => {
    // ⟳ THE ALTERNATION. `useBeat` counts the wraps, so the run is arithmetic on the loop counter
    // and nothing has to be remembered between frames.
    const r = loop % 2
    const R = RUNS[r]
    const segs = R.segs[lang] as unknown as Seg[]
    const said = segs.map((x) => x[0]).join('')
    const ends = groupEnds(segs, R.waves)
    const M = R.morph
    const FLY = Array.from({ length: R.waves + 1 }, (_, i) => M + i * 280)
    // ONE progress drives the media and the reading together. On the voice run the waveform fills
    // BAR BY BAR rather than by a continuous fraction — it is how a waveform actually plays, and it
    // keeps an eight-second loop to a few dozen renders instead of ~500.
    const p = t < R.say ? 0 : Math.min(1, (t - R.say) / (said.length * PER))
    const n = Math.round(p * said.length)
    // how many flight waves have left, how many lines have landed, and what has arrived after them
    const after = (d: number) => FLY.reduce((c, f, i) => (i > 0 && t >= f + FLIGHT + d ? c + 1 : c), 0)
    const painted = after(110)
    return {
      loop, run: r,
      shot: R.shot,
      media: t >= T_MEDIA,
      // the boxes: drawn on their own beats, dimmed as the line each one found is written
      boxes: R.shot ? B_BOX.reduce((c, b, i) => (i < R.waves && t >= b ? c + 1 : c), 0) : 0,
      read: R.shot ? ends.slice(1).reduce((c, e) => (n >= e ? c + 1 : c), 0) : 0,
      card: t >= R.say - 120,
      bars: Math.round(p * WAVE.length),
      secs: Math.round(p * 4),
      n, said,
      typing: t >= R.say && p < 1,
      morph: t >= M,
      cleared: t >= M + 1500,
      body: t >= M + 100,
      solid: t >= FLY[0] + FLIGHT + 120,
      flew: FLY.reduce((c, f) => (t >= f ? c + 1 : c), 0),
      // THE DAY. On run A it is a word that flew out of the sentence; on run B the pad never
      // carried one, so it arrives with the paintings — a thing Rocoto knew, not a thing it read.
      dated: R.dayFlies ? t >= FLY[0] + FLIGHT : painted > 0,
      landed: after(0),
      painted,
      priced: after(200),
      total: t >= M + 1800,
      fade: t >= T_FADE,
    }
  })
  const R = RUNS[s.run]

  /* ── THE FLIGHT PLAN ────────────────────────────────────────────────────────────────────────
     Measured ONCE PER LOOP, AND ONLY WITH THE SENTENCE WHOLE. The destinations never move (the
     albarán layer is absolutely positioned at its own full height from the first frame), but a
     token's own position depends on how many characters are in front of it — so a measurement
     taken at the loop's start, when every span is still empty, puts every word at the paragraph's
     left edge and the whole flight lands in a heap. Measuring at the moment the reading finishes
     writing (well before the morph, on either run) is what makes each word fly to its own slot.
     Transforms are suspended for the pass (a token that has already flown would otherwise measure
     at its destination) and the ancestor's scale is divided out, so the numbers written are the
     island's OWN pixels. */
  const [k, setK] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  /* rule 15: the band rises into view once before it starts telling its story */
  const entered = useEnter(box)
  const planned = useRef('')

  useLayoutEffect(() => {
    const el = root.current
    if (!el || s.n < s.said.length) return
    const stamp = s.loop + ':' + k
    if (planned.current === stamp) return
    const plan = () => {
      const card = el.querySelector<HTMLElement>('.mo-card')
      const read = el.querySelector<HTMLElement>('.mo-read')
      const alb = el.querySelector<HTMLElement>('.mo-alb')
      if (!card || !card.offsetWidth) return
      el.classList.add('mo-measuring')
      // THE TWO HEIGHTS THE CARD MOVES BETWEEN ARE READ OFF THE TWO LAYERS, never typed: the card
      // is exactly the reading, and then exactly the albarán, whatever the type does at that size.
      if (read) card.style.setProperty('--h1', read.offsetHeight + 'px')
      if (alb) card.style.setProperty('--h2', alb.offsetHeight + 'px')
      const scale = card.getBoundingClientRect().width / card.offsetWidth || 1
      el.querySelectorAll<HTMLElement>('.mo-t').forEach((src) => {
        const key = src.dataset.k || ''
        const dst = el.querySelector<HTMLElement>(`[data-tk="${key}"]`)
        if (!dst) return
        const a = src.getBoundingClientRect()
        const ai = (src.firstElementChild || src).getBoundingClientRect()   // the token's ink box
        const b = dst.getBoundingClientRect()
        const sc = TOKEN_SCALE[KIND(key)]
        src.style.setProperty('--sc', String(sc))
        src.style.setProperty('--dx', (b.left - a.left) / scale + 'px')
        // matched on the two texts' own CENTRE lines, not on box tops: source and destination are
        // set at different sizes, and the transform scales about the token's top-left, so the ink
        // box's centre has to be projected through that scale before the delta is taken
        const cy = a.top + (ai.top + ai.height / 2 - a.top) * sc
        src.style.setProperty('--dy', ((b.top + b.height / 2) - cy) / scale + 'px')
      })
      el.classList.remove('mo-measuring')
      planned.current = stamp
    }
    plan()
    // fonts land after first paint; the sentence re-flows when Inter replaces the fallback
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    fonts?.ready.then(plan).catch(() => {})
  }, [s.loop, s.n, s.said, k, root])

  /* THE ISLAND IS DRAWN AT ITS OWN PIXELS AND THEN FITTED, NEVER RE-LAID-OUT (motionkit's rule).
     Kept local rather than reusing `Fit` because this island brings its own type ramp and its own
     inline-element rules, which `.am-stage` overrides. */
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setK(Math.min(1, (el.clientWidth || NW) / NW))
    fit()
    if (typeof ResizeObserver === 'undefined') {
      addEventListener('resize', fit)
      return () => removeEventListener('resize', fit)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // typed(): how much of each segment has landed by now, one shared character counter
  let off = 0
  const said = (R.segs[lang] as unknown as Seg[]).map(([text, key, g], i) => {
    const shown = text.slice(0, Math.max(0, Math.min(text.length, s.n - off)))
    off += text.length
    if (!key) return <span className="mo-g" key={i}>{shown}</span>
    // a token has HANDED OVER once the thing it became is on the document: the day when the head
    // carries it, a line's words when that line is written
    const done = g === 0 ? s.dated : s.landed >= g
    // the inner <u> is what gets MEASURED: an inline box is the text's own ink box, where the
    // inline-block that carries the transform is a whole line box. Comparing like with like is
    // what puts a flown word on its destination's optical line instead of ten pixels under it.
    return (
      <b className={'mo-t' + (s.flew > g ? ' go' : '') + (done ? ' gone' : '')}
         data-k={key} key={i}><u>{shown}</u></b>
    )
  })

  // the ref div is STABLE (the clock's IntersectionObserver lives on it); the keyed band inside is
  // what remounts at every loop, so the dissolve has something clean to come back to — and so the
  // run that follows starts from nothing rather than from the other run's residue.
  return (
    <div className={'mo-fit' + (entered ? ' is-in' : '')} ref={box}
         style={{ ['--nw' as string]: NW + 'px', height: Math.round(NH * k) + 'px' }}>
      <div className="mo-stage" style={{ width: NW, height: NH, transform: `scale(${k})` }} ref={root}>
        <div className={'triptych-morph' + (s.fade ? ' mo-fade' : '')} key={s.loop}>

          {/* ── ABOVE · ONE THING THE CUSTOMER SENT, bare — no phone around it. The slot is a
                 FIXED 164 and its content is centred and bottom-anchored, so whichever run is
                 playing, what arrived stands on exactly the same line as the card under it and
                 the card's own box never moves. ── */}
          <div className={'mo-media' + (s.morph ? ' back' : '')}>
            {s.shot ? (
              /* RUN B · THE PHOTO, and the boxes that find the written lines */
              <div className={'mo-photo' + (s.media ? ' in' : '')}>
                <div className="mo-shot">
                  <img src="/assets/notebook.webp" alt={T.padAlt} width={238} height={158} loading="lazy" decoding="async" />
                  {BOXES.map((b, i) => (
                    <i key={i}
                       className={'mo-bb' + (s.boxes > i ? ' in' : '') + (s.read > i ? ' read' : '')}
                       style={{ left: b.l, top: b.t, width: b.w, height: b.h,
                                ['--rot' as string]: b.r + 'deg' }} />
                  ))}
                </div>
                <span className="mo-meta mo-meta-on">06:12 <i className="mo-tick">✓✓</i></span>
              </div>
            ) : (
              /* RUN A · THE VOICE NOTE, playing on the reading's own progress */
              <div className={'mo-vn' + (s.media ? ' in' : '')}>
                <div className="mo-vn-row">
                  <span className="mo-vn-play"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z" /></svg></span>
                  <span className="mo-wave">
                    {WAVE.map((h, i) => (
                      <i key={i} className={i < s.bars ? 'on' : undefined} style={{ height: h + '%' }} />
                    ))}
                    <b className="mo-head" style={{ left: (s.bars / WAVE.length) * 100 + '%' }} />
                  </span>
                </div>
                <div className="mo-vn-foot">
                  <span className="mo-dur">0:0{s.secs} / 0:04</span>
                  <span className="mo-meta">06:14 <i className="mo-tick">✓✓</i></span>
                </div>
              </div>
            )}
          </div>

          {/* ── THE ONE CARD. It is the reading, and then it IS the albarán. ───────────────── */}
          <div className={'mo-card' + (s.card ? ' on' : '') + (s.morph ? ' big' : '')}
               style={{ ['--h1' as string]: R.h1 + 'px' }}>

            {/* LAYER B · THE ALBARÁN — laid out at its full height from the first frame, so every
                destination a word flies to is already where it will be. */}
            <div className={'mo-alb' + (s.body ? ' on' : '') + (s.solid ? ' solid' : '')}>
              <div className="mo-alb-head">
                <div className="mo-alb-who">
                  <span className="mo-alb-name">{R.who}</span>
                  <span className="mo-alb-id">
                    <b>{R.ref}</b>
                    <span className="mo-when">
                      {T.for}{' '}
                      <span className="mo-slot">
                        {/* the app's own `for ▒▒▒` grey day bar (BEATS §3, beat 1) waiting for the
                            word that is on its way — or, on the photo run, for the day Rocoto
                            knows, because the pad never said one */}
                        <i className={'mo-ph' + (s.dated ? ' off' : '')} />
                        <b className={'mo-date' + (s.dated ? ' in' : '')}
                           data-tk={R.dayFlies ? 'date' : undefined}>{R.day[lang]}</b>
                      </span>
                      {R.at && ` · ${T.at} ${R.at}`}
                    </span>
                    <em className="mo-tarifa">{R.tarifa}</em>
                  </span>
                </div>
                <img className="mo-alb-map" src={F + 'map-thumb.png'} alt="" width={56} height={58} loading="lazy" decoding="async" />
              </div>

              {/* A LINE LANDS INTO THE GHOST ROW THAT WAS WAITING FOR IT. The grey bars are the
                  app's own empty albarán (`composer-ghost-0/1/2`) — never a loading skeleton. They
                  are why the document reads as a document from the frame it appears in. */}
              {(R.lines as unknown as Line[]).map((l, i) => {
                const on = i < s.landed
                return (
                  <div className="mo-row" key={l.name}>
                    <div className={'mo-ghost' + (on ? ' off' : '')}>
                      <i className="mo-g-tile" />
                      <span className="mo-g-bars">
                        <i className="mo-g-line" style={{ width: [104, 86, 128, 96][i] }} />
                        <i className="mo-g-line mo-g2" style={{ width: [166, 148, 184, 158][i] }} />
                      </span>
                      <i className="mo-g-pill" /><i className="mo-g-pill mo-g-sm" />
                    </div>
                    <div className="mo-line">
                      {/* the painting is NOT in the reading — it arrives from the catalogue
                          after the words, which is the point being made */}
                      <img className={'mo-l-face' + (i < s.painted ? ' in' : '')} src={l.face} alt=""
                           width={32} height={32} loading="lazy" decoding="async" />
                      <span className="mo-l-body">
                        <span className={'mo-l-name' + (on ? ' in' : '')}>
                          <b data-tk={'p' + i}>{l.head}</b>
                          {l.tail && <em className={'mo-l-more' + (on ? ' in' : '')}>{l.tail}</em>}
                        </span>
                        <span className={'mo-l-chips' + (on ? ' in' : '')}>
                          {l.chips.map((c, j) => (
                            <b key={j}><u data-tk={j === l.qty ? 'q' + i : j === l.qual ? 'x' + i : undefined}>{c === CLASS_A ? T.classA : c}</u></b>
                          ))}
                        </span>
                      </span>
                      {/* nor is the price: it comes off this customer's tarifa */}
                      <span className={'mo-l-amt' + (i < s.priced ? ' in' : '')}><b>{l.int}</b><i>{l.dec}</i> €</span>
                    </div>
                  </div>
                )
              })}

              <div className="mo-alb-foot">
                <div className={'mo-ghost mo-dock-ghost' + (s.total ? ' off' : '')}>
                  <i className="mo-g-line" style={{ width: 56 }} />
                  <span className="mo-g-r"><i className="mo-g-pill mo-g-wide" /><i className="mo-g-pill mo-g-sm" /></span>
                </div>
                <div className={'mo-total' + (s.total ? ' on' : '')}>
                  <span className="mo-f-k">Total · {R.lines.length} {T.lines}</span>
                  <span className="mo-f-v"><b>{R.int}</b><i>{R.dec}</i> €</span>
                </div>
              </div>
            </div>

            {/* LAYER A · THE READING — the words, until they become the document. A label and the
                sentence, and nothing else. The label NAMES WHERE THE WORDS CAME FROM, so the two
                runs are legible as two inputs rather than as one animation glitching.
                THE RESERVE IS THIS RUN'S OWN LINE COUNT — see `sayLines` above. */}
            <div className={'mo-read' + (s.morph ? ' gone' : '') + (s.cleared ? ' clear' : '')}>
              <span className="mo-k">{T[R.label]}</span>
              <p className="mo-said" style={{ minHeight: R.sayLines * 40 }}>
                {said}{s.typing && <i className="mo-caret" />}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
