/* FORKED from Base Web `src/file-uploader/styled-components.ts` (v16.1.1) on 2026-08-22.
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
import { styled } from 'baseui';
import type { StyleProps } from './types';

export const StyledFileRow = styled<'li', StyleProps>('li', (props) => {
  const {
    $theme: { animation, sizing },
  } = props;
  return {
    animationDuration: animation.timing400,
    animationFillMode: 'forwards',
    animationIterationCount: 1,
    animationTimingFunction: animation.easeOutQuinticCurve,
    animationName: {
      '0%': {
        transform: 'translateY(-32px)',
        opacity: 0,
      },
      '50%': {
        opacity: 1,
      },
      '100%': {
        transform: 'translateY(0px)',
        opacity: 1,
      },
    },
    paddingTop: sizing.scale500,
    paddingRight: sizing.scale500,
    paddingBottom: sizing.scale500,
    paddingLeft: sizing.scale500,
    gap: sizing.scale500,
    height: 'fit-content',
    display: 'flex',
    alignItems: 'center',
  };
});
StyledFileRow.displayName = 'StyledFileRow';

export const StyledFileRowColumn = styled<'div', StyleProps>('div', () => {
  return {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    flexGrow: 1,
    overflow: 'auto',
  };
});
StyledFileRowColumn.displayName = 'StyledFileRowColumn';

export const StyledFileRowContent = styled<'div', StyleProps>('div', (props) => {
  const {
    $theme: { sizing },
  } = props;
  return {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    gap: sizing.scale500,
    justifyContent: 'space-between',
    width: '100%',
    height: sizing.scale1000,
  };
});
StyledFileRowContent.displayName = 'StyledFileRowContent';

export const StyledFileRowFileName = styled<'div', StyleProps>('div', (props) => {
  const {
    $theme: { colors, typography },
  } = props;
  return {
    ...typography.LabelSmall,
    color: colors.contentPrimary,
    width: '100%',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  };
});
StyledFileRowColumn.displayName = 'StyledFileRowColumn';

export const StyledFileRowText = styled<'div', StyleProps>('div', (props) => {
  const {
    $theme: { sizing },
  } = props;
  return {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    gap: sizing.scale0,
    flexGrow: 1,
    overflow: 'auto',
  };
});
StyledFileRowColumn.displayName = 'StyledFileRowColumn';

export const StyledFileRowUploadMessage = styled<'div', StyleProps>('div', (props) => {
  const {
    $color,
    $theme: { sizing, typography },
  } = props;
  return {
    ...typography.ParagraphXSmall,
    color: $color,
    alignItems: 'center',
    gap: sizing.scale100,
    display: 'flex',
    flexDirection: 'row',
  };
});
StyledFileRowUploadMessage.displayName = 'StyledFileRowUploadMessage';

export const StyledFileRowUploadText = styled<'div', StyleProps>('div', (props) => {
  const { $color } = props;
  return {
    color: $color ? $color : 'inherit',
    width: '100%',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  };
});
StyledFileRowUploadText.displayName = 'StyledFileRowUploadText';

export const StyledFileRows = styled<'ul', StyleProps>('ul', (props) => {
  const {
    $theme: { animation, borders, sizing },
  } = props;
  return {
    animationDuration: animation.timing500,
    animationIterationCount: 1,
    animationTimingFunction: animation.easeInOutQuinticCurve,
    animationName: {
      '0%': {
        transform: 'translateY(-32px)',
      },
      '100%': {
        transform: 'translateX(-0px)',
      },
    },
    ...borders.border200,
    borderRadius: borders.radius400,
    borderWidth: sizing.scale0,
    listStyle: 'none',
    padding: 0,
    marginTop: 0,
    marginBottom: sizing.scale300,
  };
});
StyledFileRows.displayName = 'StyledFileRows';

export const StyledHint = styled<'div', StyleProps>('div', (props) => {
  const {
    $fileCount,
    $theme: { animation, colors, typography },
  } = props;
  let fontColor = colors.contentTertiary;
  const animations =
    $fileCount > 0
      ? {
          animationDuration: animation.timing500,
          animationIterationCount: 1,
          animationTimingFunction: animation.easeInOutQuinticCurve,
          animationName: {
            '0%': {
              transform: 'translateY(-32px)',
            },
            '100%': {
              transform: 'translateX(-0px)',
            },
          },
        }
      : {};
  return {
    ...animations,
    ...typography.ParagraphSmall,
    color: fontColor,
  };
});
StyledHint.displayName = 'StyledHint';

export const StyledImagePreviewThumbnail = styled<'img', StyleProps>('img', (props) => {
  const {
    $alt,
    $src,
    $theme: { borders, colors },
  } = props;
  return {
    alt: $alt,
    borderRadius: borders.radius300,
    outline: `1px ${colors.borderTransparent}`,
    className: 'thumb',
    src: $src,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };
});
StyledImagePreviewThumbnail.displayName = 'StyledImagePreviewThumbnail';

export const StyledItemPreviewContainer = styled<'div', StyleProps>('div', (props) => {
  const {
    $theme: { sizing },
  } = props;
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: sizing.scale1200,
    height: sizing.scale1200,
  };
});
StyledItemPreviewContainer.displayName = 'StyledItemPreviewContainer';

export const StyledLabel = styled<'label', StyleProps>('label', (props) => {
  const {
    $disabled,
    $theme: { colors, sizing, typography },
  } = props;
  return {
    ...typography.LabelSmall,
    width: '100%',
    color: $disabled ? colors.contentStateDisabled : colors.contentPrimary,
    display: 'block',
    marginBottom: sizing.scale300,
  };
});
StyledLabel.displayName = 'StyledLabel';

export const StyledParentRoot = styled<'div', StyleProps>('div', () => {
  return {
    display: 'flex',
    flexDirection: 'column',
  };
});
StyledParentRoot.displayName = 'StyledParentRoot';

/* ROCOTO ─────────────────────────────────────────────────────────────────────────────────────
 * The doors. Every one of these is built the way Base builds the elements above it: `styled` on
 * a shared style-props object, every value read off `$theme`, and the focus ring taken from the
 * theme's own border rather than drawn. That is the point of forking rather than hand-rolling —
 * the new parts inherit the same rules as the old ones.
 */
