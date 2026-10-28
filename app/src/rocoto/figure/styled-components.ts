/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type scale, the weights, the spacing scale, the
 * colours. There are no invented numbers. An earlier version carried a hand-built ramp lifted from
 * the current app; that is exactly how the old design kept crawling back in, so it is gone.
 */
import { styled } from 'baseui';
import type { SharedStyleProps, Size } from './types';

/* THE RAMP, expressed purely as positions on Base's own type scale.
 * The figure takes a Label or Heading step; the superseded figure and the unit take the step below
 * it, so the pair always sits one rung apart no matter which size is used. */
const RAMP: Record<Size, { value: string; sub: string; gap: string }> = {
  mini: { value: 'LabelSmall', sub: 'LabelXSmall', gap: 'scale100' },
  compact: { value: 'LabelMedium', sub: 'LabelXSmall', gap: 'scale200' },
  default: { value: 'LabelLarge', sub: 'LabelSmall', gap: 'scale200' },
  large: { value: 'HeadingSmall', sub: 'LabelSmall', gap: 'scale300' },
  display: { value: 'DisplaySmall', sub: 'LabelLarge', gap: 'scale500' },
};

export const ramp = (size: Size) => RAMP[size];

/* ── THE SUBORDINATION RATIO ──────────────────────────────────────────────────────────────────
 * Monzo renders the cents markedly smaller than the units — 60.00, 472.00, 254.65 — and that
 * hierarchy is the point: the units ARE the number, the decimals are its tail.
 *
 * The number is 0.65, and it is not invented. The RAMP above already states a subordination five
 * times over — every `value` step against its own `sub` step:
 *
 *     mini    LabelXSmall/LabelSmall    12/14 = 0.857
 *     compact LabelXSmall/LabelMedium   12/16 = 0.750
 *     default LabelSmall/LabelLarge     14/18 = 0.778
 *     large   LabelSmall/HeadingSmall   14/24 = 0.583
 *     display LabelLarge/DisplaySmall   18/44 = 0.409
 *
 * Their GEOMETRIC MEAN — the right average for ratios — is 0.6536. Rounded: 0.65. So the fraction
 * is held at the average subordination this component already expresses, made uniform.
 *
 * It is applied in `em`, i.e. PROPORTIONALLY to whatever size the figure is at, rather than as a
 * fixed step down the type scale. A step is the wrong instrument here: stepping down one rung is
 * a 0.86 reduction at `mini` and a 0.41 reduction at `display`, so the same prop would produce a
 * barely-there hierarchy at the small end and a collapsed one at the large. One ratio is one
 * relationship, identical at every rung — which is the whole reason the ratio exists.
 *
 * Alignment is the shared BASELINE, which for lining (tabular) figures is also the optical one:
 * both runs sit on the same line, cap-aligned at the bottom, exactly as Monzo sets them. Nothing
 * is raised, so nothing has to be nudged back down.
 * ─────────────────────────────────────────────────────────────────────────────────────────── */
export const DECIMAL_RATIO = 0.65;

/* THE LOCKUP. `nowrap` is load-bearing rather than tidiness: a unit that shares the line at 1440px
 * and wraps at 360px is the same mis-sale on the device most people read on. The figure and its
 * unit are one object. */
export const Root = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: $theme.sizing[RAMP[$size].gap as keyof typeof $theme.sizing],
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
}));
Root.displayName = 'Figure';

/* THE SUPERSEDED FIGURE. Struck, dimmed, kept. The pair is the whole signal, so no arrow and no
 * colour is needed to say which way it moved. `line-through` is typography, not ornament.
 *
 * It NEVER splits its decimals, whatever `decimalScale` says. Two reasons, both hard: a strike
 * drawn across two font sizes breaks into two lines at two heights, and a predecessor that has an
 * internal hierarchy of its own starts competing with the figure that stands. The predecessor is
 * already subordinated three ways — a rung down, dimmer, struck. That is enough. */
export const Was = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].sub as keyof typeof $theme.typography],
  color: $theme.colors.contentTertiary,
  textDecoration: 'line-through',
  textDecorationColor: $theme.colors.contentTertiary,
}));
Was.displayName = 'FigureWas';

export const Value = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].value as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
}));
Value.displayName = 'FigureValue';

/* THE UNITS — everything left of the separator. It carries no styling of its own: it IS the
 * figure's size, and the slot exists so a consumer can reach it through `overrides`. */
export const Integer = styled<'span', SharedStyleProps>('span', () => ({}));
Integer.displayName = 'FigureInteger';

/* THE FRACTION — the separator AND the digits after it. The separator travels with the decimals
 * because it belongs to them: it is the mark that the units have ended, so «,65» is one object and
 * «254,» is not. Locale decides which mark that is (es-ES comma, en-US point); the split is made
 * by Intl, never by a hard-coded character.
 *
 * Colour is deliberately unchanged. Size alone carries the hierarchy — dimming the cents as well
 * would be a second signal saying the same thing, and this system lets ink do the work. */
export const Fraction = styled<'span', SharedStyleProps>('span', ({ $decimalScale }) =>
  $decimalScale === 'full'
    ? {}
    : {
        fontSize: `${DECIMAL_RATIO}em`,
        /* THE LEADING MUST BE ZERO, and this was caught by measuring rather than by looking.
         * An inline run that inherits the figure's line-height keeps that whole line-height for
         * its own much smaller face, so its half-leading hangs BELOW the figure's descender and
         * the lockup's box silently grew 58px against 52px at `display` — six pixels of ghost
         * space under every subordinate figure, which is six pixels of drift in any dense row.
         * Zero leading collapses the fraction's inline box onto the baseline: the glyphs still
         * paint, and the figure's own leading is the only leading in the lockup. */
        lineHeight: 0,
      }
);
Fraction.displayName = 'FigureFraction';

/* THE UNIT. One rung down, dimmer, and inside the lockup — never a sibling block. A rate unit
 * denominates the number, so it is part of it. */
export const Unit = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].sub as keyof typeof $theme.typography],
  color: $theme.colors.contentSecondary,
}));
Unit.displayName = 'FigureUnit';
