import { soles, solesRate, MONEY_LOCALE, workspaceCurrency } from './currency';
/* THE PRINT VIEW — paper, as a place in the app rather than a button on a row.
 *
 * ═══ WHY THIS IS A SURFACE AND NOT AN ACTION (FEED-IA §7.4, §8) ═════════════════════════════
 * «Print is a first-class citizen — the big "Print the day's sheet" in the day view, a per-order
 * print glyph with its state, print status visible in the facets. Stop underplaying it: paper runs
 * this trade.» A print that is one tap and a toast is a print nobody trusts: the person is about to
 * send a physical object to a bay, and what they need first is to SEE it. So printing opens a view
 * — the sheet at true A4 proportion on `PaperStage`, in the panel beside the list on a desk and
 * full screen on a phone — and the act at the bottom of it is the last step, not the first.
 *
 * ═══ THREE SHEETS, ONE ANATOMY ══════════════════════════════════════════════════════════════
 *   THE DAY SHEET   the round's manifest: every stop in the order the van walks them, each
 *                   customer's lines under their own head, the day's totals at the foot. It never
 *                   leaves the building, so it carries no letterhead and no signature line.
 *   THE ALBARÁN     the document that travels with the goods: the house's name, the customer's
 *                   block, the lines with their LOTE and the family's whole trazabilidad field set
 *                   on a sub-line, the amendments as they were agreed, the total in Figure, and the
 *                   date the payment clock runs to.
 *   THE PACKING LIST  the bay's own paper (§37.7): one block per order, the goods and the amounts
 *                   at arm's-length size, a box to tick against every line — and never a price,
 *                   because the person holding it is filling a crate rather than charging for one.
 * All three come off the scenarios' canonical `print-sheet` — the same masthead, foot, stage and
 * running head — because the delta between a picking list and an albarán is DATA (C-15). This file
 * supplies the column sets and the row builders and changes nothing else about the sheet.
 *
 * ═══ WHAT THE PAPER CARRIES IS A HOUSE'S OWN ANSWER (FEED-IA §37.7) ═════════════════════════
 * «A global setting about albaranes so they're valued or unvalued, even if internally there's
 * prices. And print format structures.»
 *
 *   VALUED / UNVALUED   `config.albaran.values`. Valued is the sheet this app has always printed:
 *                       a price on every line and the total in Figure at the foot. UNVALUED prints
 *                       the goods — the lines, the amounts and the whole trazabilidad — and the
 *                       foot says what the delivery came to in LINES AND GOODS instead of in money.
 *                       The house still prices everything internally; the amounts reach the
 *                       customer on the invoice, and they reach their system on the ERP and email
 *                       rails, which carry the figures under either answer. The setting is about
 *                       PAPER, and the row in Settings says so.
 *   FULL / COMPACT      `config.albaran.shape`. The full sheet is A4 with the lote in a column of
 *                       its own. The compact one is the A5 half sheet: one column fewer, the lote
 *                       folded into the trazabilidad sub-line under the name it belongs to, and
 *                       the same law printed — a half sheet may be smaller and may not be lighter.
 *
 * BOTH ARE DATA, WHICH IS THE WHOLE TEST. Read the two builders below and you will find a column
 * set, a row builder and a foot: no second component, no alternative stage, no branch anywhere
 * near the masthead. If a structure ever needs its own sheet, `el papel` was wrong.
 *
 * ═══ THE FOUR PRINT STATES ══════════════════════════════════════════════════════════════════
 *   PREVIEW   the sheet, and one act: «Print it».
 *   ON THE PRINTER  the act ENQUEUES (FEED-IA §20). The paper is background work now, so the
 *             surface says what the printer still owes and the header's count says it from
 *             every other surface in the app.
 *   PRINTED   the last page has come out — the hour is on the surface, the facet is on the row in
 *             the feed and in the day view, and the event is in the sale's own history.
 *   REPRINT   printing again is ordinary (a sheet gets wet, a crate goes out twice), so the act
 *             stays, renamed, and the count says how many times the paper has been made.
 *
 * WHAT SAFFRON DOES NOT DO HERE. Printing is a PERSON's act from end to end, so there is no accent
 * anywhere on this surface. The trazabilidad block is the law's, the totals are arithmetic, and the
 * only mark on the page is ink.
 */
import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Figure } from './figure';
import { paginate, SHEET, type PaperColumn, type PaperRow } from '../../rocoto/paper';
import PrintSheet, { SheetFoot } from '../../scenarios/canonical/print-sheet';
import { buildRound } from '../../scenarios/canonical/drop-list';
import { familyOf, type Cast } from '../../scenarios/data/cast';
import { useFiscalLine } from './company';
import Name from '../../scenarios/shell/Name';
import { useConfig, type AppConfig, type Derived } from './config';
import { nowOf, plural, useDay } from './day';
import { PanelHead } from './detail';
import { newPrintAttemptKey, printSourceRun } from './browser-print';
import { LineName } from './detail';
import { Glyph, hasGlyph, type GlyphId } from './glyphs';
import { PRINT_LAYOUT_DEFAULTS, type PrintLayoutProfile } from './print-layout';
import { PACKING_QR, packingDocumentLocator, packingLocatorToken, rememberPackingMark } from './packing-output';
import { PAGE_MM, REGISTRATION, measurePackingManifest, opaquePaperManifest, sendPackingManifest, type PaperFormatId } from './paper-manifest';
import {
  albaranOrder, albaranRun, daySheetOrder, jobFor, packingOrder, packingRun,
  printRunWords, setPrintSetup, truckRuns, truckRunWords, usePrintSetup, useQueue,
  type PrintJob, type PrintOrder, type PrintRunKind, type PrintSubject, type TruckRun,
} from './print-queue';
import { usePhone } from './shell';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { capabilityAvailable } from './release-profile';
import {
  amountWords, canPrepare, customerOptionText, dayLabelFromId, dayPrints, payByOf, qtyWords, roundOf, salesOfDay, slotOf,
  type Round, type Sale, type SaleLine,
} from './sale';
/** WHAT IS ON THE STAGE. The day's sheet, one document, or the day's packing lists — the three
 *  things the QUEUE knows about. The type is the queue's, because a job outlives the surface that
 *  started it; this is its second door. */
export type { PrintSubject };
/* Kept for callers that already import the packing builder from its preview. */
export { packingOrder } from './print-queue';
/** AND WHAT THIS SURFACE CAN SHOW, which is now exactly the same set (FEED-IA §37.7, the seam
 *  closed). The packing list used to ride an albarán subject under a reserved `packing:<day>` key
 *  because the queue's union had two kinds and lives in a file this package does not own. It has
 *  three kinds now, so the alias stands only to keep the word `PaperSubject` at the call sites
 *  that already read well with it. */
export type PaperSubject = PrintSubject;
/** HOW MUCH OF ITS OWN CHROME A MOUNT WANTS. The word is documented on `PrintViewProps.chrome`,
 *  where a reader meets it. */
export type Chrome = 'panel' | 'framed' | 'sheet' | 'print';
const money = (n: number): string =>
  n.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* ── THE HEAD, AND THE LOCKUP THAT LIVES IN IT (§54.5 · THE-EXPORT-CANON §7.3) ────────────────
 * «The fitting of logos is still really bad.» — Peter, §54.5.
 *
 * It was, and the diagnosis is structural rather than a nudge: the head had NO IDENTITY BLOCK. The
 * house's name was one line of `LabelLarge` with the customer's name jammed directly under it, on a
 * two-cell masthead, with no reserved height, no clearspace and nowhere for the round to stand. A
 * logo dropped into that would have been an asset floating in body copy. So the fit rules are built
 * as GEOMETRY, in the sheet's own millimetres, and every one of them is measurable:
 *
 *   1 · THE PAPER IS THE HOUSE'S, SO THE LOGO IS THE HOUSE'S. RocotoMark never appears on a
 *       customer-facing document. Our mark lives in the app's chrome and nowhere on this page.
 *   2 · A RESERVED BAND, NOT A BOX. 12mm on A4 — 45px at 96dpi — with clearspace of HALF that
 *       height on all four sides. The band holds its height whether or not anything fills it, so
 *       the day a house uploads an asset the page does not move.
 *   3 · TWO ASPECT CLASSES, ONE DECISION. Bounding ratio > 2.5:1 → WORDMARK: fitted by WIDTH and
 *       capped at one third of the text measure. Otherwise → MARK: fitted by HEIGHT to the band.
 *       A house's NAME is a wordmark by aspect, so the name that ships today takes the wordmark
 *       rule and the step is read off its own length rather than tuned by hand.
 *   4 · OPTICAL LEFT, NOT BOX LEFT. The inked left edge sits on the document's TEXT MARGIN — the
 *       same x the first column head starts at. Type has no transparent bounding box, so a name
 *       set flush on the margin is already optically left; an uploaded asset trims to its ink.
 *   5 · NEVER RE-COLOUR, NEVER TINT BEHIND. No panel, no wash, no monogram tile under a name. A
 *       house with only a light-on-dark asset supplies a second asset, or the paper stays white
 *       and the name sets in type — which is what happens here.
 *   6 · THE HEAD IS A THREE-CELL GRID: the house's identity · the document's identity · the round.
 *       All three papers keep it, so a person who has learnt one head has learnt all three.
 *   7 · ON SCREEN the identity appears inside the paper preview only, never in the modal's own
 *       chrome, where it would compete with the app's.
 *
 * AND THE ARITHMETIC STAYS TRUE. `el papel` paginates against `GEOMETRY.mastheadHeight` (132px), so
 * the head is built to fit inside it: 23 + 64 + 23 = 110, plus the masthead's own 20px of padding
 * and margin. A head that outgrew its budget would push the last rows of page one under the folio.
 */
/** THE BAY'S OWN MARK (THE-EXPORT-CANON §7.2). The canon names it: `packing`, Lucide ClipboardCheck
 *  — a picking list is literally a clipboard, and `ops`/ListChecks is taken by Operaciones. The
 *  vocabulary is another seat's file, so this READS the mark rather than minting it: the day
 *  `packing` lands in `glyphs.tsx` every surface wears it, and until then the bay's paper stands on
 *  the crate it fills — which already does §54.4's job, because it is not the printer. It lives here
 *  rather than in `printing.tsx` because that file imports this one, and a mark two files share may
 *  only live in the one they both already depend on. */
export const PACKING_MARK: GlyphId = hasGlyph('packing') ? ('packing' as GlyphId) : 'crate';

/** The camera reads this mark before OCR. It resolves the exact packing document and revision,
 * which lets sparse handwriting be interpreted against the printed rows. The payload is an
 * opaque locator; the visible page remains the source a person can audit. */
