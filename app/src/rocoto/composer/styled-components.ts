/* GROWN from Base Web's own `src/template-component/styled-components.ts`, with the field itself
 * grown from Base's `src/input/styled-components.ts` (the same border, the same 2px focus swap,
 * the same size maps). Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from `$theme`. There is not one invented colour, radius, duration or
 * step in this file — the bar is Base's field, Base's button tokens and Base's type scale, put in
 * the shape a message is written in.
 *
 * TWO PLACES WHERE THIS DEPARTS FROM BASE, BOTH ON PURPOSE:
 *   · THE SEND CONTROL IS INK, not accent. The app paints its send circle saffron; in this kit
 *     saffron marks Rocoto's own act and nothing else, and pressing send is the person's act. So
 *     it takes Base's `buttonPrimary*` family, which the theme has already re-inked.
 *   · THE SEND SPINNER'S ARC IS THE BUTTON'S OWN TEXT COLOUR. Base pairs an accent arc on a white
 *     ring (`buttonPrimarySpinnerForeground`); under the colour law that token has collapsed onto
 *     ink, and an ink arc on an ink button is an invisible spinner. The arc is `buttonPrimaryText`
 *     and the ring is the button's own fill, so the moving part is the only part you see.
 */
import { styled } from 'baseui';
import type { SharedStyleProps, ListItemStyleProps, Size } from './types';

/* THE SIZE MAP — Base's own input steps, `mini` dropped. Font, vertical pad and horizontal pad
 * are the values `getInputPadding` / `getFont` hand a Base Input at the same size, so a Composer
 * standing next to an Input is the same object at the same height. */
const STEP: Record<Size, { font: string; padV: string; padH: string; thumb: string }> = {
  compact: { font: 'ParagraphSmall', padV: 'scale200', padH: 'scale550', thumb: 'scale1000' },
  default: { font: 'ParagraphMedium', padV: 'scale400', padH: 'scale550', thumb: 'scale1200' },
  large: { font: 'ParagraphLarge', padV: 'scale550', padH: 'scale550', thumb: 'scale1400' },
};

export const step = (size: Size) => STEP[size];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Theme = any;

const font = ($theme: Theme, $size: Size) => $theme.typography[STEP[$size].font];
const pad = ($theme: Theme, $size: Size) => ({
  v: $theme.sizing[STEP[$size].padV],
  h: $theme.sizing[STEP[$size].padH],
});

/** Base's field border is 2px on every edge; `scale0` is that number, held as a token. */
const border = ($theme: Theme) => $theme.sizing.scale0;

/** THE CONTROL EDGE. The trailing control is exactly as tall as the field is when it holds one
 *  line — derived from the same three tokens the field is built from, so the two agree at every
 *  size instead of agreeing at the default one and drifting at the others.
 *  compact 36px · default 48px · large 60px, which is Base's own control ladder. */
export const controlEdge = ($theme: Theme, $size: Size) =>
  `calc(${font($theme, $size).lineHeight} + ${pad($theme, $size).v} * 2 + ${border($theme)} * 2)`;

/* ── THE BAR ─────────────────────────────────────────────────────────────────────────────── */

/** `position: relative` is load-bearing: the autocomplete listbox opens UPWARD out of this box,
 *  because a composer is anchored to the foot of its surface and there is no room below it. */
export const Root = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: $theme.colors.backgroundPrimary,
}));
Root.displayName = 'Composer';

export const Bar = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  /* flex-end, not center: the field grows upward, so the trailing control stays on the bar's foot
     and the first line you type never moves. */
  alignItems: 'flex-end',
  gap: $theme.sizing.scale300,
  width: '100%',
  minHeight: controlEdge($theme, $size),
}));
Bar.displayName = 'ComposerBar';

/* ── THE PREVIEW ROW ─────────────────────────────────────────────────────────────────────────
 * Above the field, never inside it. An attachment is staged, not written: putting it in the field
 * would make it compete with the words for the line that is being typed. */

export const Attachments = styled<'ul', SharedStyleProps>('ul', ({ $theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  /* wider than the row above it on purpose: each tile carries a remove control that overhangs its
     own corner, and at the standard 8px step the two overhangs close the gap between neighbours */
  gap: $theme.sizing.scale550,
  margin: '0',
  marginBottom: $theme.sizing.scale300,
  padding: '0',
  listStyle: 'none',
}));
Attachments.displayName = 'ComposerAttachments';

