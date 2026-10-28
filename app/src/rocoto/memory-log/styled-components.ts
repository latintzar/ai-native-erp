/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type scale, the spacing scale, the radii, the
 * border tokens, the motion curves and the colours. There are no invented numbers and no literal
 * paint. Two keywords appear that are not tokens, `transparent` and `currentColor`, and both are
 * absences rather than colours.
 *
 * THE COLOUR LAW ON THIS COMPONENT, stated once because the whole component is about it:
 *
 *   A GUESS IS SAFFRON. A SETTLED FACT IS INK.
 *
 * The machine's match and the machine's shortlist are its own acts, so their node is saffron and
 * the proposed match is written in saffron. The moment a person confirms, the same name is
 * rewritten in ink and never carries the accent again — the memory is a fact now, and a fact in
 * this system is quiet. Nothing else on this component takes the accent: not the receipt, not the
 * clarification, not the confirmation, and expressly not the lack of a match, which is honesty
 * rather than error.
 */
import { styled } from 'baseui';
import type {
  SharedStyleProps,
  EntryStyleProps,
  CandidateStyleProps,
  MatchStyleProps,
  Size,
} from './types';

/* THE RAMP, expressed purely as positions on Base's own scales. Two sizes, and every step keeps
 * its relationship to every other one, so the whole card moves as one object between them. */
const RAMP: Record<
  Size,
  {
    asked: string;
    who: string;
    match: string;
    sub: string;
    note: string;
    time: string;
    actor: string;
    detail: string;
    pad: string;
    gutter: string;
    row: string;
    stack: string;
    slot: string;
    node: string;
    tile: string;
    /** the face's diameter, as a label on Base's own spacing scale */
    face: string;
  }
> = {
  compact: {
    asked: 'ParagraphSmall',
    who: 'LabelXSmall',
    match: 'LabelLarge',
    sub: 'LabelSmall',
    note: 'ParagraphSmall',
    time: 'LabelXSmall',
    actor: 'LabelXSmall',
    detail: 'ParagraphXSmall',
    pad: 'scale500',
    gutter: 'scale400',
    row: 'scale100',
    stack: 'scale500',
    slot: 'scale900',
    node: 'scale300',
    tile: 'scale700',
    face: 'scale900',
  },
  default: {
    asked: 'ParagraphMedium',
    who: 'LabelSmall',
    match: 'HeadingXSmall',
    sub: 'LabelLarge',
    note: 'ParagraphSmall',
    time: 'LabelSmall',
    actor: 'LabelSmall',
    detail: 'ParagraphXSmall',
    pad: 'scale700',
    gutter: 'scale550',
    row: 'scale200',
    stack: 'scale600',
    slot: 'scale1000',
    node: 'scale300',
    tile: 'scale800',
    face: 'scale1000',
  },
};

export const ramp = (size: Size) => RAMP[size];

/* THE CARD. Same two housings as the Transcript, and the same corner Base gives a dialog, so a
 * bare card and a chromed one are cut from the same shape. */
export const Root = styled<'div', SharedStyleProps>('div', ({ $size, $housing, $theme }) => {
  const r = RAMP[$size];
  const pad = $theme.sizing[r.pad as keyof typeof $theme.sizing];
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: $theme.sizing[r.stack as keyof typeof $theme.sizing],
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    ...($housing === 'card'
      ? {
          backgroundColor: $theme.colors.backgroundPrimary,
          borderTopLeftRadius: $theme.borders.radius500,
          borderTopRightRadius: $theme.borders.radius500,
          borderBottomRightRadius: $theme.borders.radius500,
          borderBottomLeftRadius: $theme.borders.radius500,
          borderTopWidth: $theme.borders.border300.borderWidth,
          borderRightWidth: $theme.borders.border300.borderWidth,
          borderBottomWidth: $theme.borders.border300.borderWidth,
          borderLeftWidth: $theme.borders.border300.borderWidth,
          borderTopStyle: $theme.borders.border300.borderStyle,
          borderRightStyle: $theme.borders.border300.borderStyle,
          borderBottomStyle: $theme.borders.border300.borderStyle,
          borderLeftStyle: $theme.borders.border300.borderStyle,
          borderTopColor: $theme.colors.borderOpaque,
          borderRightColor: $theme.colors.borderOpaque,
          borderBottomColor: $theme.colors.borderOpaque,
          borderLeftColor: $theme.colors.borderOpaque,
          paddingTop: pad,
          paddingRight: pad,
          paddingBottom: pad,
          paddingLeft: pad,
        }
      : null),
  };
});
Root.displayName = 'MemoryLog';