function PackingCaptureMark({ sales, paper, drawing }: { sales: Sale[]; paper: PaperFormat; drawing?: string }) {
  const [, theme] = useStyletron();
  const locator = React.useMemo(() => packingDocumentLocator(sales), [sales]);
  const seat = React.useRef<HTMLDivElement>(null);
  /* THE HOUSE REMEMBERS WHAT IT PUT ON THE PAPER, AND WHERE (THE-QR-SPEC QR-06 · QR-07; FEED-IA
     §199.1). A mark drawn is a mark issued, so the reader resolves it exactly instead of re-folding
     candidate sets — and the same moment records the LAYOUT the print produced, measured off this
     paper's own DOM, so a photograph can be registered onto it cell by cell.

     ⚠ A LAYOUT EFFECT, DELIBERATELY. `browser-print.tsx` renders this document off-screen at life
     size and captures its HTML in ITS OWN layout effect; a child's layout effect runs first, so the
     measurement happens while the printed page is standing. A passive effect would race the capture
     and the unmount that follows it. */
  React.useLayoutEffect(() => {
    const day = sales[0]?.day ?? '';
    const manifest = measurePackingManifest(seat.current, {
      locator,
      token: packingLocatorToken(locator),
      day,
      paper: paper === 'a5' ? 'A5' : 'A4',
    });
    /* TWO COPIES, ON PURPOSE (§191.1 · QR-11). The register on this device takes the GEOMETRY —
       rectangles, sale ids, line ids — and the runtime takes the record with the paper's own words
       in it, because a handwriting reader is given «the final-weight cell of line "Merluza · 12
       kg"» as context and a shared bay laptop is not the place to write that down. */
    rememberPackingMark(locator, day, sales.map((sale) => sale.id), manifest && opaquePaperManifest(manifest));
    /* THE RUNTIME KEEPS IT WHERE IT CAN BE READ AGAINST. With no runtime in front of the kit the
       paper still prints, the mark is still issued and the layout still lands here — the journal
       says which of the two is standing, in a sentence about what IS. A sheet re-drawn differently
       — A4 this morning, A5 this afternoon — is offered again, because the runtime is owed the
       paper that is standing rather than the first one it heard about. */
    if (manifest) void sendPackingManifest(manifest);
    /* AND A TEMPLATE EDIT RE-RECORDS (THE-OUTPUTS-SPEC OUT-01.7). «Saving a template raises
       `revision` by one and re-records that template's print manifest before the next sheet leaves
       it.» Columns, sort and the fields a template turns on all move where a cell lands, and the
       same documents on the same paper would otherwise keep the geometry of the layout before the
       edit — a reader cropping at coordinates the printer no longer prints at.
       ⚠ IT WATCHES THE DRAWING, NOT THE REVISION. The revision moves when an edit is SAVED, and
       the print screen redraws this paper the moment a control is touched: a register that waited
       for the save would hold a one-column geometry under a two-column sheet for as long as the
       draft stood. `drawing` folds the revision AND the layout that drew this sheet, so every
       paper that is standing has its own record. Measured by `drive-200-print-screen.py`, which
       found exactly that gap when the dependency was the revision alone. */
  }, [locator, sales, paper, drawing]);
  return (
    <div
      ref={seat}
      data-testid="packing-document-qr"
      data-document-locator={locator}
      aria-label="Packing document capture code"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        justifySelf: 'end',
        color: theme.colors.contentPrimary,
      }}
    >
      {/* THE MARK IS DRAWN TO THE SPEC, NOT TO THREE NUMBERS TYPED HERE (FEED-IA §196.5 —
          E193.05). `PACKING_QR` in `packing-output.ts` is THE-QR-SPEC's own arithmetic: the
          version-3 symbol, its 4-module quiet zone and the 76px footprint that keeps a module at
          0.54mm on A4 and A5. */}
      <QRCodeSVG value={locator} size={PACKING_QR.pagePx} level={PACKING_QR.ecc} marginSize={PACKING_QR.quietModules} bgColor={theme.colors.backgroundPrimary} fgColor={theme.colors.contentPrimary} />
      <span style={{ ...theme.typography.ParagraphXSmall, lineHeight: '14px', maxWidth: 72 }}>
        Scan after packing
        {/* AND THE CODE STANDS UNDER IT IN WORDS. A phone with no barcode detector still has a
            person with eyes, and `qr-read.tsx`'s typed road is only a road because this is here. */}
        <span data-testid="packing-document-code" style={{ display: 'block', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          {packingLocatorToken(locator)}
        </span>
      </span>
    </div>
  );
}
/** THE SHEET'S OWN HAIRLINE. `rocoto/paper/styled-components.ts` draws the paper with a 1px
 *  border, and an absolutely positioned child is placed against the PADDING box — one pixel inside
 *  the paper's edge. The registration marks are measured from the EDGE, so the frame they hang in
 *  is pulled back over that hairline and 5mm of inset is 5mm of paper. */
const SHEET_RULE = 1;
/** THE THREE CORNER MARKS (THE-QR-SPEC QR-07 · FEED-IA §199.1).
 *
 *  Solid squares of the sheet's own ink, 6mm on a side, 5mm in from the paper's edges, at the three
 *  corners the QR does not hold. They are what lets a photograph taken at a wrong angle be
 *  RECTIFIED: the mark alone gives one corner and a scale, and one corner cannot tell a tilt from a
 *  perspective. Four points spread across the page can, and the three marks plus the mark in the
 *  masthead are that spread.
 *
 *  They are quiet by construction and they carry no information: same square, same size, same
 *  place on every page, printed in the ink the rest of the sheet is printed in. They stand in the
 *  paper's own margin — the sheet reserves 40px (10.6mm) on every edge and a mark runs from 5mm to
 *  11mm — so a mark never touches a rule, a column head or a row, and the page's text measure is
 *  exactly what it was. Their centres sit 8mm in, clear of the ~6.35mm a consumer laser printer
 *  refuses to print at all: a printer that clips its outer edge still leaves the centre the
 *  homography is taken from. */
function RegistrationMarks({ format }: { format: PaperFormat }) {
  const [, theme] = useStyletron();
  const page = PAGE_MM[format === 'a5' ? 'A5' : 'A4'];
  const perMm = SHEET[format].width / page.w;
  const size = REGISTRATION.sizeMm * perMm;
  const inset = REGISTRATION.insetMm * perMm;
  return (
    <div
      aria-hidden="true"
      data-testid="packing-registration-marks"
      style={{
        position: 'absolute', top: -SHEET_RULE, left: -SHEET_RULE,
        width: SHEET[format].width, height: SHEET[format].height, pointerEvents: 'none',
      }}
    >
      {REGISTRATION.corners.map((id) => (
        <span
          key={id}
          data-paper-mark={id}
          data-testid={`packing-registration-${id}`}
          style={{
            position: 'absolute', width: size, height: size,
            backgroundColor: theme.colors.contentPrimary,
            ...(id.startsWith('t') ? { top: inset } : { bottom: inset }),
            ...(id.endsWith('l') ? { left: inset } : { right: inset }),
          }}
        />
      ))}
    </div>
  );
}
/** THE DAY'S ROUND, WHERE THE DAY RUNS ON ONE VAN. A morning every crate of which rides truck 2 is
 *  named by truck 2; a morning split across several is named by nothing here, because a head that
 *  printed one of four vans would be a paper telling a driver the wrong thing. */
const roundOfDay = (sales: Sale[]): Round | null => {
  const rounds = sales.map(roundOf).filter((r): r is Round => r !== null);
  const first = rounds[0];
  return first && rounds.every((r) => r.truck === first.truck) ? first : null;
};
/** 12mm at 96dpi. A4 is 794px for 210mm and A5 is 559px for 148mm — the same 3.78px per mm — so one
 *  constant really is «the same optical height at every paper size». */
const BAND = 45;
/** clearspace: half the band, on all four sides */
const CLEAR = 23;
/** the tallest a wordmark's type may set inside the band, leaving the clearspace intact */
const BAND_CAP = 30;
/** the text measure a wordmark is capped at one third of: A4 minus its two 40px margins */
const THIRD = Math.round((SHEET.a4.width - 80) / 3);
/** the aspect at which an asset stops being a mark and becomes a wordmark */
export const WORDMARK_RATIO = 2.5;
/** THE WORDMARK'S OWN FIT (rule 3). Fitted by WIDTH and capped at one third of the measure, so the
 *  size falls out of the name's own length rather than out of anybody's eye — Inter's average
 *  advance is about 0.55em across mixed case, which is the one number this needs.
 *
 *  AND A LONG HOUSE NAME TAKES TWO LINES RATHER THAN AN ELLIPSIS. «Pescados y Mariscos Hermanos
 *  Colomer» cannot make 238px on one line at any size a person would call type; the first build of
 *  this fit truncated it, which is a house's own name cut short on its own letterhead. Two lines is
 *  what a real lockup does. Never three: three lines is a paragraph, not a lockup, and the band
 *  would have to grow to hold it. */