export const Attachment = styled<'li', SharedStyleProps>('li', ({ $theme, $size }) => ({
  position: 'relative',
  flex: 'none',
  width: $theme.sizing[STEP[$size].thumb as keyof typeof $theme.sizing],
  height: $theme.sizing[STEP[$size].thumb as keyof typeof $theme.sizing],
  borderRadius: $theme.borders.radius300,
  backgroundColor: $theme.colors.backgroundSecondary,
  boxShadow: `inset 0 0 0 ${border($theme)} ${$theme.colors.borderOpaque}`,
  overflow: 'visible',
}));
Attachment.displayName = 'ComposerAttachment';

export const AttachmentThumb = styled<'img', SharedStyleProps>('img', ({ $theme }) => ({
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: $theme.borders.radius300,
}));
AttachmentThumb.displayName = 'ComposerAttachmentThumb';

/** THE REMOVE CONTROL. Drawn at 24px because it sits on the corner of a 48px tile, and given a
 *  44px hit area by a transparent `::before` that reaches 10px past every edge — the target is
 *  the size a thumb needs, the drawing is the size the corner has room for. */
export const AttachmentRemove = styled<'button', SharedStyleProps>('button', ({ $theme }) => ({
  position: 'absolute',
  top: `calc(${$theme.sizing.scale100} * -1)`,
  insetInlineEnd: `calc(${$theme.sizing.scale100} * -1)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: $theme.sizing.scale800,
  height: $theme.sizing.scale800,
  padding: '0',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: $theme.colors.backgroundInversePrimary,
  color: $theme.colors.contentInversePrimary,
  transitionProperty: 'background-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.linearCurve,
  ':before': {
    content: '""',
    position: 'absolute',
    top: `calc(${$theme.sizing.scale400} * -1)`,
    left: `calc(${$theme.sizing.scale400} * -1)`,
    right: `calc(${$theme.sizing.scale400} * -1)`,
    bottom: `calc(${$theme.sizing.scale400} * -1)`,
  },
  ':hover': { backgroundColor: $theme.colors.contentSecondary },
  ':focus-visible': {
    outline: `${border($theme)} solid ${$theme.colors.borderSelected}`,
    outlineOffset: $theme.sizing.scale0,
  },
}));
AttachmentRemove.displayName = 'ComposerAttachmentRemove';

/* ── THE FIELD ───────────────────────────────────────────────────────────────────────────── */

/** Base's input Root, one for one: 2px border on every edge, `borderSelected` on focus,
 *  `inputFillDisabled` when out of service, the same 200ms border transition. */
export const Field = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $size, $isFocused, $disabled }) => {
    const b = border($theme);
    const edge = $disabled
      ? $theme.colors.inputFillDisabled
      : $isFocused
      ? $theme.colors.borderSelected
      : $theme.colors.inputBorder;
    return {
      display: 'flex',
      alignItems: 'flex-end',
      flex: '1 1 0',
      minWidth: '0',
      boxSizing: 'border-box',
      borderRadius: $theme.borders.inputBorderRadius,
      borderWidth: b,
      borderStyle: 'solid',
      borderColor: edge,
      backgroundColor: $disabled
        ? $theme.colors.inputFillDisabled
        : $isFocused
        ? $theme.colors.inputFillActive
        : $theme.colors.inputFill,
      transitionProperty: 'border-color, background-color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.easeOutCurve,
    };
  }
);
Field.displayName = 'ComposerField';

/** THE WRITING SURFACE. The field carries the border and the focus ring, so the textarea inside it
 *  carries none — two chromes for one control is the fault the app's own composer had to fix.
 *  Height is set on the element by the grow effect; `overflowY` follows it. */
export const Input = styled<'textarea', SharedStyleProps>(
  'textarea',
  ({ $theme, $size, $disabled }) => ({
    ...font($theme, $size),
    flex: '1 1 0',
    minWidth: '0',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0',
    paddingTop: pad($theme, $size).v,
    paddingBottom: pad($theme, $size).v,
    paddingLeft: pad($theme, $size).h,
    paddingRight: pad($theme, $size).h,
    border: 'none',
    outline: 'none',
    resize: 'none',
    overflowY: 'auto',
    backgroundColor: 'transparent',
    color: $disabled ? $theme.colors.inputTextDisabled : $theme.colors.contentPrimary,
    caretColor: $theme.colors.contentPrimary,
    '::placeholder': {
      color: $disabled ? $theme.colors.inputPlaceholderDisabled : $theme.colors.inputPlaceholder,
    },
    ':disabled': { cursor: 'not-allowed' },
  })
);
Input.displayName = 'ComposerInput';

/** THE ATTACHMENT SLOT — Base's input enhancer, on the trailing edge. Base gives an Input a
 *  `startEnhancer`/`endEnhancer`: a node that lives inside the field's own border and takes the
 *  field's padding. This is that contract, kept, and placed AFTER the input because that is where
 *  the app puts its clip and where the people using it already reach for it. */
export const AttachmentSlot = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  alignSelf: 'flex-end',
  height: `calc(${font($theme, $size).lineHeight} + ${pad($theme, $size).v} * 2)`,
  paddingInlineEnd: pad($theme, $size).h,
  color: $theme.colors.contentPrimary,
}));
AttachmentSlot.displayName = 'ComposerAttachmentSlot';

/* ── THE TRAILING CONTROL ────────────────────────────────────────────────────────────────── */

/** ONE BUTTON WIDE AT REST, THE WHOLE ROW DURING A TAKE. The seat holds either the send control
 *  (one button) or the voice control, and the voice control's recording and hands-free states are
 *  full-width instruments. So `$voiceActive` turns the square into the row: it grows into the
 *  space the field gave back, and its height follows its contents, because hands-free stacks two
 *  verbs under the pill and a fixed 48px box would have them painting on the surface below. */
/* ── ONE SEAT, OR TWO (FEED-IA §196.7 · §196.8) ──────────────────────────────────────────────
 * `shared` is one control's footprint and nothing on the bar moves when its two occupants trade
 * places. `own` is the dictation arrangement: the mic and the send stand SIDE BY SIDE, each at
 * the same edge a lone control has, with the bar's own gap between them — so neither control
 * shrinks to make room for the other and both keep their 44px floor. */
export const Actions = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $size, $voiceActive, $voiceSeat }) => {
    const edge = controlEdge($theme, $size);
    const two = $voiceSeat === 'own' && !$voiceActive;
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: two ? $theme.sizing.scale300 : '0',
      flex: $voiceActive ? '1 1 0' : 'none',
      minWidth: '0',
      width: $voiceActive || two ? 'auto' : edge,
      height: $voiceActive ? 'auto' : edge,
      minHeight: edge,
    };
  }
);
Actions.displayName = 'ComposerActions';

export const Send = styled<'button', SharedStyleProps>('button', ({ $theme, $size, $voiceSeat }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  /* it fills a seat of its own; beside a mic it IS its own seat, so it states the edge itself */
  flex: '0 0 auto',
  width: $voiceSeat === 'own' ? controlEdge($theme, $size) : '100%',
  height: $voiceSeat === 'own' ? controlEdge($theme, $size) : '100%',
  padding: '0',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: $theme.colors.buttonPrimaryFill,
  color: $theme.colors.buttonPrimaryText,
  transitionProperty: 'background-color',
  transitionDuration: $theme.animation.timing200,
  transitionTimingFunction: $theme.animation.linearCurve,
  ':hover': { backgroundColor: $theme.colors.buttonPrimaryHover },
  ':active': { backgroundColor: $theme.colors.buttonPrimaryActive },
  ':focus-visible': {
    outline: `${border($theme)} solid ${$theme.colors.borderSelected}`,
    outlineOffset: $theme.sizing.scale0,
  },
  ':disabled': {
    cursor: 'not-allowed',
    backgroundColor: $theme.colors.buttonDisabledFill,
    color: $theme.colors.buttonDisabledText,
  },
}));
Send.displayName = 'ComposerSend';

/** Base's own LoadingSpinner geometry (`src/button/styled-components.ts`), with the colour pair
 *  re-sourced — see this file's header for why the accent arc could not survive the colour law. */
export const SendSpinner = styled<'span', SharedStyleProps>('span', ({ $theme, $size }) => ({
  display: 'inline-block',
  boxSizing: 'border-box',
  width: $theme.sizing.scale600,
  height: $theme.sizing.scale600,
  borderRadius: '50%',
  borderStyle: 'solid',
  borderWidth: $theme.sizing.scale0,
  borderTopColor: $theme.colors.buttonPrimaryText,
  borderRightColor: $theme.colors.buttonPrimaryFill,
  borderBottomColor: $theme.colors.buttonPrimaryFill,
  borderLeftColor: $theme.colors.buttonPrimaryFill,
  animationDuration: $theme.animation.timing700,
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
  animationName: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
}));
SendSpinner.displayName = 'ComposerSendSpinner';

/** THE VOICE SEAT. At rest it is the send control's exact footprint, so the bar does not resize
 *  when the first character is typed and the two controls trade places. During a take it is
 *  whatever the seat above it has become — the whole row. The Voice Button component mounts in
 *  here; this element is the seat, never the control. */
export const VoiceSlot = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $size, $voiceActive, $voiceSeat }) => {
    const own = $voiceSeat === 'own' && !$voiceActive;
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      /* beside a send it is one seat wide and holds its ground; sharing the seat it fills it,
         and the shared arrangement keeps the flex it always had — a take that spans the bar is
         the recorder's own instrument sizing itself, and this is not the place to change it */
      ...(own ? { flex: '0 0 auto' } : null),
      width: own ? controlEdge($theme, $size) : '100%',
      minWidth: '0',
      /* a percentage height against a seat whose own height is following its contents resolves to
         nothing useful, so during a take the slot takes the height its contents ask for */
      height: $voiceActive ? 'auto' : own ? controlEdge($theme, $size) : '100%',
      color: $theme.colors.contentPrimary,
    };
  }
);
VoiceSlot.displayName = 'ComposerVoiceSlot';

/* ── THE AUTOCOMPLETE ────────────────────────────────────────────────────────────────────────
 * Base's Combobox mounts its listbox in a Popover, placed bottomLeft. A composer sits at the foot
 * of its surface, so there is nothing below it to open into: this one is anchored to the Root and
 * opens upward, and takes `shallowAbove` — Base's own token for a surface lit from underneath. */

export const ListBox = styled<'ul', SharedStyleProps>('ul', ({ $theme }) => ({
  position: 'absolute',
  bottom: '100%',
  insetInlineStart: '0',
  insetInlineEnd: '0',
  zIndex: 1,
  margin: '0',
  marginBottom: $theme.sizing.scale300,
  padding: '0',
  listStyle: 'none',
  maxHeight: $theme.sizing.scale4800,
  /* the list scrolls one way. `overflow-y: auto` on its own computes `overflow-x: auto`, and a
     listbox that can be dragged sideways is a listbox with an option hidden off its edge. */
  overflowY: 'auto',
  overflowX: 'clip',
  outline: 'none',
  boxSizing: 'border-box',
  borderRadius: $theme.borders.popoverBorderRadius,
  backgroundColor: $theme.colors.backgroundPrimary,
  boxShadow: $theme.lighting.shallowAbove,
}));
ListBox.displayName = 'ComposerListBox';

export const ListItem = styled<'li', ListItemStyleProps>(
  'li',
  ({ $theme, $size, $isActive }) => ({
    ...font($theme, $size),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: $theme.sizing.scale0,
    minHeight: controlEdge($theme, $size),
    paddingTop: $theme.sizing.scale300,
    paddingBottom: $theme.sizing.scale300,
    paddingLeft: pad($theme, $size).h,
    paddingRight: pad($theme, $size).h,
    cursor: 'pointer',
    color: $theme.colors.contentPrimary,
    /* BASE'S TWO GROUNDS, SWAPPED. Base gives the selected row `comboboxListItemFocus` and a
       merely-hovered row `comboboxListItemHover`; in the light theme those resolve to
       `backgroundSecondary` and `backgroundTertiary`, so the row the KEYBOARD is on reads weaker
       than a row the pointer happens to pass over. The keys are the only way to take an option
       without a pointer, so the stronger of Base's two grounds goes to the active row. Both
       tokens are still Base's; only which one carries which meaning has moved. */
    backgroundColor: $isActive ? $theme.colors.comboboxListItemHover : 'transparent',
    ':hover': {
      backgroundColor: $isActive
        ? $theme.colors.comboboxListItemHover
        : $theme.colors.comboboxListItemFocus,
    },
  })
);
ListItem.displayName = 'ComposerListItem';

/** the quieter second line of an option */
export const ListItemDescription = styled<'span', ListItemStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.ParagraphXSmall,
  color: $theme.colors.contentSecondary,
}));
ListItemDescription.displayName = 'ComposerListItemDescription';
