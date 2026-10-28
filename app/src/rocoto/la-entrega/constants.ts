/* FORKED from Base Web `src/sliding-button/constants.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: a driver marks a stop delivered at the door — one-handed, in a vehicle,
 * sometimes in rain. Base's Sliding Button carries a centred string; the driver's swipe has to
 * carry the STOP itself (the customer, the address, the amount to collect), because the thing
 * being read and the thing being swiped are one object. And the whole track is the target, not a
 * 56px grabber.
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

export const THRESHOLD = {
  low: "low",
  /** ROCOTO: the door. A wet thumb glancing off the row travels a little way; a delivery travels
   *  half the door. Base ships 0.2 and 0.8 — 0.2 fires on a slip, 0.8 asks a gloved hand to cross
   *  the whole width of a phone held in one hand. Half is the driver's number. */
  door: "door",
  high: "high",
} as const;

export const THRESHOLD_VALUES: Record<
  (typeof THRESHOLD)[keyof typeof THRESHOLD],
  number
> = {
  low: 0.2,
  door: 0.5,
  high: 0.8,
};

/** ROCOTO: the row has two heights. `default` is Base's own 56px handle; `large` is the one a
 *  glove finds in a moving van, and it is what I3 draws. Both are theme sizing steps, so the size
 *  travels with the brand rather than being pinned here. */
export const SIZE = {
  default: "default",
  large: "large",
} as const;

const GRABBER_ICON_SIZE_PX = 24;
const GRABBER_PADDING_PX = 16;

export const BUTTON_SIZE = GRABBER_ICON_SIZE_PX + GRABBER_PADDING_PX * 2; // 56

/** ROCOTO: the large row's handle. It is exactly `scale1600`, the height `rowHeight` gives the
 *  large row — the handle and the row have to be the same number or the stop reads from under the
 *  slider, which is precisely the bug a 72px handle on a 64px row produced. */
export const BUTTON_SIZE_LARGE = 64;

export const TAP_OFFSET = GRABBER_PADDING_PX; // 16
