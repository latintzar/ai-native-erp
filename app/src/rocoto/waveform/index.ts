/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
export { default as Waveform } from './waveform';
// Constants
export { MODE, SIZE, GEOMETRY, NOISE_GATE, POLL_MS, SEED_PEAKS, STEP_MS, LABEL } from './constants';
// Utilities — deterministic, so a field can be drawn the same way twice
export {
  peaksFromSeed,
  createSimulatedAmplitude,
  barHeight,
  resample,
  clamp,
  formatMs,
} from './utils';
// The one playback glyph Base does not ship — the play mark is Base's own `TriangleRight`
export { Pause } from './icons';
// Styled elements
export {
  Root as StyledRoot,
  Field as StyledField,
  Bar as StyledBar,
  Time as StyledTime,
} from './styled-components';
// Types
export * from './types';
