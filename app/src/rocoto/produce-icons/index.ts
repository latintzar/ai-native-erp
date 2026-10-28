/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as ProduceIcon } from './produce-icon';
// Constants
export { SIZE, SIZE_STEP, FAMILY, FORM, FORMS, DEFAULT_FORM, GRID } from './constants';
// The content palette (THE-INTELLIGENCE §7) and the brush the drawings are painted with
export { PALETTE, MONO_ALPHA, TONES, makeInk } from './palette';
export type { Tone, Depth, Ink, Paint, Stroke } from './palette';
// The registry: every drawing, and the rule that picks one
export { GENERIC, BESPOKE, BESPOKE_INDEX, resolve } from './drawings';
export type { Draw, Resolution } from './drawings';
// Styled elements
export { Root as StyledRoot, Svg as StyledSvg } from './styled-components';
// Types
export * from './types';
