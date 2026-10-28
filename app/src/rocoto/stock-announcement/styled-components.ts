/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type steps, the spacing scale, the borders,
 * the colours. There are no invented numbers and no paint. The one colour with a rule attached is
 * the accent: it appears on exactly one element in this file, the attribution mark, because the
 * only thing on this panel the machine did by itself is read the document.
 */
import { styled } from 'baseui';
import type { Theme } from 'baseui';
import type { SharedStyleProps, LevelSharedStyleProps } from './types';

/* A control we draw ourselves still has to answer the keyboard the way Base's own do: the ring
 * only on `:focus-visible`, in Base's own selected-border colour, offset off the shape. */
const focusRing = ($theme: { colors: { borderSelected: string } }) => ({
  ':focus-visible': {
    outline: `${$theme.colors.borderSelected} solid 3px`,
    outlineOffset: '2px',
  },
});

const ellipsis = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

/* Base's own hairline, written as LONGHANDS on every side. Styletron emits one atomic class per
 * declaration and gives no ordering guarantee between a shorthand and a longhand, so a border
 * whose sides differ — the row's leading rule below — cannot be built by spreading
 * `borders.border300` and correcting one side afterwards. Every side is stated. */
const hairline = ($theme: Theme) => {
  /* Base types a border's style as the whole CSS union; naming the one it actually holds keeps
   * these longhands assignable without widening every side to `string`. */
  const w = $theme.borders.border300.borderWidth as string;
  const s = $theme.borders.border300.borderStyle as 'solid';
  const c = $theme.colors.borderOpaque;
  return {
    borderTopWidth: w, borderRightWidth: w, borderBottomWidth: w, borderLeftWidth: w,
    borderTopStyle: s, borderRightStyle: s, borderBottomStyle: s, borderLeftStyle: s,
    borderTopColor: c, borderRightColor: c, borderBottomColor: c, borderLeftColor: c,
  };
};

/** The four corners of one radius, as longhands for the same reason. */
const corners = (r: string) => ({
  borderTopLeftRadius: r,
  borderTopRightRadius: r,
  borderBottomLeftRadius: r,
  borderBottomRightRadius: r,
});

/* ── THE PANEL ─────────────────────────────────────────────────────────────────────────────── */

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  backgroundColor: $theme.colors.backgroundPrimary,
  ...hairline($theme),
  ...corners($theme.borders.radius300),
  overflow: 'hidden',
}));
Root.displayName = 'StockAnnouncement';

/* THE STANDING ROW. Monzo's row grammar — one fact, the label on the left and the figure on the
 * right — and it is here because it is what makes the flip legible: 40 becomes 40 in one mode and
 * 112 in the other only because 72 is already on the panel. */
export const Standing = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  /* ⚠ MONZO-STYLE CENTRED (§127.4d). This was label-left / figure-right — Monzo's ROW grammar,
     which is right for a list of facts and wrong for the one fact a sheet is about. «It should
     all be Monzo-style centered»: the goods and where they stand read as one centred line, on
     the same axis as the number underneath them. */
  justifyContent: 'center',
  gap: $theme.sizing.scale400,
  paddingTop: $theme.sizing.scale500,
  paddingBottom: $theme.sizing.scale500,
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  borderBottomWidth: $theme.borders.border300.borderWidth as string,
  borderBottomStyle: $theme.borders.border300.borderStyle as 'solid',
  borderBottomColor: $theme.colors.borderOpaque,
  backgroundColor: $theme.colors.backgroundSecondary,
}));
Standing.displayName = 'StockAnnouncementStanding';

export const StandingLabel = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  ...$theme.typography.LabelSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  /* the label no longer PUSHES the figure to the far edge (§127.4d) — the two sit together on
     the card's axis, which is what makes them read as one sentence about one thing */
  minWidth: 0,
  ...ellipsis,
}));
StandingLabel.displayName = 'StockAnnouncementStandingLabel';

/* THE TABS. Base's own Segmented Control sits in here — the sliding active block, the arrow-key
 * navigation and the focus handling are Base's engineering, unmodified. */
export const Modes = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  paddingTop: $theme.sizing.scale600,
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
}));
Modes.displayName = 'StockAnnouncementModes';

