/* FORKED from Base Web `src/slider/styled-components.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: E2 divides one order line across two or more lotes. Base's Slider
 * hard-limits itself to two thumbs and models a RANGE; el reparto models a DIVISION — N-1
 * boundaries on one total, where the parts are the segments between them, so quantity cannot be
 * created or lost by dragging.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. — the upstream notice below
 * travels with this copy as the licence requires, and the full licence is vendored at
 * app/src/rocoto/LICENSE.baseweb.txt. This file is a DERIVATIVE WORK.
 *
 * Everything about how this component is assembled is deliberately left as Base built it: the
 * `overrides` contract, `getOverrides`, the shared-props shape, theme-driven styling, focus
 * and keyboard handling, and the animation tokens. Rocoto's edits are marked `ROCOTO:` inline
 * and listed in CHANGES.md, so the delta from upstream is always readable.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import { getTrackBackground } from 'react-range';

import { styled } from 'baseui';
import { GEOMETRY, WEAVE } from './constants';
import type { StyleProps } from './types';

/* ROCOTO: one part's paint. Even parts take full ink; odd parts take a pale ink that is a MIX of
 * Base's mono step and the brand's own `contentPrimary`, so the pale band carries the brand and
 * visibly moves under `?theme=proof` instead of sitting still like raw mono would. Both halves are
 * theme tokens; there is no literal paint here at all. */
type Painted = { colors: Record<string, string> };
export const band = ($theme: Painted, index: number, disabled?: boolean): string => {
  if (disabled) return $theme.colors.borderStateDisabled;
  return index % 2 === 0
    ? $theme.colors.borderSelected
    : `color-mix(in srgb, ${$theme.colors.contentPrimary} ${WEAVE.ink}%, ${$theme.colors[WEAVE.ground]})`;
};

export const Root = styled('div', { position: 'relative', width: '100%' });
Root.displayName = 'StyledRoot';

export const Track = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $disabled, $isDragged } = props;
  const { sizing } = $theme;
  let cursor = 'inherit';
  if ($disabled) {
    cursor = 'not-allowed';
  } else if ($isDragged) {
    cursor = 'grabbing';
  }
  return {
    paddingTop: sizing.scale800,
    paddingBottom: sizing.scale600,
    // ROCOTO: no side padding. Base insets the track so a range's end labels have room; a
    // division has no ends to label — the bar IS the total, and a bar that stops short of its
    // own container reads as a bar that lost some of the quantity.
    paddingRight: '0',
    paddingLeft: '0',
    display: 'flex',
    cursor,
    backgroundColor: $theme.colors.backgroundPrimary,
  };
});
Track.displayName = 'StyledTrack';

/** ROCOTO: N parts, not two. Base paints a range as three bands (before · selected · after) off a
 *  fixed colour triple. A division has as many bands as it has parts, so the colour list is built
 *  from the boundary count and Base's own `getTrackBackground` places them — the helper already
 *  takes N values and N+1 colours, so the paint stays Base's arithmetic and only the input grew. */
export const InnerTrack = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $value = [], $min, $max, $disabled } = props;
  const { colors, borders, direction } = $theme;
  const borderRadius = $theme.borders.useRoundedCorners ? borders.radius100 : 0;
  const weave = $value.concat([0]).map((_, i) => band($theme, i, $disabled));
  return {
    borderTopLeftRadius: borderRadius,
    borderTopRightRadius: borderRadius,
    borderBottomRightRadius: borderRadius,
    borderBottomLeftRadius: borderRadius,
    background: getTrackBackground({
      values: $value,
      colors: weave,
      min: $min || 0,
      max: $max || 0,
      rtl: direction === 'rtl',
    }),
    height: `${GEOMETRY.track}px`,
    width: '100%',
    alignSelf: 'center',
    cursor: $disabled ? 'not-allowed' : 'inherit',
  };
});
InnerTrack.displayName = 'StyledInnerTrack';

export const Mark = styled<'div', StyleProps>('div', (props) => {
  return {
    width: '4px',
    height: '2px',
    backgroundColor: props.$theme.colors.backgroundPrimary,
    marginLeft: '16px',
  };
});
Mark.displayName = 'StyledMark';

export const Tick = styled<'div', StyleProps>('div', (props) => {
  return {
    ...props.$theme.typography.font200,
    color: props.$theme.colors.contentTertiary,
  };
});
Tick.displayName = 'StyledTick';

export const TickBar = styled<'div', StyleProps>('div', (props) => {
  const { $theme } = props;
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: $theme.sizing.scale400,
  };
});
TickBar.displayName = 'StyledTickBar';

/** ROCOTO: the handle is a BOUNDARY, so it is drawn as one — a standing rule the height of the
 *  bar with a grip, rather than Base's circular knob. A circle sits ON a track; a rule divides it,
 *  and the shape has to say which of those two things is happening. Base's focus ring, disabled
 *  fill and cursor rules are kept exactly as they are. */
