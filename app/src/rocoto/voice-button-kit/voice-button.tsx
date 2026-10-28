/* VOICE BUTTON — press and hold to record; drag to cancel; drag up to go hands-free.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`, and split the way Base splits
 * every stateful control it ships: a CONTROLLED component that draws a state it is handed, and a
 * stateful one beside it that owns the machine. Base Web is MIT licensed, Copyright (c) Uber
 * Technologies, Inc.
 *
 * WHY THE SPLIT EARNS ITS KEEP HERE MORE THAN ANYWHERE ELSE: this control has five states and
 * four of them exist only under a finger. A page that could not pin them would have to draw them
 * as pictures, and a picture of a state is a claim that drifts the first time the real one
 * changes. Because this component decides nothing, the kit page puts all five on screen at once —
 * every one of them the real component, rendering real marks, off the real theme.
 *
 * THE PHASES, and what each one is for:
 *   idle       a mic. That is the whole control until it is pressed.
 *   recording  the writing surface is replaced by the take: the open-microphone mark, the
 *              elapsed time, the live meter, and the sentence that teaches the gesture.
 *   recording  · cancel armed — dragged 90px left. The row says one thing, and releasing
 *              anywhere now throws the take away.
 *   locked     hands-free. The finger left the glass, so the control grows the two verbs it now
 *              needs, and Enter and Escape reach them from the keyboard.
 *
 * WHAT COLOUR DOES HERE: nothing. There is no red recording light and no green send — the
 * blinking mark says the microphone is open, the sentence says what a release will do, and the
 * weight of the two locked controls says which one the recorder expects.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { isFocusVisible, forkFocus, forkBlur } from 'baseui/utils/focusVisible';
import ArrowLeft from 'baseui/icon/arrow-left';
import ArrowUp from 'baseui/icon/arrow-up';
import ChevronUp from 'baseui/icon/chevron-up';
import TrashCanFilled from 'baseui/icon/trash-can-filled';
import { Waveform } from '../waveform';
import { clamp, formatMs } from '../waveform/utils';
import { CANCEL_DISTANCE, LABELS, LOCK_CHIP_MAX, LOCK_CHIP_MIN, LOCK_DISTANCE, PHASE, SIZE } from './constants';
import { Lock, Microphone } from './icons';
import {
  Bar as StyledBar,
  CancelHint as StyledCancelHint,
  CancelZone as StyledCancelZone,
  Discard as StyledDiscard,
  Dot as StyledDot,
  HandsFree as StyledHandsFree,
  Hint as StyledHint,
  LockChip as StyledLockChip,
  LockedControls as StyledLockedControls,
  LockedPanel as StyledLockedPanel,
  LockedPill as StyledLockedPill,
  Meter as StyledMeter,
  Mic as StyledMic,
  MicBox as StyledMicBox,
  Root as StyledRoot,
  Row as StyledRow,
  Send as StyledSend,
  Timer as StyledTimer,
} from './styled-components';
import type { SharedStyleProps, VoiceButtonProps } from './types';

/** Base's own focus-visible bookkeeping, one control at a time */
function useFocusRing(): [boolean, (event: React.FocusEvent) => void, () => void] {
  const [visible, setVisible] = React.useState(false);
  const onFocus = (event: React.FocusEvent) => {
    if (isFocusVisible(event)) setVisible(true);
  };
  const onBlur = () => {
    if (visible) setVisible(false);
  };
  return [visible, onFocus, onBlur];
}

