/* FORKED from Base Web `src/sliding-button/styled-components.ts` (v16.1.1) on 2026-08-22.
 *
 * Why this fork exists: see `constants.ts`. Base Web is MIT licensed, Copyright (c) Uber
 * Technologies, Inc.; the upstream notice below travels with this copy as the licence requires,
 * and the full licence is vendored at app/src/rocoto/LICENSE.baseweb.txt. This file is a DERIVATIVE WORK.
 *
 * Every colour, radius, type step and timing here is still read off the theme exactly as Base
 * read it, so the driver's row re-brands with everything else. Rocoto's edits are marked
 * `ROCOTO:`.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import { styled } from "baseui";
import type { Theme } from "baseui";
import { TAP_OFFSET } from "./constants";
import type { StyleProps } from "./types";

/** ROCOTO: the two row heights, as theme steps. Base pinned one (`scale1400`); the driver's row
 *  is the taller one, and both remain the theme's own sizing so a re-brand carries them. */
export const rowHeight = ($theme: Theme, $size?: StyleProps["$size"]): string =>
  $size === "large" ? $theme.sizing.scale1600 : $theme.sizing.scale1400;

export const Root = styled<"div", StyleProps>("div", ({ $theme }) => ({
  width: "100%",
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
  ":focus": { outline: "none" },
  ":focus-visible": {
    outline: `3px solid ${$theme.colors.borderAccent}`,
    outlineOffset: "0px",
  },
}));
Root.displayName = "Root";

export const Track = styled<"div", StyleProps>(
  "div",
  ({ $theme, $isDisabled, $isInteractive, $size }) => ({
    position: "relative" as const,
    backgroundColor: $isDisabled
      ? $theme.colors.backgroundStateDisabled
      : $theme.colors.backgroundTertiary,
    borderTopLeftRadius: $theme.borders.radius300,
    borderTopRightRadius: $theme.borders.radius300,
    borderBottomLeftRadius: $theme.borders.radius300,
    borderBottomRightRadius: $theme.borders.radius300,
    // ROCOTO: two heights — `large` is the gloved row.
    height: rowHeight($theme, $size),
    overflow: "hidden" as const,
    userSelect: "none" as const,
    touchAction: "none" as const,
    // ROCOTO: THE WHOLE ROW IS THE TARGET. Base put the hand on a 56px grabber; a thumb in a
    // moving van lands on the customer's name, so the grab starts wherever the row was touched.
    cursor: $isInteractive ? "grab" : "default",
  }),
);
Track.displayName = "Track";

export const LoadingOverlay = styled<"div", StyleProps>(
  "div",
  ({ $theme }) => ({
    position: "absolute" as const,
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: $theme.colors.backgroundInversePrimary,
    borderTopLeftRadius: $theme.borders.radius300,
    borderTopRightRadius: $theme.borders.radius300,
    borderBottomLeftRadius: $theme.borders.radius300,
    borderBottomRightRadius: $theme.borders.radius300,
  }),
);
LoadingOverlay.displayName = "LoadingOverlay";