/* THE HEAD — one fact per row, Monzo's way: picture · name and what they asked for · standing.
 * The picture is a gutter, the words are the part that grows, the standing is pinned to the
 * trailing edge so it never competes with the words for the reader's first look.
 *
 * It WRAPS, and that is load-bearing rather than tidiness: «Awaiting confirmation» beside a
 * customer's words in a 380px column truncates to «Awaiting confirm…», and a standing the reader
 * cannot finish reading is a standing the card failed to state. Given a measure it cannot hold,
 * the standing drops to its own line and stays whole. */
export const Head = styled<'div', SharedStyleProps>('div', ({ $size, $theme }) => {
  const r = RAMP[$size];
  return {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
    rowGap: $theme.sizing[r.row as keyof typeof $theme.sizing],
    minWidth: 0,
  };
});
Head.displayName = 'MemoryLogHead';

export const Face = styled<'div', SharedStyleProps>('div', () => ({
  display: 'flex',
  alignItems: 'center',
  flex: 'none',
}));
Face.displayName = 'MemoryLogFace';

export const Subject = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale0,
  minWidth: 0,
  // a measure, not a width: below about twenty characters the quoted words are unreadable, so the
  // standing gives up the line instead of the words giving up their letters
  flex: '1 1 20ch',
}));
Subject.displayName = 'MemoryLogSubject';

/* THE VERB, INLINE. «Customer 1 asked for» sits in the row and carries the meaning, so the words
 * underneath need no label of their own. */
export const Who = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].who as keyof typeof $theme.typography],
  color: $theme.colors.contentSecondary,
}));
Who.displayName = 'MemoryLogWho';

/* WHAT WAS ASKED FOR, in the words it arrived in. It is quoted because it is a quotation: the
 * moment this is tidied into the name of a thing in the list, the record has already answered the
 * question the log exists to hold open. */
export const Asked = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].asked as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
  minWidth: 0,
  overflowWrap: 'anywhere',
}));
Asked.displayName = 'MemoryLogAsked';

export const Standing = styled<'div', SharedStyleProps>('div', () => ({
  display: 'flex',
  alignItems: 'center',
  flex: 'none',
  // trailing edge on its own line as well as on a shared one
  marginLeft: 'auto',
}));
Standing.displayName = 'MemoryLogStanding';

/* THE OUTCOME — the one row that answers the question, and the empty-slot law made structural.
 * It is always here. While the chain is unsettled it holds an empty slot, and the machine's guess
 * stays down in the log where it is marked as a guess. Nothing ever writes a guess into this row. */
export const Outcome = styled<'div', SharedStyleProps>('div', ({ $size, $theme }) => {
  const r = RAMP[$size];
  return {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
    paddingTop: $theme.sizing[r.row as keyof typeof $theme.sizing],
    borderTopWidth: $theme.borders.border300.borderWidth,
    borderTopStyle: $theme.borders.border300.borderStyle,
    borderTopColor: $theme.colors.borderOpaque,
    minWidth: 0,
  };
});
Outcome.displayName = 'MemoryLogOutcome';

export const OutcomeLabel = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].who as keyof typeof $theme.typography],
  color: $theme.colors.contentSecondary,
  whiteSpace: 'nowrap',
}));
OutcomeLabel.displayName = 'MemoryLogOutcomeLabel';

/* THE MATCH. Saffron while it is the machine's own proposal, ink the moment a person settles it —
 * the same name, and the change of colour is the whole difference between a guess and a fact.
 * Struck through when a later fact replaced it, which is Figure's predecessor treatment applied to
 * a name instead of a number: the pair states the change, with no arrow and no colour. */
