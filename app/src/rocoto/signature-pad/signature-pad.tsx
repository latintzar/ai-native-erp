/* SIGNATURE PAD — the surface a hand signs on, and the mark it leaves.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT licensed,
 * Copyright (c) Uber Technologies, Inc. The scaffold, the overrides contract, the prop idiom and
 * the focus handling are theirs; the component is Rocoto's, because Base ships no surface that
 * takes a hand, and a hand is how a delivery is accepted at a door.
 *
 * WHAT IT CARRIES:
 *
 *   · THE CANVAS IS THE HAND, THE PATH IS THE RECORD. While a finger is down the ink goes to a
 *     canvas, because a growing path re-rendered through React sixty times a second mints a style
 *     class per frame. The moment the finger lifts, the same samples become an SVG path — one
 *     string, storable, replayable, legible at any size. Both are drawn by ONE smoothing function
 *     (`strokeSegments`), so what the person watched is exactly what the record keeps.
 *
 *   · PRESSURE IS NEVER READ. `PointerEvent.pressure` is 0.5 on every mouse, 0 on many
 *     touchscreens and a real force only on a stylus — a width driven by it would give the same
 *     person three different signatures on three devices. The ink is one thickness; the hand is
 *     the only variable.
 *
 *   · THE MARK IS PLACED BY ITS BASELINE, not by its box. A signature captured on a tall phone
 *     pad and shown a third of the size on a record still sits ON the line, which is the one
 *     thing that makes it read as a signature rather than as a drawing.
 *
 *   · TWO WAYS TO SIGN, BOTH FIRST-CLASS. Some hands cannot draw a name. The typed-name field is
 *     part of this component, at full weight, next to the pad — and what is typed appears on the
 *     line as it is typed, in the company's own face. A typed signature is a typed signature; a
 *     script face pretending to be handwriting would be the one dishonest thing here.
 *
 *   · COLOUR SAYS NOTHING. Every state is ink; they are told apart by weight, by the words under
 *     the pad, and by which decisions stand. The one accent on the page is the focus ring, which
 *     is Base's own ring, matching the Base Button beside it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { FormControl } from 'baseui/form-control';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { getOverrides } from 'baseui/helpers/overrides';
import { isFocusVisible, forkFocus, forkBlur } from 'baseui/utils/focusVisible';
import {
  GEOMETRY,
  LABEL,
  MIN_NAME,
  MIN_TRAVEL,
  REPLAY_MAX_MS,
  REPLAY_MIN_MS,
  SIZE,
} from './constants';
import {
  Actions as StyledActions,
  Baseline as StyledBaseline,
  Canvas as StyledCanvas,
  Caption as StyledCaption,
  Cross as StyledCross,
  Fallback as StyledFallback,
  Ink as StyledInk,
  Label as StyledLabel,
  Mark as StyledMark,
  Pad as StyledPad,
  Prompt as StyledPrompt,
  Root as StyledRoot,
  TypedMark as StyledTypedMark,
} from './styled-components';
import {
  buildValue,
  clamp,
  durationOf,
  fitMark,
  inkWidthFor,
  isNewSample,
  paintStrokes,
  rescaleStrokes,
  travelOf,
} from './utils';
import type { Box } from './utils';
import type {
  SharedStyleProps,
  SignaturePadProps,
  SignatureStroke,
  SignatureValue,
  State,
} from './types';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const sameBox = (a: Box, b: Box) => a.width === b.width && a.height === b.height;

/** what the pad is doing on its own, before `state`, `disabled` or `error` have their say */
type Phase = 'idle' | 'inking' | 'confirmed' | 'cleared';

