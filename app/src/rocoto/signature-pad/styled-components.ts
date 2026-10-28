/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * THERE IS NO PAINT IN THIS FILE. No hex, no rgb, no font family, no corner radius — every value
 * is read off Base's theme, so the whole pad re-inks when the brand block changes and the proof
 * brand moves every part of it.
 *
 * THE ONE PLACE THE ACCENT APPEARS IS THE FOCUS RING, and it is Base's own: every Base control
 * draws focus with `borderAccent`, and the Confirm button standing beside this pad is a Base
 * Button drawing exactly that ring. A pad that rang its focus in a different colour from the
 * button next to it would read as two systems on one form. Focus is Base's engineering here, not
 * a Rocoto statement — the saffron law governs what the PRODUCT says, and this pad says nothing
 * with colour: the ink is ink at every state, and the states are told apart by weight and words.
 */
import { styled } from 'baseui';
import { dots, DOT_TILE } from '../../rocoto-theme';
import { BASELINE, GEOMETRY } from './constants';
import type { SharedStyleProps, Size } from './types';

/** the type ramp, expressed as positions on Base's own scale — the pad states no size in px */
const RAMP: Record<
  Size,
  { name: string; recordName: string; prompt: string; cross: string; caption: string }
> = {
  compact: {
    name: 'LabelSmall',
    recordName: 'LabelXSmall',
    prompt: 'ParagraphXSmall',
    cross: 'LabelXSmall',
    caption: 'ParagraphXSmall',
  },
  default: {
    name: 'LabelLarge',
    recordName: 'LabelSmall',
    prompt: 'ParagraphSmall',
    cross: 'LabelSmall',
    caption: 'ParagraphSmall',
  },
  large: {
    name: 'HeadingXSmall',
    recordName: 'LabelMedium',
    prompt: 'ParagraphMedium',
    cross: 'LabelMedium',
    caption: 'ParagraphSmall',
  },
};

export const ramp = (size: Size) => RAMP[size];

/** Base writes borders as longhands, never the shorthand — styletron resolves each side on its
 *  own, and a shorthand landing next to a longhand is how an override silently loses. */
const edge = (width: string, color: string) => ({
  borderTopWidth: width,
  borderRightWidth: width,
  borderBottomWidth: width,
  borderLeftWidth: width,
  borderTopStyle: 'solid' as const,
  borderRightStyle: 'solid' as const,
  borderBottomStyle: 'solid' as const,
  borderLeftStyle: 'solid' as const,
  borderTopColor: color,
  borderRightColor: color,
  borderBottomColor: color,
  borderLeftColor: color,
});

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme, $readOnly }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $readOnly ? '0' : $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
}));
Root.displayName = 'SignaturePad';

export const Label = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentPrimary,
}));
Label.displayName = 'SignaturePadLabel';

/* THE SURFACE. Paper, because that is what it is: the dotted ground the system puts under every
 * surface that is waiting for a person. It waits here in exactly two states — before a hand and
 * after a clear — and holds the dots through the rest, because paper that changed its texture
 * the moment a finger landed would be the page moving under the hand.
 *
 * `touchAction: none` is not tidiness. Without it, the first upward stroke of a signature scrolls
 * the page on a phone and the signature is a scroll gesture. */
export const Pad = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $size, $state, $readOnly, $isFocusVisible }) => {
    const geometry = GEOMETRY[$size];
    const disabled = $state === 'disabled';
    const paper = disabled ? $theme.colors.backgroundStateDisabled : $theme.colors.backgroundPrimary;
    const tile = ($theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? DOT_TILE;
    if ($readOnly) {
      return {
        position: 'relative',
        height: `${geometry.markHeight}px`,
        width: '100%',
        minWidth: 0,
      };
    }
    return {
      position: 'relative',
      height: `${geometry.padHeight}px`,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      borderRadius: $theme.borders.radius300,
      /* THE ERROR EDGE IS WEIGHT, NEVER HUE. Base states its ring and its error widths in plain
         px — `inset 0 0 0 2px`, `solid 3px` — because every border token in the theme is 1px and
         the widths are geometry, not brand. This follows Base literally, and the colours stay
         Base's own tokens, so a re-theme still re-inks both. */
      ...($state === 'error'
        ? edge('2px', $theme.colors.borderSelected)
        : edge(String($theme.borders.border100.borderWidth), $theme.colors.borderTransparent)),
      backgroundColor: paper,
      ...(disabled
        ? null
        : { backgroundImage: dots($theme.colors.mono400), backgroundSize: tile }),
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      cursor: disabled ? 'not-allowed' : $state === 'signed' ? 'default' : 'crosshair',
      outline: $isFocusVisible ? `3px solid ${$theme.colors.borderAccent}` : 'none',
      outlineOffset: $theme.sizing.scale100,
    };
  }
);
Pad.displayName = 'SignaturePadSurface';

/* THE CANVAS is the hand; the path is the record. While a finger is down the ink goes here,
 * because a growing path re-rendered through React sixty times a second mints a style class per
 * frame. It takes no pointer events itself — the surface under it owns the gesture, so there is
 * one element listening and one set of coordinates. */
