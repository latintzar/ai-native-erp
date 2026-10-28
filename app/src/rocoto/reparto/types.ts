/* FORKED from Base Web `src/slider/types.ts` (v16.1.1) on 2026-08-22.
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
import type { Override } from 'baseui/helpers/overrides';
import type { STATE_CHANGE_TYPE } from './constants';

import type { ReactNode } from 'react';

export type ChangeAction = keyof typeof STATE_CHANGE_TYPE;

/** ROCOTO: the parameter object carries the PARTS, never the boundaries. A caller of this control
 *  is dividing a quantity and wants the quantities back; where the handles happen to sit is the
 *  control's own business. */
export type Params = {
  /** one quantity per part, in the order the parts stand. Sums to `total`, always. */
  value: Array<number>;
};

export type RepartoOverrides = {
  Root?: Override;
  Track?: Override;
  InnerTrack?: Override;
  Tick?: Override;
  TickBar?: Override;
  Thumb?: Override;
  InnerThumb?: Override;
  ThumbValue?: Override;
  Mark?: Override;
  /** ROCOTO: the row of names under the bar, one per part */
  Legend?: Override;
  /** ROCOTO: one part's name and quantity */
  LegendItem?: Override;
  /** ROCOTO: the ink block that shows which part of the bar a legend entry names */
  LegendMark?: Override;
};

export type RepartoProps = {
  /** ROCOTO: THE INVARIANT. The quantity being divided. The parts always sum to exactly this,
   *  because the parts are DERIVED from the boundaries rather than stored beside them. */
  total: number;
  /** ROCOTO: one quantity per part, in the order the parts stand. Two parts is one boundary,
   *  three parts is two. Anything that does not sum to `total` is normalised on the way in, so a
   *  caller can never hold a division that does not add up. */
  value: Array<number>;
  /** the granularity the boundary steps through. Default 1. */
  step?: number;
  /** ROCOTO: the smallest a part may be dragged to. A part at 0 is a part that should be removed
   *  rather than emptied, so the floor stops the control short of a lie. */
  minPart?: number;
  overrides?: RepartoOverrides;
  /** Disable control from being changed. */
  disabled?: boolean;
  /** Display a mark at each step. */
  marks?: boolean;
  /** Always display the selected value/thumb/label. */
  persistentThumb?: boolean;
  /** Function to change the numeric value to a user friendly value. Also applied to the ticks. */
  valueToLabel?: (value: number) => ReactNode;
  /** ROCOTO: what each part is called — the lote it belongs to. Drawn under the bar, never on it:
   *  a name inside a segment vanishes the moment the segment is dragged small. */
  labels?: Array<ReactNode>;
  /** ROCOTO: a second line under a part's name — the cost that part was bought at. */
  captions?: Array<ReactNode>;
  /** Handler for events on trigger element, each time the boundary moves. */
  onChange?: (a: Params) => unknown;
  /** Handler for events on trigger element, each time the boundary finishes moving. */
  onFinalChange?: (a: Params) => unknown;
};

export type State = {
  value: Array<number>;
};

export type StyleProps = {
  $disabled?: boolean;
  $isDragged?: boolean;
  $marks?: boolean;
  $max?: number;
  $min?: number;
  $thumbIndex?: number;
  /** ROCOTO: the BOUNDARIES, cumulative, for the styled elements that paint the bar */
  $value?: Array<number>;
  /** ROCOTO: how many parts the bar is divided into */
  $parts?: number;
  /** ROCOTO: which part a legend entry names */
  $partIndex?: number;
  $isFocusVisible?: boolean;
};
