/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no surface that takes a hand.
 */

export const SIZE = {
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** THE COMPLETE STATE MATRIX. Every one of these is reachable, drawn, and demonstrated on the
 *  kit page as its own tile. `disabled` and `error` are also plain booleans, because that is how
 *  Base states them; they fold into this same one resolved value, so there is one truth. */
export const STATE = {
  /** nothing has been written and nothing has been removed — the line is waiting */
  empty: 'empty',
  /** a stroke is live under the finger, or a mark stands and the decision has yet to be taken */
  signing: 'signing',
  /** confirmed: the mark is the record now, and the pad shows it rather than takes it */
  signed: 'signed',
  /** the ink was taken off and the line is ready again */
  cleared: 'cleared',
  /** the pad is shown and takes nothing */
  disabled: 'disabled',
  /** a signature is required here, and the pad says which one */
  error: 'error',
} as const;

export type GeometryStep = {
  /** the height of the signing surface */
  padHeight: number;
  /** the height the same mark takes when it is a record rather than a control */
  markHeight: number;
  /** the thickness of the ink, in CSS pixels, at every scale the mark is ever drawn at */
  ink: number;
};

/* THE GEOMETRY. The ink takes exactly the three thicknesses the Waveform's marks take — 2, 2.5
 * and 3 — because a hand-drawn line and a sound-drawn line sitting on the same screen at two
 * different weights is two systems. The pad heights are Base's own scale: 96, 132 and 176 are
 * scale1200×2, scale1600+scale300 and scale1600×2 territory, so a pad drops into a Base form
 * without a seam. */
export const GEOMETRY: { [K in keyof typeof SIZE]: GeometryStep } = {
  compact: { padHeight: 96, markHeight: 28, ink: 2 },
  default: { padHeight: 132, markHeight: 36, ink: 2.5 },
  large: { padHeight: 176, markHeight: 48, ink: 3 },
};

/** WHERE THE LINE SITS, as a fraction of the surface's height. Everything anchors to it: the ✕,
 *  the prompt, and — crucially — a stored mark, which is placed by its own baseline rather than
 *  by its box, so a signature captured on a phone still sits ON the line when it is replayed at a
 *  third of the size on a record. */
export const BASELINE = 0.72;

/** THE PAD IS PRESSURE-AGNOSTIC, ON PURPOSE. `PointerEvent.pressure` reads 0.5 for every mouse,
 *  0 for many touchscreens and a real force only on a stylus, so a width driven by it would give
 *  the same person three different signatures on three devices. The ink is one thickness and the
 *  hand is the only variable. */
export const PRESSURE_SAMPLED = false;

/** moves smaller than this are the hand's tremor rather than its intent — the first half of the
 *  smoothing, before a single curve is drawn */
export const MIN_SAMPLE_DISTANCE = 0.75;

/** how far the hand has to travel, in pixels, before the marks count as a signature. Below it the
 *  pad keeps the ink and holds the decision back: a tap that leaves a dot is a tap. */
export const MIN_TRAVEL = 48;

/** how many characters a typed name needs before it stands as a signature */
export const MIN_NAME = 2;

/** how many samples a seeded signature is generated from — enough that every loop of it is drawn
 *  as a curve rather than as a polygon */
export const SEED_POINTS = 150;

/** a replayed mark draws itself in over the time the signing took, held between these — a
 *  half-second signature is worth watching, an eleven-second one is not */
export const REPLAY_MIN_MS = 400;
export const REPLAY_MAX_MS = 3200;

/** THE COPY. English, generic, and about the control rather than about anything being signed.
 *  Each line says what IS required — a pad that has been left empty is asked for a signature,
 *  never told what it lacks. */
export const LABEL = {
  group: 'Signature',
  pad: 'Signing area',
  prompt: 'Sign here',
  empty: 'Sign on the line with your finger or a pointer.',
  /* one sentence has to be true both while the finger is down and after it has lifted, because
     both are this state — «lift your finger» reads as an instruction to somebody who already did */
  signing: 'Confirm when the signature is done.',
  signed: 'Signed. Clear it to sign again.',
  cleared: 'Cleared. Sign on the line.',
  /* A DISABLED PAD SAYS NOTHING. Every other caption is an instruction, and an instruction under
   * a surface that will refuse it is worse than silence. The greyed surface is the whole message;
   * why it is greyed belongs to the form around it, which knows. */
  disabled: '',
  error: 'Sign on the line to continue.',
  clear: 'Clear',
  confirm: 'Confirm',
  typedName: 'Type your name to sign',
  typedNameCaption: 'A typed name is a signature.',
  typedNamePlaceholder: 'Full name',
} as const;
