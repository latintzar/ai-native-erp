/* FORKED from Base Web `src/slider/slider.tsx` (v16.1.1) on 2026-08-22.
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
import * as React from 'react';
import { Range } from 'react-range';
import type { SliderProps } from './types';
import { isFocusVisible as focusVisible, forkFocus, forkBlur } from 'baseui/utils/focusVisible';
import {
  Root as StyledRoot,
  Track as StyledTrack,
  InnerTrack as StyledInnerTrack,
  Tick as StyledTick,
  TickBar as StyledTickBar,
  Thumb as StyledThumb,
  InnerThumb as StyledInnerThumb,
  ThumbValue as StyledThumbValue,
  Mark as StyledMark,
} from './styled-components';
import { getOverrides } from 'baseui/helpers/overrides';
import { ThemeContext } from 'baseui/styles/theme-provider';

import type { SyntheticEvent } from 'react';

// ROCOTO: the two-thumb ceiling comes off. Base throws above two thumbs because its design has
// no third one; el candado's subject is a SET of related values, so the set is the point. The
// only real requirement is that a slider has at least one thumb, and that stays enforced.
const limitValue = (value: number[]) => {
  if (value.length === 0) {
    throw new Error('the value prop represents positions of thumbs, so it needs at least one');
  }
  return value;
};

/** ROCOTO: which thumb moved. react-range hands back the whole array; the lock needs the hand. */
const movedIndex = (before: number[], after: number[]): number => {
  for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) return i;
  return 0;
};

function Slider({
  overrides = {},
  disabled = false,
  marks = false,
  onChange = () => {},
  onFinalChange = () => {},
  min = 0,
  max = 100,
  step = 1,
  persistentThumb = false,
  valueToLabel = (label) => label,
  value: providedValue,
}: SliderProps) {
  const theme = React.useContext(ThemeContext);

  // ROCOTO: `isHovered0` / `isHovered1` become one set, for the same reason the ceiling came off.
  const [hovered, setHovered] = React.useState<number[]>([]);
  const hover = (index: number, on: boolean) =>
    setHovered((prev) => (on ? [...prev, index] : prev.filter((i) => i !== index)));

  const [isFocusVisible, setIsFocusVisible] = React.useState(false);
  const [focusedThumbIndex, setFocusedThumbIndex] = React.useState(-1);
  const handleFocus = React.useCallback((event: SyntheticEvent) => {
    if (focusVisible(event)) {
      setIsFocusVisible(true);
    }
    // ROCOTO: Base reads «first child or not» because there are only ever two thumbs. With N
    // thumbs the index is the thumb's real position among its siblings.
    const node = event.target as unknown as Element;
    const siblings = node.parentNode ? Array.from(node.parentNode.children) : [];
    setFocusedThumbIndex(Math.max(0, siblings.indexOf(node)));
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBlur = React.useCallback((event: SyntheticEvent) => {
    if (isFocusVisible !== false) {
      setIsFocusVisible(false);
    }
    setFocusedThumbIndex(-1);
  }, []);

  const value = limitValue(providedValue);
  const sharedProps = {
    $disabled: disabled,
    $step: step,
    $min: min,
    $max: max,
    $marks: marks,
    $value: value,
    $isFocusVisible: isFocusVisible,
  };

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Track, trackProps] = getOverrides(overrides.Track, StyledTrack);
  const [InnerTrack, innerTrackProps] = getOverrides(overrides.InnerTrack, StyledInnerTrack);
  const [Thumb, thumbProps] = getOverrides(overrides.Thumb, StyledThumb);
  const [InnerThumb, innerThumbProps] = getOverrides(overrides.InnerThumb, StyledInnerThumb);
  const [ThumbValue, thumbValueProps] = getOverrides(overrides.ThumbValue, StyledThumbValue);
  const [Tick, tickProps] = getOverrides(overrides.Tick, StyledTick);
  const [TickBar, tickBarProps] = getOverrides(overrides.TickBar, StyledTickBar);
  const [Mark, markProps] = getOverrides(overrides.Mark, StyledMark);

  return (
    <Root
      data-baseweb="slider"
      {...sharedProps}
      {...rootProps}
      onFocus={forkFocus(rootProps, handleFocus)}
      onBlur={forkBlur(rootProps, handleBlur)}
    >
      <Range
        step={step}
        min={min}
        max={max}
        values={value}
        disabled={disabled}
        // ROCOTO: the change carries the thumb that moved. A lock has to know which hand pulled
        // before it can move the others, and Base's `{ value }` alone does not say.
        onChange={(next) => onChange({ value: next, index: movedIndex(value, next) })}
        onFinalChange={(next) => onFinalChange({ value: next, index: movedIndex(value, next) })}
        rtl={theme.direction === 'rtl'}
        renderTrack={({ props, children, isDragged }) => (
          <Track
            onMouseDown={props.onMouseDown}
            onTouchStart={props.onTouchStart}
            $isDragged={isDragged}
            {...sharedProps}
            {...trackProps}
          >
            <InnerTrack
              $isDragged={isDragged}
              ref={props.ref}
              {...sharedProps}
              {...innerTrackProps}
            >
              {children}
            </InnerTrack>
          </Track>
        )}
        renderThumb={({ props, index, isDragged }) => {
          const displayLabel = persistentThumb
            ? persistentThumb
            : (hovered.includes(index) || isDragged) && !disabled;
          return (
            <Thumb
              {...props}
              onMouseEnter={() => hover(index, true)}
              onMouseLeave={() => hover(index, false)}
              $thumbIndex={index}
              $isDragged={isDragged}
              style={{
                ...props.style,
                zIndex: 'unset',
              }}
              {...sharedProps}
              {...thumbProps}
              $isFocusVisible={isFocusVisible && focusedThumbIndex === index}
            >
              {displayLabel && (
                <ThumbValue
                  $thumbIndex={index}
                  $isDragged={isDragged}
                  {...sharedProps}
                  {...thumbValueProps}
                >
                  {valueToLabel(value[index])}
                </ThumbValue>
              )}
              {displayLabel && (
                <InnerThumb
                  $thumbIndex={index}
                  $isDragged={isDragged}
                  {...sharedProps}
                  {...innerThumbProps}
                />
              )}
            </Thumb>
          );
        }}
        {...(marks
          ? {
              // eslint-disable-next-line react/display-name
              renderMark: ({ props, index }) => (
                <Mark $markIndex={index} {...props} {...sharedProps} {...markProps} />
              ),
            }
          : {})}
      />

      <TickBar {...sharedProps} {...tickBarProps}>
        <Tick {...sharedProps} {...tickProps}>
          {valueToLabel(min)}
        </Tick>

        <Tick {...sharedProps} {...tickProps}>
          {valueToLabel(max)}
        </Tick>
      </TickBar>
    </Root>
  );
}

export default Slider;
