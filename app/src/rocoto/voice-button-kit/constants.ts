/* GROWN from Base Web's own `src/template-component/constants.ts`.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base has no press-and-hold capture control.
 *
 * ═══ THE GESTURE, AND WHY IT IS COPIED RATHER THAN DESIGNED ═══════════════════════════════════
 * Every number below is the app's, measured against real thumbs and left exactly as it stands.
 * They are not defaults to tune: 90 and 70 are how far a thumb travels before it has clearly
 * MEANT something, 1000ms is the shortest press that carries a word, and 260ms with 12px of slop
 * is what separates a tap from a hold on a phone held one-handed. Retuning any of them silently
 * changes what the control feels like, so they are stated here once, named, and read from here.
 */

/** IDLE → RECORDING → LOCKED, and back. There is no fourth. */
export const PHASE = {
  idle: 'idle',
  recording: 'recording',
  locked: 'locked',
} as const;

export const SIZE = {
  compact: 'compact',
  default: 'default',
} as const;

/** drag LEFT past this and the cancel zone arms — releasing there throws the take away */
export const CANCEL_DISTANCE = 90;

/** drag UP past this and the recorder goes hands-free; the finger is free to leave */
export const LOCK_DISTANCE = 70;

/** a release before this is a slip, not a take: the audio is dropped and the hint is shown */
export const MIN_RECORD_MS = 1000;

/** a press shorter than this, with no meaningful drift, is a TAP — and a tap locks */
export const TAP_MAX_MS = 260;

/** how far the finger may wander and still count as having stayed put */
export const TAP_SLOP = 12;

/** how often the level is read while recording, in ms */
export const POLL_MS = 60;

/** the lock chip is tallest when the finger has not moved and shortest at the lock line */
export const LOCK_CHIP_MAX = 88;
export const LOCK_CHIP_MIN = 46;

/** how long the discard hint stays up after a take too short to keep */
export const HINT_MS = 2000;

/** HOW WIDE THE LIVE METER GROWS inside the bar. A level meter is a glance, not a transcript:
 *  given a whole row it stops reading as loudness and starts reading as a dotted rule, and it
 *  takes ten seconds to fill. Bounded, it fills in three and stays a meter. */
export const METER_WIDTH: { [K in keyof typeof SIZE]: number } = {
  compact: 150,
  default: 240,
};

/* ═══ THE COPY ════════════════════════════════════════════════════════════════════════════════
 * English, neutral, and every line says what IS — «Hold to record, release to send» rather than
 * anything about what went wrong. Overridable through `labels`, one key at a time.
 *
 * ═══ A LABEL SAYS WHAT THE CONTROL DOES; IT NEVER NAMES A MODE (FEED-IA §22.8) ════════════════
 * «WTF is hands free label? You have a bunch of slop.» «Hands-free» was the name of a state this
 * machine happens to have, printed on the person's screen. Nobody in the trade calls it that, and a
 * word that only means something to whoever wrote the state chart is not a label — it is a leak.
 *
 * The replacement is the same fact said as the person experiences it: the take is still running,
 * and their hands are their own. «Still recording» on the chip, «Keep recording after you let go»
 * for the affordance that gets you there. The mode keeps its name in the code, where names of modes
 * belong (`PHASE.locked`), and never appears on the glass.
 */
export const LABELS = {
  /** the mic button, to a screen reader */
  record: 'Record',
  /** rides beside the timer while the finger is down */
  slideToCancel: 'Slide to cancel',
  /** replaces the row once the cancel zone is armed */
  releaseToCancel: 'Release to cancel',
  /** the lock target above the mic, to a screen reader */
  lock: 'Keep recording after you let go',
  /** the chip on the recorder that is running with nobody holding it */
  stillRecording: 'Still recording',
  /** the locked recorder's left verb */
  discard: 'Discard',
  /** the locked recorder's right verb */
  send: 'Send',
  /** shown after a release under 1000ms */
  tooShort: 'Hold to record, release to send',
} as const;
