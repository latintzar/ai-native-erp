/* FORKED from Base Web `src/file-uploader/constants.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: B3 captures a supplier's albarán at the loading bay. Base's uploader has one door — a drop zone with a browse button — and the trade has three: a camera on a phone at the bay, a drop on a desk, and the albarán that simply ARRIVED by email, where nobody chose the file at all. The third is the one no uploader models, and it is the commonest.
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
import type { Theme } from 'baseui';

export const FILE_STATUS = {
  added: 'added',
  error: 'error',
  processed: 'processed',
} as const;

export const FILE_STATUS_TO_COLOR_MAP = (
  $theme: Theme
): { added: string; error: string; processed: string } => ({
  [FILE_STATUS.added]: $theme.colors.accent,
  [FILE_STATUS.error]: $theme.colors.negative,
  [FILE_STATUS.processed]: $theme.colors.positive,
});

export enum ARIA_LIVE_ELEMENT_ID {
  ADDITION = 'file-uploader-addition',
  REMOVAL = 'file-uploader-removal',
}

export const ARIA_LIVE_TIMEOUT_MS = 5000;
export const PROGRESS_AMOUNT_LOADING = 20;
export const PROGRESS_AMOUNT_LOADING_COMPLETE = 100;

/* ROCOTO: THE THREE DOORS. Base's uploader has exactly one — a drop zone with a browse button —
 * because a web form has exactly one. A supplier's albarán has three, and which one it comes
 * through is a fact about the trade rather than about the software:
 *
 *   · `camera`   the phone at the loading bay, while the lorry is still open (B3, `D7.doc-paper`)
 *   · `drop`     the desk, where a file is chosen (B2, `D7.doc-digital`)
 *   · `arrived`  it was already here. NOBODY CHOSE THIS FILE — it came in by email with the
 *                goods' paperwork, and the first act available is reading it, never picking it.
 *
 * The third is the one no uploader models and the commonest of the three. Modelling it as a door
 * rather than as a pre-populated drop zone is the whole reason this fork exists: a drop zone
 * standing over a file nobody chose invites a person to choose it again.
 */
export const DOOR = {
  camera: 'camera',
  drop: 'drop',
  arrived: 'arrived',
} as const;
