/* EL PAPEL — GROWN from Base Web's own `src/template-component/constants.ts` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships nothing that is a SHEET OF PAPER — and
 * two of the product's surfaces are printed artefacts (F0's picking sheet, H1's albarán) whose
 * whole subject is the layout at arm's length on a loading bay.
 */

/** The two formats the trade actually prints on, at 96dpi, in the paper's own proportion. */
export const FORMAT = {
  /** 210 × 297 mm — the albarán, the picking sheet */
  a4: 'a4',
  /** 148 × 210 mm — the half sheet a driver folds into a pocket */
  a5: 'a5',
} as const;

export const SHEET: Record<keyof typeof FORMAT, { width: number; height: number }> = {
  a4: { width: 794, height: 1123 },
  a5: { width: 559, height: 794 },
};

/** THE PAGE'S GEOMETRY, in px at 96dpi. These are the sheet's own measurements and they are
 *  brand-independent by construction: a re-brand changes the ink on the page and never the size
 *  of the page. */
export const GEOMETRY = {
  /** the printed margin on every edge */
  margin: 40,
  /** THE HEIGHT A ROW OF THE TABLE OCCUPIES BEFORE ITS SUB-LINE — MEASURED, NOT GUESSED.
   *  `Row` is `ParagraphSmall` (20px line) between two `scale300` pads (8 + 8) over a 1px rule,
   *  and a plain packing row reads back at exactly 38px in the browser. It stood at 34 here, so
   *  `paginate` and `sheetsFor` both believed about two more rows fitted on every sheet than
   *  actually do — a page count that under-reads a long day, which is the number the queue counts
   *  down and the bay waits on. The constant is the measurement now. */
  rowHeight: 38,
  /** each line of the traceability sub-line under the product name */
  subLineHeight: 14,
  /** how many facts fit on one sub-line before it wraps — the number H1's page count turns on */
  subFactsPerLine: 3,
  /** the column head, drawn once per page */
  headHeight: 30,
  /** the masthead on the first page, and the running head on every page after it */
  mastheadHeight: 132,
  runningHeadHeight: 44,
  /** the foot, on the last page */
  footHeight: 96,
  /** the page number line at the bottom of every page */
  folioHeight: 22,
} as const;

/** Where a printed cell's value sits. */
export const ALIGN = {
  start: 'start',
  end: 'end',
} as const;
