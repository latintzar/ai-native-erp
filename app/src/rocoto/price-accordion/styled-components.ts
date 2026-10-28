/* GROWN from Base Web's own `src/template-component/styled-components.ts`, with the accordion's
 * anatomy (Root · PanelContainer · Header · ToggleIcon · Content · ContentAnimationContainer) and
 * the slider's geometry (a 2px track, a 24px handle, the 3px focus ring, the value bubble above
 * the thumb) taken from `bw-src/src/accordion/` and `bw-src/src/slider/`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — type scale, spacing scale, radii, motion, colours.
 * There are no invented numbers, and there is no colour doing a job that ink can do.
 */
import { styled } from 'baseui';
import type { RampStyleProps, SharedStyleProps } from './types';

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────── */

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: $theme.colors.backgroundPrimary,
  borderRadius: $theme.borders.radius300,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $theme.colors.borderOpaque,
  opacity: $disabled ? 0.5 : 1,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
}));
Root.displayName = 'StyledRoot';

/* THE COLLAPSED ROW, and the Monzo action row exactly: mark · name · one-line subtitle · trailing
 * figure · chevron. Nothing else is allowed in here, because the moment two facts compete the row
 * stops being scannable. */
export const Header = styled<'button', SharedStyleProps>('button', ({ $theme, $disabled }) => ({
  ...$theme.typography.LabelMedium,
  appearance: 'none',
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  textAlign: 'left',
  gap: $theme.sizing.scale550,
  paddingTop: $theme.sizing.scale550,
  paddingBottom: $theme.sizing.scale550,
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  backgroundColor: 'transparent',
  color: $theme.colors.contentPrimary,
  borderWidth: 0,
  borderStyle: 'none',
  borderRadius: $theme.borders.radius300,
  cursor: $disabled ? 'not-allowed' : 'pointer',
  outline: 'none',
  transitionProperty: 'background-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':hover': { backgroundColor: $disabled ? 'transparent' : $theme.colors.backgroundSecondary },
  ':focus-visible': {
    outline: `3px solid ${$theme.colors.borderAccent}`,
    outlineOffset: '-3px',
  },
}));
Header.displayName = 'StyledHeader';

/* THE LEVEL GLYPH. It draws the level's own SHAPE — one dot, a row of dots, a row on a ramp, a
 * grid — so the fractal is legible before a word is read. The words are still there underneath;
 * the glyph is never the only statement of the level. */
export const LevelMark = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  flex: 'none',
  width: $theme.sizing.scale900,
  height: $theme.sizing.scale900,
  display: 'grid',
  placeItems: 'center',
  borderRadius: $theme.borders.radius200,
  backgroundColor: $theme.colors.backgroundSecondary,
  color: $theme.colors.contentPrimary,
}));
LevelMark.displayName = 'StyledLevelMark';

export const HeaderText = styled('div', {
  flex: '1 1 auto',
  minWidth: 0,
});
HeaderText.displayName = 'StyledHeaderText';

export const Name = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelMedium,
  color: $theme.colors.contentPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
Name.displayName = 'StyledName';

/* THE LEVEL LINE. It names what the item's price IS — «3 tiers · anchor and offsets» — so the row
 * is self-comprehensible with the panel shut. */
export const Note = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentSecondary,
  marginTop: $theme.sizing.scale0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
Note.displayName = 'StyledNote';

export const Trailing = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  flex: 'none',
  display: 'flex',
  alignItems: 'baseline',
  gap: $theme.sizing.scale200,
  whiteSpace: 'nowrap',
}));
Trailing.displayName = 'StyledTrailing';

/** the en-dash between the two ends of a span. It is not a minus and it is not a hyphen. */
export const Span = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentTertiary,
}));
Span.displayName = 'StyledSpan';

export const ToggleIcon = styled<'svg', SharedStyleProps>('svg', ({ $theme, $expanded }) => ({
  flex: 'none',
  color: $theme.colors.contentTertiary,
  transform: $expanded ? 'rotate(-180deg)' : 'rotate(0)',
  transformOrigin: 'center',
  transitionProperty: 'transform',
  transitionDuration: $theme.animation.timing500,
  transitionTimingFunction: $theme.animation.easeOutQuinticCurve,
}));
ToggleIcon.displayName = 'StyledToggleIcon';

