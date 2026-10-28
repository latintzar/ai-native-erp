/* GROWN alongside the fork, on Base Web's own styled-components idiom (`styled<'div', Props>`,
 * a displayName, everything read off `$theme`). Base Web is MIT, Copyright (c) Uber
 * Technologies, Inc.
 *
 * The lock's own furniture: the set, one row, the row's name, the row's control and the row's
 * result. Base ships the slider; it does not ship the table a set of linked sliders stands in.
 */
import { styled } from 'baseui';

export const Root = styled('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}));
Root.displayName = 'StyledCandadoRoot';

export const Row = styled<'div', { $first?: boolean }>('div', ({ $theme, $first }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 200px) minmax(160px, 1fr) auto',
  alignItems: 'center',
  columnGap: $theme.sizing.scale700,
  paddingTop: $theme.sizing.scale400,
  paddingBottom: $theme.sizing.scale400,
  borderTopWidth: $first ? '0' : '1px',
  borderTopStyle: 'solid',
  borderTopColor: $theme.colors.borderOpaque,
  minWidth: 0,
}));
Row.displayName = 'StyledCandadoRow';

export const Names = styled('div', ({ $theme }) => ({
  minWidth: 0,
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentPrimary,
}));
Names.displayName = 'StyledCandadoNames';

export const Control = styled('div', () => ({ minWidth: 0 }));
Control.displayName = 'StyledCandadoControl';

export const Result = styled('div', () => ({
  textAlign: 'right',
  whiteSpace: 'nowrap',
}));
Result.displayName = 'StyledCandadoResult';

export const Note = styled('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentSecondary,
}));
Note.displayName = 'StyledCandadoNote';
