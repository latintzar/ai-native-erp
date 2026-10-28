/* FORKED from Base Web `src/slider/index.ts` (v16.1.1) on 2026-08-22.
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
import type { StyleProps } from './types';

export { default as Slider } from './slider';
// ROCOTO: the lock. Base's stateful containers are dropped — the SET is the stateful shape here,
// and the surface that owns the tiers owns their values.
export { default as Candado, moveLinked } from './candado';
// Styled elements
export {
  Root as StyledCandadoRoot,
  Row as StyledCandadoRow,
  Names as StyledCandadoNames,
  Control as StyledCandadoControl,
  Result as StyledCandadoResult,
} from './candado-styled';
// Styled elements
export {
  Root as StyledRoot,
  Track as StyledTrack,
  InnerTrack as StyledInnerTrack,
  Thumb as StyledThumb,
  InnerThumb as StyledInnerThumb,
  Tick as StyledTick,
  TickBar as StyledTickBar,
  ThumbValue as StyledThumbValue,
  Mark as StyledMark,
} from './styled-components';

export * from './types';
/** @deprecated use StyleProps instead. To be removed in future versions.*/
export type SharedProps = StyleProps;
