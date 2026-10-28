/* THE PRINT SHEET — the canonical screen behind F0 (the day's picking) and H1 (the albarán).
 *
 * TWO CARDS, ONE SCREEN. Brief §3 says Rocoto produces two things, and both of them are a sheet:
 * the picking list that leaves with the warehouse and the albarán that leaves with the goods. The
 * reduction claims they are ONE screen with different data in it (S14), and this file is where
 * that claim is either true or false. It is true if H1 can be reached by handing this component a
 * different masthead, a different column set and different rows — and by changing nothing else.
 *
 * WHAT THE CANONICAL OWNS
 *   · THE PREVIEW. A printed artefact is looked at on a screen before it is looked at on a loading
 *     bay, so the subject is a sheet on a stage, at true proportion, with its page count visible.
 *     `PaperStage` (P0) is that stage and `el papel` (P0) is that sheet; this file arranges them
 *     inside a surface with the controls the sheet is produced by.
 *   · THE CONTROL STRIP, above the sheet and never on it. F0's grouping control lives here. A
 *     control drawn on the paper would be a control that prints.
 *   · THE MASTHEAD AND FOOT ANATOMY, so the picking list and the albarán agree about where the
 *     issuer, the recipient, the day and the totals stand. Two sheets from one house that place
 *     their own name differently are two products.
 *
 * WHAT IT REFUSES. It holds no rows of its own and no column set of its own. Both cards supply
 * theirs, which is exactly why the delta between them is data (C-15, and H1's own reduction line).
 *
 * P5 owns this file. P6's H1 READS it and never edits it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import PaperStage from '../chassis/paper';
import type { PaperColumn, PaperRow, Format } from '../../rocoto/paper';

/* ── THE MASTHEAD ─────────────────────────────────────────────────────────────────────────────
 * The block at the top of the first page: who is sending, what this document is, to whom, and for
 * when. Four facts, in that order, on every sheet the product prints. */

export type SheetMastheadProps = {
  /** the house sending it. A sheet that leaves the building carries it; a picking list never
   *  leaves the building, so F0 omits it and the left block carries the round instead. */
  issuer?: React.ReactNode;
  /** what this document is — «Picking list», «Albarán» */
  document: React.ReactNode;
  /** who it is for. A picking list is for the warehouse, so this side names the round. */
  recipient: React.ReactNode;
  /** the day it is for */
  day: React.ReactNode;
  /** the document's own number, where it has one */
  serial?: React.ReactNode;
};

export function SheetMasthead({ issuer, document, recipient, day, serial }: SheetMastheadProps) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale600, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        {issuer && <div style={{ ...theme.typography.LabelLarge }}>{issuer}</div>}
        <div
          style={
            issuer
              ? { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }
              : theme.typography.LabelLarge
          }
        >
          {recipient}
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        <div style={{ ...theme.typography.HeadingXSmall }}>{document}</div>
        <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {day}
          {serial ? <> · {serial}</> : null}
        </div>
      </div>
    </div>
  );
}

/* ── THE FOOT ─────────────────────────────────────────────────────────────────────────────────
 * The block at the bottom of the last page: what the sheet adds up to, and the space a hand signs
 * in where the sheet is signed. */

export function SheetFoot({
  totals,
  signature,
}: {
  totals?: React.ReactNode;
  /** the line a hand signs on. A picking sheet has none; an albarán has one. */
  signature?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale700, alignItems: 'flex-end' }}>
      <div style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}>{totals}</div>
      {signature && (
        <div style={{ minWidth: 180, textAlign: 'right' }}>
          <div style={{ borderTop: `1px solid ${theme.colors.contentPrimary}`, paddingTop: theme.sizing.scale200, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {signature}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── THE PREVIEW ──────────────────────────────────────────────────────────────────────────── */

export type PrintSheetProps = {
  /** what this document is, above the stage — the surface's own heading, never the sheet's */
  heading: React.ReactNode;
  /** one line saying what the sheet is for, under the heading */
  standfirst?: React.ReactNode;
  /** the controls that produce the sheet. They stand above it, never on it. */
  controls?: React.ReactNode;
  /** anything that belongs beside the controls — a count, a pointer, a ghosted option */
  aside?: React.ReactNode;
  columns: PaperColumn[];
  rows: PaperRow[];
  masthead?: React.ReactNode;
  runningHead?: React.ReactNode;
  foot?: React.ReactNode;
  /** ink the SHEET carries on every page — the registration marks (THE-QR-SPEC QR-07) */
  registrationMarks?: React.ReactNode;
  /** room, in px, the page number leaves for a mark standing in its corner */
  markClearance?: number;
  format?: Format;
  stageWidth?: number;
  height?: number;
  /** the action that sends the sheet to a printer, at the foot of the surface */
  action?: React.ReactNode;
  /** Render the paper itself for a browser print document, without preview stage chrome. */
  printMode?: boolean;
};

export default function PrintSheet({
  heading,
  standfirst,
  controls,
  aside,
  columns,
  rows,
  masthead,
  runningHead,
  foot,
  registrationMarks,
  markClearance,
  format = 'a4',
  stageWidth = 560,
  height = 620,
  action,
  printMode = false,
}: PrintSheetProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {/* A HEAD WITH NOTHING IN IT IS A BAND OF NOTHING (FEED-IA §111.7). `heading` is a slot, not
          a requirement: a surface that has already said what this document is — the panel's own
          head, the export centre's preview head, a settings card — passes null, and an empty `h2`
          plus this column's gap would spend 50px above the paper saying it. Every other caller
          passes a real heading and draws exactly as it always has. */}
      {(heading || standfirst) && (
        <header style={{ minWidth: 0 }}>
          {heading && <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{heading}</h2>}
          {standfirst && (
            <p style={{ margin: heading ? `${theme.sizing.scale200} 0 0` : 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {standfirst}
            </p>
          )}
        </header>
      )}

      {(controls || aside) && (
        <div
          style={{
            display: 'flex',
            gap: theme.sizing.scale600,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>{controls}</div>
          <div style={{ minWidth: 0 }}>{aside}</div>
        </div>
      )}

      <PaperStage
        format={format}
        columns={columns}
        rows={rows}
        masthead={masthead}
        runningHead={runningHead}
        foot={foot}
        registrationMarks={registrationMarks}
        markClearance={markClearance}
        stageWidth={stageWidth}
        height={height}
        printMode={printMode}
      />

      {action}
    </div>
  );
}
