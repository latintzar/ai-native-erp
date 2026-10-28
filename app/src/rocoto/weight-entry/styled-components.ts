/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type scale, the spacing scale, the colours,
 * the motion tokens. There are no invented numbers. The one thing this file decides for itself is
 * WHICH rung of Base's scales each size takes, and that decision is the RAMP below.
 */
import { styled } from 'baseui';
import type {
  SharedStyleProps,
  DigitStyleProps,
  SlotRowStyleProps,
  ChevronStyleProps,
  PlaceStyleProps,
  UnitStyleProps,
  Size,
} from './types';

/* THE RAMP. A digit slot is a fixed box on Base's spacing scale, identical for every position, so
 * the readout's layout NEVER changes while a digit is in flight: the only thing that moves is the
 * digit, and it moves by translation alone. That is what makes the shift readable rather than a
 * reflow. The grams take the step below the kilos — Monzo's hierarchy, where the units are the
 * hero and the fraction is subordinate. */
const RAMP: Record<
  Size,
  { value: string; sub: string; unit: string; note: string; slot: string; comma: string; chev: string; cam: string; gap: string }
> = {
  compact: { value: 'HeadingSmall', sub: 'LabelMedium', unit: 'LabelSmall', note: 'LabelXSmall', slot: 'scale900', comma: 'scale300', chev: 'scale700', cam: 'scale900', gap: 'scale300' },
  default: { value: 'HeadingLarge', sub: 'HeadingXSmall', unit: 'LabelMedium', note: 'LabelXSmall', slot: 'scale1000', comma: 'scale400', chev: 'scale850', cam: 'scale1200', gap: 'scale400' },
  large: { value: 'DisplayXSmall', sub: 'HeadingSmall', unit: 'LabelLarge', note: 'LabelSmall', slot: 'scale1200', comma: 'scale500', chev: 'scale1000', cam: 'scale1400', gap: 'scale500' },
};

export const ramp = (size: Size) => RAMP[size];

const type = (t: unknown, key: string) => (t as Record<string, Record<string, string>>)[key];
const size = (s: unknown, key: string) => (s as Record<string, string>)[key];

/** the frame's width: every digit column the readout holds, plus every separator column it holds.
 *  Fixed, because a growing number must push its digits left rather than shove the unit right. */
const frame = ($theme: unknown, $size: Size, slots: number, seps: number) => {
  const sizing = ($theme as { sizing: unknown }).sizing;
  return `calc(${size(sizing, RAMP[$size].slot)} * ${slots} + ${size(sizing, RAMP[$size].comma)} * ${seps})`;
};

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'inline-flex',
  flexDirection: 'column',
  gap: size($theme.sizing, RAMP[$size].gap),
  maxWidth: '100%',
  minWidth: 0,
}));
Root.displayName = 'WeightEntry';

export const Label = styled<'span', SharedStyleProps>('span', ({ $theme, $size, $disabled }) => ({
  ...type($theme.typography, RAMP[$size].note),
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
}));
Label.displayName = 'WeightEntryLabel';

/* THE FIELD. One object: the number with its own increment marks, and the camera that reads it off
 * the scale. Three routes, one field — the alarm-clock hybrid, not three widgets in a row. */
export const Field = styled<'div', SharedStyleProps>('div', ({ $theme, $size, $disabled, $readOnly }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: size($theme.sizing, RAMP[$size].gap),
  paddingTop: $readOnly ? '0' : size($theme.sizing, RAMP[$size].gap),
  paddingBottom: $readOnly ? '0' : size($theme.sizing, RAMP[$size].gap),
  paddingLeft: $readOnly ? '0' : $theme.sizing.scale600,
  paddingRight: $readOnly ? '0' : $theme.sizing.scale600,
  borderRadius: $theme.borders.radius300,
  backgroundColor: $disabled
    ? $theme.colors.backgroundStateDisabled
    : $readOnly
    ? 'transparent'
    : $theme.colors.backgroundSecondary,
  outlineOffset: $theme.sizing.scale0,
  cursor: $disabled || $readOnly ? 'default' : 'text',
  transitionProperty: 'background-color, box-shadow',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':focus-visible': {
    outlineWidth: $theme.sizing.scale0,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.borderSelected,
  },
}));
Field.displayName = 'WeightEntryField';

/** the number and its marks — three rows that share one column grid */
export const Readout = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  borderRadius: $theme.borders.radius200,
  outlineOffset: $theme.sizing.scale100,
  ':focus-visible': {
    outlineWidth: $theme.sizing.scale0,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.borderSelected,
  },
}));