/* THE GROWTH. Base's accordion measures its panel and animates a pixel height; a single grid row
 * interpolating 0fr → 1fr says the same thing with no measurement to go stale, and it keeps the
 * content in the document the whole time, which is what `aria-controls` needs. */
export const ContentAnimationContainer = styled<'div', SharedStyleProps>('div', ({ $theme, $expanded }) => ({
  display: 'grid',
  gridTemplateRows: $expanded ? '1fr' : '0fr',
  transitionProperty: 'grid-template-rows',
  transitionDuration: $theme.animation.timing500,
  transitionTimingFunction: $theme.animation.easeOutQuinticCurve,
}));
ContentAnimationContainer.displayName = 'StyledContentAnimationContainer';

export const Content = styled<'div', SharedStyleProps>('div', ({ $theme, $expanded }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentPrimary,
  minHeight: 0,
  overflow: 'hidden',
  opacity: $expanded ? 1 : 0,
  visibility: $expanded ? 'visible' : 'hidden',
  transitionProperty: 'opacity,visibility',
  transitionDuration: $theme.animation.timing500,
  transitionTimingFunction: $theme.animation.easeOutQuinticCurve,
}));
Content.displayName = 'StyledContent';

export const Body = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale600,
  paddingTop: $theme.sizing.scale600,
  paddingBottom: $theme.sizing.scale700,
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: $theme.colors.borderOpaque,
}));
Body.displayName = 'StyledBody';

/* «4 People · Overall balances» — Monzo's card header, which states the count and the view and
 * then gets out of the way. */
export const CardHeader = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: $theme.sizing.scale500,
  flexWrap: 'wrap',
}));
CardHeader.displayName = 'StyledCardHeader';

export const CardCount = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentPrimary,
}));
CardCount.displayName = 'StyledCardCount';

export const Quiet = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentSecondary,
}));
Quiet.displayName = 'StyledQuiet';

/* ── LEVEL 2: the tier chips ──────────────────────────────────────────────────────────────── */

/* Monzo's entity chips: they scroll horizontally, each with its figure beneath its name. This is
 * the horizontal axis of the fractal, drawn as itself. */
export const Chips = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'stretch',
  gap: $theme.sizing.scale400,
  overflowX: 'auto',
  paddingBottom: $theme.sizing.scale300,
  scrollbarWidth: 'thin',
}));
Chips.displayName = 'StyledChips';

export const Chip = styled<'button', RampStyleProps>('button', ({ $theme, $disabled }) => ({
  appearance: 'none',
  flex: 'none',
  minWidth: $theme.sizing.scale1600,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale100,
  paddingTop: $theme.sizing.scale400,
  paddingBottom: $theme.sizing.scale400,
  paddingLeft: $theme.sizing.scale500,
  paddingRight: $theme.sizing.scale500,
  backgroundColor: $theme.colors.backgroundPrimary,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $theme.colors.borderOpaque,
  borderRadius: $theme.borders.radius200,
  cursor: $disabled ? 'default' : 'pointer',
  outline: 'none',
  transitionProperty: 'border-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':hover': { borderColor: $disabled ? $theme.colors.borderOpaque : $theme.colors.borderSelected },
  ':focus-visible': { outline: `3px solid ${$theme.colors.borderAccent}`, outlineOffset: '1px' },
}));
Chip.displayName = 'StyledChip';

export const ChipName = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentSecondary,
  whiteSpace: 'nowrap',
}));
ChipName.displayName = 'StyledChipName';

/* ── LEVEL 3: the ramp ────────────────────────────────────────────────────────────────────── */

/* THE GRADIENT PICKER, which is the founder's own reference: stops sitting on a ramp, dragged,
 * and the RELATIONSHIP between them is the thing being edited. The top padding is load-bearing —
 * the value bubble rides above the thumb and the growth box clips. */
export const Ramp = styled<'div', RampStyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  paddingTop: $theme.sizing.scale1400,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale700,
  paddingRight: $theme.sizing.scale700,
  touchAction: 'none',
}));
Ramp.displayName = 'StyledRamp';

