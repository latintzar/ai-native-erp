/* GROWN from Base Web's own `src/template-component/types.ts` — same prop idiom, same overrides
 * contract, same `$`-prefixed shared style props. Base Web is MIT, Copyright (c) Uber
 * Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, SOURCE, CAPTURE, MARKS } from './constants';

export type Size = keyof typeof SIZE;
export type Source = keyof typeof SOURCE;
export type Capture = keyof typeof CAPTURE;
export type Marks = keyof typeof MARKS;

/** what leaves the component on every change */
export type WeightValue = {
  /** the whole truth, in grams — no fraction ever exists */
  grams: number;
  /** the same number in the unit the field displays */
  kilos: number;
  /** where this number came from */
  source: Source;
};

export type WeightEntryOverrides = {
  Root?: Override;
  /** the field itself: the readout, its marks and the camera */
  Field?: Override;
  /** the number's frame — fixed width, right-anchored, so digits move and the unit does not */
  Readout?: Override;
  /** one digit slot */
  Digit?: Override;
  /** the unit, on the number's own line */
  Unit?: Override;
  /** one increment mark, above or below its own digit */
  Chevron?: Override;
  /** the camera */
  Camera?: Override;
  /** one row of the readout: its slots and its unit cell */
  Line?: Override;
  /** what the number came from, said out loud */
  Attribution?: Override;
  /** ordered against given */
  Compare?: Override;
};

export type WeightEntryProps = {
  /** the weight, in the display unit (kilos). Controlled when present. */
  value?: number;
  /** the weight the field starts at, in the display unit */
  defaultValue?: number;
  /** fires on every digit, every step, and every arrival from the camera */
  onChange?: (next: WeightValue) => void;
  /** fires when the person is done: Enter, or the focus leaving the field */
  onCommit?: (next: WeightValue) => void;
  /** what was ordered, in the display unit. Present = the comparison row is drawn. */
  ordered?: number;
  /** the label above the field */
  label?: string;
  /** «kg» — shares the number's line, never a line of its own */
  unit?: string;
  size?: Size;
  /** the increment marks over and under each digit place: drawn for touch, quiet on a desk */
  marks?: Marks;
  /** show the camera beside the field */
  camera?: boolean;
  /** what the demo scale's display reads, in the display unit */
  scaleReading?: number;
  /** the camera moment the field OPENS on; it stays live from there */
  capture?: Capture;
  /** the attribution the field OPENS with; the first keystroke or step moves it on */
  source?: Source;
  /** how many digits the readout can hold — 6 is 999,999 g */
  maxDigits?: number;
  disabled?: boolean;
  /** a finished line: the number stands, and nothing here will take a keystroke */
  readOnly?: boolean;
  /** say where the number came from, under the field */
  attribution?: boolean;
  /** BCP 47 tag for the decimal comma and the grouping */
  locale?: string;
  overrides?: WeightEntryOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $disabled: boolean;
  $readOnly: boolean;
};

export type DigitStyleProps = SharedStyleProps & {
  /** the marks are off, so the number tightens to its own tracking */
  $tight: boolean;
  /** a leading zero the person did not type */
  $pad: boolean;
  /** a gram digit — subordinate to the kilos, the way cents are subordinate to units */
  $sub: boolean;
};

export type SlotRowStyleProps = SharedStyleProps & {
  /** how many digit columns the frame holds; the frame never resizes, so the digits do the moving */
  $slots: number;
  /** how many separator columns the frame holds — the kilo comma, and any grouping marks */
  $seps: number;
  /** the marks are off, so the frame hugs the number instead of holding a grid */
  $tight: boolean;
};

export type UnitStyleProps = SharedStyleProps & {
  /** measured but invisible — it holds the column open on the rows that are not the number's */
  $ghost: boolean;
};

export type ChevronStyleProps = SharedStyleProps & {
  /** this place is the one the arrow keys are driving */
  $active: boolean;
  /** the mark is being held down and repeating */
  $held: boolean;
  /** a desk with no hand on the field: the mark is there, and it waits to be wanted */
  $quiet: boolean;
};

/** the rule under the digit place the keyboard is driving — the odometer's own window */
export type PlaceStyleProps = SharedStyleProps & {
  /** columns of digits to the left of the active place */
  $before: number;
  /** separator columns to the left of the active place */
  $sepsBefore: number;
};
