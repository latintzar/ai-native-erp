/* GROWN from Base Web's own `src/template-component/constants.ts` scaffold, on the anatomy of
 * Base's `src/skeleton/`.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships a LOADING skeleton and this product needs
 * an UNDECIDED one.
 */

/** The shape a ghost region takes. Shape is the whole vocabulary — a ghost says WHAT KIND of
 *  thing stands there and nothing else about it. */
export const SHAPE = {
  /** a region: a card ground, a panel, a map, a picture */
  block: 'block',
  /** a line of text */
  line: 'line',
  /** an icon, a thumbnail, a checkbox — anything square */
  square: 'square',
  /** a person */
  circle: 'circle',
  /** a control: a button, a tag, a tab */
  pill: 'pill',
} as const;

/** How heavily a ghost reads. Three steps, and three is the whole ramp: a region, a shape
 *  standing in it, and a shape that carries weight (a title, a selected control). */
export const TONE = {
  faint: 'faint',
  default: 'default',
  strong: 'strong',
} as const;

/** The family's density step. Rows, avatars and navs take it; it drives height and gap only. */
export const SIZE = {
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** What stands at the head of a row. */
export const LEADING = {
  none: 'none',
  avatar: 'avatar',
  square: 'square',
} as const;

/** What stands at the tail of a row. */
export const TRAILING = {
  none: 'none',
  figure: 'figure',
  control: 'control',
} as const;

/** Where the nav lives. The two frames the catalogue draws in: desk (side) and phone (bottom). */
export const NAV_VARIANT = {
  side: 'side',
  bottom: 'bottom',
} as const;

/* ── THE WASH ─────────────────────────────────────────────────────────────────────────────────
 *
 * THE GREY IS BASE'S MONO RAMP, CARRYING THE BRAND'S INK.
 *
 * Measured fact, not taste: Base's mono ramp is brand-INVARIANT. `mono200`…`mono400` resolve to
 * the same greys under the Rocoto brand and under `?theme=proof`, because the theme's colour-law
 * sweep passes over anything with a saturation under 0.15. A ghost painted in raw mono would sit
 * on a re-themed page without moving — and an element that does not move under the proof brand is
 * indistinguishable from one that is hard-coded. That is exactly the bug the re-theme law exists
 * to catch.
 *
 * So each wash is a mix: the mono step supplies the VALUE (how light the grey is — Base's own
 * ramp, unchanged), and `contentPrimary` supplies the TEMPERATURE (the brand's ink, at a few
 * percent). Under Rocoto the ink is near-black, so the wash reads as the neutral grey it is; under
 * a navy or a green brand the whole skeleton takes that brand's cast and visibly moves. Both
 * halves are theme tokens; there is no literal paint here at all.
 */
export const WASH: Record<
  keyof typeof TONE,
  { mono: 'mono200' | 'mono300' | 'mono400' | 'mono500'; ink: number }
> = {
  faint: { mono: 'mono200', ink: 8 },
  default: { mono: 'mono300', ink: 14 },
  strong: { mono: 'mono400', ink: 24 },
};

/** The default size of each shape, as positions on Base's sizing scale (`square`/`circle`/`pill`)
 *  or as plain geometry (`block`/`line`, which stretch). Every one of these is a default a caller
 *  overrides with `width`/`height`; they exist so a bare `<GhostBlock />` already draws something
 *  honest. */
export const GEOMETRY = {
  /** a region holds its own space until told otherwise */
  blockHeight: 'scale2400',
  /** a line of body text, ghosted */
  lineHeight: 'scale400',
  /** an icon */
  squareSize: 'scale700',
  /** a person */
  circleSize: 'scale1000',
  /** a control */
  pillWidth: 'scale2400',
  pillHeight: 'scale700',
} as const;

/** Line widths, cycled so a list of ghosted text lines does not read as a barcode of identical
 *  bars. Deterministic on purpose: the same page renders the same skeleton every time, so a
 *  scenario screenshot is stable. */
export const LINE_WIDTHS = ['86%', '62%', '74%', '48%', '68%'] as const;

/** Tab widths, same idea, in px because a tab is sized by its word and not by its column. */
export const TAB_WIDTHS = ['56px', '40px', '68px', '48px', '60px'] as const;

/** Control widths at the end of a header — a wide one, an icon-sized one, a wider one. A header
 *  whose controls are all the same width reads as a diagram of a header rather than a header. */
export const ACTION_WIDTHS = ['64px', '40px', '88px'] as const;

/** The shimmer, for the one case where a ghost really is LOADING rather than UNDECIDED. Base's
 *  own numbers, from `src/skeleton/styled-components.ts`. Off by default everywhere. */
export const SHIMMER = {
  duration: '1.5s',
  timing: 'ease-out',
  size: '400% 100%',
  angle: '135deg',
} as const;
