/* FORKED from Base Web `src/slider/styled-components.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: C4 moves every price tier at once and the spread between the tiers must hold. Base's Slider moves one value; el candado is a SET of Base sliders under one lock — drag any one and every other moves with it, holding the invariant. Releasing the lock unlinks them and one tier moves alone. Base's own track, thumb, thumb-value, focus ring and keyboard handling are kept exactly as Base built them.
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
import type { StyleProps } from './types';

export const Root = styled('div', { position: 'relative', width: '100%' });
Root.displayName = 'Root';
Root.displayName = 'StyledRoot';

export const Track = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $value = [], $disabled, $isDragged } = props;
  const { sizing } = $theme;
  let cursor = 'inherit';
  if ($disabled) {
    cursor = 'not-allowed';
  } else if ($isDragged) {
    cursor = 'grabbing';
  } else if ($value.length === 1) {
    cursor = 'pointer';
  }
  return {
    paddingTop: sizing.scale600,
    paddingBottom: sizing.scale600,
    paddingRight: sizing.scale600,
    paddingLeft: sizing.scale600,
    display: 'flex',
    cursor,
    backgroundColor: $theme.colors.sliderTrackFill,
  };
});
Track.displayName = 'Track';
Track.displayName = 'StyledTrack';

/** ROCOTO: the track's bands, for any number of thumbs. `filled` reads as chosen, `empty` as the
 *  ground behind it, and both come from the theme so the lock re-brands with everything else. */
const trackBands = (
  thumbs: number,
  colors: { borderSelected: string; borderOpaque: string; borderStateDisabled: string },
  disabled?: boolean,
): string[] => {
  const filled = disabled ? colors.borderOpaque : colors.borderSelected;
  const empty = disabled ? colors.borderStateDisabled : colors.borderOpaque;
  if (thumbs === 1) return [filled, empty];
  return Array.from({ length: thumbs + 1 }, (_, i) => (i === 0 || i === thumbs ? empty : filled));
};

export const InnerTrack = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $value = [], $min, $max, $disabled } = props;
  const { colors, borders, direction } = $theme;
  const borderRadius = $theme.borders.useRoundedCorners ? borders.radius100 : 0;
  return {
    borderTopLeftRadius: borderRadius,
    borderTopRightRadius: borderRadius,
    borderBottomRightRadius: borderRadius,
    borderBottomLeftRadius: borderRadius,
    /* ROCOTO: N thumbs need N+1 bands, and Base writes the one- and two-thumb cases by hand.
       The rule underneath both is the same one, so it is written once: with a single thumb the
       filled band leads, and with more the fill is what lies BETWEEN the thumbs. */
    background: getTrackBackground({
      values: $value,
      colors: trackBands($value.length, colors, $disabled),
      min: $min || 0,
      max: $max || 0,
      rtl: direction === 'rtl',
    }),
    height: '2px',
    width: '100%',
    alignSelf: 'center',
    cursor: $disabled ? 'not-allowed' : 'inherit',
  };
});
InnerTrack.displayName = 'InnerTrack';
InnerTrack.displayName = 'StyledInnerTrack';

export const Mark = styled<'div', StyleProps>('div', (props) => {
  return {
    width: '4px',
    height: '2px',
    backgroundColor: props.$theme.colors.backgroundPrimary,
    marginLeft: '16px',
  };
});
Mark.displayName = 'Mark';
Mark.displayName = 'StyledMark';

export const Tick = styled<'div', StyleProps>('div', (props) => {
  return {
    ...props.$theme.typography.font200,
    color: props.$theme.colors.contentPrimary,
  };
});
Tick.displayName = 'Tick';
Tick.displayName = 'StyledTick';

export const TickBar = styled<'div', StyleProps>('div', (props) => {
  const { $theme } = props;
  const { sizing } = $theme;
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: sizing.scale600,
    paddingLeft: sizing.scale600,
    paddingBottom: sizing.scale400,
  };
});
TickBar.displayName = 'TickBar';
TickBar.displayName = 'StyledTickBar';

export const Thumb = styled<'div', StyleProps>('div', (props) => {
  const { $theme, $value = [], $thumbIndex, $disabled } = props;
  let isLeft = $value.length === 2 && $thumbIndex === 0;
  let isRight = $value.length === 2 && $thumbIndex === 1;

  if ($theme.direction === 'rtl' && (isRight || isLeft)) {
    isLeft = !isLeft;
    isRight = !isRight;
  }

  return {
    height: '24px',
    width: '24px',
    borderTopLeftRadius: '24px',
    borderTopRightRadius: '24px',
    borderBottomLeftRadius: '24px',
    borderBottomRightRadius: '24px',
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
    cursor: $disabled ? 'not-allowed' : 'inherit',
  };
});
Thumb.displayName = 'Thumb';
Thumb.displayName = 'StyledThumb';

export const InnerThumb = styled<'div', StyleProps>('div', (props) => {
  const { $disabled, $theme } = props;
  return {
    position: 'absolute',
    top: '-16px',
    width: '4px',
    height: '20px',
    backgroundColor: $disabled
      ? $theme.colors.sliderHandleFillDisabled
      : $theme.colors.sliderHandleInnerFill,
  };
});
InnerThumb.displayName = 'InnerThumb';
InnerThumb.displayName = 'StyledInnerThumb';

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
    paddingTop: $theme.sizing.scale500,
    paddingBottom: $theme.sizing.scale500,
    borderBottomLeftRadius: '48px',
    borderBottomRightRadius: '48px',
    borderTopLeftRadius: '48px',
    borderTopRightRadius: '48px',
    whiteSpace: 'nowrap',
  };
});
ThumbValue.displayName = 'ThumbValue';
ThumbValue.displayName = 'StyledThumbValue';
