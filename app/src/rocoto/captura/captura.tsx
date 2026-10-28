/* FORKED from Base Web `src/file-uploader/file-uploader.tsx` (v16.1.1) on 2026-08-22.
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
import * as React from 'react';
import { FileUploaderBasic } from 'baseui/file-uploader-basic';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { ProgressBar, SIZE as PROGRESS_BAR_SIZE } from 'baseui/progress-bar';
import { getOverrides } from 'baseui/helpers/overrides';
import {
  StyledFileRow,
  StyledFileRowColumn,
  StyledFileRowContent,
  StyledFileRowFileName,
  StyledFileRowText,
  StyledFileRowUploadMessage,
  StyledFileRowUploadText,
  StyledFileRows,
  StyledHint,
  StyledImagePreviewThumbnail,
  StyledItemPreviewContainer,
  StyledLabel,
  StyledParentRoot,
  // ROCOTO: the three doors
  StyledDoors,
  StyledDoor,
  StyledViewfinder,
  StyledGuide,
  StyledArrived,
  StyledArrivedLine,
} from './styled-components';
import {
  ARIA_LIVE_ELEMENT_ID,
  PROGRESS_AMOUNT_LOADING,
  PROGRESS_AMOUNT_LOADING_COMPLETE,
  FILE_STATUS,
  FILE_STATUS_TO_COLOR_MAP,
  // ROCOTO
  DOOR,
} from './constants';
import { destructureStyleOverride, formatBytes, handleAriaLiveUpdates } from './utils';
import CircleCheckFilledIconComponent from 'baseui/icon/circle-check-filled';
import CircleExclamationPointFilled from 'baseui/icon/circle-exclamation-point-filled';
import PaperclipFilledIconComponent from 'baseui/icon/paperclip-filled';
import TrashCanFilledIconComponent from 'baseui/icon/trash-can-filled';
import Upload from 'baseui/icon/upload';
import { useStyletron } from 'baseui';
import { LocaleContext } from 'baseui/locale';
/* ROCOTO: Base takes its row ids from `react-uid`, which is baseui's own nested dependency and
 * is not resolvable from this tree. The id only has to be stable for the life of a row, so it is
 * taken from the file's own identity plus a counter — one fewer dependency, same guarantee. */
let rowSeq = 0;
const uid = (file: File): string => `${file.name}-${file.size}-${file.lastModified}-${rowSeq++}`;

import type { FileRow, CapturaProps, Door } from './types';

/* ROCOTO: `LA CAPTURA` — Base's FileUploader with three doors instead of one.
 *
 * The uploader below the door is Base's, whole: the same drop zone, the same file rows, the same
 * progress, the same aria-live announcements, the same overrides contract. What the fork adds is
 * the fact the trade actually has — that a supplier's albarán arrives through one of three doors,
 * and that one of them is «it was already here». */
