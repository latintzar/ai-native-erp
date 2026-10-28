/* THE READ-BACK REVIEW — our paper, read back onto its own lines (FEED-IA E196 · §196.5 · §198.1)
 *
 * ═══ THE WHOLE LOOP, IN ONE SCREEN ═══════════════════════════════════════════════════════════
 * The bay printed a packing list. The scale said what the goods actually weigh. Somebody wrote
 * those numbers in the boxes the sheet left for them. A phone photographed the paper. This is the
 * screen that gives the house those numbers back — and it is built on ONE conviction:
 *
 *      A PERSON JUDGES THE HANDWRITING, NOT A TRANSCRIPTION OF IT.
 *
 * So every row carries the CROP OF THE INK beside the value the runtime read out of it. The
 * reading is a proposal standing next to its own evidence; the eye does the last inch of the work
 * in the half-second it takes to glance, and nothing lands until a hand says so. That is §191.1's
 * «a capture is not an OCR result» taken to its end, and it is why this screen is worth building
 * rather than auto-applying a number and hoping.
 *
 * ═══ WHAT THE ROW SAYS, IN THE ROW LAW'S OWN GRAMMAR (§192–§195) ═════════════════════════════
 *   IDENTITY   the goods, and under them what the sheet PRINTED — «printed 12,5 kg».
 *   THE INK    the crop, at least 44px tall, pressable to see it bigger.
 *   THE VALUE  what was read, as the document's own Figure: quantity then unit, tabular figures,
 *              on one line, editable in place with the same seat §192.2 gave the line's quantity.
 *   THE POSTURE a confident reading of clear writing says NOTHING about itself. A reading that
 *              wants an eye says so in words under the row, and after the accept that sentence
 *              becomes a real concern with the house's own red tab and its own Dismiss (§192.4).
 *   AN EMPTY BOX says what it IS — «left as printed» — never what it lacks.
 *
 * ═══ TWO HOUSINGS, ONE ELEMENT (§74.3's rule, taken literally) ═══════════════════════════════
 *   DESK   the review DOCKS in the detail column, above the lines it is about, so the paper and
 *          the document are read in one eyeline.
 *   PHONE  a full-height sheet with the act bar on the bottom edge, where a thumb is — Print the
 *          final copy on the left, Accept on the right, both on the 44px floor.
 * It is built once and drawn in both, so the two can never drift into two designs.
 *
 * ═══ AND WITHOUT A RUNTIME, NOTHING HERE HAPPENS ═════════════════════════════════════════════
 * `matchedRead` answers only for paper this house printed. Every other posture — no runtime, a
 * document of somebody else's, a sheet whose layout nobody recorded — draws nothing at all, and
 * the door the photo arrived through keeps exactly the behaviour it has always had.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { LayersContext } from 'baseui/layer';
import { Figure, format } from '../../rocoto/figure';
import { OverlayCard, PLACEMENT as CARD_PLACEMENT, SCRIM } from '../../rocoto/overlay-card';
import { ConcernNote } from './anxiety';
import { beginAlbaranCorrection, useAlbaranPaperReview } from './albaran-paper-review';
import { useConfig } from './config';
import { dismissedNow, useDismissals } from './dismissals';
import { useDay, nowOf } from './day';
import { Glyph, STEP } from './glyphs';
import { FLAG_WORD, flagBox, flagEdge, flagTint } from './red-flag';
import { Editable } from './rows';
import { figureTrackPx } from './row-plan';
import {
  buildSales,
  dayLabelFromId,
  editLine,
  putFinalWeight,
  qtyWords,
  roundOf,
  type Sale,
  type SaleLine,
} from './sale';
import {
  PAPER_READ_COPY,
  hasValue,
  journalLine,
  keepPaperRead,
  landable,
  lineKey,
  lookWords,
  matchedRead,
  paperDecimals,
  paperEvidenceLine,
  paperNumber,
  postureOf,
  readerWord,
  readingsOf,
  usePaperManifest,
  usePaperRead,
  usePaperReadRecord,
  type PaperReadAccepted,
  type PaperReadCheck,
} from './paper-read';
import { sessionSource } from './source-retention';
import type { PaperManifest, PaperReading } from './runtime-client';

/* ── THE SHEET HAS TO CLEAR THE APP'S OWN CHROME (§54.1, learned at 390) ─────────────────────
 * The document's phone act bar is fixed at `detail.tsx`'s `LAYER + 2` — 14 — and the overlay
 * layer's own ground is 8, so the review opened UNDER the bar: its bottom act bar was covered, and
 * a press meant for a row landed on «Print again» instead. A full-screen decision stands above
 * every fixed strip the app draws, so the layer takes a number above them. It is stated here
 * rather than imported, because `detail.tsx` imports this file and a cycle for one integer is a
 * worse trade than one documented number.
 */
const SHEET_LAYER = 16;

/** THE CROP'S OWN TRACK. The ink is a piece of the paper at a 44px floor; 140 is the widest a
 *  6 mm × 26 mm cell's crop wants at 42px tall, and the image is capped to the track so a wide
 *  crop shrinks rather than pushing the figure column sideways. */
const INK_TRACK = 140;
/** THE ACTS' OWN TRACK: «Accept» and «Dismiss» as two pills at the 44px floor, plus the air
 *  between them. It is the widest the pair ever is, in every state the row can take — «Keep this
 *  one» alone and «On the line» are both narrower — so the figure column never moves. */
const ACTS_TRACK = 168;
/** the narrowest a value column is ever worth drawing: two figures and their unit */
const VALUE_FLOOR = 112;
/** what the goods' own name may never fall below (§194.2, and the band asserts it at 360) */
const IDENTITY_FLOOR = 148;

