/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as Figure, format, splitFigure } from './figure';
// Constants
export { SIZE, DECIMAL_SCALE } from './constants';
// Styled elements
export {
  Root as StyledRoot,
  Was as StyledWas,
  Value as StyledValue,
  Integer as StyledInteger,
  Fraction as StyledFraction,
  Unit as StyledUnit,
  ramp,
  DECIMAL_RATIO,
} from './styled-components';
// Types
export * from './types';
