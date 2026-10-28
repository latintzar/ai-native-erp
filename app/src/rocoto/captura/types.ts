/* FORKED from Base Web `src/file-uploader/types.ts` (v16.1.1) on 2026-08-22.
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
import type { Override } from 'baseui/helpers/overrides';
import type { FILE_STATUS } from './constants';
import type {
  FileUploaderBasicOverrides,
  FileUploaderBasicProps,
  StyleProps as FileUploaderBasicStyleProps,
} from 'baseui/file-uploader-basic/types';

export type StyleProps = FileUploaderBasicStyleProps & {
  $alt: string;
  $color: string;
  $fileCount: number;
  $src: string;
};

export type FileUploaderOverrides = {
  CircleCheckFilledIcon?: Override;
  CircleExclamationPointFilledIcon?: Override;
  DeleteButtonComponent?: Override;
  FileRow?: Override;
  FileRowColumn?: Override;
  FileRowContent?: Override;
  FileRowFileName?: Override;
  FileRowText?: Override;
  FileRowUploadMessage?: Override;
  FileRowUploadText?: Override;
  FileRows?: Override;
  Hint?: Override;
  ImagePreviewThumbnail?: Override;
  ItemPreviewContainer?: Override;
  Label?: Override;
  PaperclipFilledIcon?: Override;
  ParentRoot?: Override;
  TrashCanFilledIcon?: Override;
};

export type FileRow = {
  errorMessage: string | null;
  file: File;
  id: string;
  // fileInfo is the result of the processFileOnDrop function
  // TODO: switch to leverage a generic <T> so applications can define the shape of fileInfo
  fileInfo?: any;
  imagePreviewThumbnail?: any;
  progressAmount: number;
  /** Defines the status of a file */
  status: keyof typeof FILE_STATUS;
};

export type FileUploaderProps = Omit<
  FileUploaderBasicProps,
  'onDrop' | 'onDropAccepted' | 'onDropRejected' | 'overrides'
> & {
  fileRows: FileRow[];
  hint?: string;
  itemPreview?: boolean;
  label?: string;
  maxFiles?: number;
  overrides?: FileUploaderBasicOverrides & FileUploaderOverrides;
  /** Function to run on each file, returns "errorMessage: null" on success and "errorMessage: string" for failures */
  processFileOnDrop?: (
    fileToProcess: File,
    fileToProcessId: string,
    fileRows: FileRow[]
  ) => Promise<{ errorMessage: string | null; fileInfo?: any }>;
  progressAmountStartValue?: number;
  setFileRows: (fileRows: FileRow[]) => void;
};

/* ROCOTO ─────────────────────────────────────────────────────────────────────────────────────
 * The door, and everything it needs. `CapturaProps` is `FileUploaderProps` plus a door; every
 * one of Base's own props still works exactly as Base documents it, and the `drop` door IS Base's
 * uploader, untouched.
 */
import type * as React from 'react';
import type { DOOR } from './constants';

export type Door = keyof typeof DOOR;

/** What the `arrived` door knows. Nobody chose this file, so the only honest thing on the screen
 *  is where it came from and when. */
export type Arrived = {
  /** who sent it — a supplier's name, an address, the words the surface has */
  from: React.ReactNode;
  /** when it landed */
  at: React.ReactNode;
  /** what the message called itself */
  subject?: React.ReactNode;
};

export type CapturaOverrides = {
  /** the strip of doors at the head */
  Doors?: Override;
  /** one door */
  Door?: Override;
  /** the camera door's frame — what the lens is looking at */
  Viewfinder?: Override;
  /** the guide inside the frame that says where the sheet goes */
  Guide?: Override;
  /** the shutter */
  Shutter?: Override;
  /** the arrived door's block */
  Arrived?: Override;
  /** one line of it */
  ArrivedLine?: Override;
};

export type CapturaProps = Omit<FileUploaderProps, 'overrides'> & {
  /** which door is open */
  door?: Door;
  /** which doors this surface offers. One door draws no chooser, because there is no choice. */
  doors?: Door[];
  onDoorChange?: (door: Door) => void;
  /** the shutter was pressed. The caller hands back whatever the camera produced. */
  onCapture?: () => void;
  /** what the lens is looking at — a live preview, or the sheet once it has been taken */
  viewfinder?: React.ReactNode;
  /** the sheet's edges have been found, so the shutter's words change */
  framed?: boolean;
  /** the `arrived` door's facts */
  arrived?: Arrived;
  /** every string the doors say, so a surface speaks its own language */
  labels?: Partial<{ camera: string; drop: string; arrived: string; shutter: string; framed: string }>;
  overrides?: FileUploaderBasicOverrides & FileUploaderOverrides & CapturaOverrides;
};

export type DoorStyleProps = {
  $door: Door;
  $active: boolean;
  $disabled: boolean;
};