/** one line of the review: the reading, and the two objects of ours it belongs to */
type Row = { key: string; reading: PaperReading; sale: Sale; line: SaleLine };
type Block = { sale: Sale; rows: Row[] };

/** WHAT NAMES A ROW OF THE REVIEW — the line AND the box it came out of. The contract lets one
 *  line carry three readings (a quantity, a unit and a final weight), so a row named by the line
 *  alone would give three rows one name: three colliding testids, and a concern raised on one of
 *  them drawn on all three. The box is part of the row's identity because the row IS a box. */
const rowTag = (row: Row): string => row.line.id + '-' + row.reading.cell;

/** WHAT THE SHEET PRINTED IN THIS ROW'S BOX, IN THE PAPER'S OWN CHARACTERS. The manifest carries
 *  the printed figure as a STRING — what the press actually put in the box — so the review and the
 *  sheet in the person's hand say the same thing about the same box; re-formatting the number
 *  would let the screen and the paper disagree while both were right. Where no manifest has
 *  arrived the line's own figure stands, which is what the press wrote it from. */
const printedWords = (manifest: PaperManifest | undefined, row: Row): string => {
  const recorded = manifest?.pages
    .flatMap((page) => page.blocks)
    .find((block) => block.sale === row.sale.id)?.rows
    .find((entry) => entry.line === row.line.id);
  const said = String(recorded?.printed.qty ?? '').trim();
  const unit = String(recorded?.printed.unit ?? '').trim();
  if (!recorded || !said) return qtyWords(row.line.given, row.line.unit);
  return unit ? said + ' ' + unit : said;
};

/** the unit a read value is denominated in — a weight is kilos, everything else is the line's own */
const unitOf = (row: Row): string => (row.reading.cell === 'finalWeight' ? 'kg' : row.line.unit);

/** THE BOX, IN WORDS. `finalWeight` is a field id; a screen reader announcing «What the pen wrote
 *  for finalWeight» has read the schema aloud instead of the sheet. One map, so the accessible
 *  name of the ink and of the seat beside it can never say two different things. */
const CELL_WORD: Record<PaperReading['cell'], string> = {
  finalWeight: 'the final weight',
  qty: 'the quantity',
  unit: 'the unit',
};
const inkWords = (reading: PaperReading): string => 'What the pen wrote for ' + CELL_WORD[reading.cell];

/* ── THE PLAN (§194.2 · §195) ────────────────────────────────────────────────────────────────
 *     «we have like 6 digits in some stuff, and units that use like 6 letters like manojo … and
 *      skus that are like 40 characters. it STILL has to look and fit good and well planned like
 *      when its short so think strategically where to put everything.»
 *
 * ⚠ THE VALUE TRACK IS MEASURED ONCE PER DOCUMENT, OFF THE LONGEST READING ON THE SHEET. It was
 * three hard-coded numbers before, which is not a plan — it is a bet that no sheet ever carries a
 * six-digit quantity, and the first «12.500,5 unidades» collects on that bet. A document whose
 * longest reading is «9,05 kg» gets a narrow column; one that also carries «12.500,5 unidades»
 * widens THE WHOLE SHEET's column, so both figures still land on one right edge instead of one row
 * inventing its own. The per-character arithmetic is `row-plan.ts`'s — the albarán's own
 * calibration of this type, read by both surfaces so neither can drift.
 *
 * ⚠ AND THE POSTURE IS A CONSEQUENCE OF THAT MEASUREMENT, NOT A WIDTH THRESHOLD. A fixed 640px
 * floor said «this desk is wide enough» without ever asking what the sheet was carrying: at 1600
 * the detail column has about 628px of grid, the wide plan needs the identity's floor plus the
 * crop plus the value plus the acts, and with a six-digit quantity on the sheet that comes to more
 * than there is. So the whole document steps down a posture — which is §195's own answer: a sheet
 * never mixes one-line and two-line rows.
 *
 * ⚠ AND THE GOODS' NAME HAS THE FIRST CLAIM ON THE ROOM, WHICH IS WHY THERE IS A THIRD POSTURE.
 * At 360 a forty-character name and a «12.500,5 unidades» figure cannot share a line without one
 * of them being crushed, so both take a line of their own. The value is never given LESS than it
 * needs: a Figure is `nowrap`, so a short track does not shrink it — it paints straight over the
 * name, and every rect-based check passes while the screen is unreadable.
 */
/** THE THREE POSTURES, AND EVERY ONE OF THEM IS A CONSEQUENCE OF THE MEASUREMENT.
 *   wide     identity · crop · value · acts, all on one line.
 *   stacked  identity · value, with the crop and the acts on their own line beneath.
 *   column   everything on its own line, value right-aligned under the name — the posture a 360
 *            phone takes when a six-digit quantity and a forty-character name cannot share a row
 *            without one of them being crushed. It is `columnPlanOf`'s `wraps` for this surface. */
type Posture = 'wide' | 'stacked' | 'column';
type Plan = { valuePx: number; posture: Posture; digits: number; letters: number };

/** WHAT THIS ROW ACTUALLY DRAWS IN ITS VALUE SEAT — the Figure's own grouped rendering where the
 *  reading is a number, and the written word itself where the cell is the unit. Planning off the
 *  raw string would forget the thousands separators the Figure adds, and «12500,5» is two
 *  characters narrower than the «12.500,5» a person sees. */
const shownValue = (row: Row): string => {
  const said = (row.reading.value ?? '').trim();
  const number = paperNumber(said);
  return row.reading.cell !== 'unit' && Number.isFinite(number)
    ? format(number, paperDecimals(said), 'es-ES')
    : said;
};

