/* FORKED from Base Web `src/slider/slider.tsx` (v16.1.1) on 2026-08-22.
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
 *
 * ── WHAT CHANGED, IN ONE PARAGRAPH ───────────────────────────────────────────────────────────
 * Base's `limitValue` throws above two thumbs, and its whole model is «where do the handles sit».
 * Rocoto's model is «how much is in each part», and the handles are derived from that — so the
 * public value is an ARRAY OF QUANTITIES that sums to `total`, the control converts it to
 * boundaries on the way in and back to quantities on the way out, and a division that does not
 * add up cannot be expressed. `U04`'s law — «it is not possible to create or lose units by
 * dragging» — is therefore true by construction rather than by validation.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import * as React from 'react';
import { Range } from 'react-range';
import type { RepartoProps } from './types';
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
  Legend as StyledLegend,
  LegendItem as StyledLegendItem,
  LegendMark as StyledLegendMark,
  boundaries,
  parts,
} from './styled-components';
import { getOverrides } from 'baseui/helpers/overrides';
import { ThemeContext } from 'baseui/styles/theme-provider';

import type { SyntheticEvent } from 'react';

/* ROCOTO: replaces Base's `limitValue`, which throws above two thumbs. Where Base refuses a third
 * handle, this normalises a division: at least two parts, none of them negative, and the last one
 * absorbing the rounding so the sum is exactly the total. It cannot throw, because a division that
 * does not add up is a caller's arithmetic slip and the honest answer is to hold the total. */
const settle = (value: number[], total: number): number[] => {
  const clean = value.filter((v) => Number.isFinite(v)).map((v) => Math.max(0, v));
  if (clean.length < 2) return [total];
  const head = clean.slice(0, -1);
  const used = head.reduce((s, v) => s + v, 0);
  return [...head, Math.max(0, total - used)];
};

function Reparto({
  overrides = {},
  disabled = false,
  marks = false,
  onChange = () => {},
  onFinalChange = () => {},
  total,
  step = 1,
  minPart = 0,
  persistentThumb = false,
  valueToLabel = (label) => label,
  labels = [],
  captions = [],
  value: providedValue,
}: RepartoProps) {
  const theme = React.useContext(ThemeContext);

  /* ROCOTO: Base keeps two hover flags because it has two thumbs. A division has as many
     boundaries as it has parts minus one, so the hovered boundary is an index. */
  const [hovered, setHovered] = React.useState(-1);

  const [isFocusVisible, setIsFocusVisible] = React.useState(false);
  const [focusedThumbIndex, setFocusedThumbIndex] = React.useState(-1);
  const handleFocus = React.useCallback((event: SyntheticEvent) => {
    if (focusVisible(event)) {
      setIsFocusVisible(true);
    }
    const node = event.target as HTMLElement;
    const siblings = node.parentNode ? Array.from(node.parentNode.children) : [];
    setFocusedThumbIndex(siblings.indexOf(node));
  }, []);
  const handleBlur = React.useCallback(() => {
    setIsFocusVisible(false);
    setFocusedThumbIndex(-1);
  }, []);

  const quantities = settle(providedValue, total);
  const bounds = boundaries(quantities);

  const sharedProps = {
    $disabled: disabled,
    $step: step,
    $min: 0,
    $max: total,
    $marks: marks,
    $value: bounds,
    $parts: quantities.length,
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
  const [Legend, legendProps] = getOverrides(overrides.Legend, StyledLegend);
  const [LegendItem, legendItemProps] = getOverrides(overrides.LegendItem, StyledLegendItem);
  const [LegendMark, legendMarkProps] = getOverrides(overrides.LegendMark, StyledLegendMark);

  /* ROCOTO: the floor. Base clamps a range's thumbs against each other and against min/max; a
     division clamps each boundary against its neighbours PLUS the smallest a part may become, so
     a drag can never empty a part into a zero that reads as «this lote supplies nothing». */
  const clamp = (next: number[]): number[] => {
    const held = [...next];
    for (let i = 0; i < held.length; i += 1) {
      const floor = (i === 0 ? 0 : held[i - 1]) + minPart;
      if (held[i] < floor) held[i] = floor;
    }
    for (let i = held.length - 1; i >= 0; i -= 1) {
      const ceiling = (i === held.length - 1 ? total : held[i + 1]) - minPart;
      if (held[i] > ceiling) held[i] = ceiling;
    }
    return held;
  };

  const emit = (next: number[], fn: (a: { value: number[] }) => unknown) =>
    fn({ value: parts(clamp(next), total) });

  return (
    <Root
      data-baseweb="reparto"
      {...sharedProps}
      {...rootProps}
      onFocus={forkFocus(rootProps, handleFocus)}
      onBlur={forkBlur(rootProps, handleBlur)}
    >
      <Range
        step={step}
        min={0}
        max={total}
        values={bounds}
        disabled={disabled}
        onChange={(next) => emit(next, onChange)}
        onFinalChange={(next) => emit(next, onFinalChange)}
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
            : (hovered === index || isDragged) && !disabled;
          return (
            <Thumb
              {...props}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(-1)}
              $thumbIndex={index}
              $isDragged={isDragged}
              style={{ ...props.style, zIndex: 'unset' }}
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
                  {/* ROCOTO: Base floats ONE number — where this thumb is. A boundary is between
                      two quantities, and the pair is the subject: one grows exactly as much as
                      the other shrinks, and reading them together is how a person sees that
                      nothing was created or lost. */}
                  {valueToLabel(quantities[index])} · {valueToLabel(quantities[index + 1])}
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
                <Mark $thumbIndex={index} {...props} {...sharedProps} {...markProps} />
              ),
            }
          : {})}
      />

      {/* ROCOTO: the legend replaces Base's two ticks. A range's ends are its min and its max; a
          division's ends are meaningless and its PARTS are the content, so the row under the bar
          names them. */}
      <Legend {...sharedProps} {...legendProps}>
        {quantities.map((q, i) => (
          <LegendItem key={i} $partIndex={i} {...sharedProps} {...legendItemProps}>
            <LegendMark $partIndex={i} {...sharedProps} {...legendMarkProps} />
            <span>
              {labels[i]}
              {captions[i] ? <> · {captions[i]}</> : null}
            </span>
            <strong>{valueToLabel(q)}</strong>
          </LegendItem>
        ))}
      </Legend>

      {/* the total, standing under its own division. It is the one number on this control that
          never moves, which is the control's entire argument. */}
      <TickBar {...sharedProps} {...tickBarProps}>
        <Tick {...sharedProps} {...tickProps}>
          {valueToLabel(total)}
        </Tick>
      </TickBar>
    </Root>
  );
}

export default Reparto;