export const Body = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  /* the number beat takes the card's axis too (§127.4d) — one question, centred, and every
     line under it hung from the same middle */
  alignItems: 'stretch',
  textAlign: 'center',
  gap: $theme.sizing.scale500,
  padding: $theme.sizing.scale600,
}));
Body.displayName = 'StockAnnouncementBody';

export const Entry = styled<'div', SharedStyleProps>('div', () => ({
  display: 'block',
}));
Entry.displayName = 'StockAnnouncementEntry';

/* THE ATTRIBUTION. The one line that says where the number in the field came from. Reading a
 * quantity off a photographed document is the machine's own act, so the mark beside it is the
 * accent — and it is the ONLY accent on the panel. The moment a hand changes the number the act
 * is the person's, and the line goes back to ink. */
export const Attribution = styled<'div', SharedStyleProps>('div', ({ $theme, $proposed, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: $theme.sizing.scale300,
  ...$theme.typography.LabelXSmall,
  color: $disabled
    ? $theme.colors.contentStateDisabled
    : $proposed
      ? $theme.colors.contentPrimary
      : $theme.colors.contentSecondary,
  minHeight: $theme.sizing.scale700,
}));
Attribution.displayName = 'StockAnnouncementAttribution';

export const AttributionMark = styled<'span', SharedStyleProps>('span', ({ $theme, $proposed, $disabled }) => ({
  display: 'inline-flex',
  flexShrink: 0,
  color: $disabled
    ? $theme.colors.contentStateDisabled
    : $proposed
      ? $theme.colors.accent
      : $theme.colors.contentTertiary,
}));
AttributionMark.displayName = 'StockAnnouncementAttributionMark';

/* THE CAMERA. AT THE NAME MOMENT where the panel has one (FEED-IA §113 · §115.5: «the field where
 * they choose the product OR take a photo»), and below the entry on the add tab where it does not
 * — a photograph is evidence of an arrival, and an arrival is an addition. */
export const Camera = styled<'div', SharedStyleProps>('div', () => ({
  display: 'block',
}));
Camera.displayName = 'StockAnnouncementCamera';

/* ── THE FILM'S OWN ELEMENTS (FEED-IA §115.5 · §115.6) ─────────────────────────────────────────
 * «The field where they choose the product or take a photo, then choose it, and then it shows how
 * much stock they just added and the number.» Three beats, one scene each — and the panel is
 * never a grid of same-size boxes, which is the shape he struck out by name.
 */

/** BEAT 1 · THE FIELD. One question, all the room it wants, and the camera under it.
 *
 *  ⚠ AND IT IS CENTRED (FEED-IA §127.4d, off S1: «why is the text saying "on hand" left-aligned
 *  like this? It should ALL be Monzo-style centered»). One question on a screen has no column to
 *  align to — a lone field pinned left in a 460px card reads as the first cell of a table that
 *  never arrives. Monzo's sheets put the one thing being asked on the card's own axis, and that
 *  is what a typeform beat is. The FIELD keeps its own internal grammar (the face left, the rail
 *  right) because that is a row of words and not a caption. */
export const Naming = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  /* CENTRED IS THE TEXT'S JOB, NOT THE CONTROLS' (§127.4d). Monzo centres what is READ and lets
     what is TOUCHED take the card's full measure — a field that shrank to fit its own placeholder
     would change width on the first keystroke, which is the jitter §119.2 just killed. */
  alignItems: 'stretch',
  textAlign: 'center',
  gap: $theme.sizing.scale500,
  padding: $theme.sizing.scale600,
}));
Naming.displayName = 'StockAnnouncementNaming';

/** what the words landed on, said back on its own line — the capture, and never an offer.
 *
 *  ⚠ ITS SEAT IS RESERVED, PAINTED OR NOT (FEED-IA §119.2 · §37.3: the seat is layout, the mark
 *  is ink). Drawn only once the words had landed, this row APPEARED under a field somebody was
 *  still typing into and pushed it 14px up the card — «the jitteryness can improve, the height
 *  keeps changing». The line's own height is held from the first keystroke, so what lands here
 *  lands INTO a space that was already its own. */
export const Chosen = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: $theme.sizing.scale300,
  minHeight: $theme.sizing.scale750,
  ...$theme.typography.LabelSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  ...ellipsis,
}));
Chosen.displayName = 'StockAnnouncementChosen';

