/* GROWN from Base Web's own `src/template-component/constants.ts` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no photo surface at all.
 */

/** Where the lightbox opens. */
export const CONTAINER = {
  viewport: 'viewport',
  parent: 'parent',
} as const;

/** THE GESTURE MACHINE, in numbers.
 *
 * Every value below is READ OFF the app that already ships this viewer — `ImageViewer.kt` and
 * `MediaViewerChrome.kt` — rather than chosen here. The app is the reference implementation and
 * the thresholds are what a hand has already been trained on, so the kit inherits them instead of
 * inventing a second feel. Each one carries the line it came from.
 */
export const GESTURE = {
  /** drag DOWN past this many px and the lightbox leaves (`MediaViewerChrome.kt`, `dismissAt = 200f`) */
  dismissAt: 200,
  /** the picture is fully faded by this pull distance (`alpha = 1f - pull / 600f`) */
  dismissFadeOver: 600,
  /** drag sideways past this many px and the photo commits to its neighbour. Capped rather than
   *  purely proportional so a wide desk stage stays as quick to page as a phone. */
  swipeCommit: 96,
  /** …or past this fraction of the stage, whichever comes first */
  swipeCommitRatio: 0.25,
  /** how far a pointer may drift and still read as a tap (the app's chat rule: 12px) */
  tapDrift: 12,
  /** how long a press may last and still read as a tap (the app's chat rule: 260ms) */
  tapMs: 260,
  /** two taps inside this window are one double-tap */
  doubleTapMs: 300,
  /** what a double-tap zooms to (`ImageViewer.kt`, `scale = 2.5f`) */
  doubleTapZoom: 2.5,
  /** the ceiling a pinch may reach (`ImageViewer.kt`, `coerceIn(1f, 5f)`) */
  maxZoom: 5,
  /** a pinch released below this settles back to life size */
  zoomSnapBack: 1.05,
} as const;

/** the grid's own defaults */
export const GRID = {
  columns: 4,
  aspectRatio: 1,
  /** how many skeleton frames stand in while the photos are on their way */
  placeholders: 8,
} as const;
