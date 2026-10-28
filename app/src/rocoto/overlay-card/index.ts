/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as OverlayCard } from './overlay-card';
// Constants
export {
  PLACEMENT,
  SIZE,
  SIZE_WIDTHS,
  SCRIM,
  PHASE,
  CLOSE_SOURCE,
  ROLE,
  EXIT_DELAY_MS,
} from './constants';
// Styled elements
export {
  Root as StyledRoot,
  Scrim as StyledScrim,
  Card as StyledCard,
} from './styled-components';
// Types
export * from './types';
