/* FORKED from Base Web `src/file-uploader/locale.ts` (v16.1.1) on 2026-08-22.
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
export type FileUploaderLocale = {
  added: string;
  buttonText: string;
  contentMessage: string;
  error: string;
  processed: string;
};

const locale = {
  added: 'Uploading',
  buttonText: 'Browse files',
  contentMessage: 'or drop to upload',
  error: 'Upload failed: ',
  processed: 'Upload successful',
};

export default locale;