import type { DoorStyleProps } from './types';

export const StyledDoors = styled<'div', StyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  gap: $theme.sizing.scale300,
  marginBottom: $theme.sizing.scale500,
}));
StyledDoors.displayName = 'StyledDoors';

export const StyledDoor = styled<'button', DoorStyleProps>('button', ({ $theme, $active, $disabled }) => ({
  ...$theme.typography.LabelSmall,
  appearance: 'none',
  cursor: $disabled ? 'not-allowed' : 'pointer',
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale500,
  paddingRight: $theme.sizing.scale500,
  borderRadius: $theme.borders.radius200,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $active ? $theme.colors.borderSelected : $theme.colors.borderOpaque,
  backgroundColor: $active ? $theme.colors.backgroundInversePrimary : $theme.colors.backgroundPrimary,
  color: $active ? $theme.colors.contentInversePrimary : $theme.colors.contentPrimary,
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
StyledDoor.displayName = 'StyledDoor';

/** THE CAMERA DOOR. A frame at a sheet's own proportion, so what the lens is looking at is the
 *  shape of the thing being photographed and the person aims by filling the frame. */
export const StyledViewfinder = styled<'div', StyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  width: '100%',
  aspectRatio: '210 / 297',
  maxHeight: '260px',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: $theme.borders.radius300,
  backgroundColor: $theme.colors.backgroundSecondary,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $theme.colors.borderOpaque,
}));
StyledViewfinder.displayName = 'StyledViewfinder';

/** The guide: four corner marks, the way every document camera draws them. It is inset from the
 *  frame so a sheet held slightly crooked still lands inside it. */
export const StyledGuide = styled<'div', StyleProps>('div', ({ $theme }) => ({
  position: 'absolute',
  top: $theme.sizing.scale600,
  right: $theme.sizing.scale600,
  bottom: $theme.sizing.scale600,
  left: $theme.sizing.scale600,
  pointerEvents: 'none',
  borderWidth: '2px',
  borderStyle: 'dashed',
  // ROCOTO: `borderOpaque` equals `backgroundSecondary` in Base's light theme, so a guide drawn
  // in it is painted onto its own ground and disappears. The guide has to be READ, so it takes a
  // content step.
  borderColor: $theme.colors.contentTertiary,
  borderRadius: $theme.borders.radius200,
}));
StyledGuide.displayName = 'StyledGuide';

/** THE ARRIVED DOOR. No control at all: a block that says where the file came from and when.
 *  A person's first act on a file they did not choose is reading it. */
export const StyledArrived = styled<'div', StyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale100,
  paddingTop: $theme.sizing.scale500,
  paddingBottom: $theme.sizing.scale500,
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  borderRadius: $theme.borders.radius300,
  backgroundColor: $theme.colors.backgroundSecondary,
  borderLeftWidth: '3px',
  borderLeftStyle: 'solid',
  borderLeftColor: $theme.colors.contentPrimary,
}));
StyledArrived.displayName = 'StyledArrived';

export const StyledArrivedLine = styled<'div', StyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentSecondary,
}));
StyledArrivedLine.displayName = 'StyledArrivedLine';
