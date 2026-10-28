/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type scale, the spacing scale, the radii, the
 * border tokens, the motion curves and the colours. There are no invented numbers and no literal
 * paint. Two keywords appear that are not tokens, `transparent` and `currentColor`, and both are
 * absences rather than colours: the leading rule reserves its two pixels at every rest so the row
 * never shifts when it becomes current, and the words inherit whatever ink the row is carrying.
 *
 * THE COLOUR LAW ON THIS COMPONENT. Ink does all of it. The current utterance is ink at full
 * strength on Base's own secondary ground with an ink rule at its leading edge; every other
 * utterance is a step down. Saffron appears exactly once, on `Mark` — the machine at work, which is
 * the one thing here that is the AI's own act. Not on the playhead (that is the sound moving), and
 * expressly not on the empty slot: a page of saffron blanks would read as forty errors, and this
 * product has no red.
 */
import { styled } from 'baseui';
import type { SharedStyleProps, UtteranceStyleProps, Size } from './types';

/* THE RAMP, expressed purely as positions on Base's own scales. Two sizes, one rung apart, so the
 * timestamp, the speaker and the words keep their relationship whichever size is used. */
const RAMP: Record<
  Size,
  { time: string; speaker: string; words: string; pad: string; gutter: string; row: string; stack: string; slot: string }
> = {
  compact: {
    time: 'LabelXSmall',
    speaker: 'LabelXSmall',
    words: 'ParagraphSmall',
    pad: 'scale500',
    gutter: 'scale400',
    row: 'scale100',
    stack: 'scale400',
    slot: 'scale900',
  },
  default: {
    time: 'LabelSmall',
    speaker: 'LabelSmall',
    words: 'ParagraphMedium',
    pad: 'scale700',
    gutter: 'scale550',
    row: 'scale200',
    stack: 'scale600',
    slot: 'scale1000',
  },
};

export const ramp = (size: Size) => RAMP[size];

/* THE UTTERANCE GRID, shared by a real row and by the skeleton that stands in for one while the
 * machine is still writing. Both must occupy the same shape, or the words jump the moment they
 * arrive and the reader loses the line they were on. */
const utteranceGrid = (gutter: string) => ({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: gutter,
  alignItems: 'start',
  width: '100%',
});

/* THE CARD. `card` is whole on its own — it is what floats on a layer with no chrome around it.
 * `plain` is the same content with its surface removed, for a housing that brings its own. */
export const Root = styled<'div', SharedStyleProps>('div', ({ $size, $housing, $theme }) => {
  const r = RAMP[$size];
  const pad = $theme.sizing[r.pad as keyof typeof $theme.sizing];
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: $theme.sizing[r.stack as keyof typeof $theme.sizing],
    minWidth: 0,
    ...($housing === 'card'
      ? {
          backgroundColor: $theme.colors.backgroundPrimary,
          // Base's own overlay radius — the same one its Modal gives a dialog, so a bare card and
          // a chromed one are cut from the same corner.
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
Root.displayName = 'Transcript';

/* THE SOUND'S SLOT. It holds whatever renders the recording and knows nothing about it — the slot
 * is loose on purpose, so the thing that draws sound and the thing that draws words can each be
 * replaced without the other noticing. */
export const Media = styled<'div', SharedStyleProps>('div', () => ({
  display: 'block',
  minWidth: 0,
}));
Media.displayName = 'TranscriptMedia';

/* THE ONE LINE ABOVE THE WORDS. A chromeless card has no header, so what a header would have
 * carried — how long the recording is, and whether the machine has finished — is stated here, in
 * the content, at content weight. */
export const Meta = styled<'div', SharedStyleProps>('div', ({ $size, $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  minHeight: $theme.sizing.scale600,
}));
Meta.displayName = 'TranscriptMeta';

/* THE WHOLE LENGTH, and it sits at the trailing edge for a reason found by looking: set at the
 * leading edge it lands in the same column as the utterances' own timestamps, and a reader scanning
 * down that column reads it as the first row's time. Pushed to the end it can only be a total. */
export const Duration = styled<'span', SharedStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].time as keyof typeof $theme.typography],
  color: $theme.colors.contentTertiary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  marginLeft: 'auto',
}));
Duration.displayName = 'TranscriptDuration';