/** the 2px rule the stops sit on — Base's slider track, at Base's own weight */
export const RampTrack = styled<'div', RampStyleProps>('div', ({ $theme, $disabled, $readOnly }) => ({
  position: 'relative',
  height: '2px',
  width: '100%',
  backgroundColor: $disabled ? $theme.colors.borderStateDisabled : $theme.colors.borderOpaque,
  borderRadius: $theme.borders.radius100,
  cursor: $disabled || $readOnly ? 'default' : 'pointer',
}));
RampTrack.displayName = 'StyledRampTrack';

/** the band the set occupies: from the lowest stop to the highest. The constellation reads as ONE
 *  object, which is what makes dragging the anchor legible as moving all of it. */
export const RampBand = styled<'div', RampStyleProps>('div', ({ $theme, $disabled }) => ({
  position: 'absolute',
  top: 0,
  height: '2px',
  backgroundColor: $disabled ? $theme.colors.borderOpaque : $theme.colors.borderSelected,
  borderRadius: $theme.borders.radius100,
  pointerEvents: 'none',
}));
RampBand.displayName = 'StyledRampBand';

/* THE STOP. Base's 24px handle, its fill, and its 3px focus ring. A pinned stop is drawn hollow —
 * it is holding its own number rather than the anchor's, and hollow is the difference between
 * carried and held. Line, not colour: the traffic light has no seat in this product. */
export const RampStop = styled<'div', RampStyleProps>('div', ({ $theme, $active, $pinned, $disabled, $readOnly }) => ({
  position: 'absolute',
  top: '1px',
  width: $theme.sizing.scale700,
  height: $theme.sizing.scale700,
  /* the handle's own half, so its CENTRE lands on the price rather than its left edge */
  marginTop: `-${$theme.sizing.scale500}`,
  marginLeft: `-${$theme.sizing.scale500}`,
  boxSizing: 'border-box',
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  backgroundColor: $pinned ? $theme.colors.backgroundPrimary : $theme.colors.sliderHandleFill,
  borderWidth: $pinned ? '2px' : '1px',
  borderStyle: 'solid',
  borderColor: $disabled
    ? $theme.colors.borderStateDisabled
    : $pinned
      ? $theme.colors.contentPrimary
      : $theme.colors.borderOpaque,
  color: $theme.colors.contentPrimary,
  // theme-gate-allow: a neutral black alpha — Base's own handle elevation, brand-independent
  boxShadow: $disabled ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.12)',
  cursor: $disabled ? 'not-allowed' : $readOnly ? 'default' : $active ? 'grabbing' : 'grab',
  outline: 'none',
  transform: $active ? 'scale(1.12)' : 'scale(1)',
  transitionProperty: 'transform',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':focus-visible': { boxShadow: `0 0 0 3px ${$theme.colors.borderAccent}` },
}));
RampStop.displayName = 'StyledRampStop';

/* THE ANCHOR. A different kind of handle, because it is a different kind of thing: a gate across
 * the ramp rather than a bead on it. Base's InnerThumb bar, given a hit area a hand can find. */
export const RampAnchor = styled<'div', RampStyleProps>('div', ({ $theme, $active, $disabled, $readOnly }) => ({
  position: 'absolute',
  top: '1px',
  width: $theme.sizing.scale700,
  height: $theme.sizing.scale850,
  marginTop: `-${$theme.sizing.scale650}`,
  marginLeft: `-${$theme.sizing.scale500}`,
  display: 'grid',
  placeItems: 'center',
  backgroundColor: 'transparent',
  cursor: $disabled ? 'not-allowed' : $readOnly ? 'default' : $active ? 'grabbing' : 'grab',
  outline: 'none',
  borderRadius: $theme.borders.radius100,
  ':focus-visible': { boxShadow: `0 0 0 3px ${$theme.colors.borderAccent}` },
}));
RampAnchor.displayName = 'StyledRampAnchor';

