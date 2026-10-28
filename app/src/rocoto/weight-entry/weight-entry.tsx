/* WEIGHT ENTRY — the field the final weight is captured in.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships an Input and a Stepper and this is neither.
 *
 * WHY IT EXISTS: the customer orders 5 kg and the albarán carries the weight that was actually
 * handed over — 5,02 kg, because somebody weighed it and priced what the scale said. That number
 * is captured by a hand that is wet, gloved, cold, and holding a phone at a scale. So the field
 * takes the number three ways at once, the way a phone takes an alarm time:
 *
 *   1 · THE TIMER METHOD. Digits enter FROM THE RIGHT and shift the number leftward through its
 *       units: 5 → 0,005 · 0 → 0,050 · 2 → 0,502 · 0 → 5,020. No decimal point is ever typed, no
 *       cursor is ever placed, backspace shifts back. THE MOVEMENT IS VISIBLE — each digit is a
 *       DOM node that keeps its identity and flies to its new slot, because seeing the number
 *       move is what makes the method learnable in one keystroke.
 *   2 · THE ODOMETER (FEED-IA §16). «The increment affordance sits ABOVE AND BELOW the digit place
 *       it changes — tap over the hundreds-of-grams digits to add one, under to subtract. THE
 *       DIGIT PLACE IS THE LABEL.» So there is no ladder and no rung name anywhere: a mark belongs
 *       to a COLUMN of the number, every column has one, and the column says what it is by being
 *       that column. Held, a mark repeats and accelerates.
 *   3 · THE SCALE PHOTO. Point the phone at the readout; the number arrives in the field, says so
 *       out loud, and stays fully overridable. Reading it is the AI's own act, so the accent marks
 *       that and nothing else here. Correct it by hand and the photo's number stays legible
 *       beneath the correction, struck through, on the same Figure that carries every superseded
 *       number in this product.
 *
 * ═══ THE DESK IS KEYBOARD-FIRST (FEED-IA §16) ═══════════════════════════════════════════════
 * «On desktop the chevron thing doesn't make sense — people use a keyboard.» So on a fine pointer
 * the field is a number you CLICK AND TYPE: the digits format themselves as they arrive, the
 * arrows step the place the rule sits under, ← → move that rule, and Enter — or the focus leaving
 * the field — commits. The increment marks hold their room so nothing reflows, and they stay
 * invisible until a hand is actually on the field. A coarse pointer gets them from the first
 * frame, because a thumb has no arrow keys.
 *
 * EVERY NUMBER IN HERE IS AN INTEGER OF GRAMS. A kilo is a thousand of them. Nothing in this
 * component ever holds a binary fraction, so nothing in it can ever round a weight wrong.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Figure } from '../figure';
import { GRAM_PLACES, GROUP, MIN_SLOTS, PER_KILO } from './constants';
import {
  ramp,
  Root as StyledRoot,
  Label as StyledLabel,
  Field as StyledField,
  Readout as StyledReadout,
  Line as StyledLine,
  SlotRow as StyledSlotRow,
  Digit as StyledDigit,
  Comma as StyledComma,
  Place as StyledPlace,
  Spacer as StyledSpacer,
  Chevron as StyledChevron,
  Unit as StyledUnit,
  Camera as StyledCamera,
  Viewfinder as StyledViewfinder,
  ScaleDisplay as StyledScaleDisplay,
  Scan as StyledScan,
  Attribution as StyledAttribution,
  Mark as StyledMark,
  Chip as StyledChip,
  ChipButton as StyledChipButton,
  Thumb as StyledThumb,
  Compare as StyledCompare,
  CompareRow as StyledCompareRow,
  CompareLabel as StyledCompareLabel,
  Track as StyledTrack,
  TrackFill as StyledTrackFill,
  TrackTick as StyledTrackTick,
} from './styled-components';
import type {
  WeightEntryProps,
  SharedStyleProps,
  DigitStyleProps,
  Source,
  Capture,
} from './types';

/* ── THE SLOTS ────────────────────────────────────────────────────────────────────────────────
 * A slot is one typed digit WITH AN IDENTITY. The identity is the whole trick: when a new digit
 * arrives, every existing slot keeps its id and simply finds itself one column further left, so
 * React reuses its DOM node and the layout effect below can fly it there. Rebuild the array from
 * a fresh string and the number would blink instead of move. */
type Slot = { id: string; d: string };

