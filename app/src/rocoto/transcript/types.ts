/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, HOUSING } from './constants';

export type Size = keyof typeof SIZE;
export type Housing = keyof typeof HOUSING;

/* A RUN OF WORDS, or the absence of one.
 *
 * `null` is the whole point of this type. A machine that hears speech hears some of it clearly and
 * some of it not at all, and the ordinary thing to do — pick the likeliest word and print it — puts
 * an invention in the middle of a record the reader is about to trust. So a run the machine did not
 * hear is `null`, it renders as an empty slot, and it stays empty. The reader can see exactly where
 * the record stops and can go back to the sound for that one moment. */
export type WordRun = string | null;

export type Utterance = {
  /** who said it — the name shown at the head of the utterance */
  speaker: string;
  /** when it starts, in seconds from the head of the recording */
  start: number;
  /** when it ends, in seconds. The utterance holding the playhead is the current one. */
  end: number;
  /** what was said, in order. A `null` run is one the machine did not hear. */
  words: WordRun[];
  /** a stable key, when the caller has one. The index is used otherwise. */
  id?: string;
};

export type TranscriptOverrides = {
  Root?: Override;
  /** the slot the sound goes in — a Waveform lands here */
  Media?: Override;
  /** the one line above the words: the recording's length, and the machine's mark while it works */
  Meta?: Override;
  Duration?: Override;
  /** the AI's own act, marked. The only saffron on this component. */
  Mark?: Override;
  /** the scroller holding the utterances */
  List?: Override;
  /** one utterance — a button when it can be sought, a plain block when it cannot */
  Utterance?: Override;
  /** the utterance's timestamp, in tabular figures */
  Time?: Override;
  /** the utterance's second column: speaker over words */
  Body?: Override;
  Speaker?: Override;
  Words?: Override;
  /** a run the machine did not hear, drawn as an empty slot */
  Gap?: Override;
  /** the chromeless housing's single decision, at the card's foot */
  Action?: Override;
  /** one skeleton utterance, while the machine is still writing */
  SkeletonRow?: Override;
};

export type TranscriptProps = {
  /** the words that were said, in the order they were said */
  utterances: Utterance[];
  /** the playhead in seconds. Given, the utterance holding it is marked as the current one. */
  currentTime?: number;
  /** true while the sound is running: the list then GLIDES after the playhead, where a seek CUTS */
  playing?: boolean;
  /** called with the utterance's start when the reader picks it. Absent, the words are read-only. */
  onSeek?: (start: number, utterance: Utterance, index: number) => void;
  /** the sound itself. A Waveform goes in this slot; the card takes any node and imports none. */
  media?: React.ReactNode;
  /** the whole recording's length in seconds, stated once above the words */
  duration?: number;
  /** true while the machine is still setting the words down — the card shows its skeleton */
  loading?: boolean;
  /** how many utterances the skeleton draws */
  loadingUtterances?: number;
  /** seeking is unavailable. The words keep full contrast: reading them is the point. */
  disabled?: boolean;
  /** the current utterance brings itself into view as the playhead moves */
  follow?: boolean;
  /** what a screen reader says where the machine heard nothing */
  gapLabel?: string;
  /** how tall the words get before they scroll inside the card */
  maxHeight?: string;
  /** the one decision a chromeless housing carries, at the card's foot */
  action?: React.ReactNode;
  size?: Size;
  /** `card` paints its own surface and floats; `plain` drops it for a chromed housing to supply */
  housing?: Housing;
  overrides?: TranscriptOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $housing: Housing;
  $disabled: boolean;
  $maxHeight?: string;
};

export type UtteranceStyleProps = SharedStyleProps & {
  /** this utterance holds the playhead */
  $current: boolean;
  /** this utterance can be picked to move the playhead */
  $seekable: boolean;
  /** focus arrived from the keyboard, so the ring is drawn */
  $isFocusVisible: boolean;
  /** the speaker is the same as the one above, so the name is not said twice */
  $repeat: boolean;
};
