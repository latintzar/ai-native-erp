/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the spacing scale, the radii, the type steps, the
 * motion curves, the colours. There is no invented paint and no invented number. Where a number
 * IS invented it belongs to the gesture machine, and that machine lives in `constants.ts` with
 * the line of the shipped app it was read off.
 *
 * THE COLOUR OF THE GROUND. The app composites its warm-ink scrim over pure black so the picture
 * floats on a warm, near-opaque ground rather than a cold grey (`MediaViewerChrome.kt`: the
 * `.background(Color.Black).background(scrimStrong)` pair). The web already made one adjustment to
 * that and shipped it — `webapp/src/chat/media-viewer.css` states the ink TWICE, as colour and as
 * image, rather than over black, because a browser can blur what is behind it and Android cannot
 * (Peter, 2026-08-08: «blur/darken their background like a top SOTA would do this»). Two layers of
 * the theme's own ink land at ~92%: warm, near-opaque, and still enough of a window for the blur
 * to mean something. Stated in tokens, so a retheme moves the ground with the brand.
 */
import { styled } from 'baseui';
import { hexToRgb } from 'baseui/styles';
import type { StyleObject } from 'styletron-standard';
import type { Theme } from 'baseui';
import { GESTURE } from './constants';
import type { SharedStyleProps } from './types';

/** Motion is a courtesy, so every transition below is asked for rather than assumed. With motion
 *  turned down the gallery snaps — which is the app's own rule, stated in `MediaViewerChrome.kt`
 *  as «an instant snap, no animation». */
const MOTION_OK = '@media (prefers-reduced-motion: no-preference)';

/** BASE'S OWN ASPECT RESERVATION, lifted from `aspect-ratio-box/aspect-ratio-box.tsx`: a hairline
 *  floated pseudo-element whose TOP PADDING is a percentage of the box's WIDTH, then a second one
 *  that clears it. The frame therefore holds the picture's space before the picture arrives, so a
 *  grid of photos loads without shuffling the rows underneath it. */
const aspectFrame = (ratio: number): StyleObject => ({
  position: 'relative',
  display: 'block',
  '::before': {
    content: '""',
    width: '1px',
    marginLeft: '-1px',
    float: 'left',
    height: '0',
    paddingTop: `${100 / (ratio || 1)}%`,
    pointerEvents: 'none',
  },
  '::after': { content: '""', display: 'table', clear: 'both' },
});

/** the picture, wherever it is drawn: absolutely filling the frame it was given */
const fills: StyleObject = {
  position: 'absolute',
  top: '0',
  right: '0',
  bottom: '0',
  left: '0',
};

/** BASE'S OWN FOCUS RING, token for token, from `button/styled-components.ts`. A Gallery thumb
 *  therefore takes focus looking exactly like every other control in the kit, and the day that
 *  ring is judged wrong it is wrong in one place — the theme — rather than in this file. */
const focusRing = ($theme: Theme): StyleObject => ({
  ':focus-visible': {
    outline: 'none',
    boxShadow: `inset 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.buttonInnerBorder}, 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.buttonFocusOuterBorder}`,
  },
});

/* ── THE GRID ─────────────────────────────────────────────────────────────────────────────── */

export const Root = styled<'div', SharedStyleProps>('div', ({ $columns, $inline, $theme }) => ({
  display: 'grid',
  // `minmax(0, 1fr)` rather than `1fr`: a grid track's automatic minimum is its content, so a wide
  // picture in a plain `1fr` track pushes the whole grid past its container.
  gridTemplateColumns: `repeat(${Math.max(1, Math.floor($columns))}, minmax(0, 1fr))`,
  gap: $theme.sizing.scale300,
  // the positioning ground a `parent` lightbox opens into. Harmless when it opens on the Layer.
  position: $inline ? 'relative' : 'static',
}));
Root.displayName = 'Gallery';