export const LoadingSpinner = styled<"div", StyleProps>(
  "div",
  ({ $theme }) => ({
    width: $theme.sizing.scale700,
    height: $theme.sizing.scale700,
    borderTopLeftRadius: "50%",
    borderTopRightRadius: "50%",
    borderBottomLeftRadius: "50%",
    borderBottomRightRadius: "50%",
    borderLeftWidth: $theme.sizing.scale0,
    borderTopWidth: $theme.sizing.scale0,
    borderRightWidth: $theme.sizing.scale0,
    borderBottomWidth: $theme.sizing.scale0,
    borderLeftStyle: "solid" as const,
    borderTopStyle: "solid" as const,
    borderRightStyle: "solid" as const,
    borderBottomStyle: "solid" as const,
    borderLeftColor: $theme.colors.borderInverseOpaque,
    borderRightColor: $theme.colors.borderInverseOpaque,
    borderBottomColor: $theme.colors.borderInverseOpaque,
    borderTopColor: $theme.colors.contentInversePrimary,
    boxSizing: "border-box" as const,
    animationName: {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" },
    },
    animationDuration: "0.75s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  }),
);
LoadingSpinner.displayName = "LoadingSpinner";

export const Label = styled<"div", StyleProps>(
  "div",
  ({ $theme, $isDisabled, $isActuallySliding, $isCompleted, $isRtl, $size }) => {
    const startProperty = $isRtl ? "right" : "left";
    const endProperty = $isRtl ? "left" : "right";
    return {
      position: "absolute" as const,
      top: "0",
      [startProperty]: rowHeight($theme, $size),
      [endProperty]: "0",
      bottom: "0",
      display: "flex",
      alignItems: "center",
      // ROCOTO: the stop reads from the start of the row, not from its centre. Base centres a
      // word; a stop is a block of facts and a block of facts is read down a left edge.
      justifyContent: "flex-start",
      paddingLeft: $theme.sizing.scale500,
      paddingRight: $theme.sizing.scale500,
      color:
        $isDisabled || $isActuallySliding
          ? $theme.colors.contentStateDisabled
          : $theme.colors.contentPrimary,
      opacity: $isCompleted ? 0 : 1,
      transitionProperty: "opacity, color",
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: "ease-out",
      pointerEvents: "none" as const,
      ...$theme.typography.LabelLarge,
      fontWeight: 500,
    };
  },
);
Label.displayName = "Label";

export const Slider = styled<"div", StyleProps>(
  "div",
  ({
    $theme,
    $isDisabled,
    $isDragging,
    $dragOffset,
    $sliderWidth,
    $isCompleted,
    $isRtl,
  }) => {
    const startProperty = $isRtl ? "right" : "left";
    const endAlign = $isRtl ? "flex-start" : "flex-end";
    const paddingEnd = $isRtl ? "paddingLeft" : "paddingRight";
    const suppressTransition = $isDragging && $dragOffset !== TAP_OFFSET;
    return {
      position: "absolute" as const,
      top: "0",
      [startProperty]: "0",
      bottom: "0",
      width: $sliderWidth,
      backgroundColor: $isDisabled
        ? $theme.colors.backgroundStateDisabled
        : $theme.colors.backgroundInversePrimary,
      borderTopLeftRadius: $theme.borders.radius300,
      borderTopRightRadius: $theme.borders.radius300,
      borderBottomLeftRadius: $theme.borders.radius300,
      borderBottomRightRadius: $theme.borders.radius300,
      display: "flex",
      alignItems: "center",
      justifyContent: endAlign,
      [paddingEnd]: $isCompleted ? $theme.sizing.scale600 : "0",
      overflow: "hidden" as const,
      ...(suppressTransition
        ? { transition: "none" }
        : {
            transitionProperty: "width",
            transitionDuration: $theme.animation.timing200,
            transitionTimingFunction: "ease-out",
          }),
    };
  },
);
Slider.displayName = "Slider";

export const CompletedLabel = styled<"div", StyleProps>(
  "div",
  ({ $theme, $isDisabled, $size }) => ({
    position: "absolute" as const,
    top: "0",
    left: "0",
    // ROCOTO: the swept row keeps its handle clear, so the tick stays visible beside what the row
    // now says.
    right: rowHeight($theme, $size),
    bottom: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: $theme.sizing.scale500,
    paddingRight: $theme.sizing.scale500,
    color: $isDisabled
      ? $theme.colors.contentStateDisabled
      : $theme.colors.contentInversePrimary,
    pointerEvents: "none" as const,
    ...$theme.typography.LabelLarge,
    fontWeight: 500,
  }),
);
CompletedLabel.displayName = "CompletedLabel";

export const Grabber = styled<"div", StyleProps>(
  "div",
  ({ $theme, $isDisabled, $isInteractive, $size }) => ({
    width: rowHeight($theme, $size),
    height: rowHeight($theme, $size),
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: $isDisabled
      ? $theme.colors.contentStateDisabled
      : $theme.colors.contentInversePrimary,
    cursor: $isInteractive ? "grab" : "default",
    touchAction: "none" as const,
  }),
);
Grabber.displayName = "Grabber";