export const wordmarkFit = (name: string): { step: number; lines: 1 | 2 } => {
  const chars = Math.max(name.trim().length, 1);
  const one = Math.floor(THIRD / (chars * 0.55));
  if (one >= 15) return { step: Math.min(one, BAND_CAP), lines: 1 };
  const two = Math.floor(THIRD / (Math.ceil(chars / 2) * 0.55));
  /* two lines have to live INSIDE the band, so the step is capped by half its height */
  return { step: Math.max(11, Math.min(two, Math.floor(BAND / 2 / 1.15))), lines: 2 };
};
/** THE IDENTITY BLOCK — cell one of every head, on every paper. */
function Identity({ house }: { house: string }) {
  const [, theme] = useStyletron();
  const { step, lines } = wordmarkFit(house);
  /* THE FISCAL LINE (THE-ADMIN-CANON §3): razón social · CIF, off the company store — the fact
     every albarán and factura carries. UNDER the reserved band, never inside it, so the band's
     height keeps every paper's geometry stable. */
  const fiscal = useFiscalLine();
  return (
    <>
    <div
      data-identity-band
      data-band={BAND}
      data-step={step}
      data-lines={lines}
      style={{
        /* THE BAND IS RESERVED, so the page's geometry is the same before and after a house has an
           asset to put in it. `contain` semantics: the mark fits INSIDE this box and never sets it. */
        height: BAND,
        maxWidth: THIRD,
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <span
        data-house-name
        style={{
          fontFamily: theme.typography.font550.fontFamily,
          fontWeight: 600,
          fontSize: `${step}px`,
          lineHeight: `${Math.round(step * 1.15)}px`,
          letterSpacing: '-0.01em',
          color: theme.colors.contentPrimary,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lines,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {house}
      </span>
    </div>
    {fiscal ? (
      <span
        data-house-fiscal
        style={{
          display: 'block',
          marginTop: 2,
          fontSize: 10,
          lineHeight: '14px',
          color: theme.colors.contentSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: THIRD,
        }}
      >
        {fiscal}
      </span>
    ) : null}
    </>
  );
}
/** THE ROUND — cell three. The van and its number, which is the same pair the truck chip wears on
 *  every row in the app (§21): one round, named one way, on the screen and on the paper. */
function RoundCell({ round }: { round: { truck: number; zone: string } | null }) {
  const [, theme] = useStyletron();
  if (!round) return <span data-round-cell />;
  return (
    <span
      data-round-cell
      data-truck={round.truck}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        ...theme.typography.LabelSmall,
        whiteSpace: 'nowrap',
      }}
    >
      <Glyph id="van" size={16} /> {round.truck} · {round.zone}
    </span>
  );
}
/** THE THREE-CELL HEAD (rule 6). Identity · the document · the round — one grammar, three papers.
 *  It replaces `SheetMasthead` on this file's sheets only; the canonical component stays exactly as
 *  the scenarios draw it, because a shared primitive is not the place to put one product's lockup
 *  law. */
function PaperHead({
  house,
  mark,
  document: doc,
  who,
  day,
  round,
}: {
  house: string;
  /** which of the three papers this is, for the two that live on a bench beside each other. The
   *  customer's albarán needs none: «Albarán» is the trade's own word for it. */
  mark?: GlyphId;
  document: React.ReactNode;
  /** who it is for — the customer on an albarán, the load on the papers that stay in */
  who: React.ReactNode;
  day: React.ReactNode;
  round?: { truck: number; zone: string } | null;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-paper-head
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
        columnGap: CLEAR,
        alignItems: 'start',
        paddingTop: CLEAR,
        paddingBottom: CLEAR,
        minWidth: 0,
      }}
    >
      <Identity house={house} />
      <div data-doc-identity style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            ...theme.typography.LabelLarge,
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.sizing.scale200,
            minWidth: 0,
          }}
        >
          {mark && <Glyph id={mark} size={16} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{doc}</span>
        </span>
        <span
          style={{
            ...theme.typography.LabelSmall,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {who}
        </span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{day}</span>
      </div>
      <RoundCell round={round ?? null} />
    </div>
  );
}
/* ── THE COLUMN SETS ──────────────────────────────────────────────────────────────────────────
 * The day sheet is read walking, so it leads with the stop and the goods and carries no money at
 * line level — a picker does not price anything. The albarán is read at a door, so it carries the
 * lote and, where the house prints its prices, the money — because those are the two things a
 * buyer checks. The packing list is read with both hands full, so it carries a box, a name and an
 * amount, and stops.
 */
/* THE TIME COLUMN IS WHAT MAKES THE SORT READABLE (FEED-IA §21). «The delivery list prints SORTED
   BY REQUESTED DELIVERY TIME.» A sheet sorted on a key it does not print is a sheet whose order
   looks arbitrary to the person walking it, so the hour each stop asked for stands on the row. */
const DAY_COLUMNS: PaperColumn[] = [
  { key: 'stop', label: 'Stop', width: '42px' },
  { key: 'time', label: 'Time', width: '58px' },
  { key: 'customer', label: 'Customer', width: 'minmax(0, 1fr)' },
  { key: 'product', label: 'Product', width: 'minmax(0, 1.2fr)' },
  { key: 'amount', label: 'Amount', width: '92px', align: 'end' },
];
/** THE ALBARÁN'S COLUMNS, ANSWERED BY THE HOUSE (§37.7).
 *
 *  The money column exists where the house prints money. The lote column exists on the full sheet;
 *  on the compact one the lote joins the trazabilidad sub-line under the product name it belongs
 *  to, which is where the rest of the law already prints — so the compact sheet loses a rule and
 *  keeps every fact. Nothing else moves: same keys, same order, same alignment. */
const albaranColumns = (fields: PrintLayoutProfile['albaran'], compact: boolean, inventory: boolean): PaperColumn[] => [
  { key: 'product', label: 'Product', width: 'minmax(0, 1fr)' },
  ...(compact || !inventory ? [] : [{ key: 'lote', label: 'Lote', width: '92px' } as PaperColumn]),
  { key: 'sent', label: 'Sent', width: compact ? '84px' : '90px', align: 'end' as const },
  ...(fields.finalWeight ? [{ key: 'finalWeight', label: 'Final wt.', width: '88px', align: 'end' } as PaperColumn] : []),
  ...(fields.unitPrice ? [{ key: 'unitPrice', label: 'Unit price', width: '92px', align: 'end' } as PaperColumn] : []),
  ...(fields.lineTotal ? [{ key: 'total', label: workspaceCurrency() === 'EUR' ? '€' : 'S/', width: compact ? '84px' : '90px', align: 'end' } as PaperColumn] : []),
];
/** THE PACKING LIST'S COLUMNS (§37.7). A box to tick, the thing to pick, the amount to pick of it,
 *  and the seat the bay writes the real weight into.
 *  There is no money column and there is no branch that could add one.
 *
 *  ── THE WRITE-IN SEAT (FEED-IA §199.1 — E196.10) ──────────────────────────────────────────────
 *  «if they're printing out a document and then they handwrite on it, and then they take a
 *  half-assed photo… we need to automate it perfectly to the actual data that they handwrote.» A
 *  hand needs somewhere to write, and the reader needs to know exactly where that somewhere was.
 *  So the bay's paper carries an empty column at the albarán's own width, its head naming what
 *  belongs in it, and the manifest records its rectangle per line. The cell is EMPTY ink — the
 *  row's own hairline is the line a person writes on, and a box drawn inside the cell would be ink
 *  a vision model has to tell apart from a person's. */
const PACKING_COLUMNS: PaperColumn[] = [
  { key: 'tick', label: '', width: '26px' },
  { key: 'what', label: 'Goods', width: 'minmax(0, 1fr)' },
  { key: 'amount', label: 'Amount', width: '110px', align: 'end' },
  { key: 'finalWeight', label: 'Final wt.', width: '88px', align: 'end' },
];
/** Two independent pick lanes share the same truck run. The source rows are paired only after
 * truck grouping and sorting, so a lane can never cross a truck divider or invent an order.
 *
 * ⚠ TWO LANES CARRY NO WRITE-IN SEAT, AND THE MANIFEST SAYS SO. Two columns is a DENSITY choice —
 * twice the picking on one sheet — and a hand writing a weight needs a seat wide enough to write
 * in. Eight tracks on A5 would leave a goods lane 48px wide, which is a broken sheet rather than a
 * denser one. So a two-lane sheet keeps the six columns it has, and its manifest reports rows with
 * their printed amount and no final-weight rectangle: a reader is told there is nowhere to write
 * on this paper rather than sent to crop a place that was never there. */
const PACKING_COLUMNS_TWO: PaperColumn[] = [
  { key: 'leftTick', label: '', width: '20px' },
  { key: 'leftWhat', label: 'Goods', width: 'minmax(0, 1fr)' },
  { key: 'leftAmount', label: 'Amount', width: '72px', align: 'end' },
  { key: 'rightTick', label: '', width: '20px' },
  { key: 'rightWhat', label: 'Goods', width: 'minmax(0, 1fr)' },
  { key: 'rightAmount', label: 'Amount', width: '72px', align: 'end' },
];
/* A LINE THE MESSAGE NEVER CARRIED AN AMOUNT FOR PRINTS AS A QUESTION, NOT AS A ZERO. «0 kg ·
   0,00 €» is a confident number where there is no number — worse than a guess, because paper is
   read at arm's length on a bay and nobody goes back to check it. */
const amountOf = (l: SaleLine): string => (l.unreadable ? 'to confirm' : qtyWords(l.given, l.unit));
const totalOf = (l: SaleLine): string => (l.unreadable ? 'to confirm' : soles(l.given * l.price));
/* Amendments are part of the goods and print through the shared name. A `prepNote` is for the
   team, so internal day/packing paper may carry it but a customer albarán never uses it as an
   outward-facing fallback. Customer wording is shown only through `customerOptionText`, which
   rejects unapproved, unscoped, malformed or source-free values. */
type PrintAudience = 'customer' | 'internal';
const nameOf = (_sale: Sale, l: SaleLine, audience: PrintAudience = 'internal'): React.ReactNode => (
  <LineName
    line={l}
    paper
    prep={audience === 'internal' ? l.prepNote : undefined}
    customerOption={audience === 'customer' ? customerOptionText(l) : undefined}
  />
);
/** WHAT A DELIVERY COMES TO IN GOODS. An unvalued albarán still has to add up to something, and
 *  what it adds up to is the load: the kilos, the boxes, the pieces, each unit summed on its own
 *  and written the way the trade writes it. It is the same arithmetic the money total is, done on
 *  the other column. */
const goodsTally = (lines: SaleLine[]): string => {
  const per = new Map<string, number>();
  for (const l of lines) {
    if (l.unreadable) continue;
    per.set(l.unit, (per.get(l.unit) ?? 0) + l.given);
  }
  return [...per.entries()].map(([unit, n]) => qtyWords(n, unit)).join(' · ');
};
/** HOW MANY PAGES A SET OF ROWS REALLY IS, on the format it is really printed on. `el papel`
 *  paginates by arithmetic, so the count the preview shows and the count the queue counts down come
 *  off ONE calculation rather than off two estimates that drift the moment a sheet gets smaller. */
const pagesOf = (rows: PaperRow[], format: 'a4' | 'a5'): number =>
  paginate(rows, format, true, true).length;
/* ── THE SURFACE ──────────────────────────────────────────────────────────────────────────── */
/* ── THE PAGER — ONE ANATOMY, UNDER THE PAPER, ON EVERY PRINT SCREEN ──────────────────────────
 * THE-OUTPUTS-SPEC OUT-04.4, answering FEED-IA §202.4: «also i dont find the next previous buttons
 * in mobile». Three things were wrong and all three are answered here.
 *
 *   IT EXISTED ONLY FOR RUNS. A single albarán had no pager at all, so «where am I» had two
 *   different answers depending on what was on the stage. Every print screen carries this now,
 *   including a lone document, where it states «1 of 1» and both arrows stand down.
 *
 *   IT WAS DRAWN AS THREE GHOSTS. Two tertiary carets with no label either side of a native
 *   `<select>`: a 48px target with no shape, which is `better-layout` · *Keep controls distinct
 *   from content* failing at the exact moment a hand is looking for it. The arrows are
 *   `KIND.secondary` — they carry a border — and the middle is a real seat with the document's
 *   name on it.
 *
 *   IT SAT ABOVE THE PAPER. The first thing a person scrolled past. It sits BELOW the sheet now,
 *   in the surface's own sticky foot, immediately above the act: `better-layout` · *Order by
 *   importance* — a person paging documents is looking at the document, so the control belongs
 *   where their eyes already are, and *Never park a critical action where scrolling clips it*.
 *
 * THE SELECT STAYS, BEHIND THE NAME. A list of twelve documents is a list, and a native select is
 * the right object for it (`better-accessibility` · *Native elements first*) — so it keeps its
 * seat and its testid and moves behind the middle as the press that opens it. The seat draws the
 * focus ring for it, because an invisible control still has to say where the keyboard is.
 */
export function DocumentPager({
  testid = 'print-run', index, total, label, options, compact, onIndex, trailing,
}: {
  testid?: string;
  index: number;
  total: number;
  /** the document standing, in the paper's own words */
  label: string;
  options: string[];
  /** the phone's one-line shape: the name, then its place on the trailing edge */
  compact: boolean;
  onIndex: (next: number) => void;
  trailing?: React.ReactNode;
}) {
  const [css, theme] = useStyletron();
  const arrow = {
    BaseButton: {
      style: {
        width: '48px', height: '48px', minWidth: '48px', minHeight: '48px',
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, flexShrink: 0,
      },
    },
  };
  return (
    <div
      data-testid={`${testid}-pager`}
      data-place={`${index + 1}/${total}`}
      /* THE THREE PIECES STAY TOGETHER. On a 1160px foot a `flex: 1` middle threw the two arrows
         to opposite edges of the card, which is a pager a hand has to travel to. It is capped and
         centred, so «‹ name ›» reads as one control at every width. */
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0,
        width: '100%', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto',
      }}
    >
      <Button
        kind={KIND.secondary} size={SIZE.compact} data-testid={`${testid}-prev`} aria-label="Previous document"
        disabled={index <= 0} onClick={() => onIndex(index - 1)} overrides={arrow}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={20} /></span>
      </Button>
      <div
        className={css({
          position: 'relative', flex: '1 1 auto', minWidth: 0, minHeight: '48px',
          display: 'flex', flexDirection: compact ? 'row' : 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: compact ? theme.sizing.scale300 : 0,
          paddingLeft: theme.sizing.scale300, paddingRight: theme.sizing.scale300,
          borderRadius: theme.borders.radius200,
          ':focus-within': { outline: `2px solid ${theme.colors.borderSelected}`, outlineOffset: '2px' },
        })}
      >
        <span
          data-testid={`${testid}-name`} title={label}
          style={{
            ...theme.typography.LabelSmall, minWidth: 0, maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: compact ? '1 1 auto' : '0 0 auto', textAlign: compact ? 'start' : 'center',
          }}
        >
          {label}
        </span>
        {/* THE COUNT KEEPS ITS BOX AS IT CLIMBS (`better-typography` · *Tabular numbers on
            changing values*): «9 of 12» and «10 of 12» are the same width, so the name beside it
            stops shifting a pixel every press. */}
        <span
          data-testid={`${testid}-place`}
          style={{
            ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary,
            fontVariantNumeric: 'tabular-nums', flex: '0 0 auto', whiteSpace: 'nowrap',
          }}
        >
          {/* THE PAGER NAMES WHAT IT COUNTS (FEED-IA §246, lead decision 10). «2 of 8» beside
              «105 deliveries», «113 documents · 8 truck dividers» and a document labelled «Truck 3
              · 3 packing lists» was a bare ratio in a screen holding four counts, and the reader
              had to work out which one it belonged to. The phone keeps the compact ratio, because
              the noun stands in the scope line two rows above it and the foot has one line. */}
          {compact ? `${index + 1}/${total}` : `${index + 1} of ${total} ${plural(total, 'document')}`}
        </span>
        <select
          aria-label="Document to preview" data-testid={`${testid}-document`} value={index}
          onChange={(event) => onIndex(Number(event.target.value))}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', appearance: 'none', border: 'none', background: 'transparent',
          }}
        >
          {options.map((option, at) => <option key={at} value={at}>{option}</option>)}
        </select>
      </div>
      <Button
        kind={KIND.secondary} size={SIZE.compact} data-testid={`${testid}-next`} aria-label="Next document"
        disabled={index >= total - 1} onClick={() => onIndex(index + 1)} overrides={arrow}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={20} /></span>
      </Button>
      {trailing}
    </div>
  );
}