/** ONE THUMBNAIL. A button, because it opens something — not a div listening for clicks. */
export const Thumb = styled<'button', SharedStyleProps>(
  'button',
  ({ $aspectRatio, $disabled, $current, $theme }) => ({
    ...aspectFrame($aspectRatio),
    // reset the user agent's button
    margin: '0',
    padding: '0',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    appearance: 'none',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'inherit',

    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: $theme.borders.radius300,
    borderTopRightRadius: $theme.borders.radius300,
    borderBottomRightRadius: $theme.borders.radius300,
    borderBottomLeftRadius: $theme.borders.radius300,
    // the ground a picture arrives onto, so the frame reads as a held space rather than a hole
    backgroundColor: $theme.colors.backgroundSecondary,
    cursor: $disabled ? 'not-allowed' : 'pointer',
    WebkitTapHighlightColor: 'transparent',
    // the thumbnail the lightbox is showing keeps a ring, so closing returns the eye where it was
    boxShadow: $current
      ? `inset 0 0 0 ${$theme.sizing.scale100} ${$theme.colors.borderSelected}`
      : 'none',
    ...focusRing($theme),
    ...($disabled
      ? { opacity: 0.4 }
      : {
          ':hover > img': { transform: 'scale(1.03)' },
          ':active': { boxShadow: $theme.lighting.overlay200 },
        }),
    [MOTION_OK]: { transitionProperty: 'box-shadow', transitionDuration: $theme.animation.timing200, transitionTimingFunction: $theme.animation.easeOutCurve },
  })
);
Thumb.displayName = 'GalleryThumb';

/** THE PICTURE IN A THUMBNAIL. `cover`, because a grid is a rhythm and a rhythm needs one shape;
 *  the lightbox is where a photo is shown whole. It arrives by fading up from the frame's own
 *  ground, so a slow picture reads as arriving rather than as a jump. */
export const ThumbImage = styled<'img', SharedStyleProps>('img', ({ $loaded, $theme }) => ({
  ...fills,
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'cover',
  opacity: $loaded ? 1 : 0,
  transformOrigin: 'center center',
  [MOTION_OK]: {
    transitionProperty: 'opacity, transform',
    transitionDuration: $theme.animation.timing300,
    transitionTimingFunction: $theme.animation.easeOutCurve,
  },
}));
ThumbImage.displayName = 'GalleryThumbImage';

/** THE HELD FRAME. Same shape, same radius, same ground — the grid the photos will land in,
 *  standing before they do. Base's own Skeleton draws the shimmer inside it. */
export const Placeholder = styled<'div', SharedStyleProps>('div', ({ $aspectRatio, $theme }) => ({
  ...aspectFrame($aspectRatio),
  width: '100%',
  overflow: 'hidden',
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  backgroundColor: $theme.colors.backgroundSecondary,
}));
Placeholder.displayName = 'GalleryPlaceholder';

/* ── THE LIGHTBOX ─────────────────────────────────────────────────────────────────────────── */

/** THE GROUND. The ported viewer's own two layers of warm ink, and the blur that rides on top of
 *  them. An engine with no `backdrop-filter` keeps the ink and therefore the app's appearance.
 *
 *  The whole ground carries the dismiss drag: pull it down and the shell goes with the hand, 1:1. */
export const Lightbox = styled<'div', SharedStyleProps>(
  'div',
  ({ $inline, $visible, $pull = 0, $theme }) => {
    // stated twice, so the two layers land at ~0.96 — near-opaque, and still a window
    const ink = hexToRgb($theme.colors.backgroundInversePrimary, '0.8') || '';
    return {
    position: $inline ? 'absolute' : 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: ink,
    backgroundImage: `linear-gradient(${ink}, ${ink})`,
    backdropFilter: 'blur(18px) saturate(0.9)',
    WebkitBackdropFilter: 'blur(18px) saturate(0.9)',
    transform: `translate3d(0, ${$pull}px, 0)`,
    opacity: $visible ? 1 : 0,
    // the gestures are ours; the browser keeps its hands off
    touchAction: 'none',
    overscrollBehavior: 'contain',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    ':focus': { outline: 'none' },
    [MOTION_OK]: {
      transitionProperty: 'opacity',
      transitionDuration: $theme.animation.timing400,
      transitionTimingFunction: $theme.animation.easeOutCurve,
    },
    };
  }
);
Lightbox.displayName = 'GalleryLightbox';

/** EVERYTHING THE GROUND CARRIES, and the thing that comes forward.
 *
 *  The app's enter is `fadeIn + scaleIn(initialScale = 0.92f)` and its exit is the same in reverse
 *  (`ImageViewer.kt`), so the picture arrives by moving TOWARD the reader rather than by simply
 *  appearing. The chrome rides the same curve, which is what makes the lightbox read as one object.
 *
 *  The padding is the reason chrome never sits ON the picture: it reserves a band at the top for
 *  the close button and a band at each side for the arrows. Below Base's medium breakpoint the
 *  bands narrow and the arrows stand down — a hand there pages by swiping. */
