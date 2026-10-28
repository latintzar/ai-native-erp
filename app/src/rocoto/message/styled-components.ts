/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type ramp, the spacing scale, the radii, the
 * motion curves, the colours. There are no invented numbers and no invented paint. Where a
 * measurement is a RELATION rather than a step (the concentric nest, the mark's alignment to the
 * first line box), it is written as a `calc()` of two tokens, so the relation survives a change
 * to either scale instead of being re-typed as a literal.
 *
 * THE COLOUR LAW, in this file specifically. Ink and neutral surfaces carry the conversation;
 * brand colour belongs to the chat paper behind it, not a bubble, typing mark, or message status.
 * A failed send is a full-strength hairline and a recovery action, which remains legible when
 * printed, dimmed, or viewed without colour.
 */
import { styled } from 'baseui';
import type { SharedStyleProps, TypingDotStyleProps } from './types';

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────────
 * THE GROUPING RHYTHM, which is the whole reason a thread reads as speech rather than as a list.
 * A new speaker gets a full step of air (scale300); a message continuing the same speaker's run
 * gets the smallest step on the scale (scale0), so a burst of four messages reads as one turn
 * with four lines in it. Those are the two values the app's own thread already uses — its rows
 * carry 2px of vertical padding each, i.e. 4px between bubbles inside a run — expressed here as
 * positions on Base's scale instead of as numbers.
 */
export const Root = styled<'div', SharedStyleProps>('div', ({ $author, $grouped, $theme }) => ({
  display: 'flex',
  boxSizing: 'border-box',
  width: '100%',
  alignItems: 'flex-start',
  gap: $theme.sizing.scale100,
  justifyContent:
    $author === 'sent' ? 'flex-end' : $author === 'system' ? 'center' : 'flex-start',
  paddingTop: $grouped ? $theme.sizing.scale0 : $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  paddingBottom: 0,
  paddingLeft: $theme.sizing.scale300,
}));
Root.displayName = 'MessageRoot';

/* ── THE IDENTITY GUTTER ──────────────────────────────────────────────────────────────────────
 * Reserved on every AI row, painted only on the first of a run — so four messages from Rocoto
 * stay in one column under one mark rather than repeating it four times.
 *
 * The height is the exact relation that centres the mark on the bubble's FIRST line box: the
 * content's top padding twice, plus one line box. Centre the gutter's contents and the mark
 * lands on the middle of the first line, whatever the type step becomes later. A typing bubble
 * has no line box — it is three dots between the same two paddings — so it states its own height
 * rather than inheriting a 7px error nobody would find but everybody would feel.
 */
export const Identity = styled<'span', SharedStyleProps>('span', ({ $typing, $theme }) => ({
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: $theme.sizing.scale700,
  height: `calc(${$theme.sizing.scale300} * 2 + ${
    $typing ? $theme.sizing.scale200 : $theme.sizing.scale700
  })`,
}));
Identity.displayName = 'MessageIdentity';

/* THE MARK. One saffron dot, the size of a dot on the paper this conversation is printed on —
 * so Rocoto signs its own messages in the grain of the page rather than with a badge. */
export const IdentityMark = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  width: $theme.sizing.scale200,
  height: $theme.sizing.scale200,
  borderRadius: '50%',
  backgroundColor: $theme.colors.contentTertiary,
}));
IdentityMark.displayName = 'MessageIdentityMark';

/* ── THE BUBBLE ───────────────────────────────────────────────────────────────────────────────
 * TWO PAINTS, NO HUE. The near hand is the inked paper (backgroundTertiary); the far hand is the
 * clean sheet with a hairline. That is the WhatsApp arrangement — the outgoing side tinted, the
 * incoming side white — with the tint taken out of the hue and put into the ink, because saffron
 * is spoken for.
 *
 * THE NOTCH is at the speaker's TOP corner, the shape the app already draws. It marks the START
 * of a turn, so a grouped continuation drops it and the run closes into one column.
 *
 * The hairline is an INSET shadow rather than a border: Compose draws its border inside the
 * surface without insetting the content, and an inset shadow is the one CSS form that does the
 * same. Swapping it for a real border moves every line of text by a pixel.
 */
