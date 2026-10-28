/* GROWN from Base Web's own `src/template-component/` scaffold, with the layer, focus and
 * scroll-lock machinery taken from Base Web's own `src/modal/`.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold, the overrides
 * contract, the constant shape and the open/close motion are theirs; the component is Rocoto's,
 * because Base ships the chromed overlay (Modal, Drawer) and has nothing for the chromeless one.
 */

/** Where the card sits on the layer. */
export const PLACEMENT = {
  /** the middle of the layer — the Base Modal position */
  center: 'center',
  /** docked to the bottom edge, top corners rounded — the same card, read as a sheet */
  bottom: 'bottom',
} as const;

export const SIZE = {
  compact: 'compact',
  default: 'default',
  full: 'full',
} as const;

/* Widths live here rather than in styled-components.ts for the same reason Base keeps
 * `SIZE_WIDTHS` in its modal constants: the styled layer reads theme tokens only, and Base's
 * theme carries no width scale. These three are the card's own measurements, stated once. */
export const SIZE_WIDTHS = {
  compact: '320px',
  default: '400px',
  full: '100%',
};

/** How much of the surface underneath the scrim takes. */
export const SCRIM = {
  /** the layer's own ground, dimmed — the surface underneath recedes and stops taking the pointer */
  dim: 'dim',
  /** paints nothing and still takes the pointer — for a card over something you must keep seeing */
  clear: 'clear',
  /** paints nothing and passes the pointer through — the surface underneath stays live */
  none: 'none',
} as const;

/** The four moments of the card's life, and the four states the styled layer paints.
 *
 *  `opening` is the single frame the card spends at the motion's ORIGIN — mounted, transparent
 *  and short of its resting place — which is what gives the browser something to transition out
 *  of. `open` therefore covers the travel as well as the rest. `closing` is held for the whole
 *  exit, since nothing has to be painted before it starts. */
export const PHASE = {
  closed: 'closed',
  opening: 'opening',
  open: 'open',
  closing: 'closing',
} as const;

/** What asked the card to close. `isOpen` going false on its own reports nothing, exactly as
 *  Base's Modal does — that was the consumer's own act, so it needs no callback. */
export const CLOSE_SOURCE = {
  /** the person clicked away from the card */
  scrim: 'scrim',
  escape: 'escape',
} as const;

export const ROLE = {
  dialog: 'dialog',
  alertdialog: 'alertdialog',
} as const;

/** How long the closing phase is held before the card leaves the tree. Base's Modal uses the same
 *  500 against a 400ms transition, so the exit always finishes painting before the unmount. */
export const EXIT_DELAY_MS = 500;