/** HOW FAR A HAND HAS TO MOVE BEFORE IT MEANT IT. 48px is the pager arrow's own width: a swipe
 *  stands in for that control, so the gesture and the button it replaces are the same size. Below
 *  it a horizontal drift while reading a sheet is reading, not paging. The gesture is a POINTER
 *  path rather than motion — nothing slides, so there is nothing for reduced motion to suppress —
 *  and the arrows and the arrow keys do the same job for every other hand. */
export const SWIPE_FLOOR = 48;
export function usePaperSwipe(onPage: (delta: 1 | -1) => void, enabled = true) {
  const from = React.useRef<{ x: number; y: number } | null>(null);
  if (!enabled) return {};
  return {
    onPointerDown: (event: React.PointerEvent) => { from.current = { x: event.clientX, y: event.clientY }; },
    onPointerUp: (event: React.PointerEvent) => {
      const start = from.current;
      from.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_FLOOR || Math.abs(dx) <= Math.abs(dy)) return;
      onPage(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => { from.current = null; },
  };
}

/** THE DOCUMENTS A RUN PUTS ON PAPER, built once and read by both surfaces that page them — this
 *  file's own run preview and the print screen (`print-screen.tsx`). A truck divider is a document
 *  like any other, which is why the pager starts on the first thing that is not one. */
export function runOrdersOf({ kind, day, sales, now, email, layoutProfile, paper }: {
  kind: PrintRunKind; day: string; sales: Sale[]; now: string;
  email: { connected: boolean; address: string };
  layoutProfile: PrintLayoutProfile;
  paper?: 'A4' | 'A5';
}): { own: Sale[]; orders: PrintOrder[] } {
  const own = sales.filter((sale) => sale.day === day && (canPrepare(sale) || sale.state === 'sent'));
  const orders = kind === 'albaranes'
    ? albaranRun(own, now, email, paper)
    : packingRun(day, own, now, paper, undefined, layoutProfile);
  return { own, orders };
}

/** What the pager calls a document, in the paper's own words. */
export const documentWords = (order: PrintOrder): string =>
  order.subject.kind === 'day' && order.subject.divider
    ? `${truckRunWords({ truck: order.subject.truck ?? null })} · contents`
    : order.what.replace(/^Albarán /, '');

export type PrintViewProps = {
  cast: Cast;
  derived: Derived;
  subject: PaperSubject;
  /** the whole river, so a day sheet, an albarán and the bay's lists are read off one ledger */
  sales: Sale[];
  onClose: () => void;
  /** ⚠ NO LONGER READ (V31 · §111.7). It drew «Open stop 1» beside the press — a second act on a
   *  surface whose whole job is one act, and the first thing Peter's «too much chrome» names. The
   *  slot stands only so the one caller that still passes it (`areas/sales.tsx`) keeps compiling;
   *  it goes the session that file is open. */
  onOpenSale?: (id: string) => void;
  /** HOW MUCH OF ITS OWN CHROME THIS MOUNT WANTS (§37.7, §33).
   *
   *  Three surfaces now show this paper and they frame it differently, so the view stops assuming
   *  it is always the whole panel. The rule is that a title is said ONCE:
   *
   *    'panel'   the head, the document's name, and the act — the albarán panel's own mount.
   *    'framed'  the surface already carries the title and the way back (the export centre's
   *              modal), so the head and the heading step aside and the standfirst and the act
   *              stay: the sentence about the sheet and the press are what the person came for.
   *    'sheet'   the document alone, for Settings' live preview — a settings card is not a place
   *              to send paper from, and the card is already the heading. It is the same component
   *              drawing the same sheet: a mock of the paper in Settings would be a picture that
   *              could quietly stop being true. */
  chrome?: Chrome;
  /** Captured paper layout for an immutable browser-print attempt. */
  paper?: PaperFormat;
  /** Branding and email policy frozen with an immutable print attempt. */
  sourceConfig?: AppConfig;
  /** Optional paper fields and packing order frozen with an immutable print attempt. */
  layoutProfile?: PrintLayoutProfile;
  /** ── THE TEMPLATE THIS PAPER IS PRINTED UNDER (THE-OUTPUTS-SPEC OUT-01.7) ──────────────────
   *  A print attempt names the template AND its revision, so a photograph read back six weeks
   *  later is registered against the geometry that was on the paper rather than against today's.
   *  The revision also reaches the packing mark, which re-records its manifest when it moves. */
  template?: { id: string; revision: number };
  /** the template's own copies, where a template is standing; the house default otherwise */
  copies?: number;
  /** WHERE A PAPER CHANGE GOES. With a template standing, the pills write the TEMPLATE (the print
   *  screen's Edit mode is the other door on the same setting); with none, they keep today's
   *  behaviour and move this house's default. */
  onPaperChange?: (paper: PaperFormat) => void;
  /** the room the stage has, where the surface holding it knows better than the default */
  stageWidth?: number;
  height?: number;
};
export default function PrintView({
  cast, derived, subject, sales, onClose, chrome = 'panel', stageWidth, height, paper: snapshotPaper, sourceConfig, layoutProfile: suppliedLayout,
  template, copies, onPaperChange,
}: PrintViewProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { config: liveConfig } = useConfig();
  const config = sourceConfig ?? liveConfig;
  const layoutProfile = suppliedLayout ?? PRINT_LAYOUT_DEFAULTS;
  const edits = useDay(cast.sector);
  const now = nowOf(cast);
  /* WHAT THE PRINTER IS DOING WITH THIS VERY SHEET. The surface reads the queue rather than
     remembering its own press, so closing the panel and coming back says the same thing. */
  const queued = jobFor(useQueue(cast.sector), subject);
  const base = stageWidth ?? (phone ? 344 : 520);
  const tall = height ?? (phone ? 440 : 660);
  const printSetup = usePrintSetup();
  const printAttempts = React.useRef(new Map<string, string>());
  const requestPaper = async (logicalKey: string, title: string, source: Sale[], makeOrders: (sales: Sale[]) => PrintOrder[]) => {
    const idempotencyKey = printAttempts.current.get(logicalKey) ?? newPrintAttemptKey(logicalKey);
    printAttempts.current.set(logicalKey, idempotencyKey);
    const result = await printSourceRun({ idempotencyKey, title, cast, derived, sales: source, makeOrders, copies: copies ?? printSetup.copies, layoutProfile, template });
    if (result.status === 'dialog-requested') printAttempts.current.delete(logicalKey);
  };
  const preferredPaper: PaperFormat = snapshotPaper ?? (printSetup.paper === 'A5' ? 'a5' : 'a4');
  const [paper, setPaper] = React.useState<PaperFormat>(preferredPaper);
  React.useEffect(() => { setPaper(snapshotPaper ?? preferredPaper); }, [snapshotPaper, preferredPaper, subject.kind, subject.kind === 'albaran' ? subject.sale : '']);
  const choosePaper = (next: PaperFormat) => {
    /* THE PAPER BELONGS TO THE TEMPLATE (OUT-01.3). Where one is standing the pills write IT and
       the sheet redraws from the draft; where none is, they keep the house's own answer, which is
       what every surface without a template still reads. */
    if (onPaperChange) { onPaperChange(next); return; }
    if (snapshotPaper) return;
    setPaper(next);
    setPrintSetup({ paper: next === 'a5' ? 'A5' : 'A4' });
  };
  /* A HALF SHEET IS SHOWN AS A HALF SHEET (§37.7). `PaperStage` scales whatever sheet it is given
     to fill the width it is given, so an A5 albarán drawn on an A4-sized stage comes out the same
     size as the full one — a preview whose whole subject is the format, quietly hiding the format.
     So the stage takes the paper's own proportion of the column and the compact sheet reads as the
     smaller object it is. The sheet itself is untouched: this is the stage, not the paper. */
  const width = chrome === 'print' ? SHEET[paper].width : Math.round(base * (SHEET[paper].width / SHEET.a4.width));
  const scopedSales = subject.kind !== 'albaran' && subject.salesIds
    ? subject.salesIds.flatMap((id) => sales.find((sale) => sale.id === id) ?? [])
    : sales;
  const runKind = subject.kind === 'day' ? subject.run
    : subject.kind === 'packing' && subject.truck === undefined ? 'packing' : undefined;
  const sheet = runKind && subject.kind !== 'albaran' ? (
    <PrintRunPreview
      cast={cast} derived={derived} kind={runKind} day={subject.day} sales={scopedSales}
      stageWidth={base} height={tall} chrome={chrome} onClose={onClose} layoutProfile={layoutProfile}
      onRequestPrint={requestPaper}
    />
  ) : subject.kind === 'day' && subject.divider ? (
    <TruckDivider
      house={config.brand.name} day={subject.day} kind={subject.divider}
      run={{ day: subject.day, truck: subject.truck ?? null,
        zone: [...new Set(scopedSales.map((sale) => sale.customer.zone).filter(Boolean))].join(' · '),
        sales: scopedSales.filter((sale) => sale.day === subject.day) }}
      stageWidth={width} height={tall} paper={paper}
      printMode={chrome === 'print'}
    />
  ) : subject.kind === 'albaran' ? (
      <Albaran
        cast={cast}
        derived={derived}
        house={config.brand.name}
        email={config.emailFeed}
        sale={sales.find((s) => s.id === subject.sale)}
        now={now}
        queued={queued}
        stageWidth={width}
        height={tall}
        chrome={chrome}
        paper={paper}
        /* print uses unscaled, complete physical paper; preview stays unchanged. */
                onPaper={choosePaper}
        onRequestPrint={requestPaper}
        layoutProfile={layoutProfile}
      />
    ) : subject.kind === 'packing' ? (
      <PackingSheet
        cast={cast}
        house={config.brand.name}
        day={subject.day}
        sales={scopedSales}
        now={now}
        queued={queued}
        stageWidth={width}
        height={tall}
        chrome={chrome}
        paper={paper}
        /* print uses unscaled, complete physical paper; preview stays unchanged. */
                onPaper={choosePaper}
        onRequestPrint={requestPaper}
        layoutProfile={layoutProfile}
        revision={template?.revision}
      />
    ) : (
      <DaySheet
        cast={cast}
        house={config.brand.name}
        day={subject.day}
        sales={scopedSales}
        prints={dayPrints(edits.events, subject.day).length}
        now={now}
        queued={queued}
        stageWidth={width}
        height={tall}
        chrome={chrome}
        paper={paper}
        /* print uses unscaled, complete physical paper; preview stays unchanged. */
                onPaper={choosePaper}
        onRequestPrint={requestPaper}
      />
    );
  return (
    <div
      data-testid="print-view"
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || chrome === 'sheet') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      data-print={subject.kind}
      data-truck={subject.kind === 'albaran' ? undefined : subject.truck ?? 'assign'}
      data-run={runKind}
      data-divider={subject.kind === 'day' ? subject.divider : undefined}
      /* THE PAPER'S OWN TWO ANSWERS, ON THE DOCUMENT THAT OBEYS THEM (§37.7) — so a person, a
         screenshot and a drive all read the same fact off the same node. */
      data-values={derived.albaran.values}
      data-shape={derived.albaran.shape}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      {chrome === 'panel' && (
        <PanelHead
          title={
            runKind === 'albaranes' ? 'Delivery Notes'
              : subject.kind === 'day' && subject.divider ? 'Truck contents'
              : subject.kind === 'day' ? 'The day’s sheet'
              : subject.kind === 'packing' ? 'The packing lists'
                : 'The delivery note'
          }
          onClose={onClose}
          closeLabel="Close the paper"
        />
      )}
      <div
        style={{
          padding: chrome === 'sheet' || chrome === 'print' ? 0 : phone ? theme.sizing.scale500 : theme.sizing.scale600,
          minWidth: 0,
        }}
      >
        {sheet}
      </div>
    </div>
  );
}
/* §138.9 / §142: the preview walks the same orders the batch button puts awaiting print confirmation.
 * A contents sheet is a real sheet of tickboxes, not a label hiding a mixed-truck document. */