export const Thumb = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $disabled } = props;
  return {
    height: `${GEOMETRY.track + 14}px`,
    width: `${GEOMETRY.grip}px`,
    borderTopLeftRadius: $theme.borders.radius100,
    borderTopRightRadius: $theme.borders.radius100,
    borderBottomLeftRadius: $theme.borders.radius100,
    borderBottomRightRadius: $theme.borders.radius100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: $disabled
      ? $theme.colors.sliderHandleFillDisabled
      : $theme.colors.sliderHandleFill,
    outline: 'none',
    boxShadow: props.$isFocusVisible
      ? `0 0 0 3px ${$theme.colors.borderAccent}`
      : '0 1px 4px rgba(0, 0, 0, 0.12)',
    cursor: $disabled ? 'not-allowed' : 'col-resize',
  };
});
Thumb.displayName = 'StyledThumb';

export const InnerThumb = styled<'div', StyleProps>('div', (props) => {
  const { $disabled, $theme } = props;
  return {
    width: `${GEOMETRY.boundary}px`,
    height: `${GEOMETRY.track}px`,
    backgroundColor: $disabled
      ? $theme.colors.sliderHandleFillDisabled
      : $theme.colors.sliderHandleInnerFill,
  };
});
InnerThumb.displayName = 'StyledInnerThumb';

/** Base's float-the-value-on-drag, kept exactly as Base draws it. ROCOTO: it floats the two
 *  quantities the boundary is between, because the pair is the whole point — the number that
 *  grows and the number that shrinks, read together while the hand is still on the control. */
export const ThumbValue = styled<'div', StyleProps>('div', (props) => {
  const { $disabled, $theme } = props;
  return {
    position: 'absolute',
    top: `-${$theme.sizing.scale1400}`,
    ...$theme.typography.font200,
    backgroundColor: $disabled
      ? $theme.colors.sliderHandleFillDisabled
      : $theme.colors.sliderHandleInnerFill,
    color: $theme.colors.contentInversePrimary,
    paddingLeft: $theme.sizing.scale600,
    paddingRight: $theme.sizing.scale600,
    paddingTop: $theme.sizing.scale300,
    paddingBottom: $theme.sizing.scale300,
    borderBottomLeftRadius: $theme.borders.radius300,
    borderBottomRightRadius: $theme.borders.radius300,
    borderTopLeftRadius: $theme.borders.radius300,
    borderTopRightRadius: $theme.borders.radius300,
    whiteSpace: 'nowrap',
  };
});
ThumbValue.displayName = 'StyledThumbValue';

/* ── ROCOTO: THE LEGEND ───────────────────────────────────────────────────────────────────────
 * A range needs two ticks; a division needs to say what each part IS. The names go under the bar
 * rather than inside it, because a name inside a segment disappears the moment the segment is
 * dragged small — and the parts a person drags smallest are exactly the ones they are looking at.
 */

export const Legend = styled<'div', StyleProps>('div', (props) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: props.$theme.sizing.scale600,
  paddingTop: props.$theme.sizing.scale200,
}));
Legend.displayName = 'StyledLegend';

export const LegendItem = styled<'div', StyleProps>('div', (props) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: props.$theme.sizing.scale300,
  minWidth: 0,
}));
LegendItem.displayName = 'StyledLegendItem';

export const LegendMark = styled<'span', StyleProps>('span', (props) => {
  const { $theme, $partIndex = 0, $disabled } = props;
  return {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    flex: '0 0 auto',
    borderTopLeftRadius: $theme.borders.radius100,
    borderTopRightRadius: $theme.borders.radius100,
    borderBottomLeftRadius: $theme.borders.radius100,
    borderBottomRightRadius: $theme.borders.radius100,
    backgroundColor: band($theme, $partIndex, $disabled),
  };
});
LegendMark.displayName = 'StyledLegendMark';

/* ── ROCOTO: THE INVARIANT, in arithmetic ─────────────────────────────────────────────────────
 * The two functions below are the whole reason this fork exists, and they are eight lines. Parts
 * are never stored: they are the differences between the boundaries, so a sum that drifts is not
 * possible to express. Everything else in this file is paint.
 */

/** parts → the cumulative boundaries the range control drags */
export const boundaries = (value: number[]): number[] => {
  const out: number[] = [];
  let running = 0;
  for (let i = 0; i < value.length - 1; i += 1) {
    running += value[i];
    out.push(running);
  }
  return out;
};

/** the boundaries → parts. The last part takes whatever is left, so the sum IS the total. */
export const parts = (bounds: number[], total: number): number[] => {
  const out: number[] = [];
  let previous = 0;
  for (const b of bounds) {
    out.push(b - previous);
    previous = b;
  }
  out.push(total - previous);
  return out;
};