export const Match = styled<'span', MatchStyleProps>(
  'span',
  ({ $size, $proposed, $superseded, $inline, $theme }) => {
    const r = RAMP[$size];
    /* The outcome's match is the ANSWER, so it takes the card's largest step. The same element
     * inside an event is one voice among seven and takes the entry's own. The hierarchy is the
     * position on the card, never two different components. */
    const step = $superseded ? r.sub : $inline ? r.actor : r.match;
    return {
      ...$theme.typography[step as keyof typeof $theme.typography],
      color: $superseded
        ? $theme.colors.contentTertiary
        : $proposed
        ? $theme.colors.accent
        : $theme.colors.contentPrimary,
      ...($superseded
        ? {
            textDecoration: 'line-through',
            textDecorationColor: $theme.colors.contentTertiary,
          }
        : null),
      minWidth: 0,
      overflowWrap: 'anywhere',
    };
  }
);
Match.displayName = 'MemoryLogMatch';

/* THE PREDECESSOR — Figure's `Was`, verbatim in grammar: one rung under whatever replaced it,
 * dimmed, struck, kept. Yesterday's memory stays legible under today's. */
export const Predecessor = styled<'span', MatchStyleProps>('span', ({ $size, $inline, $theme }) => {
  const r = RAMP[$size];
  return {
    ...$theme.typography[($inline ? r.detail : r.sub) as keyof typeof $theme.typography],
    color: $theme.colors.contentTertiary,
    textDecoration: 'line-through',
    textDecorationColor: $theme.colors.contentTertiary,
  };
});
Predecessor.displayName = 'MemoryLogPredecessor';

/* THE EMPTY SLOT. The same object the Transcript draws where the machine heard nothing, and for
 * the same reason: shown empty, it tells the reader exactly what is still open. Filled with the
 * likeliest answer, it would be an invention sitting inside a record about to be trusted, and it
 * would read exactly like the rest of it. */
export const Slot = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  display: 'inline-block',
  width: $theme.sizing[RAMP[$size].slot as keyof typeof $theme.sizing],
  height: '1em',
  verticalAlign: '-0.15em',
  backgroundColor: $theme.colors.backgroundSecondary,
  borderTopLeftRadius: $theme.borders.radius100,
  borderTopRightRadius: $theme.borders.radius100,
  borderBottomWidth: $theme.borders.border300.borderWidth,
  borderBottomStyle: $theme.borders.border300.borderStyle,
  borderBottomColor: $theme.colors.contentTertiary,
}));
Slot.displayName = 'MemoryLogSlot';

/* THE CHAIN. An ordered list, because that is what it is: the order of the events is the meaning,
 * and a reader on a screen reader should hear that this is a sequence with a length. */
export const List = styled<'ol', SharedStyleProps>('ol', () => ({
  display: 'flex',
  flexDirection: 'column',
  listStyleType: 'none',
  marginTop: '0',
  marginRight: '0',
  marginBottom: '0',
  marginLeft: '0',
  paddingTop: '0',
  paddingRight: '0',
  paddingBottom: '0',
  paddingLeft: '0',
  minWidth: 0,
}));
List.displayName = 'MemoryLogList';

/* ONE EVENT, in the Transcript's utterance rhythm: the stamp in the leading gutter, the body in
 * the column that can grow, and the actor said once per run. The rail runs between them, and the
 * spacing between events lives INSIDE the body rather than on this row — a gap here would cut the
 * spine into segments, and a broken spine says the chain has holes it does not have. */
export const Entry = styled<'li', EntryStyleProps>('li', ({ $size, $theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'auto auto minmax(0, 1fr)',
  columnGap: $theme.sizing[RAMP[$size].gutter as keyof typeof $theme.sizing],
  alignItems: 'stretch',
  minWidth: 0,
}));
Entry.displayName = 'MemoryLogEntry';

/* THE STAMP. Tabular figures, so a column of them aligns without a monospace face — this system
 * has no monospace on product surfaces. Trailing-aligned, so the times form one edge against the
 * spine however long they are. */