function PrintRunPreview({
  cast, derived, kind, day, sales, stageWidth, height, chrome, onClose, layoutProfile,
  onRequestPrint = () => undefined,
}: {
  cast: Cast; derived: Derived; kind: PrintRunKind; day: string; sales: Sale[];
  stageWidth: number; height: number; chrome: Chrome; onClose: () => void; layoutProfile: PrintLayoutProfile;
  onRequestPrint?: (logicalKey: string, title: string, source: Sale[], makeOrders: (sales: Sale[]) => PrintOrder[]) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { config } = useConfig();
  const workspaceCapabilities = useWorkspaceCapabilities();
  const pricingEnabled = capabilityAvailable('albaranValues') && workspaceCapabilities.pricing;
  const inventoryEnabled = capabilityAvailable('inventory') && workspaceCapabilities.inventory;
  const jobs = useQueue(cast.sector);
  const now = nowOf(cast);
  const printSetup = usePrintSetup();
  const { own, orders } = runOrdersOf({ kind, day, sales, now, email: config.emailFeed, layoutProfile });
  const firstDocument = Math.max(0, orders.findIndex((order) => !(order.subject.kind === 'day' && order.subject.divider)));
  const [cursor, setCursor] = React.useState(firstDocument);
  const identity = `${day}:${kind}:${own.map((sale) => sale.id).join('|')}`;
  React.useEffect(() => setCursor(firstDocument), [identity]);
  const index = Math.min(cursor, Math.max(0, orders.length - 1));
  const selected = orders[index];
  const left = orders.reduce((count, order) => {
    const job = jobFor(jobs, order.subject);
    return count + (job && job.state !== 'printed' ? job.left : 0);
  }, 0);
  const trucks = truckRuns(own).length;
  const step = (delta: 1 | -1) => setCursor((at) => Math.min(Math.max(at + delta, 0), orders.length - 1));
  const swipe = usePaperSwipe((delta) => step(delta), phone);
  if (!selected) return (
    <p data-testid="print-run-empty" style={{ margin: 0, ...theme.typography.ParagraphSmall }}>
      Delivery Notes ready to print appear here.
    </p>
  );
  return (
    <div data-testid="print-run" data-kind={kind} data-trucks={trucks} data-orders={own.length}
      /* `better-accessibility` · *Every pointer interaction needs a keyboard path*: the swipe and
         the two arrows have ← and → beside them, live while focus stands anywhere in the run. */
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (event.target instanceof HTMLSelectElement) return;
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <span data-testid="print-run-explanation" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{kind === 'albaranes'
        ? pricingEnabled && derived.albaran.valued
          ? 'Customer delivery notes · quantities, prices and totals'
          : inventoryEnabled
            ? 'Customer delivery notes · quantities and traceability'
            : 'Customer delivery notes · quantities'
        : inventoryEnabled
          ? 'Packing lists · quantities, lots and checkboxes'
          : 'Packing lists · quantities and checkboxes'} · Truck dividers print first.</span>
      {/* THE PAPER FIRST (OUT-04.4). The pager used to stand here, above the sheet, and left the
          screen the moment a person scrolled the document they came to read. */}
      <div {...swipe} style={{ minWidth: 0, touchAction: 'pan-y' }}>
        <PrintView
          cast={cast} derived={derived} layoutProfile={layoutProfile} subject={selected.subject} sales={own} chrome="sheet"
          stageWidth={stageWidth} height={height} onClose={() => undefined}
        />
      </div>
      <DocumentPager
        index={index}
        total={orders.length}
        label={documentWords(selected)}
        options={orders.map(documentWords)}
        compact={phone}
        onIndex={setCursor}
        trailing={chrome !== 'sheet' && chrome !== 'print' ? (
          <Button kind={KIND.tertiary} size={SIZE.mini}
            data-testid="print-run-close" aria-label="Close print preview" onClick={onClose}>
            Close
          </Button>
        ) : undefined}
      />
      {chrome !== 'sheet' && chrome !== 'print' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
          <Button kind={KIND.primary} size={SIZE.compact} data-testid={kind === 'packing' ? 'print-packing' : 'print-run-albaranes'}
            onClick={() => onRequestPrint(`run:${kind}:${day}:${own.map((sale) => sale.id).join("|")}`, kind === "packing" ? "Packing sheets" : "Delivery notes", own, () => orders)}>
            Print {own.length} {kind === 'packing' ? (own.length === 1 ? 'packing list' : 'packing lists') : (own.length === 1 ? 'delivery note' : 'delivery notes')}
          </Button>
          <span data-testid={`${kind === 'packing' ? 'print-packing' : 'print-run-albaranes'}-paper`} data-paper={printSetup.paper}
            style={{ display: 'inline-flex', gap: theme.sizing.scale200 }}>
            {(['A4', 'A5'] as const).map((paper) => <Button key={paper} kind={printSetup.paper === paper ? KIND.secondary : KIND.tertiary}
              size={SIZE.mini} aria-pressed={printSetup.paper === paper} data-testid={`${kind === 'packing' ? 'print-packing' : 'print-run-albaranes'}-paper-${paper.toLowerCase()}`}
              onClick={() => setPrintSetup({ paper })}>{paper}</Button>)}
          </span>
          <span data-testid="print-run-state" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
            {left > 0 ? `${left} ${plural(left, 'page')} awaiting print confirmation` : `${trucks} ${plural(trucks, 'truck')} · ${trucks} ${plural(trucks, 'divider')}`}
          </span>
        </div>
      )}
    </div>
  );
}
const DIVIDER_COLUMNS: PaperColumn[] = [
  { key: 'tick', label: '', width: '28px' },
  { key: 'number', label: 'Delivery Note', width: '110px' },
  { key: 'customer', label: 'Customer', width: 'minmax(0, 1fr)' },
  { key: 'time', label: 'Time', width: '66px' },
  { key: 'lines', label: 'Lines', width: '52px', align: 'end' },
];
function TruckDivider({ house, day, kind, run, stageWidth, height, paper, printMode }: {
  house: string; day: string; kind: PrintRunKind; run?: TruckRun; stageWidth: number; height: number; paper: PaperFormat; printMode?: boolean;
}) {
  const [, theme] = useStyletron();
  if (!run) return null;
  const words = truckRunWords(run);
  const rows: PaperRow[] = run.sales.map((sale) => ({
    id: sale.id,
    cells: {
      tick: <span data-testid="truck-divider-tick" data-sale={sale.id} aria-hidden="true"
        style={{ display: 'inline-block', width: 14, height: 14, border: `1px solid ${theme.colors.contentPrimary}`,
          borderRadius: theme.borders.radius100 }} />,
      number: <span data-testid="truck-divider-sale" data-sale={sale.id}>{sale.number}</span>,
      customer: <Name of={sale.customer} />,
      time: slotOf(sale),
      lines: String(sale.lines.length),
    },
  }));
  return (
    <div data-testid="truck-divider" data-truck={run.truck ?? 'assign'} data-kind={kind} data-orders={run.sales.length}>
      <PrintSheet heading={null} columns={DIVIDER_COLUMNS} rows={rows} format={paper}
        stageWidth={stageWidth} height={height}
        printMode={printMode}
        masthead={<PaperHead house={house} mark="van" document={`${words} · contents`}
          who={printRunWords(kind, run.sales.length)}
          day={dayLabelFromId(day)} round={run.truck === null ? null : { truck: run.truck, zone: run.zone }} />}
        runningHead={<><span>{words} · contents</span><span>{dayLabelFromId(day)}</span></>}
        foot={<SheetFoot totals={printRunWords(kind, run.sales.length)} />}
      />
    </div>
  );
}
/* ── THE WALK ─────────────────────────────────────────────────────────────────────────────────
 * The order a morning is delivered in, which is the order both of the day's papers are read in.
 * The day sheet and the packing lists are two products of one round, so they walk it the same way
 * — two sheets about one morning that disagreed about the order would be two mornings.
 *
 * ═══ SORTING LIVES ON PAPER (FEED-IA §21) ════════════════════════════════════════════════════
 * «Processing beats chronology. Most deliveries are for the MORNING OF — effectively one time…
 * The PRINTED OUTPUTS are where slots matter: the delivery list prints SORTED BY REQUESTED
 * DELIVERY TIME. Sorting lives on paper, not in the working list.»
 *
 * THE ROUND IS THE TIE-BREAK, not the sort. A customer with no stop on today's round still prints
 * — at the end of their own hour — because a sheet that silently drops a crate is the one failure
 * a picking list may never have.
 */