const planOf = (rows: Row[], room: number, phone: boolean): Plan => {
  let digits = 2;
  let letters = 0;
  rows.forEach((row) => {
    if (!hasValue(row.reading)) return;
    digits = Math.max(digits, shownValue(row).length);
    letters = Math.max(letters, row.reading.cell === 'unit' ? 0 : unitOf(row).length);
  });
  const wants = Math.max(VALUE_FLOOR, Math.ceil(figureTrackPx(digits, letters, 'compact')));
  /* the three gaps of a four-track row, at the theme's own scale400 */
  const GAPS = 30;
  const room_ = room > 0 ? room : wants + IDENTITY_FLOOR + INK_TRACK + ACTS_TRACK + GAPS;
  /* ⚠ THE VALUE ALWAYS GETS WHAT IT NEEDS; THE POSTURE ABSORBS THE SHORTFALL. Capping the track
     instead was the bug this replaced: at 360 a «12.500,5 unidades» figure was given 120px, and
     because a Figure is `nowrap` it simply painted over the goods' own name — a clipped column
     that every rect-based check passes, because the overflow is outside the box that was measured. */
  const posture: Posture = !phone && room_ >= IDENTITY_FLOOR + INK_TRACK + wants + ACTS_TRACK + GAPS
    ? 'wide'
    : room_ >= IDENTITY_FLOOR + wants + 8 ? 'stacked' : 'column';
  return { valuePx: wants, posture, digits, letters };
};

/* ══ THE INK, AND A LOOK AT IT UP CLOSE ═════════════════════════════════════════════════════ */

function Ink({ reading, testid, phone }: { reading: PaperReading; testid: string; phone: boolean }) {
  const [, theme] = useStyletron();
  const [big, setBig] = React.useState(false);
  /* ⚠ THE LAYER, NOT JUST THE CARD (probed at 390: `onTop: false, hit: paper-read-name-p2-l2`).
     Base portals every overlay into a container whose z-index comes from `LayersContext`, and the
     card's own `OverlayChildLayers` raises that to ten for the menus a card opens — a number
     chosen when no card sat at sixteen. A z-index on the card's Root cannot escape a container
     stacked below the sheet, so the ENLARGEMENT PAINTED UNDER THE SHEET with a focus lock held on
     something nobody could see. The layer this card opens in is stated here, above the sheet that
     opened it, and the Root carries the same number so the two can never disagree. */
  const layers = React.useContext(LayersContext);
  const above = React.useMemo(() => ({ ...layers, zIndex: SHEET_LAYER + 1 }), [layers]);
  if (!reading.crop) return null;
  return (
    <>
      <button
        type="button"
        data-testid={testid}
        aria-label={PAPER_READ_COPY.enlarge}
        onClick={() => setBig(true)}
        /* ⚠ THE CROP MUST NOT LOOK LIKE A FIELD (caught by LOOKING at 1600). Drawn on a white
           ground inside a 1px rounded border it was the most input-shaped thing on the row — so
           the photograph read as the editable value and the actual editable value, which rests
           without a mark at the 44px floor, read as text. The ink now stands on the row's own
           ground with no chrome at all: it is a piece of the paper, and it looks like one. */
        style={{
          display: 'block',
          padding: 0,
          minHeight: 44,
          minWidth: 44,
          border: 'none',
          borderRadius: theme.borders.radius100,
          background: 'transparent',
          /* ⚠ A CONTROL WHOSE WHOLE POINT IS «PRESS IT TO SEE THE WRITING BIGGER» HAS TO READ AS
             PRESSABLE. `default` said the opposite under the hand, and the crop carries no border
             and no fill on purpose (it is a piece of the paper), so the pointer is the only thing
             left to say it. `zoom-in` says what the press does as well as that it does something. */
          cursor: 'zoom-in',
          overflow: 'hidden',
        }}
      >
        <img
          data-testid={testid + '-image'}
          src={reading.crop}
          alt={inkWords(reading)}
          /* capped at the crop's own track, so a wide piece of paper shrinks instead of pushing
             the figure column sideways — the value's right edge is the one thing that may not move */
          style={{ display: 'block', height: 42, width: 'auto', maxWidth: phone ? 96 : INK_TRACK, objectFit: 'contain' }}
        />
      </button>
      {big && (
        <LayersContext.Provider value={above}>
        <OverlayCard isOpen onClose={() => setBig(false)} scrim={SCRIM.dim} ariaLabel={PAPER_READ_COPY.enlarge}
          placement={phone ? CARD_PLACEMENT.bottom : CARD_PLACEMENT.center}
          overrides={{ Root: { style: { zIndex: SHEET_LAYER + 1 } } }}>
          <div data-testid={testid + '-big'} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            <img src={reading.crop} alt={inkWords(reading)}
              style={{ display: 'block', width: '100%', maxHeight: '60vh', objectFit: 'contain', background: theme.colors.backgroundPrimary }} />
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={testid + '-big-close'} onClick={() => setBig(false)}
              overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}>
              {PAPER_READ_COPY.close}
            </Button>
          </div>
        </OverlayCard>
        </LayersContext.Provider>
      )}
    </>
  );
}

/* ══ THE ROW'S OWN TWO ACTS — ONE COMPONENT, BOTH HOUSINGS ══════════════════════════════════
 * A desk row carries them in its terminal column; a phone row carries them beside the ink on its
 * second line. It is ONE drawing either way, because two copies of one decision drift.
 *
 *   NOT LANDED, STANDING  → Accept (this reading alone) · Dismiss.
 *   NOT LANDED, PUT ASIDE → one way back and not two: «Keep this one» alone, because «Accept»
 *                           beside it would be two buttons for one decision.
 *   LANDED                → no acts at all, and a record instead: «On the line». It says what IS,
 *                           never what can no longer be done.
 */
