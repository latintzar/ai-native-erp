/* GROWN from Base Web's own `src/template-component/stateful-container.ts` — same job, same
 * render-prop contract: it owns the state and hands a controlled component its props.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * ═══ THE GESTURE MACHINE ══════════════════════════════════════════════════════════════════════
 * This is the whole of it, and every branch is here on purpose:
 *
 *   pointer down          recording starts OPTIMISTICALLY, before the microphone answers. A
 *                         recorder that waits for permission to resolve loses the first word of
 *                         every take, and the first word is usually the one that mattered.
 *   drag left ≥ 90px      the cancel zone arms and STAYS armed until the finger lifts — dragging
 *                         back out does not disarm it, because a person who has committed to
 *                         cancelling should not be able to un-commit by wobbling.
 *   drag up ≥ 70px        hands-free. The gesture ends there and then: the pointer is released
 *                         from the machine so the finger can leave without sending anything.
 *   release < 1000ms      a slip, not a take. The audio is dropped and the hint says what to do
 *                         instead, phrased as the thing to do rather than the thing that failed.
 *   tap (<260ms, <12px)   also hands-free. A tap has no drag to read, so the only reading that
 *                         makes sense is the one that needs no finger.
 *   any other release     send.
 *   keyboard              a key press starts LOCKED, for the same reason: a held key has no
 *                         travel, so hands-free is the only gesture it can mean. Focus moves to
 *                         the recorder's send control, where Enter already does the obvious
 *                         thing and Escape discards.
 *
 * THE PRESS THAT STARTS A RECORDING IS NOT ALSO THE PRESS THAT ENDS IT. React flushes a discrete
 * update and its effects while the native event is still travelling up to `window`, so the window
 * listener installed by the lock is already live when the Enter that locked the recorder reaches
 * it — and a 0-second take goes out instantly. The event that started the take is remembered by
 * identity and ignored once.
 */
import * as React from 'react';
import { HINT_MS, LABELS, MIN_RECORD_MS, PHASE, POLL_MS, TAP_MAX_MS, TAP_SLOP } from './constants';
import { CANCEL_DISTANCE, LOCK_DISTANCE } from './constants';
import { createRecorder } from './recorder';
import type { Recorder, Source } from './recorder';
import type { Phase, StatefulVoiceButtonContainerProps, VoiceButtonRenderProps } from './types';

type Gesture = { x0: number; y0: number; t0: number; moved: boolean };

