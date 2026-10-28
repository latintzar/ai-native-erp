/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY COLOUR AND EVERY TYPE STEP IS THE THEME'S. The only literal numbers here are the sheet's
 * own geometry — a page is 210mm wide under any brand — and they live in `constants.ts`, once.
 *
 * NO ORNAMENT. No paper texture, no drop shadow pretending to be a stack, no dog-ear, no
 * rotation. A sheet is a rectangle of the right proportion with ink on it; the distinctiveness is
 * the constraint. What separates one sheet from the next is a hairline and the ground behind them.
 */
import { styled } from 'baseui';
import { SHEET, GEOMETRY } from './constants';
import type { SharedStyleProps, Align } from './types';

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: $theme.sizing.scale600,
}));
Root.displayName = 'Paper';

/** THE FRAME. The space one sheet takes on its stage — the sheet's own size, scaled.
 *
 *  The frame and the sheet are two elements on purpose. The SHEET is always life size, so its
 *  arithmetic and its typography are the printed page's and nothing has to be recomputed per
 *  stage; the FRAME reserves the shrunken footprint and the sheet is transformed into it. Scaling
 *  the box without scaling its contents was the first version, and it quietly under-filled every
 *  page — the pagination said one page while the rows ran off the bottom. */
export const Frame = styled<'div', SharedStyleProps>('div', ({ $format, $scale }) => ({
  position: 'relative',
  width: `${SHEET[$format].width * $scale}px`,
  height: `${SHEET[$format].height * $scale}px`,
  overflow: 'hidden',
}));
Frame.displayName = 'PaperFrame';

/** ONE SHEET, at the paper's true proportion and at LIFE SIZE, transformed into its frame — so a
 *  sheet read at 60% is the same sheet, and the layout question H1 asks survives the shrink. */
export const Sheet = styled<'div', SharedStyleProps>('div', ({ $theme, $format, $scale }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  boxSizing: 'border-box',
  width: `${SHEET[$format].width}px`,
  height: `${SHEET[$format].height}px`,
  padding: `${GEOMETRY.margin}px`,
  transform: `scale(${$scale})`,
  transformOrigin: 'top left',
  backgroundColor: $theme.colors.backgroundPrimary,
  color: $theme.colors.contentPrimary,
  fontFamily: 'inherit',
  border: `1px solid ${$theme.colors.borderOpaque}`,
  overflow: 'hidden',
}));
Sheet.displayName = 'PaperSheet';

export const Body = styled<'div', SharedStyleProps>('div', () => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}));
Body.displayName = 'PaperBody';

/** THE MASTHEAD. Page one only: who is sending, to whom, and which document this is. */
export const Masthead = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  borderBottom: `2px solid ${$theme.colors.contentPrimary}`,
  paddingBottom: $theme.sizing.scale400,
  marginBottom: $theme.sizing.scale500,
}));
Masthead.displayName = 'PaperMasthead';

/** THE RUNNING HEAD. Every page after the first says what it is, because a page two found on a
 *  loading bay with no page one still has to be identifiable. */