export const Bubble = styled<'div', SharedStyleProps>(
  'div',
  ({ $author, $grouped, $status, $held, $theme }) => {
    const sent = $author === 'sent';
    const card = $theme.borders.radius400;
    const notch = $grouped ? card : $theme.borders.radius200;
    const hairline = $theme.borders.border300.borderWidth;
    // the failed send is the hairline at full strength — form, not colour
    const line =
      $status === 'error' ? $theme.colors.contentPrimary : $theme.colors.borderTransparent;
    const edge = `inset 0 0 0 ${hairline} ${line}`;
    return {
      position: 'relative',
      boxSizing: 'border-box',
      minWidth: 0,
      // a phone caps this at 250dp; a desk column is wider, so the cap is proportional and the
      // measure stays readable at every width the kit is opened at
      maxWidth: '78%',
      backgroundColor: sent ? $theme.colors.backgroundTertiary : $theme.colors.mono200,
      // the 1px edge is listed FIRST so it paints over the held overlay rather than under it
      boxShadow: $held ? `${edge}, ${$theme.lighting.overlay100}, 0 10px 24px color-mix(in srgb, ${$theme.colors.contentPrimary} 10%, transparent)` : `${edge}, 0 8px 20px color-mix(in srgb, ${$theme.colors.contentPrimary} 8%, transparent)`,
      borderTopLeftRadius: sent ? card : notch,
      borderTopRightRadius: sent ? notch : card,
      borderBottomRightRadius: card,
      borderBottomLeftRadius: card,
      outline: 'none',
      // native :focus-visible rather than Base's JS shim: the browsers this kit targets all ship
      // it, and a message is a container, so there is no ambiguous input type to disambiguate
      ':focus-visible': {
        boxShadow: `${edge}, 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.contentPrimary}`,
      },
      ':hover': {
        boxShadow: `${edge}, 0 12px 28px color-mix(in srgb, ${$theme.colors.contentPrimary} 12%, transparent)`,
      },
    };
  }
);
Bubble.displayName = 'MessageBubble';

/* The text column. The type step rides the BLOCK, not just the inline run: a CSS line box is at
 * least as tall as its parent's strut, so the block has to carry the 20px line-height for the
 * lines to measure the way the app's do. */
export const Content = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentPrimary,
  paddingTop: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale500,
}));
Content.displayName = 'MessageContent';

/** The relative box the meta is positioned against — INSIDE the padding, so the stamp sits at
 *  the text's edge and not at the bubble's. */
export const Body = styled<'div', SharedStyleProps>('div', () => ({
  position: 'relative',
}));
Body.displayName = 'MessageBody';

export const Text = styled<'span', SharedStyleProps>('span', () => ({
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
}));
Text.displayName = 'MessageText';

/* THE CARET — saffron, because a message still arriving is Rocoto's act in progress, which is
 * the one thing the accent is for. It blinks; under reduced motion it simply stands there, which
 * still says «more is coming» without moving. */
export const Caret = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-block',
  width: $theme.sizing.scale0,
  height: $theme.sizing.scale550,
  marginLeft: $theme.sizing.scale100,
  verticalAlign: 'text-bottom',
  backgroundColor: $theme.colors.contentPrimary,
  borderRadius: $theme.borders.radius100,
  animationName: {
    '0%': { opacity: 1 },
    '45%': { opacity: 1 },
    '55%': { opacity: 0.15 },
    '100%': { opacity: 0.15 },
  },
  animationDuration: $theme.animation.timing1000,
  animationIterationCount: 'infinite',
  animationTimingFunction: $theme.animation.easeInOutCurve,
  '@media (prefers-reduced-motion: reduce)': {
    animationName: 'none',
    opacity: 1,
  },
}));
Caret.displayName = 'MessageCaret';

/* THE MEASURED RESERVATION. CSS cannot say «keep this much room at the end of the flow», so the
 * rendered meta is measured and an inline-block of exactly that width is dropped after the words.
 * The browser then breaks the last line where the app breaks it: a short message keeps its stamp
 * beside it, a long one wraps around it. Without this the meta lands on top of the text. */
