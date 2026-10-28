/* GROWN from Base Web's own `src/template-component/styled-components.ts`, with the layer
 * geometry and the open/close motion taken from Base Web's own `src/modal/styled-components.ts`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the radii, the spacing scale, the elevation, the
 * motion tokens, the colours. The one exception is the three card widths, which are stated in
 * constants.ts the way Base states its own modal widths, because Base's theme has no width scale.
 *
 * THE MOTION IS BASE'S MODAL MOTION, unchanged: opacity and a short travel on the card, opacity
 * alone on the scrim, both on `timing400` and `easeOutCurve`. A centred card rises the last
 * `scale700` (20px) into place and fades out where it stands — Base's own asymmetry, kept. A
 * docked card comes up from below and goes back down the same way, because a sheet that fades
 * out where it stands reads as a fault.
 */
import { styled } from 'baseui';
import { PLACEMENT, SCRIM, SIZE, SIZE_WIDTHS } from './constants';
import type { SharedStyleProps, Size, SizeProp } from './types';
import type { StyleObject } from 'styletron-react';

/* THE PADDING RAMP, as positions on Base's own spacing scale. The card owns its gutter — that is
 * most of what makes it a card and not a div on a layer. */
const PADDING: Record<Size, string> = {
  compact: 'scale700',
  default: 'scale800',
  full: 'scale800',
};

const gutter = (size: SizeProp): string =>
  typeof size === 'string' && size in PADDING ? PADDING[size as Size] : PADDING.default;

/** Base's own `getSizeStyles`, narrowed: `full` fills the width of the layer and nothing more.
 *  A card is one decision, so it never grows to the height of the screen. */
function widthOf($size: SizeProp): string {
  if (typeof $size === 'number') return `${$size}px`;
  if (typeof $size === 'string' && $size in SIZE_WIDTHS) return SIZE_WIDTHS[$size as Size];
  if (typeof $size === 'string') return $size;
  return SIZE_WIDTHS[SIZE.default];
}

/* THE LAYER. Fixed to the viewport, or absolute inside the mount node when one was given — the
 * card is meant to be demonstrable and testable inside a phone housing, not only against a
 * browser window. `overflow: auto` so a card taller than its layer scrolls rather than clips. */
export const Root = styled<'div', SharedStyleProps>('div', (props): StyleObject => {
  const { $phase, $contained, $scrim } = props;
  return {
    position: $contained ? 'absolute' : 'fixed',
    /* ROCOTO: a viewport overlay must clear the app's own chrome (the bottom navigation carries
       zIndex 6); a contained one stays in its host's stacking context */
    zIndex: $contained ? undefined : 8,
    overflow: 'auto',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    /* The layer takes the pointer only while a card is actually on it, and never with
     * `scrim="none"` — the layer covers the whole surface, so leaving it hittable there would
     * swallow every click that was supposed to reach the page underneath. The card sets
     * `pointer-events: auto` on itself, which is how it stays hittable inside a layer that is
     * not. */
    pointerEvents: $phase === 'closing' || $phase === 'closed' || $scrim === SCRIM.none ? 'none' : 'auto',
  };
});
Root.displayName = 'OverlayCardRoot';

/* THE SCRIM. Base's `DialogContainer` — the flex ground that both centres the card and paints the
 * dimming. `dim` uses the theme's own overlay ground; `clear` and `none` use the theme's
 * zero-alpha overlay, so even a scrim that paints nothing is reading a token rather than a
 * keyword. `none` additionally hands the pointer back to the surface underneath. */
export const Scrim = styled<'div', SharedStyleProps>('div', (props): StyleObject => {
  const { $animate, $phase, $placement, $scrim, $theme } = props;
  return {
    display: 'flex',
    alignItems: $placement === PLACEMENT.bottom ? 'flex-end' : 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: '100%',
    userSelect: 'none',
    pointerEvents: $scrim === SCRIM.none ? 'none' : 'auto',
    backgroundColor:
      $scrim === SCRIM.dim ? $theme.colors.backgroundOverlay : $theme.colors.backgroundOverlayArt,
    WebkitTapHighlightColor: 'transparent',
    opacity: $phase === 'open' ? 1 : 0,
    ...($animate
      ? {
          transitionProperty: 'opacity',
          transitionDuration: $theme.animation.timing400,
          transitionTimingFunction: $theme.animation.easeOutCurve,
        }
      : null),
  };
});
Scrim.displayName = 'OverlayCardScrim';