/** BEAT 3 · THE LANDING. One scene, centred, and THE NUMBER is the whole of it. */
export const Landed = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: $theme.sizing.scale400,
  padding: `${$theme.sizing.scale900} ${$theme.sizing.scale600}`,
}));
Landed.displayName = 'StockAnnouncementLanded';

/** his own sentence, over the figure it is about — «you just added X» */
export const LandedSaid = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelMedium,
  color: $theme.colors.contentSecondary,
}));
LandedSaid.displayName = 'StockAnnouncementLandedSaid';

/** where the stock now stands, and what it stands for — quiet, under the number (§76) */
export const LandedNote = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentTertiary,
  maxWidth: '40ch',
}));
LandedNote.displayName = 'StockAnnouncementLandedNote';

/* THE CHIP. Two hit areas in one shape: the body previews, the trash throws away and lets the
 * picture be taken again. */
export const Chip = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  ...hairline($theme),
  ...corners($theme.borders.radius200),
  paddingLeft: $theme.sizing.scale100,
  paddingRight: $theme.sizing.scale100,
  backgroundColor: $theme.colors.backgroundPrimary,
}));
Chip.displayName = 'StockAnnouncementChip';

export const ChipPreview = styled<'button', SharedStyleProps>('button', ({ $theme, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  flexGrow: 1,
  minWidth: 0,
  textAlign: 'left',
  backgroundColor: 'transparent',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  paddingTop: $theme.sizing.scale200,
  paddingBottom: $theme.sizing.scale200,
  paddingLeft: $theme.sizing.scale200,
  paddingRight: $theme.sizing.scale200,
  borderTopLeftRadius: $theme.borders.radius100,
  borderTopRightRadius: $theme.borders.radius100,
  borderBottomLeftRadius: $theme.borders.radius100,
  borderBottomRightRadius: $theme.borders.radius100,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  cursor: $disabled ? 'not-allowed' : 'pointer',
  ...focusRing($theme),
}));
ChipPreview.displayName = 'StockAnnouncementChipPreview';

export const ChipThumb = styled<'img', SharedStyleProps>('img', ({ $theme }) => ({
  flexShrink: 0,
  width: $theme.sizing.scale900,
  height: $theme.sizing.scale800,
  objectFit: 'cover',
  backgroundColor: $theme.colors.backgroundTertiary,
  borderTopLeftRadius: $theme.borders.radius100,
  borderTopRightRadius: $theme.borders.radius100,
  borderBottomLeftRadius: $theme.borders.radius100,
  borderBottomRightRadius: $theme.borders.radius100,
}));
ChipThumb.displayName = 'StockAnnouncementChipThumb';

export const ChipLabel = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  minWidth: 0,
  ...ellipsis,
}));
ChipLabel.displayName = 'StockAnnouncementChipLabel';

export const ChipTrash = styled<'button', SharedStyleProps>('button', ({ $theme, $disabled }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  backgroundColor: 'transparent',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  borderTopLeftRadius: $theme.borders.radius100,
  borderTopRightRadius: $theme.borders.radius100,
  borderBottomLeftRadius: $theme.borders.radius100,
  borderBottomRightRadius: $theme.borders.radius100,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  cursor: $disabled ? 'not-allowed' : 'pointer',
  ':hover': { color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary },
  ...focusRing($theme),
}));
ChipTrash.displayName = 'StockAnnouncementChipTrash';

/* THE CONSEQUENCE. The sentence the flip rewrites, and the reason the flip is safe to make: the
 * number that was typed stays put, and this line states what will happen to it. */
export const Consequence = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  display: 'flex',
  alignItems: 'baseline',
  /* on the card's own axis, under the number it is about (§127.4d) */
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: $theme.sizing.scale300,
  ...$theme.typography.LabelSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
}));
Consequence.displayName = 'StockAnnouncementConsequence';

export const Stamp = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  ...$theme.typography.LabelXSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
}));
Stamp.displayName = 'StockAnnouncementStamp';

export const Submit = styled<'div', SharedStyleProps>('div', () => ({
  display: 'block',
}));
Submit.displayName = 'StockAnnouncementSubmit';

/* ── THE PREVIEW ───────────────────────────────────────────────────────────────────────────── */

export const Preview = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale500,
}));
Preview.displayName = 'StockAnnouncementPreview';