function RowActs({ row, editable, landed, dropped, onAccept, onDrop }: {
  row: Row;
  editable: boolean;
  landed: boolean;
  dropped: boolean;
  onAccept: () => void;
  onDrop: (drop: boolean) => void;
}) {
  const [, theme] = useStyletron();
  const tag = rowTag(row);
  if (landed) {
    return (
      <span data-testid={'paper-read-landed-' + tag}
        style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, textAlign: 'end', whiteSpace: 'nowrap' }}>
        {PAPER_READ_COPY.landed}
      </span>
    );
  }
  if (!editable) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: theme.sizing.scale200, minWidth: 0 }}>
      {!dropped && (
        <Button kind={KIND.secondary} size={SIZE.mini} shape={SHAPE.pill}
          data-testid={'paper-read-take-' + tag} onClick={onAccept}
          overrides={{ BaseButton: { style: { minHeight: '44px', whiteSpace: 'nowrap' } } }}>
          {PAPER_READ_COPY.accept}
        </Button>
      )}
      <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill}
        data-testid={'paper-read-drop-' + tag} onClick={() => onDrop(!dropped)}
        overrides={{ BaseButton: { style: { minHeight: '44px', whiteSpace: 'nowrap' } } }}>
        {dropped ? PAPER_READ_COPY.keep : PAPER_READ_COPY.dismiss}
      </Button>
    </span>
  );
}

/* ══ ONE LINE OF THE REVIEW ═════════════════════════════════════════════════════════════════ */

