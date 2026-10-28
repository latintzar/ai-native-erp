/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract — with the props that govern a layer taken from Base Web's own
 * `src/modal/types.ts`. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { PLACEMENT, SIZE, SCRIM, PHASE, CLOSE_SOURCE, ROLE } from './constants';

export type Placement = keyof typeof PLACEMENT;
export type Size = keyof typeof SIZE;
/** a named size, a pixel number, or any CSS width */
export type SizeProp = Size | number | string;
export type Scrim = keyof typeof SCRIM;
export type Phase = keyof typeof PHASE;
export type CloseSource = keyof typeof CLOSE_SOURCE;
export type Role = keyof typeof ROLE;
export type RoleProp = Role | string;

export type OverlayCardOverrides = {
  /** the layer that fills the viewport, or the mount node when one is given */
  Root?: Override;
  /** the ground between the layer and the card */
  Scrim?: Override;
  /** the card itself */
  Card?: Override;
};

export type OverlayCardProps = {
  /** Whether the card is on the layer. */
  isOpen?: boolean;
  /** Called when the card asks to close, with what asked. */
  onClose?: (a: { closeSource?: CloseSource }) => unknown;
  /** The one decision. A function is called only once the card opens. */
  children?: React.ReactNode | (() => React.ReactNode);
  /** center (default) or bottom, where the same card reads as a sheet */
  placement?: Placement;
  size?: SizeProp;
  /** how much of the surface underneath the scrim takes */
  scrim?: Scrim;
  /** When false the card stays until its own action closes it: the scrim and Escape are inert. */
  dismissable?: boolean;
  /** Whether the card eases on and off the layer. */
  animate?: boolean;
  /** Move focus to the first interactive element inside the card. When false the card itself
   *  takes focus, so the keyboard still starts inside it. */
  autoFocus?: boolean;
  /** Hold the keyboard inside the card. With `scrim="none"` the surface underneath stays live to
   *  the pointer; pass false to leave it live to the keyboard too. */
  focusLock?: boolean;
  /** Return focus to where it came from when the card leaves. */
  returnFocus?: boolean | FocusOptions | ((returnTo: Element) => boolean | FocusOptions);
  /** Where the card mounts. Given one, the card fills THAT element instead of the viewport — the
   *  element needs its own positioning context (`position: relative`). */
  mountNode?: HTMLElement;
  /** dialog (default) or alertdialog */
  role?: RoleProp;
  /** Chromeless means there is no header to name the card, so name it here. */
  ariaLabel?: string;
  /** The id of the element inside the card that names it — takes precedence over `ariaLabel`. */
  ariaLabelledBy?: string;
  /** Called on every move through closed → opening → open → closing → closed. `opening` is one
   *  frame — the motion's origin — so `open` is the phase the card travels in. */
  onPhaseChange?: (phase: Phase) => unknown;
  overrides?: OverlayCardOverrides;
};

export type OverlayCardState = {
  /** true from the frame the card lands until the closing phase has finished painting */
  isVisible: boolean;
  mounted: boolean;
  isFocusVisible: boolean;
};

export type SharedStyleProps = {
  $phase: Phase;
  $placement: Placement;
  $size: SizeProp;
  $scrim: Scrim;
  $animate: boolean;
  /** true when the card was given a mount node and fills that element rather than the viewport */
  $contained: boolean;
  $isFocusVisible: boolean;
};
