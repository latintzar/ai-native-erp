/* GROWN from Base Web's own `src/template-component/types.ts` — same `$`-prefixed shared style
 * props, same `Overrides` shape, same split between the controlled component and the stateful
 * one that drives it.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { LABELS, PHASE, SIZE } from './constants';
import type { Source } from './recorder';
import type { AmplitudeSource } from '../waveform';

export type Phase = keyof typeof PHASE;
export type Size = keyof typeof SIZE;

/** every string this control says */
export type VoiceButtonLabels = { [K in keyof typeof LABELS]: string };

/** what a finished press hands back */
export type Take = {
  /** the audio — null when the level was simulated, so the caller can tell a demo from a take */
  blob: Blob | null;
  durationMs: number;
  source: Source;
};

export type VoiceButtonOverrides = {
  Root?: Override;
  /** the row the bar and the mic share */
  Row?: Override;
  /** the recording bar, where the writing surface was */
  Bar?: Override;
  /** the blinking mark that says the microphone is open */
  Dot?: Override;
  /** the elapsed readout */
  Timer?: Override;
  /** the live meter's slot inside the bar */
  Meter?: Override;
  /** «Slide to cancel», riding the finger */
  CancelHint?: Override;
  /** «Release to cancel», once the zone is armed */
  CancelZone?: Override;
  /** the mic's own box — it grows to hold the lock chip */
  MicBox?: Override;
  Mic?: Override;
  LockChip?: Override;
  /** the hands-free recorder */
  LockedPanel?: Override;
  LockedPill?: Override;
  LockedControls?: Override;
  HandsFree?: Override;
  Discard?: Override;
  Send?: Override;
  /** the line shown after a take too short to keep */
  Hint?: Override;
};

/* THE CONTROLLED COMPONENT. It holds no machine and decides nothing: hand it a phase and it draws
 * that phase, which is what lets the kit page put every state on the page at once, side by side,
 * without faking any of them. `StatefulVoiceButton` is the one you reach for in a product. */
export type VoiceButtonProps = {
  /** where the machine stands: idle · recording · locked */
  phase?: Phase;
  /** how long this take has run, in ms */
  elapsedMs?: number;
  /** how far the finger has travelled left — the cancel zone arms at 90px */
  dragX?: number;
  /** how far the finger has travelled up — the recorder locks at 70px */
  dragY?: number;
  /** the cancel zone is armed: releasing now throws the take away */
  cancelArmed?: boolean;
  /** the level source the meter reads, 0…1 */
  amplitude?: AmplitudeSource;
  /** the line under the control — the discard hint after a take too short to keep */
  hint?: React.ReactNode;
  disabled?: boolean;
  size?: Size;
  /** override one line, or all of them */
  labels?: Partial<VoiceButtonLabels>;
  /** the locked recorder's send control, so a keyboard start can put focus where Enter works */
  sendRef?: React.Ref<HTMLButtonElement>;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  /** the locked recorder's left verb */
  onDiscard?: () => void;
  /** the locked recorder's right verb */
  onSend?: () => void;
  overrides?: VoiceButtonOverrides;
};

/* THE STATEFUL COMPONENT — the gesture machine, the recorder and the clock. */
export type StatefulVoiceButtonProps = {
  /** a kept take: held past 1000ms and released, or sent from the locked recorder */
  onRecord?: (take: Take) => void;
  /** released inside the cancel zone, discarded from the locked recorder, or Escape */
  onCancel?: () => void;
  /** released under 1000ms — the take is dropped and the hint goes up */
  onTooShort?: () => void;
  onPhaseChange?: (phase: Phase) => void;
  /** THE CONTROL NEEDS THE ROW. True from the moment a take starts until the control is back to
   *  one idle button with nothing to say — so it covers recording, hands-free AND the line left
   *  up after a take too short to keep. A host that seats this control in a one-button slot (a
   *  Composer's voice seat) reads this and hands the row over for exactly that long; anything
   *  narrower and the take paints outside the seat. */
  onBusyChange?: (busy: boolean) => void;
  /** skip the microphone and run the deterministic level source */
  simulate?: boolean;
  /** the seed that source replays from — same seed, same meter */
  seed?: string;
  disabled?: boolean;
  size?: Size;
  labels?: Partial<VoiceButtonLabels>;
  overrides?: VoiceButtonOverrides;
};

/** what the container hands its child — the controlled component's props, already wired */
export type VoiceButtonRenderProps = VoiceButtonProps & {
  /** which source the running take got, or null between takes */
  source: Source | null;
};

export type StatefulVoiceButtonContainerProps = Omit<StatefulVoiceButtonProps, 'overrides'> & {
  children: (props: VoiceButtonRenderProps) => React.ReactNode;
};

export type SharedStyleProps = {
  $phase: Phase;
  $size: Size;
  $disabled: boolean;
  $cancelArmed: boolean;
  $isFocusVisible: boolean;
};