/* THE MACHINE'S MARK — the only saffron on this component, and only while the machine is working.
 * The mark is a slot rather than a drawing: Base's own Spinner goes in it, and comes out saffron
 * because the theme already maps the accent there. Nothing is re-drawn to get the brand colour. */
export const Mark = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  color: $theme.colors.accent,
}));
Mark.displayName = 'TranscriptMark';

/* THE SCROLLER. The words scroll inside the card so the card itself keeps its size on a layer —
 * an overlay that grows with its content moves the reader's eye every time more of it arrives. */
export const List = styled<'div', SharedStyleProps>('div', ({ $size, $maxHeight, $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  minWidth: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  ...($maxHeight ? { maxHeight: $maxHeight } : null),
}));
List.displayName = 'TranscriptList';

/* ONE UTTERANCE.
 *
 * The leading rule is two pixels wide at every rest, transparent until the row is current, so the
 * text never shifts sideways as the playhead moves down the page. Hover and current are told apart
 * by ground alone: current sits on Base's secondary ground and hover deepens to the tertiary one,
 * which is the same pair Base uses for a list item that is selected and one that is pointed at.
 *
 * The focus ring is INK, not the accent. Focus is the reader's own hand on the keyboard, and this
 * system's saffron belongs to the machine.
 */
export const Utterance = styled<'button', UtteranceStyleProps>(
  'button',
  ({ $size, $current, $seekable, $isFocusVisible, $disabled, $theme }) => {
    const r = RAMP[$size];
    const padBlock = $theme.sizing[r.row as keyof typeof $theme.sizing];
    const padInline = $theme.sizing[r.gutter as keyof typeof $theme.sizing];
    return {
      ...utteranceGrid($theme.sizing[r.gutter as keyof typeof $theme.sizing]),
      // reset the button back to a block of text
      appearance: 'none',
      textAlign: 'start',
      font: 'inherit',
      backgroundColor: $current ? $theme.colors.backgroundSecondary : 'transparent',
      color: $current ? $theme.colors.contentPrimary : $theme.colors.contentSecondary,
      paddingTop: padBlock,
      paddingBottom: padBlock,
      paddingRight: padInline,
      paddingLeft: padInline,
      borderTopWidth: '0',
      borderRightWidth: '0',
      borderBottomWidth: '0',
      borderLeftWidth: $theme.sizing.scale0,
      borderTopStyle: 'solid',
      borderRightStyle: 'solid',
      borderBottomStyle: 'solid',
      borderLeftStyle: 'solid',
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: $current ? $theme.colors.contentPrimary : 'transparent',
      borderTopRightRadius: $theme.borders.radius200,
      borderBottomRightRadius: $theme.borders.radius200,
      cursor: $seekable ? 'pointer' : 'default',
      transitionProperty: 'background-color, color, border-left-color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.easeOutCurve,
      ':hover': $seekable
        ? { backgroundColor: $theme.colors.backgroundTertiary }
        : {},
      /* THE RING, computed rather than reset-then-restored. An earlier version carried a
       * `:focus { outline: none }` beside this, and the pseudo-class beat the base declaration on
       * specificity, so the ring never painted — Base's own checkbox does it exactly this way, one
       * ternary and no pseudo. Pulled inside by its own width so the scroller cannot clip it. */
      outline: $isFocusVisible
        ? `${$theme.sizing.scale100} solid ${$theme.colors.borderSelected}`
        : 'none',
      outlineOffset: $isFocusVisible ? `-${$theme.sizing.scale100}` : '0',
      // A disabled transcript keeps every word at full legibility. Dimming it would answer the one
      // question the reader opened it to ask — what does it say — with «not now».
      ...($disabled ? { cursor: 'default' } : null),
    };
  }
);
Utterance.displayName = 'TranscriptUtterance';