const SignaturePad = (props: SignaturePadProps) => {
  const {
    size = SIZE.default,
    state,
    disabled = false,
    error = false,
    readOnly = false,
    value,
    defaultValue,
    label = LABEL.group,
    hint,
    errorText = LABEL.error,
    typedName = true,
    typedNameValue,
    onTypedNameChange,
    onChange,
    onConfirm,
    onClear,
    confirmLabel = LABEL.confirm,
    clearLabel = LABEL.clear,
    replay = false,
    minTravel = MIN_TRAVEL,
    overrides = {},
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Label, labelProps] = getOverrides(overrides.Label, StyledLabel);
  const [Pad, padProps] = getOverrides(overrides.Pad, StyledPad);
  const [Canvas, canvasProps] = getOverrides(overrides.Canvas, StyledCanvas);
  const [Mark, markProps] = getOverrides(overrides.Mark, StyledMark);
  const [Ink, inkProps] = getOverrides(overrides.Ink, StyledInk);
  const [TypedMark, typedMarkProps] = getOverrides(overrides.TypedMark, StyledTypedMark);
  const [Baseline, baselineProps] = getOverrides(overrides.Baseline, StyledBaseline);
  const [Cross, crossProps] = getOverrides(overrides.Cross, StyledCross);
  const [Prompt, promptProps] = getOverrides(overrides.Prompt, StyledPrompt);
  const [Actions, actionsProps] = getOverrides(overrides.Actions, StyledActions);
  const [Caption, captionProps] = getOverrides(overrides.Caption, StyledCaption);
  const [Fallback, fallbackProps] = getOverrides(overrides.Fallback, StyledFallback);

  const uid = React.useId();
  const labelId = `${uid}-label`;
  const captionId = `${uid}-caption`;
  const geometry = GEOMETRY[size];

  /* ── what the pad is showing ──────────────────────────────────────────────────────────────
     Controlled the way Base controls an Input: hand it `value` and it shows exactly that, every
     stroke reported through `onChange`; leave `value` out and it keeps its own. */
  const controlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<SignatureValue | null>(defaultValue ?? null);
  const [innerTypedName, setInnerTypedName] = React.useState<string>(defaultValue?.typedName ?? '');
  const [phase, setPhase] = React.useState<Phase>(
    value || defaultValue ? 'confirmed' : 'idle'
  );
  const [focusRing, setFocusRing] = React.useState(false);
  const [box, setBox] = React.useState<Box>({ width: 0, height: 0 });
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const shown = controlled ? value ?? null : innerValue;
  const strokes = shown?.strokes ?? [];
  const typedText = (typedNameValue !== undefined ? typedNameValue : innerTypedName).trim();
  /* a drawn mark wins over a typed one: a hand that drew its name has already signed */
  const markTypedText = strokes.length ? '' : typedText || shown?.typedName || '';
  const hasMark = strokes.length > 0 || markTypedText.length > 0;

  const padRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const inkRef = React.useRef<SVGPathElement | null>(null);
  const strokesRef = React.useRef<SignatureStroke[]>(strokes);
  const activeRef = React.useRef<SignatureStroke | null>(null);
  const boxRef = React.useRef<Box>(box);
  const sourceBoxRef = React.useRef<Box>(box);
  const rectRef = React.useRef<DOMRect | null>(null);
  const frameRef = React.useRef(0);
  const startRef = React.useRef(0);
  const pointerFocusRef = React.useRef(false);

  /* the refs mirror what this render is showing, so a pointer handler and the paint loop read the
     same marks the reader is looking at. A commit writes them optimistically and the next render
     confirms — or, on a controlled pad whose owner declined the stroke, takes it back, which is
     what a controlled input is supposed to do. */
  strokesRef.current = strokes;
  boxRef.current = box;
  sourceBoxRef.current =
    shown && shown.width && shown.height ? { width: shown.width, height: shown.height } : box;

  /* ── the resolved state ───────────────────────────────────────────────────────────────────
     Six states, one value. `state` pins it — that is how a form drives the pad and how the kit
     page can show every state at rest. Left out, the pad reports its own. */
  const derived: State = disabled
    ? 'disabled'
    : error
    ? 'error'
    : phase === 'confirmed'
    ? 'signed'
    : phase === 'cleared'
    ? 'cleared'
    : phase === 'inking' || hasMark
    ? 'signing'
    : 'empty';
  const current: State = state ?? derived;

  const interactive = !readOnly && current !== 'disabled' && current !== 'signed';
  const showMark = (readOnly || current === 'signed') && strokes.length > 0;
  const showCanvas = !showMark && !readOnly;
  const travel = travelOf(strokes);
  const ready = travel >= minTravel || typedText.length >= MIN_NAME;

  const shared: SharedStyleProps = {
    $size: size,
    $state: current,
    $readOnly: readOnly,
    $isFocusVisible: focusRing,
    $hasMark: hasMark,
  };

  const inkColor =
    current === 'disabled' ? theme.colors.contentStateDisabled : theme.colors.contentPrimary;

  /* ── measuring the surface ────────────────────────────────────────────────────────────────
     The pad draws in its own pixels, so it has to know them. Everything else — where a sample
     landed, how a stored mark is fitted, how many device pixels the canvas needs — hangs off
     this one measurement. */
  React.useEffect(() => {
    const node = padRef.current;
    if (!node) return;
    const measure = () => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [size, readOnly]);

  /** the whole canvas, repainted from the marks that exist right now */
  const repaint = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const surface = boxRef.current;
    if (!surface.width || !surface.height) return;
    const dpr = canvas.width / surface.width || 1;
    const active = activeRef.current;
    const all = active && active.length ? [...strokesRef.current, active] : strokesRef.current;
    /* the pad it was signed on frames the marks by their capture box, so nothing re-centres under
       the hand while it is writing */
    const fit = fitMark({ strokes: all, ...sourceBoxRef.current }, surface);
    paintStrokes(context, all, {
      color: inkColor,
      ink: inkWidthFor(geometry.ink, fit.scale),
      scale: fit.scale,
      offsetX: fit.offsetX,
      offsetY: fit.offsetY,
      dpr,
    });
  }, [inkColor, geometry.ink]);

  /** one repaint per frame, however many samples a 120Hz digitiser delivered inside it */
  const schedulePaint = React.useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      repaint();
    });
  }, [repaint]);

  React.useEffect(
    () => () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  /* the canvas is sized in DEVICE pixels and drawn in CSS pixels, so ink at 3× is ink, not a
     staircase. Re-runs on every change that alters what is on the surface. */
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !box.width || !box.height) return;
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const width = Math.round(box.width * dpr);
    const height = Math.round(box.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    repaint();
  }, [box.width, box.height, shown, showCanvas, repaint]);

  /* ── the hand ─────────────────────────────────────────────────────────────────────────────
     One element listens: the surface. The canvas above it takes no pointer events, so there is
     one set of coordinates and one place a gesture can start. */
  const addSample = (event: { clientX: number; clientY: number }) => {
    const rect = rectRef.current;
    const stroke = activeRef.current;
    if (!rect || !stroke) return;
    // a finger that slides off the pad keeps writing at the edge, the way ink does on paper
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    if (!isNewSample(stroke, x, y)) return;
    stroke.push({ x, y, t: Math.round(now() - startRef.current) });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !box.width) return;
    event.preventDefault();
    const node = event.currentTarget;
    if (node.setPointerCapture) node.setPointerCapture(event.pointerId);
    /* The surface takes focus so Backspace can clear what was just written. It must NOT ring for
       it: `preventDefault` above takes the browser's own pointer-focus path away, and a focus()
       arriving with no modality behind it is read as keyboard focus — which put a focus ring
       around the pad every single time a finger landed on it. Focus a pointer caused never rings;
       focus a Tab caused always does. */
    pointerFocusRef.current = true;
    node.focus({ preventScroll: true });
    pointerFocusRef.current = false;
    rectRef.current = node.getBoundingClientRect();
    /* ONE SIGNATURE, ONE COORDINATE SYSTEM. Adding a stroke to marks that were captured on a
       different surface would leave the value holding two of them, so the existing marks are
       moved into this surface first — by the same fit that draws them. */
    if (!sameBox(sourceBoxRef.current, boxRef.current)) {
      strokesRef.current = rescaleStrokes(strokesRef.current, sourceBoxRef.current, boxRef.current);
      sourceBoxRef.current = { ...boxRef.current };
    }
    // the clock picks up where the existing marks left off, so one signature has one timeline
    if (!startRef.current) startRef.current = now() - durationOf(strokesRef.current);
    activeRef.current = [];
    addSample(event.nativeEvent);
    setPhase('inking');
    schedulePaint();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    /* THE SUB-FRAME SAMPLES ARE THE SIGNATURE. A phone digitises at 120Hz or better and delivers
       one event per frame; the samples inside it are where the curve actually is. Reading only
       the delivered event straightens every fast loop into a chord. */
    const native = event.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const batch = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : null;
    if (batch && batch.length) for (const sample of batch) addSample(sample);
    else addSample(native);
    schedulePaint();
  };

  const commit = () => {
    const active = activeRef.current;
    activeRef.current = null;
    rectRef.current = null;
    if (!active || !active.length) return;
    const next = [...strokesRef.current, active];
    strokesRef.current = next;
    const nextValue = buildValue(next, sourceBoxRef.current, typedText) as SignatureValue;
    if (!controlled) setInnerValue(nextValue);
    setPhase('inking');
    bump();
    schedulePaint();
    onChange?.(nextValue);
  };

  const clear = () => {
    strokesRef.current = [];
    activeRef.current = null;
    rectRef.current = null;
    startRef.current = 0;
    sourceBoxRef.current = { ...boxRef.current };
    if (!controlled) setInnerValue(null);
    if (typedNameValue === undefined) setInnerTypedName('');
    setPhase('cleared');
    bump();
    schedulePaint();
    onTypedNameChange?.('');
    onChange?.(null);
    onClear?.();
  };

  const confirm = () => {
    const confirmed = buildValue(strokesRef.current, sourceBoxRef.current, typedText);
    if (!confirmed) return;
    if (!controlled) setInnerValue(confirmed);
    setPhase('confirmed');
    onConfirm?.(confirmed);
  };

  const changeTypedName = (next: string) => {
    if (typedNameValue === undefined) setInnerTypedName(next);
    setPhase(next.trim() || strokesRef.current.length ? 'inking' : 'idle');
    onTypedNameChange?.(next);
    onChange?.(buildValue(strokesRef.current, sourceBoxRef.current, next));
  };

  /* THE KEYBOARD PATH IS THE TYPED NAME — a real, labelled Base Input, reachable in the tab
     order, which is how a keyboard-only person signs this form. The surface itself still takes
     focus so it can be found and cleared, and Backspace does there what Clear does below. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    if (!hasMark) return;
    event.preventDefault();
    clear();
  };

  const handleFocus = (event: React.FocusEvent) => {
    if (pointerFocusRef.current) return;
    if (isFocusVisible(event)) setFocusRing(true);
  };
  const handleBlur = () => {
    if (focusRing) setFocusRing(false);
  };

  /* ── the replay ───────────────────────────────────────────────────────────────────────────
     A stored mark draws itself in over the time the signing took. The pace is the path's own
     length, not the hand's — the samples carry the real timing for anyone who wants it, and a
     record page wants a signature that appears the way one is written, not a re-enactment. */
  React.useLayoutEffect(() => {
    const node = inkRef.current;
    if (!node || !replay || !showMark || typeof node.getTotalLength !== 'function') return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const length = node.getTotalLength();
    if (!length) return;
    const ms = clamp(shown?.durationMs || 1200, REPLAY_MIN_MS, REPLAY_MAX_MS);
    node.style.transitionProperty = 'none';
    node.style.strokeDasharray = `${length}`;
    node.style.strokeDashoffset = `${length}`;
    // read the box back so the browser takes the start state before the transition is declared
    void node.getBoundingClientRect();
    node.style.transitionProperty = 'stroke-dashoffset';
    node.style.transitionDuration = `${ms}ms`;
    node.style.transitionTimingFunction = theme.animation.linearCurve;
    node.style.strokeDashoffset = '0';
    return () => {
      node.style.transitionProperty = '';
      node.style.transitionDuration = '';
      node.style.transitionTimingFunction = '';
      node.style.strokeDasharray = '';
      node.style.strokeDashoffset = '';
    };
  }, [replay, showMark, shown, theme.animation.linearCurve]);

  const captionText = current === 'error' ? errorText : hint ?? LABEL[current];
  /* on a record the mark is framed by its own ink, so a signature that used two thirds of a phone
     pad arrives filling the row rather than as a smudge in the middle of it */
  const fit = fitMark({ strokes, width: sourceBoxRef.current.width, height: sourceBoxRef.current.height }, box, readOnly);
  const measured = box.width > 0 && box.height > 0;
  const padLabel = readOnly
    ? markTypedText
      ? `${label}: ${markTypedText}`
      : label
    : LABEL.pad;

  return (
    <Root
      data-baseweb="signature-pad"
      {...(readOnly ? null : { role: 'group', 'aria-labelledby': labelId })}
      {...shared}
      {...rootProps}
    >
      {!readOnly && (
        <Label id={labelId} {...shared} {...labelProps}>
          {label}
        </Label>
      )}

      <Pad
        ref={padRef}
        role="img"
        aria-label={padLabel}
        aria-describedby={readOnly ? undefined : captionId}
        aria-disabled={current === 'disabled' || undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyDown={onKeyDown}
        onFocus={forkFocus(padProps, handleFocus)}
        onBlur={forkBlur(padProps, handleBlur)}
        {...shared}
        {...padProps}
      >
        {showCanvas && <Canvas ref={canvasRef} {...shared} {...canvasProps} />}

        {showMark && measured && (
          <Mark
            viewBox={`0 0 ${box.width} ${box.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            {...shared}
            {...markProps}
          >
            {/* the same fit the canvas paints with: uniform scale, centred across, and the
                signature's own baseline laid onto the surface's line */}
            <g transform={`translate(${fit.offsetX} ${fit.offsetY}) scale(${fit.scale})`}>
              {/* the one number that depends on the size this mark is shown at, written onto the
                  node — the same division of labour the Waveform makes with a bar's height */}
              <Ink
                ref={inkRef}
                d={shown?.path ?? ''}
                style={{ strokeWidth: `${inkWidthFor(geometry.ink, fit.scale)}px` }}
                {...shared}
                {...inkProps}
              />
            </g>
          </Mark>
        )}

        {markTypedText && (
          <TypedMark aria-hidden="true" {...shared} {...typedMarkProps}>
            {markTypedText}
          </TypedMark>
        )}

        <Baseline {...shared} {...baselineProps} />

        {!readOnly && !hasMark && (
          <Cross aria-hidden="true" {...shared} {...crossProps}>
            ✕
          </Cross>
        )}

        {!readOnly && !hasMark && current !== 'disabled' && (
          <Prompt aria-hidden="true" {...shared} {...promptProps}>
            {LABEL.prompt}
          </Prompt>
        )}
      </Pad>

      {!readOnly && (
        <Caption
          id={captionId}
          {...(current === 'error' ? { role: 'alert' } : null)}
          {...shared}
          {...captionProps}
        >
          {captionText}
        </Caption>
      )}

      {!readOnly && typedName && current !== 'signed' && (
        <Fallback {...shared} {...fallbackProps}>
          <FormControl label={LABEL.typedName} caption={LABEL.typedNameCaption}>
            <Input
              size={INPUT_SIZE.compact}
              value={typedNameValue !== undefined ? typedNameValue : innerTypedName}
              placeholder={LABEL.typedNamePlaceholder}
              disabled={current === 'disabled'}
              onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                changeTypedName(event.currentTarget.value)
              }
            />
          </FormControl>
        </Fallback>
      )}

      {!readOnly && (
        <Actions {...shared} {...actionsProps}>
          {current !== 'signed' && (
            <Button
              kind={KIND.primary}
              size={BUTTON_SIZE.compact}
              disabled={!ready || current === 'disabled'}
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          )}
          <Button
            kind={KIND.tertiary}
            size={BUTTON_SIZE.compact}
            disabled={!hasMark || current === 'disabled'}
            onClick={clear}
          >
            {clearLabel}
          </Button>
        </Actions>
      )}
    </Root>
  );
};

export default SignaturePad;