function ReadRow({
  row, manifest, plan, phone, stacked, editable, typed, onType, open, onOpen, dropped, onDrop, onAccept, landed, concern, now,
}: {
  row: Row;
  manifest: PaperManifest | undefined;
  /** the document's own column plan — measured once, over every row on the sheet (§194.2 · §195) */
  plan: Plan;
  phone: boolean;
  /** the plan says the crop and the acts take their own line under the values (§194.2) */
  stacked: boolean;
  editable: boolean;
  typed: string | undefined;
  onType: (value: string) => void;
  open: boolean;
  onOpen: () => void;
  dropped: boolean;
  onDrop: (drop: boolean) => void;
  /** this row's own act: it lands THIS reading and nothing else */
  onAccept: () => void;
  /** the reading is already on the line, so the row is a record rather than a proposal */
  landed: boolean;
  /** the concern this row is carrying, once the accept has raised it */
  concern: PaperReadCheck | undefined;
  now: string;
}) {
  const [, theme] = useStyletron();
  const said = typed ?? row.reading.value ?? '';
  const written = hasValue(row.reading);
  const posture = postureOf(row.reading);
  const good = landable(row.reading, said);
  const number = paperNumber(said);
  const unit = unitOf(row);
  const tag = rowTag(row);
  const seat = 'paper-read-value-' + tag;
  /* ⚠ THE FIGURE KEEPS THE DECIMALS THE PEN WROTE (caught by LOOKING at 1600). A fixed three
     turned «21,4» into «21,400 kg», which a person scanning a column reads as twenty-one thousand
     four hundred — the exact mis-read §195 is written against. So the count comes off the writing
     itself: one decimal stays one, «9,05» stays two, a whole number stays whole. */
  const decimals = paperDecimals(said);

  /* THE VALUE, AT REST AND UNDER THE HAND (§51.14 · §192.2). Pressing the figure swaps it for a
     focused field in its own seat — no popover, no form under the row.
     §192.2's three acts, and they are three DIFFERENT acts:
       ENTER   commits what was typed and closes the seat. An unusable value is not a commit, so
               Enter over one keeps the seat open with its error standing.
       ESCAPE  leaves it. The draft is dropped and the row shows the reading again — which is the
               only way out that does not make a person retype the number the paper already says.
       LEAVING commits a valid change, the way the line's own note seat does; an unusable value
               cannot be left behind on a row, so leaving drops that instead. */
  /* WHAT THE ROW CARRIED WHEN THE SEAT OPENED. Escape goes back to THIS, not to the reading: a
     row that already holds a correction a person made and confirmed must not lose it because the
     next edit was abandoned. It latches on the way in, which is the only moment it is knowable. */
  const was = React.useRef(said);
  React.useEffect(() => { if (open) was.current = typed ?? row.reading.value ?? ''; }, [open]);
  const drop = () => { onType(was.current); onOpen(); };
  const leave = () => { if (good) onOpen(); else drop(); };
  const value = written ? (
    open ? (
      <Input
        value={said}
        autoFocus
        aria-label={'What the paper says for ' + row.line.product.name}
        onChange={(event) => onType(event.currentTarget.value)}
        /* ⚠ ESCAPE LANDS ON THE KEY-UP, AND THAT IS LOAD-BEARING (found by probing at 390).
           Base's `LayersManager` closes the topmost overlay on a DOCUMENT `keyup` for Escape and
           never looks at `defaultPrevented`. Closing the seat on the key-DOWN unmounted this input
           before that key-up existed, so there was no handler left to stop it and one press meant
           two things: the edit cancelled AND the whole phone sheet dismissed under it. Handled on
           the key-up, the field is still mounted, the event stops here, and Escape means exactly
           one thing while a seat is open. */
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (good) onOpen(); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); drop(); }
        }}
        onBlur={leave}
        error={!good}
        overrides={{
          Root: { style: { minHeight: '44px', minWidth: 0, width: '100%' } },
          Input: {
            props: { inputMode: row.reading.cell === 'unit' ? 'text' : 'decimal', 'data-testid': seat + '-field' },
            style: { minHeight: '44px', textAlign: 'end', fontVariantNumeric: 'tabular-nums' },
          },
        }}
      />
    ) : (
      <Editable label={'What the paper says for ' + row.line.product.name} testid={seat} minimumTarget={44} terminal
        open={false} onOpen={onOpen}>
        {row.reading.cell === 'unit' || !Number.isFinite(number)
          ? <span style={{ ...theme.typography.HeadingXSmall, fontVariantNumeric: 'tabular-nums' }}>{said}</span>
          : <Figure value={number} unit={unit} decimals={decimals} size="compact" />}
      </Editable>
    )
  ) : (
    /* SAY WHAT IT IS. An empty box is a line that goes out exactly as the sheet printed it. */
    <span data-testid={seat + '-blank'} style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
      {PAPER_READ_COPY.blank}
    </span>
  );

  return (
    <div
      data-testid={'paper-read-row-' + tag}
      data-line={row.line.id}
      data-cell={row.reading.cell}
      data-written={written ? 'yes' : 'no'}
      data-posture={posture}
      data-dropped={dropped ? 'yes' : 'no'}
      data-landed={landed ? 'yes' : 'no'}
      data-plan={plan.posture}
      data-value={good ? said.trim() : ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale200,
        padding: theme.sizing.scale300,
        borderRadius: theme.borders.radius400,
        /* §192.4 · §196.3: a flagged row is ONE outlined object, and the note is its tab inside.
           `flagBox` is the house's own declaration of both states at once (`red-flag.tsx`), which
           is exactly why it exists — a hand-written copy of the same two lines is where the two
           states drift apart. */
        ...flagBox(theme, Boolean(concern)),
        background: dropped ? 'transparent' : theme.colors.backgroundSecondary,
        opacity: dropped ? 0.62 : 1,
        minWidth: 0,
      }}
    >
      {concern && (
        <span
          data-testid={'paper-read-concern-tab-' + tag}
          style={{
            display: 'block',
            margin: `-${theme.sizing.scale300} -${theme.sizing.scale300} 0`,
            borderTopLeftRadius: theme.borders.radius400,
            borderTopRightRadius: theme.borders.radius400,
            overflow: 'hidden',
            background: flagTint(theme),
            borderBottom: `1px solid ${flagEdge(theme)}`,
          }}
        >
          <ConcernNote sale={row.sale} concern={'paper-read:' + tag} says={concern.says} now={now}
            mark={FLAG_WORD.check} tab testid={'paper-read-concern-' + tag} />
        </span>
      )}
      <div
        style={{
          display: 'grid',
          /* ── THE COLUMNS ARE PLANNED, NOT LEFT TO THE CONTENT (§194.2 · §195) ─────────────
             The crop, the value and the acts take FIXED tracks, so every figure in the review
             lands on one right edge down the whole sheet the way an invoice's does — a value
             column that moved because one crop was wider than another is the inconsistency §195
             rules out. The VALUE track is measured ONCE PER DOCUMENT off the longest reading on
             the sheet (`planOf`), so «9,05 kg» and «12.500,5 unidades» share one column. */
          gridTemplateColumns: plan.posture === 'wide'
            ? `minmax(0, 1fr) ${INK_TRACK}px ${plan.valuePx}px ${ACTS_TRACK}px`
            : plan.posture === 'stacked' ? `minmax(0, 1fr) ${plan.valuePx}px`
              : 'minmax(0, 1fr)',
          alignItems: 'center',
          gap: stacked ? theme.sizing.scale300 : theme.sizing.scale400,
          minWidth: 0,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span data-testid={'paper-read-name-' + tag}
            style={{ ...theme.typography.LabelMedium, minWidth: 0, overflowWrap: 'anywhere' }}>
            {row.line.product.name}
          </span>
          <span data-testid={'paper-read-printed-' + tag}
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {PAPER_READ_COPY.printed + ' ' + printedWords(manifest, row)}
          </span>
        </span>
        {/* THE CROP'S TRACK IS ALWAYS THERE, whether or not there is ink to put in it — a cell
            that disappears takes the value column with it, and a figure that moves down the sheet
            is the inconsistency §195 rules out. */}
        {!stacked && (
          <span style={{ display: 'flex', minWidth: 0 }}>
            <Ink reading={row.reading} testid={'paper-read-ink-' + tag} phone={phone} />
          </span>
        )}
        <span style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{value}</span>
        {/* THE ROW'S OWN TWO ACTS, and a row already on the line has neither — it has a record.
            «On the line» says what IS; it never says what can no longer be done. */}
        {!stacked && written && <RowActs row={row} editable={editable} landed={landed} dropped={dropped} onAccept={onAccept} onDrop={onDrop} />}
      </div>
      {stacked && (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, minWidth: 0 }}>
          <Ink reading={row.reading} testid={'paper-read-ink-' + tag} phone={phone} />
          {written && <RowActs row={row} editable={editable} landed={landed} dropped={dropped} onAccept={onAccept} onDrop={onDrop} />}
        </span>
      )}
      {posture === 'look' && !concern && (
        <span data-testid={'paper-read-look-' + tag}
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {lookWords(row.reading)}
        </span>
      )}
    </div>
  );
}

/* ══ THE REVIEW ═════════════════════════════════════════════════════════════════════════════ */

