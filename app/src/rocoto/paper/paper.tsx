/* EL PAPEL — the print sheet.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships no sheet of paper and the product prints two things.
 *
 * WHAT IT CARRIES:
 *   · A SHEET AT TRUE PROPORTION. The subject of a printed card is the layout at arm's length on a
 *     loading bay, so the frame has to be the real shape or the card is deciding nothing.
 *   · ONE COLUMN SET, ALWAYS. The traceability facts ride a smaller SECOND LINE under the product
 *     name rather than columns of their own. That is why one sheet serves a family with eight
 *     facts and a family with two — and why the page count, not the layout, is what moves.
 *   · PAGINATION AS ARITHMETIC. Rows are placed until the page is used, then a new sheet begins.
 *     Nothing is measured off the DOM, so the same rows paginate the same way every time and the
 *     page count can be watched changing under the sector switch.
 *
 * Owned by P0 because two packages need it: F0's picking sheet (P5) and H1's albarán (P6).
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import {
  Root as StyledRoot,
  Frame as StyledFrame,
  Sheet as StyledSheet,
  Body as StyledBody,
  Masthead as StyledMasthead,
  RunningHead as StyledRunningHead,
  Head as StyledHead,
  HeadCell as StyledHeadCell,
  Rows as StyledRows,
  Row as StyledRow,
  Cell as StyledCell,
  SubLine as StyledSubLine,
  Foot as StyledFoot,
  Folio as StyledFolio,
  paginate,
} from './styled-components';
import type { PaperProps, SharedStyleProps } from './types';

const Paper = (props: PaperProps) => {
  const {
    format = 'a4',
    columns,
    rows,
    masthead,
    runningHead,
    foot,
    registrationMarks,
    markClearance = 0,
    scale = 1,
    onPaginate,
    overrides = {},
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Frame, frameProps] = getOverrides(overrides.Frame, StyledFrame);
  const [Sheet, sheetProps] = getOverrides(overrides.Sheet, StyledSheet);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledBody);
  const [Masthead, mastheadProps] = getOverrides(overrides.Masthead, StyledMasthead);
  const [RunningHead, runningHeadProps] = getOverrides(overrides.RunningHead, StyledRunningHead);
  const [Head, headProps] = getOverrides(overrides.Head, StyledHead);
  const [HeadCell, headCellProps] = getOverrides(overrides.HeadCell, StyledHeadCell);
  const [Rows, rowsProps] = getOverrides(overrides.Rows, StyledRows);
  const [Row, rowProps] = getOverrides(overrides.Row, StyledRow);
  const [Cell, cellProps] = getOverrides(overrides.Cell, StyledCell);
  const [SubLine, subLineProps] = getOverrides(overrides.SubLine, StyledSubLine);
  const [Foot, footProps] = getOverrides(overrides.Foot, StyledFoot);
  const [Folio, folioProps] = getOverrides(overrides.Folio, StyledFolio);

  const shared: SharedStyleProps = { $format: format, $scale: scale };
  const template = columns.map((c) => c.width ?? '1fr').join(' ');

  const pages = React.useMemo(
    () => paginate(rows, format, !!masthead, !!foot),
    [rows, format, masthead, foot],
  );

  React.useEffect(() => {
    if (onPaginate) onPaginate(pages.length);
  }, [pages.length, onPaginate]);

  return (
    <Root data-baseweb="paper" {...shared} {...rootProps}>
      {pages.map((indices, page) => (
        <Frame key={page} {...shared} {...frameProps}>
          {/* `data-paper-sheet` is the page's own handle: one sheet, at the paper's true size, so
              anything measuring the printed layout converts against a real box rather than a
              guessed one (`app/paper-manifest.ts`). */}
          <Sheet data-paper-sheet="" data-paper-page={page} {...shared} {...sheetProps}>
            {registrationMarks}
            <Body {...shared} {...bodyProps}>
            {page === 0 && masthead ? (
              <Masthead {...shared} {...mastheadProps}>{masthead}</Masthead>
            ) : null}
            {page > 0 ? (
              <RunningHead {...shared} {...runningHeadProps}>{runningHead}</RunningHead>
            ) : null}

            <Head {...shared} $template={template} {...headProps}>
              {columns.map((c) => (
                <HeadCell key={c.key} {...shared} $align={c.align ?? 'start'} {...headCellProps}>
                  {c.label}
                </HeadCell>
              ))}
            </Head>

            <Rows {...shared} {...rowsProps}>
              {indices.map((i) => {
                const row = rows[i];
                return (
                  <Row key={row.id} {...shared} $template={template} {...rowProps}>
                    {columns.map((c, ci) => (
                      <Cell key={c.key} {...shared} $align={c.align ?? 'start'} {...cellProps}>
                        {row.cells[c.key]}
                        {/* the sub-line rides the FIRST column, under the name it qualifies */}
                        {ci === 0 && row.sub && row.sub.length > 0 && (
                          <SubLine {...shared} {...subLineProps}>
                            {row.sub.map((f) => `${f.label} ${f.value}`).join(' · ')}
                          </SubLine>
                        )}
                        {ci === 0 && row.note && (
                          <SubLine {...shared} {...subLineProps}>{row.note}</SubLine>
                        )}
                      </Cell>
                    ))}
                  </Row>
                );
              })}
            </Rows>

            {page === pages.length - 1 && foot ? (
              <Foot {...shared} {...footProps}>{foot}</Foot>
            ) : null}

            <Folio {...shared} $clear={markClearance} {...folioProps}>
              {page + 1} / {pages.length}
            </Folio>
          </Body>
          </Sheet>
        </Frame>
      ))}
    </Root>
  );
};

export default Paper;