const VoiceButton = (props: VoiceButtonProps) => {
  const {
    phase = PHASE.idle,
    elapsedMs = 0,
    dragX = 0,
    dragY = 0,
    cancelArmed = false,
    amplitude,
    hint,
    disabled = false,
    size = SIZE.default,
    labels: labelOverrides,
    sendRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    onDiscard,
    onSend,
    overrides = {},
  } = props;

  const labels = { ...LABELS, ...labelOverrides };

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Row, rowProps] = getOverrides(overrides.Row, StyledRow);
  const [Bar, barProps] = getOverrides(overrides.Bar, StyledBar);
  const [Dot, dotProps] = getOverrides(overrides.Dot, StyledDot);
  const [Timer, timerProps] = getOverrides(overrides.Timer, StyledTimer);
  const [Meter, meterProps] = getOverrides(overrides.Meter, StyledMeter);
  const [CancelHint, cancelHintProps] = getOverrides(overrides.CancelHint, StyledCancelHint);
  const [CancelZone, cancelZoneProps] = getOverrides(overrides.CancelZone, StyledCancelZone);
  const [MicBox, micBoxProps] = getOverrides(overrides.MicBox, StyledMicBox);
  const [Mic, micProps] = getOverrides(overrides.Mic, StyledMic);
  const [LockChip, lockChipProps] = getOverrides(overrides.LockChip, StyledLockChip);
  const [LockedPanel, lockedPanelProps] = getOverrides(overrides.LockedPanel, StyledLockedPanel);
  const [LockedPill, lockedPillProps] = getOverrides(overrides.LockedPill, StyledLockedPill);
  const [LockedControls, lockedControlsProps] = getOverrides(
    overrides.LockedControls,
    StyledLockedControls
  );
  const [HandsFree, handsFreeProps] = getOverrides(overrides.HandsFree, StyledHandsFree);
  const [Discard, discardProps] = getOverrides(overrides.Discard, StyledDiscard);
  const [Send, sendProps] = getOverrides(overrides.Send, StyledSend);
  const [Hint, hintProps] = getOverrides(overrides.Hint, StyledHint);

  const [micRing, micFocus, micBlur] = useFocusRing();
  const [discardRing, discardFocus, discardBlur] = useFocusRing();
  const [sendRing, sendFocus, sendBlur] = useFocusRing();

  const recording = phase === PHASE.recording;
  const locked = phase === PHASE.locked;
  const chipVisible = recording && !cancelArmed;

  /* THE TWO PROGRESSES. Both are read off the finger's travel and both are spent on the same
     thing: showing how much of a gesture has already been made, so nothing about it is a
     surprise at the moment of release. */
  const cancelProgress = clamp(Math.abs(Math.min(0, dragX)) / CANCEL_DISTANCE, 0, 1);
  const lockProgress = clamp(Math.abs(Math.min(0, dragY)) / LOCK_DISTANCE, 0, 1);
  const chipHeight = LOCK_CHIP_MAX - (LOCK_CHIP_MAX - LOCK_CHIP_MIN) * lockProgress;
  // the mic hands over to the chip as the finger climbs: by the lock line it has gone
  const micOpacity = recording ? clamp(1 - lockProgress * 1.4, 0, 1) : 1;

  const shared: SharedStyleProps = {
    $phase: phase,
    $size: size,
    $disabled: disabled,
    $cancelArmed: cancelArmed,
    $isFocusVisible: false,
  };
  const waveformSize = size === SIZE.compact ? 'compact' : 'default';
  const glyph = size === SIZE.compact ? 20 : 24;

  /* The meter is hidden from assistive tech on purpose. What it carries — «the microphone is
     hearing you» — is already carried by the open-microphone mark and the running clock beside
     it, and a `role="img"` announcing «Audio level» over and over during a take is noise. */
  const meter = (
    <Meter aria-hidden="true" {...shared} {...meterProps}>
      <Waveform mode="live" amplitude={amplitude} size={waveformSize} />
    </Meter>
  );

  return (
    <Root data-baseweb="voice-button" {...shared} {...rootProps}>
      {hint && (
        <Hint role="status" {...shared} {...hintProps}>
          {hint}
        </Hint>
      )}

      <Row {...shared} {...rowProps}>
        {recording && (
          <Bar {...shared} {...barProps}>
            {cancelArmed ? (
              <CancelZone role="status" {...shared} {...cancelZoneProps}>
                <TrashCanFilled size={glyph} title="" />
                <span>{labels.releaseToCancel}</span>
              </CancelZone>
            ) : (
              <>
                <Dot {...shared} {...dotProps} />
                <Timer {...shared} {...timerProps}>
                  {formatMs(elapsedMs)}
                </Timer>
                {meter}
                <CancelHint
                  {...shared}
                  {...cancelHintProps}
                  style={{
                    transform: `translateX(${Math.round(Math.min(0, dragX) * 0.35)}px)`,
                    opacity: 1 - cancelProgress * 0.6,
                  }}
                >
                  <ArrowLeft size={16} title="" />
                  <span>{labels.slideToCancel}</span>
                </CancelHint>
              </>
            )}
          </Bar>
        )}

        {locked && (
          <LockedPanel {...shared} {...lockedPanelProps}>
            <LockedPill {...shared} {...lockedPillProps}>
              <Dot {...shared} {...dotProps} />
              <Timer {...shared} {...timerProps}>
                {formatMs(elapsedMs)}
              </Timer>
              {meter}
              {/* THE WAVEFORM SAYS IT (Peter, §45: «no shit lol, you can see the waveform»).
                  The lock mark alone says the hands are free; a sentence about recording while
                  the meter moves is the software narrating itself. */}
              <HandsFree {...shared} {...handsFreeProps} aria-label={labels.stillRecording}>
                <Lock size={14} title="" />
              </HandsFree>
            </LockedPill>
            <LockedControls {...shared} {...lockedControlsProps}>
              <Discard
                type="button"
                aria-label={labels.discard}
                onClick={onDiscard}
                onFocus={forkFocus(discardProps, discardFocus)}
                onBlur={forkBlur(discardProps, discardBlur)}
                {...shared}
                $isFocusVisible={discardRing}
                {...discardProps}
              >
                <TrashCanFilled size={glyph} title="" />
              </Discard>
              <Send
                ref={sendRef}
                type="button"
                aria-label={labels.send}
                onClick={onSend}
                onFocus={forkFocus(sendProps, sendFocus)}
                onBlur={forkBlur(sendProps, sendBlur)}
                {...shared}
                $isFocusVisible={sendRing}
                {...sendProps}
              >
                <ArrowUp size={glyph} title="" />
              </Send>
            </LockedControls>
          </LockedPanel>
        )}

        {!locked && (
          <MicBox {...shared} {...micBoxProps}>
            {chipVisible && (
              <LockChip
                aria-hidden="true"
                {...shared}
                {...lockChipProps}
                style={{ height: `${chipHeight}px` }}
              >
                <Lock size={20} title="" style={{ opacity: 0.35 + 0.65 * lockProgress }} />
                <ChevronUp size={16} title="" style={{ opacity: 1 - lockProgress }} />
              </LockChip>
            )}
            <Mic
              type="button"
              aria-label={labels.record}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onKeyDown={onKeyDown}
              onFocus={forkFocus(micProps, micFocus)}
              onBlur={forkBlur(micProps, micBlur)}
              {...shared}
              $isFocusVisible={micRing}
              {...micProps}
              style={{ opacity: micOpacity }}
            >
              <Microphone size={glyph} title="" />
            </Mic>
          </MicBox>
        )}
      </Row>
    </Root>
  );
};

export default VoiceButton;