function Review({
  scope, result, phone, editable, onPrint, onClose,
}: {
  scope: string;
  result: NonNullable<ReturnType<typeof matchedRead>>;
  phone: boolean;
  editable: boolean;
  onPrint?: () => void;
  onClose?: () => void;
}) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const now = nowOf(cast);
  const sales = React.useMemo(() => buildSales(cast, edits, { includeArchived: true }), [cast, edits]);
  const manifest = usePaperManifest(result.token);
  const record = usePaperReadRecord(scope, result.token);
  /* subscribed, so a dismissal answered inside a row's own tab settles the row in the same frame */
  useDismissals();

  /* ── THE PLAN IS MEASURED, NOT ASSUMED (§194.2 · §195, caught by LOOKING at 1366) ───────────
   * «the terminal's columns are sized ONCE PER DOCUMENT… and on a phone the tail shares the
   * values' line only when the plan says it fits.» A desk is not one width: at 1366 the detail
   * column is barely 600px, and three fixed tracks left «Gamba roja de Palamós» wrapping to three
   * lines with «printed 2 caja» broken after the number. So the review MEASURES ITSELF, in the
   * room IT has rather than the room the window has — the same review is a full phone and a 600px
   * detail column — and `planOf` decides both the value track and the posture from that. */
  const frame = React.useRef<HTMLElement | null>(null);
  const [room, setRoom] = React.useState(0);
  React.useEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver === 'undefined') return () => {};
    const watch = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setRoom(Math.round(width));
    });
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const [typed, setTyped] = React.useState<Record<string, string>>({});
  const [open, setOpen] = React.useState<string | null>(null);
  const [dropped, setDropped] = React.useState<Record<string, boolean>>({});
  const [saveFailed, setSaveFailed] = React.useState(false);

  /* ── WHAT THE PAPER NAMED, MET WITH WHAT THE HOUSE HOLDS ────────────────────────────────────
   * A reading names a sale and a line. Both are looked up in the house's own fold, and a reading
   * naming something this house does not have is simply not drawn — inventing a row to make a
   * number land is the failure §191.7 named, and it would land here first. */
  const blocks: Block[] = React.useMemo(() => {
    const readings = readingsOf(result);
    const order = result.matched?.sales ?? [];
    return order.flatMap((id) => {
      const sale = sales.find((row) => row.id === id);
      if (!sale) return [];
      const rows = readings
        .filter((reading) => reading.sale === id)
        .flatMap((reading) => {
          const line = sale.lines.find((candidate) => candidate.id === reading.line);
          return line ? [{ key: id + '/' + reading.line + '/' + reading.cell, reading, sale, line }] : [];
        });
      return rows.length ? [{ sale, rows }] : [];
    });
  }, [result, sales]);

  const rows = React.useMemo(() => blocks.flatMap((block) => block.rows), [blocks]);
  /* ⚠ A READING LANDS ONCE. Without this the act stayed armed after it had run, and a second
     press wrote the same seven weights onto the same seven lines a second time — one act, two
     ledgers. The record IS the answer to «has this one gone on already?». */
  const landed = (row: Row): boolean => Boolean(record?.accepted.some(
    (entry) => entry.sale === row.sale.id && entry.line === row.line.id && entry.cell === row.reading.cell));
  const takeable = rows.filter((row) => hasValue(row.reading) && !dropped[row.key] && !landed(row)
    && landable(row.reading, typed[row.key]));

  /* ONE PLAN, THE WHOLE DOCUMENT. Measured over every row on the sheet, in the room the GRID
     really has: the section's own content box (the ResizeObserver's, so its padding is already
     out) less the row's own padding. */
  const plan = React.useMemo(
    () => planOf(rows, room > 0 ? room - 16 : 0, phone),
    [rows, room, phone],
  );
  /* the crop and the acts leave the values' line in both of the narrow postures */
  const stacked = plan.posture !== 'wide';

  /* ── THE HEAD SAYS WHICH PAPER THIS IS ──────────────────────────────────────────────────────
   * The day, the run where every order on the sheet shares one, and the count. A run the orders
   * do not agree on is left unsaid rather than guessed at. */
  /* ⚠ A RUN IS THE SHEET'S ONLY IF EVERY ORDER ON IT HAS ONE. Filtering the undefined rounds out
     first let a sheet where one order is on truck 4 and the other two are on no round at all
     print «truck 4» over the whole thing — an agreement among the orders that HAVE an opinion is
     not an agreement. So the head says the run when all of them are on it, and otherwise says
     nothing about runs at all. */
  const trucks = new Set(blocks.map((block) => roundOf(block.sale)?.truck).filter((truck) => truck !== undefined));
  const oneRun = trucks.size === 1 && blocks.length > 0 && blocks.every((block) => roundOf(block.sale) !== null);
  const title = [
    PAPER_READ_COPY.head,
    dayLabelFromId(result.matched?.day ?? ''),
    ...(oneRun ? ['truck ' + String([...trucks][0])] : []),
    String(blocks.length) + ' order' + (blocks.length === 1 ? '' : 's'),
  ].join(' · ');

  /* ── THE ACT: THE NUMBERS GO ON THE LINES, THROUGH THE DOCUMENT'S OWN EVENTS ────────────────
   * `putFinalWeight` and `editLine` are the SAME verbs a hand uses on the sheet, so a weight that
   * arrived on paper is indistinguishable in the ledger from a weight somebody typed. There is no
   * second road into a document, and `beginAlbaranCorrection` records which printed paper is
   * being corrected — exactly as every manual correction on the albarán already does. */
  const accept = (only?: Row) => {
    const taking = only ? [only] : takeable;
    const accepted: PaperReadAccepted[] = [];
    taking.forEach((row) => {
      const said = (typed[row.key] ?? row.reading.value ?? '').trim();
      if (!hasValue(row.reading) || landed(row) || !landable(row.reading, said)) return;
      beginAlbaranCorrection(scope, row.sale);
      if (row.reading.cell === 'unit') editLine(row.sale, now, row.line.id, { unit: said });
      else if (row.reading.cell === 'qty') editLine(row.sale, now, row.line.id, { given: paperNumber(said) });
      else putFinalWeight(row.sale, now, row.line, paperNumber(said));
      accepted.push({ sale: row.sale.id, line: row.line.id, cell: row.reading.cell, value: said });
    });
    const landedKeys = new Set(accepted.map((row) => lineKey(row.sale, row.line)));
    const checks: PaperReadCheck[] = rows
      .filter((row) => row.reading.check && landedKeys.has(lineKey(row.sale.id, row.line.id)))
      .map((row) => ({ sale: row.sale.id, line: row.line.id, cell: row.reading.cell, says: row.reading.check ?? '' }));
    /* EVERY LINE THIS PAPER HAS SHOWN, UNIONED. The runtime answers one page per photograph, so a
       two-page sheet arrives as two photographs against one token: the lines this review saw are
       ADDED to the ones an earlier photograph of the same paper already showed. A count written
       fresh each time would say «8 of 4 lines» the moment the second page landed. */
    const seen = [...new Set([
      ...(record?.lines ?? []),
      ...rows.map((row) => lineKey(row.sale.id, row.line.id)),
    ])];
    const kept = keepPaperRead({
      version: 1,
      scope,
      token: result.token,
      day: result.matched?.day ?? '',
      reader: readerWord(result.evidence.reader),
      at: now,
      lines: seen,
      accepted: [...(record?.accepted ?? []), ...accepted],
      checks: [...(record?.checks ?? []), ...checks],
    });
    setSaveFailed(!kept);
  };

  /* A CONCERN A PERSON HAS ANSWERED IS GONE — note, tab and red together (§192.4 · §128.1).
     `ConcernNote` already hides itself on a dismissal; the OBJECT it is a tab on has to go with it,
     so the row asks the same store rather than keeping a boundary around an empty strip. */
  const checkOf = (row: Row): PaperReadCheck | undefined => {
    const check = record?.checks.find((entry) => entry.sale === row.sale.id
      && entry.line === row.line.id && entry.cell === row.reading.cell);
    return check && !dismissedNow(row.sale.id, 'paper-read:' + rowTag(row)) ? check : undefined;
  };

  const acts = (
    <div
      data-testid="paper-read-back-acts"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: phone ? 'space-between' : 'flex-start',
        gap: theme.sizing.scale300,
        flexWrap: phone ? 'nowrap' : 'wrap',
        minWidth: 0,
        /* ⚠ «STICKY BOTTOM 0» LANDS ON THE SCROLLPORT'S INNER BOTTOM — WHICH IS THE PADDING EDGE,
           NOT THE BORDER EDGE. A negative bottom margin pulled the bar down out of that box by the
           section's own padding, so at rest it sat 10px ABOVE the sheet's bottom and the rows
           underneath painted through the gap: measured 360×800 acts.bottom 766 against a sheet
           bottom of 776, with «18,2 kg» printed in the strip between them. The bar keeps its own
           padding and the SECTION gives up its bottom padding instead, so the sticky edge and the
           sheet's edge are the same line. */
        ...(phone
          ? {
            position: 'sticky',
            bottom: 0,
            padding: theme.sizing.scale400,
            background: theme.colors.backgroundPrimary,
            borderTop: '1px solid ' + theme.colors.borderOpaque,
          }
          : {}),
      }}
    >
      {onPrint && (
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid="paper-read-back-print" onClick={onPrint}
          startEnhancer={<Glyph id="print" size={STEP.small} />}
          overrides={{ BaseButton: { style: { minHeight: '44px', whiteSpace: 'nowrap' } } }}>
          {phone ? 'Print' : PAPER_READ_COPY.print}
        </Button>
      )}
      {/* ⚠ «ACCEPT 0 READINGS», GREYED OUT, IS A CONTROL DESCRIBING ITS OWN UNAVAILABILITY. The act
          stands while there is something to land and LEAVES when there is not; the journal line
          above already says what went on the lines. One act, and it is always a real one. */}
      {editable && takeable.length > 0 && (
        <Button kind={KIND.primary} size={SIZE.compact} data-testid="paper-read-back-accept"
          onClick={() => accept()}
          overrides={{ BaseButton: { style: { minHeight: '44px', whiteSpace: 'nowrap' } } }}>
          {PAPER_READ_COPY.accept + ' ' + String(takeable.length) + ' ' + (takeable.length === 1 ? 'reading' : PAPER_READ_COPY.readings)}
        </Button>
      )}
    </div>
  );

  return (
    <section
      ref={frame}
      data-testid="paper-read-back"
      data-posture={phone ? 'sheet' : 'dock'}
      data-plan={plan.posture}
      /* the measured plan, on the document, so a drive can read what the sheet decided */
      data-value-track={String(plan.valuePx)}
      data-digits={String(plan.digits)}
      data-orders={String(blocks.length)}
      data-rows={String(rows.length)}
      data-lines={String(new Set(rows.map((row) => lineKey(row.sale.id, row.line.id))).size)}
      data-token={result.token}
      data-accepted={String(record?.accepted.length ?? 0)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        padding: theme.sizing.scale400,
        /* the sticky act bar IS the sheet's bottom edge on a phone, so the section keeps no
           padding under it — see the bar's own note */
        paddingBottom: phone ? 0 : theme.sizing.scale400,
        border: phone ? 'none' : '1px solid ' + theme.colors.borderOpaque,
        borderRadius: phone ? 0 : theme.borders.radius400,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
        /* ── THE SHEET SCROLLS ITSELF, AND THE ACT BAR STAYS ON THE EDGE ────────────────────
           Found by driving it at 390: a sheet taller than the phone let the layer grow upward
           past the top of the window, and rows scrolled OUT OF REACH — the flex-end layer cannot
           give back what overflows above it. So the review owns its own scrollport, bounded by
           the window, and the acts stay stuck to its bottom where a thumb is. */
        ...(phone ? { maxHeight: 'calc(100dvh - 96px)', overflowY: 'auto' as const } : {}),
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          {/* THE HEADING NAMES THE THING (the content canon): what this paper is, blatantly. */}
          <span data-testid="paper-read-back-title" style={{ ...theme.typography.HeadingXSmall, overflowWrap: 'anywhere' }}>{title}</span>
          <span data-testid="paper-read-back-evidence"
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
            {paperEvidenceLine(result)}
          </span>
        </span>
        {onClose && (
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="paper-read-back-close" onClick={onClose}
            overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px' } } }}>
            {PAPER_READ_COPY.close}
          </Button>
        )}
      </header>

      {blocks.map((block) => (
        <section key={block.sale.id} data-testid={'paper-read-block-' + block.sale.id}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{block.sale.customer.name}</span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{block.sale.number}</span>
          </span>
          {block.rows.map((row) => (
            <ReadRow
              key={row.key}
              row={row}
              manifest={manifest}
              plan={plan}
              phone={phone}
              stacked={stacked}
              editable={editable}
              typed={typed[row.key]}
              onType={(value) => setTyped((all) => ({ ...all, [row.key]: value }))}
              open={open === row.key}
              onOpen={() => setOpen((current) => (current === row.key ? null : row.key))}
              dropped={Boolean(dropped[row.key])}
              onDrop={(drop) => setDropped((all) => ({ ...all, [row.key]: drop }))}
              onAccept={() => accept(row)}
              landed={landed(row)}
              concern={checkOf(row)}
              now={now}
            />
          ))}
        </section>
      ))}

      {/* THE EVIDENCE THE DOCUMENT KEEPS — positive, and it names who read it (§196.5's own
          grammar for a reading's provenance). It arrives the moment the numbers land. */}
      {record && (
        <span role="status" data-testid="paper-read-back-journal"
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {journalLine(record)}
        </span>
      )}
      {/* THE NUMBERS WENT ON; ONLY THE NOTE OF WHERE THEY CAME FROM WAS LOST. That is a
          fact about this browser's storage, not about the goods, so it is stated in the record's
          own quiet ink — a red sentence beginning «The numbers are on the lines» would read as a
          failure of the thing that actually worked. */}
      {saveFailed && (
        <span role="alert" data-testid="paper-read-back-save-error"
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          The numbers are on the lines. Keep this page open to note where they came from.
        </span>
      )}
      {acts}
    </section>
  );
}

