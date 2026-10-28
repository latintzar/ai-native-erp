/* GROWN from Base Web's own `src/template-component/` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base has no weight entry — and the trade's weight is
 * not a number typed into an input, it is a number that arrives three different ways.
 */

export const SIZE = {
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** where the number standing in the field came from. The field says this out loud, always. */
export const SOURCE = {
  /** nothing has been entered */
  empty: 'empty',
  /** typed, timer-method */
  typed: 'typed',
  /** stepped on the digit's own marks */
  stepped: 'stepped',
  /** read off a photograph of the scale's display — the AI's own act */
  photo: 'photo',
  /** read off the photo, then corrected by hand */
  adjusted: 'adjusted',
} as const;

/** the camera's four moments */
export const CAPTURE = {
  closed: 'closed',
  viewfinder: 'viewfinder',
  reading: 'reading',
  taken: 'taken',
} as const;

/* ── THE MARKS (FEED-IA §16) ──────────────────────────────────────────────────────────────────
 * «The increment affordance sits ABOVE and BELOW the digit place it changes — odometer grammar:
 * tap over the hundreds-of-grams digits to add, under them to subtract. The digit place IS the
 * label.» So a mark belongs to a column of the number, and there is no ladder anywhere.
 *
 * «Desk is keyboard-first.» A hand on a keyboard types the number and steps it with the arrows, so
 * on a fine pointer the marks stay out of the way until the field is under the hand.
 */
export const MARKS = {
  /** drawn for a coarse pointer; quiet on a desk until the field is hovered or focused */
  auto: 'auto',
  /** always drawn — the touch surface, and the kit page that has to show it */
  on: 'on',
  /** none: the number alone, for a finished line or a parked frame */
  off: 'off',
} as const;

/** the smallest number of slots the readout ever shows: one kilo digit and its three grams */
export const MIN_SLOTS = 4;

/** grams per kilo — the one conversion this component performs */
export const PER_KILO = 1000;

/** how many digit places sit to the right of the kilo separator */
export const GRAM_PLACES = 3;

/** kilo digits per group, so a big number stays ONE readable number: 10.000 kg, never 10000 kg */
export const GROUP = 3;