/* THE CARD. Bare: a ground, a radius, a gutter, and whatever the consumer puts inside. There is
 * no header bar and no footer bar, which is the whole point — a header names a place you are
 * staying, and this is a place you leave.
 *
 * ELEVATION IS DERIVED, not decoration: a dimmed scrim already separates the card from the page,
 * so a centred card over one carries no shadow at all, exactly as Base's Modal does. The moment
 * the scrim stops doing that work the card picks it up — `shadow600` when the surface underneath
 * is still legible, `shallowAbove` when the card is docked, which is the shadow Base's own Sheet
 * uses for the same edge.
 */
export const Card = styled<'div', SharedStyleProps>('div', (props): StyleObject => {
  const { $animate, $isFocusVisible, $phase, $placement, $scrim, $size, $theme } = props;
  const docked = $placement === PLACEMENT.bottom;
  const pad = $theme.sizing[gutter($size) as keyof typeof $theme.sizing];
  const edge = docked ? '0px' : $theme.sizing.scale600;

  const travel = docked
    ? $phase === 'open'
      ? 'translateY(0)'
      : 'translateY(100%)'
    : // Base's own expression: the card is in place for `open` and `closing`, and short of it for
      // `opening` and `closed` — so it rises on, and fades off where it stands.
      $phase === 'opening' || $phase === 'closed'
      ? `translateY(${$theme.sizing.scale700})`
      : 'translateY(0)';

  return {
    position: 'relative',
    boxSizing: 'border-box',
    backgroundColor: $theme.colors.backgroundPrimary,
    color: $theme.colors.contentPrimary,

    borderTopLeftRadius: $theme.borders.radius500,
    borderTopRightRadius: $theme.borders.radius500,
    // docked, the bottom corners meet the edge they are sitting on
    borderBottomLeftRadius: docked ? '0px' : $theme.borders.radius500,
    borderBottomRightRadius: docked ? '0px' : $theme.borders.radius500,

    marginTop: docked ? $theme.sizing.scale600 : edge,
    marginRight: edge,
    marginBottom: edge,
    marginLeft: edge,

    paddingTop: pad,
    paddingRight: pad,
    paddingBottom: pad,
    paddingLeft: pad,

    width: widthOf($size),
    maxWidth: '100%',

    boxShadow: docked
      ? $theme.lighting.shallowAbove
      : $scrim === SCRIM.dim
        ? 'none'
        : $theme.lighting.shadow600,

    opacity: $phase === 'open' ? 1 : 0,
    transform: travel,
    ...($animate
      ? {
          transitionProperty: 'opacity, transform',
          transitionDuration: $theme.animation.timing400,
          transitionTimingFunction: $theme.animation.easeOutCurve,
        }
      : null),

    // the scrim turns selection off for the whole ground; the card hands it back
    userSelect: 'text',
    pointerEvents: $phase === 'closing' || $phase === 'closed' ? 'none' : 'auto',

    /* THE FOCUS RING. The card takes focus itself when nothing inside it can, so a keyboard
     * arrival must be visible — Base's Modal suppresses this outright, and a chromeless card with
     * no close button to land on cannot afford that. The ring reads the theme's own focus colour,
     * the same token every Base control in this kit draws its ring from; the component states no
     * paint of its own. A pointer arrival draws nothing, which is what `isFocusVisible` is for. */
    ':focus': {
      outline: $isFocusVisible ? `3px solid ${$theme.colors.borderAccent}` : 'none',
      outlineOffset: '2px',
    },
  };
});
Card.displayName = 'OverlayCard';
