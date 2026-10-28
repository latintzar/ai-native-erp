/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY COLOUR HERE IS READ FROM BASE'S THEME. There is no hex, no rgba, no named colour in this
 * file — the field is ink on the ground it sits on, and re-theming the system re-inks it.
 *
 * The geometry is the one thing that is stated in numbers, and it is stated once, in
 * `constants.ts`: the mark's thickness, the gap and the ceiling. Those three numbers are the
 * component, in the way `scale750` is a spacing step — and the default step happens to BE Base's
 * `scale0` and `scale750`, so a field lines up with everything around it.
 */
import { styled } from 'baseui';
import { GEOMETRY } from './constants';
import type { BarStyleProps, SharedStyleProps } from './types';

/* THE LOCKUP. The field takes the width it is given and the readout takes what it needs, so a
 * waveform in a 240px card and one in a 900px row are the same component with a different number
 * of marks — never the same marks stretched. */
export const Root = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
}));
Root.displayName = 'Waveform';

/* THE STRIP. In scrubbing mode this element IS the control — it takes focus, it takes the drag,
 * and it answers to the arrow keys — so it carries the focus ring. The ring is drawn OUTSIDE the
 * box with `outlineOffset`, because a 22px strip has no room to hold a ring inside itself, and a
 * ring that overlapped the marks would hide the very thing being seeked through. */
export const Field = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $mode, $size, $disabled, $isFocusVisible }) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: `${GEOMETRY[$size].barMax}px`,
    gap: `${GEOMETRY[$size].barGap}px`,
    outline:
      $isFocusVisible && $mode === 'scrubbing'
        ? `${$theme.borders.border300.borderWidth} solid ${$theme.colors.borderAccent}`
        : 'none',
    outlineOffset: $theme.sizing.scale100,
    borderRadius: $theme.borders.radius100,
    cursor: $mode === 'scrubbing' && !$disabled ? 'pointer' : 'default',
    // a drag on a strip this thin must not also scroll the page under the finger
    touchAction: $mode === 'scrubbing' ? 'none' : 'auto',
    WebkitTapHighlightColor: 'transparent',
  })
);
Field.displayName = 'WaveformField';

/* ONE MARK. Its height is written by the component, not by this file: a live field rewrites
 * every mark sixteen times a second, and minting a style class per height would fill the
 * stylesheet with thousands of one-use rules within a minute. Paint is styled here, where paint
 * belongs; the single changing number is set on the node.
 *
 * `$played` is the whole colour story. A live or static field inks every mark; a scrub inks the
 * marks behind the playhead and dims the ones in front — which is two classes, not two hundred.
 *
 * The dim is `contentStateDisabled`, not `contentTertiary`. Tertiary was the first choice and it
 * was wrong for one measurable reason: at 2.5px wide, ink and tertiary are the same mark to the
 * eye, so the playhead — the entire point of the scrubbing mode — was invisible on the page. The
 * split has to survive being 2.5px wide, which means it has to be a real step, not a shade. */
export const Bar = styled<'div', BarStyleProps>('div', ({ $theme, $size, $played, $disabled }) => ({
  flexGrow: 0,
  flexShrink: 0,
  width: `${GEOMETRY[$size].barWidth}px`,
  height: `${GEOMETRY[$size].barWidth}px`, // the baseline dot, until a level lifts it
  borderRadius: `${GEOMETRY[$size].barWidth / 2}px`,
  backgroundColor:
    $disabled || !$played ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  transitionProperty: 'background-color',
  transitionDuration: $theme.animation.timing100,
  transitionTimingFunction: $theme.animation.linearCurve,
}));
Bar.displayName = 'WaveformBar';

/* THE READOUT. Tabular figures, so a playhead crossing 0:09 → 0:10 does not shove the field
 * sideways, and a column of these aligns without a monospace face. */
export const Time = styled<'div', SharedStyleProps>('div', ({ $theme, $size, $disabled }) => ({
  ...$theme.typography[
    ($size === 'compact' ? 'LabelXSmall' : 'LabelSmall') as keyof typeof $theme.typography
  ],
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  whiteSpace: 'nowrap',
  flexGrow: 0,
  flexShrink: 0,
}));
Time.displayName = 'WaveformTime';