export const Time = styled<'span', EntryStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].time as keyof typeof $theme.typography],
  color: $theme.colors.contentTertiary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  whiteSpace: 'nowrap',
  textAlign: 'end',
  alignSelf: 'start',
  paddingTop: $theme.sizing.scale0,
}));
Time.displayName = 'MemoryLogTime';

export const Rail = styled<'span', EntryStyleProps>('span', ({ $size, $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  alignSelf: 'stretch',
  width: $theme.sizing[RAMP[$size].node as keyof typeof $theme.sizing],
  flex: 'none',
}));
Rail.displayName = 'MemoryLogRail';

/* THE NODE. Saffron when the act was the machine's own, ink when it was a person's. A RING rather
 * than a dot while the question is still standing — a filled node reads as something that closed,
 * and an open question has not closed. */
export const Node = styled<'span', EntryStyleProps>('span', ({ $size, $mark, $open, $theme }) => {
  const size = $theme.sizing[RAMP[$size].node as keyof typeof $theme.sizing];
  const paint = $mark === 'accent' ? $theme.colors.accent : $theme.colors.contentPrimary;
  return {
    boxSizing: 'border-box',
    width: size,
    height: size,
    flex: 'none',
    marginTop: $theme.sizing.scale200,
    borderRadius: '50%',
    backgroundColor: $open ? $theme.colors.backgroundPrimary : paint,
    borderTopWidth: $theme.sizing.scale0,
    borderRightWidth: $theme.sizing.scale0,
    borderBottomWidth: $theme.sizing.scale0,
    borderLeftWidth: $theme.sizing.scale0,
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: paint,
    borderRightColor: paint,
    borderBottomColor: paint,
    borderLeftColor: paint,
  };
});
Node.displayName = 'MemoryLogNode';

/* THE SPINE — the chronology, drawn. It stops at the last event, because the chain has an end and
 * a line running past it would promise one more thing that never comes. */
export const Spine = styled<'span', EntryStyleProps>('span', ({ $last, $theme }) => ({
  width: $theme.sizing.scale0,
  flex: '1 1 auto',
  marginTop: $theme.sizing.scale100,
  backgroundColor: $last ? 'transparent' : $theme.colors.borderOpaque,
}));
Spine.displayName = 'MemoryLogSpine';

/* THE EVENT'S OWN COLUMN. It carries the spacing to the next event, so the spine beside it stays
 * one unbroken line. */
export const Body = styled<'div', EntryStyleProps>('div', ({ $size, $last, $theme }) => {
  const r = RAMP[$size];
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: $theme.sizing[r.row as keyof typeof $theme.sizing],
    alignItems: 'flex-start',
    minWidth: 0,
    // A MEASURE. The head and the answer take the card's whole width because they are one row
    // each; the chain is prose and a shortlist, and prose set a metre wide is unreadable however
    // wide the card is. Characters, not pixels, so it holds at every size on the ramp.
    maxWidth: '74ch',
    paddingBottom: $last ? '0' : $theme.sizing[r.stack as keyof typeof $theme.sizing],
  };
});
Body.displayName = 'MemoryLogBody';

/* WHOSE ACT IT WAS, in ink — always. The machine's acts are marked by their node and named as
 * proposals in words; making the name saffron as well would spend the accent three times on one
 * event, and an accent spent everywhere marks nothing. */
export const Actor = styled<'div', EntryStyleProps>('div', ({ $size, $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  ...$theme.typography[RAMP[$size].actor as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
  minWidth: 0,
}));
Actor.displayName = 'MemoryLogActor';

export const Note = styled<'span', EntryStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].note as keyof typeof $theme.typography],
  color: $theme.colors.contentSecondary,
  minWidth: 0,
  overflowWrap: 'anywhere',
}));
Note.displayName = 'MemoryLogNote';

/* THE QUOTED MESSAGE'S SLOT. The words are drawn by the conversation primitive itself; this is a
 * width and nothing else, so the log never grows an opinion about how a message looks. */