/* ONE LINE OF THE READOUT. Every row — the marks above, the digits, the marks below — carries the
 * same trailing unit cell, filled on the digits' row and invisible on the others. That is what
 * puts «kg» ON the number's own line instead of on the stack's midpoint: a rate unit denominates
 * its number, so it belongs to it. */
export const Line = styled<'div', SharedStyleProps>('div', () => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'flex-end',
}));
Line.displayName = 'WeightEntryLine';
Readout.displayName = 'WeightEntryReadout';

/** one row of the column grid: the digits, or the marks above them, or the ones below */
export const SlotRow = styled<'div', SlotRowStyleProps>('div', ({ $theme, $size, $slots, $seps, $tight }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'flex-end',
  // THE FRAME. With the marks on, every column is a fixed box wide enough to hold one, so the
  // number sits on a grid of orders of magnitude and each mark lands on its own digit. With the
  // marks off there is nothing to align to, so the number tightens to its own tracking.
  width: $tight ? 'auto' : frame($theme, $size, $slots, $seps),
}));
SlotRow.displayName = 'WeightEntrySlotRow';

/** THE DIGIT. Fixed box, centred glyph, tabular figures. The grams take the smaller step, so a
 *  digit that crosses the comma is promoted the instant it lands — you watch it become a kilo. */
export const Digit = styled<'span', DigitStyleProps>('span', ({ $theme, $size, $sub, $pad, $disabled, $readOnly, $tight }) => ({
  ...type($theme.typography, $sub ? RAMP[$size].sub : RAMP[$size].value),
  display: 'inline-block',
  flex: 'none',
  width: $tight ? 'auto' : size($theme.sizing, RAMP[$size].slot),
  paddingLeft: $tight ? $theme.sizing.scale0 : '0',
  paddingRight: $tight ? $theme.sizing.scale0 : '0',
  textAlign: 'center',
  color: $disabled
    ? $theme.colors.contentStateDisabled
    : $pad
    ? $theme.colors.contentTertiary
    : $theme.colors.contentPrimary,
  cursor: $disabled || $readOnly ? 'inherit' : 'pointer',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  willChange: 'transform',
}));
Digit.displayName = 'WeightEntryDigit';

/** a separator column: the kilo comma, and the grouping mark that keeps 10.000 kg one number.
 *  It never moves — three grams always sit to the right of the comma — so it is the fixed mark
 *  the digits travel past. */
export const Comma = styled<'span', DigitStyleProps>('span', ({ $theme, $size, $disabled, $pad }) => ({
  ...type($theme.typography, RAMP[$size].value),
  display: 'inline-block',
  flex: 'none',
  width: size($theme.sizing, RAMP[$size].comma),
  textAlign: 'center',
  color: $disabled
    ? $theme.colors.contentStateDisabled
    : $pad
    ? $theme.colors.contentTertiary
    : $theme.colors.contentPrimary,
}));
Comma.displayName = 'WeightEntryComma';

/* THE ACTIVE PLACE (FEED-IA §16). «The digit place IS the label» — so the field says which place
 * the arrows are driving by drawing a rule under that COLUMN. The rule belongs to the column and
 * not to the digit standing in it, so a digit that shifts leftward travels out from under it and
 * the place stays where the hand left it. */
export const Place = styled<'span', PlaceStyleProps>('span', ({ $theme, $size, $before, $sepsBefore }) => {
  const slot = size($theme.sizing, RAMP[$size].slot);
  const comma = size($theme.sizing, RAMP[$size].comma);
  return {
    position: 'absolute',
    bottom: '0',
    left: `calc(${slot} * ${$before} + ${comma} * ${$sepsBefore})`,
    width: slot,
    height: $theme.sizing.scale0,
    backgroundColor: $theme.colors.contentPrimary,
    transitionProperty: 'left',
    transitionDuration: $theme.animation.timing200,
    transitionTimingFunction: $theme.animation.easeOutCurve,
  };
});
Place.displayName = 'WeightEntryPlace';

export const SlotCell = styled<'span', DigitStyleProps>('span', ({ $theme, $size }) => ({
  position: 'relative',
  display: 'inline-block',
  flex: 'none',
  width: size($theme.sizing, RAMP[$size].slot),
}));
SlotCell.displayName = 'WeightEntrySlotCell';

export const Spacer = styled<'span', DigitStyleProps>('span', ({ $theme, $size }) => ({
  display: 'inline-block',
  flex: 'none',
  width: size($theme.sizing, RAMP[$size].comma),
}));
Spacer.displayName = 'WeightEntrySpacer';

