/* GALLERY — the photo surface: a grid of held frames, and the full-bleed viewer they open into.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships no photo surface at all — and this product is one
 * people photograph things into.
 *
 * IT IS A PORT BEFORE IT IS AN INVENTION. The app already ships this viewer twice over —
 * `ui/components/ImageViewer.kt` (the pager, the pinch, the double-tap) and
 * `ui/components/MediaViewerChrome.kt` (the warm-ink ground, the chrome row, swipe-down to leave)
 * — and the web has already ported the still half of it in `webapp/src/chat/MediaViewer.tsx`. That
 * port left a note where it stopped:
 *
 *     «NOT PORTED, deliberately: pinch-zoom, the horizontal pager and swipe-down-to-dismiss are
 *      touch gestures with no mouse meaning… Zoom/pager return the day this viewer meets a touch
 *      surface — as the port's states, not as an invention.»
 *
 * This is that day. Every threshold, every ceiling and every curve below is READ OFF the Kotlin
 * and listed in `constants.ts` beside the line it came from, so the hand that learned the app
 * already knows this one. Nothing about the feel was chosen here.
 *
 * WHAT THE WEB ADDS, and only because the desk has no thumb: a real close button, a real pair of
 * arrows, arrow keys, Escape, and a click on the ground. The ported viewer added the first of
 * those for exactly this reason and said so; these are the rest of the same sentence.
 *
 * WHAT THE GRID ADDS, which the app has never drawn: the frames themselves. They reserve each
 * picture's space before it arrives — Base's own aspect-ratio reservation — so a gallery loads
 * without the rows shuffling under the reader's eye.
 *
 * ONE INDICATOR, and it is Base's. The app counts «3 / 8» in the top-centre of the chrome; the kit
 * spends that on Base's own Page Control instead. The dots say the same thing and can be PRESSED,
 * which a counter cannot, and a component that already lives in this kit beats a second one grown
 * beside it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { Layer } from 'baseui/layer';
import { PageControl, KIND as PAGE_CONTROL_KIND } from 'baseui/page-control';
import { Skeleton } from 'baseui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'baseui/icon';
import {
  Root as StyledRoot,
  Thumb as StyledThumb,
  ThumbImage as StyledThumbImage,
  Placeholder as StyledPlaceholder,
  Lightbox as StyledLightbox,
  Content as StyledContent,
  Stage as StyledStage,
  Track as StyledTrack,
  Slide as StyledSlide,
  Image as StyledImage,
  Close as StyledClose,
  Previous as StyledPrevious,
  Next as StyledNext,
  Caption as StyledCaption,
  Dots as StyledDots,
} from './styled-components';
import { CONTAINER, GESTURE, GRID } from './constants';
import type { GalleryProps, SharedStyleProps } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Point = { x: number; y: number };
const spread = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** WHAT WAS ACTUALLY PRESSED. A captured pointer retargets its own events to whatever captured
 *  them, so `event.target` on a pointerup is the stage every single time — which read every tap on
 *  the picture as a tap on the ground, and closed the viewer instead of magnifying it. Ask the
 *  document what is under the point instead. */
const overPicture = (x: number, y: number) => {
  if (typeof document === 'undefined') return false;
  const node = document.elementFromPoint(x, y) as HTMLElement | null;
  return Boolean(node && node.tagName === 'IMG');
};

/** what one pointer is in the middle of doing. Decided ONCE, on the first movement that clears
 *  the tap drift, and held until the pointer lifts — so a swipe that wanders never becomes a
 *  dismiss halfway through, which is the failure that makes a gallery feel loose. */
type Mode = 'idle' | 'undecided' | 'swipe' | 'dismiss' | 'pan' | 'pinch';

