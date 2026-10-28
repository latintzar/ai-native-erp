/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto component exactly the way it imports a Base one.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
export { default as VoiceButton } from './voice-button';
export { default as StatefulVoiceButton } from './stateful-voice-button';
export { default as StatefulVoiceButtonContainer } from './stateful-container';
// Constants
export {
  PHASE,
  SIZE,
  LABELS,
  CANCEL_DISTANCE,
  LOCK_DISTANCE,
  MIN_RECORD_MS,
  TAP_MAX_MS,
  TAP_SLOP,
  POLL_MS,
  LOCK_CHIP_MAX,
  LOCK_CHIP_MIN,
  HINT_MS,
} from './constants';
// The recorder machine — real microphone, deterministic fallback, one interface
export { VoiceRecorder, createRecorder } from './recorder';
export type { Recorder, RecorderOptions, Source } from './recorder';
// The two glyphs Base does not ship
export { Microphone, Lock } from './icons';
// Styled elements
export {
  Root as StyledRoot,
  Row as StyledRow,
  Bar as StyledBar,
  Dot as StyledDot,
  Timer as StyledTimer,
  Meter as StyledMeter,
  CancelHint as StyledCancelHint,
  CancelZone as StyledCancelZone,
  MicBox as StyledMicBox,
  Mic as StyledMic,
  LockChip as StyledLockChip,
  LockedPanel as StyledLockedPanel,
  LockedPill as StyledLockedPill,
  LockedControls as StyledLockedControls,
  HandsFree as StyledHandsFree,
  Discard as StyledDiscard,
  Send as StyledSend,
  Hint as StyledHint,
} from './styled-components';
// Types
export * from './types';