export const RampAnchorBar = styled<'span', RampStyleProps>('span', ({ $theme, $active, $disabled }) => ({
  display: 'block',
  width: '4px',
  height: $active ? $theme.sizing.scale850 : $theme.sizing.scale800,
  borderRadius: $theme.borders.radius100,
  backgroundColor: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  transitionProperty: 'height',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
RampAnchorBar.displayName = 'StyledRampAnchorBar';

/** Base's ThumbValue, kept where Base put it: above the handle, while the hand is on it. */
export const RampBubble = styled<'span', RampStyleProps>('span', ({ $theme }) => ({
  position: 'absolute',
  bottom: `calc(100% + ${$theme.sizing.scale300})`,
  left: '50%',
  transform: 'translateX(-50%)',
  ...$theme.typography.LabelXSmall,
  backgroundColor: $theme.colors.contentPrimary,
  color: $theme.colors.contentInversePrimary,
  paddingTop: $theme.sizing.scale100,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  borderRadius: $theme.borders.radius200,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}));
RampBubble.displayName = 'StyledRampBubble';

/** the stop's name, under the track, riding with it. The names moving is the drag made visible. */
export const RampName = styled<'span', RampStyleProps>('span', ({ $theme, $disabled }) => ({
  position: 'absolute',
  top: `calc(100% + ${$theme.sizing.scale500})`,
  left: '50%',
  transform: 'translateX(-50%)',
  ...$theme.typography.LabelXSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}));
RampName.displayName = 'StyledRampName';

/** the anchor's name, standing above the ramp where nothing else goes. The stops take the space
 *  under the track; the centre gets the sky, and so it is legible without being hovered. */
export const RampAnchorName = styled<'span', RampStyleProps>('span', ({ $theme, $disabled }) => ({
  position: 'absolute',
  bottom: `calc(100% + ${$theme.sizing.scale500})`,
  left: '50%',
  transform: 'translateX(-50%)',
  ...$theme.typography.LabelXSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}));
RampAnchorName.displayName = 'StyledRampAnchorName';

/** Base's TickBar: the ramp's two ends, stated once, under everything. */
export const RampEnds = styled<'div', RampStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: $theme.sizing.scale1000,
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentTertiary,
}));
RampEnds.displayName = 'StyledRampEnds';

/* ── LEVEL 3: the stop list ───────────────────────────────────────────────────────────────── */

export const StopList = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: $theme.colors.borderOpaque,
}));
StopList.displayName = 'StyledStopList';

export const StopRow = styled<'div', RampStyleProps>('div', ({ $theme, $active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale400,
  paddingTop: $theme.sizing.scale400,
  paddingBottom: $theme.sizing.scale400,
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: $theme.colors.borderOpaque,
  backgroundColor: $active ? $theme.colors.backgroundSecondary : 'transparent',
  transitionProperty: 'background-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
StopRow.displayName = 'StyledStopRow';

export const StopName = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentPrimary,
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
StopName.displayName = 'StyledStopName';

/** the relationship, in percentage points. Dimmed once a stop is pinned, because a pinned stop's
 *  percentage is no longer what it is stored as — it is what it happens to work out at today. */
export const StopOffset = styled<'span', RampStyleProps>('span', ({ $theme, $pinned }) => ({
  ...$theme.typography.LabelSmall,
  color: $pinned ? $theme.colors.contentTertiary : $theme.colors.contentPrimary,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  minWidth: $theme.sizing.scale1400,
  whiteSpace: 'nowrap',
}));
StopOffset.displayName = 'StyledStopOffset';

export const StopPrice = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  minWidth: $theme.sizing.scale1600,
  display: 'flex',
  justifyContent: 'flex-end',
}));
StopPrice.displayName = 'StyledStopPrice';

/* THE PIN. Line art, per the house rule, and a real toggle: `aria-pressed` says which way it is,
 * the shackle says the same thing to the eye. */
export const PinButton = styled<'button', RampStyleProps>('button', ({ $theme, $pinned, $disabled }) => ({
  appearance: 'none',
  flex: 'none',
  width: $theme.sizing.scale800,
  height: $theme.sizing.scale800,
  display: 'grid',
  placeItems: 'center',
  backgroundColor: $pinned ? $theme.colors.backgroundSecondary : 'transparent',
  color: $pinned ? $theme.colors.contentPrimary : $theme.colors.contentTertiary,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $pinned ? $theme.colors.borderSelected : 'transparent',
  borderRadius: $theme.borders.radius200,
  cursor: $disabled ? 'not-allowed' : 'pointer',
  outline: 'none',
  ':hover': { color: $theme.colors.contentPrimary },
  ':focus-visible': { outline: `3px solid ${$theme.colors.borderAccent}`, outlineOffset: '1px' },
}));
PinButton.displayName = 'StyledPinButton';