function useWalk(cast: Cast, sales: Sale[], day: string): Sale[] {
  return React.useMemo(() => {
    const stops = buildRound(cast).map((stop) => stop.id);
    const order = (s: Sale) => {
      const at = stops.indexOf(s.customer.id);
      return at < 0 ? stops.length : at;
    };
    const day1 = salesOfDay(sales, day).filter((s) => canPrepare(s) || s.state === 'sent');
    return [...day1].sort(
      (a, b) => slotOf(a).localeCompare(slotOf(b)) || order(a) - order(b) || a.at.localeCompare(b.at),
    );
  }, [cast, sales, day]);
}
/* ── THE DAY SHEET — the round's manifest ─────────────────────────────────────────────────────
 * «The day's albaranes as the round's manifest.» So the rows are ordered the way the day is
 * delivered, not the way the messages arrived: every customer's lines sit under their stop, and a
 * picker walks the sheet top to bottom once.
 *
 * The working list in Sales is untouched by any of this, deliberately.
 */
function DaySheet({
  cast,
  house,
  day,
  sales,
  prints,
  now,
  queued,
  stageWidth,
  height,
  chrome,
  paper,
  onPaper,
  onRequestPrint = () => undefined,
}: {
  cast: Cast;
  /** the house's own name — cell one of every head, on every paper (§7.3.6) */
  house: string;
  day: string;
  sales: Sale[];
  prints: number;
  now: string;
  queued?: PrintJob;
  stageWidth: number;
  height: number;
  chrome: Chrome;
  paper: PaperFormat;
  onPaper: (p: PaperFormat) => void;
  onRequestPrint?: (logicalKey: string, title: string, source: Sale[], makeOrders: (sales: Sale[]) => PrintOrder[]) => void;
}) {
  const [, theme] = useStyletron();
  const { pricing } = useWorkspaceCapabilities();
  const valued = capabilityAvailable('albaranValues') && pricing;
  const walked = useWalk(cast, sales, day);
  /* THE PRODUCT CELL IS THE GOODS, and the lote does not ride this sheet at all. `el papel`
     hangs a row's sub-line under its FIRST column, which here is a 46px stop number — so a
     trazabilidad block would print as a column of broken words. It also does not belong: the lote
     is the law's, and the law's document is the albarán the crate travels with. A picking sheet
     needs the goods and the amount, and stops there.
     ⚠ THE CLASS RODE THIS CELL UNTIL FEED-IA §197.2 «Remove class everywhere» (§193.4): the SKU
     in the name carries any named grade the market sells by, so the cell is the name alone. */
  const rows: PaperRow[] = walked.flatMap((s, stop) =>
    s.lines.map((l, i) => ({
      id: `${s.id}-${l.id}`,
      cells: {
        stop: i === 0 ? String(stop + 1) : '',
        time: i === 0 ? slotOf(s) : '',
        customer: i === 0 ? <Name of={s.customer} /> : '',
        /* ⚠ THE NAME ALONE (FEED-IA §197.2). */
        product: nameOf(s, l),
        amount: amountOf(l),
      },
    })),
  );
  const lines = walked.reduce((n, s) => n + s.lines.length, 0);
  const total = walked.reduce((n, s) => n + s.figure, 0);
  return (
    <PrintSheet
      /* THE DOCUMENT, AND NOTHING ABOVE IT (V31 · §111.7). The panel's own head, the preview's head
         and the settings card each already say what this is; a heading here was the fourth title
         on one screen, and the standfirst under it narrated the sheet 200px below. */
      heading={null}
      columns={DAY_COLUMNS}
      rows={rows}
      format={paper}
      stageWidth={stageWidth}
      height={height}
      printMode={chrome === 'print'}
      masthead={
        /* THE ROUND'S OWN MANIFEST, wearing the round's own mark (§7.2). It rides with the van, so
           the van is what the head says it is — the same mark the day's press wears in the export
           centre and the same one every truck chip in the app wears. */
        <PaperHead
          house={house}
          mark="van"
          document="The day’s sheet"
          who={`${walked.length} ${plural(walked.length, 'stop')} · ${lines} ${plural(lines, 'line')}`}
          day={dayLabelFromId(day)}
          round={roundOfDay(walked)}
        />
      }
      runningHead={
        <>
          <span>The day’s sheet</span>
          <span>{dayLabelFromId(day)}</span>
        </>
      }
      foot={
        <SheetFoot
          totals={
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale300 }}>
              {lines} {plural(lines, 'line')}
              {valued && <> · <Figure value={total} unit="S/" size="compact" /></>}
            </span>
          }
        />
      }
      action={
        chrome === 'sheet' || chrome === 'print' ? undefined : (
          <PrintAct
            testid="print-day"
            verb={prints > 0 ? 'Print the sheet again' : 'Print the sheet'}
            done={prints > 0 ? `${prints} ${plural(prints, 'copy', 'copies')} went to the bench` : null}
            queued={queued}
            paper={paper}
            onPaper={onPaper}
            onPrint={() => onRequestPrint(`day:${day}`, "The day’s sheet", walked, (source) => [daySheetOrder(day, source, now)])}
          />
        )
      }
    />
  );
}
/* ── THE ALBARÁN — the document that travels with the goods ───────────────────────────────────
 * The trazabilidad block is the family's OWN field set (SECTORS §3, C-2): fish carries eight facts
 * and meat six, on a sub-line under the product name, so the column heads never move and only the
 * page count does. That is the law printed rather than described — the buyer legally needs the lot
 * data, and this sheet is what carries it to them.
 *
 * ═══ AND WHAT ELSE IT CARRIES IS THE HOUSE'S ANSWER (§37.7) ═════════════════════════════════
 * Valued or unvalued, full or compact — four sheets off one builder. The law does not move under
 * any of them: every structure prints the family's whole field set, and the compact one prints the
 * lote inside that block rather than beside it.
 */
