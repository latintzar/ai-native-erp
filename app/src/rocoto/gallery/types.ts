/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { CONTAINER } from './constants';

export type Container = keyof typeof CONTAINER;

/** One picture in the gallery. */
export type GalleryPhoto = {
  /** where the picture lives. A data URI is a source like any other. */
  src: string;
  /** what the picture SHOWS, in the language the surface speaks. Required, because a photo with
   *  no alt text is a photo one reader in twenty cannot see at all. */
  alt: string;
  /** the line under the picture in the lightbox. Rich content is allowed; keep it to a line. */
  caption?: React.ReactNode;
};

export type GalleryOverrides = {
  /** the grid */
  Root?: Override;
  /** one thumbnail's hit area — the button that opens the lightbox */
  Thumb?: Override;
  /** the picture inside a thumbnail */
  ThumbImage?: Override;
  /** the frame a thumbnail holds while its photo is on its way */
  Placeholder?: Override;
  /** the ground the lightbox paints — the warm ink the picture floats on */
  Lightbox?: Override;
  /** everything the ground carries: the stage, the chrome, the caption, the dots */
  Content?: Override;
  /** the band the pictures move through */
  Stage?: Override;
  /** the row of photos the stage slides */
  Track?: Override;
  /** one photo's place in that row */
  Slide?: Override;
  /** the picture at full size */
  Image?: Override;
  /** the button that leaves — top-left, the way the app draws it */
  Close?: Override;
  /** step back one photo */
  Previous?: Override;
  /** step on one photo */
  Next?: Override;
  /** the line under the picture */
  Caption?: Override;
  /** the page dots — Base's own Page Control sits inside this */
  Dots?: Override;
};

export type GalleryProps = {
  /** the pictures, in the order they are read. An empty gallery renders nothing at all, so the
   *  surface can hand the empty case to Base's own Empty State rather than to a second one here. */
  photos: GalleryPhoto[];
  /** how many thumbnails stand across the grid. Pick the count per breakpoint the way Base's
   *  Layout Grid does — this honours the number it is given. */
  columns?: number;
  /** the shape of a thumbnail frame, width divided by height. Base's own aspect-ratio idiom. */
  aspectRatio?: number;
  /** the photo the lightbox is showing; `null` closes it. Pass it to drive the gallery from
   *  outside; leave it out and the gallery keeps its own. */
  activeIndex?: number | null;
  /** where an uncontrolled gallery starts. `null` starts on the grid. */
  initialActiveIndex?: number | null;
  /** called whenever the shown photo changes, closing included */
  onActiveIndexChange?: (a: { activeIndex: number | null }) => unknown;
  /** how far the shown photo is magnified — 1 is life size. Same controlled/uncontrolled pair. */
  zoom?: number;
  /** where an uncontrolled gallery's zoom starts */
  initialZoom?: number;
  /** called on every pinch, double-tap and settle */
  onZoomChange?: (a: { zoom: number }) => unknown;
  /** whether pinch and double-tap magnify at all. Off leaves the pager and the dismiss intact. */
  zoomable?: boolean;
  /** the photos are on their way: the grid holds their space with skeleton frames */
  loading?: boolean;
  /** how many frames that skeleton grid holds */
  placeholderCount?: number;
  /** the grid stands and reads, and opens nothing */
  disabled?: boolean;
  /** where the lightbox opens. `viewport` puts it on Base's own Layer, over everything.
   *  `parent` opens it inside the gallery's own box — for a viewer that belongs to one pane of a
   *  split screen, and for a reference page that has to show the open state in place. A `parent`
   *  lightbox is as tall as the gallery's own box, so give that box a height. */
  container?: Container;
  /** what the grid is called, for a reader who hears it rather than sees it */
  'aria-label'?: string;
  overrides?: GalleryOverrides;
};

/* ONE shared shape, Base's own convention (see `modal/types.ts` — `SharedStylePropsArg`): every
 * styled element below takes the same object, and the members that only mean something to one of
 * them are optional. */
export type SharedStyleProps = {
  $columns: number;
  $aspectRatio: number;
  $disabled: boolean;
  /** the lightbox opens inside the gallery's own box rather than over the whole viewport */
  $inline: boolean;
  /** the lightbox has arrived — drives the way it comes forward and the way it goes back */
  $visible: boolean;
  /** how far the shown photo is magnified */
  $zoom: number;
  /** a pointer is on it, so the picture follows the hand with no transition in the way */
  $dragging: boolean;
  /** this thumbnail is the one the lightbox is showing */
  $current?: boolean;
  /** this thumbnail's picture has arrived */
  $loaded?: boolean;
  /** how far the row is dragged sideways, in px */
  $offset?: number;
  /** how far the lightbox is dragged down toward leaving, in px */
  $pull?: number;
  /** where a magnified picture is held, in px */
  $panX?: number;
  $panY?: number;
  /** the photo this element is drawing, and how many there are */
  $index?: number;
  $count?: number;
};
