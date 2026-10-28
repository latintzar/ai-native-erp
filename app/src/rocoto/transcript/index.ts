/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as Transcript, clock, currentUtterance } from './transcript';
// Constants
export { SIZE, HOUSING } from './constants';
// Styled elements
export {
  Root as StyledRoot,
  Media as StyledMedia,
  Meta as StyledMeta,
  Duration as StyledDuration,
  Mark as StyledMark,
  List as StyledList,
  Utterance as StyledUtterance,
  Time as StyledTime,
  Body as StyledBody,
  Speaker as StyledSpeaker,
  Words as StyledWords,
  Gap as StyledGap,
  Action as StyledAction,
  SkeletonRow as StyledSkeletonRow,
  ramp,
} from './styled-components';
// Types
export * from './types';