export default function Captura(props: CapturaProps) {
  /* ROCOTO: Base's own dev-time guards, reading through one cast. The props they warn about are
     already removed from the public type, so indexing the typed object is an error under this
     build's `strict`; the guard itself is worth keeping, because the type only protects callers
     who are compiled. */
  const passed = props as Record<string, unknown>;
  if (passed['onDrop']) console.error('onDrop is not a prop for Captura.');
  if (passed['onDropAccepted']) console.error('onDropAccepted is not a prop for Captura.');
  if (passed['onDropRejected']) console.error('onDropRejected is not a prop for Captura.');
  if (passed['progressAmount']) console.error('progressAmount is not a prop for Captura.');

  // Isolate props that are not meant to be passed to FileUploaderBasic
  const {
    fileRows = [],
    hint,
    itemPreview,
    label,
    maxFiles,
    overrides = {},
    processFileOnDrop,
    progressAmountStartValue,
    setFileRows = () => {},
    // ROCOTO: the door, and everything only a door needs
    door: doorProp,
    doors = [DOOR.drop],
    onDoorChange,
    onCapture,
    viewfinder,
    framed = false,
    arrived,
    labels,
    ...fileUploaderBasicProps
  } = props;

  /* ROCOTO: the door is controlled where the surface wants it controlled and uncontrolled
     otherwise — Base's own convention for a component with one piece of state. */
  const [ownDoor, setOwnDoor] = React.useState<Door>(doors[0]);
  const door: Door = doorProp ?? ownDoor;
  const openDoor = (next: Door) => {
    setOwnDoor(next);
    onDoorChange?.(next);
  };
  const doorText = {
    camera: labels?.camera ?? 'Photograph it',
    drop: labels?.drop ?? 'Choose a file',
    arrived: labels?.arrived ?? 'It arrived',
  };
  // Isolate styles that are not meant to be passed to FileUploaderBasic
  const {
    // Overrides for FileUploader
    CircleCheckFilledIcon: OverridesCircleCheckFilledIcon,
    CircleExclamationPointFilledIcon: OverridesCircleExclamationPointFilledIcon,
    DeleteButtonComponent: OverridesDeleteButtonComponent,
    FileRow: OverridesFileRow,
    FileRowColumn: OverridesFileRowColumn,
    FileRowContent: OverridesFileRowContent,
    FileRowFileName: OverridesFileRowFileName,
    FileRowText: OverridesFileRowText,
    FileRowUploadMessage: OverridesFileRowUploadMessage,
    FileRowUploadText: OverridesFileRowUploadText,
    FileRows: OverridesFileRows,
    Hint: OverridesHint,
    ImagePreviewThumbnail: OverridesImagePreviewThumbnail,
    ItemPreviewContainer: OverridesItemPreviewContainer,
    Label: OverridesLabel,
    PaperclipFilledIcon: OverridesPaperclipFilledIcon,
    ParentRoot: OverridesParentRoot,
    TrashCanFilledIcon: OverridesTrashCanFilledIcon,

    // ROCOTO: the door overrides belong to this file and never travel to FileUploaderBasic
    Doors: OverridesDoors,
    Door: OverridesDoor,
    Viewfinder: OverridesViewfinder,
    Guide: OverridesGuide,
    Shutter: OverridesShutter,
    Arrived: OverridesArrived,
    ArrivedLine: OverridesArrivedLine,

    // Overrides for FileUploaderBasic that are modified in this file
    ButtonComponent,
    ContentMessage,
    FileDragAndDrop,
    ...fileUploaderBasicOverrides
  } = overrides;

  const [css, theme] = useStyletron();

  // Prepare icon overrides
  const [CircleCheckFilledIcon, circleCheckFilledIconProps] = getOverrides(
    overrides.CircleCheckFilledIcon,
    CircleCheckFilledIconComponent
  );
  const [CircleExclamationPointFilledIcon, circleExclamationPointFilledIconProps] = getOverrides(
    OverridesCircleExclamationPointFilledIcon,
    CircleExclamationPointFilled
  );
  const [PaperclipFilledIcon, paperclipFilledIconProps] = getOverrides(
    OverridesPaperclipFilledIcon,
    PaperclipFilledIconComponent
  );
  const [TrashCanFilledIcon, trashCanFilledIconProps] = getOverrides(
    OverridesTrashCanFilledIcon,
    TrashCanFilledIconComponent
  );

  // Prepare baseui component overrides
  const [DeleteButtonComponent, deleteButtonProps] = getOverrides(
    OverridesDeleteButtonComponent,
    Button
  );
  const [ProgressBarComponent, progressBarProps] = getOverrides(overrides.ProgressBar, ProgressBar);

  // Prepare styled component overrides
  const [FileRow, fileRowProps] = getOverrides(OverridesFileRow, StyledFileRow);
  const [FileRowColumn, fileRowColumnProps] = getOverrides(
    OverridesFileRowColumn,
    StyledFileRowColumn
  );
  const [FileRowContent, fileRowContentProps] = getOverrides(
    OverridesFileRowContent,
    StyledFileRowContent
  );
  const [FileRowFileName, fileRowFileNameProps] = getOverrides(
    OverridesFileRowFileName,
    StyledFileRowFileName
  );
  const [FileRowText, fileRowTextProps] = getOverrides(OverridesFileRowText, StyledFileRowText);
  const [FileRowUploadMessage, fileRowUploadMessageProps] = getOverrides(
    OverridesFileRowUploadMessage,
    StyledFileRowUploadMessage
  );
  const [FileRowUploadText, fileRowUploadTextProps] = getOverrides(
    OverridesFileRowUploadText,
    StyledFileRowUploadText
  );
  const [FileRows, fileRowsProps] = getOverrides(OverridesFileRows, StyledFileRows);
  const [Hint, hintProps] = getOverrides(OverridesHint, StyledHint);
  const [ImagePreviewThumbnail, imagePreviewThumbnailProps] = getOverrides(
    OverridesImagePreviewThumbnail,
    StyledImagePreviewThumbnail
  );
  const [ItemPreviewContainer, itemPreviewContainerProps] = getOverrides(
    OverridesItemPreviewContainer,
    StyledItemPreviewContainer
  );
  const [Label, labelProps] = getOverrides(OverridesLabel, StyledLabel);
  const [ParentRoot, parentRootProps] = getOverrides(OverridesParentRoot, StyledParentRoot);

  // ROCOTO: the doors, through the same overrides contract as everything above them
  const [Doors, doorsProps] = getOverrides(OverridesDoors, StyledDoors);
  const [DoorButton, doorButtonProps] = getOverrides(OverridesDoor, StyledDoor);
  const [Viewfinder, viewfinderProps] = getOverrides(OverridesViewfinder, StyledViewfinder);
  const [Guide, guideProps] = getOverrides(OverridesGuide, StyledGuide);
  const [ShutterButton, shutterProps] = getOverrides(OverridesShutter, Button);
  const [Arrived, arrivedProps] = getOverrides(OverridesArrived, StyledArrived);
  const [ArrivedLine, arrivedLineProps] = getOverrides(OverridesArrivedLine, StyledArrivedLine);

  const onDrop = React.useCallback(
    (acceptedFiles: Array<File>, rejectedFiles: Array<File>) => {
      const newFiles = acceptedFiles.concat(rejectedFiles);
      let newFileRows = [...props.fileRows];
      newFiles.forEach((file: File) => {
        newFileRows.push({
          errorMessage: null,
          file,
          id: uid(file),
          imagePreviewThumbnail: '',
          progressAmount: progressAmountStartValue ?? PROGRESS_AMOUNT_LOADING,
          status: FILE_STATUS.added,
        });
        props.setFileRows([...newFileRows]);
      });

      newFileRows.forEach((fileRow: FileRow, index: number) => {
        if (fileRow.status === FILE_STATUS.added) {
          let reader = new FileReader();

          reader.onerror = () => {
            newFileRows[index].errorMessage = 'cannot read file';
            newFileRows[index].status = FILE_STATUS.error;
            newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
            handleAriaLiveUpdates(
              ARIA_LIVE_ELEMENT_ID.ADDITION,
              `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
            );
            props.setFileRows([...newFileRows]);
          };

          reader.onload = (event) => {
            if (newFileRows[index].file.type.startsWith('image/')) {
              newFileRows[index].imagePreviewThumbnail = event.target?.result;
              props.setFileRows([...newFileRows]);
            }
            if (
              props.maxFiles !== undefined &&
              Number.isInteger(props.maxFiles) &&
              index >= props.maxFiles
            ) {
              // If too many files
              newFileRows[
                index
              ].errorMessage = `cannot process more than ${props.maxFiles} file(s)`;
              newFileRows[index].status = FILE_STATUS.error;
              newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
              handleAriaLiveUpdates(
                ARIA_LIVE_ELEMENT_ID.ADDITION,
                `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
              );
              props.setFileRows([...newFileRows]);
            } else if (
              props.minSize !== undefined &&
              Number.isInteger(props.minSize) &&
              props.minSize > fileRow.file.size
            ) {
              // If file size is too small
              newFileRows[index].errorMessage = `file size must be greater than ${formatBytes(
                props.minSize
              )}`;
              newFileRows[index].status = FILE_STATUS.error;
              newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
              handleAriaLiveUpdates(
                ARIA_LIVE_ELEMENT_ID.ADDITION,
                `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
              );
              props.setFileRows([...newFileRows]);
            } else if (
              props.maxSize !== undefined &&
              Number.isInteger(props.maxSize) &&
              props.maxSize < fileRow.file.size
            ) {
              // If file size is too big
              newFileRows[index].errorMessage = `file size must be less than ${formatBytes(
                props.maxSize
              )}`;
              newFileRows[index].status = FILE_STATUS.error;
              newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
              handleAriaLiveUpdates(
                ARIA_LIVE_ELEMENT_ID.ADDITION,
                `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
              );
              props.setFileRows([...newFileRows]);
            } else if (index >= newFileRows.length - rejectedFiles.length) {
              // If file was rejected by dropzone (e.g. wrong file type)
              newFileRows[index].errorMessage = fileRow.file.type
                ? `file type of ${fileRow.file.type} is not accepted`
                : 'file type is not accepted';
              newFileRows[index].status = FILE_STATUS.error;
              newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
              handleAriaLiveUpdates(
                ARIA_LIVE_ELEMENT_ID.ADDITION,
                `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
              );
              props.setFileRows([...newFileRows]);
            } else if (props.processFileOnDrop) {
              // If caller passed in file process function
              props
                .processFileOnDrop(fileRow.file, fileRow.id, newFileRows)
                .then(
                  ({ errorMessage, fileInfo }: { errorMessage: string | null; fileInfo?: any }) => {
                    if (fileInfo) {
                      newFileRows[index].fileInfo = fileInfo;
                    }
                    if (errorMessage) {
                      newFileRows[index].errorMessage = errorMessage;
                      newFileRows[index].status = FILE_STATUS.error;
                      newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
                    } else {
                      newFileRows[index].status = FILE_STATUS.processed;
                      newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
                    }
                  }
                )
                .catch((error) => {
                  console.error('error with processFileOnDrop', error);
                  newFileRows[index].errorMessage = 'unknown processing error';
                  newFileRows[index].status = FILE_STATUS.error;
                  newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
                  handleAriaLiveUpdates(
                    ARIA_LIVE_ELEMENT_ID.ADDITION,
                    `${newFileRows[index].file.name} added, upload failed: ${newFileRows[index].errorMessage}`
                  );
                })
                .finally(() => {
                  props.setFileRows([...newFileRows]);
                });
            } else {
              // If no errors and no file process function
              newFileRows[index].status = FILE_STATUS.processed;
              newFileRows[index].progressAmount = PROGRESS_AMOUNT_LOADING_COMPLETE;
              handleAriaLiveUpdates(
                ARIA_LIVE_ELEMENT_ID.ADDITION,
                `${newFileRows[index].file.name} added, upload successful`
              );
              props.setFileRows([...newFileRows]);
            }
          };

          reader.readAsDataURL(fileRow.file);
        }
      });
    },
    [props]
  );

  const removeFileRow = (event: React.MouseEvent) => {
    event.preventDefault();
    const indexOfFileRowToRemove = Number(event?.currentTarget?.getAttribute('index'));
    handleAriaLiveUpdates(
      ARIA_LIVE_ELEMENT_ID.REMOVAL,
      `${props.fileRows[indexOfFileRowToRemove].file.name} removed`
    );
    // ROCOTO: `Array.prototype.toSpliced` is ES2023 and this build targets ES2020, so the
    // same removal is written with a filter. Behaviour is identical.
    props.setFileRows(props.fileRows.filter((_, i) => i !== indexOfFileRowToRemove));
    const label = document.querySelector('[data-baseweb="file-uploader-label"]') as HTMLElement;
    if (label) {
      label.focus();
    }
  };

  const noFilesAreLoading = React.useMemo(
    () => !props.fileRows.find((fileRow: FileRow) => fileRow.status === FILE_STATUS.added),
    [props.fileRows]
  );

  return (
    <LocaleContext.Consumer>
      {(locale) => (
        <ParentRoot data-baseweb="file-uploader-parent-root" {...parentRootProps}>
          <span
            aria-live="assertive"
            aria-relevant="additions"
            className={css({
              top: 0,
              left: '-4px',
              width: '1px',
              height: '1px',
              position: 'absolute',
              overflow: 'hidden',
            })}
            id={ARIA_LIVE_ELEMENT_ID.ADDITION}
          ></span>
          <span
            aria-live="polite"
            aria-relevant="additions"
            className={css({
              top: 0,
              left: '-2px',
              width: '1px',
              height: '1px',
              position: 'absolute',
              overflow: 'hidden',
            })}
            id={ARIA_LIVE_ELEMENT_ID.REMOVAL}
          ></span>
          {props.label && (
            <Label
              data-baseweb="file-uploader-label"
              tabIndex={-1}
              {...labelProps}
              $disabled={!!props.disabled}
            >
              {props.label}
            </Label>
          )}
          {/* ROCOTO ─ THE THREE DOORS. The chooser is drawn only where there is a choice: a
              surface offering one door draws no strip, the same way a rail with one destination
              draws no menu. */}
          {doors.length > 1 && (
            <Doors data-baseweb="captura-doors" {...doorsProps}>
              {doors.map((d) => (
                <DoorButton
                  key={d}
                  type="button"
                  aria-pressed={door === d}
                  onClick={() => openDoor(d)}
                  disabled={props.disabled}
                  $door={d}
                  $active={door === d}
                  $disabled={!!props.disabled}
                  {...doorButtonProps}
                >
                  {doorText[d]}
                </DoorButton>
              ))}
            </Doors>
          )}

          {/* ROCOTO ─ THE CAMERA DOOR. One shot at the bay, and the frame is the sheet's own
              proportion so a person aims by filling it. Once the edges are found the shutter's
              words change, because the act has changed: taking, then keeping. */}
          {door === DOOR.camera && (
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale500,
                marginBottom: theme.sizing.scale300,
              })}
            >
              <Viewfinder data-baseweb="captura-viewfinder" {...viewfinderProps}>
                {viewfinder}
                {!framed && <Guide aria-hidden="true" {...guideProps} />}
              </Viewfinder>
              <ShutterButton
                kind={KIND.primary}
                size={SIZE.large}
                disabled={props.disabled}
                onClick={onCapture}
                {...shutterProps}
              >
                {framed ? labels?.framed ?? 'Keep it' : labels?.shutter ?? 'Take the photo'}
              </ShutterButton>
            </div>
          )}

          {/* ROCOTO ─ THE ARRIVED DOOR. NOBODY CHOSE THIS FILE, so there is no control here at
              all: where it came from, what it called itself, and when it landed. The first act
              available on a file a person did not choose is reading it. */}
          {door === DOOR.arrived && arrived && (
            <Arrived data-baseweb="captura-arrived" {...arrivedProps}>
              <div className={css({ ...theme.typography.LabelSmall })}>{arrived.from}</div>
              {arrived.subject && <ArrivedLine {...arrivedLineProps}>{arrived.subject}</ArrivedLine>}
              <ArrivedLine {...arrivedLineProps}>{arrived.at}</ArrivedLine>
            </Arrived>
          )}

          {/* ROCOTO ─ THE DROP DOOR IS BASE'S UPLOADER, UNTOUCHED. */}
          {door === DOOR.drop && (
            <FileUploaderBasic
              buttonIcon={() => <Upload aria-hidden={'true'} />}
              buttonText={locale.fileuploader.buttonText}
              contentMessage={locale.fileuploader.contentMessage}
              overrides={{
                ButtonComponent: {
                  props: {
                    'aria-describedby': 'file-uploader-hint',
                    shape: SHAPE.default,
                    size: SIZE.default,
                    ...props.overrides?.ButtonComponent?.props,
                    style: {
                      marginTop: 0,
                      ...destructureStyleOverride(
                        // @ts-expect-error
                        props.overrides?.ButtonComponent?.props?.style,
                        theme
                      ),
                    },
                    overrides: {
                      // @ts-expect-error
                      ...props.overrides?.ButtonComponent?.props?.overrides,
                      BaseButton: {
                        // @ts-expect-error
                        ...props.overrides?.ButtonComponent?.props?.overrides?.BaseButton,
                        style: {
                          backgroundColor: theme.colors.backgroundPrimary,
                          height: theme.sizing.scale950,
                          display: 'flex',
                          flexDirection: 'row',
                          gap: '8px',
                          ...theme.typography.LabelSmall,
                          ...destructureStyleOverride(
                            // @ts-expect-error
                            props.overrides?.ButtonComponent?.props?.overrides?.BaseButton?.style,
                            theme
                          ),
                        },
                      },
                    },
                  },
                },
                ContentMessage: {
                  style: {
                    ...theme.typography.ParagraphSmall,
                    color: theme.colors.contentTertiary,
                    ...destructureStyleOverride(props.overrides?.ContentMessage?.style, theme),
                  },
                },
                FileDragAndDrop: {
                  style: (fileDragAndDropProps) => ({
                    backgroundColor: fileDragAndDropProps.$theme.colors.fileUploaderBackgroundColor,
                    borderColor: fileDragAndDropProps.$isDragActive
                      ? fileDragAndDropProps.$theme.colors.borderSelected
                      : fileDragAndDropProps.$theme.colors.fileUploaderBorderColorDefault,
                    borderStyle: 'solid',
                    borderWidth: '3px',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.sizing.scale300,
                    paddingBottom: theme.sizing.scale600,
                    paddingLeft: theme.sizing.scale600,
                    paddingRight: theme.sizing.scale600,
                    paddingTop: theme.sizing.scale600,
                    ...destructureStyleOverride(props.overrides?.FileDragAndDrop?.style, theme),
                  }),
                },
                Root: {
                  style: {
                    marginBottom: theme.sizing.scale300,
                    ...destructureStyleOverride(props.overrides?.Root?.style, theme),
                  },
                },
                ...fileUploaderBasicOverrides,
              }}
              swapButtonAndMessage
              {...fileUploaderBasicProps}
              // Disable uploads while files are loading, even if application passes disabled as false
              disabled={
                !!props.disabled
                  ? props.disabled
                  : !!props.fileRows.find((fileRow: FileRow) => fileRow.status === FILE_STATUS.added)
              }
              // Implement or use no-op callbacks to prevent consumers from passing them in
              onDrop={onDrop}
              onDropAccepted={(_: Array<File>) => {}}
              onDropRejected={(_: Array<File>) => {}}
              progressAmount={undefined}
            />
          )}
          {props.fileRows.length > 0 && (
            <FileRows data-baseweb="file-uploader-file-rows" {...fileRowsProps}>
              {props.fileRows.map((fileRow, index) => (
                <FileRow
                  id={`file-uploader-file-row-${index}`}
                  data-baseweb="file-uploader-file-row"
                  key={fileRow.id}
                  {...fileRowProps}
                >
                  {props.itemPreview && (
                    <ItemPreviewContainer
                      aria-hidden={'true'}
                      data-baseweb="file-uploader-item-preview-container"
                      {...itemPreviewContainerProps}
                    >
                      {fileRow.imagePreviewThumbnail ? (
                        <ImagePreviewThumbnail
                          alt={fileRow.file.name}
                          data-baseweb="file-uploader-image-preview-thumbnail"
                          src={fileRow.imagePreviewThumbnail}
                          {...imagePreviewThumbnailProps}
                        />
                      ) : (
                        <PaperclipFilledIcon
                          data-baseweb="file-uploader-paperclip-filled-icon"
                          color={theme.colors.contentSecondary}
                          {...paperclipFilledIconProps}
                        />
                      )}
                    </ItemPreviewContainer>
                  )}
                  <FileRowColumn
                    data-baseweb="file-uploader-file-row-column"
                    {...fileRowColumnProps}
                  >
                    <FileRowContent
                      data-baseweb="file-uploader-file-row-content"
                      {...fileRowContentProps}
                    >
                      <FileRowText data-baseweb="file-uploader-file-row-text" {...fileRowTextProps}>
                        <FileRowFileName
                          data-baseweb="file-uploader-file-row-file-name"
                          {...fileRowFileNameProps}
                        >
                          {fileRow.file.name}
                        </FileRowFileName>
                        <FileRowUploadMessage
                          data-baseweb="file-uploader-file-row-upload-message"
                          $color={FILE_STATUS_TO_COLOR_MAP(theme)[fileRow.status]}
                          {...fileRowUploadMessageProps}
                        >
                          {fileRow.status === FILE_STATUS.error && (
                            <>
                              <CircleExclamationPointFilledIcon
                                aria-hidden={'true'}
                                color={FILE_STATUS_TO_COLOR_MAP(theme)[fileRow.status]}
                                data-baseweb="file-uploader-circle-exclamation-point-filled-icon"
                                title={fileRow.status}
                                {...circleExclamationPointFilledIconProps}
                              />
                              <FileRowUploadText
                                aria-errormessage={fileRow.errorMessage}
                                aria-invalid={true}
                                data-baseweb="file-uploader-file-row-upload-message-text"
                                id={`file-uploader-file-row-upload-message-text-${index}`}
                                {...fileRowUploadTextProps}
                              >
                                {locale.fileuploader.error}
                                {fileRow.errorMessage}
                              </FileRowUploadText>
                            </>
                          )}
                          {fileRow.status === FILE_STATUS.processed && (
                            <>
                              <CircleCheckFilledIcon
                                aria-hidden={'true'}
                                color={FILE_STATUS_TO_COLOR_MAP(theme)[fileRow.status]}
                                data-baseweb="file-uploader-circle-check-filled-icon"
                                title={fileRow.status}
                                {...circleCheckFilledIconProps}
                              />
                              <FileRowUploadText
                                data-baseweb="file-uploader-file-row-upload-message-text"
                                {...fileRowUploadTextProps}
                              >
                                {locale.fileuploader.processed}
                              </FileRowUploadText>
                            </>
                          )}
                          {fileRow.status === FILE_STATUS.added && (
                            <FileRowUploadText
                              $color={theme.colors.contentTertiary}
                              data-baseweb="file-uploader-file-row-upload-message-text"
                              {...fileRowUploadTextProps}
                            >
                              {locale.fileuploader.added}
                            </FileRowUploadText>
                          )}
                        </FileRowUploadMessage>
                      </FileRowText>
                      {noFilesAreLoading && (
                        <DeleteButtonComponent
                          aria-label={`Remove ${fileRow.file.name}`}
                          data-baseweb="file-uploader-delete-button-component"
                          index={index}
                          onClick={removeFileRow}
                          kind={KIND.tertiary}
                          shape={SHAPE.circle}
                          size={SIZE.compact}
                          {...deleteButtonProps}
                        >
                          <TrashCanFilledIcon
                            aria-hidden={'true'}
                            data-baseweb="file-uploader-trash-can-filled-icon"
                            overrides={{ Svg: { style: { verticalAlign: 'middle' } } }}
                            size={theme.sizing.scale600}
                            title={'remove'}
                            {...trashCanFilledIconProps}
                          />
                        </DeleteButtonComponent>
                      )}
                    </FileRowContent>
                    <ProgressBarComponent
                      aria-hidden={'true'}
                      data-baseweb="file-uploader-progress-bar"
                      overrides={{
                        Bar: {
                          style: {
                            marginTop: theme.sizing.scale0,
                            marginBottom: theme.sizing.scale0,
                            marginLeft: 0,
                            marginRight: 0,
                          },
                        },
                        BarContainer: {
                          style: {
                            marginTop: 0,
                            marginBottom: 0,
                            marginLeft: 0,
                            marginRight: 0,
                          },
                        },
                        BarProgress: {
                          // @ts-ignore
                          style: ({ $theme }) => ({
                            backgroundColor: FILE_STATUS_TO_COLOR_MAP($theme)[fileRow.status],
                          }),
                        },
                      }}
                      size={PROGRESS_BAR_SIZE.small}
                      value={fileRow.progressAmount ?? PROGRESS_AMOUNT_LOADING_COMPLETE}
                      {...progressBarProps}
                    />
                  </FileRowColumn>
                </FileRow>
              ))}
            </FileRows>
          )}
          {props.hint && (
            <Hint
              data-baseweb="file-uploader-hint"
              id="file-uploader-hint"
              $fileCount={props.fileRows.length}
              {...hintProps}
            >
              {props.hint}
            </Hint>
          )}
        </ParentRoot>
      )}
    </LocaleContext.Consumer>
  );
}

/* ROCOTO: Base sets these with `defaultProps`, which React 18.3 deprecates on function
 * components and warns about in the console on every render. The same two defaults are taken in
 * the destructure at the head of the component instead, so the fork runs with a clean console. */