export const Canvas = styled<'canvas', SharedStyleProps>('canvas', {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
});
Canvas.displayName = 'SignaturePadCanvas';

export const Mark = styled<'svg', SharedStyleProps>('svg', {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
  overflow: 'visible',
});
Mark.displayName = 'SignaturePadMark';

/** the stored signature, drawn. `non-scaling-stroke` takes the ink out of the transform, so the
 *  component decides its weight rather than the scale deciding it — and the ONE number that
 *  changes with the size a mark is shown at is written straight onto the node, the same way the
 *  Waveform writes a mark's height. Paint lives here, where the theme can reach it. */
export const Ink = styled<'path', SharedStyleProps>('path', ({ $theme, $state }) => ({
  fill: 'none',
  stroke: $state === 'disabled' ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
}));
Ink.displayName = 'SignaturePadInk';

/* A TYPED NAME, STANDING AS THE MARK. It is set in the company face at the company's own weight —
 * never a script face pretending to be a hand. A typed signature is a typed signature, and
 * dressing it as handwriting would be the one dishonest thing this component could do. It is
 * centred on the line exactly where a drawn mark is centred, because it is the same signature. */
export const TypedMark = styled<'span', SharedStyleProps>(
  'span',
  ({ $theme, $size, $state, $readOnly }) => ({
    position: 'absolute',
    left: '50%',
    top: `${BASELINE * 100}%`,
    transform: 'translate(-50%, -100%)',
    paddingBottom: $theme.sizing.scale100,
    maxWidth: '90%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    ...$theme.typography[
      ($readOnly ? RAMP[$size].recordName : RAMP[$size].name) as keyof typeof $theme.typography
    ],
    color: $state === 'disabled' ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  })
);
TypedMark.displayName = 'SignaturePadTypedMark';

/** THE LINE. It has to be seen through the dotted paper, so it takes a content step rather than
 *  Base's hairline token, which in the light theme is the same value as the ground it would be
 *  drawn on. */
export const Baseline = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $state, $readOnly }) => ({
    position: 'absolute',
    left: $readOnly ? '0' : $theme.sizing.scale600,
    right: $readOnly ? '0' : $theme.sizing.scale600,
    top: `${BASELINE * 100}%`,
    height: '0',
    borderTopWidth: $theme.borders.border100.borderWidth,
    borderTopStyle: 'solid',
    borderTopColor:
      $state === 'disabled' ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
    pointerEvents: 'none',
  })
);
Baseline.displayName = 'SignaturePadBaseline';

/** THE ✕. It is not decoration and it is not an icon set: it is the convention that says which
 *  end of the line the hand starts at, and it has said so on paper for a century. It leaves the
 *  surface the moment there is a mark, because by then it is answering a question nobody is
 *  asking any more. */
export const Cross = styled<'span', SharedStyleProps>('span', ({ $theme, $size, $state }) => ({
  position: 'absolute',
  left: $theme.sizing.scale600,
  top: `${BASELINE * 100}%`,
  transform: 'translateY(-100%)',
  paddingBottom: $theme.sizing.scale0,
  pointerEvents: 'none',
  ...$theme.typography[RAMP[$size].cross as keyof typeof $theme.typography],
  // the glyph sits ON the line, so its box is exactly the glyph
  lineHeight: '1',
  color: $state === 'disabled' ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
}));
Cross.displayName = 'SignaturePadCross';

export const Prompt = styled<'span', SharedStyleProps>('span', ({ $theme, $size, $state }) => ({
  position: 'absolute',
  left: '50%',
  top: `${BASELINE * 100}%`,
  transform: 'translate(-50%, -100%)',
  paddingBottom: $theme.sizing.scale400,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  ...$theme.typography[RAMP[$size].prompt as keyof typeof $theme.typography],
  color: $state === 'disabled' ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
}));
Prompt.displayName = 'SignaturePadPrompt';

export const Actions = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale300,
  flexWrap: 'wrap',
}));
Actions.displayName = 'SignaturePadActions';

/** the line under the pad. It holds a sentence in every state, so it holds its height in all of
 *  them — a caption that appears and disappears moves the buttons under the reader's thumb. */
export const Caption = styled<'div', SharedStyleProps>('div', ({ $theme, $size, $state }) => ({
  ...$theme.typography[RAMP[$size].caption as keyof typeof $theme.typography],
  color:
    $state === 'error' ? $theme.colors.contentNegative : $theme.colors.contentSecondary,
  minHeight: $theme.sizing.scale700,
}));
Caption.displayName = 'SignaturePadCaption';

/** THE OTHER WAY TO SIGN, and it stands at full weight next to the pad rather than under a
 *  disclosure — a person who signs by typing their name is signing, not settling. */
export const Fallback = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  paddingTop: $theme.sizing.scale100,
  maxWidth: $theme.sizing.scale4800,
}));
Fallback.displayName = 'SignaturePadFallback';