/* ══ THE ONE MOUNT — ONE ELEMENT, TWO HOUSINGS ══════════════════════════════════════════════ */

export function PaperReadBack({
  scope, source, sourceKey, phone, editable = true, onPrint, onClose,
}: {
  scope: string;
  /** the photograph, held for this browser session by whichever door took it */
  source: Blob | undefined;
  /** the opaque source ref — one read per photograph, however many seats look at it */
  sourceKey: string;
  phone: boolean;
  editable?: boolean;
  /** the desk's own print act, where the host has one; the phone's act bar shows it beside Accept */
  onPrint?: () => void;
  onClose?: () => void;
}) {
  const { read } = usePaperRead(source, sourceKey);
  const result = matchedRead(read);
  const [shut, setShut] = React.useState(false);
  React.useEffect(() => { setShut(false); }, [sourceKey]);

  /* NOTHING TO SHOW IS NOTHING DRAWN. Without a runtime, or on a document of somebody else's,
     this component is absent and the door the photo arrived through behaves exactly as before. */
  if (!result || shut) return null;

  const close = () => { setShut(true); onClose?.(); };
  const review = <Review scope={scope} result={result} phone={phone} editable={editable} onPrint={onPrint} onClose={close} />;

  if (!phone) return review;
  return (
    <OverlayCard isOpen onClose={close} placement={CARD_PLACEMENT.bottom} scrim={SCRIM.dim} size="100%"
      ariaLabel={PAPER_READ_COPY.head}
      overrides={{ Root: { style: { zIndex: SHEET_LAYER } } }}>
      <div data-testid="paper-read-back-sheet" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {review}
      </div>
    </OverlayCard>
  );
}

/** THE DETAIL COLUMN'S OWN SEAT. The paper review already holds the photograph a person added to
 *  this document — held for the browser session, no bytes stored — so the read-back reads THAT
 *  photograph rather than asking for a second one. One door, one photo, one read.
 *
 *  A document with no photo, or a photo of a sheet the runtime holds no layout for, draws nothing
 *  and the paper review below keeps exactly the card it has always had. */
export function PaperReadBackDock({
  scope, sale, phone, editable, onPrint,
}: {
  scope: string;
  sale: Sale;
  phone: boolean;
  editable: boolean;
  onPrint?: () => void;
}) {
  const review = useAlbaranPaperReview(scope, sale);
  const ref = review?.photo?.sourceRef;
  const source = ref ? sessionSource(ref) : undefined;
  if (!ref || !source) return null;
  return <PaperReadBack scope={scope} source={source} sourceKey={ref} phone={phone} editable={editable} onPrint={onPrint} />;
}