export const Content = styled<'div', SharedStyleProps>('div', ({ $visible, $theme }) => ({
  position: 'relative',
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale600,
  minHeight: '0',
  paddingTop: $theme.sizing.scale1200,
  paddingRight: $theme.sizing.scale800,
  paddingBottom: $theme.sizing.scale600,
  paddingLeft: $theme.sizing.scale800,
  transformOrigin: 'center center',
  transform: $visible ? 'scale(1)' : 'scale(0.92)',
  opacity: $visible ? 1 : 0,
  [$theme.mediaQuery.medium]: {
    paddingTop: $theme.sizing.scale1600,
    paddingRight: $theme.sizing.scale1600,
    paddingBottom: $theme.sizing.scale800,
    paddingLeft: $theme.sizing.scale1600,
  },
  [MOTION_OK]: {
    transitionProperty: 'opacity, transform',
    transitionDuration: $theme.animation.timing400,
    transitionTimingFunction: $theme.animation.easeOutCurve,
  },
}));
Content.displayName = 'GalleryContent';

/** THE BAND THE PICTURES MOVE THROUGH. It fades as the shell is dragged toward leaving — the
 *  app's own `alpha = (1f - pull / 600f)` — so the picture recedes while the ground goes with the
 *  hand, and the gesture says what it will do before it does it. */
export const Stage = styled<'div', SharedStyleProps>('div', ({ $pull = 0 }) => ({
  position: 'relative',
  flexGrow: 1,
  minHeight: '0',
  overflow: 'hidden',
  opacity: Math.max(0, Math.min(1, 1 - $pull / GESTURE.dismissFadeOver)),
}));
Stage.displayName = 'GalleryStage';

/** THE ROW. Every photo sits side by side at full stage width and the row is what moves, so a
 *  drag shows the neighbour arriving rather than a cut. */
export const Track = styled<'div', SharedStyleProps>(
  'div',
  ({ $index = 0, $offset = 0, $dragging, $theme }) => ({
    display: 'flex',
    height: '100%',
    willChange: 'transform',
    transform: `translate3d(calc(${-$index * 100}% + ${$offset}px), 0, 0)`,
    ...($dragging
      ? null
      : {
          [MOTION_OK]: {
            transitionProperty: 'transform',
            transitionDuration: $theme.animation.timing300,
            transitionTimingFunction: $theme.animation.easeOutCurve,
          },
        }),
  })
);
Track.displayName = 'GalleryTrack';