function StatefulVoiceButtonContainer(
  props: StatefulVoiceButtonContainerProps
): React.ReactElement | null {
  const {
    children,
    onRecord,
    onCancel,
    onTooShort,
    onPhaseChange,
    onBusyChange,
    simulate,
    seed,
    disabled = false,
    size,
    labels: labelOverrides,
  } = props;

  const labels = { ...LABELS, ...labelOverrides };

  const [phase, setPhase] = React.useState<Phase>(PHASE.idle);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [drag, setDrag] = React.useState({ x: 0, y: 0 });
  const [cancelArmed, setCancelArmed] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<Source | null>(null);

  const recorderRef = React.useRef<Recorder | null>(null);
  const startRef = React.useRef<Promise<Source> | null>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const sendRef = React.useRef<HTMLButtonElement | null>(null);
  const hintTimer = React.useRef(0);
  const keyStartedRef = React.useRef(false);
  const startEventRef = React.useRef<KeyboardEvent | null>(null);

  /* THE TRUTH THE MACHINE READS IS THE REF, NOT THE STATE. Reading state inside a pointer
     callback hands back the value the last render closed over, which mid-gesture is a render
     old — measured on the app as a 4.7s take labelled 0:02. */
  const phaseRef = React.useRef<Phase>(PHASE.idle);
  const armedRef = React.useRef(false);
  const elapsedRef = React.useRef(0);
  phaseRef.current = phase;
  armedRef.current = cancelArmed;

  React.useEffect(() => {
    onPhaseChange?.(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* THE ROW IS NEEDED FOR AS LONG AS THERE IS ANYTHING TO SAY. A take needs it, and so does the
     line left up after one too short to keep — both are wider than the one button this control
     rests as, and a host seating it in a one-button slot has to know which of the two it is
     holding. One signal, both cases, so the seat can never be a render behind the control. */
  const busy = phase !== PHASE.idle || hint !== null;
  React.useEffect(() => {
    onBusyChange?.(busy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const reset = React.useCallback(() => {
    setDrag({ x: 0, y: 0 });
    setCancelArmed(false);
    setElapsedMs(0);
    elapsedRef.current = 0;
  }, []);

  const showHint = React.useCallback((line: string) => {
    setHint(line);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
  }, []);

  /** the clock. It advances on the same cadence the meter reads on, so both tell one story. */
  React.useEffect(() => {
    if (phase === PHASE.idle) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      setElapsedMs(elapsedRef.current);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  const amplitude = React.useCallback(() => recorderRef.current?.amplitude() ?? 0, []);

  const start = React.useCallback(() => {
    const recorder = createRecorder({ simulate, seed });
    recorderRef.current = recorder;
    setSource(null);
    setHint(null);
    reset();
    setPhase(PHASE.recording); // optimistic — the take is running before the browser answers
    const pending = recorder.start();
    startRef.current = pending;
    void pending.then((got) => {
      if (recorderRef.current === recorder) setSource(got);
    });
  }, [simulate, seed, reset]);

  /** never stop a recorder that has not finished starting — that is how a live microphone is left
   *  behind, holding the tab's recording indicator open with nothing to show for it */
  const settle = React.useCallback(async () => {
    const pending = startRef.current;
    startRef.current = null;
    if (pending) await pending.catch(() => undefined);
  }, []);

  const doCancel = React.useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setPhase(PHASE.idle);
    setSource(null);
    reset();
    await settle();
    recorder?.cancel();
    onCancel?.();
  }, [onCancel, reset, settle]);

  const doSend = React.useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    const durationMs = elapsedRef.current;
    setPhase(PHASE.idle);
    setSource(null);
    reset();
    if (!recorder) return;
    await settle();
    if (durationMs < MIN_RECORD_MS) {
      recorder.cancel();
      showHint(labels.tooShort);
      onTooShort?.();
      return;
    }
    const blob = await recorder.finish();
    onRecord?.({ blob, durationMs, source: recorder.source ?? 'simulated' });
  }, [labels.tooShort, onRecord, onTooShort, reset, settle, showHint]);

  const doLock = React.useCallback(() => {
    if (phaseRef.current !== PHASE.locked) setPhase(PHASE.locked);
  }, []);

  /* ── the pointer path ───────────────────────────────────────────────────────────────────── */
  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || phaseRef.current !== PHASE.idle) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = { x0: event.clientX, y0: event.clientY, t0: Date.now(), moved: false };
      start();
    },
    [disabled, start]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const x = event.clientX - gesture.x0;
      const y = event.clientY - gesture.y0;
      if (Math.abs(x) > TAP_SLOP || Math.abs(y) > TAP_SLOP) gesture.moved = true;
      if (phaseRef.current !== PHASE.recording) return;
      setDrag({ x, y });
      if (x <= -CANCEL_DISTANCE) {
        setCancelArmed(true);
        return; // armed until the finger lifts — wobbling back does not un-commit
      }
      if (armedRef.current) return;
      if (y <= -LOCK_DISTANCE) {
        gestureRef.current = null; // the gesture is over; the finger is free to leave
        doLock();
      }
    },
    [doLock]
  );

  const onPointerUp = React.useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (phaseRef.current !== PHASE.recording) return;
    if (armedRef.current) {
      void doCancel();
      return;
    }
    const heldMs = Date.now() - gesture.t0;
    if (heldMs < TAP_MAX_MS && !gesture.moved) doLock();
    else void doSend();
  }, [doCancel, doLock, doSend]);

  /* ── the keyboard path ──────────────────────────────────────────────────────────────────── */
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
      // stops the page scrolling on Space, and stops the synthetic click a keyboard activation
      // would otherwise fire at a button that has no onClick
      event.preventDefault();
      if (event.repeat || disabled || phaseRef.current !== PHASE.idle) return;
      keyStartedRef.current = true;
      startEventRef.current = event.nativeEvent;
      start();
      doLock();
    },
    [disabled, doLock, start]
  );

  React.useEffect(() => {
    if (phase !== PHASE.locked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event === startEventRef.current) return; // the press that locked it does not also end it
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        keyStartedRef.current = false;
        void doCancel();
        return;
      }
      if (event.key === 'Enter') {
        // a focused control answers its own Enter — this path is for the rest of the page
        if (target?.closest?.('button')) return;
        event.preventDefault();
        keyStartedRef.current = false;
        void doSend();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      startEventRef.current = null;
    };
  }, [phase, doCancel, doSend]);

  /* The mic is gone while the recorder is locked, so a keyboard start would drop focus onto the
     body and strand the person there. It lands on the send control instead. */
  React.useEffect(() => {
    if (phase === PHASE.locked && keyStartedRef.current) sendRef.current?.focus();
    if (phase === PHASE.idle) keyStartedRef.current = false;
  }, [phase]);

  /** a control that is switched off mid-take does not keep the microphone open */
  React.useEffect(() => {
    if (disabled && phaseRef.current !== PHASE.idle) void doCancel();
  }, [disabled, doCancel]);

  React.useEffect(
    () => () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      window.clearTimeout(hintTimer.current);
    },
    []
  );

  const renderProps: VoiceButtonRenderProps = {
    phase,
    elapsedMs,
    dragX: drag.x,
    dragY: drag.y,
    cancelArmed,
    amplitude,
    hint,
    disabled,
    size,
    labels,
    sendRef,
    source,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown,
    onDiscard: doCancel,
    onSend: doSend,
  };

  return (children(renderProps) ?? null) as React.ReactElement | null;
}

export default StatefulVoiceButtonContainer;