function Albaran({
  cast,
  derived,
  house,
  email,
  sale,
  now,
  queued,
  stageWidth,
  height,
  chrome,
  paper,
  onPaper,
  onRequestPrint = () => undefined,
  layoutProfile,
}: {
  cast: Cast;
  derived: Derived;
  /** the house's own name, off the brand basics — a sheet that leaves the building carries it */
  house: string;
  /** whether the house has connected its email, which is what lets the printed albarán also be
   *  offered to the customer as a send (FEED-IA §20) */
  email: { connected: boolean; address: string };
  sale: Sale | undefined;
  now: string;
  queued?: PrintJob;
  stageWidth: number;
  height: number;
  chrome: Chrome;
  paper: PaperFormat;
  onPaper: (p: PaperFormat) => void;
  onRequestPrint?: (logicalKey: string, title: string, source: Sale[], makeOrders: (sales: Sale[]) => PrintOrder[]) => void;
  layoutProfile: PrintLayoutProfile;
}) {
  const [, theme] = useStyletron();
  const workspaceCapabilities = useWorkspaceCapabilities();
  if (!sale) return null;
  /* THE PAPER DECIDES THE SHAPE, AND THE SELECTOR DECIDES THE PAPER (V31 · §37.7). A5 IS the
     compact sheet — one column fewer, the lote folded into the trazabilidad sub-line — so the two
     were always one answer, and `derived.albaran.shape` is what the selector starts from. What the
     house prints in MONEY is a separate answer and stays the house's (`values`). */
  const valued = workspaceCapabilities.pricing && derived.albaran.valued;
  const inventoryEnabled = capabilityAvailable('inventory') && workspaceCapabilities.inventory;
  const compact = paper === 'a5';
  const format = paper;
  /* THE FAMILY'S OWN FIELD SET, filled from the product — and the lote overridden by the batch
     this line actually drew on, because the lote is a property of the batch and never of the
     product (E3). A line the house has not attached a batch to yet says so on the paper. */
  const traceOf = (l: SaleLine) =>
    familyOf(cast, l.product).recordFields
      .filter((label) => inventoryEnabled || label !== 'lote')
      .map((label) => ({
        label,
        value: label === 'lote' ? l.lot ?? 'to attach' : l.product.trace[label] ?? '',
      }));
  /* THE COMPACT SHEET KEEPS THE LOTE BY MOVING IT (§37.7). Its column is gone, so the fact leads
     the sub-line — and a house whose albarán points at the supplier document instead (`lots.mode
     = reference`) still gets the lote said here, because dropping a column may never drop the one
     fact the law is about. */
  const subOf = (l: SaleLine) => {
    const trace = inventoryEnabled && derived.lots.onAlbaran
      ? traceOf(l)
      : [{ label: 'origen', value: l.product.trace.origen ?? '' }];
    if (!compact || !inventoryEnabled) return trace;
    return trace.some((f) => f.label === 'lote')
      ? trace
      : [{ label: 'lote', value: l.lot ?? 'to attach' }, ...trace];
  };
  const fields = { ...layoutProfile.albaran, unitPrice: layoutProfile.albaran.unitPrice && valued, lineTotal: layoutProfile.albaran.lineTotal && valued };
  const rows: PaperRow[] = sale.lines.map((l) => ({
    id: l.id,
    cells: {
      product: nameOf(sale, l, 'customer'),
      ...(compact || !inventoryEnabled ? {} : { lote: l.lot ?? '' }),
      sent: amountOf(l),
      ...(fields.finalWeight ? { finalWeight: l.finalWeight === undefined ? '—' : `${l.finalWeight} ${l.unit}` } : {}),
      ...(fields.unitPrice ? { unitPrice: solesRate(l.price, l.unit) } : {}),
      ...(fields.lineTotal ? { total: totalOf(l) } : {}),
    },
    sub: subOf(l),
  }));
  const printed = sale.printed?.count ?? 0;
  const lines = sale.lines.length;
  return (
    <PrintSheet
      /* THE SHEET NEVER REPEATS ITS OWN TITLE (§37.7, §33 · V31). Whichever surface mounts this has
         already said what it is — the panel's head, the preview's head, the settings card — and
         the paper itself carries «Albarán 2508-2115» in its masthead, at full size, 40px below.
         The standfirst went with it: «5 lines for Hostal Llobregat, with the trazabilidad each line
         carries under its own name» described a document the reader was looking at. */
      heading={null}
      columns={albaranColumns(fields, compact, inventoryEnabled)}
      rows={rows}
      format={format}
      stageWidth={stageWidth}
      height={height}
      printMode={chrome === 'print'}
      masthead={
        /* THE CUSTOMER'S OWN DOCUMENT, so it carries no mark: «Albarán» is the trade's own word for
           this paper and a mark beside it would be chrome on somebody else's copy. What it does
           carry is the round, because the person at the door wants to know which van brought it. */
        <PaperHead
          house={house}
          document={<span data-testid="albaran-paper-identity" data-sale={sale.id}
            data-truck={sale.customer.truck ?? 'assign'}>Delivery Note {sale.number}</span>}
          who={
            <>
              <Name of={sale.customer} /> · {sale.customer.tier}
            </>
          }
          day={sale.deliveryDay}
          round={roundOf(sale)}
        />
      }
      runningHead={
        <>
          <span>
            Delivery Note {sale.number} · {sale.customer.name}
          </span>
          <span>{sale.deliveryDay}</span>
        </>
      }
      foot={
        <SheetFoot
          totals={
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
              {/* WHAT THE DELIVERY COMES TO, IN THE UNIT THE SHEET IS ABOUT (§37.7). A valued
                  albarán foots in money; an unvalued one foots in the load it delivered, which is
                  the fact its reader signs for. Both are the same sentence about the same crate. */}
              <span
                data-testid="albaran-total"
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap' }}
              >
                {lines} {plural(lines, 'line')} ·{' '}
                {valued ? <Figure value={sale.figure} unit="S/" size="compact" /> : goodsTally(sale.lines)}
              </span>
              {/* THE PAYMENT CLOCK STARTS ON DELIVERY, and a valued albarán is the document that
                  starts it — so the date it runs to belongs on the paper the customer keeps. An
                  unvalued one names the document that carries the money instead, because that is
                  the arrangement and it is the thing its reader wants to know. */}
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                {valued
                  ? `Delivered ${sale.deliveryDay} · pay by ${payByOf(sale)}`
                  : `Delivered ${sale.deliveryDay} · the invoice carries the amounts`}
              </span>
            </span>
          }
          signature="Received by"
        />
      }
      action={
        chrome === 'sheet' || chrome === 'print' ? undefined : (
          <PrintAct
            testid="print-albaran"
            verb={printed > 0 ? 'Print it again' : 'Print the delivery note'}
            done={printed > 0 ? `Printed ${sale.printed?.at}${printed > 1 ? ` · ${printed} copies` : ''}` : null}
            queued={queued}
            paper={paper}
            onPaper={onPaper}
            onPrint={() => onRequestPrint(`albaran:${sale.id}`, `Delivery Note ${sale.number}`, [sale], (source) => [albaranPaperOrder(source[0], now, email, pagesOf(rows, format))])}
          />
        )
      }
    />
  );
}
/* ── THE PACKING LIST — the bay's own paper (FEED-IA §37.7, and §23's register) ────────────────
 * «The packing print as a clear button/UX.»
 *
 * WHAT IT IS. §23 described the bay's posture: «the lines as a checklist with big quantities
 * readable at arm's length, per-line ticks». That posture had no PAPER, and a bay works with its
 * hands: the person filling three hundred crates walks with a list, and the list they need is one
 * block per order, the goods, the amount, and a box to mark. So this is that document, and it is a
 * first-class print product beside the albarán and the day's sheet — its own control, its own
 * label on the queue, its own preview.
 *
 * WHAT IT IS NOT. It never carries a price, under any setting: there is no money column in the
 * column set and no branch that could add one. The bay is filling a crate, and a figure on that
 * paper is a figure walking around a warehouse for no reason.
 *
 * HOW IT DIFFERS FROM THE DAY'S SHEET, which is the question a stranger asks. The day's sheet is
 * ONE list of every stop, read by the person loading the van: stop, hour, customer, goods. The
 * packing list is PER ORDER: each customer's crate gets its own block with its own line count and
 * its own boxes, so the paper can be split and two people can pack at once. Same morning, same
 * walk, two jobs.
 */
export function PackingSheet({
  cast,
  house,
  day,
  sales,
  now,
  queued,
  stageWidth,
  height,
  chrome,
  paper,
  onPaper,
  onRequestPrint = () => undefined,
  layoutProfile = PRINT_LAYOUT_DEFAULTS,
  revision,
}: {
  cast: Cast;
  /** the house's own name — cell one of every head, on every paper (§7.3.6) */
  house: string;
  day: string;
  sales: Sale[];
  now: string;
  queued?: PrintJob;
  stageWidth: number;
  height: number;
  chrome: Chrome;
  paper: PaperFormat;
  onPaper: (p: PaperFormat) => void;
  onRequestPrint?: (logicalKey: string, title: string, source: Sale[], makeOrders: (sales: Sale[]) => PrintOrder[]) => void;
  layoutProfile?: PrintLayoutProfile;
  /** the template's own revision, so an edit re-records the manifest (OUT-01.7) */
  revision?: number;
}) {
  const [, theme] = useStyletron();
  /* PrintView resolves the job's stored salesIds in that exact order (§138.9). Preserve it:
   * a second route sort here used to reverse equal-hour customers after the divider listed them. */
  const walked = React.useMemo(() => salesOfDay(sales, day)
    .filter((sale) => canPrepare(sale) || sale.state === 'sent'), [sales, day]);
  const packingColumns = layoutProfile.packing.columns === 2 ? 2 : 1;
  const rows = packingRows(walked, theme);
  const displayedRows = packingColumns === 2 ? packingRowsInTwoColumns(rows) : rows;
  const lines = walked.reduce((n, s) => n + s.lines.length, 0);
  return (
    <div data-testid="packing-layout" data-columns={packingColumns} style={{ minWidth: 0 }}>
    <PrintSheet
      /* SAME LAW AS THE OTHER TWO (V31 · §111.7): the document, and nothing above it. */
      heading={null}
      columns={packingColumns === 2 ? PACKING_COLUMNS_TWO : PACKING_COLUMNS}
      rows={displayedRows}
      /* THE MARKS THE CAMERA REGISTERS ON, ON EVERY PAGE OF THE BAY'S PAPER (QR-07). This is the
         only sheet that carries them: it is the one that goes out to a bench, gets written on and
         gets photographed. */
      registrationMarks={<RegistrationMarks format={paper} />}
      /* AND THE PAGE NUMBER STEPS ASIDE FOR THE MARK IT WOULD OTHERWISE SIT AGAINST. Measured on
         the printed sheet: the folio's own ink ended 1.0mm from the bottom-right square, which
         reads as though the square were part of the folio's line. The clearance is the mark's own
         arithmetic — its inset plus its side — so the two numbers can never drift apart. */
      markClearance={Math.round((REGISTRATION.insetMm + REGISTRATION.sizeMm) * (SHEET[paper].width / PAGE_MM[paper === 'a5' ? 'A5' : 'A4'].w))}
      format={paper}
      stageWidth={stageWidth}
      height={height}
      printMode={chrome === 'print'}
      masthead={
        /* THE BAY'S OWN PAPER, wearing the bay's own mark (§54.4). Three papers used to leave this
           morning under one printer glyph, told apart only by the words beside them; this one says
           what it is at arm's length, which is how it is actually read. */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: theme.sizing.scale500 }}>
          <PaperHead
            house={house}
            mark={PACKING_MARK}
            document="Packing list"
            who={String(walked.length) + ' ' + plural(walked.length, 'order') + ' · ' + String(lines) + ' ' + plural(lines, 'line')}
            day={dayLabelFromId(day)}
            round={roundOfDay(walked)}
          />
          {/* WHAT DREW THIS SHEET, as one string: the template's revision and the layout that is
              actually on the paper. The mark re-records whenever it moves. */}
          <PackingCaptureMark sales={walked} paper={paper} drawing={`${revision ?? 0}:${packingColumns}:${layoutProfile.packing.sort}`} />
        </div>
      }
      runningHead={
        <>
          <span>Packing list</span>
          <span>{dayLabelFromId(day)}</span>
        </>
      }
      foot={
        <SheetFoot
          totals={
            <span data-testid="packing-total">
              {walked.length} {plural(walked.length, 'order')} · {lines} {plural(lines, 'line')} to pick
            </span>
          }
        />
      }
      action={
        chrome === 'sheet' || chrome === 'print' ? undefined : (
          <PrintAct
            testid="print-packing"
            verb="Print the packing lists"
            done={null}
            queued={queued}
            paper={paper}
            onPaper={onPaper}
            onPrint={() => onRequestPrint(`packing:${day}:${walked.map((sale) => sale.id).join("|")}`, "Packing sheets", walked, (source) => packingRun(day, source, now, undefined, undefined, layoutProfile))}
          />
        )
      }
    />
    </div>
  );
}
/** THE ROWS OF THE BAY'S PAPER. A head row per order — the stop, the customer, the hour and how
 *  many lines the crate is — then one row per line: the box, the goods and the amount at the step
 *  a person reads across a bench. ⚠ A CLASS RODE THE NAME HERE until FEED-IA §197.2 «Remove class
 *  everywhere»: a picker choosing between two crates is choosing on the SKU, which IS the name. */