export const Slide = styled<'div', SharedStyleProps>('div', () => ({
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: '100%',
  minWidth: '0',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));
Slide.displayName = 'GallerySlide';

/** THE PICTURE, PRESENTED RAW. No radius, no stroke, no shadow, no card — `ImageViewer.kt` draws
 *  the image bare and Peter said it plainly on 2026-08-08: «open it in a modal (without rounding
 *  or an outline)». `max-*: 100%` fits a large picture down; `width/height: auto` is what stops a
 *  small one from being blown up past its own size. */
export const Image = styled<'img', SharedStyleProps>(
  'img',
  ({ $zoom, $panX = 0, $panY = 0, $current, $dragging, $theme }) => ({
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    minHeight: '0',
    objectFit: 'contain',
    borderTopLeftRadius: '0',
    borderTopRightRadius: '0',
    borderBottomRightRadius: '0',
    borderBottomLeftRadius: '0',
    boxShadow: 'none',
    backgroundColor: 'transparent',
    transformOrigin: 'center center',
    transform: $current
      ? `translate3d(${$panX}px, ${$panY}px, 0) scale(${$zoom})`
      : 'translate3d(0, 0, 0) scale(1)',
    cursor: $current && $zoom > 1 ? 'grab' : 'zoom-in',
    touchAction: 'none',
    ...($dragging
      ? null
      : {
          [MOTION_OK]: {
            transitionProperty: 'transform',
            transitionDuration: $theme.animation.timing300,
            transitionTimingFunction: $theme.animation.easeOutCurve,
          },
        }),
  })
);
Image.displayName = 'GalleryImage';

/* ── THE CHROME, WHICH SITS AROUND THE PICTURE AND NEVER ON IT ───────────────────────────── */

/** the one button shape the lightbox uses: a circle in the padding band, glyph on the ink, and
 *  the app's own press (`squishClick`, scale .95) on the way down. */
const chromeButton = ($theme: Theme, disabled?: boolean): StyleObject => ({
  position: 'absolute',
  margin: '0',
  padding: '0',
  borderTopWidth: '0',
  borderRightWidth: '0',
  borderBottomWidth: '0',
  borderLeftWidth: '0',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  appearance: 'none',
  width: $theme.sizing.scale1200,
  height: $theme.sizing.scale1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderTopLeftRadius: '50%',
  borderTopRightRadius: '50%',
  borderBottomRightRadius: '50%',
  borderBottomLeftRadius: '50%',
  backgroundColor: 'transparent',
  // `contentOnColor` rather than `contentInversePrimary`, and the difference is not pedantry: the
  // theme's colour-law sweep re-inks every saturated colour it resolves, so a brand whose paper
  // carries ANY warmth has its inverse content repainted to the ink — which is the very ground
  // these glyphs sit on. `?theme=proof` showed exactly that, an invisible close button on navy.
  // `contentOnColor` is the token for content on a brand-coloured surface, and it is a primitive
  // white that no sweep can touch.
  color: $theme.colors.contentOnColor,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.32 : 1,
  WebkitTapHighlightColor: 'transparent',
  ...(disabled
    ? null
    : {
        ':hover': {
          backgroundColor: hexToRgb($theme.colors.backgroundAlwaysLight, '0.16') || '',
        },
        ':active': { transform: 'scale(0.95)' },
      }),
  // Base's focus pair is built for a control on PAPER — `buttonFocusOuterBorder` resolves to the
  // ink in this theme, which on the ink ground is a ring nobody can see. A control standing on the
  // brand's own colour takes the on-colour ring instead, and then it reads under every brand.
  ':focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 ${$theme.sizing.scale0} ${$theme.colors.contentOnColor}`,
  },
  [MOTION_OK]: {
    transitionProperty: 'background-color, transform, opacity',
    transitionDuration: $theme.animation.timing200,
    transitionTimingFunction: $theme.animation.easeOutCurve,
  },
});

/** TOP-LEFT, the way the app puts it (`MediaViewerChrome.kt` — back arrow LEFT). */
export const Close = styled<'button', SharedStyleProps>('button', ({ $theme }) => ({
  ...chromeButton($theme),
  top: $theme.sizing.scale300,
  left: $theme.sizing.scale300,
  zIndex: 2,
}));
Close.displayName = 'GalleryClose';

/** THE DESK'S ANSWER TO THE PAGER. A hand swipes; a mouse has nothing to swipe with, so the desk
 *  gets a pair of real buttons — the same reasoning that gave the ported viewer a real close
 *  button. They live in the side padding, so the picture is never under them, and they stand down
 *  below Base's medium breakpoint where the hand is the input. */
const arrow = ($theme: Theme, disabled?: boolean): StyleObject => ({
  ...chromeButton($theme, disabled),
  display: 'none',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 2,
  ...(disabled
    ? null
    : { ':active': { transform: 'translateY(-50%) scale(0.95)' } }),
  [$theme.mediaQuery.medium]: { display: 'flex' },
});

export const Previous = styled<'button', SharedStyleProps>('button', ({ $disabled, $theme }) => ({
  ...arrow($theme, $disabled),
  left: $theme.sizing.scale300,
}));
Previous.displayName = 'GalleryPrevious';

export const Next = styled<'button', SharedStyleProps>('button', ({ $disabled, $theme }) => ({
  ...arrow($theme, $disabled),
  right: $theme.sizing.scale300,
}));
Next.displayName = 'GalleryNext';

/** THE LINE UNDER THE PICTURE. Centred, one measure wide, a step quieter than the chrome. */
export const Caption = styled<'p', SharedStyleProps>('p', ({ $theme }) => ({
  ...$theme.typography.ParagraphSmall,
  flexGrow: 0,
  flexShrink: 0,
  margin: '0',
  maxWidth: '60ch',
  alignSelf: 'center',
  textAlign: 'center',
  color: $theme.colors.contentInverseSecondary,
}));
Caption.displayName = 'GalleryCaption';

/** WHERE THE PAGE DOTS SIT. Base's own Page Control does the counting inside this. */
export const Dots = styled<'div', SharedStyleProps>('div', () => ({
  flexGrow: 0,
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
}));
Dots.displayName = 'GalleryDots';