export const RunningHead = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentSecondary,
  display: 'flex',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${$theme.colors.contentPrimary}`,
  paddingBottom: $theme.sizing.scale200,
  marginBottom: $theme.sizing.scale400,
}));
RunningHead.displayName = 'PaperRunningHead';

export const Head = styled<'div', SharedStyleProps & { $template: string }>('div', ({ $theme, $template }) => ({
  display: 'grid',
  gridTemplateColumns: $template,
  gap: $theme.sizing.scale400,
  alignItems: 'end',
  borderBottom: `1px solid ${$theme.colors.contentPrimary}`,
  paddingBottom: $theme.sizing.scale200,
}));
Head.displayName = 'PaperHead';

export const HeadCell = styled<'span', SharedStyleProps & { $align: Align }>('span', ({ $theme, $align }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: $align === 'end' ? 'right' : 'left',
}));
HeadCell.displayName = 'PaperHeadCell';

export const Rows = styled<'div', SharedStyleProps>('div', () => ({
  flex: 1,
  minHeight: 0,
}));
Rows.displayName = 'PaperRows';

export const Row = styled<'div', SharedStyleProps & { $template: string }>('div', ({ $theme, $template }) => ({
  display: 'grid',
  gridTemplateColumns: $template,
  gap: `0 ${$theme.sizing.scale400}`,
  alignItems: 'baseline',
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  borderBottom: `1px solid ${$theme.colors.borderOpaque}`,
}));
Row.displayName = 'PaperRow';

export const Cell = styled<'span', SharedStyleProps & { $align: Align }>('span', ({ $theme, $align }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentPrimary,
  textAlign: $align === 'end' ? 'right' : 'left',
  fontVariantNumeric: 'tabular-nums',
}));
Cell.displayName = 'PaperCell';

/** THE SUB-LINE. Smaller, quieter, and UNDER THE PRODUCT NAME rather than in columns of its own —
 *  which is the whole reason one table serves a family with eight traceability facts and a family
 *  with two. The columns never move; the sub-line grows. */
export const SubLine = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentSecondary,
  display: 'block',
  paddingTop: $theme.sizing.scale100,
}));
SubLine.displayName = 'PaperSubLine';

export const Foot = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  borderTop: `2px solid ${$theme.colors.contentPrimary}`,
  paddingTop: $theme.sizing.scale400,
  marginTop: $theme.sizing.scale400,
}));
Foot.displayName = 'PaperFoot';

/** THE PAGE NUMBER, at the foot on the right — and stepping aside for a registration mark where
 *  the sheet carries one (THE-QR-SPEC QR-07). `$clear` is that room in px; a sheet with no marks
 *  passes 0 and the folio sets flush to the measure exactly as it always has. */
export const Folio = styled<'div', SharedStyleProps & { $clear?: number }>('div', ({ $theme, $clear }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentTertiary,
  textAlign: 'right',
  paddingTop: $theme.sizing.scale300,
  paddingRight: `${$clear ?? 0}px`,
}));
Folio.displayName = 'PaperFolio';

/** THE PAGINATION, as arithmetic rather than as measurement.
 *
 *  A sheet's content height is fixed and every row's height is known from its own sub-line, so the
 *  page count is COMPUTED and not read back off the DOM. That matters for two reasons: the same
 *  rows always paginate the same way, so a screenshot is stable; and H1 can watch the page count
 *  move under the sector switch without the browser being involved at all. */
export const paginate = (
  rows: Array<{ sub?: Array<unknown>; note?: unknown }>,
  format: keyof typeof SHEET,
  hasMasthead: boolean,
  hasFoot: boolean,
): Array<Array<number>> => {
  const content = SHEET[format].height - GEOMETRY.margin * 2;
  const heightOf = (r: { sub?: Array<unknown>; note?: unknown }) =>
    GEOMETRY.rowHeight +
    (r.sub && r.sub.length
      ? Math.ceil(r.sub.length / GEOMETRY.subFactsPerLine) * GEOMETRY.subLineHeight
      : 0) +
    (r.note ? GEOMETRY.subLineHeight : 0);

  const pages: Array<Array<number>> = [];
  let page: number[] = [];
  let used = (hasMasthead ? GEOMETRY.mastheadHeight : GEOMETRY.runningHeadHeight) + GEOMETRY.headHeight + GEOMETRY.folioHeight;

  rows.forEach((r, i) => {
    const h = heightOf(r);
    if (page.length && used + h > content) {
      pages.push(page);
      page = [];
      used = GEOMETRY.runningHeadHeight + GEOMETRY.headHeight + GEOMETRY.folioHeight;
    }
    page.push(i);
    used += h;
  });

  if (page.length) pages.push(page);
  if (!pages.length) pages.push([]);

  // the foot needs room on the last page, or it takes one of its own
  if (hasFoot) {
    const last = pages[pages.length - 1];
    const lastUsed =
      (pages.length === 1 && hasMasthead ? GEOMETRY.mastheadHeight : GEOMETRY.runningHeadHeight) +
      GEOMETRY.headHeight +
      GEOMETRY.folioHeight +
      last.reduce((sum, i) => sum + heightOf(rows[i]), 0);
    if (lastUsed + GEOMETRY.footHeight > content) pages.push([]);
  }

  return pages;
};