/* THE MARK (FEED-IA §16). One per digit place, ABOVE and BELOW the digit it changes, so it is not
 * a separate control — it is the digit's own handle, and the digit place is its label. Held down,
 * it repeats and accelerates.
 *
 * ON A DESK IT WAITS. `$quiet` is a fine pointer with no hand on the field: the marks hold their
 * room so nothing reflows, and they fade in the moment the field is hovered or focused. A keyboard
 * never needs them — it types the number and steps it with the arrows. */
export const Chevron = styled<'button', ChevronStyleProps>('button', ({ $theme, $size, $active, $held, $quiet, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: size($theme.sizing, RAMP[$size].slot),
  height: size($theme.sizing, RAMP[$size].chev),
  padding: '0',
  border: 'none',
  borderRadius: $theme.borders.radius200,
  backgroundColor: $held
    ? $theme.colors.backgroundTertiary
    : $active
    ? $theme.colors.backgroundPrimary
    : 'transparent',
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  cursor: $disabled ? 'default' : 'pointer',
  /* A WHISPER, NOT AN ABSENCE. Held at zero the marks left a band of empty air over and under the
     number that nothing explained; held at a whisper the room is accounted for, the instrument
     reads as an instrument, and a hand arriving on the field brings them up to full. */
  opacity: $quiet ? 0.26 : 1,
  pointerEvents: $quiet ? 'none' : 'auto',
  transitionProperty: 'opacity, background-color, color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':hover': { color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary },
  ':focus-visible': {
    outlineWidth: $theme.sizing.scale0,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.borderSelected,
    outlineOffset: `-${$theme.sizing.scale0}`,
  },
}));
Chevron.displayName = 'WeightEntryChevron';

/** the unit, on the number's own line. Always. Rendered on every row of the readout and hidden on
 *  all but the digits', so the three rows measure identically whatever the unit says. */
export const Unit = styled<'span', UnitStyleProps>('span', ({ $theme, $size, $disabled, $ghost }) => ({
  ...type($theme.typography, RAMP[$size].unit),
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  whiteSpace: 'nowrap',
  flex: 'none',
  paddingLeft: $theme.sizing.scale200,
  visibility: $ghost ? 'hidden' : 'visible',
}));
Unit.displayName = 'WeightEntryUnit';

/* THE CAMERA. Beside the field, because a photograph of the scale is a third way of saying the
 * same number — not a different task. */
export const Camera = styled<'button', ChevronStyleProps>('button', ({ $theme, $size, $active, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: size($theme.sizing, RAMP[$size].cam),
  height: size($theme.sizing, RAMP[$size].cam),
  padding: '0',
  border: 'none',
  borderRadius: $theme.borders.radius300,
  backgroundColor: $active ? $theme.colors.backgroundInversePrimary : $theme.colors.backgroundPrimary,
  color: $disabled
    ? $theme.colors.contentStateDisabled
    : $active
    ? $theme.colors.contentInversePrimary
    : $theme.colors.contentPrimary,
  cursor: $disabled ? 'default' : 'pointer',
  transitionProperty: 'background-color, color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':focus-visible': {
    outlineWidth: $theme.sizing.scale0,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.borderSelected,
    outlineOffset: $theme.sizing.scale0,
  },
}));
Camera.displayName = 'WeightEntryCamera';

/** the viewfinder — the phone pointed at the scale */
export const Viewfinder = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: $theme.sizing.scale400,
  padding: $theme.sizing.scale600,
  borderRadius: $theme.borders.radius300,
  backgroundColor: $theme.colors.backgroundSecondary,
  overflow: 'hidden',
}));
Viewfinder.displayName = 'WeightEntryViewfinder';

/** the scale's own display, as it looks through the lens */
export const ScaleDisplay = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: $theme.sizing.scale300,
  minWidth: $theme.sizing.scale4800,
  maxWidth: '100%',
  paddingTop: $theme.sizing.scale500,
  paddingBottom: $theme.sizing.scale500,
  paddingLeft: $theme.sizing.scale800,
  paddingRight: $theme.sizing.scale800,
  borderRadius: $theme.borders.radius200,
  backgroundColor: $theme.colors.backgroundInversePrimary,
  color: $theme.colors.contentInversePrimary,
  ...type($theme.typography, RAMP[$size].value),
  fontVariantNumeric: 'tabular-nums',
  overflow: 'hidden',
}));
ScaleDisplay.displayName = 'WeightEntryScaleDisplay';

/** the AI reading the display. Accent, because this is the machine's own act and nothing else in
 *  this component is. */
