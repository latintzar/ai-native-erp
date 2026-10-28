/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
export { default as SignaturePad } from './signature-pad';
// Constants
export {
  SIZE,
  STATE,
  GEOMETRY,
  BASELINE,
  LABEL,
  MIN_NAME,
  MIN_TRAVEL,
  MIN_SAMPLE_DISTANCE,
  PRESSURE_SAMPLED,
  REPLAY_MIN_MS,
  REPLAY_MAX_MS,
  SEED_POINTS,
} from './constants';
// Utilities — the smoothing, the placement, and a signature that is the same one every time
export {
  boundsOf,
  buildValue,
  clamp,
  durationOf,
  fitBox,
  fitMark,
  inkWidthFor,
  isEmptyValue,
  isNewSample,
  paintStrokes,
  pathFromStrokes,
  rescaleStrokes,
  signatureFromSeed,
  strokeSegments,
  travelOf,
  truncateStrokes,
} from './utils';
export type { Box, Segment } from './utils';
// Styled elements
export {
  Root as StyledRoot,
  Label as StyledLabel,
  Pad as StyledPad,
  Canvas as StyledCanvas,
  Mark as StyledMark,
  Ink as StyledInk,
  TypedMark as StyledTypedMark,
  Baseline as StyledBaseline,
  Cross as StyledCross,
  Prompt as StyledPrompt,
  Actions as StyledActions,
  Caption as StyledCaption,
  Fallback as StyledFallback,
  ramp,
} from './styled-components';
// Types
export * from './types';
