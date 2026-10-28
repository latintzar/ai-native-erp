/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract — on the anatomy of Base's `src/skeleton/`.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type * as React from 'react';
import type { Override } from 'baseui/helpers/overrides';
import type { Size as FigureSize } from '../figure';
import type { SHAPE, TONE, SIZE, LEADING, TRAILING, NAV_VARIANT } from './constants';

export type Shape = keyof typeof SHAPE;
export type Tone = keyof typeof TONE;
export type Size = keyof typeof SIZE;
export type Leading = keyof typeof LEADING;
export type Trailing = keyof typeof TRAILING;
export type NavVariant = keyof typeof NAV_VARIANT;

/* ── THE ANNOTATION PAIR ──────────────────────────────────────────────────────────────────────
 * Every ghost carries the same two optional marks, and they answer the same two questions on
 * every surface: what stands here, and who decided it.
 *
 *   · `label`     — the WHISPER. One or two words naming the thing, in the smallest step on the
 *                   ramp. It is a name, never a sentence: the region is undecided, and a sentence
 *                   would decide it.
 *   · `reference` — the POINTER. The scenario that owns this region. It renders as a chip with a
 *                   leading arrow, so the catalogue reads as a web: a grey area either points at
 *                   the scenario that decides it, or it is openly open.
 */
export type GhostAnnotations = {
  /** one or two words naming what stands here */
  label?: React.ReactNode;
  /** the scenario that decides this region — pass the reference alone («B3»); the arrow is drawn */
  reference?: React.ReactNode;
};

/** Shared by every member of the family: a ghost is inert, and it may be told it is genuinely
 *  waiting on data rather than on a decision. */
export type GhostCommon = GhostAnnotations & {
  /** THE SKELETON HERE MEANS «UNDECIDED», NOT «LOADING» — so there is no animation by default.
   *  Set this only where the ghost really is standing in for data on its way, and Base's own
   *  shimmer runs. A scenario's negative space never sets it: architecture does not load. */
  loading?: boolean;
  /** what a reader who hears the page should be told stands here. Left out, the ghost is hidden
   *  from assistive technology entirely — it names nothing, so it should say nothing. */
  'aria-label'?: string;
};

/** The annotation strip, on every member of the family — so a scenario restyles «what stands
 *  here» and «who decided it» in ONE place and every ghost on the page follows. */
export type GhostAnnotationOverrides = {
  /** the strip the two annotations sit in */
  Annotations?: Override;
  /** the whisper naming what stands here */
  Label?: Override;
  /** the chip pointing at the scenario that decides it */
  Reference?: Override;
};

/* ── GhostBlock — the primitive ───────────────────────────────────────────────────────────── */

export type GhostBlockOverrides = GhostAnnotationOverrides & {
  /** the shaped region itself */
  Root?: Override;
  /** the box that holds real, decided content standing inside the ghost */
  Content?: Override;
};

export type GhostBlockProps = GhostCommon & {
  shape?: Shape;
  tone?: Tone;
  /** any CSS length; a number is read as px */
  width?: string | number;
  height?: string | number;
  /** take the spare space of the row this stands in */
  grow?: boolean;
  /** THE NESTING SLOT. A sub-scenario renders full-fidelity inside a skeleton parent, so you can
   *  see exactly where in the undecided page the decided moment lives. Give a ghost children and
   *  it yields its ground to them: the fill drops, the geometry stays, and pointer events come
   *  back for the real component inside. */
  children?: React.ReactNode;
  overrides?: GhostBlockOverrides;
};

/* ── GhostAvatar ──────────────────────────────────────────────────────────────────────────── */

export type GhostAvatarOverrides = GhostAnnotationOverrides & {
  Root?: Override;
};

export type GhostAvatarProps = GhostCommon & {
  size?: Size;
  tone?: Tone;
  overrides?: GhostAvatarOverrides;
};

/* ── GhostFigure ──────────────────────────────────────────────────────────────────────────── */

export type GhostFigureOverrides = GhostAnnotationOverrides & {
  /** the lockup — the blank and its unit, on one line */
  Root?: Override;
  /** the number-shaped blank */
  Value?: Override;
  /** the unit-shaped stub, on the figure's own line, always */
  Unit?: Override;
};

export type GhostFigureProps = GhostCommon & {
  /** how many digits wide the blank stands. The ghost of a number is still a number's width. */
  digits?: number;
  /** draw the unit stub. It shares the blank's line, because that is where a unit lives. */
  unit?: boolean;
  /** Figure's own ramp, so the blank is exactly as tall as the number that will replace it */
  size?: FigureSize;
  tone?: Tone;
  overrides?: GhostFigureOverrides;
};

/* ── GhostRow ─────────────────────────────────────────────────────────────────────────────── */

export type GhostRowOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** what stands at the head of the row */
  Leading?: Override;
  /** the stack of ghosted text lines */
  Content?: Override;
  /** one ghosted line */
  Line?: Override;
  /** what stands at the tail */
  Trailing?: Override;
};

