/* GROWN from Base Web's own `src/template-component/types.ts` — same prop idiom, same overrides
 * contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { FORMAT, ALIGN } from './constants';

export type Format = keyof typeof FORMAT;
export type Align = keyof typeof ALIGN;

export type PaperOverrides = {
  /** the stack of sheets */
  Root?: Override;
  /** the footprint one sheet takes on its stage */
  Frame?: Override;
  /** one sheet, at life size, transformed into its frame */
  Sheet?: Override;
  /** the printed area inside the margins */
  Body?: Override;
  /** the block at the top of the first page */
  Masthead?: Override;
  /** the one-line head repeated on every page after the first */
  RunningHead?: Override;
  /** the column head */
  Head?: Override;
  /** one column head cell */
  HeadCell?: Override;
  /** the rows */
  Rows?: Override;
  /** one row */
  Row?: Override;
  /** one cell */
  Cell?: Override;
  /** the smaller second line under the product name */
  SubLine?: Override;
  /** the block at the bottom of the last page */
  Foot?: Override;
  /** «1 / 3» */
  Folio?: Override;
};

export type PaperColumn = {
  key: string;
  label: React.ReactNode;
  /** a CSS grid track — `1fr`, `88px`. The column set is the same on every page, always. */
  width?: string;
  align?: Align;
};

export type PaperRow = {
  id: string;
  /** by column key */
  cells: Record<string, React.ReactNode>;
  /** THE SUB-LINE. The traceability facts ride here, under the product name, in a smaller step —
   *  so a family with eight facts and a family with two use the same table and the same columns,
   *  and only the page count moves. That is the test that D12 as data is right (C-2, H1). */
  sub?: Array<{ label: string; value: string }>;
  /** the customer's own words, surviving onto the sheet (A10 → F0) */
  note?: React.ReactNode;
};

export type PaperProps = {
  format?: Format;
  columns: PaperColumn[];
  rows: PaperRow[];
  /** the block at the top of the first page: who is sending, to whom, and which document it is */
  masthead?: React.ReactNode;
  /** the line at the top of every page after the first */
  runningHead?: React.ReactNode;
  /** the block at the bottom of the last page: totals, a signature, a legal line */
  foot?: React.ReactNode;
  /** INK THAT BELONGS TO THE SHEET RATHER THAN TO THE TABLE — the registration marks a machine
   *  reads the page's geometry off (THE-QR-SPEC QR-07). Drawn inside EVERY page, behind the body,
   *  positioned against the sheet's own box. A paper that carries none passes nothing and draws
   *  exactly as it always has. */
  registrationMarks?: React.ReactNode;
  /** how much room, in px, the page number leaves on its right for a mark standing in that corner.
   *  A sheet with no marks passes nothing and the folio sets flush to the measure as it always has. */
  markClearance?: number;
  /** how the sheet is scaled to fit its stage. 1 is life size at 96dpi. */
  scale?: number;
  /** how many pages the rows produced. The number H1 watches while the sub-line grows. */
  onPaginate?: (pages: number) => void;
  overrides?: PaperOverrides;
};

export type SharedStyleProps = {
  $format: Format;
  $scale: number;
};
