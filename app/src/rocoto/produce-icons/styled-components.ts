/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme. The icon's four sizes are four positions on Base's
 * own sizing scale — 16 · 20 · 24 · 32 — rather than four numbers this component invented, so an
 * icon beside a Label sits at the same rhythm as everything else on the row.
 *
 * The one thing this file does NOT own is the paint. The drawings carry the content palette
 * (palette.ts, granted by THE-INTELLIGENCE §7); the chrome around them — size, alignment, the ink
 * that `mono` inherits — is the theme's, as it is everywhere else.
 */
import { styled } from 'baseui';
import { SIZE_STEP } from './constants';
import type { SharedStyleProps } from './types';

/* THE LOCKUP. `inline-flex` and not `block`: an icon's home is beside a product name on a line,
 * and a block would knock it off the baseline of every row it appears in. `flex: none` because a
 * drawing that a flex parent squeezed to 11px is a drawing nobody can read. */
export const Root = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => {
  const side = $theme.sizing[SIZE_STEP[$size]];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    width: side,
    height: side,
    /* the drawing's optical centre sits a touch above the text baseline, the way a small
     * illustration should beside a word — Base's own smallest sizing step is the nudge */
    verticalAlign: 'middle',
  };
});
Root.displayName = 'ProduceIcon';

/* THE DRAWING. `display: block` kills the inline descender gap under an svg — the classic four
 * pixels of ghost space that would otherwise push every row's icon off centre. */
export const Svg = styled<'svg', SharedStyleProps>('svg', () => ({
  display: 'block',
  width: '100%',
  height: '100%',
  overflow: 'visible',
}));
Svg.displayName = 'ProduceIconSvg';