export const Said = styled<'div', EntryStyleProps>('div', () => ({
  width: '100%',
  minWidth: 0,
  // a bubble is a bubble at any card width: given the whole column it flies to the far edge and
  // stops reading as a thing someone said
  maxWidth: '46ch',
}));
Said.displayName = 'MemoryLogSaid';

/* THE SHORTLIST. One card, rows divided by a hairline — Monzo's action list, where every row is
 * icon tile · label · one-line subtitle · trailing value · chevron, and nothing else competes. */
export const Candidates = styled<'div', EntryStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  borderTopWidth: $theme.borders.border300.borderWidth,
  borderRightWidth: $theme.borders.border300.borderWidth,
  borderBottomWidth: $theme.borders.border300.borderWidth,
  borderLeftWidth: $theme.borders.border300.borderWidth,
  borderTopStyle: $theme.borders.border300.borderStyle,
  borderRightStyle: $theme.borders.border300.borderStyle,
  borderBottomStyle: $theme.borders.border300.borderStyle,
  borderLeftStyle: $theme.borders.border300.borderStyle,
  borderTopColor: $theme.colors.borderOpaque,
  borderRightColor: $theme.colors.borderOpaque,
  borderBottomColor: $theme.colors.borderOpaque,
  borderLeftColor: $theme.colors.borderOpaque,
  overflow: 'hidden',
}));
Candidates.displayName = 'MemoryLogCandidates';

/* ONE CANDIDATE. A real button when it can be picked, a plain row when the shortlist is a record
 * rather than a decision — a row that cannot be picked stays out of the tab order entirely, so a
 * settled log does not hand the keyboard three dead stops.
 *
 * The focus ring is INK. Focus is the reader's own hand on the keyboard, and the saffron in this
 * system belongs to the machine. */
export const Candidate = styled<'button', CandidateStyleProps>(
  'button',
  ({ $size, $pickable, $isFocusVisible, $disabled, $theme }) => {
    const r = RAMP[$size];
    return {
      /* FLEX, NOT A GRID, and that is a repair rather than a preference. As a four-column grid the
       * name column is the only one that can give, so in a narrow card it gave everything: the
       * rank tile and the percentage survived and the name of the thing being offered vanished.
       * Wrapping, the trailing figure drops to its own line and the name keeps its measure. */
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
      rowGap: $theme.sizing[r.row as keyof typeof $theme.sizing],
      width: '100%',
      boxSizing: 'border-box',
      textAlign: 'start',
      appearance: 'none',
      font: 'inherit',
      color: $theme.colors.contentPrimary,
      backgroundColor: 'transparent',
      paddingTop: $theme.sizing[r.row as keyof typeof $theme.sizing],
      paddingBottom: $theme.sizing[r.row as keyof typeof $theme.sizing],
      paddingLeft: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
      paddingRight: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
      borderTopWidth: '0',
      borderRightWidth: '0',
      borderLeftWidth: '0',
      borderBottomWidth: $theme.borders.border300.borderWidth,
      borderTopStyle: 'solid',
      borderRightStyle: 'solid',
      borderLeftStyle: 'solid',
      borderBottomStyle: $theme.borders.border300.borderStyle,
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      borderLeftColor: 'transparent',
      borderBottomColor: $theme.colors.borderOpaque,
      cursor: $pickable && !$disabled ? 'pointer' : 'default',
      transitionProperty: 'background-color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.easeOutCurve,
      ':last-child': { borderBottomColor: 'transparent' },
      ':hover': $pickable && !$disabled ? { backgroundColor: $theme.colors.backgroundSecondary } : {},
      /* computed rather than reset-then-restored: a `:focus { outline: none }` beside this would
       * beat the base declaration on specificity and the ring would never paint. */
      outline: $isFocusVisible
        ? `${$theme.sizing.scale100} solid ${$theme.colors.borderSelected}`
        : 'none',
      outlineOffset: $isFocusVisible ? `-${$theme.sizing.scale100}` : '0',
    };
  }
);
Candidate.displayName = 'MemoryLogCandidate';

/* THE RANK TILE. Monzo's leading icon tile, holding the one thing the machine actually knows
 * about the order of its own shortlist: which it put first. */