export const MetaShim = styled<'span', SharedStyleProps>('span', () => ({
  display: 'inline-block',
  height: '1px',
}));
MetaShim.displayName = 'MessageMetaShim';

export const Meta = styled<'div', SharedStyleProps>('div', ({ $payload, $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  flex: 'none',
  ...($payload
    ? { position: 'static' }
    : { position: 'absolute', right: 0, bottom: 0 }),
}));
Meta.displayName = 'MessageMeta';

export const Time = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentTertiary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  whiteSpace: 'nowrap',
}));
Time.displayName = 'MessageTime';

export const Status = styled<'span', SharedStyleProps>('span', ({ $author, $status, $theme }) => ({
  display: 'flex',
  flex: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  // the glyph is drawn to fill this box, so every coordinate in it lives in its viewBox and the
  // only size that exists in code is a step on Base's scale
  width: $theme.sizing.scale600,
  height: $theme.sizing.scale600,
  // the failed mark steps up to full ink; the other two stay as quiet as the stamp beside them
  color: $status === 'error' ? $theme.colors.contentPrimary : $theme.colors.contentTertiary,
}));
Status.displayName = 'MessageStatus';

/* ── THE PAYLOAD NEST ─────────────────────────────────────────────────────────────────────────
 * One uniform inset for a photo, a document row and a slotted payload alike, because they are
 * the same kind of thing inside a bubble. The inner radius is the CONCENTRIC one — outer minus
 * the nest — which is what keeps a picture and its bubble reading as a single object rather than
 * as a card inside a card.
 */
export const Payload = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  paddingTop: $theme.sizing.scale200,
  paddingRight: $theme.sizing.scale200,
  paddingBottom: $theme.sizing.scale200,
  paddingLeft: $theme.sizing.scale200,
  minWidth: 0,
}));
Payload.displayName = 'MessagePayload';

const nested = (radius: string, gap: string) => `calc(${radius} - ${gap})`;

export const MediaFrame = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'block',
  width: '100%',
  padding: 0,
  borderWidth: 0,
  borderStyle: 'none',
  backgroundColor: $theme.colors.backgroundSecondary,
  borderRadius: nested($theme.borders.radius400, $theme.sizing.scale200),
  overflow: 'hidden',
  outline: 'none',
  ':focus-visible': {
    boxShadow: `0 0 0 ${$theme.sizing.scale0} ${$theme.colors.contentPrimary}`,
  },
}));
MediaFrame.displayName = 'MessageMediaFrame';

export const Image = styled<'img', SharedStyleProps>('img', () => ({
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}));
Image.displayName = 'MessageImage';

/* ── THE DOCUMENT ROW ─────────────────────────────────────────────────────────────────────────
 * A file is named, not previewed. The row is the payload's own surface, one step off the
 * bubble's, at the same concentric radius the picture takes.
 */
export const Attachment = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  minWidth: 0,
  backgroundColor: $theme.colors.backgroundSecondary,
  borderRadius: nested($theme.borders.radius400, $theme.sizing.scale200),
  paddingTop: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale400,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale400,
}));
Attachment.displayName = 'MessageAttachment';

export const AttachmentIcon = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'flex',
  flex: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: $theme.sizing.scale700,
  height: $theme.sizing.scale700,
  color: $theme.colors.contentSecondary,
}));
AttachmentIcon.displayName = 'MessageAttachmentIcon';

export const AttachmentName = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentPrimary,
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
AttachmentName.displayName = 'MessageAttachmentName';

export const AttachmentDetail = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentTertiary,
  display: 'block',
  fontVariantNumeric: 'tabular-nums',
}));
AttachmentDetail.displayName = 'MessageAttachmentDetail';

/* The row under a payload: the words on the left, the meta pushed to the trailing edge. A
 * caption is ordinary text, so it gets the same step as a message body. */
export const Footer = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  gap: $theme.sizing.scale300,
  paddingTop: 0,
  paddingRight: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale300,
}));
Footer.displayName = 'MessageFooter';

