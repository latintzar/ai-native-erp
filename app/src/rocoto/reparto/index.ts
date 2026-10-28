/* FORKED from Base Web `src/slider/index.ts` (v16.1.1) on 2026-08-22 — same export shape, so a
 * consumer imports el reparto exactly the way it imports a Base control.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. This file is a DERIVATIVE WORK;
 * the full licence is vendored at app/src/rocoto/LICENSE.baseweb.txt.
 */
export { default as Reparto } from './reparto';
// Constants
export { STATE_CHANGE_TYPE, GEOMETRY, WEAVE } from './constants';
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
  Legend as StyledLegend,
  LegendItem as StyledLegendItem,
  LegendMark as StyledLegendMark,
  // ROCOTO: the invariant itself, exported — a caller that needs to add or remove a part does the
  // same arithmetic the control does, rather than a second version of it.
  boundaries,
  parts,
} from './styled-components';

export * from './types';
