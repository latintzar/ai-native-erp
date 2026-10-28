/* The drawing contract, and the two pieces of geometry that more than one drawing needs.
 *
 * A drawing is a pure function of the brush and an id. It never sees the theme, never sees the
 * mode, and never sees a hex — so `mono` costs the drawings nothing, and adding a species later
 * is adding one function to one map.
 *
 * THE CLIP IS NOT A DETAIL. Flat 2.5D means abutting fields of colour, and two paths that share
 * an edge antialias into a hairline seam that shows as a pale crack at 32px and eats the edge at
 * 16px. So every drawing paints its full silhouette first and then paints the shade INSIDE a clip
 * of that same silhouette — the shade can overshoot as far as it likes, the outline stays exactly
 * one path, and there is no seam to crack. It also means the shade curve can be drawn as the
 * simple sweep it wants to be, instead of being fitted to the body edge by hand.
 */
import type * as React from 'react';
import type { Ink } from '../palette';

export type Draw = (ink: Ink, uid: string) => React.ReactNode;

/** the 2.5D cube the diced forms are made of: a lit top, a body face, a shade face.
 *  Returned as three `d` strings so the caller picks the tones its family is. */
export const cube = (cx: number, cy: number, s: number) => ({
  top: `M${cx} ${cy - s}L${cx + s} ${cy - s / 2}L${cx} ${cy}L${cx - s} ${cy - s / 2}Z`,
  left: `M${cx - s} ${cy - s / 2}L${cx} ${cy}L${cx} ${cy + s}L${cx - s} ${cy + s / 2}Z`,
  right: `M${cx + s} ${cy - s / 2}L${cx} ${cy}L${cx} ${cy + s}L${cx + s} ${cy + s / 2}Z`,
});

/** THE CRATE, shared by fruit|box and vegetable|box — one wooden box, two different heaps in it,
 *  because a supplier's crate does not change shape with what is in it. */
export const CRATE = {
  /** the body: a trapezoid, narrower at the foot, the way a stacking crate is */
  body: 'M3.6 13.1h16.8l-1.2 6.3c-.2.9-1 1.6-2 1.6H6.8c-1 0-1.8-.7-2-1.6z',
  /** the rim, one step lighter, so the box has a lip to hold the heap */
  rim: 'M3.4 11.5c0-.6.5-1.1 1.1-1.1h15c.6 0 1.1.5 1.1 1.1v1.7H3.4z',
  /** the shade: painted inside a clip of the body, so it can be a plain sweep */
  shade: 'M2 17.4c5.6 1.7 14.4 1.7 20 0V24H2z',
  /** two slat gaps down the front — texture at 32px, nothing at 16px, and that is correct */
  slats: 'M8.6 13.6h1.5l-.5 6.4H8.3zM14.4 13.6h1.5l.4 6.4h-1.6z',
};