function packingRowsInTwoColumns(rows: PaperRow[]): PaperRow[] {
  // Keep each order's heading and pick lines together in one lane. Pairing arbitrary rows would
  // put the first line of an order beside its own heading, which is compact but not usable paper.
  const orders: PaperRow[][] = [];
  for (const row of rows) {
    if (row.id.endsWith('-head') || orders.length === 0) orders.push([row]);
    else orders[orders.length - 1].push(row);
  }
  const paired: PaperRow[] = [];
  for (let index = 0; index < orders.length; index += 2) {
    const left = orders[index];
    const right = orders[index + 1] ?? [];
    const height = Math.max(left.length, right.length);
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      const leftRow = left[rowIndex];
      const rightRow = right[rowIndex];
      paired.push({
        id: `${leftRow?.id ?? 'empty'}::${rightRow?.id ?? 'empty'}`,
        cells: {
          leftTick: leftRow?.cells.tick ?? '',
          leftWhat: leftRow?.cells.what ?? '',
          leftAmount: leftRow?.cells.amount ?? '',
          rightTick: rightRow?.cells.tick ?? '',
          rightWhat: rightRow?.cells.what ?? '',
          rightAmount: rightRow?.cells.amount ?? '',
        },
      });
    }
  }
  return paired;
}

function packingRows(walked: Sale[], theme: ReturnType<typeof useStyletron>[1]): PaperRow[] {
  const box = (
    <span
      data-testid="packing-pick-box"
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: `1px solid ${theme.colors.contentPrimary}`,
        borderRadius: theme.borders.radius100,
      }}
    />
  );
  return walked.flatMap((s, stop) => [
    {
      id: `${s.id}-head`,
      cells: {
        tick: '',
        what: (
          /* THE BLOCK'S OWN IDENTITY, STATED FOR THE MANIFEST TOO (§199.1). Several orders share
             one sheet, so the record of what was printed has to name which block is which — the
             order and the customer it is for, read off the head that prints them. */
          <span data-testid="packing-order" data-paper-order="" data-sale={s.id} data-truck={s.customer.truck ?? 'assign'}
            data-number={s.number} data-customer={s.customer.name}
            style={{ ...theme.typography.LabelMedium, display: 'inline-flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <span>{stop + 1} · <Name of={s.customer} /></span>
            <span style={{ color: theme.colors.contentSecondary }}>{slotOf(s)}</span>
          </span>
        ),
        amount: (
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
            {s.lines.length} {plural(s.lines.length, 'line')}
          </span>
        ),
      },
    },
    ...s.lines.map((l) => ({
      id: `${s.id}-${l.id}`,
      cells: {
        tick: box,
        /* ⚠ THE NAME ALONE (FEED-IA §197.2 «Remove class everywhere»). The seat around it is the
           manifest's: the goods AS PRINTED are the words a reading is asked for in — and it takes
           `display: contents`, because it exists to be READ and never to be measured. A real box
           here would wrap the note and option lines the name already carries in an inline. */
        what: <span data-paper-name="" data-sale={s.id} data-line={l.id} style={{ display: 'contents' }}>{nameOf(s, l)}</span>,
        /* THE AMOUNT IS THE THING THIS PAPER IS FOR, so it prints at the step the bay reads it at
           (§23: «big quantities readable at arm's length»): 16px and half a weight up, against the
           14px the rest of the sheet is set in.
           AND IT STAYS INSIDE THE ROW THE PAGE BUDGETED FOR IT. `el papel` paginates by arithmetic
           off one row height, so type that grows the row pushes the last rows of a full page under
           the folio — visible, and measured. LabelMedium is 16px on a 20px line, which is the same
           line box ParagraphSmall already occupies: the amount reads bigger and the page count
           stays true. LabelLarge (18/24) was the first try and it cost 6px a row.

           AND THE FIGURE AND ITS UNIT ARE TWO SEATS INSIDE ONE LINE BOX (§199.1). They print as
           they always did — «12 kg», one line, one language, `qtyWords`' own arithmetic — and each
           half states its own rectangle, so a reading can be asked for against the printed amount
           and a unit can be cropped without the number beside it. The unit stays welded to the
           figure it denominates: same line box, one space, never a second column. */
        amount: <span style={theme.typography.LabelMedium}>{amountSeats(s, l)}</span>,
        /* THE SEAT THE BAY WRITES IN. Empty on purpose (see PACKING_COLUMNS): the head says what
           belongs here, the row's own hairline is the line to write on, and the manifest records
           this rectangle so a photograph is cropped exactly here. */
        finalWeight: (
          /* ⚠ A NO-BREAK SPACE, AND IT IS LOAD-BEARING. `el papel` paginates off ONE row height
             (GEOMETRY.rowHeight, measured at 38px), and the row aligns its cells on the BASELINE.
             An empty inline-block has no line box, so its baseline is its own bottom edge — it
             would hang below the type beside it and grow every row by about five pixels, which is
             a page whose last rows fall under the folio. One invisible space gives the seat a real
             line box, so it aligns like type and measures like a cell: the full column, one line. */
          <span
            data-paper-cell="finalWeight"
            data-sale={s.id}
            data-line={l.id}
            data-testid="packing-final-weight"
            style={{ display: 'inline-block', width: '100%' }}
          >{'\u00a0'}</span>
        ),
      },
    })),
  ]);
}
/** THE AMOUNT, AS TWO NAMED SEATS ON ONE LINE. A line whose amount never arrived legibly prints the
 *  question it is (`amountOf`), and that question is the whole seat — there is no unit to crop
 *  beside a sentence, and the manifest says so by carrying no unit rectangle for that row. */
function amountSeats(sale: Sale, line: SaleLine): React.ReactNode {
  const seat = { 'data-sale': sale.id, 'data-line': line.id };
  if (line.unreadable) {
    return <span data-paper-cell="qty" {...seat} data-value={amountOf(line)}>{amountOf(line)}</span>;
  }
  return (
    <>
      <span data-paper-cell="qty" {...seat} data-value={amountWords(line.given)}>{amountWords(line.given)}</span>
      {' '}
      <span data-paper-cell="unit" {...seat} data-value={line.unit}>{line.unit}</span>
    </>
  );
}
/* ── WHAT THE QUEUE IS HANDED ─────────────────────────────────────────────────────────────────
 * `print-queue.ts` owns the printer, the drain and the ledger's own verbs. These two builders sit
 * here because they are about the DOCUMENTS this file draws: a page count that knows which sheet
 * it counted, and a product the queue has no builder for.
 */
/** ONE ALBARÁN, PAGED ON THE PAPER IT IS ACTUALLY PRINTED ON (§37.7). The queue's own
 *  `albaranOrder` estimates the sheets off A4, which was the only shape there was; a compact
 *  albarán is A5 and fits fewer rows to a page, so the count in the header would run out before
 *  the paper did. The rest of the order — its rails, its ledger write, its words — is the queue's
 *  and is untouched. */
export function albaranPaperOrder(
  sale: Sale,
  at: string,
  email: { connected: boolean; address: string },
  sheets: number,
): PrintOrder {
  return { ...albaranOrder(sale, at, email), sheets };
}
/** WHAT THE PACKING CONTROL SAYS, wherever it stands. One sentence, one number, said the same way
 *  on the day's whisper and inside the export centre — an act that is worded twice is two acts. */
export const packingWords = (orders: number): string =>
  orders === 1 ? 'Print 1 packing list' : `Print ${orders} packing lists`;
/* ── THE ACT ──────────────────────────────────────────────────────────────────────────────────
 * «This can be just a document and a print button and an A4/A5 selector lol — too much chrome.»
 * — Peter, V31, 2026-08-29 (FEED-IA §111.7).
 *
 * So the foot of this surface is exactly three things: THE PRESS · THE PAPER IT GOES ON · and,
 * only once there is one, the act's own state. Everything else that stood here is gone:
 *
 *   THE STANDFIRST     «5 lines for Hostal Llobregat, with the trazabilidad each line carries
 *                      under its own name» — a sentence narrating the sheet printed 200px under
 *                      it, which is the helper repeating what the surface shows (CONTENT-CANON §3).
 *   THE HEADING        said by the panel's own head, by the preview's head, or by the settings
 *                      card — three surfaces, three titles, and this was the fourth.
 *   THE CONSEQUENCE    «It goes on the crate with the goods, and the customer signs the copy.» A
 *                      person pressing Print on an albarán knows what an albarán is for.
 *   THE SIDE DOOR      «Open stop 1» — a second act on a surface whose whole job is one act.
 *
 * WHAT STAYS IS THE STATE, ON ONE LINE. The press ENQUEUES (§20), so between the press and the
 * paper there is a real interval and the control has to say so — «On the printer · 3 pages to
 * come», then the hour it was made. One line, in the act's own seat, never two (§59.1).
 */
/** The paper this sheet goes on. `el papel`'s own two formats, and the only two a house prints an
 *  albarán on. */
type PaperFormat = 'a4' | 'a5';
const PAPERS: Array<{ id: PaperFormat; label: string }> = [
  { id: 'a4', label: 'A4' },
  { id: 'a5', label: 'A5' },
];
function PrintAct({
  testid,
  verb,
  done,
  queued,
  paper,
  onPaper,
  onPrint,
}: {
  testid: string;
  verb: string;
  /** what the surface says once the paper has been made */
  done: string | null;
  /** the job this very sheet is on, where the printer still owes pages for it */
  queued?: PrintJob;
  /** the paper it is set on right now — the house's own answer until a hand moves it */
  paper: PaperFormat;
  onPaper: (p: PaperFormat) => void;
  onPrint: () => void;
}) {
  const [, theme] = useStyletron();
  const state = queued?.state === "printing"
    ? "Print dialog requested · physical print unconfirmed"
    : queued?.state === "waiting"
      ? "Awaiting a browser print dialog"
      : done;
  return (
    <div
      data-testid={`${testid}-act`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        flexWrap: 'wrap',
        padding: theme.sizing.scale500,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundSecondary,
        minWidth: 0,
      }}
    >
      <Button kind={KIND.primary} size={SIZE.compact} data-testid={testid} onClick={onPrint}>
        {verb}
      </Button>
      {state && (
        <span
          data-testid={`${testid}-state`}
          style={{ ...theme.typography.LabelXSmall, flex: 1, minWidth: 0 }}
        >
          {state}
        </span>
      )}
      {!state && <span style={{ flex: 1, minWidth: 0 }} />}
      {/* THE PAPER, AS TWO PILLS (V31). Base's own segmented shape, the same one the printer card
          uses for its paper sizes — so a person who has met one has met both. It starts on the
          house's own answer (Ajustes › Impresión, §20) and moves this sheet alone: the setting is
          still set once, and this is the one print that goes on the other half. */}
      <span
        data-testid={`${testid}-paper`}
        data-paper={paper}
        style={{ display: 'inline-flex', gap: theme.sizing.scale200, flex: '0 0 auto' }}
      >
        {PAPERS.map((p) => (
          <span key={p.id} data-selected={p.id === paper ? 'yes' : 'no'}>
            <Button
              kind={p.id === paper ? KIND.secondary : KIND.tertiary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              data-testid={`${testid}-paper-${p.id}`}
              aria-pressed={p.id === paper}
              onClick={() => onPaper(p.id)}
            >
              {p.label}
            </Button>
          </span>
        ))}
      </span>
    </div>
  );
}
