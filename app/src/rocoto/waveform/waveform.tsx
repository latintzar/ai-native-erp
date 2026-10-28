/* WAVEFORM — the audio bar field.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT licensed,
 * Copyright (c) Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom
 * are theirs; the component is Rocoto's, because Base ships nothing that draws sound, and on this
 * product sound is a first-class input.
 *
 * ONE COMPONENT, THREE MODES — and it is one component on purpose. A live meter, a note at rest
 * and a note being scrubbed are the same field of marks under three different jobs; splitting
 * them into three components is how the three drift into three different geometries, which is
 * exactly what happened to the app before the recorder was ported. The mark's thickness, the gap
 * and the ceiling are stated once, in `constants.ts`, and all three modes read them.
 *
 *   live       reads a level source every 60ms and grows marks in from the right edge
 *   static     draws levels it is handed, or a deterministic field from a seed
 *   scrubbing  the same field, split by a playhead: inked behind it, dimmed in front, and
 *              seekable by drag or by arrow key
 *
 * THE ONE PLACE THIS SKIPS REACT, and why: a live field rewrites every mark sixteen times a
 * second. Rendering that through React would mint a styletron class per height per mark — a
 * stylesheet growing by thousands of one-use rules a minute — so the poll writes the single
 * changing number straight onto the node. Paint stays in `styled-components.ts`, where the theme
 * can reach it; only the height is imperative.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { isFocusVisible, forkFocus, forkBlur } from 'baseui/utils/focusVisible';
import {
  ENTER_MARKS,
  GEOMETRY,
  LABEL,
  LEAVE_MARKS,
  MODE,
  NOISE_GATE,
  POLL_MS,
  SEED_PEAKS,
  SIZE,
  STEP_MS,
} from './constants';
import {
  Bar as StyledBar,
  Field as StyledField,
  Root as StyledRoot,
  Time as StyledTime,
} from './styled-components';
import { barHeight, clamp, formatMs, peaksFromSeed, resample } from './utils';
import type { BarStyleProps, SharedStyleProps, WaveformProps } from './types';

const Waveform = (props: WaveformProps) => {
  const {
    mode = MODE.live,
    amplitude,
    paused = false,
    pollMs = POLL_MS,
    peaks,
    seed = 'waveform',
    positionMs = 0,
    durationMs,
    onSeek,
    stepMs = STEP_MS,
    size = SIZE.default,
    disabled = false,
    label,
    overrides = {},
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Field, fieldProps] = getOverrides(overrides.Field, StyledField);
  const [Bar, barProps] = getOverrides(overrides.Bar, StyledBar);
  const [Time, timeProps] = getOverrides(overrides.Time, StyledTime);

  const geometry = GEOMETRY[size];
  const scrubbing = mode === MODE.scrubbing;
  const seekable = scrubbing && !disabled && !!onSeek && !!durationMs;

  const fieldRef = React.useRef<HTMLDivElement | null>(null);
  const markRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const ringRef = React.useRef<number[]>([]);
  const draggingRef = React.useRef(false);
  const [marks, setMarks] = React.useState(0);
  const [focusRing, setFocusRing] = React.useState(false);

  /* HOW MANY MARKS FIT is a measurement, never a guess. A field asked to draw a fixed number of
     marks either overflows its box or leaves a gap at the end; this one draws the number its
     actual width allows, and re-counts whenever that width changes. */
  React.useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    const count = () => {
      const width = node.clientWidth;
      const span = geometry.barWidth + geometry.barGap;
      setMarks(Math.max(0, Math.floor((width + geometry.barGap) / span)));
    };
    count();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(count);
    observer.observe(node);
    return () => observer.disconnect();
  }, [geometry.barWidth, geometry.barGap]);

  /* THE LIVE PAINT. The ring holds the last `marks` levels, newest last, and the field is drawn
     right-aligned so the newest sample is always at the right edge. The envelope is what makes it
     read as breathing rather than stepping: a sample enters small at the edge and grows over the
     next two marks, and leaves over the last one and a half. */
  const paint = React.useCallback(() => {
    const ring = ringRef.current;
    const nodes = markRefs.current;
    const total = nodes.length;
    for (let i = 0; i < total; i++) {
      const node = nodes[i];
      if (!node) continue;
      const fromRight = total - 1 - i;
      const level = ring[ring.length - 1 - fromRight];
      let height = geometry.barWidth;
      if (level !== undefined) {
        const entering = clamp(fromRight / ENTER_MARKS, 0, 1);
        const leaving = clamp(i / LEAVE_MARKS, 0, 1);
        const envelope = Math.min(entering, leaving);
        const full = barHeight(level, NOISE_GATE, geometry.barWidth, geometry.barMax);
        height = geometry.barWidth + (full - geometry.barWidth) * envelope;
      }
      node.style.height = `${height}px`;
    }
  }, [geometry.barWidth, geometry.barMax]);

  React.useEffect(() => {
    if (mode !== MODE.live || paused || disabled || marks === 0) return;
    const read = amplitude;
    const id = window.setInterval(() => {
      const ring = ringRef.current;
      ring.push(read ? clamp(read(), 0, 1) : 0);
      while (ring.length > marks) ring.shift();
      paint();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [mode, paused, disabled, marks, amplitude, pollMs, paint]);

  /* A PAUSED FIELD KEEPS WHAT IT HAS. The marks already on screen stay exactly where they were —
     the meter stopped reading, it did not lose the take. */

  /** the field at rest: the levels the caller measured, or the ones the seed always draws */
  const levels = React.useMemo(() => {
    if (mode === MODE.live) return null;
    const source = peaks && peaks.length ? peaks : peaksFromSeed(seed, SEED_PEAKS);
    return resample(source, marks);
  }, [mode, peaks, seed, marks]);

  const progress = durationMs && durationMs > 0 ? clamp(positionMs / durationMs, 0, 1) : 0;
  const playedCount = scrubbing ? Math.round(progress * marks) : marks;

  const shared: SharedStyleProps = {
    $mode: mode,
    $size: size,
    $disabled: disabled,
    $isFocusVisible: focusRing,
  };

  /* ── seeking ──────────────────────────────────────────────────────────────────────────────
     The strip is the target, and the position is read off the strip's own box, so a click at the
     left edge is 0:00 and one at the right edge is the end — with no dependence on where the
     component happens to sit on the page. */
  const seekTo = (clientX: number) => {
    const node = fieldRef.current;
    if (!node || !onSeek || !durationMs) return;
    const box = node.getBoundingClientRect();
    const at = box.width > 0 ? (clientX - box.left) / box.width : 0;
    onSeek(Math.round(clamp(at, 0, 1) * durationMs));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    event.currentTarget.focus();
    seekTo(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!seekable || !draggingRef.current) return;
    seekTo(event.clientX);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  /* THE KEYBOARD PATH IS THE SAME PATH. Arrows step, Page keys stride, Home and End go to the
     ends — the drag and the keys land on one `onSeek`, so there is no second seek to keep true. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!seekable || !durationMs) return;
    let next = positionMs;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = positionMs - stepMs;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = positionMs + stepMs;
        break;
      case 'PageDown':
        next = positionMs - stepMs * 10;
        break;
      case 'PageUp':
        next = positionMs + stepMs * 10;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = durationMs;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSeek?.(Math.round(clamp(next, 0, durationMs)));
  };

  const handleFocus = (event: React.FocusEvent) => {
    if (isFocusVisible(event)) setFocusRing(true);
  };
  const handleBlur = () => {
    if (focusRing) setFocusRing(false);
  };

  const readout = scrubbing
    ? `${formatMs(positionMs)} / ${formatMs(durationMs ?? 0)}`
    : durationMs
    ? formatMs(durationMs)
    : null;

  markRefs.current.length = marks;

  const a11y = scrubbing
    ? {
        role: 'slider',
        tabIndex: disabled ? -1 : 0,
        'aria-label': label ?? LABEL.scrubbing,
        'aria-valuemin': 0,
        'aria-valuemax': durationMs ?? 0,
        'aria-valuenow': Math.round(positionMs),
        'aria-valuetext': `${formatMs(positionMs)} of ${formatMs(durationMs ?? 0)}`,
        'aria-orientation': 'horizontal' as const,
        'aria-disabled': disabled || undefined,
      }
    : { role: 'img', 'aria-label': label ?? LABEL[mode] };

  return (
    <Root data-baseweb="waveform" {...shared} {...rootProps}>
      <Field
        ref={fieldRef}
        {...a11y}
        {...shared}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={forkFocus(fieldProps, handleFocus)}
        onBlur={forkBlur(fieldProps, handleBlur)}
        {...fieldProps}
      >
        {Array.from({ length: marks }, (unused, index) => {
          const bar: BarStyleProps = { ...shared, $played: index < playedCount };
          const level = levels ? levels[index] : undefined;
          return (
            <Bar
              key={index}
              ref={(node: HTMLDivElement | null) => {
                markRefs.current[index] = node;
              }}
              {...bar}
              {...barProps}
              style={
                level === undefined
                  ? undefined
                  : {
                      height: `${barHeight(
                        level,
                        NOISE_GATE,
                        geometry.barWidth,
                        geometry.barMax
                      )}px`,
                    }
              }
            />
          );
        })}
      </Field>
      {readout && (
        <Time {...shared} {...timeProps}>
          {readout}
        </Time>
      )}
    </Root>
  );
};

export default Waveform;
