/* LA ENTREGA — the driver's swipe at the door.
 *
 * FORKED from Base Web `src/sliding-button/sliding-button.tsx` (v16.1.1) on 2026-08-22.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.; the upstream notice below
 * travels with this copy as the licence requires, and the full licence is vendored at
 * app/src/rocoto/LICENSE.baseweb.txt. This file is a DERIVATIVE WORK.
 *
 * INHERITED UNTOUCHED, and deliberately so: the `overrides` contract, `getOverrides`, the
 * shared-props shape, the theme-driven styling, the focus ring, the Enter/Space path for a hand
 * that is on a keyboard rather than on a windscreen, the disabled and loading states, and the
 * animation tokens.
 *
 * ROCOTO'S FOUR EDITS, each marked at its site and listed in CHANGES.md:
 *   1. THE ROW CARRIES THE STOP. `label` is a node, and it reads from the row's left edge rather
 *      than from its centre, because the thing being read and the thing being swiped are one
 *      object: the customer, the address, and the amount to collect.
 *   2. THE WHOLE TRACK IS THE TARGET. Base put the hand on a 56px grabber; a thumb in a moving van
 *      lands on the customer's name. The grab starts wherever the row was touched.
 *   3. THE AFTER-STATE IS ITS OWN WORDS. Base repeats the label on the filled slider; a driver
 *      already read the stop and what they want back is the receipt — «Delivered 09:42».
 *   4. THE ROW CAN ARRIVE SWEPT. `isCompleted` is controllable, so a morning's list re-read at the
 *      fourth stop shows the first three as done rather than animating them again.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ArrowRight from "baseui/icon/arrow-right";
import Check from "baseui/icon/check";
import { getOverrides } from "baseui/helpers/overrides";
import { useStyletron } from "baseui";
import {
  Root as StyledRoot,
  Track as StyledTrack,
  Slider as StyledSlider,
  Label as StyledLabel,
  CompletedLabel as StyledCompletedLabel,
  Grabber as StyledGrabber,
  LoadingOverlay as StyledLoadingOverlay,
  LoadingSpinner as StyledLoadingSpinner,
} from "./styled-components";
import {
  BUTTON_SIZE,
  BUTTON_SIZE_LARGE,
  TAP_OFFSET,
  THRESHOLD_VALUES,
} from "./constants";
import { defaultProps } from "./default-props";

import type { EntregaProps, StyleProps } from "./types";

function EntregaInner(
  {
    label,
    completedLabel,
    threshold = defaultProps.threshold,
    size = defaultProps.size,
    isLoading = defaultProps.isLoading,
    isDisabled = defaultProps.isDisabled,
    isCompleted: isCompletedProp,
    onComplete,
    overrides = defaultProps.overrides,
    slideBackAfterMs,
    "aria-label": ariaLabel,
  }: EntregaProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const [, theme] = useStyletron();
  const isRtl = theme.direction === "rtl";

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isCompletedState, setIsCompleted] = useState(false);

  /* ROCOTO 4: the row can arrive swept. A controlled `isCompleted` wins; left out, the row runs
     its own state exactly as Base's does. */
  const isCompleted = isCompletedProp ?? isCompletedState;

  const dragStartRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const thresholdValue = THRESHOLD_VALUES[threshold];
  const isInteractive = !isDisabled && !isLoading && !isCompleted;
  const buttonSize = size === "large" ? BUTTON_SIZE_LARGE : BUTTON_SIZE;

  // -- Pointer handlers -------------------------------------------------------

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isInteractive) return;
      setIsDragging(true);
      isDraggingRef.current = true;
      setDragOffset(TAP_OFFSET);
      const pos = isRtl ? -e.clientX : e.clientX;
      dragStartRef.current = pos - TAP_OFFSET;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isInteractive, isRtl],
  );

  const resetDrag = useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
    if (!isCompleted) {
      setDragOffset(0);
    }
  }, [isCompleted]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current || isCompleted)
        return;

      const pos = isRtl ? -e.clientX : e.clientX;
      const delta = pos - dragStartRef.current;
      if (delta <= 0) return;

      const containerWidth = containerRef.current.offsetWidth;
      const maxOffset = containerWidth - buttonSize;
      const thresholdPixels = containerWidth * thresholdValue;

      if (delta > thresholdPixels) {
        setDragOffset(maxOffset);
        setIsCompleted(true);
        setIsDragging(false);
        isDraggingRef.current = false;
        onComplete?.();
      } else {
        setDragOffset(Math.min(delta, maxOffset));
      }
    };

    const handleGlobalPointerUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (!isCompleted) {
        setDragOffset(0);
      }
    };

    if (isDragging) {
      document.addEventListener("pointermove", handleGlobalPointerMove);
      document.addEventListener("pointerup", handleGlobalPointerUp);
      return () => {
        document.removeEventListener("pointermove", handleGlobalPointerMove);
        document.removeEventListener("pointerup", handleGlobalPointerUp);
      };
    }
  }, [isDragging, thresholdValue, isCompleted, onComplete, isRtl, buttonSize]);

  // -- Slide-back timer -------------------------------------------------------

  useEffect(() => {
    if (!isCompleted || slideBackAfterMs == null || slideBackAfterMs <= 0)
      return;
    const timerId = setTimeout(() => {
      setIsCompleted(false);
      setDragOffset(0);
    }, slideBackAfterMs);
    return () => clearTimeout(timerId);
  }, [isCompleted, slideBackAfterMs]);

  // -- Keyboard handler -------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isInteractive) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsCompleted(true);
        onComplete?.();
      }
    },
    [isInteractive, onComplete],
  );

  // -- Early return -----------------------------------------------------------

  if (!label) {
    return null;
  }

  // -- Derived values ---------------------------------------------------------

  const sliderWidth = isCompleted ? "100%" : `${buttonSize + dragOffset}px`;
  const isActuallySliding = isDragging && dragOffset > TAP_OFFSET;

  const sharedProps: StyleProps = {
    $isDisabled: isDisabled,
    $isLoading: isLoading,
    $isCompleted: isCompleted,
    $isDragging: isDragging,
    $isInteractive: isInteractive,
    $isActuallySliding: isActuallySliding,
    $dragOffset: dragOffset,
    $sliderWidth: sliderWidth,
    $isRtl: isRtl,
    $size: size,
  };

  // -- Overrides --------------------------------------------------------------

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Track, trackProps] = getOverrides(overrides.Track, StyledTrack);
  const [SliderEl, sliderProps] = getOverrides(overrides.Slider, StyledSlider);
  const [LabelEl, labelProps] = getOverrides(overrides.Label, StyledLabel);
  const [CompletedLabelEl, completedLabelProps] = getOverrides(
    overrides.CompletedLabel,
    StyledCompletedLabel,
  );
  const [GrabberEl, grabberProps] = getOverrides(
    overrides.Grabber,
    StyledGrabber,
  );
  const [LoadingOverlayEl, loadingOverlayProps] = getOverrides(
    overrides.LoadingOverlay,
    StyledLoadingOverlay,
  );
  const [LoadingSpinnerEl, loadingSpinnerProps] = getOverrides(
    overrides.LoadingSpinner,
    StyledLoadingSpinner,
  );

  // -- Aria -------------------------------------------------------------------

  const ariaProps: Record<string, string | boolean | undefined> = {
    "aria-label": ariaLabel,
  };
  if (isLoading) {
    ariaProps["aria-busy"] = true;
    ariaProps["aria-live"] = "polite";
  }
  if (isDisabled) {
    ariaProps["aria-disabled"] = true;
  }

  // -- Render -----------------------------------------------------------------

  return (
    <Root
      ref={ref}
      data-baseweb="entrega"
      tabIndex={0}
      role="button"
      onKeyDown={handleKeyDown}
      {...ariaProps}
      {...sharedProps}
      {...rootProps}
    >
      {/* ROCOTO 2: the hand goes on the TRACK. Base bound `onPointerDown` to the grabber alone;
          the driver's thumb lands on the stop, so the whole row starts the drag and the grabber
          keeps only its job of saying which way the row travels. */}
      <Track
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerUp={resetDrag}
        onPointerCancel={resetDrag}
        {...sharedProps}
        {...trackProps}
      >
        {isLoading && (
          <LoadingOverlayEl {...sharedProps} {...loadingOverlayProps}>
            <LoadingSpinnerEl {...sharedProps} {...loadingSpinnerProps} />
          </LoadingOverlayEl>
        )}

        {!isLoading && (
          <>
            {/* ROCOTO 1: the stop itself, read from the row's left edge. */}
            <LabelEl {...sharedProps} {...labelProps}>
              {label}
            </LabelEl>

            <SliderEl {...sharedProps} {...sliderProps}>
              {isCompleted && (
                /* ROCOTO 3: what the row says afterwards, which is the receipt for the act and
                   not a repeat of the stop. */
                <CompletedLabelEl {...sharedProps} {...completedLabelProps}>
                  {completedLabel ?? label}
                </CompletedLabelEl>
              )}

              <GrabberEl
                data-baseweb="entrega-grabber"
                {...sharedProps}
                {...grabberProps}
              >
                <ArrowIcon isCompleted={isCompleted} />
              </GrabberEl>
            </SliderEl>
          </>
        )}
      </Track>
    </Root>
  );
}

function ArrowIcon({ isCompleted }: { isCompleted: boolean }) {
  if (isCompleted) {
    return <Check title="" size="24px" />;
  }
  return <ArrowRight title="" size="24px" />;
}

const Entrega = React.forwardRef<HTMLDivElement, EntregaProps>(EntregaInner);
Entrega.displayName = "Entrega";
export default Entrega;