/* The picture is sized to ITSELF, centred, and capped — never stretched to the card's width with
 * a ground showing through either side. A document is usually portrait and the card is not, so
 * `width: 100%` here painted two grey bands around every preview. */
export const PreviewImage = styled<'img', SharedStyleProps>('img', ({ $theme }) => ({
  display: 'block',
  alignSelf: 'center',
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: $theme.sizing.scale4800,
  objectFit: 'contain',
  borderTopLeftRadius: $theme.borders.radius200,
  borderTopRightRadius: $theme.borders.radius200,
  borderBottomLeftRadius: $theme.borders.radius200,
  borderBottomRightRadius: $theme.borders.radius200,
}));
PreviewImage.displayName = 'StockAnnouncementPreviewImage';

export const PreviewCaption = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentSecondary,
}));
PreviewCaption.displayName = 'StockAnnouncementPreviewCaption';

/* ── THE ROW: paper trail vs working reality ───────────────────────────────────────────────── */

/* The two states have to be different at a glance, and this product has no traffic light to make
 * them different with. So the difference is structural: the mark tile INVERTS when a person is
 * standing in front of the documents, and a rule runs down the row's leading edge. Both survive
 * any re-theme, because both are ink. */
export const LevelRoot = styled<'div', LevelSharedStyleProps>('div', ({ $theme, $overridden }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale500,
  width: '100%',
  paddingTop: $theme.sizing.scale500,
  paddingBottom: $theme.sizing.scale500,
  paddingRight: $theme.sizing.scale500,
  paddingLeft: $overridden ? $theme.sizing.scale550 : $theme.sizing.scale600,
  backgroundColor: $theme.colors.backgroundPrimary,
  ...hairline($theme),
  ...corners($theme.borders.radius300),
  borderLeftColor: $overridden ? $theme.colors.contentPrimary : $theme.colors.borderOpaque,
  borderLeftWidth: $overridden ? $theme.sizing.scale0 : ($theme.borders.border300.borderWidth as string),
}));
LevelRoot.displayName = 'StockLevel';

export const Mark = styled<'div', LevelSharedStyleProps>('div', ({ $theme, $overridden, $disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: $theme.sizing.scale950,
  height: $theme.sizing.scale950,
  borderTopLeftRadius: $theme.borders.radius200,
  borderTopRightRadius: $theme.borders.radius200,
  borderBottomLeftRadius: $theme.borders.radius200,
  borderBottomRightRadius: $theme.borders.radius200,
  backgroundColor: $overridden ? $theme.colors.contentPrimary : $theme.colors.backgroundSecondary,
  color: $overridden
    ? $theme.colors.backgroundPrimary
    : $disabled
      ? $theme.colors.contentStateDisabled
      : $theme.colors.contentSecondary,
}));
Mark.displayName = 'StockLevelMark';

export const LevelBody = styled<'div', LevelSharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale0,
  flexGrow: 1,
  minWidth: 0,
}));
LevelBody.displayName = 'StockLevelBody';

export const LevelName = styled<'div', LevelSharedStyleProps>('div', ({ $theme, $disabled }) => ({
  ...$theme.typography.LabelMedium,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  ...ellipsis,
}));
LevelName.displayName = 'StockLevelName';

export const Note = styled<'div', LevelSharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentTertiary,
  ...ellipsis,
}));
Note.displayName = 'StockLevelNote';

export const LevelValue = styled<'div', LevelSharedStyleProps>('div', () => ({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'baseline',
}));
LevelValue.displayName = 'StockLevelValue';

export const EvidenceButton = styled<'button', LevelSharedStyleProps>('button', ({ $theme, $disabled }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  backgroundColor: 'transparent',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  paddingTop: $theme.sizing.scale200,
  paddingBottom: $theme.sizing.scale200,
  paddingLeft: $theme.sizing.scale200,
  paddingRight: $theme.sizing.scale200,
  borderTopLeftRadius: $theme.borders.radius100,
  borderTopRightRadius: $theme.borders.radius100,
  borderBottomLeftRadius: $theme.borders.radius100,
  borderBottomRightRadius: $theme.borders.radius100,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentSecondary,
  cursor: $disabled ? 'not-allowed' : 'pointer',
  ':hover': { color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary },
  ...focusRing($theme),
}));
EvidenceButton.displayName = 'StockLevelEvidence';