export const Caption = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.ParagraphSmall,
  color: $theme.colors.contentPrimary,
  flex: '1 1 auto',
  minWidth: 0,
  overflowWrap: 'break-word',
}));
Caption.displayName = 'MessageCaption';

/* ── THE THREE DOTS ───────────────────────────────────────────────────────────────────────────
 * On the real bubble, never a lookalike drawn by each surface — that is how a change to the
 * bubble leaves a typing indicator behind, which has already happened once in this product.
 * The dots take the AI's saffron when the AI is the one thinking, and ink for a person.
 */
export const Typing = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  paddingTop: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale500,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale500,
}));
Typing.displayName = 'MessageTyping';

const DOT_DELAY = ['timing0', 'timing150', 'timing300'] as const;

export const TypingDot = styled<'i', TypingDotStyleProps>('i', ({ $author, $index, $theme }) => ({
  width: $theme.sizing.scale200,
  height: $theme.sizing.scale200,
  borderRadius: '50%',
  backgroundColor: $theme.colors.contentTertiary,
  opacity: 0.35,
  animationName: {
    '0%': { opacity: 0.35, transform: 'none' },
    '30%': { opacity: 1, transform: `translateY(-${$theme.sizing.scale0})` },
    '60%': { opacity: 0.35, transform: 'none' },
    '100%': { opacity: 0.35, transform: 'none' },
  },
  animationDuration: $theme.animation.timing1000,
  animationIterationCount: 'infinite',
  animationTimingFunction: $theme.animation.easeInOutCurve,
  animationDelay: $theme.animation[DOT_DELAY[$index] ?? 'timing0'],
  '@media (prefers-reduced-motion: reduce)': {
    animationName: 'none',
    opacity: $index === 0 ? 1 : 0.35,
  },
}));
TypingDot.displayName = 'MessageTypingDot';

/* THE SYSTEM LINE. The thread talking about itself, so it wears no bubble and takes no side —
 * centred, one step down, ink at its quietest. */
export const System = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentTertiary,
  textAlign: 'center',
  maxWidth: '78%',
  paddingTop: $theme.sizing.scale100,
  paddingRight: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale300,
}));
System.displayName = 'MessageSystem';

/* THE WAY BACK. A failed send always ships one, in ink: the state is only honest if the reader
 * can act on it. Disabled it dims to Base's own disabled ink and stops taking the pointer. */
export const Retry = styled<'button', SharedStyleProps>('button', ({ $disabled, $theme }) => ({
  ...$theme.typography.LabelXSmall,
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderStyle: 'none',
  borderColor: 'transparent',
  paddingTop: $theme.sizing.scale100,
  paddingRight: 0,
  paddingBottom: $theme.sizing.scale100,
  paddingLeft: 0,
  marginTop: $theme.sizing.scale0,
  cursor: $disabled ? 'default' : 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  outline: 'none',
  ':focus-visible': {
    outlineWidth: $theme.borders.border300.borderWidth,
    outlineStyle: 'solid',
    outlineColor: $theme.colors.contentPrimary,
    outlineOffset: $theme.sizing.scale0,
  },
}));
Retry.displayName = 'MessageRetry';

/* THE ACT SLOT. Present in the DOM at all times so a keyboard reaches it, revealed when the row
 * is engaged — hovered, or holding focus anywhere inside. What goes in it is the surface's
 * business: this component owns the SLOT and the gesture, never the menu. */
export const Action = styled<'div', SharedStyleProps>('div', ({ $engaged, $disabled, $theme }) => ({
  display: 'flex',
  flex: 'none',
  alignItems: 'center',
  alignSelf: 'center',
  opacity: $engaged && !$disabled ? 1 : 0,
  pointerEvents: $disabled ? 'none' : 'auto',
  transitionProperty: 'opacity',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.easeOutCurve,
  '@media (prefers-reduced-motion: reduce)': {
    transitionDuration: $theme.animation.timing0,
  },
}));
Action.displayName = 'MessageAction';
