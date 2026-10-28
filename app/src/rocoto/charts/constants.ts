/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * Base ships no chart. The maths comes from visx (Airbnb, MIT, low-level on purpose: it owns the
 * scales and the path generators, we own every mark it draws). Everything visible here is Rocoto's.
 */

/** How much paper the chart is printed on. Each step is a position on Base's own sizing scale —
 *  32 / 96 / 128 / 192 — so a chart sits on the same grid as everything around it. */
export const SIZE = {
  sparkline: 'sparkline',
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** How a line is drawn. This is the whole categorical vocabulary — there is no palette, so two
 *  series are told apart by the stroke itself, the way a printed chart does it. */
export const DASH = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
} as const;

/** How the points are joined. `linear` is the default because a straight segment states exactly
 *  what was measured; a smoothed curve invents readings between the ones that exist. */
export const CURVE = {
  linear: 'linear',
  monotone: 'monotone',
  step: 'step',
} as const;

/** Where an area is anchored. `zero` is the default: an area that starts at its own minimum
 *  makes a small change look like a cliff. `min` exists for series where zero is meaningless. */
export const BASELINE = {
  zero: 'zero',
  min: 'min',
} as const;
