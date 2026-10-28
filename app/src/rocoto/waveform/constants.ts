/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base has no audio primitive and this product is
 * spoken to before it is typed into.
 */

/** the three things a bar field can be doing */
export const MODE = {
  live: 'live',
  static: 'static',
  scrubbing: 'scrubbing',
} as const;

export const SIZE = {
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** THE NOISE GATE. Below this the mark collapses to its baseline dot, so a silent room draws a
 *  row of dots and a voice draws bars. Calibrated on the app's recorder, not chosen for looks:
 *  at a lower gate, room hiss drew a solid band and the field stopped meaning anything. */
export const NOISE_GATE = 0.17;

/** how often a live field reads its level, in ms — the app's own cadence */
export const POLL_MS = 60;

/** how many marks a seeded field generates before it is resampled to the width it got */
export const SEED_PEAKS = 96;

/** THE GROWTH ENVELOPE of a live field. New samples enter at the right edge over ENTER marks and
 *  old ones leave at the left over LEAVE, so the field breathes instead of stepping. */
export const ENTER_MARKS = 2;
export const LEAVE_MARKS = 1.5;

export type GeometryStep = {
  /** the mark's thickness — and, at rest, its diameter as a dot */
  barWidth: number;
  /** the space between two marks */
  barGap: number;
  /** the tallest a fully voiced mark gets */
  barMax: number;
};

/* THE GEOMETRY. The default step is the app's golden recorder, dp for dp: a 2.5px mark, 2px
 * apart, growing from its own dot to 22px. Those two numbers sit exactly on Base's spacing scale
 * already — `scale0` is 2px and `scale750` is 22px — which is why the field drops into a Base
 * layout without a seam. Compact and large are the same field at the two other densities Base's
 * scale offers. */
export const GEOMETRY: { [K in keyof typeof SIZE]: GeometryStep } = {
  compact: { barWidth: 2, barGap: 1.5, barMax: 14 },
  default: { barWidth: 2.5, barGap: 2, barMax: 22 },
  large: { barWidth: 3, barGap: 2.5, barMax: 32 },
};

/** how far one arrow key moves a scrubbing playhead, in ms */
export const STEP_MS = 1000;

/** what a screen reader calls each mode when the caller names nothing */
export const LABEL = {
  live: 'Audio level',
  static: 'Audio',
  scrubbing: 'Seek',
} as const;
