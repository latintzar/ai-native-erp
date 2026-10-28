/* GROWN from Base Web's own `src/template-component/constants.ts`.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships nothing that edits a price STRUCTURE.
 */

/** The four levels of the pricing fractal, in order of increasing complexity.
 *  The level is a property of the ITEM, never of the house: two items in the same catalogue sit
 *  at different levels, and the same item moves up a level the day somebody starts changing it. */
export const LEVEL = {
  /** one price, fixed forever */
  fixed: 1,
  /** tiers, fixed */
  tiers: 2,
  /** tiers that change daily, holding a fixed relationship: an anchor and offsets from it */
  anchored: 3,
  /** tiers that change daily and are all discretionary: a person sets each one, each day */
  discretionary: 4,
} as const;

/** Level 4 reads two ways: the grid of what was set, or the log drawn as a chart. */
export const VIEW = {
  grid: 'grid',
  chart: 'chart',
} as const;

/** The anchor's own handle id, so one `activeStopId` can name either a stop or the centre. */
export const ANCHOR_ID = 'anchor';

/** Level 1's single price answers to this, so `editingTierId` names the cell being written at
 *  every level: a tier at levels 2 and 4, and the item's one price at level 1. */
export const PRICE_ID = 'price';

/** Percentage points an arrow key moves a stop's offset. Shift multiplies by ten. */
export const OFFSET_STEP = 0.5;

/** The price granularity a ramp steps through when the model names none. */
export const PRICE_STEP = 0.01;

/** How far below and above the anchor the ramp reaches when the model names no ends. */
export const RAMP_FLOOR = 0.6;
export const RAMP_CEILING = 1.6;
