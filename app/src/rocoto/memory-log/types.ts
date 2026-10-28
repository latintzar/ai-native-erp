/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, HOUSING, EVENT } from './constants';

export type Size = keyof typeof SIZE;
export type Housing = keyof typeof HOUSING;
export type EventKind = keyof typeof EVENT;

/** whose act an entry was, and therefore what marks it: saffron for the machine, ink for a person */
export type Mark = 'accent' | 'ink';

/** ONE OF THE MACHINE'S BEST CANDIDATES — a thing it thinks was meant, and how strongly. */
export type MemoryCandidate = {
  /** stable identity, so a confirmation names the same thing the shortlist offered */
  id: string;
  /** the candidate's own name */
  name: string;
  /** one quiet line under the name */
  detail?: string;
  /** how strongly it matched, 0 to 1. The machine's own number, so it carries the machine's mark. */
  strength?: number;
};

/** A MESSAGE THE LOG IS QUOTING. The words are drawn by the conversation primitive itself, so a
 *  clarification reads in the log exactly as it read in the thread. */
export type MemorySaid = {
  /** who said it — `received`, `sent`, or `ai`, as the thread had it */
  author?: 'received' | 'sent' | 'ai';
  /** what was said */
  text: string;
  /** the stamp, already formatted by the surface that knows the reader's locale */
  time?: string;
};

/** A NUMBER AN EVENT CARRIES — a count, a weight, a quantity that turned out to be another one.
 *  Drawn by Figure, so the supersede grammar is the same one every other number in the product
 *  uses: the predecessor struck through, the unit on the number's own line. */
export type MemoryFigure = {
  value: number;
  /** the number this one replaced */
  was?: number;
  /** «units», «kg», «€/kg» — shares the figure's line, never a line of its own */
  unit?: string;
  /** decimal places; counts are 0 */
  decimals?: number;
};

/** ONE EVENT IN THE CUSTOMER'S MEMORY. Every clarification a person makes becomes one of these,
 *  and the log is what the memory IS. */
export type MemoryEvent = {
  /** a stable key, when the caller has one. The index is used otherwise. */
  id?: string;
  /** which of the seven steps this is */
  kind: EventKind;
  /** the stamp, already formatted by the surface that knows the reader's locale */
  at?: string;
  /** whose act it was, named. A run of events by the same hand states the name once. */
  by?: string;
  /** the one line saying what happened, in the surface's own words */
  note?: React.ReactNode;
  /** a message this event is quoting — the clarification itself */
  said?: MemorySaid;
  /** the shortlist the machine put up */
  candidates?: MemoryCandidate[];
  /** the thing this event lands on. On `matched` it is a guess; on a confirmation it is a fact. */
  match?: string;
  /** the match this one replaced. Present = a memory was overridden; the pair states the change. */
  was?: string;
  /** a number this event carries */
  figure?: MemoryFigure;
};

export type MemoryLogOverrides = {
  Root?: Override;
  /** the head: who asked, what they asked for, and where the chain stands */
  Head?: Override;
  /** the gutter holding the customer's picture */
  Face?: Override;
  /** the head's text column */
  Subject?: Override;
  /** «Customer 1 asked for» — the verb sits in the row and carries the meaning */
  Who?: Override;
  /** the words the order arrived in, quoted and never normalised */
  Asked?: Override;
  /** where the chain stands, as a Tag */
  Standing?: Override;
  /** the one row that answers the question: what this is remembered as */
  Outcome?: Override;
  OutcomeLabel?: Override;
  /** the settled fact, in ink — or the machine's guess, in saffron */
  Match?: Override;
  /** the match that was replaced, struck through and kept */
  Predecessor?: Override;
  /** the empty slot: shown empty, never filled with a guess */
  Slot?: Override;
  /** the chain itself */
  List?: Override;
  /** one event */
  Entry?: Override;
  /** the event's stamp, in tabular figures */
  Time?: Override;
  /** the spine and its node */
  Rail?: Override;
  Node?: Override;
  Spine?: Override;
  /** the event's second column */
  Body?: Override;
  /** whose act it was, said once per run */
  Actor?: Override;
  /** the line saying what happened */
  Note?: Override;
  /** the slot a quoted message sits in */
  Said?: Override;
  /** the machine's shortlist */
  Candidates?: Override;
  /** one candidate — a button when it can be picked, a plain row when it cannot */
  Candidate?: Override;
  /** the candidate's rank, as a tile */
  Rank?: Override;
  CandidateBody?: Override;
  CandidateName?: Override;
  CandidateDetail?: Override;
  /** the trailing value on a candidate row, holding its Figure */
  Strength?: Override;
  /** the chevron at the end of a pickable candidate */
  Chevron?: Override;
  /** the permanent entry, quiet, at the end of the chain */
  Memory?: Override;
  MemoryLabel?: Override;
  /** what arrived and what it is remembered as, on one line */
  Pair?: Override;
};

export type MemoryLogProps = {
  /** what was asked for, in the words it arrived in. Never normalised — it is the log's first fact. */
  asked: string;
  /** whose memory this is */
  customer: string;
  /** the customer's picture, when there is one. Initials otherwise. */
  customerSrc?: string;
  /** the chain, oldest first */
  events: MemoryEvent[];
  /**
   * the shortlist can be decided here. Given, the LAST shortlist in the chain becomes a set of
   * real targets — pointer and keyboard — and the head says the chain is awaiting a person.
   */
  onConfirm?: (candidate: MemoryCandidate, index: number, event: MemoryEvent) => void;
  /** where the chain stands, when the surface knows better than the chain does */
  standing?: string;
  /** what a screen reader hears at the empty slot */
  openLabel?: string;
  /** the word that names the machine's guess as a guess */
  proposedLabel?: string;
  /** the machine's shortlist, named for a screen reader */
  candidatesLabel?: string;
  /** the word above the permanent entry */
  memoryLabel?: string;
  /** the verb on the one row that answers the question */
  outcomeLabel?: string;
  /** the head is dropped when a housing already states whose memory this is */
  head?: boolean;
  /** the chain can be read but not acted on */
  disabled?: boolean;
  size?: Size;
  housing?: Housing;
  overrides?: MemoryLogOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $housing: Housing;
  $disabled: boolean;
};

export type EntryStyleProps = SharedStyleProps & {
  /** whose act it was */
  $mark: Mark;
  /** the event leaves the question standing, so its node is a ring rather than a dot */
  $open: boolean;
  /** the spine stops here */
  $last: boolean;
  /** the same hand as the entry above, so the name is not said twice */
  $repeat: boolean;
  /** a later event overrode what this one settled */
  $superseded: boolean;
};

export type CandidateStyleProps = SharedStyleProps & {
  /** the candidate is a real target */
  $pickable: boolean;
  /** focus arrived from the keyboard, so the ring is drawn */
  $isFocusVisible: boolean;
};

export type MatchStyleProps = SharedStyleProps & {
  /** the machine's own match, and therefore a guess: saffron, and never in the outcome slot */
  $proposed: boolean;
  /** a later fact replaced this one, so it is struck through and kept */
  $superseded: boolean;
  /** the match is inside an event rather than in the outcome row, so it takes the entry's step */
  $inline: boolean;
};