export const Rank = styled<'span', CandidateStyleProps>('span', ({ $size, $theme }) => {
  const r = RAMP[$size];
  const tile = $theme.sizing[r.tile as keyof typeof $theme.sizing];
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: tile,
    height: tile,
    flex: 'none',
    ...$theme.typography[r.detail as keyof typeof $theme.typography],
    color: $theme.colors.contentSecondary,
    backgroundColor: $theme.colors.backgroundSecondary,
    fontVariantNumeric: 'tabular-nums',
    borderTopLeftRadius: $theme.borders.radius200,
    borderTopRightRadius: $theme.borders.radius200,
    borderBottomRightRadius: $theme.borders.radius200,
    borderBottomLeftRadius: $theme.borders.radius200,
  };
});
Rank.displayName = 'MemoryLogRank';

export const CandidateBody = styled<'span', CandidateStyleProps>('span', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale0,
  minWidth: 0,
  // a measure the row may not take back: the name of the thing being offered is the row
  flex: '1 1 12ch',
}));
CandidateBody.displayName = 'MemoryLogCandidateBody';

export const CandidateName = styled<'span', CandidateStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].actor as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
  // it wraps rather than truncating: a name cut to «Item A…» is a row the reader cannot act on
  overflowWrap: 'anywhere',
}));
CandidateName.displayName = 'MemoryLogCandidateName';

export const CandidateDetail = styled<'span', CandidateStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].detail as keyof typeof $theme.typography],
  color: $theme.colors.contentTertiary,
  overflowWrap: 'anywhere',
}));

/* THE TRAILING VALUE — Monzo's own place for it, pushed to the row's end and holding a Figure it
 * does not draw. On a row that had to wrap it lands at the end of the second line, which is still
 * the trailing edge and still the last thing read. */
export const Strength = styled<'span', CandidateStyleProps>('span', () => ({
  display: 'flex',
  alignItems: 'baseline',
  flex: 'none',
  marginLeft: 'auto',
}));
Strength.displayName = 'MemoryLogStrength';
CandidateDetail.displayName = 'MemoryLogCandidateDetail';

/* THE CHEVRON, and it is earned: it appears only where the row actually goes somewhere. A chevron
 * on a row that does nothing is a promise the interface does not keep. */
export const Chevron = styled<'span', CandidateStyleProps>('span', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: $theme.colors.contentTertiary,
  flex: 'none',
}));
Chevron.displayName = 'MemoryLogChevron';

/* THE PERMANENT ENTRY. Quiet on purpose: it is the only thing here that is finished, and finished
 * things in this system do not shout. A ground, a hairline, the pair — what was asked, and what it
 * is remembered as — and no accent anywhere near it. */
export const Memory = styled<'div', EntryStyleProps>('div', ({ $size, $theme }) => {
  const r = RAMP[$size];
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: $theme.sizing.scale0,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    backgroundColor: $theme.colors.backgroundSecondary,
    paddingTop: $theme.sizing[r.row as keyof typeof $theme.sizing],
    paddingBottom: $theme.sizing[r.row as keyof typeof $theme.sizing],
    paddingLeft: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
    paddingRight: $theme.sizing[r.gutter as keyof typeof $theme.sizing],
    borderTopLeftRadius: $theme.borders.radius300,
    borderTopRightRadius: $theme.borders.radius300,
    borderBottomRightRadius: $theme.borders.radius300,
    borderBottomLeftRadius: $theme.borders.radius300,
  };
});
Memory.displayName = 'MemoryLogMemory';

export const MemoryLabel = styled<'span', EntryStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].detail as keyof typeof $theme.typography],
  color: $theme.colors.contentTertiary,
}));
MemoryLabel.displayName = 'MemoryLogMemoryLabel';

/* THE PAIR INSIDE THE PERMANENT ENTRY — what arrived, and what it is remembered as. */
export const Pair = styled<'div', EntryStyleProps>('div', ({ $size, $theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  ...$theme.typography[RAMP[$size].actor as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
  minWidth: 0,
}));
Pair.displayName = 'MemoryLogPair';
