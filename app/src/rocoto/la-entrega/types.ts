/* FORKED from Base Web `src/sliding-button/types.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: see `constants.ts`. Base Web is MIT licensed, Copyright (c) Uber
 * Technologies, Inc.; the upstream notice below travels with this copy as the licence requires,
 * and the full licence is vendored at app/src/rocoto/LICENSE.baseweb.txt. This file is a DERIVATIVE WORK.
 *
 * The `overrides` contract, the shared-props shape and the prop idiom are Base's, untouched.
 * Rocoto's edits are marked `ROCOTO:`.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import type * as React from "react";
import type { Override } from "baseui/helpers/overrides";
import type { THRESHOLD, SIZE } from "./constants";

export type Threshold = keyof typeof THRESHOLD;
export type Size = keyof typeof SIZE;

export type EntregaOverrides = {
  Root?: Override;
  Track?: Override;
  Slider?: Override;
  Label?: Override;
  CompletedLabel?: Override;
  Grabber?: Override;
  LoadingOverlay?: Override;
  LoadingSpinner?: Override;
};

export type EntregaProps = {
  /** ROCOTO: the STOP, not a string. Base takes `label: string` and centres it; the driver's row
   *  carries the customer, the address and the amount to collect, and that whole object is what
   *  the thumb pushes. A node, so a stop is composed out of the kit like anything else. */
  label: React.ReactNode;
  /** ROCOTO: what the row says once it has been swept — a time, a name, whatever the surface knows
   *  afterwards. Base repeats the label; a driver already read it, and what they want now is the
   *  receipt for the act they just performed. */
  completedLabel?: React.ReactNode;
  /** how far the hand must travel before the row commits. `door` is the driver's half. */
  threshold?: Threshold;
  /** ROCOTO: `large` is the gloved row I3 draws. */
  size?: Size;
  /** Shows loading spinner, disables interaction. */
  isLoading?: boolean;
  /** Grays out the component, disables interaction. */
  isDisabled?: boolean;
  /** ROCOTO: the row is already swept — it comes back from the record in this state rather than
   *  being animated into it, because a list of today's stops is re-read all morning. */
  isCompleted?: boolean;
  /** Called once when the user drags past the threshold. */
  onComplete?: () => void;
  /** Auto-reset to idle state after N milliseconds. */
  slideBackAfterMs?: number;
  /** Override internal elements. */
  overrides?: EntregaOverrides;
  /** Accessible label — the words a reader who hears the row is given. */
  "aria-label"?: string;
};

export type StyleProps = {
  $isDisabled?: boolean;
  $isLoading?: boolean;
  $isCompleted?: boolean;
  $isDragging?: boolean;
  $isInteractive?: boolean;
  $isActuallySliding?: boolean;
  $dragOffset?: number;
  $sliderWidth?: string;
  $isRtl?: boolean;
  /** ROCOTO: the row's height, and with it the handle's */
  $size?: Size;
};
