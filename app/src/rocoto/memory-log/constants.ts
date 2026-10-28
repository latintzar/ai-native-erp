/* GROWN from Base Web's own `src/template-component/constants.ts` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships nothing for a fact that was arrived at.
 */

export const SIZE = {
  compact: 'compact',
  default: 'default',
} as const;

/** `card` paints its own surface and floats; `plain` drops it for a chromed housing to supply. */
export const HOUSING = {
  card: 'card',
  plain: 'plain',
} as const;

/** THE CHRONOLOGY, and it is the founder's own, in his order:
 *
 *   1 receipt of the order → 2 clarification → 3 matching, OR lack of match → 4 selection of
 *   best candidates → 5 confirmation (by the salesperson's review, or by the customer) →
 *   6 matching to the right one → 7 saved in memory forever
 *
 *  Steps 5 and 6 are one event here, because they are one act: a person confirming IS the match
 *  landing on the right one. Nothing else is collapsed.
 */
export const EVENT = {
  /** 1 — the order arrived, in the words it arrived in */
  received: 'received',
  /** 2 — someone asked, or answered, so that the thing asked for could be told apart */
  clarified: 'clarified',
  /** 3 — the machine matched it. Its own act, and until a person says so, a guess. */
  matched: 'matched',
  /** 3 — nothing in the list matched. The chain stays open and the slot stays empty. */
  unmatched: 'unmatched',
  /** 4 — the machine put up its best candidates. Its own act. */
  candidates: 'candidates',
  /** 5 + 6 — a person confirmed, and the match landed on the right one */
  confirmed: 'confirmed',
  /** 7 — written into this customer's memory, and kept */
  settled: 'settled',
  /** later — the memory was overridden. The predecessor stays legible under the new fact. */
  superseded: 'superseded',
} as const;

/** WHOSE ACT IT WAS, and therefore what colour marks it.
 *
 *  Saffron marks ONLY the AI's own act — its proposal and its match. Everything else is ink:
 *  the receipt is the customer's, the clarification is a person's, the confirmation is a
 *  person's, and the settled memory is a fact rather than an act at all.
 *
 *  `unmatched` is deliberately INK. A lack of match is neither a proposal nor a match; it is the
 *  machine being honest about the edge of what it knows, exactly as the Transcript's empty slot
 *  is. A page of saffron blanks would read as errors, and this product has no red.
 */
export const MARK: Record<keyof typeof EVENT, 'accent' | 'ink'> = {
  received: 'ink',
  clarified: 'ink',
  matched: 'accent',
  unmatched: 'ink',
  candidates: 'accent',
  confirmed: 'ink',
  settled: 'ink',
  superseded: 'ink',
};

/** THE EVENTS THAT LEAVE THE CHAIN OPEN. Their node is a ring rather than a dot: the question is
 *  still standing, and a filled node would read as a thing that closed. */
export const OPEN: Record<keyof typeof EVENT, boolean> = {
  received: false,
  clarified: false,
  matched: true,
  unmatched: true,
  candidates: true,
  confirmed: false,
  settled: false,
  superseded: false,
};

/** THE EVENTS A PERSON SETTLES. Only these may fill the outcome slot — the machine's own match
 *  never does, because the slot is shown empty rather than filled with a guess. */
export const SETTLES: Record<keyof typeof EVENT, boolean> = {
  received: false,
  clarified: false,
  matched: false,
  unmatched: false,
  candidates: false,
  confirmed: true,
  settled: true,
  superseded: true,
};

/** What the head says the chain is standing at, per its last event. Stated as what IS. */
export const STANDING: Record<keyof typeof EVENT, string> = {
  received: 'Unknown',
  clarified: 'Unknown',
  matched: 'Awaiting confirmation',
  unmatched: 'Open',
  candidates: 'Candidates offered',
  confirmed: 'Confirmed',
  settled: 'Remembered',
  superseded: 'Remembered',
};
