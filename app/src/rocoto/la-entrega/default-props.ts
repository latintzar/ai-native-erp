/* FORKED from Base Web `src/sliding-button/default-props.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: see `constants.ts`. Base Web is MIT licensed, Copyright (c) Uber
 * Technologies, Inc.; the notice below travels with this copy. DERIVATIVE WORK.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import { THRESHOLD, SIZE } from "./constants";

export const defaultProps = {
  // ROCOTO: the door's half, in place of Base's 0.8. A gloved hand holding the phone that is also
  // holding the crate does not cross the whole width of the screen.
  threshold: THRESHOLD.door,
  size: SIZE.default,
  isLoading: false,
  isDisabled: false,
  overrides: {},
};
