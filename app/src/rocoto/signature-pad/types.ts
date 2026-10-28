/* GROWN from Base Web's own `src/template-component/types.ts` — same `$`-prefixed shared style
 * props, same `Overrides` shape, same prop idiom.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, STATE } from './constants';

export type Size = keyof typeof SIZE;
export type State = keyof typeof STATE;

/** ONE SAMPLE OF THE HAND: where it was, and when. There is no third field, and the missing one
 *  is pressure — see `PRESSURE_SAMPLED` in constants.ts for why it stays missing. */
export type SignaturePoint = { x: number; y: number; t: number };

/** one continuous run of the hand, between a touch and a lift */
export type SignatureStroke = SignaturePoint[];

/** WHAT IS KEPT. The path is what a record stores and replays; the strokes are what it was drawn
 *  from, kept so the same signature can be re-inked at another size or re-smoothed later. Both
 *  are stated in the box they were captured in, so neither means anything without it. */
export type SignatureValue = {
  /** every run of the hand, in capture coordinates */
  strokes: SignatureStroke[];
  /** the whole signature as one SVG path — the storable, replayable form */
  path: string;
  /** the width of the surface the signature was captured on */
  width: number;
  /** the height of the surface the signature was captured on */
  height: number;
  /** how long the hand took, in ms — what a replay runs at */
  durationMs: number;
  /** a typed name standing as the signature, for a hand that signs by saying who it is */
  typedName?: string;
};

export type SignaturePadOverrides = {
  Root?: Override;
  /** the pad's visible name */
  Label?: Override;
  /** the signing surface itself */
  Pad?: Override;
  /** the canvas the live stroke is inked on */
  Canvas?: Override;
  /** the SVG a stored signature is drawn in */
  Mark?: Override;
  /** the stored signature's path */
  Ink?: Override;
  /** a typed name standing in the mark's place */
  TypedMark?: Override;
  /** the signing line */
  Baseline?: Override;
  /** the ✕ that marks where the line starts */
  Cross?: Override;
  /** the prompt on an empty surface */
  Prompt?: Override;
  /** the row holding Clear and Confirm */
  Actions?: Override;
  /** the line under the pad: the hint, or what is required */
  Caption?: Override;
  /** the typed-name field */
  Fallback?: Override;
};

export type SignaturePadProps = {
  size?: Size;
  /** pins the pad to one state; leave it out and the pad runs its own */
  state?: State;
  disabled?: boolean;
  /** a signature is required here — the pad says which one, in `errorText` */
  error?: boolean;
  /** the compact record variant: the stored mark, shown small, taking nothing */
  readOnly?: boolean;
  /** the signature the pad shows — pass it to control the pad, `null` for none */
  value?: SignatureValue | null;
  /** the signature the pad starts with when it runs itself */
  defaultValue?: SignatureValue | null;
  /** what the pad is called, above it and to a screen reader */
  label?: string;
  /** the line under the pad in every state but error; the state's own words when absent */
  hint?: string;
  /** what is required, said under a pad in the error state */
  errorText?: string;
  /** the typed-name path is offered — a hand that cannot draw still signs */
  typedName?: boolean;
  /** the typed name — pass it to control the field */
  typedNameValue?: string;
  onTypedNameChange?: (typedName: string) => void;
  /** every stroke and every clear, as it lands */
  onChange?: (value: SignatureValue | null) => void;
  /** the signature, at the moment it is confirmed */
  onConfirm?: (value: SignatureValue) => void;
  onClear?: () => void;
  confirmLabel?: string;
  clearLabel?: string;
  /** a stored mark draws itself in, over the time the signing took */
  replay?: boolean;
  /** how far the hand must travel, in px, before the marks count as a signature */
  minTravel?: number;
  overrides?: SignaturePadOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $state: State;
  $readOnly: boolean;
  $isFocusVisible: boolean;
  /** there is something to show: strokes, or a typed name */
  $hasMark: boolean;
};
