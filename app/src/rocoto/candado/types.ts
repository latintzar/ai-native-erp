/* FORKED from Base Web `src/slider/types.ts` (v16.1.1) on 2026-08-22.
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
import type { Override } from 'baseui/helpers/overrides';
import type { STATE_CHANGE_TYPE } from './constants';

import type * as React from 'react';
import type { ReactNode } from 'react';

export type ChangeAction = keyof typeof STATE_CHANGE_TYPE;
export type Params = {
  value: Array<number>;
  /** ROCOTO: which thumb moved. The lock moves the others from it. */
  index?: number;
};

/** ROCOTO: what a set of linked values holds while one of them is dragged.
 *  · `spread` — every value moves by the same amount, so the DISTANCE between them is kept.
 *  · `ratio`  — every value scales by the same factor, so the PROPORTION between them is kept. */
export type Link = 'spread' | 'ratio';
export type SliderOverrides = {
  Root?: Override;
  Track?: Override;
  InnerTrack?: Override;
  Tick?: Override;
  TickBar?: Override;
  Thumb?: Override;
  InnerThumb?: Override;
  ThumbValue?: Override;
  Mark?: Override;
};

export type SliderProps = {
  /** Position of the thumbs. ROCOTO: any number of them — a set of linked values is the point. */
  value: Array<number>;
  /** The minimum allowed value of the slider. Should not be bigger than max. */
  min?: number;
  /** The maximum allowed value of the slider. Should not be smaller than min. */
  max?: number;
  /** The granularity the slider can step through value. Default step is 1. */
  step?: number;
  overrides?: SliderOverrides;
  /** Disable control from being changed. */
  disabled?: boolean;
  /** Display a mark at each step. */
  marks?: boolean;
  /** Always display the selected value/thumb/label. */
  persistentThumb?: boolean;
  /** Function to change the numeric value to a user friendly value. Also applied to min/max labels. */
  valueToLabel?: (value: number) => ReactNode;
  /** Handler for events on trigger element, each time thumbs change selection, which is passed in `value`. */
  onChange?: (a: Params) => unknown;
  /** Handler for events on trigger element, each time thumbs finish changing selection, which is passed in `value`. */
  onFinalChange?: (a: Params) => unknown;
};

export type State = {
  value: Array<number>;
};

export type StateReducer = (stateType: string, nextState: State, currentState: State) => State;

export type StatefulContainerProps = {
  overrides?: SliderOverrides;
  children: (a: SliderProps) => ReactNode;
  min: number;
  max: number;
  step: number;
  /** Initial state populated into the component */
  initialState?: State;
  /** Reducer function to manipulate internal state updates. */
  stateReducer: StateReducer;
  /** Handler for events on trigger element, each time thumbs change selection, which is passed in `value`. */
  onChange: (a: {} & Params) => unknown;
  /** Handler for events on trigger element, each time thumbs finish changing selection, which is passed in `value`. */
  onFinalChange: (a: {} & Params) => unknown;
};

export type StatefulSliderProps = {
  /** Initial state populated into the component */
  initialState?: State;
} & Omit<SliderProps, 'value'>;

export type StyleProps = {
  $disabled?: boolean;
  $isDragged?: boolean;
  $marks?: boolean;
  $max?: number;
  $min?: number;
  $thumbIndex?: number;
  $value?: Array<number>;
  $isFocusVisible?: boolean;
};

/* ── EL CANDADO ────────────────────────────────────────────────────────────────────────────
 * The lock itself: a set of Base sliders that move together while it holds. */

export type CandadoRow = {
  /** what this value belongs to — a tier, a grade, a band */
  id: string;
  /** the row's name, drawn beside its slider */
  name: React.ReactNode;
  /** what stands under the name — «34 customers» */
  note?: React.ReactNode;
  /** what this value produces — the price the margin makes. Drawn at the tail of the row. */
  result?: React.ReactNode;
};

export type CandadoOverrides = {
  /** the whole set */
  Root?: Override;
  /** one row: its name, its slider, its result */
  Row?: Override;
  /** the name and its note */
  Names?: Override;
  /** the slider's cell in the row */
  Control?: Override;
  /** the result at the tail */
  Result?: Override;
  /** every slider's own overrides, passed through untouched */
  Slider?: SliderOverrides;
};

export type CandadoProps = {
  rows: CandadoRow[];
  /** one value per row, in the rows' own order */
  value: Array<number>;
  onChange: (value: Array<number>) => void;
  /** the lock. While it holds, dragging any row moves every row. */
  locked?: boolean;
  /** what the lock keeps while it holds */
  link?: Link;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** the label floated on the thumb while it is dragged */
  valueToLabel?: (value: number) => React.ReactNode;
  overrides?: CandadoOverrides;
};