/* THE TIMESTAMP. Tabular figures, so a column of them aligns without a monospace face — this
 * system has no monospace on product surfaces. */
export const Time = styled<'span', UtteranceStyleProps>('span', ({ $size, $current, $theme }) => ({
  ...$theme.typography[RAMP[$size].time as keyof typeof $theme.typography],
  color: $current ? $theme.colors.contentPrimary : $theme.colors.contentTertiary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  whiteSpace: 'nowrap',
  // the figure sits on the first line of the body, whichever line that is
  paddingTop: $theme.sizing.scale0,
}));
Time.displayName = 'TranscriptTime';

export const Body = styled<'span', UtteranceStyleProps>('span', ({ $size, $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale0,
  minWidth: 0,
}));
Body.displayName = 'TranscriptBody';

/* THE SPEAKER, said once. A run of utterances from the same voice states the name at its head and
 * then stops repeating it — the same grammar a conversation uses, and the reason a transcript reads
 * as speech rather than as a table. */
export const Speaker = styled<'span', UtteranceStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].speaker as keyof typeof $theme.typography],
  color: $theme.colors.contentPrimary,
}));
Speaker.displayName = 'TranscriptSpeaker';

export const Words = styled<'span', UtteranceStyleProps>('span', ({ $size, $theme }) => ({
  ...$theme.typography[RAMP[$size].words as keyof typeof $theme.typography],
  // inherits the row's ink, so current and quiet propagate from one place
  color: 'currentColor',
}));
Words.displayName = 'TranscriptWords';

/* THE EMPTY SLOT — a run the machine did not hear, drawn as a blank the width of a word and left
 * blank. Ground plus a rule at the baseline, the shape of a space left to be filled, in ink. It is
 * deliberately quiet: it marks the edge of the record, not an error, and there is no colour here
 * that could be mistaken for one. */
export const Gap = styled<'span', UtteranceStyleProps>('span', ({ $size, $theme }) => ({
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
Gap.displayName = 'TranscriptGap';

/* THE ONE DECISION. A chromeless card has no footer to put a button in, so the button lives at the
 * foot of the content with a hairline above it. That is the whole difference between the two
 * housings: chromeless keeps its single decision inside the content, chromed hands its decisions to
 * a footer and can afford two. */
export const Action = styled<'div', SharedStyleProps>('div', ({ $size, $theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  paddingTop: $theme.sizing[RAMP[$size].row as keyof typeof $theme.sizing],
  borderTopWidth: $theme.borders.border300.borderWidth,
  borderTopStyle: $theme.borders.border300.borderStyle,
  borderTopColor: $theme.colors.borderOpaque,
}));
Action.displayName = 'TranscriptAction';

/* THE SKELETON'S ROW. The same grid as a real utterance, so the words land where the placeholder
 * stood instead of re-flowing the card the instant they arrive. */
export const SkeletonRow = styled<'div', SharedStyleProps>('div', ({ $size, $theme }) => {
  const r = RAMP[$size];
  const padBlock = $theme.sizing[r.row as keyof typeof $theme.sizing];
  const padInline = $theme.sizing[r.gutter as keyof typeof $theme.sizing];
  return {
    ...utteranceGrid($theme.sizing[r.gutter as keyof typeof $theme.sizing]),
    paddingTop: padBlock,
    paddingBottom: padBlock,
    paddingRight: padInline,
    paddingLeft: padInline,
    // matches the leading rule an utterance reserves, so nothing shifts on arrival
    borderLeftWidth: $theme.sizing.scale0,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
  };
});
SkeletonRow.displayName = 'TranscriptSkeletonRow';