/** what the last mutation was — the layout effect animates according to it */
type Motion =
  | { kind: 'type' }
  | { kind: 'erase' }
  | { kind: 'step'; dir: 1 | -1; changed: Set<string> }
  | { kind: 'arrive' }
  | null;

let SEQ = 0;
const nid = () => `d${(SEQ += 1)}`;

/** write a digit string onto the existing slots, right-aligned, so a slot that holds the same
 *  order of magnitude before and after keeps its node and does not fly anywhere. */
function writeDigits(next: string, prev: Slot[]): { slots: Slot[]; changed: Set<string> } {
  const slots: Slot[] = [];
  const changed = new Set<string>();
  for (let i = 0; i < next.length; i += 1) {
    const fromRight = next.length - 1 - i;
    const reuse = prev[prev.length - 1 - fromRight];
    const id = reuse ? reuse.id : nid();
    if (!reuse || reuse.d !== next[i]) changed.add(id);
    slots.push({ id, d: next[i] });
  }
  return { slots, changed };
}

const gramsOf = (slots: Slot[]) => {
  const s = slots.map((x) => x.d).join('');
  return s ? parseInt(s, 10) : 0;
};

const digitsOf = (grams: number) => (grams > 0 ? String(grams) : '');

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ── THE MARKS ────────────────────────────────────────────────────────────────────────────────
 * Line art, drawn in currentColor, so every one of them re-themes with the text it sits in. */