export const Scan = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  position: 'absolute',
  top: '0',
  bottom: '0',
  width: $theme.sizing.scale100,
  backgroundColor: $theme.colors.accent,
  animationDuration: $theme.animation.timing700,
  animationTimingFunction: $theme.animation.easeInOutCurve,
  animationIterationCount: 'infinite',
  animationName: {
    '0%': { left: '0%' },
    '100%': { left: '100%' },
  } as unknown as string,
}));
Scan.displayName = 'WeightEntryScan';

/** what the number came from, said in a sentence under the field */
export const Attribution = styled<'div', SharedStyleProps>('div', ({ $theme, $size, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  flexWrap: 'wrap',
  ...type($theme.typography, RAMP[$size].note),
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  /* the note's own line box, exactly — the room is held so nothing reflows when the source
     changes, and holding MORE than a line was four pixels of nothing on every open line */
  minHeight: $theme.sizing.scale600,
}));
Attribution.displayName = 'WeightEntryAttribution';

/** the accent dot: the AI acted here. It appears nowhere else in this component. */
export const Mark = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-block',
  flex: 'none',
  width: $theme.sizing.scale200,
  height: $theme.sizing.scale200,
  borderRadius: '50%',
  backgroundColor: $theme.colors.accent,
}));
Mark.displayName = 'WeightEntryMark';

/** the photograph, kept as a chip: tap to look at it, bin it to redo it */
export const Chip = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  paddingTop: $theme.sizing.scale200,
  paddingBottom: $theme.sizing.scale200,
  borderRadius: $theme.borders.radius200,
  backgroundColor: $theme.colors.backgroundSecondary,
}));
Chip.displayName = 'WeightEntryChip';

export const ChipButton = styled<'button', SharedStyleProps>('button', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  padding: '0',
  border: 'none',
  backgroundColor: 'transparent',
  color: $theme.colors.contentPrimary,
  cursor: 'pointer',
  ':focus-visible': {
    outlineWidth: $theme.sizing.scale0,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.borderSelected,
    outlineOffset: $theme.sizing.scale0,
  },
}));
ChipButton.displayName = 'WeightEntryChipButton';

/** the thumbnail inside the chip — the scale's display, small */
export const Thumb = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: $theme.sizing.scale950,
  height: $theme.sizing.scale700,
  paddingLeft: $theme.sizing.scale200,
  paddingRight: $theme.sizing.scale200,
  borderRadius: $theme.borders.radius100,
  backgroundColor: $theme.colors.backgroundInversePrimary,
  color: $theme.colors.contentInversePrimary,
  ...$theme.typography.LabelXSmall,
  fontVariantNumeric: 'tabular-nums',
}));
Thumb.displayName = 'WeightEntryThumb';

/* ORDERED AGAINST GIVEN. One fact per row: the word, then the figure. The difference is a
 * sentence, and the rule under it is the same difference drawn — in ink, at both ends, because
 * over and under are directions and not verdicts. */
export const Compare = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale300,
  paddingTop: $theme.sizing.scale300,
  minWidth: 0,
}));
Compare.displayName = 'WeightEntryCompare';

export const CompareRow = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: $theme.sizing.scale600,
  minWidth: 0,
}));
CompareRow.displayName = 'WeightEntryCompareRow';

/** A LABEL AND THE FIGURE IT NAMES, ON ONE BASELINE. It carries a Figure inline now (the density
 *  pass), so it aligns on the baseline the number sits on rather than on the label's own box. */
export const CompareLabel = styled<'span', SharedStyleProps>('span', ({ $theme, $size }) => ({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: $theme.sizing.scale200,
  ...type($theme.typography, RAMP[$size].note),
  color: $theme.colors.contentSecondary,
  whiteSpace: 'nowrap',
}));
CompareLabel.displayName = 'WeightEntryCompareLabel';

/** the deviation, drawn: a track with the ordered amount at its centre and the given weight
 *  marked off it. Ink at both ends — direction, never a traffic light. */
export const Track = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  height: $theme.sizing.scale300,
  backgroundColor: $theme.colors.backgroundTertiary,
  borderRadius: $theme.borders.radius100,
  overflow: 'hidden',
}));
Track.displayName = 'WeightEntryTrack';

export const TrackFill = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  position: 'absolute',
  top: '0',
  bottom: '0',
  backgroundColor: $theme.colors.contentPrimary,
  transitionProperty: 'left, right, width',
  transitionDuration: $theme.animation.timing300,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
TrackFill.displayName = 'WeightEntryTrackFill';

export const TrackTick = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  position: 'absolute',
  top: '0',
  bottom: '0',
  left: '50%',
  width: $theme.sizing.scale0,
  transform: 'translateX(-50%)',
  backgroundColor: $theme.colors.contentPrimary,
}));
TrackTick.displayName = 'WeightEntryTrackTick';
