/* FORKED from Base Web `src/slider/constants.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: E2 divides one order line across two or more lotes. Base's Slider
 * hard-limits itself to two thumbs and models a RANGE; el reparto models a DIVISION — N-1
 * boundaries on one total, where the parts are the segments between them, so quantity cannot be
 * created or lost by dragging.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. — the upstream notice below
 * travels with this copy as the licence requires, and the full licence is vendored at
 * app/src/rocoto/LICENSE.baseweb.txt. This file is a DERIVATIVE WORK.
 *
 * Everything about how this component is assembled is deliberately left as Base built it: the
 * `overrides` contract, `getOverrides`, the shared-props shape, theme-driven styling, focus
 * and keyboard handling, and the animation tokens. Rocoto's edits are marked `ROCOTO:` inline
 * and listed in CHANGES.md, so the delta from upstream is always readable.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

export const STATE_CHANGE_TYPE = Object.freeze({
  change: 'change',
  finalChange: 'finalChange',
} as const);

/* ROCOTO: the division's own geometry. A range is a hairline because a range is a reading; a
 * division is a QUANTITY, and a quantity has area. The bar is tall enough that each part is a
 * block of the total a person can point at, and the boundary between two parts is the thing the
 * hand goes for. Both numbers are px because they are measurements of a shape, not paint: a
 * re-brand changes the ink in the bar and never the height of it. */
export const GEOMETRY = {
  /** the height of the division bar */
  track: 14,
  /** the width of the rule drawn where two parts meet */
  boundary: 2,
  /** the width of the grip a hand puts itself on to move that rule */
  grip: 10,
} as const;

/* ROCOTO: HOW THE PARTS ARE TOLD APART.
 *
 * The parts alternate between full ink and a pale ink, so a boundary reads at a glance without a
 * second hue entering the system — this product has no traffic light, and a division is not a
 * status. Two constraints shaped the pair:
 *
 *   · Both steps must carry WEIGHT. A part painted in a hairline grey reads as empty track, and
 *     empty track says the quantity was lost — the one thing this control exists to make
 *     impossible.
 *   · Both steps must MOVE under a re-brand. Base's mono ramp is brand-invariant, so a pale band
 *     taken straight off it would sit still under `?theme=proof` and be indistinguishable from
 *     hard-coded paint. So the pale step is a MIX, exactly as the Ghost family solves the same
 *     problem: the mono step supplies the value and `contentPrimary` supplies the brand's ink.
 */
export const WEAVE = { ink: 22, ground: 'mono400' } as const;