const ChevronMark = ({ up }: { up: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d={up ? 'M4 10L8 6l4 4' : 'M4 6l4 4 4-4'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CameraMark = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M2.5 6.5h3l1.2-2h6.6l1.2 2h3v9h-15v-9z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const TrashMark = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M7 7v4M9 7v4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── THE SEPARATORS, ASKED FOR RATHER THAN GUESSED ────────────────────────────────────────────
 * Read from `Intl.NumberFormat.formatToParts`, never sliced out of a formatted string. Slicing was
 * the first version and it printed a DIGIT as the grouping mark: `(1000).toLocaleString('es-ES')`
 * is «1000», because es-ES groups from five figures up, so character one is a zero. The number on
 * screen read «1 0 04 6 0,500» and only the aria text was right — which is exactly the kind of bug
 * that survives a code review and dies to a screenshot. */
const separatorOf = (locale: string, type: 'group' | 'decimal'): string =>
  new Intl.NumberFormat(locale)
    .formatToParts(11111.1)
    .find((part) => part.type === type)?.value ?? (type === 'group' ? ' ' : ',');

/** THE PLACE, SAID OUT LOUD — for the screen reader and for the mark's own label. The digit place
 *  is the label on screen; this is the same label in words. */
const placeName = (place: number, locale: string, unit: string): string =>
  place < GRAM_PLACES
    ? `${10 ** place} g`
    : `${(10 ** (place - GRAM_PLACES)).toLocaleString(locale)} ${unit}`;

/** true where the pointer is a finger. A thumb has no arrow keys, so it gets the marks outright. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const read = () => setCoarse(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return coarse;
}

/** one column of the number: a digit place, or the separator that keeps the number readable */
type Col =
  | { kind: 'digit'; key: string; ch: string; pad: boolean; place: number }
  | { kind: 'sep'; key: string; ch: string };

const WeightEntry = (props: WeightEntryProps) => {
  const {
    value,
    defaultValue,
    onChange,
    onCommit,
    ordered,
    label,
    unit = 'kg',
    size = 'default',
    marks = 'auto',
    camera = true,
    scaleReading = 5.02,
    capture: captureSeed,
    source: sourceSeed,
    maxDigits = 6,
    disabled = false,
    readOnly = false,
    attribution: showAttribution = true,
    locale = 'es-ES',
    overrides = {},
  } = props;

  const [css, theme] = useStyletron();

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Field, fieldProps] = getOverrides(overrides.Field, StyledField);
  const [Readout, readoutProps] = getOverrides(overrides.Readout, StyledReadout);
  const [Digit, digitProps] = getOverrides(overrides.Digit, StyledDigit);
  const [Unit, unitProps] = getOverrides(overrides.Unit, StyledUnit);
  const [, lineProps] = getOverrides(overrides.Line, StyledLine);
  const [Chevron, chevronProps] = getOverrides(overrides.Chevron, StyledChevron);
  const [Camera, cameraProps] = getOverrides(overrides.Camera, StyledCamera);
  const [Attribution, attributionProps] = getOverrides(overrides.Attribution, StyledAttribution);
  const [Compare, compareProps] = getOverrides(overrides.Compare, StyledCompare);

  const maxGrams = 10 ** maxDigits - 1;

  const [slots, setSlots] = React.useState<Slot[]>(() => {
    const start = value !== undefined ? value : defaultValue;
    return start ? writeDigits(digitsOf(Math.round(start * PER_KILO)), []).slots : [];
  });
  const [source, setSource] = React.useState<Source>(
    () => sourceSeed ?? ((value ?? defaultValue) ? 'typed' : 'empty')
  );
  /** the digit place the keyboard is driving, counted from the right. 0 is the gram. */
  const [place, setPlace] = React.useState(0);
  const [held, setHeld] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const [captureState, setCaptureState] = React.useState<Capture>(captureSeed ?? 'closed');
  /* seeded when the field opens already attributed to a photograph — the kit parks it there, and
     the first keystroke or step takes it straight into `adjusted`, live */
  const [photoGrams, setPhotoGrams] = React.useState<number | null>(() =>
    sourceSeed === 'photo' || sourceSeed === 'adjusted' ? Math.round(scaleReading * PER_KILO) : null
  );
  const [preview, setPreview] = React.useState(false);

  const motion = React.useRef<Motion>(null);
  const grams = gramsOf(slots);
  const kilos = grams / PER_KILO;

  const coarse = useCoarsePointer();
  const showMarks = marks !== 'off' && !readOnly;
  /* A DESK WITH NO HAND ON THE FIELD. The marks keep their room — a control that appears by
     pushing the number down is a control that moved the thing it points at. */
  const quietMarks = showMarks && marks === 'auto' && !coarse && !(over || focused);

  /* ── THE CONTROLLED DOOR ──────────────────────────────────────────────────────────────────
   * A pinned `value` re-writes the slots without disturbing their identity, so the kit can park
   * this component on a number and it still looks like a field somebody typed into. */
  const applied = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (value === undefined) return;
    const g = clamp(Math.round(value * PER_KILO), 0, maxGrams);
    if (applied.current === g) return;
    applied.current = g;
    setSlots((prev) => (gramsOf(prev) === g ? prev : writeDigits(digitsOf(g), prev).slots));
  }, [value, maxGrams]);

  /* ── WHAT LEAVES ──────────────────────────────────────────────────────────────────────────
   * Reported from an effect rather than from inside a state updater, so a repeat-fired mark
   * cannot double-report a step it only took once. */
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.({ grams, kilos, source: source });
    // onChange identity is the caller's business; the report is keyed to the number itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grams, source]);

  /** THE COMMIT. Enter, or the focus leaving the field — the two things a desk means by «done». */
  const latest = React.useRef({ grams, kilos, source });
  latest.current = { grams, kilos, source };
  const commit = React.useCallback(() => {
    if (disabled || readOnly) return;
    onCommit?.({ ...latest.current });
  }, [disabled, readOnly, onCommit]);

  /* ── THE MOVEMENT ─────────────────────────────────────────────────────────────────────────
   * FLIP, on the digits themselves. Every commit: measure where each slot landed, compare with
   * where it was, put it back with a transform, then let it travel. The readout's frame is a
   * fixed width and every slot is the same box, so NOTHING reflows while a digit is in flight —
   * the only thing that changes on screen is the translation, which is exactly the thing the
   * person is meant to read. */
  const cellRefs = React.useRef(new Map<string, HTMLElement>());
  const lastRects = React.useRef(new Map<string, DOMRect>());
  const mounted = React.useRef(false);

  React.useLayoutEffect(() => {
    const m = motion.current;
    motion.current = null;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const now = new Map<string, DOMRect>();
    const dur = theme.animation.timing300;
    const fast = theme.animation.timing200;
    const ease = theme.animation.easeOutCurve;
    const step = parseFloat((theme.sizing as Record<string, string>)[ramp(size).slot]);

    let i = 0;
    cellRefs.current.forEach((el, key) => {
      const rect = el.getBoundingClientRect();
      now.set(key, rect);
      if (!mounted.current || reduced) {
        i += 1;
        return;
      }
      const was = lastRects.current.get(key);
      const play = (from: string, opacity: boolean, delay: number, ms: string) => {
        el.style.transition = 'none';
        el.style.transform = from;
        if (opacity) el.style.opacity = '0';
        void el.offsetWidth; // commit the start frame before asking for the end frame
        el.style.transition = `transform ${ms} ${ease} ${delay}ms${opacity ? `, opacity ${ms} ${ease} ${delay}ms` : ''}`;
        el.style.transform = 'translate(0, 0)';
        if (opacity) el.style.opacity = '1';
      };

      if (was) {
        const dx = was.left - rect.left;
        if (Math.abs(dx) > 0.5) {
          // the shift: the digit travels to the column it now occupies
          play(`translate(${dx}px, 0)`, false, 0, dur);
        } else if (m && m.kind === 'step' && m.changed.has(key)) {
          // a stepped digit arrives from the direction the mark pointed
          play(`translate(0, ${m.dir === 1 ? step * 0.28 : -step * 0.28}px)`, true, 0, fast);
        }
      } else if (key.charCodeAt(0) === 112 /* a pad zero */) {
        play('translate(0, 0)', true, 0, fast);
      } else if (m && m.kind === 'arrive') {
        // the whole number lands at once, left to right, the way a reading resolves
        play(`translate(0, ${-step * 0.32}px)`, true, i * 40, dur);
      } else {
        // a typed digit enters from the right, off the end of the number
        play(`translate(${step}px, 0)`, true, 0, dur);
      }
      i += 1;
    });

    lastRects.current = now;
    mounted.current = true;
  });

  /* ── THE THREE ROUTES ─────────────────────────────────────────────────────────────────────── */

  const handTouched = () => {
    setSource((s) => (s === 'photo' || s === 'adjusted' ? 'adjusted' : 'typed'));
  };

  const typeDigit = (d: string) => {
    if (disabled || readOnly) return;
    motion.current = { kind: 'type' };
    setSlots((prev) => {
      if (prev.length >= maxDigits) return prev;
      if (prev.length === 0 && d === '0') return prev; // a leading zero is the pad, not a digit
      return [...prev, { id: nid(), d }];
    });
    /* the next digit lands in the gram place, so that is where the rule goes back to */
    setPlace(0);
    handTouched();
  };

  const erase = () => {
    if (disabled || readOnly) return;
    motion.current = { kind: 'erase' };
    setSlots((prev) => prev.slice(0, -1));
    setPlace(0);
    setSource((s) => (s === 'photo' || s === 'adjusted' ? 'adjusted' : 'typed'));
  };

  const stepPlace = (at: number, dir: 1 | -1) => {
    if (disabled || readOnly) return;
    const by = 10 ** at;
    setSlots((prev) => {
      const next = clamp(gramsOf(prev) + dir * by, 0, maxGrams);
      const written = writeDigits(digitsOf(next), prev);
      motion.current = { kind: 'step', dir, changed: written.changed };
      return written.slots;
    });
    setSource((s) => (s === 'photo' || s === 'adjusted' ? 'adjusted' : 'stepped'));
  };

  /* THE HOLD. First step on press, then a pause, then a repeat that tightens from a quarter of a
   * second down to a sixteenth — coarse enough to read, fast enough to cross a kilo. */
  const repeat = React.useRef<number | null>(null);
  const stopHold = React.useCallback(() => {
    if (repeat.current !== null) window.clearTimeout(repeat.current);
    repeat.current = null;
    setHeld(null);
  }, []);

  const startHold = (at: number, dir: 1 | -1) => {
    if (disabled || readOnly) return;
    setPlace(at);
    stepPlace(at, dir);
    setHeld(`${at}:${dir}`);
    let n = 0;
    const tick = () => {
      n += 1;
      stepPlace(at, dir);
      repeat.current = window.setTimeout(tick, Math.max(60, 240 - n * 24));
    };
    repeat.current = window.setTimeout(tick, 420);
  };

  React.useEffect(() => () => stopHold(), [stopHold]);

  /* THE PHOTO. The demo scale reads what `scaleReading` says it reads; a real one hands the same
   * number in through the same door. */
  const readTimer = React.useRef<number | null>(null);
  React.useEffect(() => () => {
    if (readTimer.current !== null) window.clearTimeout(readTimer.current);
  }, []);

  const openCamera = () => {
    if (disabled || readOnly) return;
    setPreview(false);
    setCaptureState((c) => (c === 'closed' || c === 'taken' ? 'viewfinder' : 'closed'));
  };

  const readDisplay = () => {
    setCaptureState('reading');
    readTimer.current = window.setTimeout(() => {
      const g = clamp(Math.round(scaleReading * PER_KILO), 0, maxGrams);
      motion.current = { kind: 'arrive' };
      setSlots(writeDigits(digitsOf(g), []).slots);
      setPhotoGrams(g);
      setSource('photo');
      setCaptureState('taken');
    }, 900);
  };

  const binPhoto = () => {
    setPhotoGrams(null);
    setPreview(false);
    setCaptureState('closed');
    setSource(grams > 0 ? 'typed' : 'empty');
  };

  /* ── THE READOUT'S COLUMNS ────────────────────────────────────────────────────────────────
   * ONE list drives all three rows — the marks above, the digits, the marks below — so a mark
   * cannot drift off the digit it changes. The frame holds the slots the number actually needs,
   * never the ones it might one day need: the row grows leftward past four digits, so the readout
   * stays a phone's width. */

  const digits = slots.map((s) => s.d).join('');
  const total = Math.max(MIN_SLOTS, digits.length);
  const pads = total - digits.length;

  const decimalMark = separatorOf(locale, 'decimal');
  const groupMark = separatorOf(locale, 'group');

  const cols: Col[] = [];
  const sep = (ch: string, at: number) => cols.push({ kind: 'sep', key: `s${at}`, ch });
  const pushDigit = (key: string, ch: string, pad: boolean, at: number) => {
    cols.push({ kind: 'digit', key, ch, pad, place: at });
    /* the kilo comma, and then a grouping mark every three kilo digits — so 10.000 kg reads as
       ONE number rather than as five digits somebody has to count */
    if (at === GRAM_PLACES) sep(decimalMark, at);
    else if (at > GRAM_PLACES && (at - GRAM_PLACES) % GROUP === 0) sep(groupMark, at);
  };

  for (let i = 0; i < pads; i += 1) {
    const at = total - 1 - i;
    pushDigit(`p${at}`, '0', true, at);
  }
  slots.forEach((s, i) => pushDigit(s.id, s.d, false, digits.length - 1 - i));

  const digitCols = cols.filter((c) => c.kind === 'digit').length;
  const sepCols = cols.length - digitCols;

  const shared: SharedStyleProps = { $size: size, $disabled: disabled, $readOnly: readOnly };
  const tight = !showMarks;
  const digitShared = (pad: boolean, sub: boolean): DigitStyleProps => ({
    ...shared,
    $pad: pad,
    $sub: sub,
    $tight: tight,
  });

  /* THE RULE'S COLUMN, measured in columns rather than in pixels: everything standing to the left
     of the active place, digits and separators counted separately because they are different
     widths. Clamped to what the number can actually hold right now. */
  const activePlace = Math.min(place, Math.max(0, digitCols - 1));
  const activeAt = cols.findIndex((c) => c.kind === 'digit' && c.place === activePlace);
  const head = activeAt < 0 ? [] : cols.slice(0, activeAt);
  const before = head.filter((c) => c.kind === 'digit').length;
  const sepsBefore = head.filter((c) => c.kind === 'sep').length;

  const readoutRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const focusReadout = (e: React.PointerEvent) => {
    if (disabled || readOnly) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    readoutRef.current?.focus();
  };

  /* ── THE KEYBOARD ─────────────────────────────────────────────────────────────────────────
   * Digits type, backspace shifts back, up and down step the place the rule sits under, and left
   * and right move that rule. Enter commits. The whole field is ONE tab stop, and the marks are
   * taken out of the tab order beneath it — a keyboard already reaches every place through the
   * arrows, and eight extra stops on one number is a tab key nobody can predict. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || readOnly) return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      typeDigit(e.key);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      erase();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepPlace(activePlace, 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepPlace(activePlace, -1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPlace((r) => Math.min(digitCols - 1, r + 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPlace((r) => Math.max(0, r - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape' && captureState !== 'closed') {
      e.preventDefault();
      setCaptureState('closed');
    }
  };

  const onBlur = (e: React.FocusEvent) => {
    setFocused(false);
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    commit();
  };

  const formatted = (g: number) =>
    (g / PER_KILO).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const setCell = (key: string) => (el: HTMLElement | null) => {
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  /** one row of the readout: its columns, then the unit column that keeps «kg» on the number's line */
  const line = (key: string, content: React.ReactNode, showUnit: boolean) => (
    <StyledLine key={key} {...shared} {...lineProps}>
      {content}
      <Unit {...shared} $ghost={!showUnit} aria-hidden={!showUnit || undefined} {...unitProps}>
        {unit}
      </Unit>
    </StyledLine>
  );

  /** THE MARKS ROW — one mark per digit column, exactly over (or under) the digit it changes. */
  const markRow = (up: boolean) => (
    <StyledSlotRow {...shared} $slots={digitCols} $seps={sepCols} $tight={tight}>
      {cols.map((c) =>
        c.kind === 'sep' ? (
          <StyledSpacer key={c.key} {...digitShared(false, false)} />
        ) : (
          <Chevron
            key={c.key}
            type="button"
            tabIndex={-1}
            aria-label={`${up ? 'Up' : 'Down'} ${placeName(c.place, locale, unit)}`}
            {...shared}
            $active={(focused || over) && activePlace === c.place}
            $held={held === `${c.place}:${up ? 1 : -1}`}
            $quiet={quietMarks}
            disabled={disabled}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onPointerDown={() => startHold(c.place, up ? 1 : -1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            {...chevronProps}
          >
            <ChevronMark up={up} />
          </Chevron>
        ),
      )}
    </StyledSlotRow>
  );

  /* ── WHAT THE NUMBER CAME FROM ────────────────────────────────────────────────────────────── */
  const attribution = () => {
    if (source === 'photo') {
      return (
        <>
          <StyledMark {...shared} />
          <span>Read from the scale photo</span>
        </>
      );
    }
    if (source === 'adjusted') {
      return (
        <>
          <span>Adjusted by hand</span>
          {photoGrams !== null && (
            <Figure
              size="mini"
              decimals={3}
              locale={locale}
              was={photoGrams / PER_KILO}
              value={kilos}
              unit={unit}
            />
          )}
        </>
      );
    }
    if (source === 'stepped') return <span>Stepped by hand</span>;
    if (source === 'typed') return <span>Entered by hand</span>;
    /* AN EMPTY FIELD SAYS WHAT IS STILL TO HAPPEN, never that a number is missing — and the zeros
       standing in the frame are dimmed, so nothing here reads as a weight anybody claimed. */
    return <span>To confirm — type it, step it, or photograph the scale.</span>;
  };

  /* ── ORDERED AGAINST GIVEN ────────────────────────────────────────────────────────────────── */
  const orderedGrams = ordered !== undefined ? Math.round(ordered * PER_KILO) : null;
  const delta = orderedGrams === null ? 0 : grams - orderedGrams;
  const span = orderedGrams === null ? 1 : Math.max(orderedGrams * 0.05, 100);
  const off = clamp(delta / span, -1, 1);

  return (
    <Root
      ref={rootRef}
      data-baseweb="weight-entry"
      data-source={source}
      data-place={activePlace}
      {...shared}
      {...rootProps}
    >
      {label && (
        <StyledLabel {...shared}>{label}</StyledLabel>
      )}

      <Field
        {...shared}
        onPointerDown={focusReadout}
        onPointerEnter={() => setOver(true)}
        onPointerLeave={() => setOver(false)}
        {...fieldProps}
      >
        <Readout
          ref={readoutRef}
          {...shared}
          role={readOnly || disabled ? undefined : 'spinbutton'}
          tabIndex={readOnly || disabled ? undefined : 0}
          aria-label={label ?? 'Weight given'}
          aria-valuemin={0}
          aria-valuemax={maxGrams / PER_KILO}
          aria-valuenow={kilos}
          aria-valuetext={`${formatted(grams)} ${unit}`}
          aria-disabled={disabled || undefined}
          aria-readonly={readOnly || undefined}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={onBlur}
          {...readoutProps}
        >
          {showMarks && line('up', markRow(true), false)}

          {line(
            'digits',
            <StyledSlotRow {...shared} $slots={digitCols} $seps={sepCols} $tight={tight}>
              {cols.map((c) =>
                c.kind === 'sep' ? (
                  <StyledComma key={c.key} {...digitShared(pads === total, false)}>
                    {c.ch}
                  </StyledComma>
                ) : (
                  <Digit
                    key={c.key}
                    ref={setCell(c.key)}
                    onPointerDown={() => {
                      if (disabled || readOnly) return;
                      setPlace(c.place);
                    }}
                    {...digitShared(c.pad, c.place < GRAM_PLACES)}
                    {...digitProps}
                  >
                    {c.ch}
                  </Digit>
                ),
              )}
              {/* THE PLACE THE ARROWS ARE DRIVING, marked on the column rather than on the digit */}
              {showMarks && (focused || over) && (
                <StyledPlace {...shared} $before={before} $sepsBefore={sepsBefore} />
              )}
            </StyledSlotRow>,
            true
          )}

          {showMarks && line('down', markRow(false), false)}
        </Readout>

        {camera && !readOnly && (
          <Camera
            type="button"
            {...shared}
            $active={captureState !== 'closed'}
            $held={false}
            $quiet={false}
            disabled={disabled}
            aria-label="Photograph the scale"
            aria-expanded={captureState !== 'closed'}
            onClick={openCamera}
            {...cameraProps}
          >
            <CameraMark />
          </Camera>
        )}
      </Field>

      {showAttribution && (
        <Attribution {...shared} {...attributionProps}>
          {attribution()}
        </Attribution>
      )}

      {photoGrams !== null && captureState === 'taken' && (
        <StyledChip {...shared}>
          <StyledChipButton
            {...shared}
            type="button"
            aria-label={preview ? 'Hide the scale photo' : 'Show the scale photo'}
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
          >
            <StyledThumb {...shared}>{formatted(photoGrams)}</StyledThumb>
            <span>Scale photo</span>
          </StyledChipButton>
          <StyledChipButton {...shared} type="button" aria-label="Bin the scale photo" onClick={binPhoto}>
            <TrashMark />
          </StyledChipButton>
        </StyledChip>
      )}

      {(captureState === 'viewfinder' || captureState === 'reading' || (captureState === 'taken' && preview)) && (
        <StyledViewfinder {...shared}>
          <StyledScaleDisplay {...shared}>
            <span>{formatted(Math.round(scaleReading * PER_KILO))}</span>
            <span className={css({ ...theme.typography.LabelSmall })}>{unit}</span>
            {captureState === 'reading' && <StyledScan {...shared} />}
          </StyledScaleDisplay>
          {captureState === 'viewfinder' && (
            <Button kind={KIND.primary} size={BUTTON_SIZE.compact} onClick={readDisplay}>
              Read the display
            </Button>
          )}
          {captureState === 'reading' && (
            <span className={css({ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary })}>
              Reading the display…
            </span>
          )}
          {captureState === 'taken' && preview && (
            <span className={css({ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary })}>
              The photograph this number came from.
            </span>
          )}
        </StyledViewfinder>
      )}

      {/* ── ORDERED AGAINST GIVEN, IN THREE LINES (FEED-IA §31.4, the density pass) ────────────
          It was four stacked rows — ordered, given, the rule, the difference — each one a label at
          the left and a figure at the right of a column narrow enough that the two never met. So
          the block spent a hundred and forty pixels saying two numbers and their difference.

          The two numbers are ONE COMPARISON, so they share a row and read as one; the rule draws
          that comparison; the difference names it. Nothing is lost — every figure that was here is
          still here, in the Figure lockup, unit on the number's own line — and the block is two
          rows shorter, which is the room an open weighed line needed back. */}
      {orderedGrams !== null && (
        <Compare {...shared} {...compareProps}>
          <StyledCompareRow {...shared}>
            <StyledCompareLabel {...shared}>
              Ordered{' '}
              <Figure size="compact" decimals={3} locale={locale} value={orderedGrams / PER_KILO} unit={unit} />
            </StyledCompareLabel>
            <StyledCompareLabel {...shared}>
              Given{' '}
              <Figure size="compact" decimals={3} locale={locale} value={kilos} unit={unit} />
            </StyledCompareLabel>
          </StyledCompareRow>
          <StyledTrack {...shared}>
            <StyledTrackFill
              {...shared}
              style={{ left: off >= 0 ? '50%' : `${50 + off * 50}%`, width: `${Math.abs(off) * 50}%` }}
            />
            <StyledTrackTick {...shared} />
          </StyledTrack>
          <StyledCompareRow {...shared}>
            <StyledCompareLabel {...shared}>
              {delta === 0 ? 'Exactly as ordered' : delta > 0 ? 'Over by' : 'Under by'}
            </StyledCompareLabel>
            {delta !== 0 && (
              <Figure size="compact" decimals={0} locale={locale} value={Math.abs(delta)} unit="g" />
            )}
          </StyledCompareRow>
        </Compare>
      )}
    </Root>
  );
};

export default WeightEntry;