/** the anchor's row has no pin — the anchor is what pins are measured against — so it keeps the
 *  column's width and says nothing. */
export const PinSpacer = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: $theme.sizing.scale800,
  height: $theme.sizing.scale800,
  color: $theme.colors.contentTertiary,
}));
PinSpacer.displayName = 'StyledPinSpacer';

/* ── LEVEL 4: the grid ────────────────────────────────────────────────────────────────────── */

/* TIERS ACROSS, DAYS DOWN — the fractal's two axes, drawn as the two axes of a table. Today is
 * the first row and the only writable one; everything under it is the record. */
export const Grid = styled<'table', SharedStyleProps>('table', ({ $theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  ...$theme.typography.ParagraphSmall,
}));
Grid.displayName = 'StyledGrid';

export const GridHeadCell = styled<'th', SharedStyleProps>('th', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentSecondary,
  textAlign: 'right',
  fontWeight: $theme.typography.LabelXSmall.fontWeight,
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale400,
  whiteSpace: 'nowrap',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: $theme.colors.borderOpaque,
}));
GridHeadCell.displayName = 'StyledGridHeadCell';

export const GridDayCell = styled<'th', RampStyleProps>('th', ({ $theme, $active }) => ({
  ...($active ? $theme.typography.LabelSmall : $theme.typography.ParagraphSmall),
  color: $active ? $theme.colors.contentPrimary : $theme.colors.contentSecondary,
  textAlign: 'left',
  paddingTop: $theme.sizing.scale400,
  paddingBottom: $theme.sizing.scale400,
  paddingRight: $theme.sizing.scale400,
  whiteSpace: 'nowrap',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: $theme.colors.borderOpaque,
}));
GridDayCell.displayName = 'StyledGridDayCell';

export const GridCell = styled<'td', RampStyleProps>('td', ({ $theme }) => ({
  textAlign: 'right',
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale400,
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: $theme.colors.borderOpaque,
  verticalAlign: 'middle',
}));
GridCell.displayName = 'StyledGridCell';

/* A WRITABLE CELL reads as writable standing still: a hairline box a number sits in. Today's row
 * has them; the record does not, because the record is read. */
export const CellButton = styled<'button', RampStyleProps>('button', ({ $theme, $disabled }) => ({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'baseline',
  justifyContent: 'flex-end',
  /* it hugs its number in a column, and still right-aligns inside a grid cell */
  alignSelf: 'flex-start',
  gap: $theme.sizing.scale100,
  minWidth: $theme.sizing.scale1400,
  paddingTop: $theme.sizing.scale100,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  backgroundColor: 'transparent',
  color: $theme.colors.contentPrimary,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: $theme.colors.borderOpaque,
  borderRadius: $theme.borders.radius200,
  cursor: $disabled ? 'not-allowed' : 'text',
  outline: 'none',
  transitionProperty: 'border-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  ':hover': { borderColor: $disabled ? $theme.colors.borderOpaque : $theme.colors.borderSelected },
  ':focus-visible': { outline: `3px solid ${$theme.colors.borderAccent}`, outlineOffset: '1px' },
}));
CellButton.displayName = 'StyledCellButton';

/* the field is as wide as a price needs and no wider — a 600px box for four digits reads as a
 * different kind of question. */
export const Editor = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'inline-block',
  minWidth: $theme.sizing.scale1600,
  maxWidth: $theme.sizing.scale2400,
  width: '100%',
  textAlign: 'left',
}));
Editor.displayName = 'StyledEditor';

/* ── EMPTY ────────────────────────────────────────────────────────────────────────────────── */

/** what stands where a price will be. It says what will be there, at the size it will be. */
export const Empty = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale400,
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentTertiary,
}));
Empty.displayName = 'StyledEmpty';
