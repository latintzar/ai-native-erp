/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
export { default as WeightEntry } from './weight-entry';
// Constants
export { SIZE, SOURCE, CAPTURE, MARKS, MIN_SLOTS, PER_KILO, GRAM_PLACES, GROUP } from './constants';
// Styled elements
export {
  ramp,
  Root as StyledRoot,
  Label as StyledLabel,
  Field as StyledField,
  Readout as StyledReadout,
  Line as StyledLine,
  SlotRow as StyledSlotRow,
  Digit as StyledDigit,
  Comma as StyledComma,
  Place as StyledPlace,
  SlotCell as StyledSlotCell,
  Spacer as StyledSpacer,
  Chevron as StyledChevron,
  Unit as StyledUnit,
  Camera as StyledCamera,
  Viewfinder as StyledViewfinder,
  ScaleDisplay as StyledScaleDisplay,
  Scan as StyledScan,
  Attribution as StyledAttribution,
  Mark as StyledMark,
  Chip as StyledChip,
  ChipButton as StyledChipButton,
  Thumb as StyledThumb,
  Compare as StyledCompare,
  CompareRow as StyledCompareRow,
  CompareLabel as StyledCompareLabel,
  Track as StyledTrack,
  TrackFill as StyledTrackFill,
  TrackTick as StyledTrackTick,
} from './styled-components';
// Types
export * from './types';