const Gallery = (props: GalleryProps) => {
  const {
    photos,
    columns = GRID.columns,
    aspectRatio = GRID.aspectRatio,
    zoomable = true,
    loading = false,
    placeholderCount = GRID.placeholders,
    disabled = false,
    container = CONTAINER.viewport,
    overrides = {},
  } = props;

  const [, theme] = useStyletron();
  /** how long the lightbox takes to leave. Read from the theme rather than stated, because a
   *  timer that disagrees with the transition it waits on is a flicker nobody can find later. */
  const exitMs = parseInt(theme.animation.timing400, 10) || 400;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Thumb, thumbProps] = getOverrides(overrides.Thumb, StyledThumb);
  const [ThumbImage, thumbImageProps] = getOverrides(overrides.ThumbImage, StyledThumbImage);
  const [Placeholder, placeholderProps] = getOverrides(overrides.Placeholder, StyledPlaceholder);
  const [Lightbox, lightboxProps] = getOverrides(overrides.Lightbox, StyledLightbox);
  const [Content, contentProps] = getOverrides(overrides.Content, StyledContent);
  const [Stage, stageProps] = getOverrides(overrides.Stage, StyledStage);
  const [Track, trackProps] = getOverrides(overrides.Track, StyledTrack);
  const [Slide, slideProps] = getOverrides(overrides.Slide, StyledSlide);
  const [Image, imageProps] = getOverrides(overrides.Image, StyledImage);
  const [Close, closeProps] = getOverrides(overrides.Close, StyledClose);
  const [Previous, previousProps] = getOverrides(overrides.Previous, StyledPrevious);
  const [Next, nextProps] = getOverrides(overrides.Next, StyledNext);
  const [Caption, captionProps] = getOverrides(overrides.Caption, StyledCaption);
  const [Dots, dotsProps] = getOverrides(overrides.Dots, StyledDots);

  /* ── STATE. Each pair is Base's controlled/uncontrolled idiom: hand the value in and the
   *    gallery obeys it; leave it out and the gallery keeps its own. ─────────────────────── */
  const count = photos.length;

  const indexIsControlled = props.activeIndex !== undefined;
  const [ownIndex, setOwnIndex] = React.useState<number | null>(props.initialActiveIndex ?? null);
  const rawIndex = indexIsControlled ? props.activeIndex ?? null : ownIndex;
  const open = rawIndex !== null && count > 0;
  const index = open ? clamp(rawIndex as number, 0, count - 1) : -1;

  const zoomIsControlled = props.zoom !== undefined;
  const [ownZoom, setOwnZoom] = React.useState<number>(props.initialZoom ?? 1);
  const zoom = clamp(zoomIsControlled ? (props.zoom as number) : ownZoom, 1, GESTURE.maxZoom);

  /** where a magnified picture is held. Internal on purpose: pan has no meaning outside a zoom,
   *  and a surface that wants to place a picture places it with `zoom` and gets the centre. */
  const [pan, setPan] = React.useState<Point>({ x: 0, y: 0 });
  /** how far the row is dragged sideways, live, in px */
  const [offset, setOffset] = React.useState(0);
  /** how far the shell is dragged down toward leaving, live, in px */
  const [pull, setPull] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  /** which pictures have arrived, keyed by source so a reorder keeps what it knows */
  const [loaded, setLoaded] = React.useState<Record<string, boolean>>({});

  const lightboxRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const pointers = React.useRef<Record<number, Point>>({});
  const lastTap = React.useRef(0);
  /** a drag just ended, so the click the browser is about to fire is not a press */
  const swallowClick = React.useRef(false);
  const gesture = React.useRef({
    mode: 'idle' as Mode,
    startX: 0,
    startY: 0,
    startTime: 0,
    startZoom: 1,
    startSpread: 1,
    startPanX: 0,
    startPanY: 0,
  });

  const setActiveIndex = (next: number | null) => {
    if (!indexIsControlled) setOwnIndex(next);
    if (next !== rawIndex) props.onActiveIndexChange?.({ activeIndex: next });
  };

  const setZoom = (next: number) => {
    const value = clamp(next, 1, GESTURE.maxZoom);
    if (!zoomIsControlled) setOwnZoom(value);
    if (value !== zoom) props.onZoomChange?.({ zoom: value });
  };

  /** back to life size, centred, with nothing in flight */
  const settle = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setOffset(0);
  };

  const openAt = (i: number) => {
    if (disabled) return;
    settle();
    setPull(0);
    setActiveIndex(i);
  };

  const requestClose = () => {
    settle();
    setPull(0);
    setActiveIndex(null);
  };

  const goTo = (i: number) => {
    const next = clamp(i, 0, count - 1);
    if (next === index) return;
    settle();
    setActiveIndex(next);
  };

  const step = (direction: number) => goTo(index + direction);

  const toggleZoom = () => {
    if (!zoomable) return;
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(GESTURE.doubleTapZoom);
    }
  };

  /* ── ARRIVING AND LEAVING. Base's Modal does exactly this: the element stays mounted for the
   *    length of its own transition after it is asked to go, so the exit is real rather than a
   *    cut. `visible` starts false even when the gallery starts open, so the picture always
   *    comes forward. ─────────────────────────────────────────────────────────────────────── */
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const startedOpen = React.useRef(open);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  /* ── FOCUS AND THE PAGE UNDER IT. A dialog that eats the caret is a dialog nobody can leave,
   *    so where focus came FROM is remembered and handed back. The page behind stops scrolling
   *    only when the lightbox actually covers it. ─────────────────────────────────────────── */
  React.useEffect(() => {
    if (!mounted) return undefined;
    // A gallery that RENDERS open — a reference page showing the state — was asked for by nobody's
    // hand, so it takes the caret from nobody. Everything else about being open still holds, which
    // is why this decides the FOCUS alone and the page-lock below runs either way.
    const takeCaret = !startedOpen.current;
    startedOpen.current = false;
    let frame = 0;
    if (takeCaret) {
      openerRef.current = document.activeElement as HTMLElement | null;
      // A FRAME LATER, deliberately. Base's Layer creates its host element in `componentDidMount`
      // and only portals its children on the render after that, so on the commit that asked for
      // the lightbox the lightbox is not in the document yet and taking the caret does nothing at
      // all — which left every keyboard reader standing on the thumbnail behind an open viewer.
      frame = window.requestAnimationFrame(() =>
        lightboxRef.current?.focus({ preventScroll: true })
      );
    }
    if (container !== CONTAINER.viewport) {
      return () => {
        if (frame) window.cancelAnimationFrame(frame);
        openerRef.current?.focus?.();
      };
    }
    const held = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.body.style.overflow = held;
      openerRef.current?.focus?.();
    };
  }, [mounted, container]);

  /* ── THE GESTURE MACHINE ──────────────────────────────────────────────────────────────── */

  /** a magnified picture may only be held as far as it actually overflows its stage */
  const holdPan = (x: number, y: number, z: number): Point => {
    const box = stageRef.current?.getBoundingClientRect();
    const maxX = box ? (box.width * (z - 1)) / 2 : 0;
    const maxY = box ? (box.height * (z - 1)) / 2 : 0;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!open) return;
    const node = event.currentTarget as HTMLElement;
    node.setPointerCapture?.(event.pointerId);
    pointers.current[event.pointerId] = { x: event.clientX, y: event.clientY };
    const ids = Object.keys(pointers.current);
    const g = gesture.current;

    if (ids.length === 2 && zoomable) {
      const a = pointers.current[Number(ids[0])];
      const b = pointers.current[Number(ids[1])];
      g.mode = 'pinch';
      g.startSpread = Math.max(1, spread(a, b));
      g.startZoom = zoom;
      g.startPanX = pan.x;
      g.startPanY = pan.y;
      setDragging(true);
      return;
    }
    if (ids.length > 1) return;

    g.mode = 'undecided';
    g.startX = event.clientX;
    g.startY = event.clientY;
    g.startTime = Date.now();
    g.startPanX = pan.x;
    g.startPanY = pan.y;
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const held = pointers.current[event.pointerId];
    if (!held) return;
    held.x = event.clientX;
    held.y = event.clientY;

    const g = gesture.current;
    const ids = Object.keys(pointers.current);

    if (g.mode === 'pinch' && ids.length >= 2) {
      const a = pointers.current[Number(ids[0])];
      const b = pointers.current[Number(ids[1])];
      const next = clamp((g.startZoom * spread(a, b)) / g.startSpread, 1, GESTURE.maxZoom);
      setZoom(next);
      setPan((held2) => holdPan(held2.x, held2.y, next));
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;

    if (g.mode === 'undecided') {
      if (zoom > 1) g.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > GESTURE.tapDrift) g.mode = 'swipe';
      else if (dy > GESTURE.tapDrift) g.mode = 'dismiss';
      else return;
    }

    if (g.mode === 'swipe') {
      // at the ends there is nothing to arrive, so the row resists rather than lying about it
      const atStart = index <= 0 && dx > 0;
      const atEnd = index >= count - 1 && dx < 0;
      setOffset(atStart || atEnd ? dx / 3 : dx);
    } else if (g.mode === 'dismiss') {
      setPull(Math.max(0, dy));
    } else if (g.mode === 'pan') {
      setPan(holdPan(g.startPanX + dx, g.startPanY + dy, zoom));
    }
  };

  const endGesture = (event: React.PointerEvent, cancelled: boolean) => {
    const node = event.currentTarget as HTMLElement;
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture?.(event.pointerId);
    const had = pointers.current[event.pointerId];
    delete pointers.current[event.pointerId];
    if (!had) return;

    const g = gesture.current;

    if (g.mode === 'pinch') {
      // one finger of a pinch leaving ends the pinch; the other is released with it, so the
      // gesture never half-continues as a pan the hand did not ask for.
      pointers.current = {};
      g.mode = 'idle';
      swallowClick.current = true;
      setDragging(false);
      if (zoom < GESTURE.zoomSnapBack) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      return;
    }

    if (Object.keys(pointers.current).length > 0) return;
    setDragging(false);
    const mode = g.mode;
    g.mode = 'idle';
    if (mode !== 'undecided') swallowClick.current = true;

    if (mode === 'swipe') {
      const width = stageRef.current?.getBoundingClientRect().width ?? 0;
      const commit = Math.min(
        GESTURE.swipeCommit,
        Math.max(24, width * GESTURE.swipeCommitRatio)
      );
      if (offset <= -commit) step(1);
      else if (offset >= commit) step(-1);
      setOffset(0);
      return;
    }

    if (mode === 'dismiss') {
      const leaving = pull > GESTURE.dismissAt;
      setPull(0);
      if (leaving) requestClose();
      return;
    }

    if (mode === 'pan' || cancelled) return;

    // …then it was a tap.
    const elapsed = Date.now() - g.startTime;
    const drift = Math.hypot(event.clientX - g.startX, event.clientY - g.startY);
    if (elapsed > GESTURE.tapMs || drift > GESTURE.tapDrift) return;

    if (!overPicture(event.clientX, event.clientY)) {
      requestClose();
      return;
    }
    // On the picture itself: a MOUSE click to look is not a request to leave — the ported viewer's
    // own call — so the mouse acts on double-click instead, handled below.
    if (event.pointerType === 'mouse') return;
    const now = Date.now();
    if (now - lastTap.current < GESTURE.doubleTapMs) {
      lastTap.current = 0;
      toggleZoom();
    } else {
      lastTap.current = now;
    }
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if (!overPicture(event.clientX, event.clientY)) return;
    toggleZoom();
  };

  /** the ground dismisses; the picture does not. A click that ARRIVES OUT OF A DRAG is swallowed:
   *  the browser still fires one on the common ancestor of where the hand went down and came up,
   *  and a swipe that ends by closing the viewer is a gallery nobody can page through. */
  const onGroundClick = (event: React.MouseEvent) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (event.target === event.currentTarget) requestClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      goTo(count - 1);
      return;
    }
    // KEEP TAB INSIDE. Only when the lightbox actually covers the page — a lightbox opened inside
    // one pane has a page around it that the caret is still entitled to reach.
    if (event.key === 'Tab' && container === CONTAINER.viewport) {
      const root = lightboxRef.current;
      if (!root) return;
      const reachable = Array.prototype.slice
        .call(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]'))
        .filter((node: HTMLElement) => !node.hasAttribute('disabled') && node.tabIndex >= 0);
      if (reachable.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = reachable[0] as HTMLElement;
      const last = reachable[reachable.length - 1] as HTMLElement;
      const here = document.activeElement;
      if (event.shiftKey && (here === first || here === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && here === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  /* ── WHAT IT DRAWS ────────────────────────────────────────────────────────────────────── */

  const shared: SharedStyleProps = {
    $columns: columns,
    $aspectRatio: aspectRatio,
    $disabled: disabled,
    $inline: container !== CONTAINER.viewport,
    $visible: visible,
    $zoom: zoom,
    $dragging: dragging,
    $count: count,
  };

  const markLoaded = (src: string) =>
    setLoaded((known) => (known[src] ? known : { ...known, [src]: true }));

  // An empty gallery draws nothing at all, so the surface can hand the empty case to Base's own
  // Empty State rather than to a second one grown here.
  if (count === 0 && !loading) return null;

  const current = index >= 0 ? photos[index] : undefined;

  const lightbox = (
    <Lightbox
      ref={lightboxRef}
      role="dialog"
      aria-modal={container === CONTAINER.viewport ? true : undefined}
      aria-label={current ? `${current.alt} — photo ${index + 1} of ${count}` : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      {...shared}
      $pull={pull}
      {...lightboxProps}
    >
      <Content onClick={onGroundClick} {...shared} {...contentProps}>
        {/* THE CHROME COMES FIRST IN THE DOM. It is placed rather than laid out, so its order here
            costs the layout nothing and buys the tab order: close, previous, next, then the picture
            and its dots — the order the eye takes them in. Rendered after the stage instead, the
            first Tab inside an open viewer landed on a page dot. */}
        <Close
          type="button"
          aria-label="Close"
          onClick={requestClose}
          {...shared}
          {...closeProps}
        >
          <ArrowLeft size="scale800" aria-hidden="true" />
        </Close>

        {count > 1 ? (
          <React.Fragment>
            <Previous
              type="button"
              aria-label="Previous photo"
              disabled={index <= 0}
              onClick={() => step(-1)}
              {...shared}
              $disabled={index <= 0}
              {...previousProps}
            >
              <ChevronLeft size="scale850" aria-hidden="true" />
            </Previous>
            <Next
              type="button"
              aria-label="Next photo"
              disabled={index >= count - 1}
              onClick={() => step(1)}
              {...shared}
              $disabled={index >= count - 1}
              {...nextProps}
            >
              <ChevronRight size="scale850" aria-hidden="true" />
            </Next>
          </React.Fragment>
        ) : null}
        <Stage
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event: React.PointerEvent) => endGesture(event, false)}
          onPointerCancel={(event: React.PointerEvent) => endGesture(event, true)}
          onDoubleClick={onDoubleClick}
          {...shared}
          $pull={pull}
          {...stageProps}
        >
          <Track
            {...shared}
            $index={Math.max(0, index)}
            $offset={offset}
            {...trackProps}
          >
            {photos.map((photo, i) => (
              <Slide key={`${photo.src}-${i}`} {...shared} {...slideProps}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  draggable={false}
                  {...shared}
                  $current={i === index}
                  $panX={pan.x}
                  $panY={pan.y}
                  {...imageProps}
                />
              </Slide>
            ))}
          </Track>
        </Stage>

        {current?.caption ? (
          <Caption {...shared} {...captionProps}>
            {current.caption}
          </Caption>
        ) : null}

        {/* one photo has no pages, so it is given no page control */}
        {count > 1 ? (
          <Dots {...shared} {...dotsProps}>
            <PageControl
              currentPage={Math.max(0, index) + 1}
              numPages={count}
              onPageChange={({ nextPage }) => goTo(nextPage - 1)}
              kind={PAGE_CONTROL_KIND.alwaysDark}
              aria-label="Photos"
            />
          </Dots>
        ) : null}

      </Content>
    </Lightbox>
  );

  return (
    <Root
      data-baseweb="gallery"
      role="group"
      aria-label={props['aria-label']}
      aria-busy={loading || undefined}
      {...shared}
      {...rootProps}
    >
      {loading
        ? Array.from({ length: Math.max(1, placeholderCount) }, (_, i) => (
            <Placeholder key={`held-${i}`} aria-hidden="true" {...shared} {...placeholderProps}>
              <Skeleton
                animation
                width="100%"
                height="100%"
                overrides={{
                  Root: { style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
                }}
              />
            </Placeholder>
          ))
        : photos.map((photo, i) => (
            <Thumb
              key={`${photo.src}-${i}`}
              type="button"
              disabled={disabled}
              aria-label={photo.alt}
              aria-haspopup="dialog"
              onClick={() => openAt(i)}
              {...shared}
              $current={open && i === index}
              {...thumbProps}
            >
              <ThumbImage
                src={photo.src}
                // the button already carries the name; a second reading of it is noise
                alt=""
                draggable={false}
                loading="lazy"
                onLoad={() => markLoaded(photo.src)}
                // a cached picture can be decoded BEFORE React attaches its handler, and then the
                // load event never fires and the frame stays blank. Ask the element instead.
                ref={(node: HTMLImageElement | null) => {
                  if (node && node.complete && node.naturalWidth > 0) markLoaded(photo.src);
                }}
                {...shared}
                $loaded={Boolean(loaded[photo.src])}
                {...thumbImageProps}
              />
            </Thumb>
          ))}

      {mounted
        ? container === CONTAINER.viewport
          ? <Layer>{lightbox}</Layer>
          : lightbox
        : null}
    </Root>
  );
};

export default Gallery;