export type GhostRowProps = GhostCommon & {
  leading?: Leading;
  /** how many lines of text stand in the middle */
  lines?: number;
  trailing?: Trailing;
  size?: Size;
  /** the row is the one the surface is on */
  selected?: boolean;
  /** where this row stands in the set it belongs to. It cycles the ghosted line widths, so a
   *  column of rows reads as text of varying length rather than as a barcode of identical bars.
   *  GhostList passes it; set it by hand when rows are laid out one by one. */
  index?: number;
  /** the nesting slot — the row's middle yields to real content */
  children?: React.ReactNode;
  overrides?: GhostRowOverrides;
};

/* ── GhostList ────────────────────────────────────────────────────────────────────────────── */

export type GhostListOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** the hairline between rows */
  Divider?: Override;
  /** every row's own overrides */
  Row?: GhostRowOverrides;
};

export type GhostListProps = GhostCommon &
  Omit<
    GhostRowProps,
    'overrides' | 'label' | 'reference' | 'children' | 'aria-label' | 'selected' | 'index'
  > & {
    /** how many rows stand there. The count is the honest part: «about five of these». */
    rows?: number;
    /** which row is the one the surface is on, if any */
    selected?: number;
    /** hairlines between rows */
    divider?: boolean;
    overrides?: GhostListOverrides;
  };

/* ── GhostCard ────────────────────────────────────────────────────────────────────────────── */

export type GhostCardOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** the picture region on top */
  Media?: Override;
  /** the body */
  Body?: Override;
  /** the title line */
  Title?: Override;
  /** one body line */
  Line?: Override;
  /** the control at the foot */
  Action?: Override;
  /** the box that holds real, decided content standing inside the card */
  Content?: Override;
};

export type GhostCardProps = GhostCommon & {
  /** a picture region on top */
  media?: boolean;
  /** how many body lines under the title */
  lines?: number;
  /** a control at the foot */
  action?: boolean;
  height?: string | number;
  /** the nesting slot — the card's body yields to real content */
  children?: React.ReactNode;
  overrides?: GhostCardOverrides;
};

/* ── GhostTabs ────────────────────────────────────────────────────────────────────────────── */

export type GhostTabsOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** the strip the tabs stand on */
  TabList?: Override;
  /** one tab */
  Tab?: Override;
  /** the mark under the tab the surface is on */
  Highlight?: Override;
  /** the hairline the whole strip sits on */
  Border?: Override;
};

export type GhostTabsProps = GhostCommon & {
  /** how many tabs stand there */
  tabs?: number;
  /** which one the surface is on */
  selected?: number;
  overrides?: GhostTabsOverrides;
};

/* ── GhostHeader ──────────────────────────────────────────────────────────────────────────── */

export type GhostHeaderOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** the step-back control */
  Back?: Override;
  /** the title and its second line */
  Titles?: Override;
  Title?: Override;
  Subtitle?: Override;
  /** the controls at the end */
  Actions?: Override;
  Action?: Override;
};

export type GhostHeaderProps = GhostCommon & {
  /** a step-back control at the head */
  back?: boolean;
  /** a second line under the title */
  subtitle?: boolean;
  /** how many controls stand at the end */
  actions?: number;
  /** the hairline the header sits on */
  divider?: boolean;
  overrides?: GhostHeaderOverrides;
};

/* ── GhostNav ─────────────────────────────────────────────────────────────────────────────── */

export type GhostNavOverrides = GhostAnnotationOverrides & {
  Root?: Override;
  /** the mark at the top of a side nav */
  Brand?: Override;
  /** one destination */
  Item?: Override;
  /** a destination's icon */
  Icon?: Override;
  /** a destination's name */
  Line?: Override;
};

export type GhostNavProps = GhostCommon & {
  variant?: NavVariant;
  /** how many destinations */
  items?: number;
  /** which one the surface is on */
  selected?: number;
  /** a mark at the top of a side nav */
  brand?: boolean;
  /** side nav only */
  width?: string | number;
  overrides?: GhostNavOverrides;
};

/* ── THE SHARED STYLE PROPS ───────────────────────────────────────────────────────────────────
 * ONE shape, Base's own convention (see `modal/types.ts` — `SharedStylePropsArg`): every styled
 * element in the family takes the same object, and the members that only mean something to one of
 * them are optional. It is why the family has one look: there is one place a grey is chosen.
 */
export type SharedStyleProps = {
  $shape: Shape;
  $tone: Tone;
  $size: Size;
  /** the ghost is drawing its own ground; false when real content stands in it */
  $filled: boolean;
  /** genuinely waiting on data — Base's shimmer runs */
  $loading: boolean;
  $width?: string | number;
  $height?: string | number;
  $grow?: boolean;
  /** this element is the one the surface is on */
  $selected?: boolean;
  /** where in a repeated set this element stands — drives the cycled widths */
  $index?: number;
  /** a hairline closes this element */
  $divider?: boolean;
  /** the nav's frame */
  $variant?: NavVariant;
};
